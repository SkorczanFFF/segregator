// What the Pre sign-up trigger throws. Cognito passes the message on inside its own errors, where the API
// finds it.
export const TRIGGER_ERRORS = ['signup_closed', 'account_exists'] as const

export const triggerErrorIn = (message: string) => TRIGGER_ERRORS.find((error) => message.includes(error))
