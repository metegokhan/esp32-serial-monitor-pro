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

#### 8. ☁️ Google Drive Bulut Yedekleme & Senkronizasyon (GDrive)
- **Giriş ve Doğrulama**: Google OAuth token veya API girişi ile doğrudan Google Drive'a bağlanır.
- **Özel Klasör**: Google Drive üzerinde otomatik olarak `ESP32 Serial Monitor Pro` klasörü oluşturulur ve yönetilir.
- **Logları Kaydet**: Panellerdeki loglar, otomatik isimlendirilen başlıklarla doğrudan Google Drive'a yüklenir.
- **Filtre Setleri ve Ayarları Yedekle**: Tüm etiketler, değişken filtre kuralları, font ve donanım ayarları tek tıkla buluta yedeklenir ve başka bir bilgisayarda anında geri yüklenebilir.
- **Referans Olarak Aç**: Google Drive'daki eski log dosyaları doğrudan referans tuvalinde açılabilir.

#### 9. 📋 Virgül ile Toplu Filtre Ekleme (Bulk Filter Import)
- Arama çubuğuna veya toplu filtre modalına virgülle ayrılmış kelime öbekleri yapıştırıldığında anında ayrıştırılır:
  - Örn: `HEAP BOZULDU, CORRUPT HEAP, uygulama TCB, jpeg, Guru Meditation, MEPC, TESHIS`
- Tek tıkla normal filtre veya **🎯 Hedef Tetikleyici** olarak atanabilir.

#### 10. 🔄 Otomatik Yeniden Bağlanma (Auto-Reconnect)
- ESP32 resetlendiğinde, USB kablosu takılıp çıkarıldığında veya port geçici koptuğunda:
  - Panel otomatik yeniden bağlanma moduna (`isReconnecting`) geçer.
  - Port tekrar görünür görünmez bağlantı kesintisiz ve otomatik yeniden kurulur.

#### 11. 🏷️ Otomatik Panel İsimlendirme Kuralı (Auto-Naming)
- Cihaz boot olurken gelen ROM veya donanım başlığını otomatik algılar:
  - `"esp-rom:"` kuralı: `ESP-ROM:esp32p4-eco2-20240710` satırından `esp32p4-eco2-20240710` metnini ayıklar ve panel/dosya başlığı yapar.
  - `"esp-rom"+` kuralı: Anahtar kelime dahil satırın tamamını başlık olarak atar.
  - Dışa aktarılan `.log` dosyaları bu başlıkla kaydedildiği için log karmaşası önlenir.

#### 12. 🎯 Tetikleme Aksiyonları & Sessiz Kayıt Modu (Armed Pre-Filtering)
- **Aksiyonlar**:
  - 🔔 **Ses Çalma**: Web Audio API ile sıfır harici dosya bağımlılığıyla anında çift tonlu uyarı çalar.
  - 🌐 **HTTPS Webhook**: Discord, Slack, n8n veya REST API uç noktalarına anında POST/GET yükü gönderir.
  - 🔄 **Restart Connection**: Tetiklendiğinde portu kapatıp yeniden bağlar.
  - 📤 **Seri Komut Gönder**: Tetiklendiğinde cihaza UART üzerinden `reboot`, `status` vb. komut yollar.
  - ⏹️ **Seri Bağlantıyı Sonlandır**: Belleği korumak için portu anında kapatır.
- **Sessiz Kayıt Modu (Armed)**:
  - *"Tetikleme açıksa tetiklenene kadar filtrelenmiş kelimeli satırlar dışında hiçbir kayıt tutulmaz."*
  - Yüksek frekanslı sensör gürültüsü engellenir; sadece filtre kelimeleri bellekte tutulur, kritik crash/panic yakalandığında aksiyonlar çalışır.

#### 13. 📊 Ayarlanabilir Maksimum Log Kapasitesi (Max Log Caps)
- Panel hafızasında tutulacak maksimum satır sayısı kullanıcı tarafından serbestçe seçilebilir (1.000, 5.000, 10.000, 50.000+ satır).
- Aşırı bellek kullanımını engeller ve düşük donanımlı sistemlerde bile 60 FPS akıcılık sağlar.

#### 14. ⏱️ Zaman Ayarlı Otomatik Port Kapatma (Auto-Close Timeout)
- **Port Meşguliyetini Önleme**: ESP32'ye yeni kod yüklerken (flash/upload) veya kısa tanı/boot logu incelerken seri portun açık unutulup esptool veya diğer araçları engellemesini önler.
- **Esnek Süre Belirleme**: Panel üzerindeki alana saniye cinsinden değer girilirse (örn: `10`, `30`, `60`), bağlantı açıldıktan o süre sonra port otomatik kapatılır ve serbest bırakılır.
- **Varsayılan Değer ve Canlı Geri Sayım**: Tik açıldığında varsayılan süre (30 sn) kullanılır, alan boş bırakılırsa port kesintisiz açık kalır. Bağlantı esnasında canlı geri sayım sayacı (`⏱️ 28 sn ✕`) gösterilir; tıklandığında süre iptal edilebilir.

#### 15. 🌐 Türkçe ve İngilizce Dil Desteği & Yardım Menüsü
- Üst çubuktan tek tıkla **TR / EN** arasında dinamik geçiş yapılabilir.
- Başlıktaki **(?)** butonu üzerinden genel kullanım kılavuzuna, kısayollara ve GitHub indirme linklerine erişilebilir.

#### 16. 📌 Satırlara Pin / Tag Ekleme & Arşivden Eksiksiz Geri Yükleme
- **Satır İşaretleme**: Herhangi bir log satırının solundaki 📌 simgesine tıklanarak zaman damgası ve isteğe bağlı açıklama notu (`📌 [12:34:56] Pin eklendi` veya `Kritik heap bozulması`) eklenebilir.
- **Görsel Vurgulama & Hızlı Atlama**: Pinlenen satırlar sol kenarda altın sarısı parlak sınır ve etiket rozeti ile belirginleşir. Panel başlığındaki **"📌 Pinler (X)"** açılır menüsünden herhangi bir pine tıklandığında ilgili satıra pürüzsüz kaydırma ile anında atlanır.
- **Kalıcı Yedekleme & Geri Yükleme**: Loglar dışa aktarılırken veya Google Drive tam sistem yedeği kaydedilirken tüm pinler ve filtreler dosyaya yazılır; arşiv veya buluttan geri yüklenirken olduğu gibi panellere geri aktarılır.

#### 17. 🌐 Tarayıcı ile Kalıcı Google Drive Girişi (Loopback OAuth & Auto-Refresh)
- **Kalıcı Oturum (Tampermonkey Tarzı)**: 1 saat sonra süresi dolan geçici token karmaşası ortadan kaldırıldı!
- **Tek Tıkla Tarayıcı Onayı**: "🌐 Tarayıcı ile Giriş Yap" butonuna basıldığında sistem tarayıcısı açılır. Arka plandaki yerel dinleyici (`http://127.0.0.1:8989/oauth/callback`) Google onay kodunu yakalar ve kalıcı `refresh_token` alır.
- **Otomatik Arka Plan Yenileme**: Token süresi dolduğunda uygulama kullanıcıya hissettirmeden yeni `access_token` alır; yeniden giriş yapma zorunluluğu kalmaz.

#### 18. 🤖 AI Modelleri İçin Terminal CLI (`./smp`) & Headless REST API (Port 4567)
- **Komut Satırı Ajanı (`./smp`)**: AI modelleri ve terminal betikleri, seri monitörü harici bir komut satırı arayüzü ile eksiksiz kontrol edebilir:
  - `./smp status` : Açık portlar, oturumlar, RX/TX bayt ve satır sayıları.
  - `./smp ports` : Host cihazdaki USB/UART portlarını algılama.
  - `./smp connect <port> [baud] [--reset]` : Belirtilen porta bağlanma.
  - `./smp disconnect` : Portu serbest bırakma.
  - `./smp logs [--tail N] [--filter <tag>]` : Son N log satırını okuma.
  - `./smp send <komut>` : UART üzerinden donanıma seri komut yollama.
  - `./smp reset` / `./smp boot` : ESP32 donanımsal reset (EN) veya Bootloader (IO0) moduna alma.
  - `./smp pin <satır> [not]` : Kritik satırı arayüzde pinleme/etiketleme.
  - `./smp filter add <etiketler...>` : Arayüze dinamik filtre setleri ekleme.
- **Skill Formatı Otomatik Rehber**: `./smp` komutsuz çağrıldığında AI modellerinin doğrudan anlayacağı tam Markdown Skill rehberini döndürür.
- **Şeffaf Canlı Denetim Konsolu**: AI modelleri terminalden komut çalıştırdığında kullanıcı arayüzünde canlı toast bildirimleri çıkar ve üst çubuktaki **🤖 AI** butonu ile açılan konsolda tüm AI eylemleri, parametreleri ve çıktıları anlık olarak denetlenebilir.

#### 19. 🤖 Bağlı AI Modelleri Arasında Çapraz Görünürlük (Peer Model Discovery)
- **Modellerin Birbirini Görebilmesi**: Farklı panellere veya UART portlarına bağlı AI modelleri (Claude, GPT, DeepSeek, subagent'lar) birbirlerinin hangi portta çalıştığını (`./smp ai-models`, `GET /api/ai-models`, `GET /api/status`) anlık olarak görebilir ve koordineli çalışabilir.
- **Model Kimliği**: Komut çalıştırırken `AI_MODEL="Claude-3.7"` ortam değişkeni veya `X-AI-Model` / `X-AI-Client` HTTP başlıkları kullanılarak oturum kaydedilir.
- **Arayüzde Canlı Gösterge**: Üst çubukta ve AI Konsolu'nda bağlı AI modellerinin adları, bağlı oldukları portlar ve son komutları canlı yeşil nabız ile gösterilir.

#### 20. ⚡ Hızlı Tag & Kısayol Tuş Atamaları (Quick Tag Hotkeys)
- **Özel Şekil, Renk ve Emoji Atama**: Ayarlar menüsünden `1`, `2`, `3` gibi kısayol tuşlarına istenen şekil, renk, emoji ve açıklama atanabilir:
  - Tuş `1`: Mor daire (`circle`) + 😡 emoji + *"ekran hatası"* açıklaması.
  - Tuş `2`: Kırmızı kare (`square`) + 🔊 ses ikonu + *"cızırtı"* açıklaması.
  - Tuş `3`: Sarı üçgen (`triangle`) + ⚠️ ikonu + *"donanım uyarısı"* açıklaması.
  - Tuş `4`: Yeşil beşgen (`pentagon`) + ✅ ikonu + *"başarılı test"* açıklaması.
  - Tuş `5`: Camgöbeği elmas (`diamond`) + ⚡ ikonu + *"voltaj dalgalanması"* açıklaması.
- **Tek Tuşla Etiketleme**: Terminalde herhangi bir satırın üzerine gelinip `1` veya `2` tuşuna basıldığında satır o şekil, renk ve açıklamayla anında damgalanır. Panel başlığındaki hızlı paletten de tıklanabilir.

#### 21. 🎯 Tag Bağlam Penceresi ile Filtreleme (`tag +- N` & `tag+N`)
- **Bağlam Satırlarını Görme**: Filtre kutusuna etiket filtresi girildiğinde etiketli satırın öncesi ve sonrasındaki satırlar da süzmeye dahil edilebilir:
  - `tag` veya `tag+0`: Sadece etiketlenen satırları süzerek gösterir.
  - `tag+5` veya `tag+-5`: Etiketli satırla birlikte **önceki 5 ve sonraki 5 satırı** (toplam 11 satırlık bağlam penceresi) ekranda tutar.
  - `tag:ekran hatası+5` veya `#cızırtı+3`: Belirli bir etiket adına sahip satırları bağlam penceresiyle görüntüler.
  - Virgülle diğer filtrelerle birlikte kullanılabilir (örn: `tag+5, HEAP, MEPC`).

#### 22. 📝 Çok Satırlı Komut Editörü & Gecikmeli Gönderim (Multiline Commands)
- **Genişletilebilir Çok Satırlı Mod**: Panel altındaki komut çubuğu tek satır ve çok satırlı kod editörü arasında geçiş yapabilir. `Shift + Enter` basıldığında veya panoya çok satırlı bir betik kopyalandığında otomatik olarak çok satırlı moda geçer.
- **MicroPython, Lua & AT Dizi Desteği**: ESP32 veya UART cihazının giriş arabelleğinin taşmasını önlemek için satırlar arasında ayarlanabilir gecikme seçilebilir (`0 ms`, `20 ms`, `50 ms`, `100 ms`, `250 ms`).
- **Dosyadan Betik Yükleme**: 📂 butonu ile diskteki `.py`, `.lua`, `.txt`, `.gcode`, `.json`, `.sh` dosyaları doğrudan editöre yüklenebilir.
- **Kısayol**: `Ctrl + Enter` ile anında cihaza gönderilir.

#### 23. 💻 Dahili Yerel Kabuk Komutları (Host Shell Execution)
- **Terminalden Doğrudan Sistem Kabuğu**: Seri monitör komut satırına `!` veya `$` önekiyle komut yazılarak yerel işletim sistemi kabuğu çalıştırılabilir:
  - Örn: `!idf.py build`, `!esptool.py chip_id`, `!cargo build`, `!ls -la`, `!dir`.
- **Seri Bağlantı Zorunluluğu Yok**: Donanım bağlı olmasa bile çalıştırılabilir; derleme ve flashing komutları doğrudan terminal paneline akıtılır.
- **Platforma Özel Yürütme**:
  - **Linux**: `/bin/bash -c` (veya `sh -c`).
  - **Windows**: `powershell -NoProfile -NonInteractive -Command`.
- **CLI & REST API**: `./smp shell "komut"` veya `POST /api/shell` ile harici olarak tetiklenebilir.

#### 24. ⚡ AI Ajanı İnteraktif Komut Yürütme (`exec`) & Otomatik Port Bağlantısı
- **İnteraktif Yanıt Yakalama (`./smp exec`)**: AI modellerinin `send` -> `sleep` -> `logs` döngüleriyle uğraşmasını önler. Komut cihaza gönderilir, monotonic satır sayacı üzerinden cihazın verdiği yanıt satırları anında filtrelenip AI modeline doğrudan döndürülür (`--timeout ms`, `--expect text`).
- **Otomatik Port Algılama (`./smp connect auto`)**: Port adı belirtmeye gerek kalmadan takılı olan ESP32/CH340/CP2102 cihazını otomatik tespit eder ve bağlanır. Açık olan oturumu güvenle korur.

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

#### 8. ☁️ Google Drive Cloud Backup & Restore (GDrive)
- **Direct Cloud Integration**: Connect using Google OAuth access token to backup and synchronize across workstations.
- **Dedicated Folder**: Managed within the `ESP32 Serial Monitor Pro` folder on Google Drive.
- **Upload Logs**: Send panel logs directly to Google Drive with automated descriptive filenames.
- **Backup & Restore Filter Sets and Settings**: Save and restore your regex tags, variable mode rules, typography, and hardware settings in one click.
- **Open Cloud Logs as Reference**: Inspect historical logs stored on Google Drive directly on the comparison canvas.

#### 9. 📋 Bulk Filter Adding via Comma Separation
- Paste multi-term comma-separated lists directly into the search bar or bulk modal:
  - e.g. `HEAP BOZULDU, CORRUPT HEAP, uygulama TCB, jpeg, Guru Meditation, MEPC, TESHIS`
- Quickly assign as filter tags or **🎯 Target Triggers**.

#### 10. 🔄 Automatic Reconnection (Auto-Reconnect)
- Automatically monitors disconnected devices and restores serial connections as soon as the port becomes available.

#### 11. 🏷️ Automatic Panel & File Naming Rule (Auto-Naming)
- Automatically detects chip model and firmware tags from incoming boot logs:
  - Rule `"esp-rom:"`: Extracts `esp32p4-eco2-20240710` from `ESP-ROM:esp32p4-eco2-20240710` for clean panel and export titles.
  - Rule `"esp-rom"+`: Assigns the entire matching line including keyword as the title.

#### 12. 🎯 Trigger Actions & Armed Pre-Filtering
- **Actions**:
  - 🔔 **Play Sound**: Crystal-clear Web Audio synthesized chime.
  - 🌐 **HTTPS Webhook**: Automated POST/GET dispatch to Discord, Slack, n8n, or REST API.
  - 🔄 **Restart Connection**: Port bounce upon trigger event.
  - 📤 **Send Serial Command**: Automatically dispatch UART commands (`reboot`, `status`, etc.).
  - ⏹️ **End Serial Connection**: Instantly freeze and disconnect to protect crash dump state.
- **Armed Pre-Filtering**:
  - Discard all background telemetry and sensor noise until the target trigger is encountered, preserving memory and canvas cleanliness.

#### 13. 📊 Configurable Max Log Capacity (Max Log Caps)
- Configurable in-memory log buffer limit (1,000 to 50,000+ lines) ensuring silky smooth 60 FPS rendering under heavy serial traffic.

#### 14. ⏱️ Auto-Close Port Timeout (Auto-Disconnect)
- **Prevent Port Locking**: Automatically closes the serial port after a set duration so the COM port is not held busy in vain, allowing code uploaders (esptool, PlatformIO, Arduino IDE) to flash without manual disconnection.
- **Configurable Seconds**: Enter a custom timeout in seconds (e.g. `10s`, `30s`, `60s`). If left blank or unchecked, the port stays open indefinitely.
- **Live Visual Countdown**: Displays an animated countdown badge (`⏱️ 28s ✕`) in the panel header with a one-click cancel toggle.

#### 15. 🌐 Dual-Language UI & Help Modal
- Instant toggle between English and Turkish.
- Click the **(?)** help button next to the title to view shortcuts, usage guides, and release links.

#### 16. 📌 Line Pinning & Tagging with Persistent Backup & Restore
- **Line Bookmarking**: Click the 📌 icon in any gutter line to pin critical lines with automatic timestamps and optional diagnostic notes (`📌 [12:34:56] Pin added` or `Fatal Guru Meditation`).
- **Visual Golden Accent & Instant Jump**: Pinned lines display a gold left-border, glowing marker, and tag badge. The panel header **"📌 Pins (X)"** dropdown provides smooth one-click scrolling directly to bookmarked lines.
- **Full Restoration**: Exported `.log` files, local archives, and Google Drive full system bundles preserve all pins and restore them seamlessly.

#### 17. 🌐 1-Click Browser OAuth (Permanent Session & Auto-Refresh)
- **Permanent Session (Tampermonkey Style)**: Eliminates 1-hour expiration limits.
- **Loopback Browser Authorization**: Click "🌐 Sign in with Browser" to launch your browser. The embedded local listener (`http://127.0.0.1:8989/oauth/callback`) captures the authorization code and exchanges it for a permanent `refresh_token`.
- **Automatic Silent Refresh**: When access tokens expire, the backend refreshes them in the background without user intervention.

#### 18. 🤖 AI Agent Terminal CLI (`./smp`) & Headless REST API (Port 4567)
- **Autonomous CLI Agent (`./smp`)**: Allows AI models, LLMs, and bash scripts to completely drive the monitor:
  - `./smp status` : Inspect open ports, sessions, and live RX/TX metrics.
  - `./smp ports` : Scan available USB/UART COM ports.
  - `./smp connect <port> [baud] [--reset]` : Connect to hardware.
  - `./smp disconnect` : Release serial port.
  - `./smp logs [--tail N] [--filter <tag>]` : Stream recent logs.
  - `./smp send <command>` : Transmit UART serial commands.
  - `./smp reset` / `./smp boot` : Trigger EN hardware reset or IO0 download mode.
  - `./smp pin <line> [note]` : Tag diagnostic lines.
  - `./smp filter add <tags...>` : Manipulate UI filters dynamically.
- **Skill Guide Generation**: Running `./smp` without arguments outputs the full Markdown AI Skill document.
- **Audit Console & UI Transparency**: All commands executed by AI agents trigger live UI toast notifications and stream into the dedicated **🤖 AI Model Console** modal for full transparency.

#### 19. 🤖 Connected AI Models Cross-Visibility (Peer Discovery)
- **Peer Agent Awareness**: Multiple autonomous models (Claude, GPT, DeepSeek, subagents) can discover which serial ports and panels their peers are operating on via `./smp ai-models`, `GET /api/ai-models`, and `GET /api/status`.
- **Identity Stamping**: Pass `X-AI-Model` and `X-AI-Client` HTTP headers or set the `AI_MODEL` environment variable.
- **Live UI Indicator**: A pulsing green badge in the top bar and AI modal indicates the number of active models and their associated ports.

#### 20. ⚡ Quick Tag Hotkeys & Customizable Shapes
- **Custom Shapes, Colors & Emojis**: Assign hotkeys (`1`, `2`, `3`...) to specific shapes, colors, emojis, and descriptions in settings:
  - Key `1`: Purple `circle` + 😡 + *"screen error"* description.
  - Key `2`: Red `square` + 🔊 + *"audio crackle"* description.
  - Key `3`: Amber `triangle` + ⚠️ + *"hardware warning"* description.
  - Key `4`: Emerald `pentagon` + ✅ + *"test pass"* description.
  - Key `5`: Cyan `diamond` + ⚡ + *"voltage surge"* description.
- **One-Key Stamping**: Hover over any line in the terminal and hit the hotkey (e.g. `1` or `2`) to instantly stamp the line with the preset. Can also be triggered via the panel header palette.

#### 21. 🎯 Tag Context Window Filtering (`tag +- N` & `tag+N`)
- **Filter with Surrounding Context**: Filter log files by tags while retaining surrounding context lines:
  - `tag` or `tag+0`: Shows only tagged lines.
  - `tag+5` or `tag+-5`: Shows tagged lines along with **5 lines before and 5 lines after** (11 lines of total context).
  - `tag:screen error+5` or `#crackle+3`: Filter specifically by tag name or category with context.
  - Can be combined with standard keywords: `tag+5, HEAP, MEPC`.

#### 22. 📝 Multiline Script Editor & Paced Transmission
- **Expandable Multiline Bar**: Easily switch between single-line command bar and multiline script editor with line counts. Automatically expands when pasting multiline code or pressing `Shift + Enter`.
- **Inter-Line Delay Pacing**: Prevent embedded buffer overruns on MicroPython, Lua, and AT command loops with selectable inter-line delays (`0 ms`, `20 ms`, `50 ms`, `100 ms`, `250 ms`).
- **Load Script Files Directly**: Click 📂 to open `.py`, `.lua`, `.txt`, `.gcode`, `.json`, or `.sh` files straight into the editor.
- **Shortcut**: `Ctrl + Enter` instantly transmits multiline scripts.

#### 23. 💻 Built-in Host Shell Execution (Cross-Platform)
- **Direct Shell Commands from Terminal**: Type commands prefixed with `!` or `$` (e.g. `!idf.py build`, `!esptool.py chip_id`, `!cargo build`, `!ls -la`, `!dir`) to execute commands on the host operating system directly.
- **Independent of Serial Connection**: Runs even when no serial device is connected; build/flash outputs stream directly into the terminal log view.
- **Platform-Native Execution**:
  - **Linux**: Handled cleanly via `/bin/bash -c` (fallback `sh -c`).
  - **Windows**: Handled natively via `powershell -NoProfile -NonInteractive -Command`.
- **CLI & REST API**: Run shell commands programmatically via `./smp shell "<cmd>"` or `POST /api/shell`.

#### 24. ⚡ AI Agent Interactive Command Execution (`exec`) & Auto-Connect
- **Interactive Execution (`./smp exec`)**: AI agents no longer need to manage complex `send` -> `sleep` -> `logs` loops. The system tracks monotonic line counters before dispatch, awaits device output matching `--expect` or `--timeout`, and streams response lines directly back to the caller.
- **Auto-Connect (`./smp connect auto`)**: Scans and connects automatically to plugged ESP32/CH340/CP2102 devices without guessing port paths, safely returning the active session if already connected.

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
| `1` - `6` (Hover) | Quick Tag Hotkeys: Stamp line with custom shape/emoji/color (Hızlı Tag Atama) |
| `F5` | ESP32 Hardware Reset (EN pin pulse) |
| `F6` | ESP32 Bootloader Mode (IO0 pin pulse) |
| `Shift + Scroll` | Horizontal canvas navigation / Paneller arası yatay gezinme |
| `Double Click (Chip)` | Edit quick command / Hızlı komutu düzenleme |
| `Ctrl + +` / `Ctrl + -` | Zoom terminal font size / Yazı tipi boyutunu büyütme/küçültme |
| `Ctrl + F` | Global search / Genel arama |

---

## 📂 Version History / Sürüm Geçmişi

- **v2.0 (Current / Mevcut)**: Rust + Tauri v2 + React 19 + TypeScript standalone architecture. Located in `/v2`.
- **v1.0 (Legacy / Eski)**: Python 3 + PyQt6 legacy edition. Preserved in `/v1`.

---

## 📄 License / Lisans

Distributed under the [MIT License](LICENSE).
