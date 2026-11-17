import * as z from 'zod'

// Also the minimum of the Cognito user pool in infra.
export const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_LENGTH = 256

// Cognito's confirmation and reset codes.
export const CODE_LENGTH = 6
export const CODE_PATTERN = new RegExp(String.raw`^\d{${CODE_LENGTH}}$`)

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254))
const Code = z.string().regex(CODE_PATTERN)
const NewPassword = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const RegisterInput = z.object({ email: Email, password: NewPassword })
export const LoginInput = z.object({ email: Email, password: z.string().min(1).max(PASSWORD_MAX_LENGTH) })
export const ConfirmInput = z.object({ email: Email, code: Code })
export const ForgotInput = z.object({ email: Email })
export const ResetInput = z.object({ email: Email, code: Code, password: NewPassword })

export type RegisterInput = z.infer<typeof RegisterInput>
export type LoginInput = z.infer<typeof LoginInput>
export type ConfirmInput = z.infer<typeof ConfirmInput>
export type ForgotInput = z.infer<typeof ForgotInput>
export type ResetInput = z.infer<typeof ResetInput>

// Google sends the browser back here, and Cognito accepts only addresses listed in the stack.
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback'
// Where a Google sign-in lands, also listed in the stack as Cognito's sign-out address.
export const AFTER_SIGN_IN_PATH = '/documents'

export type User = { email: string }
