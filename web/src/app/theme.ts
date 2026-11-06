import {
  ActionIcon,
  Button,
  createTheme,
  Paper,
  PasswordInput,
  rgba,
  TextInput,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core'

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

export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: { '--app-page-bg': theme.colors.brand[0] },
  dark: { '--app-page-bg': theme.colors.dark[8] },
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
    Button: Button.extend({
      defaultProps: { variant: 'gradient', size: 'md' },
    }),
    Paper: Paper.extend({
      defaultProps: { radius: 'md', shadow: 'md', p: 'xl', withBorder: true },
    }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, openDelay: 300 },
    }),
  },
})
