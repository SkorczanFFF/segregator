import '@fontsource-variable/fraunces'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/jetbrains-mono'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '~/app/App.tsx'
import { cssVariablesResolver, theme } from '~/app/theme.ts'
import '~/shared/i18n/index.ts'
import { ApiError } from '~/shared/lib/api.ts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An API answer such as 404 stays the same on retry; only a lost connection is worth another try.
      retry: (failures, error) => error instanceof ApiError && error.code === 'network_error' && failures < 3,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
