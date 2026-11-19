import { Button, CloseButton, Drawer, Input, Popover, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCalendar, IconChevronDown } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import PeriodPicker from '~/features/documents/components/PeriodPicker.tsx'
import { formatPeriod, type Period } from '~/features/documents/filters.ts'

type PeriodControlProps = {
  period?: Period
  onChange: (period?: Period) => void
  phone: boolean
}

// The list's period as a field that opens the picker: below it on a wider screen, from the bottom of the screen
// on a phone.
export default function PeriodControl({ period, onChange, phone }: PeriodControlProps) {
  const { t } = useTranslation()
  const [opened, { open, close, toggle }] = useDisclosure(false)
  const label = period && formatPeriod(period)
  const calendar = <IconCalendar size={18} color="var(--mantine-color-dimmed)" aria-hidden />
  const chevron = <IconChevronDown size={16} color="var(--mantine-color-dimmed)" aria-hidden />

  if (phone) {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          h={40}
          px="sm"
          flex="none"
          leftSection={calendar}
          rightSection={chevron}
          aria-haspopup="dialog"
          onClick={open}
        >
          {label ?? t('documents.filters.period')}
        </Button>
        <Drawer
          opened={opened}
          onClose={close}
          position="bottom"
          radius="md"
          // As tall as the picker. Mantine reads a size word as one of its own sizes, so this goes in its variable.
          vars={() => ({ root: { '--drawer-size': 'auto' } })}
          title={t('documents.filters.period')}
        >
          <Stack>
            <PeriodPicker period={period} onChange={onChange} phone />
            <Button fullWidth onClick={close}>
              {t('documents.filters.done')}
            </Button>
          </Stack>
        </Drawer>
      </>
    )
  }

  return (
    <Popover opened={opened} onChange={(next) => (next ? open() : close())} position="bottom-start" trapFocus>
      <Popover.Target>
        <Input
          component="button"
          type="button"
          pointer
          size="sm"
          w={210}
          leftSection={calendar}
          rightSection={
            period ? (
              <CloseButton size="sm" aria-label={t('documents.filters.clearPeriod')} onClick={() => onChange(undefined)} />
            ) : (
              chevron
            )
          }
          rightSectionPointerEvents={period ? 'all' : 'none'}
          aria-haspopup="dialog"
          aria-expanded={opened}
          aria-label={`${t('documents.filters.period')}: ${label ?? t('documents.filters.anyDate')}`}
          onClick={toggle}
        >
          {label ?? <Input.Placeholder>{t('documents.filters.anyDate')}</Input.Placeholder>}
        </Input>
      </Popover.Target>
      <Popover.Dropdown>
        <PeriodPicker period={period} onChange={onChange} phone={false} />
      </Popover.Dropdown>
    </Popover>
  )
}
