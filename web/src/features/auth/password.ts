export const PASSWORD_MIN_LENGTH = 12

// Length matters more than character types (NIST SP 800-63B). Cognito also rejects spaces at either end.
export function passwordChecks(password: string, email: string) {
  const local = email.trim().split('@')[0].toLowerCase()
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    edges: password.length > 0 && password === password.trim(),
    email: password.length > 0 && !(local.length >= 3 && password.toLowerCase().includes(local)),
  }
}

export type PasswordCheck = keyof ReturnType<typeof passwordChecks>

export function passwordStrength(length: number) {
  if (length === 0) return 0
  if (length < 8) return 1
  if (length < PASSWORD_MIN_LENGTH) return 2
  return length < 16 ? 3 : 4
}

// Rules for choosing a new password, shared by sign-up and password reset.
export const newPasswordRules = {
  password: (value: string, values: { email: string }) =>
    Object.values(passwordChecks(value, values.email)).every(Boolean) ? null : 'auth.errors.passwordRules',
}
