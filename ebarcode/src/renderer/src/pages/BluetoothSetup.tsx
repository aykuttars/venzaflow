import { useState } from 'react'

interface BluetoothSetupProps {
  ports: string[]
  selectedPort: string
  onSelectPort: (port: string) => void
  onTestPrint: () => Promise<void>
  onClose: () => void
}

const STEPS = [
  'Bluetooth ve yazıcıyı açın',
  'Windows’ta Xprinter sürücüsünü / eşleştirmeyi tamamlayın',
  'Aşağıdan COM/USB portunu seçin',
  'Test yazdırması gönderin',
  'Başarılıysa ayarları kaydedin',
]

export default function BluetoothSetup({
  ports,
  selectedPort,
  onSelectPort,
  onTestPrint,
  onClose
}: BluetoothSetupProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  async function handleTest(): Promise<void> {
    setBusy(true)
    try {
      await onTestPrint()
      setStep(STEPS.length - 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bt-wizard">
      <h3>Bluetooth / Yazıcı kurulumu</h3>
      <ol>
        {STEPS.map((label, idx) => (
          <li key={label} className={idx <= step ? 'done' : ''}>
            {label}
          </li>
        ))}
      </ol>
      {step >= 2 && (
        <label>
          Port
          <select value={selectedPort} onChange={(e) => onSelectPort(e.target.value)}>
            <option value="">Seçin…</option>
            {ports.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="bt-actions">
        {step < 2 && (
          <button type="button" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>
            İleri
          </button>
        )}
        {step >= 2 && (
          <button type="button" disabled={!selectedPort || busy} onClick={() => void handleTest()}>
            Test yazdır
          </button>
        )}
        <button type="button" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  )
}
