import type { EbarcodeApi } from '../../preload'

declare global {
  interface Window {
    api: EbarcodeApi
  }

  const __EBARCODE_WEB_DEV__: boolean | undefined
}

export {}
