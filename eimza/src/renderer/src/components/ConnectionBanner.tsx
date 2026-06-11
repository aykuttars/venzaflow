import { useSystemHealth } from '../hooks/useSystemHealth'

/**
 * Fixed banner shown only while the backend is unreachable. Stays out of the
 * way when the system is healthy.
 */
export default function ConnectionBanner(): React.JSX.Element | null {
  const health = useSystemHealth()

  if (health !== 'offline') return null

  return (
    <div className="connection-banner" role="alert">
      <span className="connection-banner__dot" />
      Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin; sistem yeniden erişilebilir
      olduğunda bu uyarı kaybolacaktır.
    </div>
  )
}
