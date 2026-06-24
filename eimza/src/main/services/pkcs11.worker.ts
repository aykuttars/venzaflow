import { parentPort } from 'worker_threads'
import type { Pkcs11Driver } from '../../shared/types'
import { probeDriver } from './pkcs11Core'

type ProbeMessage = {
  op: 'probe'
  driver: Pkcs11Driver
}

type WorkerSuccess = {
  ok: true
  data: ReturnType<typeof probeDriver>
}

type WorkerFailure = {
  ok: false
  error: string
}

if (!parentPort) {
  throw new Error('pkcs11.worker must run inside a Worker thread.')
}

parentPort.on('message', (message: ProbeMessage) => {
  try {
    if (message.op !== 'probe') {
      const failure: WorkerFailure = { ok: false, error: 'Unknown worker operation.' }
      parentPort!.postMessage(failure)
      return
    }
    const data = probeDriver(message.driver)
    const success: WorkerSuccess = { ok: true, data }
    parentPort!.postMessage(success)
  } catch (error) {
    const failure: WorkerFailure = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
    parentPort!.postMessage(failure)
  }
})
