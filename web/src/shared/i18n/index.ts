import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
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
  interpolation: { escapeValue: false },
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
