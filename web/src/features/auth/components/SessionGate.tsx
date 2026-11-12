import { Center, Loader } from '@mantine/core'
import { Navigate, Outlet } from 'react-router'
import { useSession } from '~/features/auth/session.ts'

// Lets nested routes through only for signed-in users, or only for signed-out ones.
export default function SessionGate({ signedIn }: { signedIn: boolean }) {
  const { user } = useSession()

  if (user === undefined) {
    return (
      <Center mih="100dvh" bg="var(--app-page-bg)">
        <Loader />
      </Center>
    )
  }
  if (Boolean(user) !== signedIn) {
    return <Navigate to={signedIn ? '/login' : '/account'} replace />
  }
  return <Outlet />
}
