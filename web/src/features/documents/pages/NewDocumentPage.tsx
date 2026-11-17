import { Button, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { IconScan } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { isPdf, type Document, type DocumentInput, type Draft } from 'shared'
import DocumentForm, { PAGE_WIDTH_WITH_FILE } from '~/features/documents/components/DocumentForm.tsx'
import DocumentSteps from '~/features/documents/components/DocumentSteps.tsx'
import DraftFile from '~/features/documents/components/DraftFile.tsx'
import FileField from '~/features/documents/components/FileField.tsx'
import FileStages from '~/features/documents/components/FileStages.tsx'
import { documentKey, isPending, PENDING_REFRESH, refreshDocuments } from '~/features/documents/useDocuments.ts'
import { uploadDraft } from '~/features/upload/upload.ts'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api, errorCode } from '~/shared/lib/api.ts'

// Processing takes a few seconds. After this long the page says it is taking longer.
const SLOW_AFTER = 20_000

// A new document: its file goes first, as a draft whose id the address keeps, so a reload finds it again.
// The fields open once the processed photo is approved. A document without a file needs only its fields.
export default function NewDocumentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const draftId = params.get('draft') ?? undefined
  // The prepared file, kept on screen until it is processed. A new round empties the file field.
  const [file, setFile] = useState<Blob | null>(null)
  const [round, setRound] = useState(0)
  const [preparing, setPreparing] = useState(false)
  // Percent sent, while sending.
  const [progress, setProgress] = useState<number>()
  const [slow, setSlow] = useState(false)
  const upload = useRef<AbortController>(undefined)
  const { data, error } = useQuery({
    queryKey: documentKey(draftId ?? ''),
    queryFn: () => api.get<Document | Draft>(`/documents/${draftId}`),
    enabled: draftId !== undefined,
    refetchInterval: (query) => (query.state.data && isPending(query.state.data) ? PENDING_REFRESH : false),
  })
  // The draft the address names, unless it is gone, e.g. expired.
  const tracked = draftId !== undefined && !error
  const draft = data?.draft ? data : undefined
  const sending = progress !== undefined
  const processing = !sending && draft?.status === 'processing'
  const ready = draft?.status === 'done' && (!draft.file?.change || draft.file.use !== undefined)
  const kind = file ? (isPdf(file.type) ? 'pdf' : 'photo') : undefined
  const locked = (file !== null || tracked) && !ready

  useEffect(() => {
    if (!processing) return
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [processing])

  const send = useApiSubmit(async () => {
    if (!file) return
    const controller = new AbortController()
    upload.current = controller
    setProgress(0)
    try {
      const id = await uploadDraft(file, {
        onCreated: (created) => setParams({ draft: created }, { replace: true }),
        onProgress: setProgress,
        signal: controller.signal,
      })
      // The draft shows as processing before the progress goes, so the page never takes it for stuck.
      await queryClient.refetchQueries({ queryKey: documentKey(id) })
    } catch (err) {
      // Cancelled: the page is already on its way out.
      if (controller.signal.aborted) return
      // The upload deleted its draft, so the picked file can be sent again.
      setParams({}, { replace: true })
      throw err
    } finally {
      setProgress(undefined)
    }
  })

  async function discard() {
    upload.current?.abort()
    if (draftId) await api.delete(`/documents/${draftId}`).catch(() => undefined)
  }

  async function otherPhoto() {
    await discard()
    setFile(null)
    setRound((count) => count + 1)
    setParams({}, { replace: true })
  }

  async function cancel() {
    await discard()
    navigate('/documents')
  }

  async function save(input: DocumentInput) {
    if (draftId) await api.put<Document>(`/documents/${draftId}`, input)
    else await api.post('/documents', input)
    await refreshDocuments(queryClient)
    navigate('/documents')
  }

  // A saved document opens on its own page.
  if (data && !data.draft) return <Navigate to={`/documents/${data.id}`} replace />

  const aside = (
    <Stack gap="md">
      {/* Kept while the file is on its way, so the photo stays in view. */}
      {(!tracked || ((sending || processing || !draft) && file)) && (
        <FileField key={round} onChange={setFile} onPreparing={setPreparing} disabled={send.pending || processing} />
      )}
      {file && !draft && !sending && (
        <>
          {send.error && <StatusAlert status="error">{t(`errors.${send.error}`)}</StatusAlert>}
          <Button
            size="md"
            leftSection={<IconScan size={20} aria-hidden />}
            loading={preparing}
            onClick={() => void send.submit(undefined)}
          >
            {t(kind === 'pdf' ? 'documents.sendPdf' : 'documents.send')}
          </Button>
          <Text size="sm" c="dimmed">
            {t(kind === 'pdf' ? 'documents.sendPdfHint' : 'documents.sendHint')}
          </Text>
        </>
      )}
      {tracked && !data && !file && (
        <Paper aria-busy>
          <Skeleton h={360} />
        </Paper>
      )}
      {(sending || processing) && <FileStages stage={sending ? 'sending' : 'processing'} progress={progress} kind={kind} />}
      {slow && (
        <>
          <StatusAlert status="info">{t('documents.slow')}</StatusAlert>
          <Button variant="default" onClick={() => void otherPhoto()}>
            {t('documents.otherPhoto')}
          </Button>
        </>
      )}
      {draft && !sending && !processing && <DraftFile draft={draft} onOtherPhoto={() => void otherPhoto()} />}
      {/* On a phone the fields, and their Cancel, stay hidden until the photo is approved. */}
      {(tracked || sending) && locked && (
        <Button variant="default" hiddenFrom="md" onClick={() => void cancel()}>
          {t('documents.cancel')}
        </Button>
      )}
    </Stack>
  )

  return (
    <Page title={t('documents.new')} back={{ to: '/documents', label: t('documents.title') }} width={PAGE_WIDTH_WITH_FILE}>
      {error && <StatusAlert status="error">{t(`errors.${errorCode(error)}`)}</StatusAlert>}
      <DocumentSteps active={ready ? 2 : tracked || sending ? 1 : 0} />
      <DocumentForm aside={aside} locked={locked} onSave={save} onCancel={() => void cancel()} />
    </Page>
  )
}
