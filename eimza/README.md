# Venzaflow e-imza — Masaüstü İmza Köprüsü

macOS ve Windows üzerinde USB e-imza tokenları ile e-reçete, e-arşiv ve e-fatura imzalama işlemlerini backend API üzerinden yöneten Electron uygulaması.

## Özellikler

- PKCS#11 ile USB e-imza algılama (AKİS, eToken, IDPrime, Bit4id, OpenSC)
- Sertifika listeleme ve seçme
- Venzaflow API ile giriş (`customer_code`, `email`, `password`)
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

Tek mimari:

```bash
npm run build:mac:arm64   # Apple Silicon .dmg
npm run build:mac:x64     # Intel Mac .dmg
npm run build:win:x64     # Windows x64 installer
npm run build:win:arm64   # Windows ARM64 installer
```

Tüm release paketleri (sırayla, mimari başına ayrı dosya):

```bash
npm run release          # macOS'ta: arm64 + x64 dmg + win x64 setup
npm run release:clean    # release/ temizleyip yeniden build
./scripts/release.sh --help
```

**Windows ARM64** (`setup-arm64.exe`) native modül (`pkcs11js`) nedeniyle **macOS'tan build edilemez**.
Windows makinede `npm run build:win:arm64` veya CI (`windows-latest`) kullanın.

## CI ve dağıtım

GitHub Actions (`Build eimza`) tüm platformlarda build alır ve installer'ları private registry'ye push eder (PR hariç):

- Registry: `artifacts.aykut.io/venzaflow/eimza` (CI push, private)
- **Son kullanıcı indirme:** Venzaflow web/API üzerinden — login sayfası `/eimza` veya panel **e-İmza** modülü
- API: `GET /api/v1/sign/eimza/releases/` · `GET /api/v1/sign/eimza/download/{platform}/`
- Sunucu stack: `docker/artifacts-registry/` (Zot + Portainer)
- Tag formatı: `{version}-{platform}-{arch}-{dosya-adı}`
- Branch push: `{branch}-{run}` (ör. `develop-28`)
- Release tag: `1.0.0-...`

**Release (tag):**

```bash
git tag v1.0.0
git push origin v1.0.0
```

CI installer'ları registry'ye push eder; aynı tag için [GitHub Release](https://github.com/venzaflow/venzaflow/releases) de oluşturulur.

**Manuel registry push:** Actions → Build eimza → Run workflow → `version` alanına örn. `1.0.0` yaz.

**İndirme (son kullanıcı):**

- Web: `https://<venzaflow-host>/eimza` — giriş gerekmez, tek tık indir
- Panel: **e-İmza** → **İndir** (modal)

Release tag yoksa son CI build'leri gösterilir; resmi sürüm için `v*` tag kullanın.

**İndirme (geliştirici / ORAS):**

```bash
oras login artifacts.aykut.io
oras pull artifacts.aykut.io/venzaflow/eimza:1.0.0-linux-x64-venzaflow-eimza-1.0.0-linux-x64.AppImage -o .
```

Repo secrets: `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD` (artifacts.aykut.io).

API `.env`: `ARTIFACT_REGISTRY_URL`, `ARTIFACT_REGISTRY_USER`, `ARTIFACT_REGISTRY_PASSWORD`

Installer'lar push sonrası **Cosign** ile imzalanır. Public key kurulumu: `docker/artifacts-registry/scripts/setup-cosign.sh`

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
