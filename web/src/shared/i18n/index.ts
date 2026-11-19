// Mantine's date pickers name months and days through dayjs, in the language they are given.
import 'dayjs/locale/pl'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { CODE_LENGTH, RESTORE_DAYS, SESSION_IDLE_DAYS, SESSION_MAX_DAYS, STORAGE_LIMIT } from 'shared'
import { en } from '~/shared/i18n/en.ts'
import { pl } from '~/shared/i18n/pl.ts'

const STORAGE_KEY = 'language'

export const LANGUAGES = ['pl', 'en'] as const

const isLanguage = (value: string | null): value is (typeof LANGUAGES)[number] =>
  LANGUAGES.includes(value as (typeof LANGUAGES)[number])

function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function detectLanguage() {
  const stored = readStoredLanguage()
  if (isLanguage(stored)) return stored
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

void i18n.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'pl',
  resources: { pl: { translation: pl }, en: { translation: en } },
  // Every text can use these, so each value is written in one place.
  interpolation: {
    escapeValue: false,
    defaultVariables: {
      codeLength: CODE_LENGTH,
      storageLimit: `${STORAGE_LIMIT / 1024 / 1024} MB`,
      restoreDays: RESTORE_DAYS,
      idleDays: SESSION_IDLE_DAYS,
      maxDays: SESSION_MAX_DAYS,
    },
  },
  initAsync: false,
})

document.documentElement.lang = i18n.language

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage can be blocked by the browser.
  }
})
