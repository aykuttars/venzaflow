import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CertificateInfo, Pkcs11Driver, TokenSlotInfo } from '@shared/types'
import DriverSetupGuide from '../components/DriverSetupGuide'

interface CertificateSelectPageProps {
  onSelected: () => void
}

export default function CertificateSelectPage({
  onSelected
}: CertificateSelectPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState<Pkcs11Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Pkcs11Driver | null>(null)
  const [slots, setSlots] = useState<TokenSlotInfo[]>([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [certificates, setCertificates] = useState<CertificateInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadDrivers()
  }, [])

  async function loadDrivers(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const found = await window.api.pkcs11.discoverDrivers()
      setDrivers(found)
      if (found.length > 0) {
        await selectDriver(found[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sürücüler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function selectDriver(driver: Pkcs11Driver): Promise<void> {
    setError(null)
    try {
      await window.api.pkcs11.setDriver(driver)
      setSelectedDriver(driver)
      const slotList = await window.api.pkcs11.listSlots()
      setSlots(slotList)
      setSelectedSlot(slotList[0]?.slotIndex ?? null)
      if (slotList[0]) {
        await loadCertificates(slotList[0].slotIndex)
      } else {
        setCertificates([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token algılanamadı')
      setSlots([])
      setCertificates([])
    }
  }

  async function loadCertificates(slotIndex: number): Promise<void> {
    setError(null)
    try {
      const certs = await window.api.pkcs11.listCertificates(slotIndex)
      setCertificates(certs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sertifikalar okunamadı')
      setCertificates([])
    }
  }

  async function handleBrowseDriver(): Promise<void> {
    const driver = await window.api.pkcs11.browseDriver()
    if (driver) {
      setDrivers((prev) => [driver, ...prev.filter((d) => d.path !== driver.path)])
      await selectDriver(driver)
    }
  }

  async function handleSelectCertificate(cert: CertificateInfo): Promise<void> {
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>E-İmza Sertifikası Seç</h1>
          <p>USB token takılı olmalı ve sürücüsü kurulu olmalıdır.</p>
        </div>
        <button type="button" className="btn secondary" onClick={() => void handleBrowseDriver()}>
          Sürücü Seç
        </button>
      </div>

      {loading && <div className="alert info">Token aranıyor...</div>}
      {error && <div className="alert error">{error}</div>}

      {!loading && drivers.length === 0 ? (
        <DriverSetupGuide
          onRescan={() => void loadDrivers()}
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
                  onClick={() => {
                    setSelectedSlot(slot.slotIndex)
                    void loadCertificates(slot.slotIndex)
                  }}
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
            {certificates.map((cert) => (
              <button
                key={cert.id}
                type="button"
                className="cert-card"
                onClick={() => void handleSelectCertificate(cert)}
              >
                <strong>{cert.label}</strong>
                <span>{cert.subject}</span>
                {cert.notAfter && <small>Geçerlilik: {cert.notAfter}</small>}
              </button>
            ))}
          </div>
        )}
          </section>
        </>
      )}
    </div>
  )
}
