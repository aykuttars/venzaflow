import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface PinDialogProps {
  title: string
  loading?: boolean
  onCancel: () => void
  onSubmit: (pin: string) => Promise<void>
}

export default function PinDialog({
  title,
  loading = false,
  onCancel,
  onSubmit
}: PinDialogProps): React.JSX.Element | null {
  const [pin, setPin] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [])

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-dialog-title">
      <div className="modal">
        <h3 id="pin-dialog-title">PIN Girin</h3>
        <p>
          <strong>{title}</strong> belgesini imzalamak için e-imza PIN&apos;inizi girin.
        </p>
        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="E-imza PIN"
          maxLength={16}
          autoComplete="off"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin && !loading) {
              void onSubmit(pin)
            }
          }}
        />
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={loading}>
            İptal
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pin.trim() || loading}
            onClick={() => void onSubmit(pin)}
          >
            {loading ? 'İmzalanıyor...' : 'İmzala'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
