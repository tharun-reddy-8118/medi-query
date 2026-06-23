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

# ── Calculated Fields ─────────────────────────────────────────────────────────

import re as _re

def _parse_calc_expression(expression: str, columns: list[str]) -> str:
    """Convert Tableau-style [Column] bracket expressions to DuckDB SQL."""
    sql_expr = expression.strip()

    # Pre-pass: auto-bracket unbracketed columns to fix AI hallucinations
    for c in sorted(columns, key=len, reverse=True):
        if len(c) > 2:
            escaped_c = _re.escape(c)
            pattern = _re.compile(r'(?<!\[)(?<!")\b' + escaped_c + r'\b(?!\])(?!")', _re.IGNORECASE)
            sql_expr = pattern.sub(f'[{c}]', sql_expr)

    # Helper for parsing custom functions with nested parentheses
    def replace_custom_func(expr, func_name, formatter):
        while True:
            m = _re.search(rf'\b{func_name}\s*\(', expr, _re.IGNORECASE)
            if not m: break
            start_idx = m.start()
            inner_start = m.end()
            depth = 1
            pos = inner_start
            while pos < len(expr) and depth > 0:
                if expr[pos] == '(': depth += 1
                elif expr[pos] == ')': depth -= 1
                pos += 1
            if depth > 0: raise ValueError(f'Unmatched parentheses in {func_name}() statement')
            inner = expr[inner_start:pos-1]
            expr = expr[:start_idx] + formatter(inner) + expr[pos:]
        return expr

    # Virtual function: FORMAT_DURATION(expr) -> MAKE_TIME(...)
    sql_expr = replace_custom_func(sql_expr, 'FORMAT_DURATION', 
        lambda inner: f"MAKE_TIME(CAST({inner} AS INTEGER)//3600, (CAST({inner} AS INTEGER)%3600)//60, CAST({inner} AS INTEGER)%60)"
    )

    # Virtual function: EXTRACT_SECONDS(expr) -> extract seconds safely
    # Uses COALESCE: if already numeric, returns as-is; if TIME/TIMESTAMP, extracts epoch
    sql_expr = replace_custom_func(sql_expr, 'EXTRACT_SECONDS',
        lambda inner: f"COALESCE(TRY_CAST({inner} AS DOUBLE), DATE_PART('epoch', TRY_CAST({inner} AS TIME)))"
    )

    # Virtual function: TIME_DIFF_SECONDS(end, start) -> difference in seconds
    def format_time_diff(inner):
        parts = inner.split(',', 1)
        if len(parts) == 2:
            return f"DATE_PART('epoch', TRY_CAST({parts[0].strip()} AS TIMESTAMP) - TRY_CAST({parts[1].strip()} AS TIMESTAMP))"
        return inner
    sql_expr = replace_custom_func(sql_expr, 'TIME_DIFF_SECONDS', format_time_diff)

    # Replace [Column Name] → "Column Name" (raw reference, works for all types)
    def replace_bracket_raw(m):
        col = m.group(1)
        matched = next((c for c in columns if c.lower() == col.lower()), None)
        if matched is None:
            raise ValueError(f"Column not found: [{col}]")
        return f'"{matched}"'

    # Replace [Column Name] → TRY_CAST("Column Name" AS DOUBLE) (for arithmetic)
    def replace_bracket_numeric(m):
        col = m.group(1)
        matched = next((c for c in columns if c.lower() == col.lower()), None)
        if matched is None:
            raise ValueError(f"Column not found: [{col}]")
        return f'TRY_CAST("{matched}" AS DOUBLE)'

    # Detect context to decide casting strategy:
    # - Aggregate funcs (COUNT, COUNTD, SUM, AVG, etc.) → raw refs (DuckDB handles types)
    # - String funcs → raw refs
    # - Pure arithmetic (+, -, *, /) without aggregates → TRY_CAST for safety
    upper = sql_expr.upper()
    str_funcs = ('CONCAT', 'UPPER', 'LOWER', 'TRIM', 'LEFT', 'RIGHT', 'REPLACE', 'SUBSTRING')
    agg_funcs = ('SUM', 'COUNT', 'COUNTD', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'STDEV', 'STDDEV', 'VARIANCE')
    has_string_func = any(f in upper for f in str_funcs)
    has_agg_func = any(f in upper for f in agg_funcs)
    has_arithmetic = any(op in sql_expr for op in ('+', '-', '*', '/'))
    
    # Use TRY_CAST only for pure arithmetic (no agg, no string funcs)
    if not has_string_func and not has_agg_func and has_arithmetic:
        sql_expr = _re.sub(r'\[([^\]]+)\]', replace_bracket_numeric, sql_expr)
    else:
        sql_expr = _re.sub(r'\[([^\]]+)\]', replace_bracket_raw, sql_expr)

    # Handle {FIXED [Dim] : AGG([Measure])} → AGG("Measure") OVER (PARTITION BY "Dim")
    # This is Tableau LOD syntax for per-group aggregations
    def convert_fixed(m):
        dims_str = m.group(1).strip()
        agg_expr = m.group(2).strip()
        # dims_str has already been bracket-replaced to "Col" format
        # Split on comma for multi-dim
        dims = [d.strip() for d in dims_str.split(',') if d.strip()]
        partition = ', '.join(dims)
        # The agg_expr (e.g. SUM("Revenue")) will get OVER (PARTITION BY ...) added later
        # We mark it so the OVER inserter knows the partition
        return f'/*PARTBY:{partition}*/{agg_expr}'
    
    sql_expr = _re.sub(
        r'\{FIXED\s+(.+?)\s*:\s*(.+?)\}',
        convert_fixed, sql_expr, flags=_re.IGNORECASE
    )

    # Convert IF(cond, then, else) → CASE WHEN cond THEN then ELSE else END
    def format_if(inner):
        p_depth = 0
        parts = []
        current = []
        for ch in inner:
            if ch == '(': p_depth += 1; current.append(ch)
            elif ch == ')': p_depth -= 1; current.append(ch)
            elif ch == ',' and p_depth == 0:
                parts.append(''.join(current).strip())
                current = []
            else: current.append(ch)
        parts.append(''.join(current).strip())
        if len(parts) == 3: return f"CASE WHEN {parts[0]} THEN {parts[1]} ELSE {parts[2]} END"
        elif len(parts) == 2: return f"CASE WHEN {parts[0]} THEN {parts[1]} END"
        raise ValueError(f"IF() expects 2-3 arguments, got {len(parts)}")

    sql_expr = replace_custom_func(sql_expr, 'IF', format_if)

    # Handle COUNTD([col]) → COUNT(DISTINCT "col")
    sql_expr = _re.sub(
        r'\bCOUNTD\s*\(', 'COUNT(DISTINCT ', sql_expr, flags=_re.IGNORECASE
    )

    # Detect aggregate functions and convert to window functions (OVER())
    AGG_FUNCS = ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'MEDIAN', 'STDEV', 'STDDEV', 'VARIANCE')
    has_agg = any(_re.search(rf'\b{fn}\s*\(', sql_expr, _re.IGNORECASE) for fn in AGG_FUNCS)

    if has_agg:
        # Properly handle nested parens: find the matching closing paren
        def _add_over_to_aggs(expr):
            result = expr
            for fn in AGG_FUNCS:
                pattern = _re.compile(rf'(\b{fn})\s*\(', _re.IGNORECASE)
                offset = 0
                while True:
                    m = pattern.search(result, offset)
                    if not m:
                        break
                    # Check for PARTBY marker before this agg call
                    partition_clause = ""
                    prefix = result[:m.start()]
                    partby_match = _re.search(r'/\*PARTBY:(.+?)\*/\s*$', prefix)
                    if partby_match:
                        partition_clause = f"PARTITION BY {partby_match.group(1)}"
                    
                    # Find matching closing paren by tracking depth
                    start = m.end() - 1  # position of the opening '('
                    depth = 1
                    pos = start + 1
                    while pos < len(result) and depth > 0:
                        if result[pos] == '(':
                            depth += 1
                        elif result[pos] == ')':
                            depth -= 1
                        pos += 1
                    # pos is now right after the matching ')'
                    # Check if OVER already follows
                    rest = result[pos:].lstrip()
                    if not rest.upper().startswith('OVER'):
                        over_clause = f' OVER ({partition_clause})'
                        result = result[:pos] + over_clause + result[pos:]
                        offset = pos + len(over_clause)
                    else:
                        offset = pos
            return result
        sql_expr = _add_over_to_aggs(sql_expr)
        # Clean up PARTBY markers
        sql_expr = _re.sub(r'/\*PARTBY:.+?\*/', '', sql_expr)

    return sql_expr, has_agg


def _get_duckdb_schema(table: str) -> dict[str, str]:
    """Query real DuckDB column types from the table."""
    try:
        rows = con.execute(f"PRAGMA table_info('{table}')").fetchdf()
        return {row["name"]: row["type"] for _, row in rows.iterrows()}
    except Exception:
        return {}


def _build_calc_prompt(columns_with_types: list[str], user_prompt: str, rules_text: str, error_context: str = "") -> str:
    """Build the AI prompt for calculated field generation."""
    error_section = ""
    if error_context:
        error_section = f"""
    YOUR PREVIOUS EXPRESSION FAILED WITH THIS ERROR:
    {error_context}
    You MUST fix this error. Do NOT repeat the same mistake.
    """

    return f"""You are an expert data analyst. The user wants a calculated field expression.

COLUMN SCHEMA (name → actual DuckDB type):
{chr(10).join(columns_with_types)}

USER REQUEST: {user_prompt}

{rules_text}
{error_section}

RULES:
1. Use column names in brackets: [Column Name].
2. ONLY use functions from the list below. Do NOT invent or hallucinate any SQL functions.
3. Pay close attention to each column's TYPE. A BIGINT column is already numeric — do NOT cast it to TIME or DATE.
   A DATE column is a date — you can use EXTRACT_SECONDS or TIME_DIFF_SECONDS on it.
   A VARCHAR column is text — use string functions or comparisons.

ALLOWED FUNCTIONS:
- Math: +, -, *, /, %, //, ROUND(expr, n), ABS(expr), COALESCE(a, b)
- Aggregates: SUM([col]), AVG([col]), COUNT([col]), COUNTD([col]), MIN([col]), MAX([col])
- Logic: IF(condition, then_value, else_value)
- Strings: CONCAT(a, b), UPPER([col]), LOWER([col])
- Time helpers (ONLY for Date/Time/Timestamp columns):
    EXTRACT_SECONDS([col]) — converts a TIME/TIMESTAMP column to numeric seconds
    TIME_DIFF_SECONDS([end], [start]) — seconds between two TIME/TIMESTAMP columns
    FORMAT_DURATION(numeric_expr) — formats a numeric seconds value as HH:MM:SS

EXAMPLES:
- Profit margin: ([Revenue] - [Cost]) / [Revenue] * 100
- Average of a numeric seconds column in HH:MM:SS: FORMAT_DURATION(AVG([Talk Sec]))
- Average of a TIME column in HH:MM:SS: FORMAT_DURATION(AVG(EXTRACT_SECONDS([Talk Time])))
- Time between two timestamps: FORMAT_DURATION(AVG(TIME_DIFF_SECONDS([End Time], [Start Time])))
- Categorize: IF([Score] > 80, 'High', IF([Score] > 50, 'Medium', 'Low'))

Return ONLY the raw expression. No markdown, no backticks, no explanation."""


@router.post("/calc_field/generate")
async def generate_calc_field(req: CalcFieldGenerateRequest):
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[req.file_id]
    columns = ds.get("columns", [])
    table = ds.get("table", "")
    
    # Query REAL DuckDB types from the actual table
    db_schema = _get_duckdb_schema(table) if table else {}
    
    columns_with_types = []
    for c in columns:
        dtype = db_schema.get(c, "UNKNOWN")
        columns_with_types.append(f"  [{c}] → {dtype}")

    rules_text = ""
    if getattr(req, "rules", []):
        rules_text = "ADDITIONAL RULES:\n" + "\n".join(f"- {r}" for r in req.rules)

    # Retry loop: generate → validate → retry with error context if broken
    MAX_ATTEMPTS = 3
    last_error = ""
    
    for attempt in range(MAX_ATTEMPTS):
        prompt = _build_calc_prompt(columns_with_types, req.prompt, rules_text, last_error)
        
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.0
            )
            expression = resp.choices[0].message.content.strip()
            
            # Strip markdown wrapping
            if expression.startswith("```"):
                expression = expression.split("\n", 1)[-1]
            if expression.endswith("```"):
                expression = expression[:-3]
            expression = expression.strip().strip("`").strip()
            
            # Validate: parse and test-execute against the real table
            if table:
                try:
                    test_sql_expr, _ = _parse_calc_expression(expression, columns)
                    test_sql = f'SELECT {test_sql_expr} AS result FROM {table} LIMIT 1'
                    con.execute(test_sql).fetchone()
                    # SUCCESS — expression is valid
                    logger.info(f"Calc field generated (attempt {attempt+1}): {expression}")
                    return {"expression": expression}
                except Exception as validation_err:
                    last_error = f"Expression: {expression}\nError: {str(validation_err)}"
                    logger.warning(f"Calc field validation failed (attempt {attempt+1}): {validation_err}")
                    continue
            else:
                return {"expression": expression}
                
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # All retries exhausted — return last expression anyway with a warning
    return {"expression": expression, "warning": "Expression may contain errors. Please review before saving."}


@router.post("/calc_field")
async def create_calc_field(req: CalcFieldRequest):
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[req.file_id]
    if ds.get("mode") == "document":
        raise HTTPException(status_code=400, detail="Calculated fields not available for documents")

    table = ds["table"]
    columns = ds["columns"]

    # Sanitize field name
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Field name is required")
    if not _re.match(r'^[a-zA-Z0-9_ ]+$', name):
        raise HTTPException(status_code=400, detail="Field name can only contain letters, numbers, spaces, and underscores")

    # Parse expression
    try:
        sql_expr, has_agg = _parse_calc_expression(req.expression, columns)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    safe_name = name.replace('"', '""')

    # Validate with a test query
    test_sql = f'SELECT {sql_expr} AS result FROM {table} LIMIT 5'
    try:
        preview_df = con.execute(test_sql).fetchdf()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Expression error: {str(e)}")

    # Build preview data
    preview_rows = []
    try:
        # Get source columns from expression
        ref_cols = _re.findall(r'"([^"]+)"', sql_expr)
        ref_cols = [c for c in ref_cols if c in columns][:3]  # max 3 reference cols
        ref_select = ', '.join(f'CAST("{c}" AS VARCHAR) AS "{c}"' for c in ref_cols)
        if ref_select:
            full_sql = f'SELECT {ref_select}, CAST(({sql_expr}) AS VARCHAR) AS "{name}" FROM {table} LIMIT 5'
        else:
            full_sql = f'SELECT CAST(({sql_expr}) AS VARCHAR) AS "{name}" FROM {table} LIMIT 5'
        preview_df_full = con.execute(full_sql).fetchdf()
        preview_rows = preview_df_full.fillna("").to_dict(orient="records")
    except Exception:
        preview_rows = [{name: str(v)} for v in preview_df["result"].fillna("").tolist()]

    # If preview only, return without committing
    if req.preview:
        return {
            "preview": True,
            "name": name,
            "expression": req.expression,
            "sql": sql_expr,
            "rows": preview_rows,
        }

    # Check if column already exists
    if name in columns:
        # Drop existing column first (recalculate)
        try:
            con.execute(f'ALTER TABLE {table} DROP COLUMN "{safe_name}"')
        except Exception:
            pass

    # Infer column type from preview
    is_numeric = False
    if len(preview_df) > 0:
        is_numeric = pd.api.types.is_numeric_dtype(preview_df["result"])
    col_type = "DOUBLE" if is_numeric else "VARCHAR"

    # Add the computed column
    if has_agg:
        # Aggregate expressions: compute scalar via subquery and store as regular column
        # Remove OVER() for the subquery since it's a standalone aggregate query
        agg_sql = _re.sub(r'\s*OVER\s*\(\s*\)', '', sql_expr)
        try:
            con.execute(f'ALTER TABLE {table} ADD COLUMN "{safe_name}" {col_type}')
            con.execute(f'UPDATE {table} SET "{safe_name}" = (SELECT {agg_sql} FROM {table})')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create aggregate field: {e}")
    else:
        try:
            con.execute(f'ALTER TABLE {table} ADD COLUMN "{safe_name}" AS ({sql_expr})')
        except Exception as e:
            # Fallback: add as a regular column with UPDATE
            try:
                con.execute(f'ALTER TABLE {table} ADD COLUMN "{safe_name}" {col_type}')
                con.execute(f'UPDATE {table} SET "{safe_name}" = {sql_expr}')
            except Exception as e2:
                raise HTTPException(status_code=500, detail=f"Failed to create field: {e2}")

    # Update dataset metadata
    if name not in columns:
        ds["columns"].append(name)

    # Update numeric stats if it's a number column
    try:
        stats_row = con.execute(
            f'SELECT ROUND(SUM(TRY_CAST("{safe_name}" AS DOUBLE)),2) AS s, '
            f'ROUND(MIN(TRY_CAST("{safe_name}" AS DOUBLE)),2) AS mn, '
            f'ROUND(MAX(TRY_CAST("{safe_name}" AS DOUBLE)),2) AS mx '
            f'FROM {table}'
        ).fetchone()
        if stats_row and stats_row[0] is not None:
            ds["numeric_stats"][name] = {
                "sum": round(float(stats_row[0]), 2),
                "min": round(float(stats_row[1]), 2),
                "max": round(float(stats_row[2]), 2),
            }
    except Exception:
        pass

    # Store calc field definition
    if "calc_fields" not in ds:
        ds["calc_fields"] = {}
    ds["calc_fields"][name] = {
        "expression": req.expression,
        "sql": sql_expr,
    }

    return {
        "success": True,
        "name": name,
        "expression": req.expression,
        "sql": sql_expr,
        "rows": preview_rows,
        "columns": ds["columns"],
    }


@router.get("/calc_fields/{file_id}")
async def list_calc_fields(file_id: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ds = datasets[file_id]
    calc = ds.get("calc_fields", {})
    return {
        "file_id": file_id,
        "fields": [
            {"name": name, "expression": info["expression"], "sql": info["sql"]}
            for name, info in calc.items()
        ]
    }


@router.delete("/calc_field/{file_id}/{name}")
async def delete_calc_field(file_id: str, name: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[file_id]
    table = ds["table"]
    safe_name = name.replace('"', '""')

    # Remove from table
    try:
        con.execute(f'ALTER TABLE {table} DROP COLUMN "{safe_name}"')
    except Exception:
        pass  # Column might not exist in table

    # Remove from metadata
    if name in ds.get("columns", []):
        ds["columns"].remove(name)
    ds.get("numeric_stats", {}).pop(name, None)
    ds.get("calc_fields", {}).pop(name, None)

    return {"success": True, "name": name, "columns": ds["columns"]}