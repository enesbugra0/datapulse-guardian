# DataPulse Guardian proje notları

DataPulse Guardian, kaynak sistemlerdeki veri kalitesi sorunlarını ve şema değişikliklerini veri ürünlerini etkilemeden önce yakalayan ve etki alanını görünür kılan bir veri gözlem platformudur.

## Çalıştırma

```bash
pnpm install
pnpm dev
```

- Arayüz: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api/health

Ürün Vue 3 istemcisi, Express REST API'si ve migration tabanlı SQLite katmanından oluşur. CSV, JSON ve XML içerikleri ortak profile dönüştürülür; dört kalite kuralı uygulanır ve dağılım değişikliği referans profile göre hesaplanır. Sürümlü veri sözleşmeleri, append-only profil geçmişi, tıklanabilir veri soy ağacı ve recursive etki analizi uçtan uca çalışır. Hata yanıtları `{ error: { code, message } }` biçimindedir.

Başlıca uçlar:

- `POST /api/data-sources/:id/analyze`: içeriği ayrıştırır, profiller, kalite/drift sonucu üretir ve kaydeder.
- `GET /api/data-sources/:id/history`: değiştirilemez profil olaylarını getirir.
- `POST /api/data-sources/:id/baseline`: son profili yeni drift referansı yapar.
- `POST /api/data-sources/:id/contracts`: sözleşme sürümünü kaydeder ve şema farkını döndürür.
- `GET /api/lineage/:id/impact`: blast-radius ve risk puanını hesaplar.

## Komutlar

- `pnpm dev`: API ve Vue geliştirme sunucusunu birlikte başlatır.
- `pnpm test`: REST API testlerini çalıştırır.
- `pnpm build`: Üretim arayüzünü oluşturur.
- `pnpm test:e2e`: Gerçek HTTP üzerinden ürün demo senaryosunu doğrular.
- `pnpm verify`: Test, üretim derlemesi ve uçtan uca demoyu tek kalite kapısında çalıştırır.
- `docker build -t datapulse-guardian .`: Uygulamayı çok aşamalı, root olmayan kullanıcıyla çalışan imaja paketler.
- `docker run -p 3000:3000 datapulse-guardian`: Paketlenmiş API'yi çalıştırır; `/api/health` Docker sağlık kontrolüdür.

Günlük geliştirme hedefleri kök dizindeki `ROADMAP.md`, yapılan işler ise `WORKLOG.md` dosyasında tutulur. Kılavuzdaki terimlerin projedeki karşılığı `docs/CONCEPT_MAP.md` dosyasında izlenir.
