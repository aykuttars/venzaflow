import type { EbarcodeApi } from '../../preload'

declare global {
  interface Window {
    api: EbarcodeApi
  }
}

export {}
