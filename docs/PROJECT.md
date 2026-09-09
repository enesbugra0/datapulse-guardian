# DataPulse Guardian proje notları

DataPulse Guardian, kaynak sistemlerdeki veri kalitesi sorunlarını ve şema değişikliklerini veri ürünlerini etkilemeden önce yakalayan ve etki alanını görünür kılan bir veri gözlem platformudur.

## Çalıştırma

```bash
pnpm install
pnpm dev
```

- Arayüz: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api/health

İlk sürüm Vue 3 istemcisi, Express 5 REST API'si, migration tabanlı SQLite RDBMS katmanı, veri kaynakları, profil çalıştırmaları, kalite sorunları, sürümlü veri sözleşmeleri ve veri soy ağacından oluşur. `POST /api/data-sources/:id/contracts` yeni bir sözleşmeyi kaydeder ve önceki sürüme göre eklenen, silinen veya değişen alanları döndürür; `GET /api/data-sources/:id/contracts/latest` son sürümü getirir. `GET /api/lineage/:id/impact`, bağımlılık grafiğini döngüye girmeden tarar; etkilenen bileşenleri, blast-radius değerini ve risk puanını döndürür. Hata yanıtları `{ error: { code, message } }` biçimindedir.

## Komutlar

- `pnpm dev`: API ve Vue geliştirme sunucusunu birlikte başlatır.
- `pnpm test`: REST API testlerini çalıştırır.
- `pnpm build`: Üretim arayüzünü oluşturur.

Günlük geliştirme hedefleri kök dizindeki `ROADMAP.md`, yapılan işler ise `WORKLOG.md` dosyasında tutulur. Kılavuzdaki terimlerin projedeki karşılığı `docs/CONCEPT_MAP.md` dosyasında izlenir.

## Slack günlük mesajı

Otomasyon mesaj taslağını `updates/YYYY-MM-DD.md` altında oluşturur. Kanal yöneticisinin oluşturduğu Slack Incoming Webhook adresi yerel `.env` dosyasındaki `SLACK_WEBHOOK_URL` değişkenine eklenir. Gizli webhook adresi Git'e eklenmez veya paylaşılmaz.
