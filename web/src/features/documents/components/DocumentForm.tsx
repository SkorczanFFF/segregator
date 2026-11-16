import { Button, FileInput, Group, NumberInput, Paper, Progress, Select, Stack, Text, TextInput } from '@mantine/core'
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
  FILE_MAX_SIZE,
  FILE_TYPES,
  TEXT_MAX_LENGTH,
  UploadInput,
  type Document,
  type DocumentType,
  type NewDocumentInput,
  type Subtype,
} from 'shared'
import { uploadFile } from '~/features/upload/upload.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'
import { fileFormat, formatFileSize, formatMoney } from '~/shared/lib/format.ts'

type DocumentValues = {
  type: DocumentType
  subtype: string | null
  title: string
  issuer: string
  amount: number | string
  docDate: string | null
  file: File | null
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

const fileFits = (file: File) =>
  UploadInput.safeParse({ type: file.type }).success && file.size > 0 && file.size <= FILE_MAX_SIZE

type DocumentFormProps = {
  // Without a document the form creates one, and only a new document can get a file.
  doc?: Document
  onSave: (input: NewDocumentInput) => Promise<void>
  // Placed at the start of the button row, e.g. a delete button.
  extraAction?: ReactNode
}

export default function DocumentForm({ doc, onSave, extraAction }: DocumentFormProps) {
  const { t, i18n } = useTranslation()
  const formError = useFormError({
    maxLength: TEXT_MAX_LENGTH,
    maxAmount: formatMoney(AMOUNT_MAX, 'compact'),
    maxSize: formatFileSize(FILE_MAX_SIZE),
  })
  const [progress, setProgress] = useState(0)
  // Controlled, so the subcategory list follows the chosen type.
  const form = useForm<DocumentValues>({
    initialValues: toValues(doc),
    enhanceGetInputProps: validateFilledOnBlur(),
    // The API's schema decides what is valid; each field gets its own message.
    validate: (values) => {
      const fields = Object.keys(checkInput(toInput(values)))
      if (values.file && !fileFits(values.file)) fields.push('file')
      return Object.fromEntries(fields.map((field) => [field, `documents.errors.${field}`]))
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: DocumentValues) => {
    const fileId = values.file ? await uploadFile(values.file, setProgress) : undefined
    await onSave({ ...toInput(values), fileId })
  })
  const subtypes: readonly Subtype[] = CATEGORIES[form.values.type]

  return (
    <Paper>
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="md">
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
          {!doc && (
            <FileInput
              label={t('documents.fields.file')}
              placeholder={t('documents.placeholders.file', { maxSize: formatFileSize(FILE_MAX_SIZE) })}
              accept={FILE_TYPES.join(',')}
              clearable
              {...form.getInputProps('file')}
              error={formError(form.errors.file)}
            />
          )}
          {doc?.file && (
            <Text size="sm" c="dimmed">
              {t('documents.file', { format: fileFormat(doc.file.type), size: formatFileSize(doc.file.size) })}
            </Text>
          )}
          {pending && form.values.file && <Progress value={progress} aria-label={t('documents.uploading')} />}
          <Group justify="flex-end" mt="sm">
            {extraAction}
            <Button component={Link} to="/documents" variant="default">
              {t('documents.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('documents.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
