# Günlük çalışma günlüğü

## 31 Ağustos 2026

- Express tabanlı REST API ve sağlık kontrolü oluşturuldu.
- Görev listeleme, ekleme, güncelleme ve silme uçları eklendi.
- Vue 3 ile responsive görev panosu hazırlandı.
- Node test runner ile temel API testleri yazıldı.
- 1-11 Eylül günlük geliştirme planı çıkarıldı.

Sıradaki hedef: SQLite veri katmanı ve migration altyapısı.

## 1 Eylül 2026

- Datateam ürün alanına uygun DataPulse Guardian fikri seçildi ve proje veri kalitesi/etki analizi platformuna dönüştürüldü.
- Node.js'in yerleşik SQLite sürücüsüyle kalıcı RDBMS bağlantısı eklendi.
- Code-first migration ve repository katmanı oluşturuldu.
- Migration işlemleri ACID bütünlüğü için transaction içinde çalışacak şekilde tasarlandı.
- Veri kaynağı, profil çalıştırması ve kalite bulgusu modelleri oluşturuldu.
- Genel kalite puanı, kaynak sağlığı ve öncelikli bulguları gösteren Vue dashboard'u hazırlandı.
- API testleri gerçek SQLite veri kalite katmanını kullanacak biçimde güncellendi.
- 1-11 Eylül hafta içi stand-up taslakları ve geliştirme planı oluşturuldu.
- Doğrulama: 6/6 test geçti, API canlı kontrolü ve Vite üretim derlemesi başarıyla tamamlandı.

Sıradaki hedef: CSV/JSON/XML veri alımı ve otomatik profil çıkarma.

## 3 Eylül 2026

- Veri kaynağına bağlı, sürüm numarası taşıyan veri sözleşmesi ve sözleşme alanları için SQLite migration'ı eklendi.
- Sözleşme oluşturma ile en güncel sözleşmeyi okuma REST uçları uygulandı.
- Ardışık sözleşme sürümlerinde eklenen, silinen, tipi veya zorunluluğu değişen alanların farkı API'den döndürülmeye başlandı.
- Görev ve sözleşme doğrulama hataları kod, mesaj ve isteğe bağlı ayrıntı içeren ortak REST hata biçimine alındı.
- Doğrulama: 8/8 API testi ve üretim derlemesi başarılı; sözleşme farkı kabul ölçütü karşılandı.

Sıradaki hedef: kalite kuralları ve puanlama motoru.
