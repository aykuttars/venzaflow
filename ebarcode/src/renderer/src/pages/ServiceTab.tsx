import { useEffect, useRef, useState } from 'react'
import type { CustomerRow, ServiceTicketLookupResult, ServiceTicketRow } from '../../../shared/types'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

interface ServiceTabProps {
  busy: boolean
  autoPoll: boolean
  onLog: (msg: string) => void
  onRefreshJobs: () => Promise<void>
  onProcessQueue: (silent?: boolean) => Promise<void>
}

type ServiceView = 'intake' | 'lookup'
type IntakeMode = 'quick' | 'existing'

const STATUS_KEYS: Record<string, MessageKey> = {
  received: 'service.status.received',
  diagnosing: 'service.status.diagnosing',
  awaiting_approval: 'service.status.awaiting',
  in_repair: 'service.status.inRepair',
  ready: 'service.status.ready',
  delivered: 'service.status.delivered',
  cancelled: 'service.status.cancelled'
}

const MIN_CUSTOMER_SEARCH = 2

function mapTicket(data: Record<string, unknown>): ServiceTicketRow {
  return {
    id: Number(data.id),
    ticket_number: String(data.ticket_number ?? ''),
    customer_name: String(data.customer_name ?? ''),
    customer_phone: String(data.customer_phone ?? ''),
    device_summary: String(data.device_summary ?? ''),
    status: String(data.status ?? ''),
    diagnosis: data.diagnosis ? String(data.diagnosis) : undefined,
    estimated_price: data.estimated_price != null ? String(data.estimated_price) : null,
    final_price: data.final_price != null ? String(data.final_price) : null,
    received_at: String(data.received_at ?? '')
  }
}

export default function ServiceTab({
  busy,
  autoPoll,
  onLog,
  onRefreshJobs,
  onProcessQueue
}: ServiceTabProps): React.JSX.Element {
  const { t } = useI18n()
  const [view, setView] = useState<ServiceView>('intake')
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('quick')
  const [customerFirstName, setCustomerFirstName] = useState('')
  const [customerLastName, setCustomerLastName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [deviceSerial, setDeviceSerial] = useState('')
  const [complaint, setComplaint] = useState('')
  const [lookupBuffer, setLookupBuffer] = useState('')
  const [lookupResults, setLookupResults] = useState<ServiceTicketRow[]>([])
  const [lookupSearching, setLookupSearching] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<ServiceTicketRow | null>(null)
  const [finalPrice, setFinalPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [diagnosisText, setDiagnosisText] = useState('')
  const [estimatedPriceInput, setEstimatedPriceInput] = useState('')
  const lookupRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)
  const lookupSeq = useRef(0)

  const MIN_LOOKUP_SEARCH = 2

  useEffect(() => {
    if (intakeMode !== 'existing') {
      setCustomerResults([])
      setCustomerSearchError(null)
      return
    }
    const q = customerQuery.trim()
    if (q.length < MIN_CUSTOMER_SEARCH) {
      setCustomerResults([])
      setCustomerSearchError(null)
      return
    }

    const seq = ++searchSeq.current
    setCustomerSearching(true)
    setCustomerSearchError(null)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = (await window.api.customers.search(q)) as CustomerRow[]
          if (seq !== searchSeq.current) return
          setCustomerResults(rows)
        } catch (e) {
          if (seq !== searchSeq.current) return
          setCustomerResults([])
          setCustomerSearchError(String(e))
        } finally {
          if (seq === searchSeq.current) setCustomerSearching(false)
        }
      })()
    }, 300)

    return () => clearTimeout(timer)
  }, [customerQuery, intakeMode])

  useEffect(() => {
    if (view !== 'lookup') return
    const q = lookupBuffer.trim()
    if (q.length < MIN_LOOKUP_SEARCH) {
      setLookupResults([])
      setLookupError(null)
      return
    }

    const seq = ++lookupSeq.current
    setLookupSearching(true)
    setLookupError(null)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = (await window.api.service.lookup(q)) as ServiceTicketLookupResult
          if (seq !== lookupSeq.current) return
          const rows = result.tickets ?? []
          setLookupResults(rows)
          if (!rows.length) {
            setTicket(null)
            setLookupError(t('service.lookup.notFound', { code: q }))
            return
          }
          setLookupError(null)
          if (rows.length === 1) {
            selectTicket(rows[0])
          } else {
            setTicket(null)
          }
        } catch (e) {
          if (seq !== lookupSeq.current) return
          setLookupResults([])
          setTicket(null)
          setLookupError(String(e))
        } finally {
          if (seq === lookupSeq.current) setLookupSearching(false)
        }
      })()
    }, 300)

    return () => clearTimeout(timer)
  }, [lookupBuffer, view, t])

  function resetIntakeForm(): void {
    setCustomerFirstName('')
    setCustomerLastName('')
    setCustomerPhone('')
    setCustomerQuery('')
    setCustomerResults([])
    setSelectedCustomer(null)
    setCustomerSearchError(null)
    setDeviceBrand('')
    setDeviceModel('')
    setDeviceSerial('')
    setComplaint('')
  }

  function switchIntakeMode(mode: IntakeMode): void {
    setIntakeMode(mode)
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerResults([])
    setCustomerSearchError(null)
    if (mode === 'existing') {
      setCustomerFirstName('')
      setCustomerLastName('')
      setCustomerPhone('')
    }
  }

  function selectCustomer(row: CustomerRow): void {
    setSelectedCustomer(row)
    setCustomerQuery(row.full_name || `${row.first_name} ${row.last_name}`.trim())
    setCustomerResults([])
  }

  function clearSelectedCustomer(): void {
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerResults([])
  }

  const intakeReady =
    complaint.trim().length > 0 &&
    (intakeMode === 'existing'
      ? selectedCustomer !== null
      : customerFirstName.trim().length > 0 && customerPhone.trim().length > 0)

  function applyTicket(row: ServiceTicketRow): void {
    setTicket(row)
    setFinalPrice(row.final_price || row.estimated_price || '')
    setDiagnosisText(row.diagnosis || '')
    setEstimatedPriceInput(row.estimated_price || '')
    setDiagnosisOpen(false)
  }

  function selectTicket(row: ServiceTicketRow): void {
    applyTicket(row)
    onLog(t('service.log.lookup', { number: row.ticket_number }))
  }

  async function refreshTicketFromApi(data: Record<string, unknown>): Promise<void> {
    applyTicket(mapTicket(data))
  }

  async function doTransition(status: string): Promise<void> {
    if (!ticket) return
    try {
      const data = (await window.api.service.transition(ticket.id, { status })) as Record<
        string,
        unknown
      >
      await refreshTicketFromApi(data)
      onLog(t('service.log.transition', { number: ticket.ticket_number }))
    } catch (e) {
      onLog(t('service.log.transitionError', { error: String(e) }))
    }
  }

  async function saveDiagnosis(): Promise<void> {
    if (!ticket || !diagnosisText.trim() || !estimatedPriceInput) return
    try {
      const data = (await window.api.service.submitDiagnosis(ticket.id, {
        diagnosis: diagnosisText.trim(),
        estimated_price: estimatedPriceInput
      })) as Record<string, unknown>
      await refreshTicketFromApi(data)
      onLog(t('service.log.diagnosisSaved', { number: ticket.ticket_number }))
    } catch (e) {
      onLog(t('service.log.diagnosisError', { error: String(e) }))
    }
  }

  async function approveQuote(): Promise<void> {
    if (!ticket) return
    try {
      const data = (await window.api.service.approveQuote(ticket.id)) as Record<string, unknown>
      await refreshTicketFromApi(data)
      onLog(t('service.log.approved', { number: ticket.ticket_number }))
    } catch (e) {
      onLog(t('service.log.approveError', { error: String(e) }))
    }
  }

  function openDiagnosisPanel(): void {
    if (!ticket) return
    setDiagnosisText(ticket.diagnosis || '')
    setEstimatedPriceInput(ticket.estimated_price || '')
    setDiagnosisOpen(true)
  }

  async function runLookupNow(): Promise<void> {
    const q = lookupBuffer.trim()
    if (q.length < MIN_LOOKUP_SEARCH) return
    lookupSeq.current += 1
    setLookupSearching(true)
    setLookupError(null)
    try {
      const result = (await window.api.service.lookup(q)) as ServiceTicketLookupResult
      const rows = result.tickets ?? []
      setLookupResults(rows)
      if (!rows.length) {
        setTicket(null)
        setLookupError(t('service.lookup.notFound', { code: q }))
        return
      }
      setLookupError(null)
      if (rows.length === 1) {
        selectTicket(rows[0])
      } else {
        setTicket(null)
      }
    } catch (e) {
      setLookupResults([])
      setTicket(null)
      setLookupError(String(e))
    } finally {
      setLookupSearching(false)
    }
  }

  async function submitIntake(): Promise<void> {
    if (!intakeReady) return
    try {
      const base = {
        device_brand: deviceBrand.trim(),
        device_model: deviceModel.trim(),
        device_serial: deviceSerial.trim(),
        complaint: complaint.trim(),
        print_intake: true
      }
      const payload =
        intakeMode === 'existing' && selectedCustomer
          ? { ...base, customer: selectedCustomer.id }
          : {
              ...base,
              customer_name: [customerFirstName.trim(), customerLastName.trim()].filter(Boolean).join(' '),
              customer_phone: customerPhone.trim()
            }
      const created = (await window.api.service.createTicket(payload)) as { ticket_number?: string }
      onLog(t('service.log.intakeCreated', { number: created.ticket_number || '' }))
      resetIntakeForm()
      await onRefreshJobs()
      if (autoPoll) await onProcessQueue(true)
    } catch (e) {
      onLog(t('service.log.intakeError', { error: String(e) }))
    }
  }

  async function handleLookupKey(e: React.KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (e.key === 'Enter') {
      e.preventDefault()
      await runLookupNow()
    }
  }

  async function submitDeliver(): Promise<void> {
    if (!ticket || !finalPrice) return
    try {
      await window.api.service.deliver(ticket.id, {
        final_price: finalPrice,
        payment_method: paymentMethod
      })
      onLog(t('service.log.delivered', { number: ticket.ticket_number }))
      setTicket(null)
      setLookupBuffer('')
      setLookupResults([])
    } catch (e) {
      onLog(t('service.log.deliverError', { error: String(e) }))
    }
  }

  async function reprintIntake(): Promise<void> {
    if (!ticket) return
    try {
      await window.api.service.printIntake(ticket.id)
      onLog(t('service.log.reprint', { number: ticket.ticket_number }))
      await onRefreshJobs()
      if (autoPoll) await onProcessQueue(true)
    } catch (e) {
      onLog(t('service.log.reprintError', { error: String(e) }))
    }
  }

  const statusLabel = (status: string): string => {
    const key = STATUS_KEYS[status]
    return key ? t(key) : status
  }

  return (
    <div className="card">
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={view === 'intake' ? 'active' : ''}
          onClick={() => setView('intake')}
        >
          {t('service.tab.intake')}
        </button>
        <button
          type="button"
          className={view === 'lookup' ? 'active' : ''}
          onClick={() => {
            setView('lookup')
            setTimeout(() => lookupRef.current?.focus(), 50)
          }}
        >
          {t('service.tab.lookup')}
        </button>
      </div>

      {view === 'intake' && (
        <div className="form-stack">
          <p className="muted" style={{ margin: 0 }}>{t('service.intake.hint')}</p>

          <label>
            {t('service.field.intakeMode')}
            <select
              className="select-field"
              value={intakeMode}
              onChange={(e) => switchIntakeMode(e.target.value as IntakeMode)}
            >
              <option value="quick">{t('service.intake.quick')}</option>
              <option value="existing">{t('service.intake.existing')}</option>
            </select>
          </label>

          {intakeMode === 'existing' ? (
            <div className="customer-search">
              <label>
                {t('service.field.customerSearch')}
                <input
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    if (selectedCustomer) setSelectedCustomer(null)
                  }}
                  placeholder={t('service.field.customerSearchPlaceholder')}
                  autoComplete="off"
                />
              </label>
              {customerSearching && <p className="muted">{t('service.field.customerSearching')}</p>}
              {customerSearchError && <div className="alert error">{customerSearchError}</div>}
              {customerQuery.trim().length > 0 &&
                customerQuery.trim().length < MIN_CUSTOMER_SEARCH && (
                  <p className="muted">
                    {t('service.field.customerSearchMin', { count: MIN_CUSTOMER_SEARCH })}
                  </p>
                )}
              {!selectedCustomer && customerResults.length > 0 && (
                <ul className="customer-results">
                  {customerResults.map((row) => (
                    <li key={row.id}>
                      <button type="button" className="customer-result" onClick={() => selectCustomer(row)}>
                        <strong>{row.full_name || `${row.first_name} ${row.last_name}`.trim()}</strong>
                        {row.phone ? <span>{row.phone}</span> : null}
                        {row.email ? <span>{row.email}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedCustomer && (
                <div className="cert-banner" style={{ marginTop: 8 }}>
                  <strong>
                    {selectedCustomer.full_name ||
                      `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim()}
                  </strong>
                  {selectedCustomer.phone ? <span>{selectedCustomer.phone}</span> : null}
                  <button type="button" className="btn ghost" onClick={clearSelectedCustomer}>
                    {t('service.field.clearCustomer')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid two-col">
                <label>
                  {t('service.field.customerName')}
                  <input
                    value={customerFirstName}
                    onChange={(e) => setCustomerFirstName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  {t('service.field.customerLastName')}
                  <input
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                  />
                </label>
              </div>
              <label>
                {t('service.field.phone')}
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </label>
            </>
          )}

          <div className="grid two-col">
            <label>
              {t('service.field.brand')}
              <input value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} />
            </label>
            <label>
              {t('service.field.model')}
              <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} />
            </label>
          </div>
          <label>
            {t('service.field.serial')}
            <input value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} />
          </label>
          <label>
            {t('service.field.complaint')}
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              required
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !intakeReady}
              onClick={() => void submitIntake()}
            >
              {t('service.intake.submit')}
            </button>
          </div>
        </div>
      )}

      {view === 'lookup' && (
        <>
          <p className="muted">{t('service.lookup.hint')}</p>
          <label>
            {t('service.tab.lookup')}
            <input
              ref={lookupRef}
              value={lookupBuffer}
              onChange={(e) => {
                setLookupBuffer(e.target.value)
                if (ticket) setTicket(null)
              }}
              onKeyDown={(e) => void handleLookupKey(e)}
              placeholder={t('service.lookup.placeholder')}
              autoComplete="off"
            />
          </label>
          {lookupSearching && <p className="muted">{t('service.lookup.searching')}</p>}
          {lookupBuffer.trim().length > 0 && lookupBuffer.trim().length < MIN_LOOKUP_SEARCH && (
            <p className="muted">{t('service.lookup.minChars', { count: MIN_LOOKUP_SEARCH })}</p>
          )}
          {lookupError && <div className="alert error">{lookupError}</div>}
          {!ticket && lookupResults.length > 1 && (
            <ul className="customer-results">
              {lookupResults.map((row) => (
                <li key={row.id}>
                  <button type="button" className="customer-result" onClick={() => selectTicket(row)}>
                    <strong>{row.ticket_number}</strong>
                    <span>
                      {row.customer_name}
                      {row.customer_phone ? ` · ${row.customer_phone}` : ''}
                    </span>
                    <span>
                      {row.device_summary} · {statusLabel(row.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ticket && (
            <div className="cert-banner">
              <strong>{ticket.ticket_number}</strong>
              <span>
                {ticket.customer_name}
                {ticket.customer_phone ? ` · ${ticket.customer_phone}` : ''}
              </span>
              <span>{ticket.device_summary}</span>
              <span>
                {t('service.field.status')}: {statusLabel(ticket.status)}
              </span>
              {ticket.estimated_price && (
                <span>
                  {t('service.field.estimated')}: {ticket.estimated_price} ₺
                </span>
              )}
              {ticket.diagnosis && (
                <span>
                  {t('service.field.diagnosis')}: {ticket.diagnosis}
                </span>
              )}
              <div className="ticket-actions">
                {(ticket.status === 'received' || ticket.status === 'diagnosing') && (
                  <button type="button" className="btn secondary" disabled={busy} onClick={openDiagnosisPanel}>
                    {t('service.actions.diagnosis')}
                  </button>
                )}
                {ticket.status === 'received' && (
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void doTransition('diagnosing')}
                  >
                    {t('service.actions.startDiagnosis')}
                  </button>
                )}
                {ticket.status === 'awaiting_approval' && (
                  <>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => void approveQuote()}>
                      {t('service.actions.approve')}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => void doTransition('cancelled')}
                    >
                      {t('service.actions.reject')}
                    </button>
                  </>
                )}
                {ticket.status === 'in_repair' && (
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void doTransition('ready')}
                  >
                    {t('service.actions.markReady')}
                  </button>
                )}
                <button type="button" className="btn secondary" disabled={busy} onClick={() => void reprintIntake()}>
                  {t('service.lookup.reprint')}
                </button>
              </div>
              {diagnosisOpen && (
                <div className="deliver-panel">
                  <h3>{t('service.actions.diagnosis')}</h3>
                  <label>
                    {t('service.field.diagnosis')}
                    <textarea
                      value={diagnosisText}
                      onChange={(e) => setDiagnosisText(e.target.value)}
                      rows={3}
                      required
                    />
                  </label>
                  <label>
                    {t('service.field.estimated')}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedPriceInput}
                      onChange={(e) => setEstimatedPriceInput(e.target.value)}
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button type="button" className="btn ghost" onClick={() => setDiagnosisOpen(false)}>
                      İptal
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy || !diagnosisText.trim() || !estimatedPriceInput}
                      onClick={() => void saveDiagnosis()}
                    >
                      {t('service.actions.saveDiagnosis')}
                    </button>
                  </div>
                </div>
              )}
              {ticket.status === 'ready' && (
                <div className="deliver-panel">
                  <h3>{t('service.deliver.title')}</h3>
                  <div className="grid two-col deliver-fields">
                    <label>
                      {t('service.field.finalPrice')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={finalPrice}
                        onChange={(e) => setFinalPrice(e.target.value)}
                      />
                    </label>
                    <label>
                      {t('service.field.payment')}
                      <select
                        className="select-field"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="cash">{t('service.payment.cash')}</option>
                        <option value="card">{t('service.payment.card')}</option>
                        <option value="iban">{t('service.payment.iban')}</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy || !finalPrice}
                      onClick={() => void submitDeliver()}
                    >
                      {t('service.deliver.submit')}
                    </button>
                  </div>
                </div>
              )}
              {ticket.status === 'delivered' && (
                <div className="alert" style={{ marginTop: 12 }}>
                  {t('service.deliver.already')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
