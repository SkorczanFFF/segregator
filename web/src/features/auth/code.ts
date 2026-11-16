import { matches } from '@mantine/form'
import { CODE_PATTERN } from 'shared'

export const codeRule = matches(CODE_PATTERN, 'auth.errors.invalidCode')
