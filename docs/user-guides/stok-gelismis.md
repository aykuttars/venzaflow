# Stok — Gelişmiş Kullanım (DEPO + Mağaza)

Perakende ve stok yoğun işletmeler için **arka depo + satış vitrini** modeli.

## Depo yapısı

- **DEPO** — Ana depo, toplu alım, raf lokasyonları (`RAF-A`, `RAF-B`…)
- **MAGAZA** — Tezgah önü / vitrin; satış stoku buradan düşer

Stok kaydı: ürün × depo × (isteğe bağlı lokasyon). Mağaza stokunda lokasyon genelde boştur.

## Günlük akış

1. **Mal kabul** — Stok hareketi `PURCHASE` veya stok satırına miktar girişi (DEPO).
2. **Vitrine çıkarma** — Barkod → Transfer sekmesi: DEPO → MAGAZA (okuyucu ile tarayarak).
3. **Satış** — Fatura ödendiğinde MAGAZA'dan otomatik düşüm veya barkod taramada manuel onay.
4. **Sayım** — Stok hareketleri ile fark düzeltme (`ADJUSTMENT`).

## CSV / Excel

Stok listesinden dışa aktar → düzenle → içe aktar. Toplu açılış stoku için idealdir.

## e-barcode masaüstü

Termal etiket ve hızlı transfer için [Barkod rehberi](barkod-rehberi.md) bölümüne bakın.
