import { Autocomplete, type AutocompleteProps } from '@mantine/core'

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
      type="email"
      inputMode="email"
      autoComplete="username"
      spellCheck={false}
      data={data}
      value={value}
      {...props}
    />
  )
}
