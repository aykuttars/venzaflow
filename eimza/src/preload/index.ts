import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  CertificateInfo,
  DocumentType,
  IpcResponse,
  LoginCredentials,
  Pkcs11Driver,
  SelectedCertificate,
  SessionSummary,
  SignCompleteResponse,
  SignPrepareResponse,
  SignTask,
  TokenSlotInfo
} from '../shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResponse<T>
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.data
}

const api = {
  system: {
    checkHealth: () => invoke<{ online: boolean }>(IPC.SYSTEM_HEALTH),
    getInfo: () => invoke<{ platform: NodeJS.Platform }>(IPC.SYSTEM_INFO)
  },
  auth: {
    login: (credentials: LoginCredentials) =>
      invoke<SessionSummary>(IPC.AUTH_LOGIN, credentials),
    logout: () => invoke<boolean>(IPC.AUTH_LOGOUT),
    getSession: () => invoke<SessionSummary | null>(IPC.AUTH_SESSION),
    restoreSession: () => invoke<SessionSummary | null>(IPC.AUTH_RESTORE)
  },
  pkcs11: {
    discoverDrivers: () => invoke<Pkcs11Driver[]>(IPC.PKCS11_DISCOVER_DRIVERS),
    setDriver: (driver: Pkcs11Driver) => invoke<boolean>(IPC.PKCS11_SET_DRIVER, driver),
    browseDriver: () => invoke<Pkcs11Driver | null>('pkcs11:browse-driver'),
    listSlots: () => invoke<TokenSlotInfo[]>(IPC.PKCS11_LIST_SLOTS),
    listCertificates: (slotIndex: number) =>
      invoke<CertificateInfo[]>(IPC.PKCS11_LIST_CERTIFICATES, slotIndex),
    selectCertificate: (cert: SelectedCertificate) =>
      invoke<boolean>(IPC.PKCS11_SELECT_CERTIFICATE, cert),
    getSelectedCertificate: () => invoke<SelectedCertificate | null>(IPC.PKCS11_GET_SELECTED),
    logout: () => invoke<boolean>(IPC.PKCS11_LOGOUT)
  },
  sign: {
    listTasks: (documentType: DocumentType) =>
      invoke<SignTask[]>(IPC.SIGN_LIST_TASKS, documentType),
    prepare: (taskId: string) => invoke<SignPrepareResponse>(IPC.SIGN_PREPARE, taskId),
    execute: (documentType: DocumentType, taskId: string, pin: string) =>
      invoke<SignCompleteResponse>(IPC.SIGN_EXECUTE, { documentType, taskId, pin }),
    complete: (taskId: string, pin: string) =>
      invoke<SignCompleteResponse>(IPC.SIGN_COMPLETE, { taskId, pin }),
    erecete: {
      list: () => invoke<SignTask[]>('sign:erecete-list'),
      sign: (taskId: string, pin: string) =>
        invoke<SignCompleteResponse>('sign:erecete-sign', { taskId, pin })
    },
    efatura: {
      listEarsiv: () => invoke<SignTask[]>('sign:earsiv-list'),
      listEfatura: () => invoke<SignTask[]>('sign:efatura-list'),
      signEarsiv: (taskId: string, pin: string) =>
        invoke<SignCompleteResponse>('sign:earsiv-sign', { taskId, pin }),
      signEfatura: (taskId: string, pin: string) =>
        invoke<SignCompleteResponse>('sign:efatura-sign', { taskId, pin })
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(globalThis as typeof globalThis & { api: typeof api }).api = api
}

export type EimzaApi = typeof api
