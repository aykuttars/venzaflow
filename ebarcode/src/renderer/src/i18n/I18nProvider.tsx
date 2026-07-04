import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  formatMessage,
  messages,
  normalizeLocale,
  type AppLocale,
  type MessageKey
} from './messages'

interface I18nContextValue {
  locale: AppLocale
  setLocale: (lang: string | undefined) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLocale = 'tr'
}: {
  children: ReactNode
  initialLocale?: AppLocale
}): React.JSX.Element {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale)

  const setLocale = useCallback((lang: string | undefined) => {
    setLocaleState(normalizeLocale(lang))
  }, [])

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      formatMessage(messages[locale][key], params),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
