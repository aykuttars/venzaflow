import type { EimzaApi } from './index'

declare global {
  interface Window {
    api: EimzaApi
  }
}

export {}
