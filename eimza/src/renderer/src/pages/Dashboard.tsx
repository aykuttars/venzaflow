import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentList from '../components/DocumentList'
import PinDialog from '../components/PinDialog'
import SignPreviewDialog from '../components/SignPreviewDialog'
import { APP_DISPLAY_NAME } from '@shared/brand'
import type { SelectedCertificate, SignTask, SessionSummary } from '@shared/types'
import { formatSessionDisplayName } from '@shared/types'
import {
  certificateHolderMatchesUser,
  getCertificateHolderName
} from '@shared/certificateUtils'
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
  const [sessionInfo, setSessionInfo] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDialog, setPreviewDialog] = useState<{ taskId: string; title: string } | null>(null)
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
    closePreviewDialog()
    closePinDialog()
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
    setSigning(false)
    setPreviewDialog({ taskId: task.id, title: task.title })
  }

  function closePreviewDialog(): void {
    setPreviewDialog(null)
  }

  function handlePreviewConfirm(): void {
    if (!previewDialog) return
    const next = previewDialog
    setPreviewDialog(null)
    setPinDialog(next)
  }

  function closePinDialog(): void {
    setPinDialog(null)
    setSigning(false)
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
    closePreviewDialog()
    closePinDialog()
    await window.api.pkcs11.logout()
    await window.api.auth.logout()
    onLogout()
    navigate('/login')
  }

  const userDisplayName = sessionInfo ? formatSessionDisplayName(sessionInfo) : null
  const certHolderName = certificate ? getCertificateHolderName(certificate) : null
  const nameMismatch =
    Boolean(certificate && sessionInfo && userDisplayName && certHolderName) &&
    !certificateHolderMatchesUser(certificate!, userDisplayName)

  return (
    <div className="page dashboard">
      <header className="topbar">
        <div>
          <h1>{APP_DISPLAY_NAME}</h1>
          <p>
            {sessionInfo?.customerCode} · {sessionInfo?.email}
          </p>
          {userDisplayName && <p className="topbar-user-name">{userDisplayName}</p>}
          {nameMismatch && (
            <p className="name-mismatch-badge" role="status">
              <strong>Dikkat:</strong> Seçili sertifika sahibi{' '}
              <strong>{certHolderName}</strong>, oturum kullanıcısı{' '}
              <strong>{userDisplayName}</strong> ile eşleşmiyor.
            </p>
          )}
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

      {previewDialog && (
        <SignPreviewDialog
          key={`preview-${previewDialog.taskId}`}
          taskId={previewDialog.taskId}
          title={previewDialog.title}
          onCancel={closePreviewDialog}
          onConfirm={handlePreviewConfirm}
        />
      )}

      {pinDialog && (
        <PinDialog
          key={pinDialog.taskId}
          title={pinDialog.title}
          loading={signing}
          onCancel={closePinDialog}
          onSubmit={handlePinSubmit}
        />
      )}
    </div>
  )
}
