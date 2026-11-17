import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import type { User } from 'shared'
import { SessionContext } from '~/features/auth/session.ts'
import { api, onSessionEnded } from '~/shared/lib/api.ts'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>()
  const queryClient = useQueryClient()

  // Loaded data belongs to the account that signs out.
  function updateUser(next: User | null) {
    if (!next) queryClient.clear()
    setUser(next)
  }

  // The session cookie is HttpOnly, so only the API can tell who is signed in. A request it turns away
  // later signs the app out, and the session gate goes back to the entry page.
  useEffect(() => {
    onSessionEnded(() => {
      queryClient.clear()
      setUser(null)
    })
    api.get<User>('/auth/me').then(setUser, () => setUser(null))
  }, [queryClient])

  return <SessionContext value={{ user, setUser: updateUser }}>{children}</SessionContext>
}
