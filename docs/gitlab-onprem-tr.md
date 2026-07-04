# GitLab on-prem (Portainer) — e-imza / e-barcode CI

## Güvenlik

Compose içine şifre yazma; `.env` kullan. Bu dokümana veya chat’e düşmüş **root / SMTP şifrelerini hemen değiştir** (GitLab UI + Gmail app password yenile).

## Portainer kurulumu

1. Sunucuda dizinler:
   ```bash
   sudo mkdir -p /home/management/DockerFiles/gitlab/env/{config,logs,data}
   sudo chown -R 1000:1000 /home/management/DockerFiles/gitlab/env/data
   ```
2. `docker/gitlab/.env.example` → sunucuda `.env` olarak kopyala, doldur.
3. `docker/gitlab/docker-compose.yml` → Portainer stack olarak deploy et.
4. İlk açılış **5–10 dk** sürebilir; `docker logs -f gitlab` ile bekle.

## NPM (proxy.aykut.io)

| Alan | Değer |
|------|--------|
| Domain | `git.aykut.io` |
| Scheme | `http://` |
| Forward | `<sunucu-ip>:8929` |
| Websockets | **Açık** |
| SSL | NPM sertifikası (Let’s Encrypt) |

**Advanced** (artifacts registry ile aynı mantık):

```nginx
client_max_body_size 0;
client_body_timeout 3600;
proxy_read_timeout 3600;
proxy_send_timeout 3600;
proxy_connect_timeout 300;
proxy_request_buffering off;
proxy_buffering off;
proxy_http_version 1.1;
```

443’ü container’a map etme — TLS NPM’de kalsın (`8929:80` yeterli).

## GitLab Runner (Linux — ilk adım)

Aynı sunucuda veya ayrı Ubuntu 22.04 VM:

```bash
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner

# GitLab UI → Admin → CI/CD → Runners → New instance runner
# Tag: linux
sudo gitlab-runner register \
  --url https://git.aykut.io \
  --token <RUNNER_TOKEN> \
  --executor shell \
  --description "linux-x64-build" \
  --tag-list "linux,linux-x64"
```

Runner kullanıcısına Node 22 kur (`nvm` veya nodesource). Shell executor ile `electron-builder` Linux build çalışır.

**macOS / Windows** build için ayrı makinede runner register et; tag: `macos`, `windows`.

## Repo ve CI

1. GitLab’da proje oluştur veya GitHub’dan **mirror**:
   - Settings → Repository → Mirroring → Pull from GitHub
2. CI/CD → Variables (masked):
   - `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
   - `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`
3. `.gitlab-ci.yml` eklendiğinde pipeline tetiklenir (henüz repo’da yok — ayrı PR).

## Kaynak taşıma stratejisi

| Seçenek | Açıklama |
|---------|----------|
| **Mirror** | GitHub ana kalır; GitLab sadece CI — düşük risk |
| **Tam taşıma** | Remote’u GitLab yap; GitHub arşiv |

Desktop build için GitLab yeterli; **GitHub Actions dakika limiti** self-hosted runner’da yok.

## Donanım

| Bileşen | Minimum |
|---------|---------|
| GitLab Omnibus | 4 GB RAM (8 GB önerilir) |
| Disk | 20 GB+ (`env/data` büyür) |
| Runner Linux | 2 GB + Node/Electron cache |

## EE vs CE

Compose’da **`gitlab-ce`** pinli sürüm kullanılıyor. `gitlab-ee:latest` lisans ister; EE özelliği (Compliance vb.) yoksa CE yeterli.

## Sonraki adım

Runner hazır olunca repo’ya `.gitlab-ci.yml` eklenir (`ebarcode` + `eimza` matrix, `artifacts.aykut.io` push). İstenirse ayrı commit ile eklenir.
