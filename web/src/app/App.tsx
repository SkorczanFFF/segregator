import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AccountPage from '~/features/account/pages/AccountPage.tsx'
import SessionGate from '~/features/auth/components/SessionGate.tsx'
import SessionProvider from '~/features/auth/components/SessionProvider.tsx'
import ConfirmPage from '~/features/auth/pages/ConfirmPage.tsx'
import EntryPage from '~/features/auth/pages/EntryPage.tsx'
import SignInPage from '~/features/auth/pages/SignInPage.tsx'
import SignUpPage from '~/features/auth/pages/SignUpPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route element={<SessionGate signedIn={false} />}>
            <Route path="/" element={<EntryPage />} />
            <Route path="/login" element={<SignInPage />} />
            <Route path="/register" element={<SignUpPage />} />
            <Route path="/confirm" element={<ConfirmPage />} />
          </Route>
          <Route element={<SessionGate signedIn />}>
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
