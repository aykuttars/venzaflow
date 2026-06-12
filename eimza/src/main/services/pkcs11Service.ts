import { X509Certificate as NodeX509 } from 'crypto'
import * as graphene from 'graphene-pk11'
import { createCustomDriver, discoverDrivers, pickPreferredDriver } from './driverDiscovery'
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
    this.initializeModule(this.activeModule)
  }

  // CK_C_INITIALIZE_ARGS flag kept for libraries that require explicit locking setup.
  private static readonly CKF_OS_LOCKING_OK = 2

  // Initialize the loaded module.
  // pkcs11js (patched) must call C_Initialize(NULL) for AKİS/libakisp11 — the
  // stock binding always passed a non-NULL struct and got CKR_ARGUMENTS_BAD.
  // Call lib.C_Initialize() with zero JS args (NULL), then graphene getInfo().
  private initializeModule(mod: GrapheneModule): void {
    try {
      mod.lib.C_Initialize()
    } catch (err) {
      if (/ALREADY_INITIALIZED/i.test(String(err))) {
        mod.initialize()
        return
      }
      // OpenSC and some middleware want CKF_OS_LOCKING_OK when NULL is rejected.
      try {
        mod.lib.C_Initialize({ flags: Pkcs11Service.CKF_OS_LOCKING_OK })
      } catch (retryErr) {
        if (/ALREADY_INITIALIZED/i.test(String(retryErr))) {
          mod.initialize({ flags: Pkcs11Service.CKF_OS_LOCKING_OK })
          return
        }
        throw retryErr
      }
    }
    mod.initialize()
  }

  ensureDriver(driver?: Pkcs11Driver): void {
    if (this.activeModule) return
    const drivers = driver ? [driver] : this.discover()
    if (drivers.length === 0) {
      throw new Error(
        'PKCS#11 sürücüsü bulunamadı. AKİS veya e-imza sürücüsünü kurun veya manuel yol seçin.'
      )
    }
    this.setDriver(pickPreferredDriver(drivers)!)
  }

  listSlots(): TokenSlotInfo[] {
    this.ensureDriver()
    const mod = this.activeModule!

    // Enumerate ALL slots and derive token presence from the per-slot flag.
    // Some PKCS#11 libraries (notably AKİS/libakisp11) return an empty list for
    // C_GetSlotList(tokenPresent=TRUE) even when a card is inserted, so relying
    // on that filter hides real tokens. getSlots(false) lists every slot; we
    // keep only those whose TOKEN_PRESENT flag is set. This also keeps slot
    // indices consistent with listCertificates/openAuthenticatedSession, which
    // both enumerate via getSlots(false).
    let slotCollection: ReturnType<GrapheneModule['getSlots']>
    try {
      slotCollection = mod.getSlots(false)
    } catch {
      try {
        slotCollection = mod.getSlots(true)
      } catch {
        return []
      }
    }

    const slots: TokenSlotInfo[] = []
    for (let i = 0; i < slotCollection.length; i++) {
      try {
        const slot = slotCollection.items(i)
        const tokenPresent = Boolean(slot.flags & graphene.SlotFlag.TOKEN_PRESENT)
        slots.push({
          slotIndex: i,
          label: slot.slotDescription?.trim() || `Slot ${i}`,
          manufacturer: slot.manufacturerID?.trim() || '',
          tokenPresent,
          driverId: this.activeDriver!.id,
          driverName: this.activeDriver!.name
        })
      } catch {
        // Reading per-slot info (C_GetSlotInfo) can throw on some middleware;
        // skip the slot rather than failing the whole enumeration.
        continue
      }
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
    this.selectedCertificate = null
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
