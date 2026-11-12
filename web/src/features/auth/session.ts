import { createContext, use } from 'react'

export type User = { email: string }

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
