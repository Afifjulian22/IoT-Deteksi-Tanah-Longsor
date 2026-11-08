# 🏔️ Sistem Telemetri & Deteksi Dini Longsor (Digital Twin 3D)

Dashboard visualisasi dan simulasi **Digital Twin 3D & Telemetri IoT** untuk pemantauan lereng dan sistem peringatan dini bencana tanah longsor (Early Warning System - EWS). Proyek ini dirancang untuk maket uji geoteknik berbasis ESP32, sensor MPU6050 (kemiringan/inclinometer), sensor kelembapan tanah kapasitif, sensor curah hujan, serta akselerometer getaran lereng.

---

## 🚀 Fitur Utama

1. **3D Real-time Digital Twin (Three.js & OrbitControls)**:
   - Visualisasi geometri lereng, lapisan batuan (*bedrock*), subsoil lempung, dan bidang gelincir (*rotational failure wedge*).
   - Animasi dinamis runtuhan tanah dan retakan tarik (*tension cracks*) saat kondisi kritis/bahaya.
   - Partikel hujan dinamis dan pencahayaan studio/alam.
   - Kontrol kamera 3D interaktif (Putar/Orbit, Zoom, Pan, Wireframe).

2. **2D Engineering CAD Schematic**:
   - Skema potongan melintang (*cross-section*) maket akrilik rekayasa (60 x 30 x 40 cm).
   - Titik probe sensor interaktif (klik pada modul ESP32 untuk melihat status telemetri perangkat & kalibrasi).

3. **Telemetri & Status Triase Lereng**:
   - Status Kesiapsiagaan Real-time: **P0 (AMAN)**, **P1 (BAHAYA)**, **P2 (WASPADA)**.
   - Inclinometer (Pitch & Roll) dengan laju geser (°/s).
   - Volumetric Water Content (VWC) kelembapan tanah dengan ambang batas saturasi.
   - Curah hujan dan akselerasi getaran lereng (RMS Vibration).
   - Grafik riwayat data bergulir (*rolling 30s window chart*) via Chart.js.

4. **Simulasi Machine Learning**:
   - Komparasi prediksi klasifikasi risiko longsor antara model **Random Forest** (F1-Score 94.2%) vs *Baseline Ambang Statis*.

5. **Audio Synthesizer Alarm / Buzzer**:
   - Pembangkit nada alarm frekuensi audio langsung di browser via **Web Audio API** (tanpa dependensi file MP3 eksternal).

6. **Dock Panel Kontrol Simulasi**:
   - Tombol skenario cepat: **Normal (Aman)**, **Hujan (Waspada)**, **Longsor Runtuh (Bahaya)**, dan mode **Auto-Loop Demo**.
   - Slider manual untuk pengujian parameter Pitch, Kelembapan, Curah Hujan, dan Getaran.

---

## 💻 Kebutuhan Sistem & Apa yang Dibutuhkan untuk Menjalankan

Proyek ini dibuat menggunakan arsitektur **Zero-Dependency Front-End**. Seluruh pustaka eksternal (Tailwind CSS, Three.js, OrbitControls, Chart.js) sudah disertakan secara lokal di dalam direktori `assets/js/`.

### Yang Dibutuhkan oleh Rekan / Pengguna:
- **Web Browser Modern**: Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, atau Safari (mendukung WebGL dan JavaScript ES6+).
- **Git** (hanya jika ingin mengklon repositori secara lokal).
- **Tidak Memerlukan**:
  - ❌ Tidak perlu instalasi `npm`, `node_modules`, atau Node.js.
  - ❌ Tidak perlu Python environment / pip.
  - ❌ Tidak perlu database (MySQL/PostgreSQL) atau server backend khusus.

---

## 🛠️ Cara Menjalankan

### Opsi 1: Menggunakan Local HTTP Server (Sangat Disarankan)
Untuk menghindari pembatasan keamanan browser (*CORS policy* pada file lokal) dan memastikan Web Audio API serta WebGL berjalan mulus:

1. **Clone repository**:
   ```bash
   git clone https://github.com/fatir02/iot-landslide-dashboard.git
   cd iot-landslide-dashboard
   ```

2. **Jalankan server lokal sederhana** (pilih salah satu):
   - **Menggunakan VS Code**: Buka folder proyek di VS Code, klik kanan pada file `index.html` lalu pilih **"Open with Live Server"**.
   - **Menggunakan Python 3**:
     ```bash
     python3 -m http.server 8000
     ```
     Lalu buka peramban di `http://localhost:8000`.
   - **Menggunakan Node.js / npx**:
     ```bash
     npx serve .
     ```
   - **Menggunakan PHP**:
     ```bash
     php -S localhost:8000
     ```

### Opsi 2: Buka Langsung File HTML
Anda juga dapat langsung membuka file `index.html` dengan melakukan **klik dua kali (double click)** atau *drag & drop* ke dalam jendela browser.

### Opsi 3: Akses via GitHub Pages (Tanpa Kloning / Install Apapun!)
Setelah repositori ini diunggah ke GitHub, repositori ini dapat diaktifkan fiturnya melalui:
1. Buka menu **Settings** di repo GitHub.
2. Pilih tab **Pages**.
3. Pada bagian **Build and deployment**, atur Branch ke `main` dan folder ke `/ (root)`.
4. Klik **Save**. Dalam 1-2 menit, situs dapat diakses langsung oleh rekan melalui tautan:
   `https://fatir02.github.io/iot-landslide-dashboard/`

---

## 📁 Struktur Berkas

```
iot-landslide-dashboard/
├── assets/
│   ├── css/
│   │   └── styles.css          # Tema industri gelap & tata letak instrumen
│   └── js/
│       ├── app.js              # Logika simulasi 3D, audio, telemetri & event listener
│       ├── chart.umd.min.js    # Chart.js lokal
│       ├── OrbitControls.js    # Pengendali kamera 3D Three.js
│       ├── tailwind.min.js     # Framework utilitas CSS Tailwind lokal
│       └── three.min.js        # Engine rendering 3D WebGL Three.js lokal
├── index.html                  # Antarmuka dashboard utama
├── .gitignore
└── README.md                   # Dokumentasi teknis & panduan instalasi
```

---

## 👥 Kontributor & Riset
- **Pengembang**: Fatir (`fatir02`)
- **Fokus**: Sistem Instrumentasi Geoteknik & Mitigasi Kebencanaan
