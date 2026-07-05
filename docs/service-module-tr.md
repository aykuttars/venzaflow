# Teknik Servis Modülü (MVP)

Tenant **4500** (Lens Bilisim) ve diğer kiracılar için cihaz tamir sürecini uçtan uca takip eden modül.

## Modül kaydı

| Öğe | Değer |
|-----|-------|
| Slug | `service` |
| Menü | Servis / Teknik Servis |
| Üst modül (varsayılan) | `customers` |
| Yetkiler | `service.read`, `service.write` |
| API | `/api/v1/service/tickets/` |

Minimum bağımlılıklar: **`customers`**, **`service`**, **`barcode`** (teslim alma etiketleri için).

## İş akışı

```
Teslim alındı → Teşhis → Onay bekliyor → Tamirde → Teslime hazır → Teslim edildi
                                                      ↘ İptal
```

Geçişler `POST /service/tickets/{id}/transition/` veya özel aksiyonlar (`submit-diagnosis`, `approve-quote`, `deliver`) ile yapılır.

## Web arayüzü

- Rota: `/service`
- Liste, durum filtreleri, metrik kartlar
- **Yeni teslim al:** kayıtlı müşteri veya hızlı ad+telefon; kayıt sonrası otomatik çift etiket yazdırma
- Detay: süreç zaman çizelgesi, teşhis, onay, teslim/tahsilat

## e-barcode

Giriş: tenant **`barcode`** veya **`service`** modülüne sahip olmalı (`required_modules: ["barcode", "service"]`).

**Servis** sekmesi:

| Alt akış | API |
|----------|-----|
| Teslim al | `POST /service/tickets/` + `print_intake` |
| Kayıt ara | `GET /service/tickets/lookup/?q=` |
| Teslim et | `POST /service/tickets/{id}/deliver/` |
| Yeniden yazdır | `POST /service/tickets/{id}/print-intake/` |

Etiketler mevcut yazdırma kuyruğu (`PrintJob`) üzerinden XP-P328B / TSPL ile basılır.

## Yazdırma

`PrintJob` genişletmesi:

- `context_type`: `product` | `service_ticket`
- `context_id`, `context_snapshot`

Varsayılan şablonlar: `service_intake_shop` (servis nüshası), `service_intake_customer` (müşteri nüshası).

**Şablon ataması (web):** Barkod → Yönetim → **Servis teslim etiketleri** bölümünden servis ve müşteri nüshası için ayrı etiket şablonu seçilir. Layout tasarımı Barkod → **Etiket şablonları** sekmesinde yapılır (`ticket.*` bağlama alanları). Atama yapılmazsa sistem varsayılan şablonları kullanılır; her teslim almada **her iki nüsha** basılır.

## Demo tenant 4500

```text
Müşteri kodu: 4500
E-posta: yonetici@lens.local / depo@lens.local
Şifre: X7@qL9#vT2!mZ4$k
```

Seed: `service` + `customers` modülleri, servis yetkileri, 2 etiket şablonu, 3 örnek kayıt.

## Phase 2 (plan dışı)

- Fatura entegrasyonu (`invoice` FK)
- Parça tüketimi / stok hareketi
- SMS bildirimleri, kanban, A4 teslim fişi
