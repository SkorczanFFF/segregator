import { Anchor, type MantineColor } from '@mantine/core'
import { Link } from 'react-router'
import classes from '~/shared/components/Logo.module.css'
import SpineMark from '~/shared/components/SpineMark.tsx'
import { APP_NAME } from '~/shared/lib/app.ts'

type LogoProps = {
  to: string
  // The name's color, when the ground calls for another than the brand's.
  c?: MantineColor
  // On the brand's own ground the mark turns saffron.
  onBrand?: boolean
}

// The brand's mark and name, as one link.
export default function Logo({ to, c, onBrand = false }: LogoProps) {
  return (
    <Anchor component={Link} to={to} ff="heading" fw={650} fz={24} c={c} underline="never" className={classes.logo}>
      <SpineMark
        className={classes.mark}
        colors={
          onBrand
            ? { body: 'var(--mantine-color-saffron-5)', label: 'var(--mantine-color-brand-9)' }
            : { body: 'var(--mantine-primary-color-filled)', label: 'var(--mantine-color-saffron-5)' }
        }
      />
      {APP_NAME}
    </Anchor>
  )
}
