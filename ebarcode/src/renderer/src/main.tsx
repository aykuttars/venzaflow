import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

if (typeof __EBARCODE_WEB_DEV__ !== 'undefined' && __EBARCODE_WEB_DEV__) {
  const { installBrowserApiShim } = await import('./dev/browserApiShim')
  installBrowserApiShim()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
