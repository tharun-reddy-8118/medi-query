from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime
import math, hashlib, os, tempfile, shutil, zipfile, json
import pandas as pd
import logging

from config import con, client, MODEL_FAST as MODEL, datasets
from models import *
from parsers import _parse_file, answer_from_document, list_excel_sheets
from formatters import format_result_data, build_answer, clean_value
from sql.cleaner import clean_columns, normalize_date_columns, auto_rename_columns
from sql.resolver import resolve_concept_columns, build_column_directive
from sql.sanitizer import extract_sql, sanitize_sql, fix_hallucinated_columns
from sql.executor import execute_with_retry, verify_and_rerun, build_sql_prompt, _QueryFailed
from rag import build_faiss_index

logger = logging.getLogger(__name__)
router = APIRouter()

# ── List Excel Sheets ─────────────────────────────────────────────────────────

@router.post("/sheets")
async def get_sheets(file: UploadFile = File(...)):
    """Return the list of sheet names for an Excel file."""
    fname = file.filename.lower()
    if not fname.endswith((".xlsx", ".xls")):
        return {"sheets": []}
    
    fd, filepath = tempfile.mkstemp(suffix=file.filename)
    try:
        with os.fdopen(fd, "wb") as f:
            shutil.copyfileobj(file.file, f)
        sheets = list_excel_sheets(filepath)
        return {"sheets": sheets}
    except Exception as e:
        logger.error(f"Failed to read sheets: {e}")
        return {"sheets": []}
    finally:
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass

# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), prompt: str | None = Form(None), sheet_name: str | None = Form(None)):
    import tempfile
    import shutil

    try:
        # Create a temporary file to store the upload without blowing up memory
        fd, filepath = tempfile.mkstemp(suffix=file.filename)
        with os.fdopen(fd, "wb") as f:
            shutil.copyfileobj(file.file, f)

        
        if file.filename.endswith(".mqdb"):
            with zipfile.ZipFile(filepath, "r") as z:
                # 1. Read metadata
                with z.open("metadata.json") as meta_file:
                    meta = json.load(meta_file)
                
                # 2. Extract parquet
                parquet_path = os.path.join(tempfile.gettempdir(), f"import_{os.path.basename(filepath)}.parquet")
                with open(parquet_path, "wb") as p_out:
                    p_out.write(z.read("data.parquet"))
                    
                # 3. Create duckdb table
                file_id = f"file_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
                table_name = f"data_{file_id}"
                
                con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM '{parquet_path}'")
                
                # 4. Register dataset
                ds = meta["dataset"]
                ds["table"] = table_name
                ds["is_saved"] = True # imported dashboards are saved by default
                ds["filename"] = file.filename.replace(".mqdb", "")
                datasets[file_id] = ds
                
                # 5. Clean up parquet
                try:
                    os.remove(parquet_path)
                except:
                    pass
                
                return {
                    "file_id": file_id,
                    "layout_key": ds.get("layout_key", file_id),
                    "filename": ds["filename"],
                    "rows": ds.get("rows", 0),
                    "is_mqdb": True,
                    "ui_config": meta.get("ui_config", {})
                }
        
        df, doc_text = _parse_file(file.filename, filepath, sheet_name=sheet_name)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")
    finally:
        # Clean up the temporary file if it was created
        if 'filepath' in locals() and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as cleanup_err:
                logger.warning(f"Could not delete temp file {filepath}: {cleanup_err}")

    # ── Document mode ─────────────────────────────────────────────────────
    if doc_text is not None:
        file_id = f"file_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        datasets[file_id] = {
            "mode":     "document",
            "doc_text": doc_text,
            "filename": file.filename,
            "is_saved": False,
        }
        lines = doc_text.splitlines()
        
        # Build FAISS index for Advanced RAG
        try:
            build_faiss_index(file_id, doc_text)
        except Exception as e:
            logger.error(f"Failed to build FAISS index: {e}")
            
        return {
            "file_id":         file_id,
            "filename":        file.filename,
            "rows":            len(lines),
            "columns":         ["text"],
            "preview":         [{"text": l} for l in lines[:5] if l.strip()],
            "numeric_columns": [],
            "date_columns":    [],
            "doc_mode":        True,
            "word_count":      len(doc_text.split()),
            "is_saved":        False,
        }

    # ── Structured mode ───────────────────────────────────────────────────
    df = clean_columns(df)
    df, rename_map = auto_rename_columns(df)
    df, date_cols  = normalize_date_columns(df)

    file_id = f"file_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    table   = f"data_{file_id}"
    con.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM df")

    # Skip ID/serial columns
    ID_SKIP = {
        "s_no","sno","s.no","sr_no","sr","serial","serial_no","serial_number",
        "id","patient_id","emp_id","employee_id","doctor_id","hospital_id",
        "record_id","row_id","index","sl_no","slno","no","serial no",
    }

    sample_rows   = df.head(3).fillna("").astype(str).to_dict(orient="records")
    numeric_stats: dict = {}
    for col in df.select_dtypes(include=["number"]).columns:
        col_key = col.lower().strip().replace(" ", "_").replace(".", "_")
        if col_key in ID_SKIP:
            continue
        col_series = df[col].dropna()
        if len(col_series) > 1:
            if (col_series.is_monotonic_increasing
                    and col_series.nunique() == len(col_series)
                    and float(col_series.min()) in (0.0, 1.0)):
                continue
        try:
            s  = clean_value(float(df[col].sum()))
            mn = clean_value(float(df[col].min()))
            mx = clean_value(float(df[col].max()))
            if s is not None:
                numeric_stats[col] = {"sum": round(s, 2), "min": round(mn, 2), "max": round(mx, 2)}
        except Exception:
            pass

    categorical_stats: dict = {}
    for col in df.select_dtypes(exclude=["number"]).columns:
        if col in date_cols:
            continue
        try:
            nunique = df[col].nunique()
            if 1 < nunique <= 20:
                vals = df[col].dropna().unique().tolist()
                categorical_stats[col] = [str(v) for v in vals]
        except Exception:
            pass

    # Stable layout fingerprint — same file always gets same key
    layout_str = file.filename + "|" + str(len(df)) + "|" + ",".join(sorted(df.columns.tolist()))
    layout_key = hashlib.md5(layout_str.encode()).hexdigest()[:20]

    datasets[file_id] = {
        "mode":          "structured",
        "table":         table,
        "filename":      file.filename,
        "layout_key":    layout_key,
        "rows":          len(df),
        "columns":       list(df.columns),
        "date_cols":     date_cols,
        "sample_rows":   sample_rows,
        "numeric_stats": numeric_stats,
        "categorical_stats": categorical_stats,
        "rename_map":    rename_map,
        "prompt":        prompt,
        "created_at":    datetime.now().isoformat(),
        "is_saved":      False
    }

    return {
        "file_id":         file_id,
        "layout_key":      layout_key,
        "filename":        file.filename,
        "rows":            len(df),
        "columns":         list(df.columns),
        "preview":         df.head(5).fillna("").to_dict(orient="records"),
        "numeric_columns": list(numeric_stats.keys()),
        "date_columns":    date_cols,
        "rename_map":      rename_map,
        "doc_mode":        False,
        "is_saved":        False,
    }



@router.post("/join")
async def join_datasets(req: JoinDatasetsRequest):
    if req.file_id_1 not in datasets or req.file_id_2 not in datasets:
        raise HTTPException(404, "One or both datasets not found")

    ds1 = datasets[req.file_id_1]
    ds2 = datasets[req.file_id_2]
    
    t1 = ds1["table"]
    t2 = ds2["table"]

    # Protect against SQL injection on column names
    col1 = req.join_key_1.replace('"', '""')
    col2 = req.join_key_2.replace('"', '""')

    file_id = f"file_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    joined_view = f"joined_{file_id}"

    # Build the join query
    join_sql = f"CREATE VIEW {joined_view} AS SELECT * FROM {t1} {req.join_type} JOIN {t2} ON {t1}.\"{col1}\" = {t2}.\"{col2}\""
    
    try:
        con.execute(join_sql)
        df = con.execute(f"SELECT * FROM {joined_view} LIMIT 100000").fetchdf()
    except Exception as e:
        logger.error(f"Join failed: {e}")
        raise HTTPException(500, f"Join execution failed: {str(e)}")

    columns = list(df.columns)

    date_cols = []
    for col in df.columns:
        if df[col].dtype.name in ("datetime64[ns]", "datetime64[us]", "datetime64[ms]"):
            date_cols.append(col)
        elif df[col].dtype == object:
            try:
                pd.to_datetime(df[col].dropna().head(20))
                date_cols.append(col)
            except Exception:
                pass

    ID_SKIP = {"s_no", "sno", "sr_no", "sr", "serial", "serial_no", "serial_number",
               "id", "patient_id", "emp_id", "employee_id", "record_id", "row_id", "index"}
    numeric_stats = {}
    for col in df.select_dtypes(include=["number"]).columns:
        col_key = col.lower().strip().replace(" ", "_").replace(".", "_")
        if col_key in ID_SKIP:
            continue
        try:
            s = float(df[col].sum())
            mn = float(df[col].min())
            mx = float(df[col].max())
            numeric_stats[col] = {"sum": round(s, 2), "min": round(mn, 2), "max": round(mx, 2)}
        except Exception:
            pass

    categorical_stats = {}
    for col in df.select_dtypes(exclude=["number"]).columns:
        if col in date_cols:
            continue
        try:
            nunique = df[col].nunique()
            if 1 < nunique <= 20:
                categorical_stats[col] = [str(v) for v in df[col].dropna().unique().tolist()]
        except Exception:
            pass

    # Clean alias
    alias = req.alias.strip()
    if not alias:
        alias = f"{ds1.get('filename', 'Dataset 1')} + {ds2.get('filename', 'Dataset 2')}"

    datasets[file_id] = {
        "mode": "structured",
        "table": joined_view,
        "columns": columns,
        "date_cols": date_cols,
        "sample_rows": df.head(3).fillna("").astype(str).to_dict(orient="records"),
        "numeric_stats": numeric_stats,
        "categorical_stats": categorical_stats,
        "rename_map": {},
        "filename": alias,
        "prompt": "",
    }

    layout_str = alias + "|" + str(len(df)) + "|" + ",".join(sorted(columns))
    layout_key = hashlib.md5(layout_str.encode()).hexdigest()[:20]

    return {
        "file_id": file_id,
        "layout_key": layout_key,
        "filename": alias,
        "rows": len(df),
        "columns": columns,
        "preview": df.head(5).fillna("").to_dict(orient="records"),
        "numeric_columns": list(numeric_stats.keys()),
        "date_columns": date_cols,
        "rename_map": {},
        "doc_mode": False,
        "is_saved": False,
    }
