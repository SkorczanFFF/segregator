import { isEmail } from '@mantine/form'

const invalidEmail = isEmail('auth.errors.invalidEmail')

// An empty field asks for the address; anything typed must look like one.
export const emailRule = (value: string) => (value.trim() ? invalidEmail(value) : 'auth.errors.emailRequired')
