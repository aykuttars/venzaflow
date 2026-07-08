# Stok — 10 Dakikada Hızlı Başlangıç

**Kimler için?** 1–2 kişilik bilgisayar / teknik servis dükkânları (tenant 4500 profili).

Venzaflow'da stok yönetimi **depo ve vitrin ayrımı zorunlu değildir**. İsterseniz tek bir "Mağaza" deposu ile günler içinde değil, **dakikalar içinde** çalışmaya başlayabilirsiniz.

## 5 adımda ilk satışa hazır olun

1. **Modülleri açın** — `Ürünler`, `Stok`, `Barkod`, `Faturalama` aktif olsun.
2. **Tek depo oluşturun** — Stok → Depolar → Yeni: kod `MAGAZA`, ad "Mağaza".
3. **Ürün ekleyin** — Ürünler → Yeni ürün (SKU, ad, fiyat). Barkod yoksa Barkod sekmesinden otomatik üretin.
4. **Stok girin** — Stok → Yeni: ürün + `MAGAZA` deposu + miktar. **Lokasyon boş bırakılabilir.**
5. **Satış yapın** — Faturalama → fatura oluştur → **Ödendi** işaretleyin. Stok otomatik düşer (ayarlarda açıksa).

## Basit vs gelişmiş

| | Basit (1–2 kişi) | Gelişmiş (perakende) |
|---|---|---|
| Depo sayısı | 1 (MAGAZA) | 2 (DEPO + MAGAZA) |
| Lokasyon / raf | Hayır | Evet (RAF-A, TEZGAH…) |
| Transfer | Gerekmez | DEPO → vitrin transferi |
| Etiket yazdırma | İsteğe bağlı | e-barcode ile rutin |

## Sık yapılan hata

"Depo oluşturmadan stok ekleyemiyorum" — önce en az **bir depo** tanımlayın; lokasyon şart değil.

## Sonraki adım

Daha fazla kontrol için [Gelişmiş stok rehberi](stok-gelismis.md) · [Barkod rehberi](barkod-rehberi.md)
