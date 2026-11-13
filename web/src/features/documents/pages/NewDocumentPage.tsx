import { Button, Group, NumberInput, Paper, Select, Stack, TextInput, Title } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { schemaResolver, useForm } from '@mantine/form'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/pl'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  CATEGORIES,
  DOCUMENT_TYPES,
  DocumentInput,
  TEXT_MAX_LENGTH,
  type DocumentType,
  type Subtype,
} from 'shared'
import { documentsKey } from '~/features/documents/useDocuments.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type DocumentValues = {
  type: DocumentType
  subtype: string | null
  title: string
  issuer: string
  amount: number | string
  docDate: string | null
}

// Empty fields drop out and the amount turns into grosze.
const toInput = (values: DocumentValues) => ({
  type: values.type,
  subtype: values.subtype ?? undefined,
  title: values.title.trim() || undefined,
  issuer: values.issuer,
  amount: typeof values.amount === 'number' ? Math.round(values.amount * 100) : undefined,
  docDate: values.docDate ?? undefined,
})

const checkInput = schemaResolver(DocumentInput, { sync: true })

export default function NewDocumentPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formError = useFormError()
  // Controlled, so the subcategory list follows the chosen type.
  const form = useForm<DocumentValues>({
    initialValues: {
      type: 'receipt',
      subtype: null,
      title: '',
      issuer: '',
      amount: '',
      docDate: dayjs().format('YYYY-MM-DD'),
    },
    enhanceGetInputProps: validateFilledOnBlur(),
    // The API's schema decides what is valid; each field gets its own message.
    validate: (values) =>
      Object.fromEntries(Object.keys(checkInput(toInput(values))).map((field) => [field, `documents.errors.${field}`])),
  })
  const { submit, pending, error } = useApiSubmit(async (values: DocumentValues) => {
    await api.post('/documents', toInput(values))
    await queryClient.invalidateQueries({ queryKey: documentsKey })
    navigate('/documents')
  })
  const subtypes: readonly Subtype[] = CATEGORIES[form.values.type]

  return (
    <Stack gap="lg" maw={560}>
      <Title>{t('documents.new')}</Title>
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
            <Group justify="flex-end" mt="sm">
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
    </Stack>
  )
}
