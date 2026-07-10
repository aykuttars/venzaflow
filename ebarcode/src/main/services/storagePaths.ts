import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

/**
 * App data layout (same structure on every platform):
 *   Windows: %APPDATA%\ebarcode\{secure,spool,logs}
 *   macOS:   ~/Library/Application Support/ebarcode/{secure,spool,logs}
 *   Linux:   ~/.config/ebarcode/{secure,spool,logs}
 */
function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function appDataDir(): string {
  return ensureDir(app.getPath('userData'))
}

/** TSPL spool files waiting to be sent to the printer. */
export function spoolDir(): string {
  return ensureDir(path.join(appDataDir(), 'spool'))
}

/** Plain-text operational logs (printer.log). */
export function logsDir(): string {
  return ensureDir(path.join(appDataDir(), 'logs'))
}
