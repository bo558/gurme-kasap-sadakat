# Gurme Kart — Gurme Kasap Burger sadakat uygulaması demosu

**Canlı demo:** https://bo558.github.io/gurme-kasap-sadakat/ · Müşteri `#/app` · Kasa `#/kasa` · Yönetim `#/yonetim`

> **Bu bir tasarım prototipidir, gerçek Gurme Kasap Burger uygulaması değildir.**
> Sunucu, veritabanı, SMS veya kasa bağlantısı yoktur. Girilen bilgiler hiçbir yere gönderilmez; yalnızca kullandığınız tarayıcının yerel deposunda (localStorage) tutulur. Tüm müşteri, personel ve işlem kayıtları uydurma örnek verilerdir.

## Program (demo varsayımı)

Sipariş başına 1 damga · 10 damga = 1 Burger Menü · ödül 90 gün geçerli · damgalar süresiz · hoş geldin damgası yok · aynı müşteriye 120 dk içinde ikinci damga verilmez · ödül tek kullanımlık.

**Bu koşullar Gurme Kasap Burger tarafından onaylanmış kampanya koşulları değildir.** Damga sayısı ve ödül adı yönetim panelinden değiştirilebilir; diğerleri `src/data/defaults.ts` içinde sabittir.

## Ekranlar (5)

| Adres | Ekran | Ne yapılır |
|---|---|---|
| `#/app` | **Giriş** | Telefon → SMS kodu (demo: `123456`) → ad + KVKK onayı. Kayıtlı numara ad sormadan karta gider. |
| `#/app` | **Kartım** | Damga kartı ve QR kod tek ekranda. Ödül hazırsa aynı ekranda görünür; kasada aynı QR okutulur. |
| `#/app` | **Hesap** (alt panel) | Program kuralları, KVKK metni, çıkış, hesabı silme. |
| `#/kasa` | **Kasa** | PIN ile giriş → QR okut ya da 6 haneli yedek kodu gir → tek butonla **+1 damga** ya da **Ödülü kullan** → 10 sn "Geri al" → ekran yeni müşteriye hazır. |
| `#/yonetim` | **Yönetim** (yalnızca yönetici) | Müşteri arama ve gerekçeli damga düzeltme, personel ekleme/erişim kapatma, program ayarı, işlem kaydı. |

Demo PIN'leri: Murat A. `1111`, Elif S. `2222` (kasa personeli), Deniz Y. `9999` (yönetici). Okan B. `3333` erişimi kapalı örnek personeldir.

## Korunan kontroller

- **Tek QR, dakikada bir değişir.** Kasa yalnızca güncel (ya da bir önceki dakikanın) kodunu kabul eder.
- **Tekrar damga engeli:** aynı müşteriye 120 dk içinde ikinci damga verilmez.
- **Ödül tek kullanımlık:** kullanılan ödül ikinci kez kullanılamaz; süresi dolan ödül kullanılamaz.
- **Geri alma:** kasada yalnızca 10 sn içinde. Kartı dolduran damga geri alınırsa açılan ödül de iptal olur. Sonraki düzeltmeleri yalnızca yönetici, gerekçe seçerek yapar.
- **İşlem kaydı:** her damga, geri alma, ödül kullanımı, düzeltme, program ve personel değişikliği kim/ne zaman bilgisiyle kaydedilir.

### Demoda gerçekten çalışmayanlar

Bu kontroller demoda **tarayıcıda** çalışır ve tek başına güvenlik sağlamaz. Gerçek sürümde sunucuda yapılmalıdır.

- QR kodu basit bir özetle üretilir; gerçek sürümde sunucunun gizli anahtarıyla imzalanmalıdır.
- PIN'ler tarayıcıda düz metin tutulur ve giriş ekranında yazılıdır.
- SMS gönderilmez; kod her zaman `123456`'dır.
- **Kasada kamera bağlı değildir**; "kameraya gösterilen QR" listesi okutmayı canlandırır. Yedek kod girişi gerçekten çalışır.
- **Veri cihazlar arasında paylaşılmaz**; müşteri uygulamasını ve kasayı aynı tarayıcıda iki sekmede açın.

## Yerelde çalıştırma

Node.js 20 veya üzeri gerekir.

```
npm install
npm run dev
```

Windows'ta `baslat.cmd` de kullanılabilir: http://127.0.0.1:5175/ (diğer yerel demolarla çakışmaması için 5175). Derleme: `npm run build` (çıktı `dist/`, göreli yollarla herhangi bir alt dizinden sunulabilir).

## Teknoloji

React · TypeScript · Vite · Tailwind CSS · `qrcode` · `lucide-react`. Yazı tipleri (Fraunces, Manrope, Caveat — markanın web sitesinde kullanılanlar) Google Fonts üzerinden yüklenir.

## Haklar

Logo, Özen Kasap amblemi ve burger fotoğrafı Gurme Kasap Burger'a (gurmeburgerkasap.com, @gurme.kasap.burger) aittir; yalnızca bu sunum demosunda kullanılmıştır ve **kullanım izni henüz doğrulanmamıştır**. Bu depodaki kod için açık kaynak lisansı verilmemiştir; tüm hakları saklıdır.
