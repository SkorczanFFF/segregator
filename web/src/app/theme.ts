import {
  ActionIcon,
  Autocomplete,
  Button,
  createTheme,
  NumberInput,
  Paper,
  PasswordInput,
  rgba,
  Select,
  TextInput,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'

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

// Mantine's default text, border and status colors miss WCAG contrast here, so they get darker shades that pass.
export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    '--app-page-bg': theme.colors.brand[0],
    '--mantine-color-text': theme.colors.dark[8],
    '--mantine-color-dimmed': theme.colors.dark[4],
    '--mantine-color-placeholder': theme.colors.dark[3],
    '--mantine-color-default-border': theme.colors.dark[3],
    '--mantine-color-error': theme.colors.red[9],
    '--mantine-color-red-text': theme.colors.red[9],
    '--mantine-color-red-light-color': theme.colors.red[9],
    '--mantine-color-orange-text': '#a8380a',
    '--mantine-color-orange-light-color': '#a8380a',
    '--mantine-color-green-text': '#1f6b30',
    '--mantine-color-green-light-color': '#1f6b30',
  },
  dark: {
    '--app-page-bg': theme.colors.dark[8],
    '--mantine-color-default-border': theme.colors.dark[3],
    '--mantine-color-error': theme.colors.red[4],
    '--mantine-color-red-light-color': theme.colors.red[4],
    '--mantine-color-orange-light-color': theme.colors.orange[4],
    '--mantine-color-green-light-color': theme.colors.green[4],
    // Keeps the light variant lighter than the card surface.
    '--mantine-color-brand-light': theme.colors.brand[9],
    '--mantine-color-brand-light-color': theme.colors.brand[1],
  },
})

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand, dark },
  defaultGradient: { from: 'brand.5', to: 'brand.7', deg: 135 },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  shadows: { md: `0 16px 40px -20px ${rgba(brand[9], 0.35)}` },
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
    NumberInput: NumberInput.extend({ defaultProps: { size: 'md' } }),
    Paper: Paper.extend({
      defaultProps: { radius: 'md', shadow: 'md', p: 'xl', withBorder: true },
    }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
    Select: Select.extend({ defaultProps: { size: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, openDelay: 300 },
    }),
  },
})
