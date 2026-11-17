import { Email } from 'shared'

// What every address field shares: the keyboard for an address and the browser's saved sign-ins.
export const EMAIL_PROPS = { type: 'email', autoComplete: 'username', spellCheck: false } as const

// An empty field asks for the address; anything typed must be one the API accepts.
export const emailRule = (value: string) =>
  !value.trim() ? 'auth.errors.emailRequired' : Email.safeParse(value).success ? null : 'auth.errors.invalidEmail'
