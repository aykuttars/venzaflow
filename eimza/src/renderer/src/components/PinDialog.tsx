import { useState } from 'react'

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
}: PinDialogProps): React.JSX.Element {
  const [pin, setPin] = useState('')

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>PIN Girin</h3>
        <p>
          <strong>{title}</strong> belgesini imzalamak için e-imza PIN&apos;inizi girin.
        </p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="E-imza PIN"
          autoFocus
          maxLength={16}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin) {
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
            disabled={!pin || loading}
            onClick={() => void onSubmit(pin)}
          >
            {loading ? 'İmzalanıyor...' : 'İmzala'}
          </button>
        </div>
      </div>
    </div>
  )
}
