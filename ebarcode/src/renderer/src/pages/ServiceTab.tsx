import { useRef, useState } from 'react'
import type { ServiceTicketLookupResult, ServiceTicketRow } from '../../../shared/types'
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

const STATUS_KEYS: Record<string, MessageKey> = {
  received: 'service.status.received',
  diagnosing: 'service.status.diagnosing',
  awaiting_approval: 'service.status.awaiting',
  in_repair: 'service.status.inRepair',
  ready: 'service.status.ready',
  delivered: 'service.status.delivered',
  cancelled: 'service.status.cancelled'
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
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [deviceSerial, setDeviceSerial] = useState('')
  const [complaint, setComplaint] = useState('')
  const [lookupBuffer, setLookupBuffer] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<ServiceTicketRow | null>(null)
  const [finalPrice, setFinalPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const lookupRef = useRef<HTMLInputElement>(null)

  async function submitIntake(): Promise<void> {
    if (!customerName.trim() || !customerPhone.trim() || !complaint.trim()) return
    try {
      const created = (await window.api.service.createTicket({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        device_brand: deviceBrand.trim(),
        device_model: deviceModel.trim(),
        device_serial: deviceSerial.trim(),
        complaint: complaint.trim(),
        print_intake: true
      })) as { ticket_number?: string }
      onLog(t('service.log.intakeCreated', { number: created.ticket_number || '' }))
      setCustomerName('')
      setCustomerPhone('')
      setDeviceBrand('')
      setDeviceModel('')
      setDeviceSerial('')
      setComplaint('')
      await onRefreshJobs()
      if (autoPoll) await onProcessQueue(true)
    } catch (e) {
      onLog(t('service.log.intakeError', { error: String(e) }))
    }
  }

  async function doLookup(code: string): Promise<void> {
    const trimmed = code.trim()
    if (!trimmed) return
    setLookupError(null)
    try {
      const result = (await window.api.service.lookup(trimmed)) as ServiceTicketLookupResult
      if (!result.found || !result.ticket) {
        setTicket(null)
        setLookupError(t('service.lookup.notFound', { code: trimmed }))
        return
      }
      setTicket(result.ticket)
      setFinalPrice(result.ticket.final_price || result.ticket.estimated_price || '')
      onLog(t('service.log.lookup', { number: result.ticket.ticket_number }))
    } catch (e) {
      setTicket(null)
      setLookupError(String(e))
    }
  }

  async function handleLookupKey(e: React.KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (e.key === 'Enter') {
      e.preventDefault()
      await doLookup(lookupBuffer)
      setLookupBuffer('')
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
        <>
          <p className="muted">{t('service.intake.hint')}</p>
          <label>
            {t('service.field.customerName')}
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </label>
          <label>
            {t('service.field.phone')}
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
          </label>
          <div className="grid two-col" style={{ gap: 12 }}>
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
          <button
            type="button"
            className="btn primary"
            disabled={busy || !customerName.trim() || !customerPhone.trim() || !complaint.trim()}
            onClick={() => void submitIntake()}
          >
            {t('service.intake.submit')}
          </button>
        </>
      )}

      {view === 'lookup' && (
        <>
          <p className="muted">{t('service.lookup.hint')}</p>
          <label>
            {t('service.tab.lookup')}
            <input
              ref={lookupRef}
              value={lookupBuffer}
              onChange={(e) => setLookupBuffer(e.target.value)}
              onKeyDown={(e) => void handleLookupKey(e)}
              placeholder={t('service.lookup.placeholder')}
              autoComplete="off"
            />
          </label>
          {lookupError && <div className="alert error">{lookupError}</div>}
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
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn secondary" disabled={busy} onClick={() => void reprintIntake()}>
                  {t('service.lookup.reprint')}
                </button>
              </div>
              {ticket.status === 'ready' && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ marginTop: 0 }}>{t('service.deliver.title')}</h3>
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
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="cash">{t('service.payment.cash')}</option>
                      <option value="card">{t('service.payment.card')}</option>
                      <option value="iban">{t('service.payment.iban')}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || !finalPrice}
                    onClick={() => void submitDeliver()}
                  >
                    {t('service.deliver.submit')}
                  </button>
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
