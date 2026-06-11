import { safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AuthSession } from '../../shared/types'

const SESSION_FILE = 'session.dat'
const DRIVER_FILE = 'driver.dat'

function getStoreDir(): string {
  const dir = join(app.getPath('userData'), 'secure')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function encrypt(value: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(value, 'utf8')
  }
  return safeStorage.encryptString(value)
}

function decrypt(data: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return data.toString('utf8')
  }
  return safeStorage.decryptString(data)
}

export function saveSession(session: AuthSession): void {
  const payload = JSON.stringify(session)
  writeFileSync(join(getStoreDir(), SESSION_FILE), encrypt(payload))
}

export function loadSession(): AuthSession | null {
  const filePath = join(getStoreDir(), SESSION_FILE)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath)
    return JSON.parse(decrypt(raw)) as AuthSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  const filePath = join(getStoreDir(), SESSION_FILE)
  if (existsSync(filePath)) {
    writeFileSync(filePath, Buffer.alloc(0))
  }
}

export function saveDriverPath(path: string): void {
  writeFileSync(join(getStoreDir(), DRIVER_FILE), encrypt(path))
}

export function loadDriverPath(): string | null {
  const filePath = join(getStoreDir(), DRIVER_FILE)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath)
    const value = decrypt(raw)
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}
