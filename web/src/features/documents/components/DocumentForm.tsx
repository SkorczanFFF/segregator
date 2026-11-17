import {
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Fieldset,
  Group,
  NumberInput,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Tooltip,
  VisuallyHidden,
  type MantineColor,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { schemaResolver, useForm } from '@mantine/form'
import { IconBuildingStore, IconCalendar, IconTag, IconTrash } from '@tabler/icons-react'
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
  isPdf,
  TEXT_MAX_LENGTH,
  type Document,
  type DocumentFile,
  type DocumentType,
  type Subtype,
} from 'shared'
import classes from '~/features/documents/components/documents.module.css'
import FileField from '~/features/documents/components/FileField.tsx'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import { CARD_INSET, describeDocument, documentName, TYPE_LOOKS } from '~/features/documents/look.ts'
import type { OnProgress } from '~/features/upload/upload.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'
import { currencySymbol, formatMoney } from '~/shared/lib/format.ts'

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

// A button that stays pressed while chosen, tinted in the given color.
const toggle = (chosen: boolean, color: MantineColor) =>
  ({
    variant: chosen ? 'light' : 'default',
    color,
    bd: chosen ? `1px solid var(--mantine-color-${color}-outline)` : undefined,
    'aria-pressed': chosen,
  }) as const

// The buttons of the bottom bar fill its height and reach the card's edges.
const BAR_BUTTON = { radius: 0, h: '100%', px: CARD_INSET } as const

// The page is wide enough for the file in a column beside the fields.
export const PAGE_WIDTH_WITH_FILE = 1100

// A saved file. A photo shows on the page, a PDF opens in a new tab.
function SavedFile({ id, file }: { id: string; file: DocumentFile }) {
  const { t } = useTranslation()
  // The API answers this address with a short-lived link to S3.
  const url = `/api/documents/${id}/file`

  return (
    <FilePreview file={file} image={isPdf(file.type) ? undefined : url}>
      <Anchor href={url} target="_blank" rel="noopener" size="sm" fw={600}>
        {t('documents.openFile')}
      </Anchor>
    </FilePreview>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} tt="uppercase" lts="0.08em" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

type DocumentFormProps = {
  // Without a document the form creates one, and only a new document can get a file.
  doc?: Document
  onSave: (input: DocumentInput, file: Blob | null, onProgress: OnProgress) => Promise<void>
  // With it the bar gets a delete button, which only a saved document has.
  onDelete?: () => void
}

// The document's fields as a card whose top shows the document as it is being filled in,
// with its file in a column beside it.
export default function DocumentForm({ doc, onSave, onDelete }: DocumentFormProps) {
  const { t, i18n } = useTranslation()
  const formError = useFormError({ maxLength: TEXT_MAX_LENGTH, maxAmount: formatMoney(AMOUNT_MAX, 'compact') })
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState(0)
  // Controlled, so the card's top and the subcategories follow what is entered.
  const form = useForm<DocumentValues>({
    initialValues: toValues(doc),
    enhanceGetInputProps: validateFilledOnBlur(),
    // The API's schema decides what is valid; each field gets its own message.
    validate: (values) =>
      Object.fromEntries(Object.keys(checkInput(toInput(values))).map((field) => [field, `documents.errors.${field}`])),
  })
  const { submit, pending, error } = useApiSubmit(async (values: DocumentValues) => {
    setProgress(0)
    await onSave(toInput(values), values.file, setProgress)
  })
  const input = toInput(form.values)
  const name = documentName(input).trim()
  const { icon: TypeIcon, color, strong } = TYPE_LOOKS[input.type]
  const subtypes: readonly Subtype[] = CATEGORIES[input.type]
  const fileColumn = doc ? (
    doc.file && <SavedFile id={doc.id} file={doc.file} />
  ) : (
    <FileField
      type={input.type}
      onChange={(file) => form.setFieldValue('file', file)}
      onPreparing={setPreparing}
      disabled={pending || preparing}
    />
  )

  function chooseType(type: DocumentType) {
    if (type === input.type) return
    form.setFieldValue('type', type)
    form.setFieldValue('subtype', null)
  }

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
        <Paper
          component="form"
          className={classes.card}
          aria-label={t('documents.fieldsTitle')}
          onSubmit={form.onSubmit(submit, focusFirstError(form))}
          noValidate
        >
          <Group
            wrap="nowrap"
            gap="md"
            pos="relative"
            px={CARD_INSET}
            py="lg"
            bg={`linear-gradient(90deg, var(--mantine-color-${color}-light), transparent 70%)`}
          >
            <TypeIcon size={44} stroke={1.5} color={`var(--mantine-color-${color}-light-color)`} aria-hidden />
            <Stack gap={2} flex={1} miw={0}>
              <Text ff="heading" fw={600} fz={20} c={name ? undefined : 'dimmed'}>
                {name || t('documents.untitled')}
              </Text>
              <Text size="sm" c="dimmed">
                {describeDocument(t, input).join(' · ')}
              </Text>
            </Stack>
            {input.amount !== undefined && (
              <Box className={classes.seam} px={CARD_INSET}>
                <Badge
                  size="xl"
                  variant="default"
                  radius="sm"
                  tt="none"
                  ff="monospace"
                  fw={500}
                  fz="lg"
                  className={classes.price}
                >
                  {formatMoney(input.amount)}
                </Badge>
              </Box>
            )}
          </Group>
          <Divider />
          {/* Locked while saving, so nothing changes after the values were sent. */}
          <Fieldset variant="unstyled" disabled={pending} m={0}>
            <Stack gap="lg" p={CARD_INSET}>
              {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
              <Section title={t('documents.fields.type')}>
                <Group gap="xs" role="group" aria-label={t('documents.fields.type')}>
                  {DOCUMENT_TYPES.map((type) => {
                    const look = TYPE_LOOKS[type]
                    const chosen = type === input.type
                    return (
                      <Button
                        key={type}
                        size="sm"
                        {...toggle(chosen, look.color)}
                        leftSection={<look.icon size={18} aria-hidden />}
                        onClick={() => chooseType(type)}
                      >
                        {t(`categories.types.${type}`)}
                      </Button>
                    )
                  })}
                </Group>
              </Section>
              {subtypes.length > 0 && (
                <Section title={t('documents.fields.subtype')}>
                  <Group gap={6} role="group" aria-label={t('documents.fields.subtype')}>
                    {subtypes.map((subtype) => {
                      const chosen = subtype === input.subtype
                      return (
                        <Button
                          key={subtype}
                          size="compact-sm"
                          {...toggle(chosen, color)}
                          onClick={() => form.setFieldValue('subtype', chosen ? null : subtype)}
                        >
                          {t(`categories.subtypes.${subtype}`)}
                        </Button>
                      )
                    })}
                  </Group>
                </Section>
              )}
              <Section title={t('documents.sections.who')}>
                <TextInput
                  label={t('documents.fields.issuer')}
                  placeholder={t('documents.placeholders.issuer')}
                  leftSection={<IconBuildingStore size={18} aria-hidden />}
                  maxLength={TEXT_MAX_LENGTH}
                  required
                  {...form.getInputProps('issuer')}
                  error={formError(form.errors.issuer)}
                />
                <TextInput
                  label={t('documents.fields.title')}
                  placeholder={t('documents.placeholders.title')}
                  leftSection={<IconTag size={18} aria-hidden />}
                  maxLength={TEXT_MAX_LENGTH}
                  {...form.getInputProps('title')}
                  error={formError(form.errors.title)}
                />
              </Section>
              <Section title={t('documents.sections.amountDate')}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <NumberInput
                    label={
                      <>
                        {t('documents.fields.amount')}
                        <VisuallyHidden> ({currencySymbol()})</VisuallyHidden>
                      </>
                    }
                    decimalScale={2}
                    decimalSeparator={i18n.language === 'pl' ? ',' : '.'}
                    allowNegative={false}
                    hideControls
                    inputMode="decimal"
                    rightSection={
                      <Text size="sm" c="dimmed" aria-hidden>
                        {currencySymbol()}
                      </Text>
                    }
                    rightSectionPointerEvents="none"
                    classNames={{ input: classes.mono }}
                    {...form.getInputProps('amount')}
                    error={formError(form.errors.amount)}
                  />
                  <DatePickerInput
                    label={t('documents.fields.docDate')}
                    leftSection={<IconCalendar size={18} aria-hidden />}
                    locale={i18n.language}
                    valueFormat="D MMM YYYY"
                    required
                    {...form.getInputProps('docDate')}
                    error={formError(form.errors.docDate)}
                  />
                </SimpleGrid>
              </Section>
              {pending && form.values.file && <Progress value={progress} aria-label={t('documents.uploading')} />}
            </Stack>
          </Fieldset>
          <Divider mt="auto" />
          <Group gap={0} h={56} wrap="nowrap" bg="var(--app-page-bg)">
            {onDelete && (
              <Tooltip label={t('documents.delete')}>
                <Button
                  variant="subtle"
                  color="red"
                  {...BAR_BUTTON}
                  aria-label={t('documents.delete')}
                  disabled={pending}
                  onClick={onDelete}
                >
                  <IconTrash size={20} aria-hidden />
                </Button>
              </Tooltip>
            )}
            <Button component={Link} to="/documents" variant="subtle" color="gray" {...BAR_BUTTON} ml="auto">
              {t('documents.cancel')}
            </Button>
            {/* Saving takes the color of the chosen type, like the card's top. */}
            <Button
              type="submit"
              variant="filled"
              color={strong}
              {...BAR_BUTTON}
              loading={pending}
              disabled={preparing}
            >
              {t('documents.save')}
            </Button>
          </Group>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
