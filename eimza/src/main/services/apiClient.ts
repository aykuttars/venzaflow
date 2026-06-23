import type {
  AuthSession,
  DocumentType,
  LoginCredentials,
  SessionSummary,
  SignCompleteResponse,
  SignPrepareResponse,
  SignTask
} from '../../shared/types'
import { SESSION_EXPIRED_MESSAGE } from '../../shared/types'
import { clearSession, loadSession, saveSession } from './secureStore'

const DEFAULT_BASE_URL = 'https://venzaflow-api.aykut.in'

export class SessionExpiredError extends Error {
  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

class AuthUnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthUnauthorizedError'
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error instanceof AuthUnauthorizedError || error instanceof SessionExpiredError) {
    return false
  }
  const msg = error.message.toLowerCase()
  return (
    error.name === 'AbortError' ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('socket')
  )
}

function getBaseUrl(): string {
  return process.env.EIMZA_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL
}

function parseTokenPayload(data: Record<string, unknown>): {
  accessToken: string
  refreshToken?: string
} {
  const accessToken =
    (data.access as string) ||
    (data.access_token as string) ||
    (data.token as string) ||
    (data.accessToken as string)

  if (!accessToken) {
    throw new Error("Sunucu yanıtında erişim token'ı bulunamadı.")
  }

  const refreshToken =
    (data.refresh as string) ||
    (data.refresh_token as string) ||
    (data.refreshToken as string) ||
    undefined

  return { accessToken, refreshToken }
}

function formatApiErrorBody(body: Record<string, unknown>): string {
  const detail = body.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    )
    if (messages.length) return messages.join(' ')
  }

  if (typeof body.message === 'string' && body.message.trim()) return body.message
  if (typeof body.error === 'string' && body.error.trim()) return body.error

  const nonField = body.non_field_errors
  if (Array.isArray(nonField)) {
    const messages = nonField.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    )
    if (messages.length) return messages.join(' ')
  }

  const fieldMessages: string[] = []
  for (const [field, value] of Object.entries(body)) {
    if (field === 'detail' || field === 'message' || field === 'error') continue
    if (Array.isArray(value)) {
      const msgs = value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
      if (msgs.length) fieldMessages.push(msgs.join(' '))
    } else if (typeof value === 'string' && value.trim()) {
      fieldMessages.push(value)
    }
  }
  if (fieldMessages.length) return fieldMessages.join(' ')

  return 'İşlem başarısız oldu.'
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Record<string, unknown>
    return formatApiErrorBody(body)
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`
  }
}

class ApiClient {
  private session: AuthSession | null = null
  private refreshPromise: Promise<void> | null = null

  setSession(session: AuthSession | null): void {
    this.session = session
  }

  getSession(): AuthSession | null {
    return this.session
  }

  toSessionSummary(): SessionSummary | null {
    if (!this.session) return null
    return {
      email: this.session.email,
      customerCode: this.session.customerCode,
      firstName: this.session.firstName,
      lastName: this.session.lastName
    }
  }

  private clearInvalidSession(): void {
    this.setSession(null)
    clearSession()
  }

  private headers(includeAuth = true): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'tr',
      'Content-Type': 'application/json',
      // Tags the login session as the e-signature desktop client so tenant
      // admins can see eimza connections separately from browser sessions.
      'X-Client-Id': 'eimza',
      'X-Client-Version': process.env.npm_package_version || '1.0.0'
    }
    if (includeAuth && this.session?.accessToken) {
      headers.Authorization = `Bearer ${this.session.accessToken}`
    }
    return headers
  }

  private mergeHeaders(init?: RequestInit): Record<string, string> {
    const base = this.headers(true)
    if (init?.headers) {
      const extra =
        init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init.headers as Record<string, string>)
      return { ...base, ...extra }
    }
    return base
  }

  async fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await fetch(url, { ...init, headers: this.mergeHeaders(init) })
    } catch (error) {
      throw error
    }

    if (response.status !== 401 || url.includes('/auth/refresh/')) {
      return response
    }

    if (!this.session?.refreshToken) {
      this.clearInvalidSession()
      throw new SessionExpiredError()
    }

    try {
      await this.refreshAccessToken()
    } catch (error) {
      if (isNetworkError(error)) throw error
      this.clearInvalidSession()
      throw new SessionExpiredError()
    }

    const retryResponse = await fetch(url, { ...init, headers: this.mergeHeaders(init) })

    if (retryResponse.status === 401 || retryResponse.status === 403) {
      this.clearInvalidSession()
      throw new SessionExpiredError()
    }

    return retryResponse
  }

  async getMe(): Promise<void> {
    let response: Response
    try {
      response = await fetch(`${getBaseUrl()}/api/v1/auth/me/`, {
        headers: this.headers(true)
      })
    } catch (error) {
      throw error
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthUnauthorizedError()
    }

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const body = (await response.json()) as {
      user?: { first_name?: string; last_name?: string }
    }
    const user = body.user
    if (this.session && user) {
      this.session = {
        ...this.session,
        firstName: user.first_name?.trim() || undefined,
        lastName: user.last_name?.trim() || undefined
      }
      saveSession(this.session)
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.session?.refreshToken) {
      throw new AuthUnauthorizedError()
    }

    if (this.refreshPromise) {
      await this.refreshPromise
      return
    }

    this.refreshPromise = (async () => {
      let response: Response
      try {
        response = await fetch(`${getBaseUrl()}/api/v1/auth/refresh/`, {
          method: 'POST',
          headers: this.headers(false),
          body: JSON.stringify({ refresh: this.session!.refreshToken })
        })
      } catch (error) {
        throw error
      }

      if (!response.ok) {
        throw new AuthUnauthorizedError()
      }

      const data = (await response.json()) as Record<string, unknown>
      const { accessToken, refreshToken } = parseTokenPayload(data)

      this.session = {
        ...this.session!,
        accessToken,
        ...(refreshToken ? { refreshToken } : {})
      }
      saveSession(this.session)
    })()

    try {
      await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }

  async restoreAndValidateSession(): Promise<AuthSession | null> {
    const stored = loadSession()
    if (!stored) return null

    this.setSession(stored)

    try {
      await this.getMe()
      return this.session
    } catch (error) {
      if (isNetworkError(error)) {
        return stored
      }

      if (!(error instanceof AuthUnauthorizedError)) {
        return stored
      }
    }

    try {
      await this.refreshAccessToken()
      await this.getMe()
      return this.session
    } catch (error) {
      if (isNetworkError(error)) {
        return stored
      }
      this.clearInvalidSession()
      return null
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.session?.refreshToken
    if (refreshToken) {
      try {
        await fetch(`${getBaseUrl()}/api/v1/auth/logout/`, {
          method: 'POST',
          headers: this.headers(true),
          body: JSON.stringify({ refresh: refreshToken })
        })
      } catch {
        // Best-effort server logout; always clear local session.
      }
    }
    this.clearInvalidSession()
  }

  async checkHealth(timeoutMs = 5000): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${getBaseUrl()}/api/v1/health/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })
      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await fetch(`${getBaseUrl()}/api/v1/auth/login/`, {
      method: 'POST',
      headers: this.headers(false),
      body: JSON.stringify({
        customer_code: credentials.customerCode,
        email: credentials.email,
        password: credentials.password,
        // Reject tenants that lack the e-signature subscription at login.
        required_module: 'signing'
      })
    })

    if (!response.ok) {
      if (response.status === 403) {
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as { code?: string } | null
        if (body?.code === 'module_not_enabled') {
          throw new Error(
            'Bu hesabın e-imza modülü bulunmuyor. Lütfen hizmet sağlayıcınızla iletişime geçin.'
          )
        }
      }
      throw new Error(await parseError(response))
    }

    const data = (await response.json()) as Record<string, unknown>
    const { accessToken, refreshToken } = parseTokenPayload(data)

    this.session = {
      accessToken,
      refreshToken,
      customerCode: credentials.customerCode,
      email: credentials.email
    }

    await this.getMe()
    return this.session
  }

  async listSignTasks(documentType: DocumentType): Promise<SignTask[]> {
    const response = await this.fetchWithAuth(
      `${getBaseUrl()}/api/v1/sign/tasks/?document_type=${documentType}`
    )

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const data = (await response.json()) as unknown
    const items = Array.isArray(data) ? data : ((data as { results?: unknown[] }).results ?? [])

    return items.map(normalizeSignTask)
  }

  async prepareSignTask(
    taskId: string,
    certificateDerBase64: string
  ): Promise<SignPrepareResponse> {
    const response = await this.fetchWithAuth(
      `${getBaseUrl()}/api/v1/sign/tasks/${taskId}/prepare/`,
      {
        method: 'POST',
        body: JSON.stringify({
          certificate_der_base64: certificateDerBase64
        })
      }
    )

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      taskId: String(data.task_id ?? data.id ?? taskId),
      dataToSignBase64: String(
        data.data_to_sign_base64 ?? data.digest_base64 ?? data.payload_base64 ?? ''
      ),
      algorithm: String(data.algorithm ?? 'SHA256_RSA_PKCS'),
      documentType: (data.document_type as DocumentType) ?? 'efatura'
    }
  }

  async completeSignTask(
    taskId: string,
    signatureBase64: string,
    certificateDerBase64: string
  ): Promise<SignCompleteResponse> {
    const response = await this.fetchWithAuth(
      `${getBaseUrl()}/api/v1/sign/tasks/${taskId}/complete/`,
      {
        method: 'POST',
        body: JSON.stringify({
          signature_base64: signatureBase64,
          certificate_der_base64: certificateDerBase64
        })
      }
    )

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      taskId: String(data.task_id ?? data.id ?? taskId),
      status: String(data.status ?? 'submitted'),
      message: data.message ? String(data.message) : undefined,
      externalReference: data.external_reference
        ? String(data.external_reference)
        : data.reference
          ? String(data.reference)
          : undefined
    }
  }

  async createSignTask(
    documentType: DocumentType,
    certificateDerBase64: string,
    metadata?: Record<string, string>
  ): Promise<SignPrepareResponse> {
    const response = await this.fetchWithAuth(`${getBaseUrl()}/api/v1/sign/tasks/`, {
      method: 'POST',
      body: JSON.stringify({
        document_type: documentType,
        certificate_der_base64: certificateDerBase64,
        metadata
      })
    })

    if (!response.ok) {
      throw new Error(await parseError(response))
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      taskId: String(data.task_id ?? data.id ?? ''),
      dataToSignBase64: String(
        data.data_to_sign_base64 ?? data.digest_base64 ?? data.payload_base64 ?? ''
      ),
      algorithm: String(data.algorithm ?? 'SHA256_RSA_PKCS'),
      documentType
    }
  }
}

function normalizeSignTask(raw: unknown): SignTask {
  const item = raw as Record<string, unknown>
  return {
    id: String(item.id ?? item.task_id ?? ''),
    documentType: (item.document_type as DocumentType) ?? 'efatura',
    title: String(item.title ?? item.name ?? `Görev ${item.id ?? ''}`),
    description: item.description ? String(item.description) : undefined,
    status: (item.status as SignTask['status']) ?? 'pending',
    createdAt: String(item.created_at ?? item.createdAt ?? new Date().toISOString()),
    metadata: item.metadata as Record<string, string> | undefined
  }
}

export const apiClient = new ApiClient()
