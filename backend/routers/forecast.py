from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime
import math, hashlib, os, tempfile, shutil
import pandas as pd
import logging

from config import con, client, MODEL_FAST as MODEL, datasets
from models import *
from parsers import _parse_file, answer_from_document
from formatters import format_result_data, build_answer, clean_value
from sql.cleaner import clean_columns, normalize_date_columns, auto_rename_columns
from sql.resolver import resolve_concept_columns, build_column_directive
from sql.sanitizer import extract_sql, sanitize_sql, fix_hallucinated_columns
from sql.executor import execute_with_retry, verify_and_rerun, build_sql_prompt, _QueryFailed

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Forecast ──────────────────────────────────────────────────────────────────

@router.post("/forecast")
async def forecast(request: ForecastRequest):
    try:
        from prophet import Prophet
    except ImportError:
        raise HTTPException(status_code=500, detail="Prophet not installed. Run: pip install prophet")

    if request.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[request.file_id]
    if ds.get("mode") == "document":
        raise HTTPException(status_code=400, detail="Forecasting is not available for document files.")

    table = ds["table"]

    try:
        df = con.execute(f"SELECT * FROM {table}").fetchdf()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read table: {e}")

    date_col  = request.resolved_date_col() or (ds.get("date_cols") or [None])[0]
    value_col = request.resolved_value_col()
    periods   = request.resolved_periods()
    freq      = request.resolved_freq()

    if not date_col:
        raise HTTPException(status_code=400, detail=f"No date column. Available: {list(df.columns)}")
    if not value_col:
        numeric_cols = list(ds.get("numeric_stats", {}).keys())
        value_col = numeric_cols[0] if numeric_cols else None
    if not value_col:
        raise HTTPException(status_code=400, detail="No numeric column found.")
    if date_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Date column '{date_col}' not in dataset.")
    if value_col not in ("__count__",) and value_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Value column '{value_col}' not in dataset.")

    if value_col == "__count__":
        pdf = df[[date_col]].copy()
        pdf.columns = ["ds"]
        pdf["ds"] = pd.to_datetime(pdf["ds"], errors="coerce")
        pdf = pdf.dropna()
        pdf = pdf.groupby("ds").size().reset_index(name="y")
    else:
        pdf = df[[date_col, value_col]].copy()
        pdf.columns = ["ds", "y"]
        pdf["ds"] = pd.to_datetime(pdf["ds"], errors="coerce")
        pdf["y"]  = pd.to_numeric(pdf["y"], errors="coerce")
        pdf = pdf.dropna()
        pdf = pdf.groupby("ds", as_index=False)["y"].sum()

    pdf = pdf.sort_values("ds").reset_index(drop=True)
    if len(pdf) < 2:
        raise HTTPException(status_code=400, detail="Not enough rows to forecast (need >= 2).")

    if len(pdf) >= 3:
        median_gap = pdf["ds"].diff().dropna().dt.days.median()
        actual_freq = "MS" if median_gap >= 25 else "W" if median_gap >= 6 else "D"
    else:
        actual_freq = freq

    is_monthly = actual_freq in ("MS", "M", "ME")
    is_weekly  = actual_freq in ("W", "W-MON", "W-SUN")
    is_daily   = actual_freq == "D"

    import numpy as np
    from sklearn.linear_model import LinearRegression

    t = np.arange(len(pdf)).reshape(-1, 1)
    y = pdf["y"].values

    lr = LinearRegression()
    lr.fit(t, y)
    slope     = float(lr.coef_[0])
    intercept = float(lr.intercept_)

    trend_line         = lr.predict(t).flatten()
    pdf["y_detrended"] = y - trend_line

    prophet_df    = pdf[["ds"]].copy()
    prophet_df["y"] = pdf["y_detrended"]

    try:
        prophet = Prophet(
            growth                  = "flat",
            changepoint_prior_scale = 0.01,
            seasonality_prior_scale = 10.0,
            yearly_seasonality      = not is_monthly,
            weekly_seasonality      = is_daily,
            daily_seasonality       = False,
            interval_width          = 0.80,
        )
        if is_daily or is_weekly:
            prophet.add_seasonality(name="monthly", period=30.5, fourier_order=4)
        prophet.fit(prophet_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prophet fitting failed: {e}")

    future       = prophet.make_future_dataframe(periods=periods, freq=actual_freq)
    prophet_pred = prophet.predict(future)

    all_indices = np.arange(len(prophet_pred))
    all_trend   = slope * all_indices + intercept

    prophet_pred["yhat"]       = prophet_pred["yhat"]       + all_trend
    prophet_pred["yhat_lower"] = prophet_pred["yhat_lower"] + all_trend
    prophet_pred["yhat_upper"] = prophet_pred["yhat_upper"] + all_trend

    forecast_df = prophet_pred.copy()
    forecast_df["yhat"]       = forecast_df["yhat"].clip(lower=0)
    forecast_df["yhat_lower"] = forecast_df["yhat_lower"].clip(lower=0)
    forecast_df["yhat_upper"] = forecast_df["yhat_upper"].clip(lower=0)

    recent_n   = max(3, len(pdf) // 4)
    recent_avg = float(pdf["y"].tail(recent_n).mean())
    older_avg  = float(pdf["y"].head(len(pdf) - recent_n).mean()) if len(pdf) > recent_n else recent_avg

    def cv(v):
        if v is None: return None
        try:
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
        except Exception: return None

    historical    = [{"date": str(r["ds"])[:10], "value": cv(r["y"])} for _, r in pdf.iterrows()]
    forecast_rows = [
        {"date": str(r["ds"])[:10], "predicted": cv(r["yhat"]),
         "lower": cv(r["yhat_lower"]), "upper": cv(r["yhat_upper"])}
        for _, r in forecast_df.iterrows()
    ]

    last_hist   = pdf["ds"].max()
    future_only = forecast_df[forecast_df["ds"] > last_hist]
    total_f     = cv(future_only["yhat"].sum())  if not future_only.empty else None
    avg_f       = cv(future_only["yhat"].mean()) if not future_only.empty else None
    hist_avg    = cv(float(pdf["y"].mean()))

    pct_change = None
    if hist_avg and avg_f and hist_avg != 0:
        pct_change = round(((float(avg_f) - float(hist_avg)) / float(hist_avg)) * 100, 1)

    label        = "Count of Records" if value_col == "__count__" else value_col
    trend_word   = "upward 📈" if (pct_change or 0) >= 0 else "downward 📉"
    period_label = "months" if is_monthly else "weeks" if is_weekly else "days"

    ai_explanation = ""
    try:
        ai_resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": (
                f'You are a senior healthcare data analyst.\n\n'
                f'Metric: "{label}"\n'
                f'Historical points: {len(pdf)} | Hist avg: {hist_avg} | '
                f'Hist min: {cv(float(pdf["y"].min()))} | Hist max: {cv(float(pdf["y"].max()))}\n'
                f'Forecast: next {periods} {period_label} | '
                f'Forecast avg: {avg_f} | Forecast total: {total_f}\n'
                f'Trend vs history: {trend_word} ({f"{pct_change:+.1f}%" if pct_change is not None else "N/A"})\n'
                f'Recent momentum: last-quarter avg = {cv(float(recent_avg))}, earlier avg = {cv(float(older_avg))}\n\n'
                'Write a 3-4 sentence analysis explaining what this forecast means for hospital operations. '
                'Then give 2 specific actionable recommendations. '
                'Be honest — if trend is negative, say why and what to do. '
                'Indian healthcare context. Plain paragraphs, no bullet points.'
            )}],
            max_tokens=400,
        )
        if ai_resp.choices:
            ai_explanation = ai_resp.choices[0].message.content.strip()
    except Exception:
        ai_explanation = f"Forecast complete for {label} over the next {periods} {period_label}. Trend: {trend_word}."

    return {
        "file_id":        request.file_id,
        "date_col":       date_col,
        "value_col":      value_col,
        "metric":         label,
        "periods":        periods,
        "freq":           actual_freq,
        "historical":     historical,
        "forecast":       forecast_rows,
        "ai_explanation": ai_explanation,
        "trend": {
            "direction":    "up" if (pct_change or 0) >= 0 else "down",
            "pct_change":   pct_change,
            "hist_avg":     hist_avg,
            "forecast_avg": avg_f,
            "recent_avg":   cv(float(recent_avg)),
        },
        "summary": {
            "forecast_total": total_f,
            "forecast_avg":   avg_f,
            "forecast_from":  str(last_hist)[:10],
            "forecast_to":    str(future_only["ds"].max())[:10] if not future_only.empty else None,
        },
    }


@router.get("/forecast/columns/{file_id}")
async def forecast_columns(file_id: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ds = datasets[file_id]
    return {
        "file_id":       file_id,
        "date_columns":  ds.get("date_cols", []),
        "value_columns": ["__count__"] + list(ds.get("numeric_stats", {}).keys()),
        "value_labels": {
            "__count__": "Count of Records (per day)",
            **{c: c for c in ds.get("numeric_stats", {}).keys()},
        },
    }


