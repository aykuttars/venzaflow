import { execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { promisify } from 'util'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

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

export async function sendRawToPort(port: string, data: string): Promise<void> {
  const tmp = path.join(os.tmpdir(), `ebarcode-${Date.now()}.tspl`)
  await fs.writeFile(tmp, data, 'utf8')
  try {
    if (process.platform === 'win32') {
      await execFileAsync('cmd', ['/c', `copy /b "${tmp}" \\\\.\\${port}`])
    } else if (existsSync(port)) {
      await execFileAsync('bash', ['-c', `cat "${tmp}" > "${port}"`])
    } else {
      throw new Error(`Port bulunamadı: ${port}`)
    }
  } finally {
    await fs.unlink(tmp).catch(() => undefined)
  }
}

export async function sendToDefaultPrinter(data: string): Promise<void> {
  const tmp = path.join(os.tmpdir(), `ebarcode-${Date.now()}.tspl`)
  await fs.writeFile(tmp, data, 'utf8')
  try {
    if (process.platform === 'win32') {
      await execFileAsync('cmd', ['/c', `copy /b "${tmp}" PRN`])
    } else {
      await execFileAsync('lp', ['-o', 'raw', tmp])
    }
  } finally {
    await fs.unlink(tmp).catch(() => undefined)
  }
}

export function testTspl(): string {
  return 'SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\nCLS\r\nTEXT 20,20,"0",0,1,1,"e-barcode OK"\r\nPRINT 1,1\r\n'
}
