import { useEffect, useState } from 'react'

interface DriverSetupGuideProps {
  onRescan: () => void
  onBrowse: () => void
}

// Resmi AKİS / e-imza sürücü indirme sayfası. Tek noktadan güncellenebilir.
const AKIS_DOWNLOAD_URL = 'https://www.kamusm.gov.tr/islemler/surucu_yukleme_servisi'

interface PlatformGuide {
  title: string
  expectedPath: string
  steps: string[]
}

const GUIDES: Record<string, PlatformGuide> = {
  darwin: {
    title: 'macOS için e-imza sürücüsü',
    expectedPath: '/usr/local/lib/libakisp11.dylib',
    steps: [
      'Aşağıdaki butondan TÜBİTAK AKİS macOS sürücüsünü indirin.',
      'İndirdiğiniz .pkg / .dmg dosyasını çalıştırıp kurulumu tamamlayın.',
      'USB token (akıllı kart) cihazınızı takın ve "Tekrar Tara"ya basın.'
    ]
  },
  win32: {
    title: 'Windows için e-imza sürücüsü',
    expectedPath: 'C:\\Windows\\System32\\akisp11.dll',
    steps: [
      'Aşağıdaki butondan TÜBİTAK AKİS Windows sürücüsünü indirin.',
      'Kurulum sihirbazını yönetici olarak çalıştırıp tamamlayın.',
      'USB token cihazınızı takın ve "Tekrar Tara"ya basın.'
    ]
  },
  linux: {
    title: 'Linux (Ubuntu) için e-imza sürücüsü',
    expectedPath: '/usr/lib/libakisp11.so',
    steps: [
      'Terminalde: sudo apt install pcscd pcsc-tools libccid opensc',
      'AKİS paketini indirin (.deb veya .tar içindeki libakisp11.so) ve sudo cp libakisp11.so /usr/lib/ ile kurun.',
      'pcscd servisini başlatın: sudo systemctl enable --now pcscd',
      'Kullanıcınızı scard grubuna ekleyin: sudo usermod -aG scard $USER (çıkış yapıp tekrar girin).',
      'OpenSC tek başına AKİS kartını okumaz — uygulamada AKİS sürücüsünü seçin.',
      'USB okuyucuyu takın ve "Tekrar Tara"ya basın.'
    ]
  }
}

export default function DriverSetupGuide({
  onRescan,
  onBrowse
}: DriverSetupGuideProps): React.JSX.Element {
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    let active = true
    window.api.system
      .getInfo()
      .then((info) => {
        if (active) setPlatform(info.platform)
      })
      .catch(() => {
        if (active) setPlatform('')
      })
    return () => {
      active = false
    }
  }, [])

  const guide = GUIDES[platform] ?? GUIDES.darwin

  return (
    <section className="card setup-guide">
      <div className="setup-guide__head">
        <div className="setup-guide__icon">!</div>
        <div>
          <h2>e-imza sürücüsü bulunamadı</h2>
          <p className="muted">
            İmzalama için akıllı kart (USB token) sürücüsünün kurulu olması gerekir. Aşağıdaki
            adımları izleyin; teknik bir kurulum bilgisine gerek yoktur.
          </p>
        </div>
      </div>

      <h3 className="setup-guide__subtitle">{guide.title}</h3>
      <ol className="setup-guide__steps">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <p className="setup-guide__path">
        Beklenen sürücü konumu: <code>{guide.expectedPath}</code>
      </p>

      <div className="setup-guide__actions">
        <a
          className="btn primary"
          href={AKIS_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
        >
          AKİS Sürücüsünü İndir
        </a>
        <button type="button" className="btn secondary" onClick={onRescan}>
          Tekrar Tara
        </button>
        <button type="button" className="btn ghost" onClick={onBrowse}>
          Sürücüyü Elle Seç
        </button>
      </div>

      <p className="setup-guide__hint muted">
        Sürücüyü zaten kurduysanız token'ı takıp "Tekrar Tara"ya basın. Farklı bir e-imza
        sağlayıcısı kullanıyorsanız "Sürücüyü Elle Seç" ile .dll / .dylib / .so dosyasını
        gösterebilirsiniz.
      </p>
    </section>
  )
}
