import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REMOTE_API = process.env.EBARCODE_API_BASE_URL?.replace(/\/$/, '') || 'https://venzaflow-api.aykut.in'

/** Browser-only dev server — no Electron/GUI required. Proxies API to remote. */
export default defineConfig({
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react()],
  define: {
    __EBARCODE_WEB_DEV__: JSON.stringify(true)
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/v1': {
        target: REMOTE_API,
        changeOrigin: true,
        secure: true
      }
    }
  }
})
