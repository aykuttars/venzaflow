/**
 * Browser-only dev shim (npm run dev:web).
 * Electron IPC is unavailable without a display; this talks to remote API via Vite proxy.
 */
import type { EbarcodeApi } from '../../../preload'
import { barcodeLookupCandidates } from '../../../shared/scanNormalize'

const SESSION_KEY = 'ebarcode.webDev.session'

interface StoredSession {
  accessToken: string
  customerCode: string
  email: string
  tenantName?: string
  defaultLanguage?: 'tr' | 'en'
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function saveSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Client-Id', 'ebarcode')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`/api/v1${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function installBrowserApiShim(): void {
  if (typeof window.api !== 'undefined') return

  const api: EbarcodeApi = {
    system: {
      checkHealth: async () => ({ online: true }),
      getInfo: async () => ({ platform: 'darwin' as NodeJS.Platform })
    },
    auth: {
      login: async (credentials: unknown) => {
        const cred = credentials as { customerCode: string; email: string; password: string }
        const data = await apiRequest<Record<string, unknown>>('/auth/login/', {
          method: 'POST',
          body: JSON.stringify({
            customer_code: cred.customerCode,
            email: cred.email,
            password: cred.password,
            required_module: 'barcode'
          })
        })
        const access = (data.access as string) || (data.access_token as string)
        if (!access) throw new Error('Token alınamadı.')
        const defaultLanguage =
          typeof data.default_language === 'string' &&
          data.default_language.toLowerCase().startsWith('en')
            ? 'en'
            : 'tr'
        const session: StoredSession = {
          accessToken: access,
          customerCode: cred.customerCode,
          email: cred.email,
          tenantName: (data.tenant_name as string) || undefined,
          defaultLanguage
        }
        saveSession(session)
        return {
          customerCode: session.customerCode,
          email: session.email,
          tenantName: session.tenantName,
          defaultLanguage: session.defaultLanguage
        }
      },
      logout: async () => {
        clearSession()
        return true
      },
      getSession: async () => {
        const s = loadSession()
        if (!s) return null
        return {
          customerCode: s.customerCode,
          email: s.email,
          tenantName: s.tenantName,
          defaultLanguage: s.defaultLanguage
        }
      },
      restoreSession: async () => {
        const s = loadSession()
        if (!s?.accessToken) return null
        try {
          const me = await apiRequest<Record<string, unknown>>('/auth/me/', {}, s.accessToken)
          const defaultLanguage =
            typeof me.default_language === 'string' &&
            me.default_language.toLowerCase().startsWith('en')
              ? 'en'
              : 'tr'
          saveSession({ ...s, defaultLanguage })
          return {
            customerCode: s.customerCode,
            email: s.email,
            tenantName: s.tenantName,
            defaultLanguage
          }
        } catch {
          clearSession()
          return null
        }
      }
    },
    barcode: {
      lookup: async (code: string) => {
        const s = loadSession()
        if (!s) throw new Error('Oturum yok')
        const candidates = barcodeLookupCandidates(code)
        let lastErr: Error | null = null
        for (const candidate of candidates) {
          try {
            return await apiRequest(
              `/barcode/lookup/?code=${encodeURIComponent(candidate)}`,
              {},
              s.accessToken
            )
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err))
            const msg = lastErr.message.toLowerCase()
            if (!msg.includes('not found') && !msg.includes('404')) throw lastErr
          }
        }
        throw lastErr ?? new Error('Product not found.')
      },
      listJobs: async () => {
        const s = loadSession()
        if (!s) throw new Error('Oturum yok')
        const res = await apiRequest<{ results?: unknown[] } | unknown[]>(
          '/barcode/print-jobs/',
          {},
          s.accessToken
        )
        const list = (Array.isArray(res) ? res : (res.results ?? [])) as Array<{ status?: string }>
        return list.filter((j) => j.status === 'queued' || j.status === 'sent')
      },
      jobTspl: async () => {
        throw new Error('Yazıcı yalnızca Electron uygulamasında kullanılabilir.')
      },
      completeJob: async () => true,
      createJob: async () => {
        throw new Error('Yazdırma yalnızca Electron uygulamasında kullanılabilir.')
      },
      listTemplates: async () => {
        const s = loadSession()
        if (!s) throw new Error('Oturum yok')
        const res = await apiRequest<{ results?: unknown[] } | unknown[]>(
          '/barcode/templates/',
          {},
          s.accessToken
        )
        return Array.isArray(res) ? res : (res.results ?? [])
      },
      transfer: async () => {
        throw new Error('Transfer yalnızca Electron uygulamasında kullanılabilir.')
      },
      effectiveSettings: async () => {
        const s = loadSession()
        if (!s) throw new Error('Oturum yok')
        return apiRequest('/barcode/settings/effective/', {}, s.accessToken)
      }
    },
    printer: {
      listPorts: async () => ['/dev/cu.usbserial (web dev — Electron gerekli)'],
      getSettings: async () => ({ port: '', autoPoll: false, pollIntervalSec: 15 }),
      saveSettings: async () => true,
      sendRaw: async () => {
        throw new Error('Yazıcı yalnızca Electron uygulamasında kullanılabilir.')
      },
      test: async () => {
        throw new Error('Yazıcı yalnızca Electron uygulamasında kullanılabilir.')
      }
    }
  }

  ;(window as Window & { api: EbarcodeApi }).api = api
}
