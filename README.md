# Serial Monitor Pro 🚀

[![Release](https://img.shields.io/badge/release-v2.0.0-blue.svg)](https://github.com/metegokhan/esp32-serial-monitor-pro/releases)
[![Rust](https://img.shields.io/badge/rust-2024_edition-orange.svg)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/tauri-v2-yellowgreen.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-lightgrey.svg)](https://github.com/metegokhan/esp32-serial-monitor-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Serial Monitor Pro** is a high-performance, multi-channel serial monitor, real-time comparison canvas, and log analysis workbench engineered in **Rust + Tauri v2 + React 19 + TypeScript**. Built specifically for embedded developers working with ESP32, ESP8266, STM32, Arduino, Raspberry Pi Pico, and general UART devices.

---

## 📸 Screenshots / Ekran Görüntüleri

![Multi-Panel Real-Time Comparison](preview_multipanel.png)
*Multi-Panel Real-Time Comparison Canvas / Çok Kanallı Yan Yana Karşılaştırma Tuvali*

![Simultaneous Line Filtering Across All Panels](preview_filtered.png)
*Simultaneous Line Filtering Across All Panels / Tüm Panellerde Eşzamanlı Satır Süzme*

---

## 🇹🇷 Türkçe Dokümantasyon

### 🌟 Öne Çıkan Özellikler

#### 1. ⚡ Tek Dosya Tıkla-Çalıştır (Sıfır Kurulum)
- **Linux**: Çift tıkla çalışan taşınabilir **AppImage** (`Serial Monitor Pro_2.0.0_amd64.AppImage`), `.deb`, `.rpm` paketleri ve 6 MB bağımsız ikili dosya.
- **Windows**: Tek tıkla çalışan `.exe` ve `.msi` kurulum paketleri (GitHub Actions bulut sunucuları üzerinden otomatik derlenir).
- Python, pip veya harici paket yükleme zorunluluğu yoktur.

#### 2. 🎛️ Eşzamanlı Çoklu Port Bağlantısı & Sınırsız Panel
- **Aynı Anda Birden Fazla Cihaz**: Panel 1 üzerinden `/dev/ttyACM0` (ESP32-S3), Panel 2 üzerinden `/dev/ttyUSB0` (ESP32-CAM), Panel 3 üzerinden arşiv logu gibi sınırsız sayıda oturumu eş zamanlı çalıştırabilirsiniz.
- **Yatay Kaydırılabilir Tuval (Canvas)**: Ekrana sığmayan paneller arasında fare tekerleği (`Shift + Scroll`) veya yatay kaydırma çubuğu ile pürüzsüz gezinebilirsiniz.
- **Serbest Boyutlandırma**: Her panelin genişliği sağ kenarından fareyle sürüklenerek anlık olarak ayarlanabilir.

#### 3. 🛡️ Kesintisiz Bağlantı (Reset Yok) & Donanım Tuşları
- **Kesintisiz Çalışma (Arduino Serial Monitor Davranışı)**: Porta bağlanırken DTR/RTS hatları nötr tutulur; cihazınız resetlenmeden akış devam eder.
- **"Resetle" Tiki**: Doğrudan **"Bağlan"** butonunun hemen yanındadır. İşaretlendiğinde port açılırken donanımsal reset atılarak boot logları yakalanır.
- **EN (Reset)** ve **IO0 (Bootloader)** butonları her panelde bağımsız yer alır.

#### 4. ✏️ Düzenlenebilir Hızlı Komutlar
- Panellerin altındaki komut butonlarına (`help`, `status`, `version`, `reboot`) **çift tıklayarak** istediğiniz komutu yazabilir, `+` butonuyla yeni komut ekleyebilirsiniz. Bağlantı yokken de düzenlenebilir ve tarayıcı hafızasında (`localStorage`) kalıcıdır.

#### 5. 🔍 Çapraz Kelime Vurgulama & Eşzamanlı Süzme
- Herhangi bir paneldeki bir kelimeye tıklandığında:
  - Kelime anında panoya kopyalanır.
  - Açık olan **bütün panellerde** aynı kelime aynı anda altın sarısı parlayarak senkronize vurgulanır.
- **"Sadece Eşleşenleri Göster" (Filter Matching Only)**: Tüm panellerdeki ilgisiz satırları gizleyip sadece aranan kelimeyi içeren satırları yan yana korur.

#### 6. 📍 Gutter Nokta A-B Aralık Seçimi
- Satır başlarına tıklayarak **Nokta A** ve **Nokta B** seçimi yapılabilir, aralık tek tıkla kopyalanabilir veya kaydedilebilir.

#### 7. 📦 Otomatik Arşivleme & "Referans Olarak Aç"
- Oturumlar arka planda `archives/` klasörüne sürekli kaydedilir.
- Arşiv modalından eski oturumlar aranabilir veya tek tıkla dondurulmuş referans paneline aktarılabilir.

#### 8. 🌐 Türkçe ve İngilizce Dil Desteği & Yardım Menüsü
- Üst çubuktan tek tıkla **TR / EN** arasında dinamik geçiş yapılabilir.
- Başlıktaki **(?)** butonu üzerinden genel kullanım kılavuzuna, kısayollara ve GitHub indirme linklerine erişilebilir.

---

### 🚀 Başlatma & Derleme (Türkçe)

#### Linux Hızlı Başlatma:
```bash
git clone https://github.com/metegokhan/esp32-serial-monitor-pro.git
cd esp32-serial-monitor-pro
./run_v2.sh
```

#### Kaynak Koddan Derleme:
```bash
cd v2
pnpm install
pnpm tauri build
```
Çıktılar `v2/src-tauri/target/release/bundle/` altında oluşturulur.

---

## 🇬🇧 English Documentation

### 🌟 Key Features

#### 1. ⚡ Standalone Click-to-Run (Zero Dependencies)
- **Linux**: Portable single-file **AppImage** (`Serial Monitor Pro_2.0.0_amd64.AppImage`), `.deb`, `.rpm`, and 6 MB standalone binary.
- **Windows**: Single-file `.exe` and `.msi` installers automated via GitHub Actions CI.
- No Python runtime or manual library installations required.

#### 2. 🎛️ Concurrent Multi-Port Architecture & Unlimited Panels
- **Simultaneous Multi-Device**: Panel 1 on `/dev/ttyACM0`, Panel 2 on `/dev/ttyUSB0`, Panel 3 on historical log archive, etc.
- **Horizontal Scroll Canvas**: Smoothly pan across arbitrary N-panels using `Shift + Mouse Wheel` or horizontal scrollbar.
- **Freely Resizable**: Drag panel edges to adjust individual widths dynamically.

#### 3. 🛡️ Safe Neutral Connect (No Reset) & Hardware Pins
- **Uninterrupted Monitoring (Arduino IDE Style)**: DTR/RTS lines remain neutral on connect, preventing accidental MCU resets.
- **"Reset on Connect" Tick**: Conveniently placed right beside the Connect button for when bootloader logs are needed.
- **Hardware Reset (EN)** & **Bootloader (IO0)** pulse triggers on each panel.

#### 4. ✏️ Inline Editable Quick Commands
- Double-click any command chip (`help`, `status`, `version`, `reboot`) to edit inline, with automatic local persistence.
- Click `+` to add custom commands. Works whether connected or offline.

#### 5. 🔍 Cross-Panel Synchronized Highlighting & Live Filtering
- Click any token (MAC address, IP, HEX memory, boot flag) to highlight it across all open panels simultaneously and copy to clipboard.
- **"Show Matches Only"**: Simultaneously filters all active panels to display only lines matching the search term side-by-side.

#### 6. 📍 Gutter Point A-B Range Selection
- Click gutter markers to set Point A and Point B, then copy or export the exact slice with one click.

#### 7. 📦 Continuous Session Archiving & Reference Viewer
- Sessions automatically stream to `archives/ESP32_{port}_{timestamp}.log`.
- Open archives as frozen reference panels to compare test runs side by side.

#### 8. 🌐 Dual-Language UI & Help Modal
- Instant toggle between English and Turkish.
- Click the **(?)** help button next to the title to view shortcuts, usage guides, and release links.

---

### 🚀 Running & Building (English)

#### Quick Run on Linux:
```bash
git clone https://github.com/metegokhan/esp32-serial-monitor-pro.git
cd esp32-serial-monitor-pro
./run_v2.sh
```

#### Building from Source:
```bash
cd v2
pnpm install
pnpm tauri build
```
Bundled binaries will be generated inside `v2/src-tauri/target/release/bundle/`.

---

## ⌨️ Shortcuts / Kısayol Tuşları

| Shortcut / Kısayol | Function / İşlev |
|---|---|
| `F5` | ESP32 Hardware Reset (EN pin pulse) |
| `F6` | ESP32 Bootloader Mode (IO0 pin pulse) |
| `Shift + Scroll` | Horizontal canvas navigation / Paneller arası yatay gezinme |
| `Double Click (Chip)` | Edit quick command / Hızlı komutu düzenleme |
| `Ctrl + F` | Global search / Genel arama |

---

## 📂 Version History / Sürüm Geçmişi

- **v2.0 (Current / Mevcut)**: Rust + Tauri v2 + React 19 + TypeScript standalone architecture. Located in `/v2`.
- **v1.0 (Legacy / Eski)**: Python 3 + PyQt6 legacy edition. Preserved in `/v1`.

---

## 📄 License / Lisans

Distributed under the [MIT License](LICENSE).
