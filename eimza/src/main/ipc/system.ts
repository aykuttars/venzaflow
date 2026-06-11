import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResponse } from '../../shared/types'
import { apiClient } from '../services/apiClient'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

export function registerSystemIpc(): void {
  ipcMain.handle(IPC.SYSTEM_HEALTH, async () => {
    const online = await apiClient.checkHealth()
    return ok({ online })
  })

  ipcMain.handle(IPC.SYSTEM_INFO, async () => {
    return ok({ platform: process.platform })
  })
}
