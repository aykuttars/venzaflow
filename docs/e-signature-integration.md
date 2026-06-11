# e-İmza (signing) modülü — entegrasyon notları

Bu doküman, `signing` modülü + `eimza` masaüstü uygulaması + otorite entegrasyonları
(e-Fatura / e-Arşiv / e-Reçete) çalışması kurulurken alınan **kritik kararları ve
dikkat edilmesi gereken noktaları** tek yerde toplar.

> Mimari özet: **Bağlantı + Yönlendirme** (Connection + Routing). Tenant admin kendi
> entegratör bağlantılarını ve belge yönlendirmelerini yönetir; platform admin her
> tenant için override edebilir. İmza ya masaüstünde (XAdES) ya da entegratörde
> (mali mühür) üretilir.
>
> 🇬🇧 English version: [`e-signature-integration.en.md`](./e-signature-integration.en.md)

---

## 1. Modül kataloğu — tek doğru kaynak backend

- Atanabilir modül listesi backend'de `backend/apps/common/permission_codes.py`
  içinde tanımlıdır (`ALL_MODULES`, `MODULE_LABELS`).
- Frontend bu listeyi `GET /platform/modules/` üzerinden **dinamik** alır
  (`ModuleCatalogService`). Hardcode slug listesi yoktur.
- **Not:** Yeni bir modül eklemek için backend'e eklemek yeterli; platform admin UI
  otomatik olarak görür.

## 2. Login kapısı (module gating) — e-imza olmayan tenant giremez

- `eimza` login isteğinde `required_module: 'signing'` gönderir.
- Backend `LoginView`, tenant'ta modül yoksa `403` + `{ "code": "module_not_enabled" }`
  döner; eimza bunu kullanıcı-dostu mesaja çevirir.
- Ek olarak kullanıcının departmanında **`signing.read` / `signing.write`** izinleri
  olmalıdır:
  - `signing.read` → görevleri görüntüleme.
  - `signing.write` → imzalama, görev oluşturma **ve entegrasyon ayarları sayfası**.

## 3. Sağlık kontrolü (health check)

- Backend `GET /api/v1/health/` ucu vardır.
- `eimza` periyodik olarak kontrol eder (`useSystemHealth` hook) ve sunucuya
  ulaşılamadığında bir banner gösterir (`ConnectionBanner`).
- Login öncesi backend'in ayakta olup olmadığı da bu uçla doğrulanır.

## 4. AKİS / PKCS#11 sürücü kurulumu (eimza, macOS/Windows)

- Build (DMG/EXE) içine yeniden dağıtılabilir PKCS#11 kütüphaneleri **gömülebilir**
  (`eimza/electron-builder.yml` → `extraResources`, `eimza/resources/pkcs11/`).
- Sürücü bulma sırası: önce uygulama içi gömülü adaylar (`bundledDriverCandidates`),
  sonra sistemde bilinen yollar (örn. macOS `/usr/local/lib/libakisp11.dylib`).
- Otomatik bulunamazsa, kullanıcı **kendisi sürücü dosyasını seçebilir**
  (`DriverSetupGuide` bileşeni: platforma özel yönerge + link + tara/gözat).
- **Lisans notu:** AKİS sürücüsü doğrudan gömülemiyorsa kurulum linki + manuel seçim
  yolu devrede kalmalıdır.

## 5. Oturum/cihaz görünürlüğü (web panelde eimza bağlantıları)

- Backend `UserSession` modeli her login oturumunu izler (`client`, `ip_address`,
  `last_seen_at`, `revoked`); JWT içine `jti` gömülür.
- `eimza` her isteğe `X-Client-Id: eimza` ve `X-Client-Version` başlıkları ekler;
  böylece masaüstü bağlantıları tarayıcı oturumlarından **ayrı** görünür.
- Web panelde **Oturumlar** sayfası (`/sessions`) bu oturumları listeler ve
  iptal (revoke) imkânı sunar.
- İmza görevleri **e-İmza** sayfasında (`/signing`) durumlarıyla görünür.

## 6. İmza akışı — XAdES-BES / UBL-TR

- e-Fatura / e-Arşiv belgeleri **UBL-TR 1.2** XML olarak üretilir
  (`apps/signing/services/ubl.py`) ve **XAdES-BES enveloped** imza ile imzalanır
  (`apps/signing/services/xades.py`, iki fazlı: `prepare_xades` + `inject_signature`).
- **Önemli:** XAdES yolu yalnızca **gerçek bir `Invoice`'a bağlı** e-Fatura/e-Arşiv
  görevlerinde devreye girer (`SignTaskViewSet._is_xades`). `eimza`'dan `createSignTask`
  ile açılan manuel görevler eski kanonik payload yolundan gider.
- Satıcı (gönderici) bilgisi tenant'ın **imza profili**nden gelir
  (`TenantSigningProfile` → `supplier_dict`): VKN/TCKN, ünvan, vergi dairesi, adres.

## 7. eimza uygulamasında değişiklik gerekmiyor

`prepare`/`complete` sözleşmesi bayt düzeyinde aynı kaldığı için XAdES/UBL ve
bağlantı+yönlendirme işleri **eimza'da kod değişikliği gerektirmez**:

- `prepare` isteği zaten `certificate_der_base64` gönderir (XAdES bunun için sertifikaya
  ihtiyaç duyar).
- `prepare` yanıtı `task_id`, `data_to_sign_base64`, `algorithm`, `document_type`
  alanlarını döner (eimza tam bunları okur).
- eimza, dönen baytları **format bilmeden** PKCS#11 ile `algorithm` (`SHA256_RSA_PKCS`)
  kullanarak imzalar; bu baytlar artık XAdES `SignedInfo` C14N olabilir.
- `complete` isteği `signature_base64` + `certificate_der_base64` gönderir; backend
  imzayı UBL şablonuna gömer (`inject_signature`) ve otoriteye iletir.
- **İleride dokunulması gereken tek durum:** imza algoritması değişirse (ör. SHA256→SHA512).
  eimza `algorithm`'i sunucudan okuduğu için çoğu durumda otomatik uyum sağlar.

## 8. Bağlantı + Yönlendirme yapılandırması (web panel)

Bir tenant'ın e-imza akışını çalıştırabilmesi için web panelden yapılması gerekenler:

1. **Gönderici kimliği** (imza profili): VKN/TCKN, ünvan, vergi dairesi, adres,
   sertifika tipi.
2. **En az bir entegratör bağlantısı** tanımlama (sağlayıcı, ortam, imza modu,
   kimlik bilgileri).
3. İlgili **belge ailesini** (efatura / earsiv / erecete) o bağlantıya **yönlendirme**.

> Bunlar yapılandırma adımlarıdır — kod değişikliği değildir. Yönlendirme yoksa
> `complete` adımında otoriteye gönderim yapılamaz.

- Tenant ucu: `/api/v1/sign/integration/...`
- Platform override ucu: `/api/v1/platform/tenants/{id}/integration/...`
- Frontend: tenant için `/signing/integration`; platform için
  `/admin/tenants/:id/integration` (aynı bileşen, route param ile mod değiştirir).

### Sertifika tipi ve imza modu

| Kavram | Seçenek | Anlamı |
|--------|---------|--------|
| Sertifika tipi | `personal` | Kişisel e-imza (masaüstü/akıllı kart, XAdES) |
| Sertifika tipi | `mali_muhur` | Kurumsal Mali Mühür |
| İmza modu | `client_xades` | İmza bizde üretilir (XAdES) |
| İmza modu | `provider_seal` | İmza entegratörde üretilir (mali mühür) |

## 9. Kimlik bilgisi güvenliği (credential encryption)

- Entegratör kimlik bilgileri **Fernet** ile şifreli saklanır
  (`apps/common/secretbox.py`).
- Anahtar `AUTHORITY_ENCRYPTION_KEY` ayarından türetilir.
- **Production'da `AUTHORITY_ENCRYPTION_KEY` mutlaka ortam değişkeni olarak set
  edilmelidir** (aksi halde geliştirme anahtarı kullanılır → güvensiz).
- API yanıtlarında sırlar **maskelenir**; form alanı boş bırakılırsa mevcut sır korunur.

## 10. Sağlayıcı kataloğu ve dinamik form

- Sağlayıcı yetenekleri `apps/integrations/authority/providers.py` içinde tanımlı
  (`nilvera`, `uyumsoft`, `izibiz`, `medula`): `supported_families`, `environments`,
  `signing_modes`, `auth_fields`.
- Frontend bağlantı formunu bu katalogdan **dinamik** üretir; sağlayıcı değişince
  alanlar ve seçenekler güncellenir.

## 11. Mock / test davranışı

- Canlı kimlik bilgisi yoksa veya testte, **mock adapter** kullanılır
  (`apps/integrations/authority/mock.py`) — deterministik, kimlik bilgisi gerektirmez.
- Birim testler XAdES round-trip ve entegrasyon yapılandırmasını doğrular
  (`apps/signing/tests.py`). Test komutu:
  `python manage.py test apps.signing.tests` (etiket bazlı keşif yerine modülü hedefleyin).

## 12. Bilinen sınırlamalar / sıradaki işler

- **Medula (e-Reçete)** `test_connection` hâlâ stub; gerçek SOAP el sıkışması bekliyor.
- Nilvera referans entegratör olarak yapılandırıldı; gerçek uçtan uca canlı test için
  tenant'a geçerli kimlik bilgisi + taslak fatura gerekir.
- e-Reçete imza akışı backend'de tanımlı ancak otorite gönderimi sağlayıcıya bağlı.

## 13. Dağıtım (deploy) kontrol listesi

1. Backend migration'ları uygula (`signing` app — `0004_integrationconnection_...`).
2. Tenant'a `signing` modülünü ata (platform admin paneli).
3. Kullanıcı departmanına `signing.read` / `signing.write` ver.
4. `AUTHORITY_ENCRYPTION_KEY` ortam değişkenini set et.
5. Web panelden imza profili + bağlantı + yönlendirme yapılandır.
6. Docker stack'i yeniden build edip ayağa kaldır.

---

## İlgili dosyalar

| Alan | Dosya |
|------|-------|
| Modül kataloğu | `backend/apps/common/permission_codes.py` |
| Login gating / oturum | `backend/apps/accounts/views.py`, `backend/apps/accounts/models.py` |
| XAdES | `backend/apps/signing/services/xades.py` |
| UBL-TR | `backend/apps/signing/services/ubl.py` |
| İmza akışı (views) | `backend/apps/signing/views.py` |
| Yapılandırma modelleri | `backend/apps/signing/models.py` (`TenantSigningProfile`, `IntegrationConnection`, `DocumentRouting`) |
| Entegrasyon uçları | `backend/apps/signing/views_integration.py`, `backend/apps/signing/urls.py` |
| Sağlayıcı kataloğu | `backend/apps/integrations/authority/providers.py` |
| Kimlik şifreleme | `backend/apps/common/secretbox.py` |
| Frontend ayar sayfası | `frontend/src/app/features/signing/signing-integration.component.ts` |
| eimza API client | `eimza/src/main/services/apiClient.ts` |
| eimza imza akışı | `eimza/src/main/services/signingService.ts` |
| Sürücü bulma | `eimza/src/main/services/driverDiscovery.ts` |
