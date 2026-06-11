import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/Login'
import CertificateSelectPage from './pages/CertificateSelect'
import DashboardPage from './pages/Dashboard'
import ConnectionBanner from './components/ConnectionBanner'
import './styles/app.css'

function App(): React.JSX.Element {
  const [booting, setBooting] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [hasCertificate, setHasCertificate] = useState(false)

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        const session = await window.api.auth.restoreSession()
        setAuthenticated(Boolean(session))
        if (session) {
          const cert = await window.api.pkcs11.getSelectedCertificate()
          setHasCertificate(Boolean(cert))
        }
      } finally {
        setBooting(false)
      }
    }
    void bootstrap()
  }, [])

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <p>eimza yükleniyor...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ConnectionBanner />
      <Routes>
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to={hasCertificate ? '/dashboard' : '/certificate'} replace />
            ) : (
              <LoginPage
                onSuccess={() => {
                  setAuthenticated(true)
                }}
              />
            )
          }
        />
        <Route
          path="/certificate"
          element={
            !authenticated ? (
              <Navigate to="/login" replace />
            ) : (
              <CertificateSelectPage
                onSelected={() => {
                  setHasCertificate(true)
                }}
              />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            !authenticated ? (
              <Navigate to="/login" replace />
            ) : !hasCertificate ? (
              <Navigate to="/certificate" replace />
            ) : (
              <DashboardPage
                onLogout={() => {
                  setAuthenticated(false)
                  setHasCertificate(false)
                }}
              />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
