export const pl = {
  common: {
    email: 'E-mail',
    password: 'Hasło',
    or: 'albo',
    continueWithGoogle: 'Kontynuuj z Google',
    toggleColorScheme: 'Przełącz tryb jasny i ciemny',
    switchLanguage: 'Zmień język na angielski',
  },
  entry: {
    lead: 'Paragony, gwarancje i umowy w jednym miejscu, z przypomnieniem o każdym terminie.',
    demo: 'Zobacz demo',
  },
  auth: {
    signIn: 'Zaloguj się',
    signUp: 'Załóż konto',
    noAccount: 'Nie masz konta?',
    hasAccount: 'Masz już konto?',
    passwordHint: 'Co najmniej {{min}} znaków',
    errors: {
      invalidEmail: 'Podaj poprawny adres e-mail',
      passwordRequired: 'Podaj hasło',
      passwordTooShort: 'Hasło musi mieć co najmniej {{min}} znaków',
    },
  },
}

export type Translation = typeof pl
