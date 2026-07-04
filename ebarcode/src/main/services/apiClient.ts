import type {
  AuthSession,
  BarcodeLookupResult,
  LabelTemplateRow,
  LoginCredentials,
  PrintJobRow,
  SessionSummary
} from '../../shared/types'
import { SESSION_EXPIRED_MESSAGE } from '../../shared/types'
import { clearSession, loadSession, saveSession } from './secureStore'

const DEFAULT_BASE_URL = 'https://venzaflow-api.aykut.in'

class SessionExpiredError extends Error {
  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

function getDefaultBaseUrl(): string {
  return process.env.EBARCODE_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Record<string, unknown>
    if (typeof body.detail === 'string') return body.detail
    return 'İşlem başarısız oldu.'
  } catch {
    return `HTTP ${response.status}`
  }
}

class ApiClient {
  private session: AuthSession | null = null

  getSession(): AuthSession | null {
    return this.session
  }

  toSessionSummary(): SessionSummary | null {
    if (!this.session) return null
    return {
      customerCode: this.session.customerCode,
      email: this.session.email,
      tenantName: this.session.tenantName,
      defaultLanguage: this.session.defaultLanguage
    }
  }

  private baseUrl(): string {
    return (this.session?.apiBaseUrl || getDefaultBaseUrl()).replace(/\/$/, '')
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.session?.accessToken) throw new SessionExpiredError()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.session.accessToken}`)
    headers.set('X-Client-Id', 'ebarcode')
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }
    const res = await fetch(`${this.baseUrl()}/api/v1${path}`, { ...init, headers })
    if (res.status === 401) {
      clearSession()
      this.session = null
      throw new SessionExpiredError()
    }
    if (!res.ok) throw new Error(await parseError(res))
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const base = getDefaultBaseUrl()
    const res = await fetch(`${base}/api/v1/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'ebarcode'
      },
      body: JSON.stringify({
        customer_code: credentials.customerCode,
        email: credentials.email,
        password: credentials.password,
        required_module: 'barcode'
      })
    })
    if (!res.ok) throw new Error(await parseError(res))
    const data = (await res.json()) as Record<string, unknown>
    const access = (data.access as string) || (data.access_token as string)
    if (!access) throw new Error("Token alınamadı.")
    const defaultLanguage =
      typeof data.default_language === 'string' && data.default_language.toLowerCase().startsWith('en')
        ? 'en'
        : 'tr'
    this.session = {
      accessToken: access,
      refreshToken: (data.refresh as string) || undefined,
      customerCode: credentials.customerCode,
      email: credentials.email,
      tenantName: (data.tenant_name as string) || undefined,
      defaultLanguage,
      apiBaseUrl: base
    }
    saveSession(this.session)
    return this.session
  }

  async restoreAndValidateSession(): Promise<AuthSession | null> {
    const stored = loadSession()
    if (!stored?.accessToken) return null
    this.session = stored
    try {
      const me = await this.request<Record<string, unknown>>('/auth/me/')
      const defaultLanguage =
        typeof me.default_language === 'string' && me.default_language.toLowerCase().startsWith('en')
          ? 'en'
          : 'tr'
      this.session = { ...this.session, defaultLanguage }
      saveSession(this.session)
      return this.session
    } catch {
      clearSession()
      this.session = null
      return null
    }
  }

  async logout(): Promise<void> {
    this.session = null
    clearSession()
  }

  lookup(code: string): Promise<BarcodeLookupResult> {
    return this.request(`/barcode/lookup/?code=${encodeURIComponent(code)}`)
  }

  async listQueuedJobs(): Promise<PrintJobRow[]> {
    const res = await this.request<{ results?: PrintJobRow[] } | PrintJobRow[]>(
      '/barcode/print-jobs/'
    )
    const list = Array.isArray(res) ? res : (res.results ?? [])
    return list.filter((j) => j.status === 'queued' || j.status === 'sent')
  }

  jobTspl(jobId: number): Promise<string> {
    return this.request<{ tspl: string }>(`/barcode/print-jobs/${jobId}/tspl/`).then((r) => r.tspl)
  }

  completeJob(jobId: number, status: string, errorMessage = ''): Promise<void> {
    return this.request(`/barcode/print-jobs/${jobId}/complete/`, {
      method: 'POST',
      body: JSON.stringify({ status, error_message: errorMessage })
    })
  }

  createPrintJob(templateId: number, productIds: number[], copies = 1): Promise<PrintJobRow> {
    return this.request('/barcode/print-jobs/', {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, product_ids: productIds, copies })
    })
  }

  async listTemplates(): Promise<LabelTemplateRow[]> {
    const res = await this.request<{ results?: LabelTemplateRow[] } | LabelTemplateRow[]>(
      '/barcode/templates/'
    )
    return Array.isArray(res) ? res : (res.results ?? [])
  }

  getEffectiveSettings(): Promise<Record<string, unknown>> {
    return this.request('/barcode/settings/effective/')
  }

  normalizeScan(code: string): string {
    return code
      .trim()
      .replace(/[İıŞşĞğÜüÖöÇç]/g, (ch) => {
        const map: Record<string, string> = {
          İ: 'I',
          ı: 'i',
          Ş: 'S',
          ş: 's',
          Ğ: 'G',
          ğ: 'g',
          Ü: 'U',
          ü: 'u',
          Ö: 'O',
          ö: 'o',
          Ç: 'C',
          ç: 'c'
        }
        return map[ch] ?? ch
      })
  }

  transfer(items: Array<{ product_id: number; quantity: number }>, note = ''): Promise<unknown> {
    return this.request('/barcode/transfers/', {
      method: 'POST',
      body: JSON.stringify({
        source_warehouse_code: 'DEPO',
        target_warehouse_code: 'MAGAZA',
        note,
        items
      })
    })
  }
}

export const apiClient = new ApiClient()
