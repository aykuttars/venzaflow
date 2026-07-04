# Venzaflow Envanter ve Barkod Sistemi — Kiracı 4500 Kılavuzu

> **Amaç:** Bu belge, `4500` (Lens Bilişim Teknoloji) demo kiracısı üzerinden envanter yapısını, etiket şablonu atamalarını ve barkod/okutma akışını adım adım anlatır. PDF’e dönüştürmek için ekran görüntüleri eklenebilir (işaretli `[EKRAN GÖRÜNTÜSÜ: …]` alanları).

---

## 1. Genel bakış

Kiracı **4500**, bilgisayar donanımı perakende senaryosunu simüle eder:

| Modül | Rol |
|--------|-----|
| **Ürünler** | SKU, barkod, fiyat, marka vb. |
| **Envanter** | Depolar, konumlar, stok satırları, hareketler |
| **Barkod** | Etiket şablonları, okutma, yazdırma, DEPO→MAGAZA transfer |

**Giriş:** Müşteri kodu `4500`, web: `https://venzaflow.aykut.in`  
**API:** `https://venzaflow-api.aykut.in`

---

## 2. Envanter yapısı (4500)

### 2.1 Depolar

Tipik yapı:

| Kod | Ad | Açıklama |
|-----|-----|----------|
| **DEPO** | Ana depo | Toplu stok, vitrin için kaynak |
| **MAGAZA** | Satış noktası | Vitrin / satış stoku |

**Menü:** Envanter → Depolar sekmesi

`[EKRAN GÖRÜNTÜSÜ: Envanter > Depolar listesi — DEPO ve MAGAZA satırları]`

### 2.2 Konumlar

Her depo altında raf/koridor kodları (ör. `DEPO/A1`, `MAGAZA-VITRIN`).

**Menü:** Envanter → Konumlar

Stok satırları `(ürün + depo + isteğe bağlı konum)` üçlüsüne bağlıdır.

### 2.3 Stok ve hareketler

- **Stok sekmesi:** Ürün × depo × konum bazında `quantity`, `reserved`, `reorder_level`
- **Hareketler:** PURCHASE, SALE, TRANSFER_IN/OUT, ADJUSTMENT vb.

Örnek senaryo — **ACC-EAR-BT** (Kulaklık, barkod `8598765433020`):

1. DEPO’da 12 adet, MAGAZA’da 0 adet
2. Barkod okutulunca sistem “transfer öner” uyarısı gösterir
3. Transfer sonrası MAGAZA stoku artar

---

## 3. Etiket şablonları

### 3.1 Şablon listesi ve tasarım

**Menü:** Barkod → Etiket şablonları

- Kart görünümünde canlı PNG önizleme
- **Tasarla** ile sürükle-bırak editör (metin, EAN13, Code128, QR, logo)
- Varsayılan şablonlar: **Yönetim → Varsayılan şablonları yükle**

`[EKRAN GÖRÜNTÜSÜ: Barkod > şablon kartları grid]`

### 3.2 Şablon çözümleme önceliği (yeni)

Bir ürün için yazdırma/önizlemede hangi şablonun kullanılacağı şu sırayla belirlenir:

```
1. Ürüne atanmış şablon
2. Konuma atanmış şablon
3. Depoya atanmış şablon
4. Kiracı varsayılanı (Barkod > Yönetim)
5. Departmana izin verilen ilk şablon (eski davranış)
```

Hiçbiri tanımlı değilse sistem **mevcut mantığı** kullanmaya devam eder (departman filtresi + listedeki ilk şablon).

### 3.3 Atama noktaları

| Yer | Alan | Açıklama |
|-----|------|----------|
| **Ürün düzenle** | Etiket şablonu | Tek ürün için özel etiket |
| **Envanter → Depo düzenle** | Etiket şablonu | O depodaki tüm ürünler (ürün ataması yoksa) |
| **Envanter → Konum düzenle** | Etiket şablonu | O raftaki operasyonlar için |
| **Barkod → Yönetim** | Varsayılan etiket şablonu | Kiracı geneli yedek |
| **Barkod → Yönetim** | Rol → şablon matrisi | Hangi departman hangi şablonları görebilir |

Boş bırakılan alanlar “varsayılan (otomatik)” anlamına gelir.

---

## 4. Örnek akışlar (4500)

### 4.1 Ürün etiketi önizleme

1. Ürünler listesinde QR simgesine tıklayın veya ürün detayından **Etiket önizleme**
2. Sistem `GET /api/v1/barcode/templates/resolve/?product_id=97` ile şablonu çözer
3. Diyalogda seçili şablon ve kaynak bilgisi görünür (ör. “Ürün şablonu”)

Örnek ürün: **ACC-EAR-BT** — `8598765433020`

`[EKRAN GÖRÜNTÜSÜ: Ürün etiket önizleme diyaloğu]`

### 4.2 Depo bazlı etiket

Senaryo: DEPO çıkış etiketleri büyük, vitrin etiketleri küçük olsun.

1. Envanter → DEPO → Düzenle → **Etiket şablonu:** “Depo 60×40”
2. Envanter → MAGAZA → Düzenle → **Etiket şablonu:** “Vitrin 40×30”
3. Üründe özel şablon **yoksa** okutma/yazdırmada depo bağlamına göre şablon seçilir

### 4.3 Konum bazlı etiket

1. Konum `MAGAZA-VITRIN` için “Vitrin premium” şablonu ata
2. Okutma API’sine `location_id` gönderildiğinde konum şablonu devreye girer (ürün şablonu yoksa)

### 4.4 e-barcode masaüstü uygulaması

1. Giriş: müşteri kodu `4500`
2. **Okuma** sekmesinde barkod okutun
3. Lookup yanıtındaki `suggested_template` ile yazdırma sekmesindeki şablon otomatik seçilir
4. **Yazdır** → TSPL kuyruğu → XP-P328B

`[EKRAN GÖRÜNTÜSÜ: e-barcode Dashboard — okuma sonucu + önerilen şablon]`

---

## 5. API referansı (özet)

### Şablon çözümle

```http
GET /api/v1/barcode/templates/resolve/?product_id=97&warehouse_id=1&location_id=3
Authorization: Bearer …
```

Yanıt:

```json
{
  "template": { "id": 2, "name": "Perakende 40x30", "width_mm": "40.00", "height_mm": "30.00" },
  "source": "product"
}
```

`source` değerleri: `product`, `location`, `warehouse`, `tenant_default`, `fallback`, `none`

### Barkod lookup

```http
GET /api/v1/barcode/lookup/?code=8598765433020
```

Yanıtta ek alanlar:

```json
{
  "product": { … },
  "stock": { "depo_quantity": 12, "magaza_quantity": 0, … },
  "suggest_transfer": true,
  "suggested_template": { "id": 2, "name": "…" },
  "template_source": "fallback"
}
```

---

## 6. Veritabanı alanları

Migration sonrası:

- `product.label_template_id` → FK `label_template`
- `warehouse.label_template_id`
- `location.label_template_id`
- `barcode_settings.default_label_template_id`

---

## 7. Dağıtım notları

Değişikliklerden sonra Docker stack’te:

```bash
cd docker
docker compose build --no-cache api web
docker compose up -d api web
docker compose exec api python manage.py migrate
```

e-barcode Mac build:

```bash
cd ebarcode
npm run build:mac:arm64
```

---

## 8. PDF’e dönüştürme

Bu Markdown dosyasını PDF yapmak için:

- **Pandoc:** `pandoc docs/inventory-barcode-4500-tr.md -o envanter-barkod-4500.pdf`
- **VS Code / Cursor:** Markdown PDF eklentisi
- Ekran görüntülerini `[EKRAN GÖRÜNTÜSÜ: …]` yer tutucularının olduğu bölümlere ekleyin

---

## 9. Sık sorulan sorular

**S: Ürün ve depo için farklı şablon tanımlı — hangisi kazanır?**  
C: Ürün şablonu her zaman önceliklidir.

**S: Hiç şablon atanmadı — ne olur?**  
C: Kiracı varsayılanı → departman izinli ilk şablon (önceki davranış).

**S: 8598765433020 bulunamıyor?**  
C: TR klavye normalizasyonu, güncel API/e-barcode build ve tenant 4500’de ürünün aktif olduğunu doğrulayın.

---

*Son güncelleme: 2026-06 — etiket şablonu atama özelliği*
