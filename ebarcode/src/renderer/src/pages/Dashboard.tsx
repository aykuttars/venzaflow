import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BarcodeLookupResult, LabelTemplateRow, PrintJobRow, PrinterSettings } from '@shared/types'
import { APP_DISPLAY_NAME } from '@shared/brand'
import BluetoothSetup from './BluetoothSetup'

type Tab = 'scan' | 'print' | 'settings'

interface DashboardPageProps {
  onLogout: () => void
}

export default function DashboardPage({ onLogout }: DashboardPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('scan')
  const [sessionEmail, setSessionEmail] = useState('')
  const [scanBuffer, setScanBuffer] = useState('')
  const [lookup, setLookup] = useState<BarcodeLookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<PrintJobRow[]>([])
  const [templates, setTemplates] = useState<LabelTemplateRow[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(0)
  const [ports, setPorts] = useState<string[]>([])
  const [settings, setSettings] = useState<PrinterSettings>({ port: '', autoPoll: true, pollIntervalSec: 15 })
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [showBtWizard, setShowBtWizard] = useState(false)
  const [tenantPrintMode, setTenantPrintMode] = useState<string>('both')
  const scanRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const pushLog = (msg: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} ${msg}`, ...l].slice(0, 80))

  const refreshJobs = useCallback(async () => {
    try {
      const list = (await window.api.barcode.listJobs()) as PrintJobRow[]
      setJobs(list)
    } catch (e) {
      pushLog('Kuyruk okunamadı: ' + String(e))
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const s = (await window.api.auth.getSession()) as { email?: string } | null
      if (s?.email) setSessionEmail(s.email)
      setPorts(await window.api.printer.listPorts())
      const saved = (await window.api.printer.getSettings()) as PrinterSettings
      setSettings(saved)
      const tpl = (await window.api.barcode.listTemplates()) as LabelTemplateRow[]
      setTemplates(tpl)
      if (tpl.length) setSelectedTemplateId(tpl[0].id)
      try {
        const effective = (await window.api.barcode.effectiveSettings()) as {
          print_mode?: string
          default_copies?: number
          printer_profile?: { model?: string }
        }
        if (effective.print_mode) setTenantPrintMode(effective.print_mode)
        pushLog(`Tenant profil: ${effective.printer_profile?.model || 'XP-P328B'} · print=${effective.print_mode}`)
      } catch {
        pushLog('Tenant yazdırma profili alınamadı')
      }
      await refreshJobs()
    })()
  }, [refreshJobs])

  useEffect(() => {
    if (tab === 'scan') scanRef.current?.focus()
  }, [tab])

  const processQueue = useCallback(async (silent = false): Promise<void> => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const queued = (await window.api.barcode.listJobs()) as PrintJobRow[]
      if (!queued.length) {
        if (!silent) pushLog('Kuyrukta iş yok')
        return
      }
      for (const job of queued) {
        pushLog(`Yazdırılıyor #${job.id} ${job.template_name}`)
        const tspl = await window.api.barcode.jobTspl(job.id)
        await window.api.printer.sendRaw({
          port: settingsRef.current.port || undefined,
          tspl
        })
        await window.api.barcode.completeJob({ jobId: job.id, status: 'done' })
        pushLog(`Tamamlandı #${job.id}`)
      }
      await refreshJobs()
    } catch (e) {
      pushLog('Yazdırma hatası: ' + String(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [refreshJobs])

  useEffect(() => {
    if (!settings.autoPoll) return
    const id = setInterval(() => {
      void processQueue(true)
    }, settings.pollIntervalSec * 1000)
    return () => clearInterval(id)
  }, [settings.autoPoll, settings.pollIntervalSec, processQueue])

  async function doLookup(code: string): Promise<void> {
    const trimmed = code.trim()
    if (!trimmed) return
    setLookupError(null)
    try {
      const result = (await window.api.barcode.lookup(trimmed)) as BarcodeLookupResult
      setLookup(result)
      pushLog(`Scan: ${result.product.sku}`)
    } catch {
      setLookup(null)
      setLookupError('Ürün bulunamadı')
    }
  }

  async function handleScanKey(e: React.KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (e.key === 'Enter') {
      e.preventDefault()
      await doLookup(scanBuffer)
      setScanBuffer('')
    }
  }

  async function printScannedProduct(): Promise<void> {
    if (!lookup || !selectedTemplateId) return
    setBusy(true)
    try {
      await window.api.barcode.createJob({
        templateId: selectedTemplateId,
        productIds: [lookup.product.id],
        copies: 1
      })
      pushLog(`PrintJob oluşturuldu: ${lookup.product.sku}`)
      await refreshJobs()
      if (settings.autoPoll) await processQueue(true)
    } catch (e) {
      pushLog('Job oluşturma hatası: ' + String(e))
    } finally {
      setBusy(false)
    }
  }

  async function transferOne(): Promise<void> {
    if (!lookup) return
    setBusy(true)
    try {
      await window.api.barcode.transfer({
        items: [{ product_id: lookup.product.id, quantity: 1 }],
        note: 'e-barcode transfer'
      })
      pushLog(`Transfer: ${lookup.product.sku} DEPO→MAGAZA`)
      await doLookup(lookup.product.barcode || lookup.product.sku)
    } catch (e) {
      pushLog('Transfer hatası: ' + String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(): Promise<void> {
    await window.api.printer.saveSettings(settings)
    pushLog('Yazıcı ayarları kaydedildi')
  }

  async function testPrint(): Promise<void> {
    try {
      await window.api.printer.test(settings.port || undefined)
      pushLog('Test etiketi gönderildi')
    } catch (e) {
      pushLog('Test baskı hatası: ' + String(e))
    }
  }

  async function logout(): Promise<void> {
    await window.api.auth.logout()
    onLogout()
    navigate('/login')
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>{APP_DISPLAY_NAME}</h1>
          <p className="topbar-user-name">{sessionEmail}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={() => void refreshJobs()}>
            Yenile
          </button>
          <button type="button" className="btn secondary" onClick={() => void logout()}>
            Çıkış
          </button>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={tab === 'scan' ? 'active' : ''} onClick={() => setTab('scan')}>
          Okuma
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          Yazdırma ({jobs.length})
        </button>
        <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Yazıcı & Okuyucu
        </button>
      </div>

      {tab === 'scan' && (
        <div className="card">
          <p className="muted">Netum F-18w USB/BT HID — okuyucu bu alana odaklıyken barkod gönderir.</p>
          <label>
            Barkod
            <input
              ref={scanRef}
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              onKeyDown={(e) => void handleScanKey(e)}
              placeholder="Barkod okutun…"
              autoComplete="off"
            />
          </label>
          {lookupError && <div className="alert error">{lookupError}</div>}
          {lookup && (
            <div className="cert-banner">
              <strong>{lookup.product.name}</strong>
              <span>
                SKU: {lookup.product.sku} · EAN: {lookup.product.barcode} · {lookup.product.unit_price} ₺
              </span>
              {lookup.product.marka && <span>Marka: {lookup.product.marka}</span>}
              <span>
                DEPO: {lookup.stock.depo_quantity} · MAGAZA: {lookup.stock.magaza_quantity}
              </span>
              {lookup.suggest_transfer && (
                <div className="alert warning" style={{ marginTop: 8 }}>
                  DEPO&apos;da stok var — vitrin için transfer önerilir
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.width_mm}×{t.height_mm} mm)
                    </option>
                  ))}
                </select>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void printScannedProduct()}>
                  Etiket yazdır
                </button>
                {lookup.suggest_transfer && (
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => void transferOne()}>
                    DEPO → MAGAZA (1 adet)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'print' && (
        <div className="card">
          <div className="section-head">
            <div>
              <h2 style={{ margin: 0 }}>Yazdırma kuyruğu</h2>
              <p className="muted">Web veya bu uygulamadan oluşturulan queued işler</p>
            </div>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void processQueue()}>
              Kuyruğu yazdır
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Şablon</th>
                  <th>Ürünler</th>
                  <th>Kopya</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.id}</td>
                    <td>{j.template_name}</td>
                    <td>{j.product_ids.join(', ')}</td>
                    <td>{j.copies}</td>
                    <td>{j.status}</td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Kuyrukta iş yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid two-col">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>XP-P328B yazıcı</h2>
            <p className="muted">Tenant modu: {tenantPrintMode}. USB doğrudan veya Bluetooth SPP → COM port.</p>
            {showBtWizard ? (
              <BluetoothSetup
                ports={ports}
                selectedPort={settings.port}
                onSelectPort={(port) => setSettings({ ...settings, port })}
                onTestPrint={testPrint}
                onClose={() => setShowBtWizard(false)}
              />
            ) : (
              <button type="button" className="btn secondary" onClick={() => setShowBtWizard(true)}>
                Bluetooth kurulum sihirbazı
              </button>
            )}
            <label>
              COM / port
              <select value={settings.port} onChange={(e) => setSettings({ ...settings, port: e.target.value })}>
                <option value="">Varsayılan sistem yazıcısı</option>
                {ports.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.autoPoll}
                onChange={(e) => setSettings({ ...settings, autoPoll: e.target.checked })}
              />{' '}
              Otomatik kuyruk kontrolü
            </label>
            <label>
              Kontrol aralığı (sn)
              <input
                type="number"
                min={5}
                max={120}
                value={settings.pollIntervalSec}
                onChange={(e) => setSettings({ ...settings, pollIntervalSec: Number(e.target.value) })}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn secondary" onClick={() => void saveSettings()}>
                Kaydet
              </button>
              <button type="button" className="btn primary" onClick={() => void testPrint()}>
                Test etiketi
              </button>
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Netum F-18w okuyucu</h2>
            <p className="muted">
              Varsayılan <strong>HID klavye</strong> modu — ek sürücü gerekmez. USB veya BT HID ile bağlayın;
              Okuma sekmesindeki alan odaktayken barkod okutun.
            </p>
            <ol className="setup-guide__steps">
              <li>Okuyucuyu USB veya Bluetooth HID modunda eşleştirin</li>
              <li>Bu uygulamada Okuma sekmesine geçin (otomatik odak)</li>
              <li>Kutu üzerindeki EAN barkodunu okutun</li>
            </ol>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Günlük</h3>
          <pre style={{ margin: 0, fontSize: 12, maxHeight: 160, overflow: 'auto' }}>{log.join('\n')}</pre>
        </div>
      )}
    </div>
  )
}
