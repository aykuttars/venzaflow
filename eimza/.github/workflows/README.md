# GitHub Actions — eimza derleme

Her push/PR'da ve `v*` tag'lerinde tüm platformlar paralel derlenir.

## Hedefler

| Job | Runner | Çıktı |
|-----|--------|-------|
| macOS arm64 | `macos-latest` | `eimza-*-mac-arm64.dmg` |
| macOS x64 | `macos-latest` | `eimza-*-mac-x64.dmg` |
| Windows x64 | `windows-latest` | `eimza-*-setup-x64.exe` |
| Windows arm64 | `windows-11-arm` | `eimza-*-setup-arm64.exe` |
| Linux x64 | `ubuntu-latest` | `eimza-*-linux-x64.AppImage` |
| Linux arm64 | `ubuntu-24.04-arm` | `eimza-*-linux-arm64.AppImage` |

## Kurulum dosyası indirme

1. GitHub repo → **Actions** → son başarılı workflow
2. **Artifacts** bölümünden ilgili platformu indir (`eimza-win-x64`, `eimza-mac-arm64`, …)

## Sürüm yayınlama

```bash
git tag v1.0.0
git push origin v1.0.0
```

Tag push edildiğinde tüm artifact'lar otomatik olarak **GitHub Release**'e yüklenir.

## Manuel tetikleme

Actions → **Build eimza** → **Run workflow**

## Not

`pkcs11js` native modül olduğu için Windows/Linux kurulumları macOS'ta derlenemez.
Yerel derleme için `./scripts/release.sh` yalnızca bulunduğunuz OS hedeflerini üretir.
