import {
  ActionIcon,
  Autocomplete,
  Button,
  createTheme,
  Indicator,
  NumberInput,
  Paper,
  PasswordInput,
  rgba,
  TextInput,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { TYPE_LOOKS } from '~/features/documents/look.ts'

const brand: MantineColorsTuple = [
  '#f9f2fc',
  '#f1e1f9',
  '#e5c7f5',
  '#d4a5ec',
  '#c27de3',
  '#a646cf',
  '#8d27b6',
  '#741a96',
  '#591574',
  '#3c0e4f',
]

// The second brand color, for small accents beside the purple.
const saffron: MantineColorsTuple = [
  '#fff8e6',
  '#ffefc2',
  '#ffe299',
  '#ffd36b',
  '#fbc244',
  '#f7b733',
  '#e09f1a',
  '#b77f0e',
  '#8a5903',
  '#5f3d02',
]

const dark: MantineColorsTuple = [
  '#e1dce4',
  '#cec8d1',
  '#a39ba8',
  '#867c8b',
  '#54485a',
  '#463b4d',
  '#372b3c',
  '#281f2d',
  '#1e1623',
  '#110a14',
]

const typeColors = [...new Set(Object.values(TYPE_LOOKS).map(({ color }) => color))]

// The light variant of the document type colors, used by their tiles, chosen buttons and the card's top:
// a strong tint on the dark surface, a pastel on white, and text that keeps WCAG AA on it.
const typeTints = (scheme: 'light' | 'dark') =>
  Object.fromEntries(
    typeColors.flatMap((color) => {
      const shade = (n: number) => `var(--mantine-color-${color}-${n})`
      const tint = (percent: number) => `color-mix(in srgb, ${shade(5)} ${percent}%, var(--mantine-color-body))`
      return scheme === 'dark'
        ? [
            [`--mantine-color-${color}-light`, tint(30)],
            [`--mantine-color-${color}-light-hover`, tint(38)],
            [`--mantine-color-${color}-light-color`, shade(2)],
          ]
        : [
            [`--mantine-color-${color}-light`, shade(1)],
            [`--mantine-color-${color}-light-hover`, shade(2)],
            [`--mantine-color-${color}-light-color`, `color-mix(in srgb, ${shade(9)} 75%, black)`],
          ]
    }),
  )

// Orange text that keeps WCAG AA on white.
const ORANGE_TEXT = '#a8380a'

// Text, border and status colors in shades that keep WCAG contrast on the app's grounds.
export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    ...typeTints('light'),
    '--app-page-bg': theme.colors.brand[0],
    '--mantine-color-text': theme.colors.dark[8],
    '--mantine-color-dimmed': theme.colors.dark[4],
    '--mantine-color-placeholder': theme.colors.dark[3],
    '--mantine-color-default-border': theme.colors.dark[3],
    '--mantine-color-error': theme.colors.red[9],
    '--mantine-color-red-light-color': theme.colors.red[9],
    '--mantine-color-orange-text': ORANGE_TEXT,
    '--mantine-color-orange-light-color': ORANGE_TEXT,
    '--mantine-color-green-text': '#1f6b30',
  },
  dark: {
    ...typeTints('dark'),
    '--app-page-bg': theme.colors.dark[8],
    '--mantine-color-default-border': theme.colors.dark[3],
    '--mantine-color-error': theme.colors.red[4],
    '--mantine-color-red-light-color': theme.colors.red[4],
    '--mantine-color-orange-light-color': theme.colors.orange[4],
  },
})

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand, saffron, dark },
  // Dark text and icons on light fills such as saffron, white on dark ones. Mid fills such as blue, pink and gray
  // count as light, so their text keeps WCAG AA contrast.
  autoContrast: true,
  luminanceThreshold: 0.2,
  defaultGradient: { from: 'brand.5', to: 'brand.7', deg: 135 },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  // xl lifts something off the page, such as a photo of a document or the loupe.
  shadows: { md: `0 16px 40px -20px ${rgba(brand[9], 0.35)}`, xl: '0 18px 38px rgb(0 0 0 / 0.42)' },
  fontFamily: "'Hanken Grotesk Variable', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono Variable', monospace",
  headings: {
    fontFamily: "'Fraunces Variable', serif",
    fontWeight: '600',
  },
  components: {
    ActionIcon: ActionIcon.extend({
      defaultProps: { variant: 'light', size: 'lg' },
    }),
    Autocomplete: Autocomplete.extend({ defaultProps: { size: 'md' } }),
    Button: Button.extend({
      defaultProps: { variant: 'gradient', size: 'md' },
    }),
    DatePickerInput: DatePickerInput.extend({ defaultProps: { size: 'md' } }),
    // Bright saffron with a dark brown mark in both schemes.
    // Above what it marks, yet under the app shell, so the open menu on a phone covers it.
    Indicator: Indicator.extend({
      defaultProps: { color: 'saffron.5', zIndex: 1 },
      vars: () => ({ root: { '--indicator-text-color': 'var(--mantine-color-saffron-9)' } }),
    }),
    NumberInput: NumberInput.extend({ defaultProps: { size: 'md' } }),
    // No default padding: a modal is a Paper too, and it has padding of its own.
    Paper: Paper.extend({
      defaultProps: { radius: 'md', shadow: 'md', withBorder: true },
    }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, openDelay: 300 },
    }),
  },
})
