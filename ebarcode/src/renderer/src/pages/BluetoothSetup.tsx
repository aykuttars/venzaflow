import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'

interface BluetoothSetupProps {
  ports: string[]
  selectedPort: string
  onSelectPort: (port: string) => void
  onTestPrint: () => Promise<void>
  onClose: () => void
}

export default function BluetoothSetup({
  ports,
  selectedPort,
  onSelectPort,
  onTestPrint,
  onClose
}: BluetoothSetupProps): React.JSX.Element {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState<NodeJS.Platform>('darwin')

  useEffect(() => {
    void window.api.system.getInfo().then((info) => setPlatform(info.platform))
  }, [])

  const steps = useMemo(() => {
    const pairKey: MessageKey =
      platform === 'win32'
        ? 'bt.step.pairWin32'
        : platform === 'linux'
          ? 'bt.step.pairLinux'
          : 'bt.step.pairDarwin'
    return [
      t('bt.step.powerOn'),
      t(pairKey),
      t('bt.step.selectPort'),
      t('bt.step.testPrint'),
      t('bt.step.save')
    ]
  }, [platform, t])

  async function handleTest(): Promise<void> {
    setBusy(true)
    try {
      await onTestPrint()
      setStep(steps.length - 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bt-wizard">
      <h3>{t('bt.title')}</h3>
      <ol>
        {steps.map((label, idx) => (
          <li key={label} className={idx <= step ? 'done' : ''}>
            {label}
          </li>
        ))}
      </ol>
      {step >= 2 && (
        <label>
          {t('bt.port')}
          <select value={selectedPort} onChange={(e) => onSelectPort(e.target.value)}>
            <option value="">{t('bt.portSelect')}</option>
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
          <button type="button" onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}>
            {t('bt.next')}
          </button>
        )}
        {step >= 2 && (
          <button type="button" disabled={!selectedPort || busy} onClick={() => void handleTest()}>
            {t('bt.test')}
          </button>
        )}
        <button type="button" onClick={onClose}>
          {t('bt.close')}
        </button>
      </div>
    </div>
  )
}
