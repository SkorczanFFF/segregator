import { createContext, use } from 'react'
import { useNavigate } from 'react-router'
import type { User } from 'shared'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

type SessionValue = {
  // undefined until the first check finishes, null when signed out.
  user: User | null | undefined
  setUser: (user: User | null) => void
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession() {
  const value = use(SessionContext)
  if (!value) throw new Error('useSession needs a SessionProvider')
  return value
}

// Ends this session, or every session of the account, and goes back to the entry page.
export function useSignOut(path: '/auth/logout' | '/auth/logout-all') {
  const navigate = useNavigate()
  const { setUser } = useSession()
  return useApiSubmit(async () => {
    await api.post(path)
    // Both updates land in one render, so the session gate lets the entry page through.
    setUser(null)
    navigate('/', { replace: true })
  })
}
