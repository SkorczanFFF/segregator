import { createTheme, type MantineColorsTuple } from '@mantine/core'

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

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: { brand },
  fontFamilyMonospace: "'JetBrains Mono Variable', monospace",
})
