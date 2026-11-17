import { Group, Loader, Paper, Progress, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconCheck, IconCircleDashed } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type FileStagesProps = {
  stage: 'sending' | 'processing'
  // Percent sent so far, while sending.
  progress?: number
  // What is on its way. Unknown after a reload, when the page no longer has the file.
  kind?: 'photo' | 'pdf'
}

type Step = { label: string; state: 'done' | 'active' | 'waiting'; detail?: ReactNode }

const ICONS = {
  done: (
    <ThemeIcon size={22} radius="xl" variant="light" color="saffron">
      <IconCheck size={14} stroke={3} aria-hidden />
    </ThemeIcon>
  ),
  active: <Loader size={20} color="saffron" aria-hidden />,
  waiting: <IconCircleDashed size={22} stroke={1.5} color="var(--mantine-color-dimmed)" aria-hidden />,
}

// What happens to the file between sending it and comparing the result, step by step.
export default function FileStages({ stage, progress = 0, kind }: FileStagesProps) {
  const { t } = useTranslation()
  const sending = stage === 'sending'
  const steps: Step[] = [
    sending
      ? {
          label: t(kind === 'photo' ? 'documents.stages.sendingPhoto' : 'documents.stages.sending'),
          state: 'active',
          detail: <Progress value={progress} color="saffron" size="sm" aria-label={t('documents.stages.sending')} />,
        }
      : { label: t('documents.stages.sent'), state: 'done' },
    {
      label: t(`documents.stages.${kind ?? 'file'}`),
      state: sending ? 'waiting' : 'active',
      detail: !sending && (
        <Text size="sm" c="dimmed">
          {t('documents.stages.usual')}
        </Text>
      ),
    },
    ...(kind === 'pdf' ? [] : [{ label: t('documents.stages.compare'), state: 'waiting' } as Step]),
  ]

  return (
    <Paper p="md" role="status" aria-live="polite">
      <Stack component="ol" gap="md" m={0} p={0} style={{ listStyle: 'none' }} aria-label={t('documents.stages.title')}>
        {steps.map((step) => (
          <Group key={step.label} component="li" gap="sm" wrap="nowrap" align="flex-start">
            {ICONS[step.state]}
            <Stack gap={6} flex={1}>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={step.state === 'active' ? 600 : undefined} c={step.state === 'waiting' ? 'dimmed' : undefined}>
                  {step.label}
                </Text>
                {step.state === 'active' && sending && (
                  // The bar tells a screen reader the progress, without every percent read out.
                  <Text ff="monospace" size="sm" aria-hidden>
                    {progress}%
                  </Text>
                )}
              </Group>
              {step.detail}
            </Stack>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
