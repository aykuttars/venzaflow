import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResponse, LoginCredentials, PrinterSettings } from '../../shared/types'
import { apiClient } from '../services/apiClient'
import { loadPrinterSettings, savePrinterSettings, saveSession } from '../services/secureStore'
import * as printer from '../services/printerService'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

function fail(error: unknown): IpcResponse<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

export function registerAuthIpc(): void {
  ipcMain.handle(IPC.AUTH_LOGIN, async (_e, credentials: LoginCredentials) => {
    try {
      const session = await apiClient.login(credentials)
      saveSession(session)
      return ok(apiClient.toSessionSummary()!)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    await apiClient.logout()
    return ok(true)
  })

  ipcMain.handle(IPC.AUTH_SESSION, async () => ok(apiClient.toSessionSummary()))

  ipcMain.handle(IPC.AUTH_RESTORE, async () => {
    try {
      const session = await apiClient.restoreAndValidateSession()
      return ok(session ? apiClient.toSessionSummary() : null)
    } catch {
      return ok(null)
    }
  })
}

export function registerBarcodeIpc(): void {
  ipcMain.handle(IPC.BARCODE_LOOKUP, async (_e, code: string) => {
    try {
      return ok(await apiClient.lookup(code))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.BARCODE_LIST_JOBS, async () => {
    try {
      return ok(await apiClient.listQueuedJobs())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.BARCODE_JOB_TSPL, async (_e, jobId: number) => {
    try {
      return ok(await apiClient.jobTspl(jobId))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.BARCODE_COMPLETE_JOB, async (_e, payload: { jobId: number; status: string; error?: string }) => {
    try {
      await apiClient.completeJob(payload.jobId, payload.status, payload.error || '')
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    IPC.BARCODE_CREATE_JOB,
    async (_e, payload: { templateId: number; productIds: number[]; copies?: number }) => {
      try {
        return ok(await apiClient.createPrintJob(payload.templateId, payload.productIds, payload.copies ?? 1))
      } catch (error) {
        return fail(error)
      }
    }
  )

  ipcMain.handle(IPC.BARCODE_LIST_TEMPLATES, async () => {
    try {
      return ok(await apiClient.listTemplates())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.BARCODE_TRANSFER, async (_e, payload: { items: Array<{ product_id: number; quantity: number }>; note?: string }) => {
    try {
      return ok(await apiClient.transfer(payload.items, payload.note))
    } catch (error) {
      return fail(error)
    }
  })
}

export function registerPrinterIpc(): void {
  ipcMain.handle(IPC.PRINTER_LIST_PORTS, async () => {
    try {
      return ok(await printer.listSerialPorts())
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PRINTER_GET_SETTINGS, async () => ok(loadPrinterSettings()))

  ipcMain.handle(IPC.PRINTER_SAVE_SETTINGS, async (_e, settings: PrinterSettings) => {
    savePrinterSettings(settings)
    return ok(true)
  })

  ipcMain.handle(IPC.PRINTER_SEND_RAW, async (_e, payload: { port?: string; tspl: string }) => {
    try {
      if (payload.port) await printer.sendRawToPort(payload.port, payload.tspl)
      else await printer.sendToDefaultPrinter(payload.tspl)
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(IPC.PRINTER_TEST, async (_e, port?: string) => {
    try {
      const tspl = printer.testTspl()
      if (port) await printer.sendRawToPort(port, tspl)
      else await printer.sendToDefaultPrinter(tspl)
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })
}

export function registerSystemIpc(): void {
  ipcMain.handle(IPC.SYSTEM_HEALTH, async () => ok({ online: true }))
  ipcMain.handle(IPC.SYSTEM_INFO, async () => ok({ platform: process.platform }))
}

export function registerAllIpc(): void {
  registerSystemIpc()
  registerAuthIpc()
  registerBarcodeIpc()
  registerPrinterIpc()
}
