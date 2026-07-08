import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { DocumentType, IpcResponse } from '../../shared/types'
import {
  ereceteAdapter,
  efaturaAdapter,
  executeSignFlow,
  getTaskPreview,
  listTasks,
  prepareTask,
  signAndComplete
} from '../services/signingService'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, error: message }
}

export function registerSigningIpc(): void {
  ipcMain.handle(IPC.SIGN_LIST_TASKS, async (_event, documentType: DocumentType) => {
    try {
      return ok(await listTasks(documentType))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.SIGN_PREPARE, async (_event, taskId: string) => {
    try {
      return ok(await prepareTask(taskId))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.SIGN_PREVIEW, async (_event, taskId: string) => {
    try {
      return ok(await getTaskPreview(taskId))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    IPC.SIGN_EXECUTE,
    async (_event, payload: { documentType: DocumentType; taskId: string; pin: string }) => {
      try {
        return ok(await executeSignFlow(payload.documentType, payload.taskId, payload.pin))
      } catch (error) {
        return fail(error)
      }
    }
  )

  ipcMain.handle(IPC.SIGN_COMPLETE, async (_event, payload: { taskId: string; pin: string }) => {
    try {
      return ok(await signAndComplete(payload.taskId, payload.pin))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:erecete-list', async () => {
    try {
      return ok(await ereceteAdapter.list())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:erecete-sign', async (_event, payload: { taskId: string; pin: string }) => {
    try {
      return ok(await ereceteAdapter.sign(payload.taskId, payload.pin))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:earsiv-list', async () => {
    try {
      return ok(await efaturaAdapter.listEarsiv())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:efatura-list', async () => {
    try {
      return ok(await efaturaAdapter.listEfatura())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:earsiv-sign', async (_event, payload: { taskId: string; pin: string }) => {
    try {
      return ok(await efaturaAdapter.signEarsiv(payload.taskId, payload.pin))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sign:efatura-sign', async (_event, payload: { taskId: string; pin: string }) => {
    try {
      return ok(await efaturaAdapter.signEfatura(payload.taskId, payload.pin))
    } catch (error) {
      return fail(error)
    }
  })
}
