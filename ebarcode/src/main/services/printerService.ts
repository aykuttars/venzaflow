import { exec, execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { logsDir, spoolDir } from './storagePaths'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const SPOOL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function listSerialPorts(): Promise<string[]> {
  if (process.platform === 'win32') {
    return Array.from({ length: 20 }, (_, i) => `COM${i + 1}`)
  }
  if (process.platform === 'linux') {
    try {
      const dev = readdirSync('/dev')
      return dev
        .filter((n) => n.startsWith('ttyUSB') || n.startsWith('ttyACM'))
        .map((n) => `/dev/${n}`)
    } catch {
      return ['/dev/ttyUSB0']
    }
  }
  return ['/dev/tty.usbserial', '/dev/cu.usbserial']
}

async function appendLog(line: string): Promise<void> {
  const stamp = new Date().toISOString()
  await fs
    .appendFile(path.join(logsDir(), 'printer.log'), `${stamp} ${line}\n`, 'utf8')
    .catch(() => undefined)
}

/** Best-effort removal of week-old spool files (failed jobs are kept for inspection until then). */
async function cleanupSpool(): Promise<void> {
  try {
    const dir = spoolDir()
    const now = Date.now()
    for (const name of await fs.readdir(dir)) {
      const file = path.join(dir, name)
      const info = await fs.stat(file).catch(() => null)
      if (info && now - info.mtimeMs > SPOOL_MAX_AGE_MS) {
        await fs.unlink(file).catch(() => undefined)
      }
    }
  } catch {
    // best effort
  }
}

async function writeSpoolFile(data: string): Promise<string> {
  void cleanupSpool()
  const file = path.join(spoolDir(), `ebarcode-${Date.now()}.tspl`)
  await fs.writeFile(file, data, 'utf8')
  return file
}

/**
 * Windows raw copy to a device. Must go through `exec` (plain cmd string):
 * execFile escapes embedded quotes as \" which cmd.exe cannot parse, producing
 * "Dosya adı, dizin adı veya birim etiketi sözdizimi hatalı".
 */
async function windowsRawCopy(file: string, target: string): Promise<void> {
  await execAsync(`copy /b "${file}" ${target}`, { windowsHide: true })
}

async function dispatch(file: string, port: string | null): Promise<void> {
  if (process.platform === 'win32') {
    if (port) {
      await windowsRawCopy(file, `\\\\.\\${port}`)
      return
    }
    try {
      await windowsRawCopy(file, 'PRN')
    } catch {
      throw new Error(
        'Varsayılan yazıcıya (PRN) erişilemedi. Ayarlar sekmesinden yazıcının COM portunu seçin.'
      )
    }
    return
  }
  if (port) {
    if (!existsSync(port)) throw new Error(`Port bulunamadı: ${port}`)
    await execAsync(`cat "${file}" > "${port}"`)
    return
  }
  await execFileAsync('lp', ['-o', 'raw', file])
}

async function sendSpooled(data: string, port: string | null): Promise<void> {
  const file = await writeSpoolFile(data)
  const label = port ?? 'default'
  try {
    await dispatch(file, port)
    await appendLog(`OK   port=${label} file=${path.basename(file)}`)
    await fs.unlink(file).catch(() => undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await appendLog(`FAIL port=${label} file=${path.basename(file)} error=${message}`)
    throw error
  }
}

export async function sendRawToPort(port: string, data: string): Promise<void> {
  await sendSpooled(data, port)
}

export async function sendToDefaultPrinter(data: string): Promise<void> {
  await sendSpooled(data, null)
}

export function testTspl(): string {
  return 'SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\nCLS\r\nTEXT 20,20,"0",0,1,1,"e-barcode OK"\r\nPRINT 1,1\r\n'
}
