import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import { APP_DISPLAY_NAME } from '@shared/brand'
import './styles/app.css'

export default function App(): React.JSX.Element {
  const [booting, setBooting] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const session = await window.api.auth.restoreSession()
        setAuthenticated(Boolean(session))
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <p>{APP_DISPLAY_NAME} yükleniyor…</p>
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
              <LoginPage onSuccess={() => setAuthenticated(true)} />
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
