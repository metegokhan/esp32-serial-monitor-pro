# ESP32 Serial Capture & Monitor Pro 🚀

ESP32, ESP8266, Arduino ve tüm gömülü sistemler için geliştirilmiş; profesyonel, eş zamanlı çoklu seri bağlantı destekli, donanımsal reset kontrollü ve derinlemesine log analiz aracı.

> ⚡ **Yeni Sürüm v2.0 (Rust + Tauri)**: Python ve harici kütüphane kurulumu gerektirmeyen, tek tıkla çalışan (standalone click-to-run), sınırsız panelli ve sonsuz kaydırılabilir çalışma alanına sahip yeni nesil masaüstü versiyonu yayınlandı!

---

## 📸 Arayüz Önizlemeleri

![3 Panelli Yan Yana Karşılaştırma](preview_multipanel.png)
*Yan Yana Karşılaştırma, Bağımsız Portlar ve Gerçek Zamanlı Analiz*

![Eşzamanlı Satır Filtreleme](preview_filtered.png)
*Eşzamanlı Satır Filtreleme — Tüm Panellerde Sadece İlgili Satırları Gösterme*

---

## 🌟 Versiyon 2.0 (Rust + Tauri) Yeni Nesil Özellikleri

### 🚀 1. Tek Dosya Tıkla-Çalıştır (Zero-Dependency Standalone)
- **Linux**: Çift tıkla çalışan tek dosya **AppImage** (`ESP32 Serial Capture & Monitor Pro_2.0.0_amd64.AppImage`), `.deb`, `.rpm` veya yalnızca **6 MB** boyutundaki ultra hafif derlenmiş ikili dosya.
- **Windows**: Tek dosya `.exe` ve kurulumsuz taşınabilir paket.
- Python, pip veya sistem paketleri yükleme zorunluluğu yoktur.

### 🎛️ 2. Eşzamanlı Çoklu Port Bağlantısı & Sınırsız Panel
- **Aynı Anda Birden Fazla Cihaz**: Panel 1 üzerinden `/dev/ttyACM0` (ESP32-S3), Panel 2 üzerinden `/dev/ttyUSB0` (ESP32-CAM), Panel 3 üzerinden arşiv logu gibi sınırsız sayıda oturumu eş zamanlı çalıştırabilirsiniz.
- **3'ten Fazla Panel Desteği**: Ekrana sığmayan paneller için **yatay kaydırılabilir tuval (horizontal scrollable canvas)**.
- **Serbest Boyutlandırma**: Her panelin genişliği sağ kenarındaki tutamaçtan fareyle sürüklenerek anlık olarak ayarlanabilir.

### 🛡️ 3. Kesintisiz Bağlantı (Arduino Serial Monitor Davranışı)
- **Resetlemeden Bağlan**: Varsayılan olarak porta bağlanırken DTR/RTS hatları nötr tutulur; cihazınız resetlenmeden kesintisiz akmaya devam eder.
- **"Resetle" Tiki**: Doğrudan **"Bağlan"** butonunun hemen yanındaki onay kutusuyla kontrol edilir. İşaretlendiğinde port açılırken donanımsal reset atılarak boot logları yakalanır.
- **Donanımsal Reset (EN)** & **Bootloader (IO0)** butonları her panelde bağımsız olarak yer alır.

### 🔍 4. Çapraz Panel Senkronize Kelime Vurgulama & Arama
- Herhangi bir paneldeki bir kelimeye tıklandığında:
  - Kelime anında panoya kopyalanır.
  - Açık olan **tüm panellerde** ilgili kelime aynı anda altın sarısı parlayarak senkronize vurgulanır.
- **Eşzamanlı Süzme**: Üst arama çubuğundaki *"Sadece Eşleşenleri Göster"* seçeneği, açık olan tüm panellerdeki ilgisiz satırları gizleyip sadece aranan kelimeyi içeren satırları yan yana korur.

### 📍 5. Gutter Nokta A-B Aralık Seçimi
- Satır başlarına tıklayarak **Nokta A** ve **Nokta B** işaretçileri koyabilir, belirlenen aralığı tek tıkla panoya kopyalayabilir veya dosyaya kaydedebilirsiniz.

### 📦 6. Otomatik Arşivleme & Arşiv Yöneticisi
- Açılan her oturum `archives/ESP32_{port}_{zaman}.log` dosyasına sürekli ve arka planda güvenle kaydedilir.
- Arşiv yöneticisi modalından eski oturumlar aranabilir, incelenebilir veya tek tıkla **"Referans Olarak Aç"** denilerek yeni bir panele aktarılabilir.

### 🌐 7. Tam Çift Dilli Arayüz (Türkçe & English)
- Üst menüdeki dil anahtarı ile Türkçe ve İngilizce arasında anında dinamik geçiş.

---

## 💻 Kurulum & Çalıştırma

### 🚀 Yöntem A: v2.0 (Rust + Tauri - Önerilen)

#### Linux Hızlı Başlatma:
```bash
# Projeyi klonlayın
git clone https://github.com/metegokhan/esp32-serial-monitor-pro.git
cd esp32-serial-monitor-pro

# Tek komutla v2'yi çalıştırın:
./run_v2.sh
```

#### Kaynak Koddan Derleme (v2):
```bash
cd v2
pnpm install
pnpm tauri build
```
Derleme sonucu `v2/src-tauri/target/release/bundle/appimage/` altında tek tıkla çalışan `.AppImage` ve deb paketleri oluşturulur.

---

### 🐍 Yöntem B: v1.0 (Python + PyQt6)

#### Gereksinimler:
- Python 3.10+
- `pip install -r requirements.txt`

#### Başlatma:
```bash
./run.sh
# veya
python3 main.py
```

---

## ⌨️ Kısayol Tuşları

| Kısayol | İşlev |
|---|---|
| `F5` | ESP32 Donanımsal Reset (EN Pini) |
| `F6` | ESP32 Bootloader / İndirme Modu (IO0 Pini) |
| `Ctrl + N` | Yeni Panel Ekle |
| `Ctrl + H` | Oturum Arşivleri Yöneticisi |
| `Ctrl + F` | Genel Arama Çubuğuna Odaklan |
| `Shift + Fare Tekerleği` | Paneller Arasında Yatay Gezinme |

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
