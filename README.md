# 📈 IHSG Weekly Forecast

Dashboard **forecasting mingguan IHSG** (Jakarta Composite Index / `^JKSE`) yang membandingkan model statistik klasik (Holt-Winters, Prophet) dengan model machine learning berbasis fitur (Random Forest, XGBoost), lalu men-deploy model terbaik lewat API FastAPI + dashboard interaktif.

> 🔗 **Live demo:** _https://forecasting-ishg.vercel.app/_
> 
> 🔗 **Sember data:** _https://finance.yahoo.com/quote/%5EJKSE/history/_

---

## ✨ Fitur

- **Grafik historis + forecast interaktif** (Chart.js) dengan filter rentang histori (1 / 3 / 5 / semua tahun) dan horizon forecast (4 / 8 / 12 / 24 minggu).
- **Tabel prediksi mingguan** untuk horizon yang dipilih.
- **Kartu metrik evaluasi model** (MAE, RMSE, MAPE) yang diambil langsung dari hasil evaluasi model.
- **API publik** berbasis FastAPI yang bisa dikonsumsi terpisah dari frontend.
- **Recursive walk-forward forecasting** — setiap prediksi minggu depan dipakai sebagai lag untuk prediksi minggu berikutnya, sama seperti cara model dievaluasi di notebook (bukan one-step-ahead yang "disuapi" nilai aktual).

---

## 🧠 Model & Metodologi

Alur lengkap ada di [`notebook/forecasting_ihsg_mingguan_revisi.ipynb`](notebook/forecasting_ihsg_mingguan_revisi.ipynb):

1. **Data Collection** — data harian `^JKSE` 20 tahun terakhir (2006–2026, ±4.842 baris) dari Yahoo Finance via `yfinance`.
2. **Preprocessing** — parsing tanggal, sort kronologis, drop duplikat, resample ke **mingguan** (`W-FRI`, ditutup tiap Jumat) → ±1.044 baris.
3. **Feature Engineering** — target berupa **log-return mingguan**, dengan fitur:
   - `lag_1`, `lag_2`, `lag_4` — log-return 1/2/4 minggu sebelumnya
   - `rolling_mean_4` — rata-rata log-return 4 minggu terakhir
   - `month`, `quarter` — komponen musiman kalender
4. **Modeling** — 4 model dibandingkan: Holt-Winters (Exponential Smoothing), Prophet, Random Forest Regression, XGBoost Regression.
5. **Evaluation** — split 80/20 (train/test), dievaluasi dengan skema **recursive walk-forward** (model hanya boleh memakai prediksinya sendiri sebagai lag, tidak pernah "mengintip" nilai aktual di tengah horizon) supaya adil dibanding `forecast(steps=...)` pada Holt-Winters/Prophet.
6. **Deployment** — model dengan MAPE terendah di-refit dengan seluruh data historis, lalu disimpan sebagai `model.joblib` dan di-serve lewat FastAPI.

### 📊 Perbandingan Model (holdout test set)

| Model | MAE | RMSE | MAPE |
|---|---:|---:|---:|
| **Random Forest** ✅ | **417.87** | **605.29** | **5.96%** |
| XGBoost | 433.49 | 583.23 | 6.08% |
| Holt-Winters | 461.49 | 694.90 | 6.76% |
| Prophet | 658.16 | 793.84 | 8.88% |

**Random Forest Regression** dipilih sebagai model produksi karena punya MAPE terendah, dan menjadi model yang di-serve lewat `model/model.joblib`.

---

## 🏗️ Tech Stack

| Layer | Tools |
|---|---|
| **Model development** | Python, Jupyter, `yfinance`, `pandas`, `numpy`, `statsmodels`, `prophet`, `scikit-learn`, `xgboost` |
| **Backend / API** | FastAPI, Uvicorn, scikit-learn, joblib |
| **Frontend** | HTML, CSS, Vanilla JavaScript, Chart.js |
| **Deployment** | Docker / Render / Railway (lihat panduan di bawah) |

---

## 📁 Struktur Project

```
.
├── main.py                # FastAPI app (serve API + frontend statis)
├── requirements.txt        # Dependencies backend
├── Dockerfile               # Untuk deploy via container
├── Procfile                  # Untuk platform bergaya Heroku/Railway
├── .gitignore
├── data/
│   └── ishg.csv             # Data historis harian IHSG
├── model/
│   └── model.joblib         # Random Forest hasil training (lihat notebook)
├── static/
│   ├── index.html           # Dashboard
│   ├── style.css
│   └── app.js
└── notebook/
    └── forecasting_ihsg.ipynb   # Full workflow: EDA → modeling → evaluation
```

---

## 🚀 Menjalankan di Lokal

Butuh Python 3.11+.

```bash
# 1. Clone repo
git clone <url-repo-kamu>
cd <nama-repo>

# 2. Buat virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Jalankan server
python main.py
# atau: uvicorn main:app --reload
```

Buka **http://localhost:8000** di browser.

---

## ☁️ Deployment

Project ini adalah **satu service FastAPI** yang men-serve API sekaligus file frontend statis (folder `static/`), jadi paling gampang di-deploy sebagai satu web service.

### Opsi A — Render (disarankan, ada free tier)

1. Push repo ini ke GitHub.
2. Di Render, buat **New Web Service** dan hubungkan ke repo.
3. Isi konfigurasi:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy. Render otomatis meng-inject `$PORT`, dan `main.py` sudah membacanya.

### Opsi B — Railway

Railway otomatis mendeteksi `Procfile` atau `Dockerfile` di repo ini — tinggal connect repo dan deploy, tidak perlu konfigurasi tambahan.

### Opsi C — Docker (portable, bisa dipakai di Fly.io, Cloud Run, VPS, dll.)

```bash
docker build -t ihsg-forecast .
docker run -p 8000:8000 ihsg-forecast
```

### Variabel Environment (opsional)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `8000` | Port server (biasanya di-inject otomatis oleh platform deploy) |
| `ALLOWED_ORIGINS` | `*` | Daftar origin yang boleh akses API, dipisah koma. Berguna kalau frontend di-deploy terpisah dari backend |
| `RELOAD` | `false` | Set `true` hanya untuk development lokal via `python main.py` |

---

## 🔌 API Reference

Base URL: `/` (sesuai domain hasil deploy)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/health` | Health check (status service + tanggal data terakhir) |
| `GET` | `/api/metrics` | Metrik evaluasi model (MAE, RMSE, MAPE) |
| `GET` | `/api/historical?years=5` | Data close mingguan historis. `years`: 1–20 (default 5) |
| `GET` | `/api/forecast?horizon=12` | Forecast N minggu ke depan. `horizon`: 1–24 (default 12) |

Contoh respons `/api/forecast?horizon=4`:

```json
{
  "horizon": 4,
  "dates": ["2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14"],
  "forecast": [6171.77, 6177.76, 6185.30, 6197.00]
}
```

Dokumentasi interaktif (Swagger UI) otomatis tersedia di `/docs`.

---

## ⚠️ Keterbatasan & Disclaimer

- **Data tidak live-update.** `data/ishg.csv` adalah snapshot statis yang dibundel di repo. Untuk data terkini, jalankan ulang bagian *Data Collection* di notebook lalu redeploy, atau tambahkan job terjadwal yang menarik data baru dari `yfinance`.
- **Forecast bersifat recursive** — prediksi minggu ke-N memakai prediksi minggu ke-(N-1) sebagai input, sehingga ketidakpastian mengakumulasi seiring bertambahnya horizon. Semakin jauh horizon, semakin besar potensi deviasi.
- Proyek ini dibuat untuk **tujuan edukasi & portofolio**, bukan rekomendasi investasi atau nasihat keuangan.

---

## 🔮 Kemungkinan Pengembangan

- Job terjadwal untuk refresh data & retrain model otomatis.
- Confidence interval / prediction interval pada forecast, bukan hanya point estimate.
- Ensemble antar model (Random Forest + XGBoost) alih-alih memilih satu model terbaik.
- Unit test untuk endpoint API & fungsi forecasting.
- CI/CD pipeline (lint, test, auto-deploy).

---

## 👤 Author

Dikembangkan oleh **[Rangga-a](https://github.com/Rangga-a)**.
