import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_DISPLAY_NAME } from '@shared/brand'

interface LoginPageProps {
  onSuccess: () => void
}

export default function LoginPage({ onSuccess }: LoginPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [customerCode, setCustomerCode] = useState('4500')
  const [email, setEmail] = useState('depo@tekno.local')
  const [password, setPassword] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await window.api.auth.login({
        customerCode,
        email,
        password,
        ...(apiBaseUrl.trim() ? { apiBaseUrl: apiBaseUrl.trim() } : {})
      })
      onSuccess()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page login-page">
      <div className="card auth-card">
        <div className="brand">
          <div className="brand-icon">B</div>
          <div>
            <h1>{APP_DISPLAY_NAME}</h1>
            <p>Masaüstü barkod & etiket köprüsü</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Müşteri kodu
            <input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} required autoFocus />
          </label>
          <label>
            E-posta
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Şifre
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            API adresi (opsiyonel)
            <input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://venzaflow-api.aykut.in/api/v1"
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
