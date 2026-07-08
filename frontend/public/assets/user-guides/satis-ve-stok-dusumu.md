# Satış ve Stok Düşümü

Stok miktarı **ne zaman** azalır? Modül ayarlarına göre üç yol vardır.

## 1. Fatura ile otomatik (önerilen)

- Barkod → Yönetim → **Satışta stok düşümü**: `on_invoice` veya `both`
- Faturalama → fatura **Ödendi** → `MAGAZA` deposundan `SALE` hareketi

Tek kişilik dükkân: sadece `MAGAZA` deposu yeterli.

## 2. Manuel tarama onayı

- Ayar: `on_manual_confirm` veya `both`
- Barkod → Scan → ürün bulundu → **Manuel stok düş**

Kasa önü hızlı satış için; fatura kesmeden stok düşer.

## 3. Kapalı

- `off` — stok yalnızca hareketler / manuel düzenleme ile güncellenir

## Karşılaştırma

| Yöntem | Artı | Eksi |
|---|---|---|
| Fatura | Muhasebe ile uyumlu | Fatura adımı gerekir |
| Manuel scan | En hızlı | Fatura ayrı kesilmeli |
| Kapalı | Tam kontrol | Otomasyon yok |

## Sık sorular

**Neden stok düşmedi?** Depoda `MAGAZA` kodlu depo ve yeterli miktar var mı? Düşüm modu açık mı?

**DEPO'dan mı düşer?** Hayır — satış stoku varsayılan olarak **MAGAZA** (vitrin) deposundan düşer.
