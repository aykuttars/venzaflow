import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AuthSession, PrinterSettings } from '../../shared/types'

const SESSION_FILE = 'session.dat'
const PRINTER_FILE = 'printer.dat'

function getStoreDir(): string {
  const dir = join(app.getPath('userData'), 'secure')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function encrypt(value: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(value, 'utf8')
  return safeStorage.encryptString(value)
}

function decrypt(data: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) return data.toString('utf8')
  return safeStorage.decryptString(data)
}

function readJson<T>(file: string): T | null {
  const path = join(getStoreDir(), file)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(decrypt(readFileSync(path))) as T
  } catch {
    return null
  }
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(join(getStoreDir(), file), encrypt(JSON.stringify(value)))
}

export function saveSession(session: AuthSession): void {
  writeJson(SESSION_FILE, session)
}

export function loadSession(): AuthSession | null {
  return readJson<AuthSession>(SESSION_FILE)
}

export function clearSession(): void {
  writeJson(SESSION_FILE, {})
}

const DEFAULT_PRINTER: PrinterSettings = {
  port: '',
  autoPoll: true,
  pollIntervalSec: 15
}

export function savePrinterSettings(settings: PrinterSettings): void {
  writeJson(PRINTER_FILE, settings)
}

export function loadPrinterSettings(): PrinterSettings {
  return readJson<PrinterSettings>(PRINTER_FILE) ?? { ...DEFAULT_PRINTER }
}
