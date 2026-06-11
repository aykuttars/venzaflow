# eimza — Masaüstü İmza Köprüsü

macOS ve Windows üzerinde USB e-imza tokenları ile e-reçete, e-arşiv ve e-fatura imzalama işlemlerini backend API üzerinden yöneten Electron uygulaması.

## Özellikler

- PKCS#11 ile USB e-imza algılama (AKİS, eToken, IDPrime, Bit4id, OpenSC)
- Sertifika listeleme ve seçme
- TenancySoft API ile giriş (`customer_code`, `email`, `password`)
- İnce imza köprüsü: backend ham byte üretir, uygulama token ile imzalar
- e-Reçete, e-Arşiv, e-Fatura sekmeleri

## Gereksinimler

- Node.js 20+
- USB e-imza sürücüsü (ör. AKİS `akisp11.dll` / `libakisp11.dylib`)

## Kurulum

```bash
npm install
cp .env.example .env
npm run dev
```

## Derleme

```bash
npm run build:mac   # macOS dmg
npm run build:win   # Windows nsis installer
```

## API Uçları

| Uç                                       | Açıklama                 |
| ---------------------------------------- | ------------------------ |
| `POST /api/v1/auth/login/`               | Giriş                    |
| `GET /api/v1/sign/tasks/?document_type=` | Bekleyen görevler        |
| `POST /api/v1/sign/tasks/{id}/prepare/`  | İmzalanacak byte'ları al |
| `POST /api/v1/sign/tasks/{id}/complete/` | İmzayı gönder            |

## Güvenlik

- PIN bellekte tutulur, diske yazılmaz
- Özel anahtar token dışına çıkmaz
- API token Electron `safeStorage` ile şifrelenir
- Renderer `contextIsolation` ile izole edilir
