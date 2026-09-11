# Mimari ve teknik kararlar

DataPulse Guardian tek depoda çalışan Vue 3 istemcisi, Express REST API'si ve SQLite veri katmanından oluşur. Tarayıcı yalnızca REST uçlarına erişir; veri ayrıştırma, kalite kararı ve drift karşılaştırması sunucuda gerçekleşir.

## Veri akışı

1. Kullanıcı CSV, JSON veya XML içeriğini bir veri kaynağı için gönderir.
2. Ayrıştırıcı içeriği ortak kayıt modeline dönüştürür; profiler alan tipi, eksik değer, benzersizlik ve sayısal dağılım metriklerini çıkarır.
3. Kural motoru zorunlu alan, benzersiz anahtar, tip tutarlılığı ve bütünlük kurallarını uygular.
4. Profil, kaynağın referans profiliyle karşılaştırılır. Eksik değer oranı, ortalama, tip, yeni ve kaldırılan alan değişimleri drift olarak raporlanır.
5. Çalışma, bulgular ve profil olayı tek SQLite transaction'ında kaydedilir. `profile_events` tablosundaki update/delete trigger'ları olay geçmişini append-only tutar.
6. Vue dashboard kalite puanını, geçmişi ve etki grafiğini gösterir.

## Katmanlar ve ilkeler

- Controller sınırı `server/app.js`; doğrulama ve HTTP hata biçimi burada yönetilir.
- Ayrıştırma ve kalite hesapları saf fonksiyonlardan oluşan servis katmanındadır.
- Repository sınıfları kalıcılık ayrıntısını API'den ayırır; bağımlılıklar uygulama kurulurken enjekte edilir. Bu ayrım SOLID içindeki tek sorumluluk ve bağımlılıkların ters çevrilmesi ilkelerini uygular.
- Migration işlemleri ile analiz kaydı ACID transaction'ları kullanır. SQLite RDBMS görevini görür; JSON profil olayları NoSQL belge yaklaşımını ilişkisel kayıtlarla birleştirir.
- Veri soy ağacı, Graph DB kavramlarını düğüm/kenar tablolarıyla modeller. Recursive tarama ziyaret edilen düğüm kümesiyle döngülere karşı korunur.

## Güvenlik ve dağıtım

İstek gövdesi 1 MB ile sınırlıdır; güvenlik başlıkları etkindir ve Express imzası kapalıdır.

Docker imajı çok aşamalı derlenir, üretim bağımlılıklarını taşır ve root olmayan kullanıcıyla çalışır. GitHub Actions kalite kapısı test, üretim derlemesi, uçtan uca demo ve Docker build adımlarını çalıştırır. Aynı adımlar Jenkins pipeline'ına taşınabilir; imaj Kubernetes Deployment/Service olarak Azure Kubernetes Service üzerinde çalıştırılabilir. Kalıcı SQLite kullanımı tek replika içindir; çoklu replika üretim kurulumu için yönetilen PostgreSQL önerilir.

## Kılavuz karşılaştırmaları

- Express/Node.js bu uygulamanın sunucu seçeneğidir; aynı katmanlar .NET Core Web API ile karşılanabilir.
- REST/JSON ana iletişim biçimidir. XML kaynak alımı SOAP sistemlerinden çıkan kayıtları uyumluluk katmanında kabul eder; SOAP envelope çağrısı bu MVP'nin kapsamı değildir.
- Repository/data mapper yaklaşımı ORM sınırını taklit eder; küçük SQLite modeli için ek ORM bağımlılığı eklenmemiştir.
- Git dağıtılmış sürüm kontrolüdür; SVN'in merkezi çalışma modeline göre branch ve CI entegrasyonu bu projede daha uygundur.
