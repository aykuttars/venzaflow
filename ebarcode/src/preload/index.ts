import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { IpcResponse } from '../shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResponse<T>
  if (!result.ok) throw new Error(result.error || 'IPC hatası')
  return result.data as T
}

const api = {
  system: {
    checkHealth: () => invoke<{ online: boolean }>(IPC.SYSTEM_HEALTH),
    getInfo: () => invoke<{ platform: NodeJS.Platform }>(IPC.SYSTEM_INFO)
  },
  auth: {
    login: (credentials: unknown) => invoke(IPC.AUTH_LOGIN, credentials),
    logout: () => invoke(IPC.AUTH_LOGOUT),
    getSession: () => invoke(IPC.AUTH_SESSION),
    restoreSession: () => invoke(IPC.AUTH_RESTORE)
  },
  barcode: {
    lookup: (code: string) => invoke(IPC.BARCODE_LOOKUP, code),
    listJobs: () => invoke(IPC.BARCODE_LIST_JOBS),
    jobTspl: (jobId: number) => invoke<string>(IPC.BARCODE_JOB_TSPL, jobId),
    completeJob: (payload: { jobId: number; status: string; error?: string }) =>
      invoke(IPC.BARCODE_COMPLETE_JOB, payload),
    createJob: (payload: { templateId: number; productIds: number[]; copies?: number }) =>
      invoke(IPC.BARCODE_CREATE_JOB, payload),
    listTemplates: () => invoke(IPC.BARCODE_LIST_TEMPLATES),
    transfer: (payload: { items: Array<{ product_id: number; quantity: number }>; note?: string }) =>
      invoke(IPC.BARCODE_TRANSFER, payload)
  },
  printer: {
    listPorts: () => invoke<string[]>(IPC.PRINTER_LIST_PORTS),
    getSettings: () => invoke(IPC.PRINTER_GET_SETTINGS),
    saveSettings: (settings: unknown) => invoke(IPC.PRINTER_SAVE_SETTINGS, settings),
    sendRaw: (payload: { port?: string; tspl: string }) => invoke(IPC.PRINTER_SEND_RAW, payload),
    test: (port?: string) => invoke(IPC.PRINTER_TEST, port)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(globalThis as typeof globalThis & { api: typeof api }).api = api
}

export type EbarcodeApi = typeof api
