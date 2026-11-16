import {
  Anchor,
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  TextInput,
  Title,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { schemaResolver, useForm } from '@mantine/form'
import dayjs from 'dayjs'
import 'dayjs/locale/pl'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  AMOUNT_MAX,
  CATEGORIES,
  DOCUMENT_TYPES,
  DocumentInput,
  TEXT_MAX_LENGTH,
  type Document,
  type DocumentFile,
  type DocumentType,
  type NewDocumentInput,
  type Subtype,
} from 'shared'
import FileField from '~/features/documents/components/FileField.tsx'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import { uploadFile } from '~/features/upload/upload.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'
import { formatMoney } from '~/shared/lib/format.ts'

type DocumentValues = {
  type: DocumentType
  subtype: string | null
  title: string
  issuer: string
  amount: number | string
  docDate: string | null
  // What goes to S3, already prepared by FileField.
  file: Blob | null
}

const toValues = (doc?: DocumentInput): DocumentValues => ({
  type: doc?.type ?? 'receipt',
  subtype: doc?.subtype ?? null,
  title: doc?.title ?? '',
  issuer: doc?.issuer ?? '',
  amount: doc?.amount === undefined ? '' : doc.amount / 100,
  docDate: doc?.docDate ?? dayjs().format('YYYY-MM-DD'),
  file: null,
})

// Empty fields drop out and the amount turns into grosze.
const toInput = (values: DocumentValues): DocumentInput => ({
  type: values.type,
  subtype: values.subtype ?? undefined,
  title: values.title.trim() || undefined,
  issuer: values.issuer,
  amount: typeof values.amount === 'number' ? Math.round(values.amount * 100) : undefined,
  docDate: values.docDate ?? '',
})

const checkInput = schemaResolver(DocumentInput, { sync: true })

// The page is wide enough for the file in a column beside the fields.
export const PAGE_WIDTH_WITH_FILE = 1100

// A saved file. A photo shows on the page, a PDF opens in a new tab.
function SavedFile({ id, file }: { id: string; file: DocumentFile }) {
  const { t } = useTranslation()
  // The API answers this address with a short-lived link to S3.
  const url = `/api/documents/${id}/file`

  return (
    <FilePreview file={file} image={file.type === 'application/pdf' ? undefined : url}>
      <Anchor href={url} target="_blank" rel="noopener" size="sm" fw={600}>
        {t('documents.openFile')}
      </Anchor>
    </FilePreview>
  )
}

type DocumentFormProps = {
  // Without a document the form creates one, and only a new document can get a file.
  doc?: Document
  onSave: (input: NewDocumentInput) => Promise<void>
  // Placed at the start of the button row, e.g. a delete button.
  extraAction?: ReactNode
}

// The document's fields, with its file in a column beside them.
export default function DocumentForm({ doc, onSave, extraAction }: DocumentFormProps) {
  const { t, i18n } = useTranslation()
  const formError = useFormError({ maxLength: TEXT_MAX_LENGTH, maxAmount: formatMoney(AMOUNT_MAX, 'compact') })
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState(0)
  // Controlled, so the subcategory list follows the chosen type.
  const form = useForm<DocumentValues>({
    initialValues: toValues(doc),
    enhanceGetInputProps: validateFilledOnBlur(),
    // The API's schema decides what is valid; each field gets its own message.
    validate: (values) =>
      Object.fromEntries(Object.keys(checkInput(toInput(values))).map((field) => [field, `documents.errors.${field}`])),
  })
  const { submit, pending, error } = useApiSubmit(async (values: DocumentValues) => {
    const fileId = values.file ? await uploadFile(values.file, setProgress) : undefined
    await onSave({ ...toInput(values), fileId })
  })
  const subtypes: readonly Subtype[] = CATEGORIES[form.values.type]
  const fileColumn = doc ? (
    doc.file && <SavedFile id={doc.id} file={doc.file} />
  ) : (
    <FileField
      onChange={(file) => form.setFieldValue('file', file)}
      onPreparing={setPreparing}
      disabled={pending || preparing}
    />
  )

  return (
    <Stack gap="lg">
      {!doc && (
        <Stepper active={form.values.file ? 1 : 0} size="sm" color="saffron" maw={320}>
          <Stepper.Step label={t('documents.steps.file')} />
          <Stepper.Step label={t('documents.steps.fields')} />
        </Stepper>
      )}
      <SimpleGrid cols={{ base: 1, md: fileColumn ? 2 : 1 }} spacing="lg">
        {fileColumn}
        <Paper p="xl">
          <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
            <Stack gap="md">
              <Title order={2} size="h3">
                {t('documents.fieldsTitle')}
              </Title>
              {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
              <Select
                label={t('documents.fields.type')}
                data={DOCUMENT_TYPES.map((type) => ({ value: type, label: t(`categories.types.${type}`) }))}
                allowDeselect={false}
                {...form.getInputProps('type')}
                onChange={(type) => {
                  form.setFieldValue('type', type as DocumentType)
                  form.setFieldValue('subtype', null)
                }}
                error={formError(form.errors.type)}
              />
              {subtypes.length > 0 && (
                <Select
                  label={t('documents.fields.subtype')}
                  data={subtypes.map((subtype) => ({ value: subtype, label: t(`categories.subtypes.${subtype}`) }))}
                  clearable
                  {...form.getInputProps('subtype')}
                  error={formError(form.errors.subtype)}
                />
              )}
              <TextInput
                label={t('documents.fields.issuer')}
                placeholder={t('documents.placeholders.issuer')}
                maxLength={TEXT_MAX_LENGTH}
                required
                {...form.getInputProps('issuer')}
                error={formError(form.errors.issuer)}
              />
              <TextInput
                label={t('documents.fields.title')}
                placeholder={t('documents.placeholders.title')}
                maxLength={TEXT_MAX_LENGTH}
                {...form.getInputProps('title')}
                error={formError(form.errors.title)}
              />
              <Group grow align="flex-start">
                <NumberInput
                  label={t('documents.fields.amount')}
                  decimalScale={2}
                  decimalSeparator={i18n.language === 'pl' ? ',' : '.'}
                  allowNegative={false}
                  hideControls
                  inputMode="decimal"
                  {...form.getInputProps('amount')}
                  error={formError(form.errors.amount)}
                />
                <DatePickerInput
                  label={t('documents.fields.docDate')}
                  locale={i18n.language}
                  valueFormat="D MMM YYYY"
                  required
                  {...form.getInputProps('docDate')}
                  error={formError(form.errors.docDate)}
                />
              </Group>
              {pending && form.values.file && <Progress value={progress} aria-label={t('documents.uploading')} />}
              <Group justify="flex-end" mt="sm">
                {extraAction}
                <Button component={Link} to="/documents" variant="default">
                  {t('documents.cancel')}
                </Button>
                <Button type="submit" loading={pending} disabled={preparing}>
                  {t('documents.save')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
