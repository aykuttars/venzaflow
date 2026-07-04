export interface IpcResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

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
  tenantName?: string
  defaultLanguage?: 'tr' | 'en'
  apiBaseUrl: string
}

export interface SessionSummary {
  customerCode: string
  email: string
  tenantName?: string
  defaultLanguage?: 'tr' | 'en'
}

export interface PrinterSettings {
  port: string
  autoPoll: boolean
  pollIntervalSec: number
}

export interface BarcodeLookupResult {
  product: {
    id: number
    sku: string
    name: string
    barcode: string
    unit_price: string
    marka: string
  }
  stock: {
    depo_quantity: number
    magaza_quantity: number
    total_quantity: number
  }
  suggest_transfer: boolean
}

export interface PrintJobRow {
  id: number
  status: string
  template_name: string
  product_ids: number[]
  copies: number
  created_at: string
}

export interface LabelTemplateRow {
  id: number
  name: string
  width_mm: string
  height_mm: string
}

export const SESSION_EXPIRED_MESSAGE = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
