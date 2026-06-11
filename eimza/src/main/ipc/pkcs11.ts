import { dialog, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResponse, Pkcs11Driver, SelectedCertificate } from '../../shared/types'
import { createCustomDriver } from '../services/driverDiscovery'
import { pkcs11Service } from '../services/pkcs11Service'
import { saveDriverPath } from '../services/secureStore'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, error: message }
}

export function registerPkcs11Ipc(): void {
  ipcMain.handle(IPC.PKCS11_DISCOVER_DRIVERS, async () => {
    try {
      return ok(pkcs11Service.discover())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_SET_DRIVER, async (_event, driver: Pkcs11Driver) => {
    try {
      pkcs11Service.setDriver(driver)
      saveDriverPath(driver.path)
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_LIST_SLOTS, async () => {
    try {
      return ok(pkcs11Service.listSlots())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_LIST_CERTIFICATES, async (_event, slotIndex: number) => {
    try {
      return ok(pkcs11Service.listCertificates(slotIndex))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_SELECT_CERTIFICATE, async (_event, cert: SelectedCertificate) => {
    try {
      pkcs11Service.selectCertificate(cert)
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_GET_SELECTED, async () => {
    try {
      return ok(pkcs11Service.getSelectedCertificate())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PKCS11_LOGOUT, async () => {
    try {
      pkcs11Service.logout()
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('pkcs11:browse-driver', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'PKCS#11 sürücüsü seçin',
        properties: ['openFile'],
        filters: [
          { name: 'PKCS#11 Library', extensions: ['dll', 'dylib', 'so'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePaths[0]) {
        return ok(null)
      }
      const driver = createCustomDriver(result.filePaths[0])
      pkcs11Service.setDriver(driver)
      saveDriverPath(driver.path)
      return ok(driver)
    } catch (error) {
      return fail(error)
    }
  })
}
