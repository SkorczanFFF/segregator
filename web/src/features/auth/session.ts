import { createContext, startTransition, use } from 'react'
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

// What the entry page says about how the session ended.
export type EntryState = { accountDeleted?: boolean }

// Forgets the session in the page, once the API has ended it, and goes back to the entry page.
export function useEndSession() {
  const navigate = useNavigate()
  const { setUser } = useSession()
  return (state?: EntryState) => {
    // React Router changes the address in a transition. The session ends in the same one, so the session gate
    // sees the entry page and no session in one render and lets the page through.
    startTransition(() => {
      setUser(null)
      void navigate('/', { replace: true, state })
    })
  }
}

// Ends this session, or every session of the account, and goes back to the entry page.
export function useSignOut(path: '/auth/logout' | '/auth/logout-all') {
  const endSession = useEndSession()
  return useApiSubmit(async () => {
    await api.post(path)
    endSession()
  })
}
