import { Autocomplete, type AutocompleteProps } from '@mantine/core'
import { EMAIL_PROPS } from '~/features/auth/email.ts'

const DOMAINS = ['gmail.com', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl', 'outlook.com']

type EmailInputProps = Omit<AutocompleteProps, 'data' | 'value'> & { value?: string }

// Suggests common domains as the address is typed, which saves typing and catches typos early.
export default function EmailInput({ value = '', ...props }: EmailInputProps) {
  const [local, domain = ''] = value.trim().split('@')
  const data = local
    ? DOMAINS.filter((d) => d.startsWith(domain) && d !== domain).map((d) => `${local}@${d}`)
    : []

  return (
    <Autocomplete
      {...EMAIL_PROPS}
      data={data}
      value={value}
      {...props}
    />
  )
}
