// The user pool in infra/lib/segregator-stack.ts requires the same length.
export const PASSWORD_MIN_LENGTH = 12

// Cognito's confirmation and reset codes.
export const CODE_LENGTH = 6
export const CODE_PATTERN = new RegExp(String.raw`^\d{${CODE_LENGTH}}$`)

export type User = { email: string }
