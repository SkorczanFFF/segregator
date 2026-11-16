import { Anchor, Group, type MantineColor } from '@mantine/core'
import { Link } from 'react-router'
import { APP_NAME } from '~/shared/lib/app.ts'

// The binder mark, which is also the favicon, beside the app's name.
export default function Logo({ to, c }: { to: string; c?: MantineColor }) {
  return (
    <Anchor component={Link} to={to} ff="heading" fw={600} fz={22} c={c} underline="never" w="fit-content">
      <Group gap={10} wrap="nowrap">
        <img src="/logo.svg" width={30} height={30} alt="" />
        {APP_NAME}
      </Group>
    </Anchor>
  )
}
