# Final teslim özeti

## Tamamlanan ürün

- CSV, JSON ve XML veri alımı ile otomatik alan profili
- Dört kalite kuralı ve önem seviyesine göre kalite puanı
- Sürümlü veri sözleşmesi ve şema farkı
- Referans profil, dağılım drift'i ve değiştirilemez olay geçmişi
- Veri soy ağacı, tıklanabilir grafik ve recursive etki analizi
- Kalıcı kullanıcı tercihleri, sekmeye özel filtre durumu ve Slack bildirimi
- Responsive Vue dashboard, Express API ve SQLite migration/repository katmanı
- Root olmayan Docker imajı, GitHub Actions kalite kapısı ve uçtan uca demo

## Teslim kontrolü

Yerel doğrulama `pnpm verify` ile testleri, üretim derlemesini ve gerçek HTTP üzerinden demo akışını birlikte çalıştırır. Docker kurulmuş ortamda `docker build -t datapulse-guardian .` komutu aynı üretim paketini oluşturur.

Slack gönderiminin çalışması için kanal yöneticisinin oluşturduğu Incoming Webhook adresi `SLACK_WEBHOOK_URL` ortam değişkenine eklenmelidir. Adres yoksa ürün güvenli biçimde açıklayıcı yapılandırma hatası döndürür; gizli değer depoya yazılmaz.
