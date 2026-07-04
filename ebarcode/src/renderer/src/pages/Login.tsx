import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_DISPLAY_NAME } from '@shared/brand'
import { useI18n } from '../i18n/I18nProvider'

interface LoginPageProps {
  onSuccess: (defaultLanguage?: string) => void
}

export default function LoginPage({ onSuccess }: LoginPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useI18n()
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
      const summary = (await window.api.auth.login({
        customerCode,
        email,
        password
      })) as { defaultLanguage?: string }
      onSuccess(summary.defaultLanguage)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'))
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
            <p>{t('app.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label>
            {t('login.customerCode')}
            <input
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              placeholder={t('login.customerCodePlaceholder')}
              required
              autoFocus
            />
          </label>
          <label>
            {t('login.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </label>
          <label>
            {t('login.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
