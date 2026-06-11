import type {
  AuthSession,
  DocumentType,
  LoginCredentials,
  SignCompleteResponse,
  SignPrepareResponse,
  SignTask
} from '../../shared/types'

const DEFAULT_BASE_URL = 'https://tenancysoft-api.aykut.in'

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

  setSession(session: AuthSession | null): void {
    this.session = session
  }

  getSession(): AuthSession | null {
    return this.session
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

    return this.session
  }

  async listSignTasks(documentType: DocumentType): Promise<SignTask[]> {
    const response = await fetch(
      `${getBaseUrl()}/api/v1/sign/tasks/?document_type=${documentType}`,
      { headers: this.headers() }
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
    const response = await fetch(`${getBaseUrl()}/api/v1/sign/tasks/${taskId}/prepare/`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        certificate_der_base64: certificateDerBase64
      })
    })

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
    const response = await fetch(`${getBaseUrl()}/api/v1/sign/tasks/${taskId}/complete/`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        signature_base64: signatureBase64,
        certificate_der_base64: certificateDerBase64
      })
    })

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
    const response = await fetch(`${getBaseUrl()}/api/v1/sign/tasks/`, {
      method: 'POST',
      headers: this.headers(),
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
