import { registerAuthIpc } from './auth'
import { registerPkcs11Ipc } from './pkcs11'
import { registerSigningIpc } from './signing'
import { registerSystemIpc } from './system'

export function registerAllIpc(): void {
  registerSystemIpc()
  registerAuthIpc()
  registerPkcs11Ipc()
  registerSigningIpc()
}
