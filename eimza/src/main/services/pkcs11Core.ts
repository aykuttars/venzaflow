import { X509Certificate as NodeX509 } from 'crypto'
import * as graphene from 'graphene-pk11'
import type { CertificateInfo, Pkcs11Driver, TokenSlotInfo } from '../../shared/types'

export type GrapheneModule = graphene.Module

const CKF_OS_LOCKING_OK = 2

export function loadModule(driver: Pkcs11Driver): GrapheneModule {
  const mod = graphene.Module.load(driver.path, driver.name)
  initializeModule(mod)
  return mod
}

export function initializeModule(mod: GrapheneModule): void {
  try {
    mod.lib.C_Initialize()
  } catch (err) {
    if (/ALREADY_INITIALIZED/i.test(String(err))) {
      mod.initialize()
      return
    }
    try {
      mod.lib.C_Initialize({ flags: CKF_OS_LOCKING_OK })
    } catch (retryErr) {
      if (/ALREADY_INITIALIZED/i.test(String(retryErr))) {
        mod.initialize({ flags: CKF_OS_LOCKING_OK })
        return
      }
      throw retryErr
    }
  }
  mod.initialize()
}

export function finalizeModule(mod: GrapheneModule | null): void {
  if (!mod) return
  try {
    mod.finalize()
  } catch {
    // ignore finalize errors from flaky middleware
  }
}

export function listSlots(mod: GrapheneModule, driver: Pkcs11Driver): TokenSlotInfo[] {
  let slotCollection: ReturnType<GrapheneModule['getSlots']>
  try {
    slotCollection = mod.getSlots(true)
  } catch {
    slotCollection = mod.getSlots(false)
  }

  if (slotCollection.length === 0) {
    try {
      slotCollection = mod.getSlots(false)
    } catch {
      return []
    }
  }

  const slots: TokenSlotInfo[] = []
  for (let i = 0; i < slotCollection.length; i++) {
    try {
      const slot = slotCollection.items(i)
      const tokenPresent = Boolean(slot.flags & graphene.SlotFlag.TOKEN_PRESENT)
      if (!tokenPresent) continue
      slots.push({
        slotIndex: i,
        label: slot.slotDescription?.trim() || `Slot ${i}`,
        manufacturer: slot.manufacturerID?.trim() || '',
        tokenPresent,
        driverId: driver.id,
        driverName: driver.name
      })
    } catch {
      continue
    }
  }

  return slots
}

export function listCertificates(
  mod: GrapheneModule,
  driver: Pkcs11Driver,
  slotIndex: number
): CertificateInfo[] {
  const slotCollection = mod.getSlots(false)
  const slot = slotCollection.items(slotIndex)

  if (!(slot.flags & graphene.SlotFlag.TOKEN_PRESENT)) {
    return []
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
        driverId: driver.id
      })
    }
  } finally {
    session.close()
  }

  return certs
}

export function probeDriver(driver: Pkcs11Driver): {
  slots: TokenSlotInfo[]
  certificates: CertificateInfo[]
} {
  let mod: GrapheneModule | null = null
  try {
    mod = loadModule(driver)
    const slots = listSlots(mod, driver)
    const certificates = slots.flatMap((slot) => listCertificates(mod!, driver, slot.slotIndex))
    return { slots, certificates }
  } finally {
    finalizeModule(mod)
  }
}
