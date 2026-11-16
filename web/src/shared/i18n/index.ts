import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { CODE_LENGTH } from 'shared'
import { en } from '~/shared/i18n/en.ts'
import { pl } from '~/shared/i18n/pl.ts'

const STORAGE_KEY = 'language'

function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function detectLanguage() {
  const stored = readStoredLanguage()
  if (stored === 'pl' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

void i18n.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'pl',
  resources: { pl: { translation: pl }, en: { translation: en } },
  // Every text can use {{codeLength}}, so the length of a code is written in one place.
  interpolation: { escapeValue: false, defaultVariables: { codeLength: CODE_LENGTH } },
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
