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

## 9 Eylül 2026

- Kaynak, iş hattı, tablo, kural ve dashboard bileşenlerini tutan veri soy ağacı SQLite migration'ı eklendi.
- Değişen bir bileşenden sonraki bağımlılıkları ziyaret edilen düğümlerle güvenli biçimde recursive tarayan etki analizi uygulandı.
- Etkilenen bileşen sayısı blast-radius olarak, önem derecelerine göre de risk puanı ve seviyesi olarak REST API'den döndürülmeye başlandı.
- Etki analizi sonucu Vue dashboard'unda başlangıç bileşeni seçilerek görüntülenebilir hâle getirildi.
- Kabul ölçütü: recursive tarama dört alt bileşeni buluyor; blast-radius ve kritik risk puanı API testinde doğrulandı.
- Doğrulama: `pnpm test` 10/10 geçti, `pnpm build` başarılı.

Sıradaki hedef: kritik bulgular için bildirim, kullanıcı tercihleri ve Docker paketleme.

## 10 Eylül 2026

- Kritik kalite bulgularını kaynak, kural ve alan bilgisiyle Slack'e uygun metne dönüştüren taslak API eklendi; webhook'a otomatik gönderim yapılmadı.
- Bildirim açık/kapalı ve yenileme aralığı tercihleri için SQLite migration'ı ile doğrulamalı REST uçları eklendi; arayüze bildirim tercihi kontrolü yerleştirildi.
- API'ye içerik türü, çerçeveleme, yönlendiren ve içerik güvenlik başlıkları; 32 KB JSON gövde sınırı eklendi.
- Çok aşamalı, yalnızca üretim bağımlılıklarını içeren ve root olmayan kullanıcıyla çalışan Dockerfile ile .dockerignore eklendi.
- Kabul ölçütü: Kritik bulgu taslağı ve tercih kalıcılığı API testleriyle doğrulandı; Docker imajı tanımı hazır, ancak bu çalışma ortamında Docker hizmeti bulunmadığından imaj derlemesi çalıştırılamadı.
- Doğrulama: `pnpm test` 13/13 geçti, `pnpm build` başarılı.

Sıradaki hedef: CI kalite kapısı, uçtan uca demo, mimari notlar ve teslim özeti.

## 11 Eylül 2026

- CSV, JSON ve XML içeriklerini ortak kayıt modeline dönüştüren veri alımı ve otomatik profil çıkarma tamamlandı.
- Zorunlu alan, benzersiz anahtar, tip tutarlılığı ve bütünlük kurallarıyla kalite puanlama motoru uygulandı.
- Referans profile göre eksik değer, ortalama, tip, yeni/kaldırılan alan drift'i ve SQLite trigger'larıyla korunan append-only olay geçmişi eklendi.
- Dashboard'a canlı veri analiz formu, profil geçmişi, referans belirleme ve tıklanabilir SVG veri soy ağacı bağlandı.
- Slack bildiriminin resmi webhook alan adlarına güvenli gönderimi ve eksik yapılandırma hata akışı tamamlandı.
- Express üretim modunda derlenmiş Vue arayüzünü sunacak şekilde düzeltildi; favicon ve responsive erişilebilirlik iyileştirmeleri yapıldı.
- GitHub Actions kalite kapısı, gerçek HTTP tabanlı uçtan uca demo, mimari notlar ve final teslim belgesi eklendi.
- Doğrulama: 19/19 otomatik test, üretim derlemesi ve uçtan uca demo başarılı; açık kritik hata kalmadı.

Proje hedefleri tamamlandı ve final teslimine hazırlandı.
