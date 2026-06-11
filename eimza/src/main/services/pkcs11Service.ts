import { X509Certificate as NodeX509 } from 'crypto'
import * as graphene from 'graphene-pk11'
import { createCustomDriver, discoverDrivers } from './driverDiscovery'
import { loadDriverPath, saveDriverPath } from './secureStore'
import type {
  CertificateInfo,
  Pkcs11Driver,
  SelectedCertificate,
  TokenSlotInfo
} from '../../shared/types'

type GrapheneModule = graphene.Module
type GrapheneSession = graphene.Session

interface ActiveSession {
  module: GrapheneModule
  session: GrapheneSession
  driver: Pkcs11Driver
  slotIndex: number
}

class Pkcs11Service {
  private activeModule: GrapheneModule | null = null
  private activeDriver: Pkcs11Driver | null = null
  private activeSession: ActiveSession | null = null
  private selectedCertificate: SelectedCertificate | null = null
  private pinMemory: string | null = null

  discover(): Pkcs11Driver[] {
    const found = discoverDrivers()
    const savedPath = loadDriverPath()
    if (savedPath && !found.some((d) => d.path === savedPath)) {
      found.unshift(createCustomDriver(savedPath))
    }
    return found
  }

  setDriver(driver: Pkcs11Driver): void {
    this.finalize()
    saveDriverPath(driver.path)
    this.activeDriver = driver
    this.activeModule = graphene.Module.load(driver.path, driver.name)
    this.activeModule.initialize()
  }

  ensureDriver(driver?: Pkcs11Driver): void {
    if (this.activeModule) return
    const drivers = driver ? [driver] : this.discover()
    if (drivers.length === 0) {
      throw new Error(
        'PKCS#11 sürücüsü bulunamadı. AKİS veya e-imza sürücüsünü kurun veya manuel yol seçin.'
      )
    }
    this.setDriver(drivers[0])
  }

  listSlots(): TokenSlotInfo[] {
    this.ensureDriver()
    const mod = this.activeModule!

    // Some drivers (SafeNet/AKİS) throw CKR_ARGUMENTS_BAD or similar when no
    // token is inserted. Treat any slot enumeration failure as "no token".
    let slotCollection: ReturnType<GrapheneModule['getSlots']>
    try {
      slotCollection = mod.getSlots(true)
    } catch {
      try {
        slotCollection = mod.getSlots(false)
      } catch {
        return []
      }
    }

    const slots: TokenSlotInfo[] = []
    for (let i = 0; i < slotCollection.length; i++) {
      let slot: graphene.Slot
      try {
        slot = slotCollection.items(i)
      } catch {
        continue
      }
      const tokenPresent = Boolean(slot.flags & graphene.SlotFlag.TOKEN_PRESENT)
      slots.push({
        slotIndex: i,
        label: slot.slotDescription?.trim() || `Slot ${i}`,
        manufacturer: slot.manufacturerID?.trim() || '',
        tokenPresent,
        driverId: this.activeDriver!.id,
        driverName: this.activeDriver!.name
      })
    }

    return slots.filter((s) => s.tokenPresent)
  }

  listCertificates(slotIndex: number): CertificateInfo[] {
    this.ensureDriver()
    const mod = this.activeModule!
    const slotCollection = mod.getSlots(false)
    const slot = slotCollection.items(slotIndex)

    if (!(slot.flags & graphene.SlotFlag.TOKEN_PRESENT)) {
      throw new Error('Seçilen slotta token bulunamadı.')
    }

    const session = slot.open()
    const certs: CertificateInfo[] = []

    try {
      const objects = session.find({
        class: graphene.ObjectClass.CERTIFICATE,
        token: true
      })

      for (let i = 0; i < objects.length; i++) {
        const obj = objects.items(i).toType() as graphene.X509Certificate
        if (!obj?.value?.length) continue

        let subject = ''
        let issuer = ''
        let notBefore: string | undefined
        let notAfter: string | undefined
        let serialNumber = obj.serialNumber || ''

        try {
          const parsed = new NodeX509(obj.value)
          subject = parsed.subject
          issuer = parsed.issuer
          notBefore = parsed.validFrom
          notAfter = parsed.validTo
          serialNumber = parsed.serialNumber
        } catch {
          subject = obj.label || `Sertifika ${i + 1}`
        }

        const certId = obj.id?.length ? obj.id.toString('hex') : `${slotIndex}-${i}-${serialNumber}`

        certs.push({
          id: certId,
          label: obj.label?.trim() || subject || `Sertifika ${i + 1}`,
          subject,
          issuer,
          serialNumber,
          notBefore,
          notAfter,
          derBase64: obj.value.toString('base64'),
          slotIndex,
          driverId: this.activeDriver!.id
        })
      }
    } finally {
      session.close()
    }

    return certs
  }

  selectCertificate(certificate: SelectedCertificate): void {
    this.selectedCertificate = certificate
  }

  getSelectedCertificate(): SelectedCertificate | null {
    return this.selectedCertificate
  }

  setPin(pin: string): void {
    this.pinMemory = pin
  }

  clearPin(): void {
    this.pinMemory = null
  }

  logout(): void {
    if (this.activeSession?.session) {
      try {
        this.activeSession.session.logout()
        this.activeSession.session.close()
      } catch {
        // session may already be closed
      }
    }
    this.activeSession = null
    this.clearPin()
  }

  private openAuthenticatedSession(slotIndex: number, pin: string): ActiveSession {
    this.ensureDriver()
    const mod = this.activeModule!
    const slot = mod.getSlots(false).items(slotIndex)
    const session = slot.open()

    try {
      session.login(pin)
    } catch (err) {
      session.close()
      throw new Error('PIN hatalı veya token kilitli.')
    }

    const active: ActiveSession = {
      module: mod,
      session,
      driver: this.activeDriver!,
      slotIndex
    }
    this.activeSession = active
    return active
  }

  private findPrivateKey(session: GrapheneSession, certId: string): graphene.PrivateKey {
    const idBuffer = /^[0-9a-f]+$/i.test(certId) ? Buffer.from(certId, 'hex') : Buffer.from(certId)

    let keys = session.find({
      class: graphene.ObjectClass.PRIVATE_KEY,
      id: idBuffer,
      token: true
    })

    if (keys.length === 0) {
      keys = session.find({
        class: graphene.ObjectClass.PRIVATE_KEY,
        token: true,
        sign: true
      })
    }

    if (keys.length === 0) {
      throw new Error('Sertifikaya ait özel anahtar bulunamadı.')
    }

    return keys.items(0).toType() as graphene.PrivateKey
  }

  signData(data: Buffer, pin: string, algorithm = 'SHA256_RSA_PKCS'): Buffer {
    const selected = this.selectedCertificate
    if (!selected) {
      throw new Error('İmzalama için sertifika seçilmedi.')
    }

    const usePin = pin || this.pinMemory
    if (!usePin) {
      throw new Error('PIN gerekli.')
    }

    let sessionCtx = this.activeSession
    if (!sessionCtx || sessionCtx.slotIndex !== selected.slotIndex) {
      this.logout()
      sessionCtx = this.openAuthenticatedSession(selected.slotIndex, usePin)
    }

    try {
      const privateKey = this.findPrivateKey(sessionCtx.session, selected.certificateId)
      const sign = sessionCtx.session.createSign(algorithm, privateKey)
      sign.update(data)
      return sign.final()
    } finally {
      this.clearPin()
    }
  }

  getSelectedCertificateDer(): string | null {
    if (!this.selectedCertificate) return null
    const certs = this.listCertificates(this.selectedCertificate.slotIndex)
    const match = certs.find((c) => c.id === this.selectedCertificate!.certificateId)
    return match?.derBase64 ?? null
  }

  finalize(): void {
    this.logout()
    if (this.activeModule) {
      try {
        this.activeModule.finalize()
      } catch {
        // ignore finalize errors
      }
    }
    this.activeModule = null
    this.activeDriver = null
    this.selectedCertificate = null
  }
}

export const pkcs11Service = new Pkcs11Service()
