import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BarcodeLookupResult, LabelTemplateRow, PrintJobRow, PrinterSettings } from '@shared/types'
import { APP_DISPLAY_NAME } from '@shared/brand'
import { useI18n } from '../i18n/I18nProvider'
import BluetoothSetup from './BluetoothSetup'

type Tab = 'scan' | 'print' | 'settings'

interface DashboardPageProps {
  onLogout: () => void
}

export default function DashboardPage({ onLogout }: DashboardPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useI18n()
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
      pushLog(t('dashboard.log.queueReadError', { error: String(e) }))
    }
  }, [t])

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
        pushLog(
          t('dashboard.log.tenantProfile', {
            model: effective.printer_profile?.model || 'XP-P328B',
            mode: effective.print_mode || 'both'
          })
        )
      } catch {
        pushLog(t('dashboard.log.tenantProfileError'))
      }
      await refreshJobs()
    })()
  }, [refreshJobs, t])

  useEffect(() => {
    if (tab === 'scan') scanRef.current?.focus()
  }, [tab])

  const processQueue = useCallback(
    async (silent = false): Promise<void> => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        const queued = (await window.api.barcode.listJobs()) as PrintJobRow[]
        if (!queued.length) {
          if (!silent) pushLog(t('dashboard.log.queueEmpty'))
          return
        }
        for (const job of queued) {
          pushLog(t('dashboard.log.printing', { id: job.id, name: job.template_name }))
          const tspl = await window.api.barcode.jobTspl(job.id)
          await window.api.printer.sendRaw({
            port: settingsRef.current.port || undefined,
            tspl
          })
          await window.api.barcode.completeJob({ jobId: job.id, status: 'done' })
          pushLog(t('dashboard.log.done', { id: job.id }))
        }
        await refreshJobs()
      } catch (e) {
        pushLog(t('dashboard.log.printError', { error: String(e) }))
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [refreshJobs, t]
  )

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
      pushLog(t('dashboard.log.scan', { sku: result.product.sku }))
    } catch (err) {
      setLookup(null)
      const msg = err instanceof Error ? err.message : String(err)
      const notFound =
        msg.toLowerCase().includes('not found') ||
        msg.includes('404') ||
        msg.includes('bulunamad')
      setLookupError(
        notFound
          ? t('dashboard.scan.notFoundDetail', { code: trimmed })
          : msg
      )
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
      pushLog(t('dashboard.log.jobCreated', { sku: lookup.product.sku }))
      await refreshJobs()
      if (settings.autoPoll) await processQueue(true)
    } catch (e) {
      pushLog(t('dashboard.log.jobError', { error: String(e) }))
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
      pushLog(t('dashboard.log.transfer', { sku: lookup.product.sku }))
      await doLookup(lookup.product.barcode || lookup.product.sku)
    } catch (e) {
      pushLog(t('dashboard.log.transferError', { error: String(e) }))
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(): Promise<void> {
    await window.api.printer.saveSettings(settings)
    pushLog(t('dashboard.log.settingsSaved'))
  }

  async function testPrint(): Promise<void> {
    try {
      await window.api.printer.test(settings.port || undefined)
      pushLog(t('dashboard.log.testSent'))
    } catch (e) {
      pushLog(t('dashboard.log.testError', { error: String(e) }))
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
            {t('dashboard.refresh')}
          </button>
          <button type="button" className="btn secondary" onClick={() => void logout()}>
            {t('dashboard.logout')}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={tab === 'scan' ? 'active' : ''} onClick={() => setTab('scan')}>
          {t('dashboard.tab.scan')}
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          {t('dashboard.tab.print', { count: jobs.length })}
        </button>
        <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          {t('dashboard.tab.settings')}
        </button>
      </div>

      {tab === 'scan' && (
        <div className="card">
          <p className="muted">{t('dashboard.scan.hint')}</p>
          <label>
            {t('dashboard.tab.scan')}
            <input
              ref={scanRef}
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              onKeyDown={(e) => void handleScanKey(e)}
              placeholder={t('dashboard.scan.placeholder')}
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
              {lookup.product.marka && <span>{t('dashboard.scan.brand', { brand: lookup.product.marka })}</span>}
              <span>
                DEPO: {lookup.stock.depo_quantity} · MAGAZA: {lookup.stock.magaza_quantity}
              </span>
              {lookup.suggest_transfer && (
                <div className="alert warning" style={{ marginTop: 8 }}>
                  {t('dashboard.scan.transferHint')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.width_mm}×{tpl.height_mm} mm)
                    </option>
                  ))}
                </select>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void printScannedProduct()}>
                  {t('dashboard.scan.printLabel')}
                </button>
                {lookup.suggest_transfer && (
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => void transferOne()}>
                    {t('dashboard.scan.transfer')}
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
              <h2 style={{ margin: 0 }}>{t('dashboard.print.title')}</h2>
              <p className="muted">{t('dashboard.print.subtitle')}</p>
            </div>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void processQueue()}>
              {t('dashboard.print.runQueue')}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('dashboard.print.col.id')}</th>
                  <th>{t('dashboard.print.col.template')}</th>
                  <th>{t('dashboard.print.col.products')}</th>
                  <th>{t('dashboard.print.col.copies')}</th>
                  <th>{t('dashboard.print.col.status')}</th>
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
                      {t('dashboard.print.empty')}
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
            <h2 style={{ marginTop: 0 }}>{t('dashboard.settings.printerTitle')}</h2>
            <p className="muted">{t('dashboard.settings.printerHint', { mode: tenantPrintMode })}</p>
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
                {t('dashboard.settings.btWizard')}
              </button>
            )}
            <label>
              {t('dashboard.settings.port')}
              <select value={settings.port} onChange={(e) => setSettings({ ...settings, port: e.target.value })}>
                <option value="">{t('dashboard.settings.portDefault')}</option>
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
              {t('dashboard.settings.autoPoll')}
            </label>
            <label>
              {t('dashboard.settings.pollInterval')}
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
                {t('dashboard.settings.save')}
              </button>
              <button type="button" className="btn primary" onClick={() => void testPrint()}>
                {t('dashboard.settings.testLabel')}
              </button>
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{t('dashboard.settings.scannerTitle')}</h2>
            <p className="muted">{t('dashboard.settings.scannerHint')}</p>
            <ol className="setup-guide__steps">
              <li>{t('dashboard.settings.scannerStep1')}</li>
              <li>{t('dashboard.settings.scannerStep2')}</li>
              <li>{t('dashboard.settings.scannerStep3')}</li>
            </ol>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{t('dashboard.log.title')}</h3>
          <pre style={{ margin: 0, fontSize: 12, maxHeight: 160, overflow: 'auto' }}>{log.join('\n')}</pre>
        </div>
      )}
    </div>
  )
}
