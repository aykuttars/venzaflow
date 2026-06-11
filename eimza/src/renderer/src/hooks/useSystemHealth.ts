import { useEffect, useRef, useState } from 'react'

export type HealthState = 'checking' | 'online' | 'offline'

/**
 * Periodically probes backend availability via the main process. Returns the
 * current connectivity state so the UI can warn the user when the system is
 * unreachable while the app is running.
 */
export function useSystemHealth(intervalMs = 15000): HealthState {
  const [state, setState] = useState<HealthState>('checking')
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false

    async function probe(): Promise<void> {
      try {
        const { online } = await window.api.system.checkHealth()
        if (!cancelled.current) setState(online ? 'online' : 'offline')
      } catch {
        if (!cancelled.current) setState('offline')
      }
    }

    void probe()
    const timer = setInterval(() => void probe(), intervalMs)
    return () => {
      cancelled.current = true
      clearInterval(timer)
    }
  }, [intervalMs])

  return state
}
