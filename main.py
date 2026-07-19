import os
import sys
from pathlib import Path
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

# Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "model"
STATIC_DIR = BASE_DIR / "static"

DATA_PATH = DATA_DIR / "ishg.csv"
MODEL_PATH = MODEL_DIR / "model.joblib"

FEATURE_COLS = ["lag_1", "lag_2", "lag_4", "rolling_mean_4", "month", "quarter"]

METRICS = {
    "model": "Random Forest Regression",
    "mae": 417.87,
    "rmse": 605.29,
    "mape": 5.96,
}

app = FastAPI(
    title="IHSG Weekly Forecast API",
    description="Forecasting IHSG Mingguan menggunakan Random Forest Regression",
    version="1.0.0",
)

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins = ["*"] if _allowed_origins.strip() == "*" else [
    origin.strip() for origin in _allowed_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

if not DATA_PATH.exists():
    sys.exit(
        f"[startup error] Dataset tidak ditemukan di '{DATA_PATH}'. "
        "Pastikan file ishg.csv ada di folder data/."
    )

if not MODEL_PATH.exists():
    sys.exit(
        f"[startup error] Model tidak ditemukan di '{MODEL_PATH}'. "
        "Pastikan file model.joblib ada di folder model/."
    )

try:
    model = joblib.load(MODEL_PATH)
except Exception as exc: 
    sys.exit(f"[startup error] Gagal memuat model dari '{MODEL_PATH}': {exc}")

df = pd.read_csv(DATA_PATH)
df["Date"] = pd.to_datetime(df["Date"])

df = (
    df.sort_values("Date")
    .drop_duplicates(subset="Date")
    .ffill()
    .bfill()
    .reset_index(drop=True)
)

weekly_close = (
    df.groupby(pd.Grouper(key="Date", freq="W-FRI"))["Close"].last().dropna()
)

if len(weekly_close) < 10:
    sys.exit(
        "[startup error] Data mingguan terlalu sedikit untuk melakukan forecast. "
        "Periksa kembali isi data/ishg.csv."
    )

weekly_return = np.log(weekly_close).diff().dropna()


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def home():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend belum tersedia.")
    return FileResponse(index_path)

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

@app.get("/api/health", summary="Health Check", include_in_schema=False)
def health():
    return {
        "status": "ok",
        "data_points_weekly": int(len(weekly_close)),
        "last_date": weekly_close.index.max().strftime("%Y-%m-%d"),
    }

@app.get("/api/historical", summary="Historical Weekly Close")
def historical_data(
    years: int = Query(
        default=5, ge=1, le=20, description="Jumlah tahun historis yang ditampilkan"
    )
):
    cutoff = weekly_close.index.max() - pd.DateOffset(years=years)
    display = weekly_close[weekly_close.index >= cutoff]

    return {
        "dates": display.index.strftime("%Y-%m-%d").tolist(),
        "close": display.values.tolist(),
    }

@app.get("/api/metrics", summary="Model Evaluation Metrics")
def metrics():
    return METRICS


@lru_cache(maxsize=24) 
def generate_forecast(horizon: int):
    return_history = list(weekly_return.values)
    current_price = float(weekly_close.iloc[-1])

    future_dates = pd.date_range(
        start=weekly_close.index[-1], periods=horizon + 1, freq="W-FRI"
    )[1:]

    forecast_price = []

    for tanggal in future_dates:
        lag_1 = return_history[-1]
        lag_2 = return_history[-2]
        lag_4 = return_history[-4]

        rolling_mean_4 = float(np.mean(return_history[-4:]))
        features = pd.DataFrame(
            [[lag_1, lag_2, lag_4, rolling_mean_4, tanggal.month, tanggal.quarter]],
            columns=FEATURE_COLS,
        )

        pred_return = float(model.predict(features)[0])

        current_price *= np.exp(pred_return)

        forecast_price.append(current_price)

        return_history.append(pred_return)

    return {
        "horizon": horizon,
        "dates": future_dates.strftime("%Y-%m-%d").tolist(),
        "forecast": forecast_price,
    }

@app.get("/api/forecast", summary="Weekly Forecast")
def forecast(
    horizon: int = Query(
        default=12, ge=1, le=24, description="Jumlah minggu yang akan diprediksi"
    )
):
    return generate_forecast(horizon)

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("RELOAD", "false").lower() == "true"

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=reload_enabled,
    )
