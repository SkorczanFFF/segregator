import type { Translation } from '~/shared/i18n/pl.ts'

export const en: Translation = {
  common: {
    email: 'Email',
    password: 'Password',
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
    errors: {
      invalidEmail: 'Enter a valid email address',
      passwordRequired: 'Enter your password',
      passwordTooShort: 'Password must be at least {{min}} characters',
    },
  },
}
