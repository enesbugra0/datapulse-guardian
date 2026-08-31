# DataPulse Guardian - dengeli teslim planı

Dokuz iş gününün her biri benzer büyüklükte bir geliştirme, test ve dokümantasyon çıktısıyla kapanır. Yeni özellikler son güne yığılmaz; 11 Eylül doğrulama, düzeltme ve teslim günüdür.

| Tarih | Günlük teslim | Gün sonu kabul ölçütü | Kılavuz bağlantısı |
|---|---|---|---|
| 1 Eylül | Ürün iskeleti ve kalite veri modeli | Vue/Express uygulaması açılır; SQLite kaynak, profil ve bulgu modelleri çalışır; temel dashboard veri gösterir | Node.js, ExpressJS, Vue.js, RDBMS, ACID |
| 2 Eylül | Çok formatlı veri alımı ve profil çıkarma | CSV/JSON/XML örnekleri okunur; alan tipi, eksik değer ve tekrar metrikleri API'den döner | HTTP request, JSON, XML, async/await |
| 3 Eylül | Veri sözleşmesi ve şema değişikliği | Sözleşme sürümü kaydedilir; eklenen/silinen/değişen alanlar karşılaştırılır; hatalar standart REST biçimindedir | REST, JSON, XML, code-first |
| 4 Eylül | Kalite kuralı ve puanlama motoru | Dört temel kural çalışır; bulgular önem seviyesine ayrılır; puan hesabı testlerle doğrulanır | DB operations, debugging, SOLID |
| 7 Eylül | Dağılım drift'i ve olay geçmişi | Referans profil saklanır; oran/dağılım değişimi yakalanır; çalışmalar append-only geçmişte izlenir | NoSQL yaklaşımı, promises, await |
| 8 Eylül | Veri soy ağacı ve grafik görünümü | Kaynak-iş-tablo-kural-dashboard ilişkileri API'den gelir ve Vue ekranında gezilebilir | Graph DB kavramı, Vue.js, client-server |
| 9 Eylül | Etki alanı ve önceliklendirme | Recursive bağımlılık taraması etkilenen bileşenleri bulur; blast-radius ve risk puanı üretilir | recursion, data structures, REST |
| 10 Eylül | Bildirim, güvenlik ve paketleme | Kritik bulgu Slack taslağı üretir; kullanıcı tercihleri saklanır; Docker imajı ve güvenlik kontrolleri çalışır | Cookie/storage, Docker, HTTP, SOLID |
| 11 Eylül | CI, uçtan uca doğrulama ve final teslim | CI kalite kapısı geçer; demo senaryosu, proje notları ve teslim özeti tamamlanır; açık kritik hata kalmaz | Git, CI/Jenkins yaklaşımı, Kubernetes/Azure notları |

Hafta sonu geliştirme ve stand-up planlanmaz. Her iş gününde yalnızca o günün teslim dilimi uygulanır; mevcut çalışan davranış korunur, testler çalıştırılır ve sonuç WORKLOG'a yazılır. 11 Eylül sonunda proje çalışır, test edilmiş, Docker ile paketlenebilir ve sunuma hazır olmalıdır.
