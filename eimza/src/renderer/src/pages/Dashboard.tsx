import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentList from '../components/DocumentList'
import PinDialog from '../components/PinDialog'
import type { SelectedCertificate, SignTask } from '@shared/types'
import { SESSION_EXPIRED_MESSAGE } from '@shared/types'

type TabKey = 'erecete' | 'earsiv' | 'efatura'

interface DashboardPageProps {
  onLogout: () => void
}

const TABS: { key: TabKey; label: string; description: string }[] = [
  {
    key: 'erecete',
    label: 'e-Reçete',
    description: 'Medula e-reçete imzalama kuyruğu'
  },
  {
    key: 'earsiv',
    label: 'e-Arşiv',
    description: 'e-Arşiv fatura imzalama kuyruğu'
  },
  {
    key: 'efatura',
    label: 'e-Fatura',
    description: 'e-Fatura (XAdES) imzalama kuyruğu'
  }
]

export default function DashboardPage({ onLogout }: DashboardPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('erecete')
  const [tasks, setTasks] = useState<SignTask[]>([])
  const [certificate, setCertificate] = useState<SelectedCertificate | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{ email: string; customerCode: string } | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinDialog, setPinDialog] = useState<{ taskId: string; title: string } | null>(null)
  const [signing, setSigning] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    void loadTasks(activeTab)
  }, [activeTab])

  async function bootstrap(): Promise<void> {
    const [session, cert] = await Promise.all([
      window.api.auth.getSession(),
      window.api.pkcs11.getSelectedCertificate()
    ])
    setSessionInfo(session)
    setCertificate(cert)
  }

  async function handleSessionExpired(): Promise<void> {
    await window.api.pkcs11.logout()
    await window.api.auth.logout()
    onLogout()
    navigate('/login')
  }

  function isSessionExpiredError(err: unknown): boolean {
    return err instanceof Error && err.message === SESSION_EXPIRED_MESSAGE
  }

  async function loadTasks(tab: TabKey): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      let items: SignTask[]
      if (tab === 'erecete') {
        items = await window.api.sign.erecete.list()
      } else if (tab === 'earsiv') {
        items = await window.api.sign.efatura.listEarsiv()
      } else {
        items = await window.api.sign.efatura.listEfatura()
      }
      setTasks(items)
    } catch (err) {
      if (isSessionExpiredError(err)) {
        await handleSessionExpired()
        return
      }
      setError(err instanceof Error ? err.message : 'Görevler yüklenemedi')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  function handleSignRequest(task: SignTask): void {
    setSuccess(null)
    setPinDialog({ taskId: task.id, title: task.title })
  }

  async function handlePinSubmit(pin: string): Promise<void> {
    if (!pinDialog) return
    setSigning(true)
    setError(null)
    try {
      let result
      if (activeTab === 'erecete') {
        result = await window.api.sign.erecete.sign(pinDialog.taskId, pin)
      } else if (activeTab === 'earsiv') {
        result = await window.api.sign.efatura.signEarsiv(pinDialog.taskId, pin)
      } else {
        result = await window.api.sign.efatura.signEfatura(pinDialog.taskId, pin)
      }
      setSuccess(result.message || 'Belge başarıyla imzalandı ve gönderildi.')
      setPinDialog(null)
      await loadTasks(activeTab)
    } catch (err) {
      if (isSessionExpiredError(err)) {
        await handleSessionExpired()
        return
      }
      setError(err instanceof Error ? err.message : 'İmzalama başarısız')
    } finally {
      setSigning(false)
    }
  }

  async function handleLogout(): Promise<void> {
    await window.api.pkcs11.logout()
    await window.api.auth.logout()
    onLogout()
    navigate('/login')
  }

  return (
    <div className="page dashboard">
      <header className="topbar">
        <div>
          <h1>eimza Panel</h1>
          <p>
            {sessionInfo?.customerCode} · {sessionInfo?.email}
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn secondary" onClick={() => navigate('/certificate')}>
            Sertifika Değiştir
          </button>
          <button type="button" className="btn ghost" onClick={() => void handleLogout()}>
            Çıkış
          </button>
        </div>
      </header>

      {certificate && (
        <div className="cert-banner">
          <strong>Aktif sertifika:</strong> {certificate.label}
          <span>{certificate.subject}</span>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>{TABS.find((t) => t.key === activeTab)?.label}</h2>
            <p>{TABS.find((t) => t.key === activeTab)?.description}</p>
          </div>
          <button type="button" className="btn secondary" onClick={() => void loadTasks(activeTab)}>
            Yenile
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <DocumentList tasks={tasks} loading={loading} onSign={handleSignRequest} />
      </section>

      {pinDialog && (
        <PinDialog
          title={pinDialog.title}
          loading={signing}
          onCancel={() => setPinDialog(null)}
          onSubmit={handlePinSubmit}
        />
      )}
    </div>
  )
}
