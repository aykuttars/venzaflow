import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface LoginPageProps {
  onSuccess: () => void
}

export default function LoginPage({ onSuccess }: LoginPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [customerCode, setCustomerCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await window.api.auth.login({ customerCode, email, password })
      onSuccess()
      navigate('/certificate')
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
          <div className="brand-icon">e</div>
          <div>
            <h1>eimza</h1>
            <p>Masaüstü İmza Köprüsü</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Müşteri Kodu
            <input
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              placeholder="Customer Code"
              required
              autoFocus
            />
          </label>

          <label>
            E-posta
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
          </label>

          <label>
            Şifre
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
