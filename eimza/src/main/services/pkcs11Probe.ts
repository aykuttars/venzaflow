import { discoverDrivers, pickPreferredDriver } from './driverDiscovery'
import { pkcs11Service } from './pkcs11Service'
import { Pkcs11ProbeTimeoutError, probeDriverWithTimeout } from './pkcs11WorkerHost'
import type { CertificateInfo, Pkcs11Driver, TokenSlotInfo } from '../../shared/types'
import { PKCS11_SCAN_TIMEOUT_MS } from '../../shared/pkcs11Config'

export interface TokenProbeResult {
  drivers: Pkcs11Driver[]
  driver: Pkcs11Driver | null
  slots: TokenSlotInfo[]
  certificates: CertificateInfo[]
  timedOut: boolean
  error?: string
}

export async function probeToken(options?: {
  driver?: Pkcs11Driver | null
  timeoutMs?: number
}): Promise<TokenProbeResult> {
  const timeoutMs = options?.timeoutMs ?? PKCS11_SCAN_TIMEOUT_MS
  const drivers = pkcs11Service.discover()
  const driver = options?.driver ?? pickPreferredDriver(drivers) ?? null

  pkcs11Service.releaseDriver()

  if (!driver) {
    return {
      drivers,
      driver: null,
      slots: [],
      certificates: [],
      timedOut: false,
      error: 'PKCS#11 sürücüsü bulunamadı.'
    }
  }

  try {
    const { slots, certificates } = await probeDriverWithTimeout(driver, timeoutMs)
    pkcs11Service.releaseDriver()
    return {
      drivers,
      driver,
      slots,
      certificates,
      timedOut: false
    }
  } catch (error) {
    pkcs11Service.releaseDriver()
    const timedOut = error instanceof Pkcs11ProbeTimeoutError
    return {
      drivers,
      driver,
      slots: [],
      certificates: [],
      timedOut,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/** Re-export for tests / tooling. */
export { discoverDrivers, pickPreferredDriver }
