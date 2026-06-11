import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResponse, LoginCredentials } from '../../shared/types'
import { apiClient } from '../services/apiClient'
import { saveSession } from '../services/secureStore'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, error: message }
}

export function registerAuthIpc(): void {
  ipcMain.handle(IPC.AUTH_LOGIN, async (_event, credentials: LoginCredentials) => {
    try {
      const session = await apiClient.login(credentials)
      saveSession(session)
      return ok({ email: session.email, customerCode: session.customerCode })
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    try {
      await apiClient.logout()
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.AUTH_SESSION, async () => {
    try {
      const session = apiClient.getSession()
      if (!session) return ok(null)
      return ok({ email: session.email, customerCode: session.customerCode })
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.AUTH_RESTORE, async () => {
    try {
      const session = await apiClient.restoreAndValidateSession()
      if (!session) return ok(null)
      return ok({ email: session.email, customerCode: session.customerCode })
    } catch (error) {
      return fail(error)
    }
  })
}
