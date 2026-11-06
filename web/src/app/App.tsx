import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import EntryPage from '~/features/auth/pages/EntryPage.tsx'
import SignInPage from '~/features/auth/pages/SignInPage.tsx'
import SignUpPage from '~/features/auth/pages/SignUpPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/register" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
