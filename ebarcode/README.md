# Venzaflow e-barcode

e-imza uygulamasından **ayrı** bir Electron masaüstü köprüsü. Termal yazıcı (XP-P328B / TSPL) ve barkod okuyucu (Netum F-18w HID) senaryolarının tamamını buradan yönetebilirsiniz.

## e-imza ile aynı mimari

| e-imza | e-barcode |
|--------|----------|
| PKCS#11 / USB token | TSPL → COM/USB yazıcı |
| `window.api.auth` | Aynı oturum deseni |
| `secureStore` | Session + yazıcı ayarları |
| Dashboard | Okuma / Yazdırma / Ayarlar |

## Özellikler

- **Giriş** — `required_module: barcode`, tenant 4500 pilot
- **Okuma** — HID barkod okuyucu, lookup API, DEPO/MAGAZA stok
- **Etiket yazdır** — scan sonrası şablon seç + PrintJob + otomatik TSPL gönderimi
- **Transfer** — DEPO → MAGAZA (1 adet, scan sonrası öneri)
- **Yazdırma kuyruğu** — web’den oluşturulan job’ları işle
- **Yazıcı ayarları** — COM port, test etiketi, otomatik poll
- **Okuyucu kurulum** — Netum HID rehberi

## Geliştirme

**API her zaman remote** (production). Local sadece uygulama arayüzü çalışır.

### Mac / Windows (Electron — yazıcı + okuyucu)

```bash
cd ebarcode
npm install
npm run dev
```

`.env.development` varsayılan: `EBARCODE_API_BASE_URL=https://venzaflow-api.aykut.in`

### Headless VM veya sadece UI testi (tarayıcı)

Electron GUI için ekran gerekir (`Missing X server`). VM’de veya sadece login/UI denemek için:

```bash
npm run dev:web
# http://localhost:5173 — API proxy ile production’a gider
```

Yazıcı/okuyucu bu modda çalışmaz; tam test için Mac’te `npm run dev` veya kurulu `.app` kullanın.

## Release (e-imza ile aynı hatt)

```bash
npm run build              # typecheck + bundle
npm run build:linux:x64    # tek platform
npm run release            # mevcut OS için tüm arch'lar
npm run release:clean      # release/ temizleyerek
```

CI: `.github/workflows/ebarcode-build.yml` — 6 platform, merge sonrası `artifacts.aykut.io/venzaflow/ebarcode` registry'sine ORAS + cosign ile publish.

Tag `v1.0.0` push → GitHub Release oluşturulur.

## Pilot (4500 — Lens Bilisim Teknoloji)

- Tenant: `4500`
- Kullanıcı: `depo@lens.local` veya `yonetici@lens.local`
- API: production veya `http://localhost:8000`

## Windows Bluetooth

Xprinter Bluetooth Port Tool ile SPP → COM atayın; Ayarlar sekmesinden COM seçin.
