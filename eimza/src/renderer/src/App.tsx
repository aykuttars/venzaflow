import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/Login'
import CertificateSelectPage from './pages/CertificateSelect'
import DashboardPage from './pages/Dashboard'
import ConnectionBanner from './components/ConnectionBanner'
import { APP_DISPLAY_NAME } from '@shared/brand'
import { cleanupModalOverlays } from './utils/cleanupModalOverlays'
import './styles/app.css'

function App(): React.JSX.Element {
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [hasCertificate, setHasCertificate] = useState(false)

  function handleLogout(): void {
    cleanupModalOverlays()
    setAuthenticated(false)
    setHasCertificate(false)
  }

  useEffect(() => {
    if (!authenticated) {
      cleanupModalOverlays()
    }
  }, [authenticated])

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        if (!window.api) {
          throw new Error('Uygulama köprüsü yüklenemedi. Kurulumu yeniden deneyin.')
        }
        const session = await window.api.auth.restoreSession()
        setAuthenticated(Boolean(session))
        if (session) {
          const cert = await window.api.pkcs11.getSelectedCertificate()
          setHasCertificate(Boolean(cert))
        }
      } catch (error) {
        setBootError(error instanceof Error ? error.message : 'Başlatma hatası')
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
        <p>{APP_DISPLAY_NAME} yükleniyor...</p>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="boot-screen">
        <p className="error-text">{bootError}</p>
      </div>
    )
  }

  return (
    <HashRouter>
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
                onLogout={handleLogout}
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
              <DashboardPage onLogout={handleLogout} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
