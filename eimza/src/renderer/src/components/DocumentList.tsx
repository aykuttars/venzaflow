import type { SignTask } from '@shared/types'

interface DocumentListProps {
  tasks: SignTask[]
  loading: boolean
  onSign: (task: SignTask) => void
}

const STATUS_LABELS: Record<SignTask['status'], string> = {
  pending: 'Bekliyor',
  prepared: 'Hazır',
  signed: 'İmzalandı',
  submitted: 'Gönderildi',
  failed: 'Başarısız'
}

export default function DocumentList({
  tasks,
  loading,
  onSign
}: DocumentListProps): React.JSX.Element {
  if (loading) {
    return <div className="empty-state">Görevler yükleniyor...</div>
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <p>İmzalanacak belge bulunamadı.</p>
        <small>Backend&apos;de bekleyen görev oluşturulduğunda burada görünecektir.</small>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Başlık</th>
            <th>Durum</th>
            <th>Tarih</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{task.title}</strong>
                {task.description && <div className="muted">{task.description}</div>}
              </td>
              <td>
                <span className={`badge status-${task.status}`}>{STATUS_LABELS[task.status]}</span>
              </td>
              <td>{new Date(task.createdAt).toLocaleString('tr-TR')}</td>
              <td>
                {task.status === 'pending' || task.status === 'prepared' ? (
                  <button type="button" className="btn primary small" onClick={() => onSign(task)}>
                    İmzala
                  </button>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
