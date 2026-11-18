import { Anchor, Button, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconScan } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { isPdf, needsChoice, type Document, type DocumentInput } from 'shared'
import decor from '~/app/decor.module.css'
import { useSession } from '~/features/auth/session.ts'
import DocumentForm from '~/features/documents/components/DocumentForm.tsx'
import DocumentSteps from '~/features/documents/components/DocumentSteps.tsx'
import DraftFile from '~/features/documents/components/DraftFile.tsx'
import FileField from '~/features/documents/components/FileField.tsx'
import FileStages from '~/features/documents/components/FileStages.tsx'
import ReadPanel from '~/features/documents/components/ReadPanel.tsx'
import { PAGE_WIDTH } from '~/features/documents/look.ts'
import { documentKey, isReading, refreshDocuments, useDocument, useReadOutcome } from '~/features/documents/useDocuments.ts'
import type { FileToSend } from '~/features/upload/prepare.ts'
import { uploadDraft } from '~/features/upload/upload.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api, ApiError, errorCode } from '~/shared/lib/api.ts'

// Processing takes a few seconds. After this long the page says it is taking longer.
const SLOW_AFTER = 20_000

// A new document: its file goes first, as a draft whose id the address keeps, so a reload finds it again.
// The fields open once the processed photo is approved. A document without a file needs only its fields.
export default function NewDocumentPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const draftId = params.get('draft') ?? undefined
  // The prepared file, kept on screen until it is processed. A new round empties the file field.
  const [picked, setPicked] = useState<FileToSend | null>(null)
  // The document that already has the picked file, by the file's hash.
  const [duplicate, setDuplicate] = useState<{ hash: string; id: string }>()
  const [round, setRound] = useState(0)
  const [preparing, setPreparing] = useState(false)
  // Percent sent, while sending.
  const [progress, setProgress] = useState<number>()
  const [slow, setSlow] = useState(false)
  const upload = useRef<AbortController>(undefined)
  const { data, error } = useDocument(draftId)
  const apiError = error ? errorCode(error) : undefined
  // The draft the address names, unless it is gone, e.g. expired. Any other error keeps the page as it is.
  const tracked = draftId !== undefined && apiError !== 'not_found'
  const draft = data?.draft ? data : undefined
  const sending = progress !== undefined
  const processing = !sending && draft?.status === 'processing'
  const ready = draft?.status === 'done' && !needsChoice(draft.file)
  const file = picked?.file
  const kind = file ? (isPdf(file.type) ? 'pdf' : 'photo') : undefined
  const locked = (picked !== null || tracked) && !ready
  const reading = isReading(draft)
  const { outcome, suggestion } = useReadOutcome(draft)
  const duplicateOf = duplicate?.hash === picked?.hash ? duplicate?.id : undefined
  const busy = sending
    ? { label: t('documents.busy.sending', { progress }) }
    : processing && kind
      ? { label: t(`documents.busy.${kind}`), scan: true }
      : undefined
  // The stage the file is at, a failed check included. Each new one starts at the top of the page.
  const stage = sending ? 'sending' : draft?.status === 'done' ? (ready ? 'fields' : 'choice') : draft?.status
  const shownStage = useRef(stage)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (stage && stage !== shownStage.current) window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' })
    shownStage.current = stage
  }, [stage, reduceMotion])

  // Leaving the page stops the upload, which then deletes its draft.
  useEffect(() => () => upload.current?.abort(), [])

  useEffect(() => {
    if (!processing) return
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [processing])

  const send = useApiSubmit(async () => {
    if (!picked) return
    const controller = new AbortController()
    upload.current = controller
    setProgress(0)
    try {
      const id = await uploadDraft(picked, {
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
      if (err instanceof ApiError && err.code === 'duplicate' && err.id) setDuplicate({ hash: picked.hash, id: err.id })
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
    setPicked(null)
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
    if (draftId) queryClient.removeQueries({ queryKey: documentKey(draftId), exact: true })
  }

  if (user?.demo) return <Navigate to="/documents" replace />
  // A saved document opens on its own page.
  if (data && !data.draft) return <Navigate to={`/documents/${data.id}`} replace />

  const aside = (
    <Stack gap="md">
      {/* Kept while the file is on its way, so the photo stays in view. */}
      {(!tracked || ((sending || processing || !draft) && file)) && (
        <FileField
          key={round}
          onChange={setPicked}
          onPreparing={setPreparing}
          disabled={send.pending || processing}
          busy={busy}
        />
      )}
      {file && !draft && !sending && (
        <>
          {duplicateOf ? (
            <StatusAlert status="warning">
              {t('errors.duplicate')}{' '}
              <Anchor component={Link} to={`/documents/${duplicateOf}`} inherit fw={600}>
                {t('documents.openDuplicate')}
              </Anchor>
            </StatusAlert>
          ) : (
            send.error !== 'duplicate' && <ApiErrorAlert code={send.error} />
          )}
          <Button
            leftSection={<IconScan size={20} aria-hidden />}
            loading={preparing}
            className={decor.stamp}
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
          {t('common.cancel')}
        </Button>
      )}
    </Stack>
  )

  return (
    <Page title={t('documents.new')} back={{ to: '/documents', label: t('documents.title') }} width={PAGE_WIDTH.withFile}>
      <ApiErrorAlert code={apiError} />
      <DocumentSteps active={ready ? 2 : tracked || sending ? 1 : 0} />
      <DocumentForm
        aside={aside}
        top={ready && draft && <ReadPanel doc={draft} outcome={outcome} />}
        lock={locked ? 'photo' : reading ? 'reading' : undefined}
        suggestion={suggestion}
        onSave={save}
        onCancel={() => void cancel()}
      />
    </Page>
  )
}
