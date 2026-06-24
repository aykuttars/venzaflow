import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CertificateInfo, Pkcs11Driver, TokenSlotInfo } from '@shared/types'
import { PKCS11_SCAN_INTERVAL_MS } from '@shared/pkcs11Config'
import { isCertificateExpired } from '@shared/certificateUtils'
import DriverSetupGuide from '../components/DriverSetupGuide'

interface CertificateSelectPageProps {
  onSelected: () => void
  onLogout: () => void
}

export default function CertificateSelectPage({
  onSelected,
  onLogout
}: CertificateSelectPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState<Pkcs11Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Pkcs11Driver | null>(null)
  const [slots, setSlots] = useState<TokenSlotInfo[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [allCertificates, setAllCertificates] = useState<CertificateInfo[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scanInFlight = useRef(false)
  const selectedDriverRef = useRef<Pkcs11Driver | null>(null)

  useEffect(() => {
    selectedDriverRef.current = selectedDriver
  }, [selectedDriver])

  const applyProbeResult = useCallback(
    (driver: Pkcs11Driver | null, nextSlots: TokenSlotInfo[], nextCertificates: CertificateInfo[]) => {
      if (driver) {
        setSelectedDriver(driver)
      }
      setSlots(nextSlots)
      setAllCertificates(nextCertificates)
      const slotIndex = nextSlots[0]?.slotIndex ?? null
      setSelectedSlot(slotIndex)
    },
    []
  )

  const scanForToken = useCallback(async (driverOverride?: Pkcs11Driver | null) => {
    if (scanInFlight.current) return
    scanInFlight.current = true
    setScanning(true)
    setError(null)
    setScanHint(null)

    try {
      const result = await window.api.pkcs11.probeToken(driverOverride ?? selectedDriverRef.current)
      setDrivers(result.drivers)

      if (result.timedOut) {
        setScanHint('Token yanıt vermedi. USB token takılı ve doğru sürücü seçili mi kontrol edin.')
        applyProbeResult(result.driver, [], [])
        return
      }

      if (result.error && result.slots.length === 0) {
        setScanHint(result.error)
        applyProbeResult(result.driver, [], [])
        return
      }

      if (result.slots.length === 0) {
        setScanHint('Takılı e-imza token bulunamadı. Token\'ı takıp birkaç saniye bekleyin.')
        applyProbeResult(result.driver, [], [])
        return
      }

      applyProbeResult(result.driver, result.slots, result.certificates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token taraması başarısız')
      setSlots([])
      setAllCertificates([])
    } finally {
      scanInFlight.current = false
      setScanning(false)
    }
  }, [applyProbeResult])

  useEffect(() => {
    let active = true

    async function bootstrap(): Promise<void> {
      setLoadingDrivers(true)
      try {
        const found = await window.api.pkcs11.discoverDrivers()
        if (!active) return
        setDrivers(found)
        if (found.length > 0) {
          selectedDriverRef.current = found[0]
          setSelectedDriver(found[0])
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Sürücüler yüklenemedi')
        }
      } finally {
        if (active) setLoadingDrivers(false)
      }
    }

    void bootstrap()
    void scanForToken(null)

    const timer = window.setInterval(() => {
      void scanForToken(null)
    }, PKCS11_SCAN_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [scanForToken])

  async function selectDriver(driver: Pkcs11Driver): Promise<void> {
    selectedDriverRef.current = driver
    setSelectedDriver(driver)
    await scanForToken(driver)
  }

  function showCertificatesForSlot(slotIndex: number): void {
    setSelectedSlot(slotIndex)
  }

  const certificates =
    selectedSlot === null
      ? []
      : allCertificates.filter((cert) => cert.slotIndex === selectedSlot)

  async function handleBrowseDriver(): Promise<void> {
    const driver = await window.api.pkcs11.browseDriver()
    if (driver) {
      setDrivers((prev) => [driver, ...prev.filter((d) => d.path !== driver.path)])
      await selectDriver(driver)
    }
  }

  async function handleLogout(): Promise<void> {
    await window.api.pkcs11.logout()
    await window.api.auth.logout()
    onLogout()
    navigate('/login')
  }

  async function handleSelectCertificate(cert: CertificateInfo): Promise<void> {
    if (!selectedDriver) {
      setError('Önce bir PKCS#11 sürücüsü seçin.')
      return
    }

    if (isCertificateExpired(cert.notAfter)) {
      const proceed = window.confirm(
        `Bu sertifikanın geçerlilik süresi dolmuş.\n\nBitiş: ${cert.notAfter}\n\nResmi belgelerde geçerli imza oluşturulamaz. Yine de seçmek istiyor musunuz?`
      )
      if (!proceed) return
    }

    await window.api.pkcs11.setDriver(selectedDriver)
    await window.api.pkcs11.selectCertificate({
      certificateId: cert.id,
      slotIndex: cert.slotIndex,
      driverId: cert.driverId,
      label: cert.label,
      subject: cert.subject
    })
    onSelected()
    navigate('/dashboard')
  }

  const busy = loadingDrivers || scanning

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>E-İmza Sertifikası Seç</h1>
          <p>USB token takılı olmalı ve sürücüsü kurulu olmalıdır.</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => void scanForToken(selectedDriverRef.current)}
          >
            {scanning ? 'Taranıyor…' : 'Token Tara'}
          </button>
          <button type="button" className="btn secondary" onClick={() => void handleBrowseDriver()}>
            Sürücü Seç
          </button>
          <button type="button" className="btn ghost" onClick={() => void handleLogout()}>
            Çıkış
          </button>
        </div>
      </div>

      {busy && <div className="alert info">Token aranıyor…</div>}
      {scanHint && !busy && <div className="alert info">{scanHint}</div>}
      {error && <div className="alert error">{error}</div>}

      {!loadingDrivers && drivers.length === 0 ? (
        <DriverSetupGuide
          onRescan={() => void scanForToken(null)}
          onBrowse={() => void handleBrowseDriver()}
        />
      ) : (
        <>
          <div className="grid two-col">
            <section className="card">
              <h2>PKCS#11 Sürücüsü</h2>
              {drivers.length === 0 ? (
                <p className="muted">Sürücü bulunamadı. AKİS veya e-imza sürücüsünü kurun.</p>
              ) : (
                <ul className="list selectable">
                  {drivers.map((driver) => (
                    <li
                      key={driver.path}
                      className={selectedDriver?.path === driver.path ? 'active' : ''}
                      onClick={() => void selectDriver(driver)}
                    >
                      <strong>{driver.name}</strong>
                      <span>{driver.path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Token / Slot</h2>
              {slots.length === 0 ? (
                <p className="muted">Takılı token bulunamadı.</p>
              ) : (
                <ul className="list selectable">
                  {slots.map((slot) => (
                    <li
                      key={slot.slotIndex}
                      className={selectedSlot === slot.slotIndex ? 'active' : ''}
                      onClick={() => showCertificatesForSlot(slot.slotIndex)}
                    >
                      <strong>{slot.label}</strong>
                      <span>{slot.manufacturer}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card">
            <h2>Sertifikalar</h2>
            {certificates.length === 0 ? (
              <p className="muted">Bu slotta sertifika bulunamadı.</p>
            ) : (
              <div className="cert-grid">
                {certificates.map((cert) => {
                  const expired = isCertificateExpired(cert.notAfter)
                  return (
                    <button
                      key={cert.id}
                      type="button"
                      className={`cert-card${expired ? ' expired' : ''}`}
                      onClick={() => void handleSelectCertificate(cert)}
                    >
                      <strong>{cert.label}</strong>
                      <span>{cert.subject}</span>
                      {cert.notAfter && (
                        <small>
                          Geçerlilik: {cert.notAfter}
                          {expired ? ' (süresi dolmuş)' : ''}
                        </small>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
