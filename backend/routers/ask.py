from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime
import math, hashlib, os, tempfile, shutil
import pandas as pd
import logging

from config import con, client, MODEL_SQL, MODEL_FAST, datasets
from models import *
from parsers import _parse_file, answer_from_document
from formatters import format_result_data, build_answer, clean_value
from sql.cleaner import clean_columns, normalize_date_columns, auto_rename_columns
from sql.resolver import resolve_concept_columns, build_column_directive
from sql.sanitizer import extract_sql, sanitize_sql, fix_hallucinated_columns
from sql.executor import execute_with_retry, verify_and_rerun, build_sql_prompt, _QueryFailed

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Ask ───────────────────────────────────────────────────────────────────────

@router.post("/ask")
async def ask_question(request: QuestionRequest):
    FRIENDLY = [
        "I wasn't able to find an answer to that. Could you try rephrasing your question?",
        "I couldn't process that question right now. Try asking it differently.",
        "Something went wrong while looking that up. Please try again.",
    ]

    def friendly_error(msg: str = FRIENDLY[0]) -> dict:
        return {"question": request.question, "answer": msg}

    if request.file_id not in datasets:
        return friendly_error("Your session has expired. Please re-upload your file and try again.")

    ds = datasets[request.file_id]

    if ds.get("mode") == "document":
        try:
            answer = answer_from_document(request.question, ds["doc_text"], request.file_id)
        except Exception as e:
            print(f"[doc Q&A error] {e}")
            answer = FRIENDLY[2]
        return {"question": request.question, "answer": answer}

    table         = ds["table"]
    columns       = ds["columns"]
    date_cols     = ds["date_cols"]
    sample_rows       = ds["sample_rows"]
    numeric_stats     = ds["numeric_stats"]
    categorical_stats = ds.get("categorical_stats", {})

    try:
        resolved         = resolve_concept_columns(request.question, columns)
        column_directive = build_column_directive(resolved)

        prompt = build_sql_prompt(
            request.question, table, columns, date_cols,
            sample_rows, numeric_stats, categorical_stats, column_directive,
            request.history
        )

        try:
            resp = client.chat.completions.create(
                model=MODEL_SQL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
            )
            raw_sql = (resp.choices[0].message.content or "").strip() if resp.choices else ""
        except Exception as e:
            print(f"[LLM error] {e}")
            return friendly_error("I'm having trouble connecting to the AI service. Please try again.")

        if not raw_sql:
            return friendly_error(FRIENDLY[1])

        try:
            sql = extract_sql(raw_sql)
        except ValueError as e:
            print(f"[SQL extraction failed] {e}")
            return friendly_error(FRIENDLY[1])

        sql = sanitize_sql(sql, date_cols)
        sql = fix_hallucinated_columns(sql, columns)

        try:
            result_df = execute_with_retry(sql, columns, date_cols, table)
        except _QueryFailed:
            return friendly_error(FRIENDLY[1])

        result_df = verify_and_rerun(sql, result_df, resolved, request.question, table, columns, date_cols)
        result_df = result_df.where(result_df.notna(), other=None)

        result_data = [{k: clean_value(v) for k, v in row.items()} for row in result_df.to_dict(orient="records")]
        formatted   = format_result_data(result_data)
        answer      = build_answer(request.question, formatted)

        return {
            "question": request.question, 
            "answer": answer,
            "sql": sql,
            "result_data": result_data,
            "columns": list(result_df.columns)
        }

    except Exception as e:
        print(f"[Unhandled /ask error] {e}")
        return friendly_error(FRIENDLY[2])


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary/{file_id}")
async def get_summary(file_id: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[file_id]

    if ds.get("mode") == "document":
        doc_text = ds["doc_text"]
        try:
            resp = client.chat.completions.create(
                model=MODEL_FAST,
                messages=[{"role": "user", "content": (
                    f"Summarise this document in 5-6 numbered insights.\n\n{doc_text[:8000]}"
                )}],
                max_tokens=600,
            )
            ai_insights = resp.choices[0].message.content.strip() if resp.choices else "Could not generate insights."
        except Exception as e:
            ai_insights = f"Could not generate insights: {e}"
        return {"file_id": file_id, "columns": ["text"], "ai_insights": ai_insights}

    table         = ds["table"]
    columns       = ds["columns"]
    numeric_stats = ds["numeric_stats"]
    date_cols     = ds["date_cols"]
    sample_rows   = ds["sample_rows"]

    profile = [f"Table has {len(columns)} columns."]
    for col, s in numeric_stats.items():
        profile.append(f"  - {col}: total={s['sum']}, min={s['min']}, max={s['max']}")
    for dc in date_cols:
        try:
            row = con.execute(f'SELECT MIN("{dc}"), MAX("{dc}") FROM {table}').fetchone()
            if row:
                profile.append(f"  - Date range ({dc}): {row[0]} to {row[1]}")
        except Exception:
            pass
    if sample_rows:
        profile.append("Sample: " + ", ".join(f"{k}={v}" for k, v in list(sample_rows[0].items())[:6]))

    try:
        resp = client.chat.completions.create(
            model=MODEL_FAST,
            messages=[{"role": "user", "content": (
                f"Expert healthcare data analyst.\n"
                f"Dataset columns: {columns}\n" + "\n".join(profile) + "\n\n"
                "Generate 5-6 numbered, specific, actionable insights for hospital management.\n"
                "Act as a Chief Medical Information Officer (CMIO).\n"
                "Focus on identifying anomalies, cost-saving opportunities, efficiency improvements, and patient volume trends.\n"
                "Provide deep reasoning rather than just stating the obvious. Format as a clean numbered list, no markdown."
            )}],
            max_tokens=600,
        )
        ai_insights = resp.choices[0].message.content.strip() if resp.choices else "Could not generate insights."
    except Exception as e:
        ai_insights = f"Could not generate insights: {e}"

    safe_stats = {
        col: {k: (clean_value(v) if isinstance(v, float) else v) for k, v in vals.items()}
        for col, vals in numeric_stats.items()
    }

    return {
        "file_id":       file_id,
        "columns":       columns,
        "date_cols":     date_cols,
        "numeric_stats": safe_stats,
        "ai_insights":   ai_insights,
    }


# ── Data ──────────────────────────────────────────────────────────────────────

@router.post("/data")
async def get_raw_data(request: DataRequest):
    if request.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        ds = datasets[request.file_id]
        if ds.get("mode") == "document":
            raise HTTPException(status_code=400, detail="Data table only available for tabular datasets.")
            
        table = ds["table"]
        df = con.execute(f"SELECT * FROM {table} LIMIT {request.limit}").fetchdf()
        df = df.where(df.notna(), other=None)
        
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)
                
        return {"data": df.to_dict(orient="records")}
    except Exception as e:
        print(f"[/data] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

