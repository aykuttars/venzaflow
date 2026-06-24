import { Worker } from 'worker_threads'
import { join } from 'path'
import type { Pkcs11Driver } from '../../shared/types'
import { PKCS11_SCAN_TIMEOUT_MS } from '../../shared/pkcs11Config'
import { probeDriver } from './pkcs11Core'

export class Pkcs11ProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Token taraması ${Math.round(timeoutMs / 1000)} saniye içinde tamamlanamadı.`)
    this.name = 'Pkcs11ProbeTimeoutError'
  }
}

function workerScriptPath(): string {
  return join(__dirname, 'services/pkcs11.worker.js')
}

function runProbeInWorker(
  driver: Pkcs11Driver,
  timeoutMs: number
): Promise<ReturnType<typeof probeDriver>> {
  return new Promise((resolve, reject) => {
    let settled = false
    const worker = new Worker(workerScriptPath())

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Pkcs11ProbeTimeoutError(timeoutMs)))
    }, timeoutMs)

    worker.on('message', (message: { ok: boolean; data?: ReturnType<typeof probeDriver>; error?: string }) => {
      if (message.ok) {
        finish(() => resolve(message.data!))
        return
      }
      finish(() => reject(new Error(message.error || 'Token taraması başarısız.')))
    })

    worker.on('error', (error) => {
      finish(() => reject(error))
    })

    worker.on('exit', (code) => {
      if (settled) return
      if (code === 0) return
      finish(() => reject(new Error(`Token tarama işlemi beklenmedik şekilde sonlandı (${code}).`)))
    })

    worker.postMessage({ op: 'probe', driver })
  })
}

export async function probeDriverWithTimeout(
  driver: Pkcs11Driver,
  timeoutMs = PKCS11_SCAN_TIMEOUT_MS
): Promise<ReturnType<typeof probeDriver>> {
  if (process.env.EIMZA_PKCS11_INLINE_PROBE === '1') {
    return probeDriver(driver)
  }
  try {
    return await runProbeInWorker(driver, timeoutMs)
  } catch (error) {
    if (error instanceof Pkcs11ProbeTimeoutError) {
      throw error
    }
    throw error
  }
}
