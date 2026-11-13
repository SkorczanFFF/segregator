import { Alert, type AlertProps } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'

const STATUS = {
  error: { color: 'red', Icon: IconAlertCircle },
  warning: { color: 'orange', Icon: IconAlertTriangle },
  success: { color: 'green', Icon: IconCircleCheck },
} as const

type StatusAlertProps = Omit<AlertProps, 'color' | 'icon'> & { status: keyof typeof STATUS }

// A message whose icon and words carry its meaning, so it never relies on color alone.
export default function StatusAlert({ status, ...props }: StatusAlertProps) {
  const { color, Icon } = STATUS[status]
  return (
    <Alert
      color={color}
      icon={<Icon size={20} aria-hidden />}
      role={status === 'error' ? 'alert' : 'status'}
      {...props}
    />
  )
}
