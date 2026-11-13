import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { SessionContext, type User } from '~/features/auth/session.ts'
import { api } from '~/shared/lib/api.ts'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>()
  const queryClient = useQueryClient()

  // Loaded data belongs to the account that signs out.
  function updateUser(next: User | null) {
    if (!next) queryClient.clear()
    setUser(next)
  }

  // The session cookie is HttpOnly, so only the API can tell who is signed in.
  useEffect(() => {
    api.get<User>('/auth/me').then(setUser, () => setUser(null))
  }, [])

  return <SessionContext value={{ user, setUser: updateUser }}>{children}</SessionContext>
}
