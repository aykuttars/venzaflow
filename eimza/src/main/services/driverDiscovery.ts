import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Pkcs11Driver } from '../../shared/types'

interface DriverDefinition {
  id: string
  name: string
  paths: Partial<Record<NodeJS.Platform, string[]>>
}

const DRIVER_DEFINITIONS: DriverDefinition[] = [
  {
    id: 'akis',
    name: 'AKİS (TÜBİTAK BİLGEM)',
    paths: {
      win32: ['C:\\Windows\\System32\\akisp11.dll', 'C:\\Windows\\SysWOW64\\akisp11.dll'],
      darwin: [
        '/usr/local/lib/libakisp11.dylib',
        '/Library/OpenSC/lib/libakisp11.dylib',
        join(homedir(), 'lib/libakisp11.dylib')
      ],
      linux: [
        '/usr/lib/libakisp11.so',
        '/usr/local/lib/libakisp11.so',
        '/usr/lib/x86_64-linux-gnu/libakisp11.so'
      ]
    }
  },
  {
    id: 'etoken',
    name: 'SafeNet eToken',
    paths: {
      win32: [
        'C:\\Windows\\System32\\eTPKCS11.dll',
        'C:\\Program Files\\SafeNet\\Authentication\\SAC\\x64\\eTPKCS11.dll'
      ],
      darwin: ['/usr/local/lib/libeToken.dylib', '/Library/OpenSC/lib/libeToken.dylib'],
      linux: ['/usr/lib/libeToken.so', '/usr/local/lib/libeToken.so']
    }
  },
  {
    id: 'idprime',
    name: 'Gemalto IDPrime',
    paths: {
      win32: [
        'C:\\Windows\\System32\\IDPrimePKCS11.dll',
        'C:\\Program Files\\Gemalto\\Classic Client\\BIN\\IDPrimePKCS11.dll'
      ],
      darwin: ['/usr/local/lib/libIDPrimePKCS11.dylib'],
      linux: ['/usr/lib/libIDPrimePKCS11.so']
    }
  },
  {
    id: 'bit4id',
    name: 'Bit4id',
    paths: {
      win32: ['C:\\Windows\\System32\\bit4ipki.dll'],
      darwin: ['/usr/local/lib/libbit4ipki.dylib'],
      linux: ['/usr/lib/libbit4ipki.so']
    }
  },
  {
    id: 'opensc',
    name: 'OpenSC (fallback)',
    paths: {
      win32: ['C:\\Program Files\\OpenSC Project\\OpenSC\\pkcs11\\opensc-pkcs11.dll'],
      darwin: [
        // OpenSC ships the module as .so on macOS (not .dylib).
        '/Library/OpenSC/lib/opensc-pkcs11.so',
        '/usr/local/lib/opensc-pkcs11.so',
        '/opt/homebrew/lib/opensc-pkcs11.so',
        '/Library/OpenSC/lib/opensc-pkcs11.dylib',
        '/usr/local/lib/opensc-pkcs11.dylib'
      ],
      linux: [
        '/usr/lib/x86_64-linux-gnu/opensc-pkcs11.so',
        '/usr/lib/opensc-pkcs11.so',
        '/usr/local/lib/opensc-pkcs11.so'
      ]
    }
  }
]

// PKCS#11 libraries shipped *inside* the app (e.g. OpenSC) via electron-builder
// `extraResources`. When present they give users a zero-install experience and
// are preferred over system drivers. AKİS is intentionally NOT bundled here for
// licensing reasons; drop a redistributable lib (OpenSC) into
// `resources/pkcs11/<platform>/` before building to enable this.
const BUNDLED_DRIVER_FILES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ['opensc-pkcs11.dylib'],
  win32: ['opensc-pkcs11.dll'],
  linux: ['opensc-pkcs11.so']
}

function bundledDriverCandidates(platform: NodeJS.Platform): string[] {
  const base = process.resourcesPath
  if (!base) return []
  const files = BUNDLED_DRIVER_FILES[platform] ?? []
  return files.map((file) => join(base, 'pkcs11', platform, file))
}

export function discoverDrivers(platform: NodeJS.Platform = process.platform): Pkcs11Driver[] {
  const found: Pkcs11Driver[] = []

  for (const path of bundledDriverCandidates(platform)) {
    if (existsSync(path)) {
      found.push({
        id: 'bundled',
        name: 'Birlikte gelen sürücü (OpenSC)',
        path,
        platform
      })
      break
    }
  }

  for (const def of DRIVER_DEFINITIONS) {
    const candidates = def.paths[platform] ?? []
    for (const path of candidates) {
      if (existsSync(path)) {
        found.push({
          id: def.id,
          name: def.name,
          path,
          platform
        })
        break
      }
    }
  }

  return found
}

export function createCustomDriver(path: string): Pkcs11Driver {
  return {
    id: 'custom',
    name: 'Özel sürücü',
    path,
    platform: process.platform
  }
}
