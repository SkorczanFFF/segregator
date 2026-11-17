// What the Pre sign-up trigger throws. Cognito passes the message on inside its own errors, where the API
// finds it. A module of its own, because the trigger's module makes its clients when it loads.
export const TRIGGER_ERRORS = ['signup_closed', 'account_exists'] as const

export const triggerErrorIn = (message: string) => TRIGGER_ERRORS.find((error) => message.includes(error))
