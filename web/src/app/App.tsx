import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppLayout from '~/app/AppLayout.tsx'
import AccountPage from '~/features/account/pages/AccountPage.tsx'
import SessionGate from '~/features/auth/components/SessionGate.tsx'
import SessionProvider from '~/features/auth/components/SessionProvider.tsx'
import ConfirmPage from '~/features/auth/pages/ConfirmPage.tsx'
import ForgotPasswordPage from '~/features/auth/pages/ForgotPasswordPage.tsx'
import ResetPasswordPage from '~/features/auth/pages/ResetPasswordPage.tsx'
import EntryPage from '~/features/auth/pages/EntryPage.tsx'
import SignInPage from '~/features/auth/pages/SignInPage.tsx'
import SignUpPage from '~/features/auth/pages/SignUpPage.tsx'
import DocumentsPage from '~/features/documents/pages/DocumentsPage.tsx'
import NewDocumentPage from '~/features/documents/pages/NewDocumentPage.tsx'

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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<SessionGate signedIn />}>
            <Route element={<AppLayout />}>
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/new" element={<NewDocumentPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
