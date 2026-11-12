import type { Translation } from '~/shared/i18n/pl.ts'

export const en: Translation = {
  common: {
    email: 'Email',
    password: 'Password',
    code: 'Code',
    or: 'or',
    continueWithGoogle: 'Continue with Google',
    toggleColorScheme: 'Toggle light and dark mode',
    switchLanguage: 'Switch language to Polish',
  },
  entry: {
    lead: 'Receipts, warranties and contracts in one place, with a reminder for every deadline.',
    demo: 'View demo',
  },
  auth: {
    signIn: 'Sign in',
    signUp: 'Create account',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    passwordHint: 'At least {{min}} characters',
    confirmTitle: 'Confirm your email',
    confirmLead: 'Enter the 6-digit code from the message sent to your address. The code is valid for 24 hours.',
    codeResent: 'Your account is not confirmed yet. A new code was sent to your address.',
    confirm: 'Confirm',
    confirmed: 'Email confirmed. You can sign in now.',
    errors: {
      invalidEmail: 'Enter a valid email address',
      passwordRequired: 'Enter your password',
      passwordTooShort: 'Password must be at least {{min}} characters',
      invalidCode: 'The code has 6 digits',
    },
  },
  account: {
    title: 'Your account',
    signedInAs: 'Signed in as {{email}}',
    signOut: 'Sign out',
  },
  errors: {
    invalid_input: 'Check the details you entered.',
    invalid_credentials: 'Wrong email or password.',
    not_confirmed: 'Confirm your email address first.',
    invalid_code: 'Wrong code.',
    code_expired: 'The code has expired. Sign in to get a new one.',
    weak_password: "The password doesn't meet the requirements.",
    too_many_requests: 'Too many attempts. Try again in a moment.',
    unauthorized: 'Your session has expired. Sign in again.',
    not_found: 'Not found.',
    internal_error: 'Something went wrong. Try again.',
    network_error: "Can't reach the server.",
  },
}
