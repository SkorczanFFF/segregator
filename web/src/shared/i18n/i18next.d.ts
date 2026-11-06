import 'i18next'
import type { Translation } from '~/shared/i18n/pl.ts'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Translation }
  }
}
