# Barkod Rehberi — Tarama, Etiket, e-barcode

## Okuyucu kurulumu

USB barkod okuyucular **klavye (HID)** modunda çalışır. Barkod → Scan sekmesinde imleç aktifken tarayın; Enter ile arama yapılır.

## İlk etiketiniz — 5 dakika

1. Barkod → Yönetim → varsayılan şablonları yükleyin.
2. Ürünler listesinde barkodu olmayan ürünler için **Barkod üret**.
3. Barkod → Yazdır → ürünü tarayın → kuyruğa ekle veya anında yazdır.

## Yazdırma modları

| Mod | Ne zaman? |
|---|---|
| `queue_only` | e-barcode uygulaması kuyruğu işler |
| `immediate` | Web'den doğrudan TSPL |
| `both` | Her iki yol açık (varsayılan) |

## Bilinmeyen barkod (scan-miss)

Okunan kod sistemde yoksa sihirbaz açılır: mevcut ürüne bağla **veya** yeni ürün oluştur.

## e-barcode masaüstü uygulaması

1. Barkod modülünden **İndir** (Windows/macOS).
2. Giriş yapın (tenant kullanıcısı, `barcode.scan` yetkisi).
3. Yazıcı profili: XP-P328B veya TSPL uyumlu termal yazıcı.
4. Kuyruk modunda yazdırma işleri otomatik işlenir.

## Servis fişi etiketi (teknik servis)

Servis → kayıt detayı → **print-intake**: servis kabul etiketi kuyruğa eklenir.

## İpuçları

- DEPO'da stok var, vitrinde yok → tarama paneli transfer önerir.
- Etiket tasarımında `label.print_date` bağlamasını kullanın.
