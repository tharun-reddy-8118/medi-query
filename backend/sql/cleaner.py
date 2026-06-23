import re
import pandas as pd
from datetime import datetime

DATE_FORMATS = [
    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y",
    "%m-%d-%Y %H:%M:%S", "%m-%d-%Y",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d",
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y",
    "%m/%d/%Y %H:%M:%S", "%m/%d/%Y",
    "%Y/%m/%d",
]


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
        df.columns
        .str.strip()
        .str.replace(r"[\s\-/]+", "_", regex=True)
        .str.replace(r"[^\w]", "", regex=True)
    )
    return df


def _try_strptime(val: str, fmt: str) -> bool:
    try:
        datetime.strptime(val, fmt)
        return True
    except ValueError:
        return False


def try_parse_date_series(series: pd.Series):
    sample = series.dropna().astype(str).head(20).tolist()
    if not sample:
        return None
    for fmt in DATE_FORMATS:
        matched = sum(1 for v in sample if _try_strptime(v.strip(), fmt))
        if matched >= min(3, len(sample)):
            try:
                parsed = pd.to_datetime(
                    series.astype(str).str.strip(), format=fmt, errors="coerce"
                )
                if parsed.notna().sum() / max(len(parsed), 1) >= 0.8:
                    return parsed.dt.date
            except Exception:
                pass
    try:
        parsed = pd.to_datetime(series, infer_datetime_format=True, errors="coerce")
        if parsed.notna().sum() / max(len(parsed), 1) >= 0.8:
            return parsed.dt.date
    except Exception:
        pass
    return None


def normalize_date_columns(df: pd.DataFrame):
    date_cols = []
    for col in df.select_dtypes(include=["object"]).columns:
        result = try_parse_date_series(df[col])
        if result is not None:
            df[col] = result
            date_cols.append(col)
    return df, date_cols


# ── Auto rename columns ───────────────────────────────────────────────────────

_ABBR = {
    "pat":"Patient","pt":"Patient","dept":"Department","hosp":"Hospital",
    "adm":"Admission","admn":"Admission","disch":"Discharge","opd":"OPD",
    "ipd":"IPD","icu":"ICU","rev":"Revenue","amt":"Amount","exp":"Expense",
    "inc":"Income","bil":"Billing","bill":"Billing","pay":"Payment","sal":"Salary",
    "emp":"Employee","bal":"Balance","cnt":"Count","num":"Number","no":"Number",
    "avg":"Average","tot":"Total","ttl":"Total","pct":"Percentage","dt":"Date",
    "yr":"Year","mth":"Month","mnth":"Month","wk":"Week","loc":"Location",
    "cd":"Code","nm":"Name","desc":"Description","cat":"Category","typ":"Type",
    "grp":"Group","stat":"Status","qty":"Quantity","dur":"Duration","mob":"Mobile",
    "dob":"Date Of Birth","id":"ID","gst":"GST","sno":"Serial No",
    "s_no":"Serial No","sl_no":"Serial No","sr":"Serial","ins":"Insurance",
    "med":"Medicine","los":"Length Of Stay","readm":"Readmission","rx":"Prescription",
    "per":"per","of":"of","by":"by","and":"and",
}

_KEEP_UPPER = {"id","ids","gst","opd","ipd","icu","ot","pin","mrn","dob","los","rx"}


def _split_tokens(col):
    if col.lower() in _ABBR:
        return [col]
    col = re.sub(r"([a-z])([A-Z])", r"\1_\2", col)
    col = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", col)
    return [t for t in re.split(r"[^a-zA-Z0-9]+", col) if t]


def _expand_token(token):
    low = token.lower()
    if low in _ABBR: return _ABBR[low]
    if low in _KEEP_UPPER: return token.upper()
    return token.title() if not token.isupper() else token


def auto_rename_columns(df: pd.DataFrame):
    rename_map = {}
    new_cols = []
    for original in df.columns:
        tokens   = _split_tokens(original)
        friendly = " ".join(_expand_token(t) for t in tokens).strip() or original.replace("_", " ").title()
        candidate = friendly
        suffix = 1
        while candidate in new_cols:
            suffix += 1
            candidate = f"{friendly} {suffix}"
        new_cols.append(candidate)
        if candidate != original:
            rename_map[original] = candidate
    df.columns = new_cols
    return df, rename_map