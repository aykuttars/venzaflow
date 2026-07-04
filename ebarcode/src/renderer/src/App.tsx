import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import { APP_DISPLAY_NAME } from '@shared/brand'
import { I18nProvider, useI18n } from './i18n/I18nProvider'
import './styles/app.css'

function AppRoutes(): React.JSX.Element {
  const { t, setLocale } = useI18n()
  const [booting, setBooting] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const session = (await window.api.auth.restoreSession()) as {
          defaultLanguage?: string
        } | null
        if (session) {
          setLocale(session.defaultLanguage)
          setAuthenticated(true)
        }
      } finally {
        setBooting(false)
      }
    })()
  }, [setLocale])

  function handleLoginSuccess(defaultLanguage?: string): void {
    setLocale(defaultLanguage)
    setAuthenticated(true)
  }

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <p>{t('app.loading', { name: APP_DISPLAY_NAME })}</p>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onSuccess={handleLoginSuccess} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            !authenticated ? (
              <Navigate to="/login" replace />
            ) : (
              <DashboardPage onLogout={() => setAuthenticated(false)} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default function App(): React.JSX.Element {
  return (
    <I18nProvider>
      <AppRoutes />
    </I18nProvider>
  )
}
