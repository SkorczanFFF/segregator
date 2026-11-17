import {
  Badge,
  Box,
  Button,
  Divider,
  Fieldset,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  VisuallyHidden,
  type MantineColor,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { schemaResolver, useForm } from '@mantine/form'
import { IconBuildingStore, IconCalendar, IconLock, IconTag, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import 'dayjs/locale/pl'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  AMOUNT_MAX,
  CATEGORIES,
  DOCUMENT_TYPES,
  DocumentInput,
  TEXT_MAX_LENGTH,
  type Document,
  type DocumentType,
  type Subtype,
} from 'shared'
import classes from '~/features/documents/components/documents.module.css'
import { CARD_INSET, describeDocument, documentName, TYPE_LOOKS } from '~/features/documents/look.ts'
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
}

const toValues = (doc?: DocumentInput): DocumentValues => ({
  type: doc?.type ?? 'receipt',
  subtype: doc?.subtype ?? null,
  title: doc?.title ?? '',
  issuer: doc?.issuer ?? '',
  amount: doc?.amount === undefined ? '' : doc.amount / 100,
  docDate: doc?.docDate ?? dayjs().format('YYYY-MM-DD'),
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
  // The fields to start from. Without them the form starts empty.
  doc?: Document
  // A column beside the fields, such as the document's file.
  aside?: ReactNode
  // The fields wait for the photo to be approved: hidden on a phone, shown but closed on a wider screen.
  locked?: boolean
  onSave: (input: DocumentInput) => Promise<void>
  // With it the bar gets a delete button, which only a saved document has.
  onDelete?: () => void
  // Without it Cancel goes back to the list.
  onCancel?: () => void
}

// The document's fields as a card whose top shows the document as it is being filled in,
// with its file in a column beside it.
export default function DocumentForm({ doc, aside, locked = false, onSave, onDelete, onCancel }: DocumentFormProps) {
  const { t, i18n } = useTranslation()
  const formError = useFormError({ maxLength: TEXT_MAX_LENGTH, maxAmount: formatMoney(AMOUNT_MAX, 'compact') })
  // Controlled, so the card's top and the subcategories follow what is entered.
  const form = useForm<DocumentValues>({
    initialValues: toValues(doc),
    enhanceGetInputProps: validateFilledOnBlur(),
    // The API's schema decides what is valid; each field gets its own message.
    validate: (values) =>
      Object.fromEntries(Object.keys(checkInput(toInput(values))).map((field) => [field, `documents.errors.${field}`])),
  })
  const { submit, pending, error } = useApiSubmit((values: DocumentValues) => onSave(toInput(values)))
  const input = toInput(form.values)
  const name = documentName(input).trim()
  const { icon: TypeIcon, color, strong } = TYPE_LOOKS[input.type]
  const subtypes: readonly Subtype[] = CATEGORIES[input.type]

  function chooseType(type: DocumentType) {
    if (type === input.type) return
    form.setFieldValue('type', type)
    form.setFieldValue('subtype', null)
  }

  return (
    <SimpleGrid cols={{ base: 1, md: aside ? 2 : 1 }} spacing="lg">
      {aside}
      <Paper
        component="form"
        className={classes.card}
        pos="relative"
        visibleFrom={locked ? 'md' : undefined}
        aria-label={t('documents.fieldsTitle')}
        onSubmit={form.onSubmit(submit, focusFirstError(form))}
        noValidate
      >
        {locked && (
          <Stack align="center" justify="center" gap="xs" p="xl" className={classes.lock}>
            <IconLock size={28} aria-hidden color="var(--mantine-color-saffron-filled)" />
            <Text ta="center" maw={260}>
              {t('documents.fieldsLater')}
            </Text>
          </Stack>
        )}
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
        {/* Closed while saving, so nothing changes after the values were sent, and while the photo waits. */}
        <Fieldset variant="unstyled" disabled={pending || locked} m={0}>
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
          </Stack>
        </Fieldset>
        <Divider mt="auto" />
        {/* Above the lock, so Cancel works while the fields wait. */}
        <Group gap={0} h={56} wrap="nowrap" bg="var(--app-page-bg)" pos="relative" className={classes.overLock}>
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
          {onCancel ? (
            <Button variant="subtle" color="gray" {...BAR_BUTTON} ml="auto" onClick={onCancel}>
              {t('documents.cancel')}
            </Button>
          ) : (
            <Button component={Link} to="/documents" variant="subtle" color="gray" {...BAR_BUTTON} ml="auto">
              {t('documents.cancel')}
            </Button>
          )}
          {/* Saving takes the color of the chosen type, like the card's top. */}
          <Button
            type="submit"
            variant="filled"
            color={strong}
            {...BAR_BUTTON}
            loading={pending}
            disabled={locked}
          >
            {t('documents.save')}
          </Button>
        </Group>
      </Paper>
    </SimpleGrid>
  )
}
