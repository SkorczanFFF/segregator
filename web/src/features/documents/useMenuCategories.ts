import { useLocalStorage } from '@mantine/hooks'

// Whether the side menu shows the categories under the documents, remembered on this device. They start shown.
export const useMenuCategories = () =>
  useLocalStorage({ key: 'menuCategories', defaultValue: true, getInitialValueInEffect: false })
