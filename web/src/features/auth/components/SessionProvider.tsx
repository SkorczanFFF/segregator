import { useEffect, useState, type ReactNode } from 'react'
import { SessionContext, type User } from '~/features/auth/session.ts'
import { api } from '~/shared/lib/api.ts'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>()

  // The session cookie is HttpOnly, so only the API can tell who is signed in.
  useEffect(() => {
    api.get<User>('/auth/me').then(setUser, () => setUser(null))
  }, [])

  return <SessionContext value={{ user, setUser }}>{children}</SessionContext>
}
