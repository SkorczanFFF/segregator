import { Anchor } from '@mantine/core'
import { Link } from 'react-router'

// A line that leads to another auth page, e.g. "No account? Sign up".
export default function AuthPrompt({ text, link, to }: { text: string; link: string; to: string }) {
  return (
    <>
      {text}{' '}
      <Anchor component={Link} to={to} inherit>
        {link}
      </Anchor>
    </>
  )
}
