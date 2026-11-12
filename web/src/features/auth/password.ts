import { hasLength } from '@mantine/form'

export const PASSWORD_MIN_LENGTH = 12

// Rules for choosing a new password, shared by sign-up and password reset.
export const newPasswordRules = {
  password: hasLength({ min: PASSWORD_MIN_LENGTH }, 'auth.errors.passwordTooShort'),
}
