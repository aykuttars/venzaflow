export type DocumentType = 'erecete' | 'earsiv' | 'efatura'

export interface LoginCredentials {
  customerCode: string
  email: string
  password: string
}

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  customerCode: string
  email: string
}

export interface Pkcs11Driver {
  id: string
  name: string
  path: string
  platform: NodeJS.Platform
}

export interface TokenSlotInfo {
  slotIndex: number
  label: string
  manufacturer: string
  tokenPresent: boolean
  driverId: string
  driverName: string
}

export interface CertificateInfo {
  id: string
  label: string
  subject: string
  issuer: string
  serialNumber: string
  notBefore?: string
  notAfter?: string
  derBase64: string
  slotIndex: number
  driverId: string
}

export interface SelectedCertificate {
  certificateId: string
  slotIndex: number
  driverId: string
  label: string
  subject: string
}

export interface SignTask {
  id: string
  documentType: DocumentType
  title: string
  description?: string
  status: 'pending' | 'prepared' | 'signed' | 'submitted' | 'failed'
  createdAt: string
  metadata?: Record<string, string>
}

export interface SignPrepareResponse {
  taskId: string
  dataToSignBase64: string
  algorithm: string
  documentType: DocumentType
}

export interface SignCompleteResponse {
  taskId: string
  status: string
  message?: string
  externalReference?: string
}

export interface ApiError {
  message: string
  status?: number
  details?: unknown
}

export interface IpcResult<T> {
  ok: true
  data: T
}

export interface IpcError {
  ok: false
  error: string
}

export type IpcResponse<T> = IpcResult<T> | IpcError
