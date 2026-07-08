import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface SignPreviewDialogProps {
  taskId: string
  title: string
  onCancel: () => void
  onConfirm: () => void
}

export default function SignPreviewDialog({
  taskId,
  title,
  onCancel,
  onConfirm
}: SignPreviewDialogProps): React.JSX.Element | null {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadPreview(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const content = await window.api.sign.getTaskPreview(taskId)
        if (active) setHtml(content)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Önizleme yüklenemedi')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPreview()
    return () => {
      active = false
    }
  }, [taskId])

  return createPortal(
    <div className="modal-backdrop modal-backdrop--wide" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <div className="modal-head">
          <div>
            <h3>Belge Önizleme</h3>
            <p className="muted">{title}</p>
          </div>
        </div>

        {loading && <div className="preview-state">Belge yükleniyor…</div>}
        {error && <div className="alert error">{error}</div>}
        {!loading && !error && html && (
          <iframe
            className="preview-frame"
            title={`${title} önizleme`}
            sandbox=""
            srcDoc={html}
          />
        )}

        <p className="preview-note">
          İmzalamadan önce belge içeriğini kontrol edin. Onayladıktan sonra e-imza PIN ekranı
          açılacaktır.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            İptal
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onConfirm}
            disabled={loading || Boolean(error)}
          >
            Onayla ve İmzala
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
