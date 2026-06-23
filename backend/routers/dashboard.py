from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime
import math, hashlib, os, tempfile, shutil, zipfile, json
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

# ── Dashboard ─────────────────────────────────────────────────────────────────

from typing import Optional
from fastapi import Depends
from routers.auth import require_user, require_admin

def check_dashboard_access(file_id: str, user: dict):
    if user["role"] == "admin":
        return
    row = con.execute("SELECT 1 FROM user_dashboards WHERE user_id = ? AND file_id = ?", [user["user_id"], file_id]).fetchone()
    if not row:
        assigned_fids = [r[0] for r in con.execute("SELECT file_id FROM user_dashboards WHERE user_id = ?", [user["user_id"]]).fetchall()]
        for fid in assigned_fids:
            ds = datasets.get(fid)
            if ds and isinstance(ds, dict) and ds.get("layout_key", fid) == file_id:
                return
        raise HTTPException(status_code=403, detail="Access denied")


try:
    con.execute("""
        CREATE TABLE IF NOT EXISTS dashboard_configs (
            file_id VARCHAR PRIMARY KEY,
            config VARCHAR
        )
    """)
except Exception as e:
    logger.warning(f"dashboard_configs table may already exist: {e}")

@router.post("/dashboard/{file_id}/config")
async def save_dashboard_config(file_id: str, req: DashboardConfigRequest, _=Depends(require_admin)):
    import json
    config_str = json.dumps(req.config)
    con.execute(
        "INSERT INTO dashboard_configs (file_id, config) VALUES (?, ?) "
        "ON CONFLICT (file_id) DO UPDATE SET config = excluded.config",
        [file_id, config_str]
    )
    return {"status": "success"}

@router.get("/dashboard/{file_id}/config")
async def get_dashboard_config(file_id: str, user=Depends(require_user)):
    check_dashboard_access(file_id, user)
    import json
    row = con.execute("SELECT config FROM dashboard_configs WHERE file_id = ?", [file_id]).fetchone()
    if row and row[0]:
        return {"config": json.loads(row[0])}
    return {"config": None}
@router.get("/drilldown/{file_id}")
async def get_drilldown_data(
    file_id: str, 
    filter_col: Optional[str] = None, 
    filter_val: Optional[str] = None, 
    cross_filter_col: Optional[str] = None, 
    cross_filter_val: Optional[str] = None,
    user=Depends(require_user)
):
    check_dashboard_access(file_id, user)
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[file_id]
    table = ds["table"]
    
    conds = []
    if filter_col and filter_val:
        fv_esc = filter_val.replace("'", "''")
        conds.append(f"\"{filter_col}\" = '{fv_esc}'")
    if cross_filter_col and cross_filter_val:
        cv_esc = cross_filter_val.replace("'", "''")
        conds.append(f"\"{cross_filter_col}\" = '{cv_esc}'")
        
    where_clause = ""
    if conds:
        where_clause = "WHERE " + " AND ".join(conds)
        
    try:
        query = f"SELECT * FROM {table} {where_clause} LIMIT 100"
        import math
        records = con.execute(query).fetchdf().to_dict(orient="records")
        for row in records:
            for k, v in row.items():
                if isinstance(v, float) and math.isnan(v):
                    row[k] = None
        return {"rows": records, "columns": ds["columns"]}
    except Exception as e:
        logger.error(f"Drilldown failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch raw data")

@router.get("/dashboards")
async def list_dashboards(user=Depends(require_user)):
    try:
        assigned_ids = None
        if user["role"] != "admin":
            assigned_ids = set([r[0] for r in con.execute("SELECT file_id FROM user_dashboards WHERE user_id = ?", [user["user_id"]]).fetchall()])

        res = []
        for fid in list(datasets.iterkeys()):
            ds = datasets.get(fid)
            if not isinstance(ds, dict):
                continue
            if ds.get("is_saved", True) is False:
                continue
            if assigned_ids is not None and str(fid) not in assigned_ids:
                continue
            res.append({
                "file_id": str(fid),
                "filename": str(ds.get("filename", "Unknown Dashboard")),
                "layout_key": str(ds.get("layout_key", fid)),
                "mode": str(ds.get("mode", "structured")),
                "rows": ds.get("rows", 0),
                "created_at": str(ds.get("created_at") or ""),
                "is_saved": True
            })
        res.sort(key=lambda x: x["created_at"], reverse=True)
        return {"dashboards": res}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboards/{file_id}")
async def get_dashboard_metadata(file_id: str, user=Depends(require_user)):
    check_dashboard_access(file_id, user)
    if file_id not in datasets:
        raise HTTPException(404, "Dashboard not found")
    ds = datasets[file_id]
    return {
        "file_id": file_id,
        "layout_key": ds.get("layout_key", file_id),
        "filename": ds.get("filename", "Unknown Dashboard"),
        "rows": ds.get("rows", 0),
        "columns": ds.get("columns", []),
        "preview": ds.get("sample_rows", []),
        "numeric_columns": list(ds.get("numeric_stats", {}).keys()) if ds.get("numeric_stats") else [],
        "date_columns": ds.get("date_cols", []),
        "rename_map": ds.get("rename_map", {}),
        "doc_mode": ds.get("mode") == "document",
        "is_saved": ds.get("is_saved", True)
    }


@router.post("/dashboards/{file_id}/export")
async def export_dashboard(file_id: str, req: ExportRequest, _=Depends(require_admin)):
    if file_id not in datasets:
        raise HTTPException(404, "Dashboard not found")
    ds = datasets[file_id]
    table_name = ds.get("table")
    tmpdir = tempfile.mkdtemp()
    try:
        parquet_path = os.path.join(tmpdir, "data.parquet").replace("\\", "/")
        if table_name:
            con.execute(f"COPY {table_name} TO '{parquet_path}' (FORMAT PARQUET)")
        meta_path = os.path.join(tmpdir, "metadata.json")
        meta = {
            "dataset": ds,
            "ui_config": req.ui_config
        }
        
        # FIX datetime serializations
        def _json_serial(obj):
            from datetime import datetime
            if isinstance(obj, datetime): return obj.isoformat()
            import math
            if isinstance(obj, float) and math.isnan(obj): return None
            return str(obj)

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, default=_json_serial)
        zip_path = os.path.join(tempfile.gettempdir(), f"{file_id}_export.mqdb")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            if os.path.exists(parquet_path):
                z.write(parquet_path, "data.parquet")
            z.write(meta_path, "metadata.json")
        return FileResponse(path=zip_path, filename=f"{ds.get('filename', 'dashboard')}.mqdb", media_type="application/octet-stream")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

@router.post("/dashboards/{file_id}/save")
async def save_dashboard(file_id: str, _=Depends(require_admin)):
    if file_id not in datasets:
        raise HTTPException(404, "Dashboard not found")
    ds = datasets[file_id]
    ds["is_saved"] = True
    datasets[file_id] = ds # triggers diskcache write
    return {"status": "success"}

@router.put("/dashboards/{file_id}/rename")
async def rename_dashboard(file_id: str, req: RenameRequest, _=Depends(require_admin)):
    if file_id not in datasets:
        raise HTTPException(404, "Dashboard not found")
    ds = datasets[file_id]
    ds["filename"] = req.filename.strip() or "Unnamed Dashboard"
    ds["is_saved"] = True  # Automatically mark as saved when renamed
    datasets[file_id] = ds
    return {"status": "success", "filename": ds["filename"]}

@router.delete("/dashboards/{file_id}")
async def delete_dashboard(file_id: str, _=Depends(require_admin)):
    if file_id in datasets:
        ds = datasets[file_id]
        if ds.get("table"):
            try:
                con.execute(f"DROP TABLE IF EXISTS {ds['table']}")
            except Exception as e:
                logger.error(f"Failed to drop table for {file_id}: {e}")
        del datasets[file_id]
    
    try:
        con.execute("DELETE FROM dashboard_configs WHERE file_id = ?", [file_id])
    except Exception as e:
        logger.error(f"Failed to delete config for {file_id}: {e}")
        
    try:
        con.execute("DELETE FROM user_dashboards WHERE file_id = ?", [file_id])
    except Exception as e:
        logger.error(f"Failed to delete user_dashboards for {file_id}: {e}")
        
    return {"status": "success"}

@router.get("/dashboard/{file_id}")
async def get_dashboard(file_id: str, filter_col: Optional[str] = None, filter_val: Optional[str] = None, cross_filter_col: Optional[str] = None, cross_filter_val: Optional[str] = None, user=Depends(require_user)):
    check_dashboard_access(file_id, user)
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[file_id]
    if ds.get("mode") == "document":
        return {"kpis": [], "charts": []}

    table         = ds["table"]
    columns       = ds["columns"]
    date_cols     = ds.get("date_cols", [])
    numeric_stats = ds.get("numeric_stats", {})
    calc_fields = ds.get("calc_fields", {})

    logger.info(f"DEBUG GET_DASHBOARD: filter_col={filter_col}, filter_val={filter_val}, cross_filter_col={cross_filter_col}, cross_filter_val={cross_filter_val}, table={table}")
    def add_where(sql):
        conds = []
        if filter_col and filter_val:
            fv_esc = filter_val.replace("'", "''")
            if filter_col in calc_fields:
                fc_sql = f"({calc_fields[filter_col]['sql']})"
            else:
                fc_esc = filter_col.replace('"', '""')
                fc_sql = f'"{fc_esc}"'
            conds.append(f"{fc_sql} = '{fv_esc}'")
        if cross_filter_col and cross_filter_val:
            fv_esc = cross_filter_val.replace("'", "''")
            if cross_filter_col in calc_fields:
                fc_sql = f"({calc_fields[cross_filter_col]['sql']})"
            else:
                fc_esc = cross_filter_col.replace('"', '""')
                fc_sql = f'"{fc_esc}"'
            conds.append(f"{fc_sql} = '{fv_esc}'")
        
        if not conds:
            return sql
            
        where_clause = " AND ".join(conds)
        filtered_table = f"(SELECT * FROM {table} WHERE {where_clause}) AS {table}"
        return sql.replace(f"FROM {table}", f"FROM {filtered_table}")

    import math
    def safe_rows(sql):
        try:
            full_sql = add_where(sql)
            logger.info(f"EXECUTING SQL: {full_sql}")
            records = con.execute(full_sql).fetchdf().to_dict(orient="records")
            for row in records:
                for k, v in row.items():
                    if isinstance(v, float) and math.isnan(v):
                        row[k] = None
            return records
        except Exception as e:
            logger.error(f"safe_rows error: {e} SQL: {sql}")
            return []

    def safe_val(sql):
        try:
            full_sql = add_where(sql)
            logger.info(f"EXECUTING VAL SQL: {full_sql}")
            row = con.execute(full_sql).fetchone()
            if row:
                v = row[0]
                if isinstance(v, float) and math.isnan(v): return None
                return v
            return None
        except Exception:
            return None

    def is_skip(col):
        cl = col.lower()
        return any(p in cl for p in ("id","name","patient","phone","email","address",
                                     "note","comment","remark","description","code"))

    def fmt(v):
        if v is None: return "—"
        try:
            v = float(v)
            if math.isnan(v): return "—"
        except:
            return "—"
        if abs(v) >= 1e7: return f"₹{v/1e7:.2f} Cr"
        if abs(v) >= 1e5: return f"₹{v/1e5:.2f} L"
        if abs(v) >= 1000: return f"{v/1000:.1f}K"
        return f"{v:.1f}"

    def raw(v):
        if v is None: return None
        try: 
            f = float(v)
            if math.isnan(f): return None
            return f
        except: return None

    # ── KPIs (AI-powered smart selection) ──────────────────────────────────────
    import json as _json

    def _ai_pick_kpis():
        """Use AI to select the most meaningful KPIs like a data analyst."""
        sample = ds.get("sample_rows", [])
        cat_stats = ds.get("categorical_stats", {})
        user_prompt = ds.get("prompt")
        
        schema_lines = []
        dictionary = ds.get("semantic_dictionary", {})
        for col in columns:
            desc = ""
            if col in dictionary:
                dfn = dictionary[col]
                desc = f" | Label: {dfn['label']} | Desc: {dfn['description']} | Category: {dfn['category']}"
                
            if col in numeric_stats:
                s = numeric_stats[col]
                schema_lines.append(f"  {col} (Numeric) — min: {s['min']}, max: {s['max']}, sum: {s['sum']}{desc}")
            elif col in date_cols:
                schema_lines.append(f"  {col} (Date){desc}")
            elif col in cat_stats:
                vals = cat_stats[col][:8]
                schema_lines.append(f"  {col} (Categorical) — {len(vals)} values: {vals}{desc}")
            else:
                schema_lines.append(f"  {col} (Text/ID){desc}")

        total_rows = safe_val(f"SELECT COUNT(*) FROM {table}")

        user_instruction = ""
        if user_prompt:
            user_instruction = f"""
USER'S SPECIFIC REQUEST: "{user_prompt}"
IMPORTANT: You MUST prioritize KPIs that directly address the user's request above.
If the user mentions specific metrics (e.g. "revenue", "calls", "duration"), those MUST appear as KPIs.
Adapt the remaining KPIs to complement the user's focus area."""
        
        sys_prompt = f"""You are a senior data analyst. Given a dataset schema, pick the 4 most useful KPI cards for an executive dashboard.
{user_instruction}

DATASET: {total_rows} rows
COLUMNS:
{chr(10).join(schema_lines)}

SAMPLE DATA:
{_json.dumps(sample[:2], default=str)}

Return a JSON array of exactly 4 KPI objects. Each object:
{{
  "col": "column_name or null",
  "agg": "SUM|AVG|COUNT|COUNT_DISTINCT|MIN|MAX",
  "label": "Human-readable KPI title",
  "format": "number|currency|percent|count",
  "rationale": "why this KPI matters"
}}

RULES:
- Pick KPIs that a manager/executive would actually care about
- Always include a "Total Records" count as one KPI
- For financial columns (revenue, cost, amount, etc.) use SUM and currency format
- For demographic/measurement columns (age, score, rating) use AVG
- For categorical columns use COUNT_DISTINCT (e.g. "Unique Departments")
- NEVER sum IDs, serial numbers, phone numbers, or codes
- NEVER sum age, weight, height, BMI, or similar per-person measurements
- The "col" field must EXACTLY match a column name from the schema, or be null for COUNT(*)
- Only return valid JSON array. No markdown."""

        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": sys_prompt}],
                max_tokens=500,
                temperature=0.0,
            )
            raw = resp.choices[0].message.content.strip()
            start = raw.find("[")
            end = raw.rfind("]")
            if start != -1 and end != -1:
                raw = raw[start:end+1]
            return _json.loads(raw)
        except Exception as e:
            logger.warning(f"AI KPI selection failed: {e}")
            return None

    if "ai_kpi_specs" in ds:
        ai_kpi_specs = ds["ai_kpi_specs"]
    elif ds.get("ai_kpi_failed"):
        ai_kpi_specs = None
    else:
        ai_kpi_specs = _ai_pick_kpis()
        if ai_kpi_specs:
            ds["ai_kpi_specs"] = ai_kpi_specs
        else:
            ds["ai_kpi_failed"] = True
    kpis = []

    if ai_kpi_specs:
        for spec in ai_kpi_specs[:4]:
            col = spec.get("col")
            agg = spec.get("agg", "SUM").upper()
            label = spec.get("label", col or "Count")
            fmt_type = spec.get("format", "number")
            
            if col is None or agg in ("COUNT",):
                # Total record count
                val = safe_val(f"SELECT COUNT(*) FROM {table}")
                if val is not None:
                    kpis.append({
                        "label": label, "total": f"{int(val):,}",
                        "total_label": "Count", "avg": "—", "min": "—", "max": "—", "is_rate": False,
                    })
                continue

            if col not in columns:
                continue

            safe_col = col.replace('"', '""')
            
            if agg == "COUNT_DISTINCT":
                val = safe_val(f'SELECT COUNT(DISTINCT "{safe_col}") FROM {table}')
                if val is not None:
                    kpis.append({
                        "label": label, "total": f"{int(val):,}",
                        "total_label": "Unique", "avg": "—", "min": "—", "max": "—", "is_rate": False,
                    })
                continue

            # Numeric aggregation
            agg_sql_map = {
                "SUM": f'SUM(TRY_CAST("{safe_col}" AS DOUBLE))',
                "AVG": f'AVG(TRY_CAST("{safe_col}" AS DOUBLE))',
                "MIN": f'MIN(TRY_CAST("{safe_col}" AS DOUBLE))',
                "MAX": f'MAX(TRY_CAST("{safe_col}" AS DOUBLE))',
                "COUNT": "COUNT(*)",
            }
            agg_expr = agg_sql_map.get(agg, agg_sql_map["SUM"])
            main_val = safe_val(f'SELECT {agg_expr} FROM {table}')
            avg_val = safe_val(f'SELECT AVG(TRY_CAST("{safe_col}" AS DOUBLE)) FROM {table}')
            min_val = safe_val(f'SELECT MIN(TRY_CAST("{safe_col}" AS DOUBLE)) FROM {table}')
            max_val = safe_val(f'SELECT MAX(TRY_CAST("{safe_col}" AS DOUBLE)) FROM {table}')

            if main_val is None:
                continue

            main_label = {"SUM": "Total", "AVG": "Average", "MIN": "Minimum", "MAX": "Maximum"}.get(agg, "Total")

            kpis.append({
                "label": label,
                "total": fmt(main_val),
                "total_label": main_label,
                "avg": fmt(avg_val),
                "min": fmt(min_val),
                "max": fmt(max_val),
                "is_rate": agg == "AVG",
                "_raw_avg": raw(avg_val),
                "_raw_total": raw(main_val),
                "_raw_min": raw(min_val),
                "_raw_max": raw(max_val),
            })

    # Fallback: if AI failed or returned nothing, use basic heuristic
    if not kpis:
        total_rows = safe_val(f"SELECT COUNT(*) FROM {table}")
        if total_rows:
            kpis.append({
                "label": "Total Records", "total": f"{int(total_rows):,}",
                "total_label": "Count", "avg": "—", "min": "—", "max": "—", "is_rate": False,
                "config": {"measure": "", "agg": "COUNT"}
            })
        # Add top numeric columns by priority
        SUM_KW = ("revenue","billed","billing","amount","collected","income","payment","paid","charge","fee","cost","expense","profit","total")
        for col in numeric_stats:
            if len(kpis) >= 4: break
            cl = col.lower()
            if any(k in cl for k in SUM_KW):
                val = safe_val(f'SELECT SUM(TRY_CAST("{col}" AS DOUBLE)) FROM {table}')
                avg_v = safe_val(f'SELECT AVG(TRY_CAST("{col}" AS DOUBLE)) FROM {table}')
                if val is not None:
                    kpis.append({
                        "label": col, "total": fmt(val), "total_label": "Total",
                        "avg": fmt(avg_v), "min": fmt(numeric_stats[col]["min"]),
                        "max": fmt(numeric_stats[col]["max"]), "is_rate": False,
                        "config": {"measure": col, "agg": "SUM"}
                    })

    # ── Charts ───────────────────────────────────────────────────────────────
    _COLORS = ["#c52626","#449042","#1565C0","#F57C00","#6A1B9A","#00897B","#e05555","#2d6b2b"]
    charts  = []
    ci      = 0

    def nc():
        nonlocal ci
        c = _COLORS[ci % len(_COLORS)]; ci += 1; return c

    def unfiltered_safe_rows(sql):
        try:
            records = con.execute(sql).fetchdf().to_dict(orient="records")
            for row in records:
                for k, v in row.items():
                    if isinstance(v, float) and __import__("math").isnan(v):
                        row[k] = None
            return records
        except Exception:
            return []

    good_cat = []
    for col in columns:
        if col in date_cols or col in numeric_stats or is_skip(col): continue
        r = unfiltered_safe_rows(f'SELECT COUNT(DISTINCT "{col}") AS n FROM {table} WHERE "{col}" IS NOT NULL')
        n = r[0]["n"] if r else 0
        if 2 <= n <= 15:
            good_cat.append((col, n))

    filters = []
    for c, n in good_cat:
        r = unfiltered_safe_rows(f'SELECT DISTINCT "{c}" AS val FROM {table} WHERE "{c}" IS NOT NULL LIMIT 30')
        vals = [row["val"] for row in r if row["val"]]
        if vals:
             filters.append({"col": c, "values": vals})

    # ── AI Generation (if prompt provided) ──────────────────────────────────
    user_prompt = ds.get("prompt")
    if user_prompt:
        import json
        schema_info = f"Columns: {columns}\nNumeric columns: {list(numeric_stats.keys())}\nDate columns: {date_cols}\nCategorical columns: {[c for c, n in good_cat]}\n"
        sys_msg = (
            "You are an expert dashboard builder. The user wants a custom dashboard based on their prompt.\n"
            f"{schema_info}\n"
            "Return a JSON object with an 'items' array. You can define up to 4 KPIs and up to 8 charts.\n"
            "Format:\n"
            "{\n"
            '  "items": [\n'
            '    {"type": "kpi", "measure": "column_name", "agg": "SUM|AVG|COUNT", "label": "Title"},\n'
            '    {"type": "chart", "chart_type": "bar|pie|area|hbar|radar", "dimension": "column_name", "measure": "column_name", "agg": "SUM|AVG|COUNT", "title": "Chart Title"}\n'
            '  ]\n'
            "}\n"
            "For 'area' charts, 'dimension' MUST be a date column. For pie/bar/hbar/radar, 'dimension' MUST be a categorical column.\n"
            "Only return valid JSON without markdown formatting."
        )
        try:
            if "ai_spec" in ds:
                ai_spec = ds["ai_spec"]
            elif ds.get("ai_generation_failed"):
                raise Exception("AI generation previously failed for this dataset, skipping.")
            else:
                resp = client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": sys_msg},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=1000,
                )
                raw_content = resp.choices[0].message.content.strip()
                start = raw_content.find("{")
                end = raw_content.rfind("}")
                if start != -1 and end != -1:
                    raw_content = raw_content[start:end+1]
                
                ai_spec = json.loads(raw_content)
                ds["ai_spec"] = ai_spec
            
            ai_kpis = []
            ai_charts = []
            for item in ai_spec.get("items", []):
                if item.get("type") == "kpi":
                    try:
                        f_dict = {}
                        if filter_col and filter_val:
                            f_dict[filter_col] = filter_val
                        if cross_filter_col and cross_filter_val:
                            f_dict[cross_filter_col] = cross_filter_val
                            
                        kreq = BuildKpiRequest(
                            file_id=file_id, 
                            measure=item["measure"], 
                            agg=item.get("agg", "SUM"), 
                            label=item.get("label", item["measure"]),
                            filters=f_dict
                        )
                        kres = await build_custom_kpi(kreq)
                        if "error" not in kres and "label" in kres:
                            ai_kpis.append(kres)
                    except Exception as e:
                        print(f"AI KPI error: {e}")
                elif item.get("type") == "chart":
                    try:
                        f_dict = {}
                        if filter_col and filter_val:
                            f_dict[filter_col] = filter_val
                        if cross_filter_col and cross_filter_val:
                            f_dict[cross_filter_col] = cross_filter_val
                            
                        creq = BuildChartRequest(
                            file_id=file_id,
                            dimension=item["dimension"],
                            measure=item["measure"],
                            agg=item.get("agg", "SUM"),
                            chart_type=item.get("chart_type", "bar"),
                            filters=f_dict
                        )
                        cres = await build_custom_chart(creq)
                        if "error" not in cres and "data" in cres:
                            cres["title"] = item.get("title", cres.get("title", ""))
                            ai_charts.append(cres)
                    except Exception as e:
                        print(f"AI chart error: {e}")
            
            if ai_kpis or ai_charts:
                _COLORS = ["#c52626","#449042","#1565C0","#F57C00","#6A1B9A","#00897B","#e05555","#2d6b2b"]
                for i, c in enumerate(ai_charts):
                    c["color"] = _COLORS[i % len(_COLORS)]
                
                return {"file_id": file_id, "kpis": ai_kpis[:4], "charts": ai_charts[:8], "filters": filters[:3], "date_cols": date_cols}
        except Exception as e:
            print(f"AI dashboard generation failed: {e}")
            ds["ai_generation_failed"] = True
            # Fallback to heuristic generation


    # 1. Revenue trend (full width)
    if date_cols and numeric_stats:
        dc = date_cols[0]
        vc = next((c for c in numeric_stats if any(k in c.lower() for k in
            ("revenue","billed","amount","collected","income","billing","payment"))),
            list(numeric_stats.keys())[0])
        rows = safe_rows(
            f'SELECT CAST("{dc}" AS VARCHAR) AS date, '
            f'ROUND(SUM(TRY_CAST("{vc}" AS DOUBLE)),2) AS value '
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f'GROUP BY "{dc}" ORDER BY "{dc}" ASC LIMIT 60'
        )
        unf = unfiltered_safe_rows(
            f'SELECT CAST("{dc}" AS VARCHAR) AS date, '
            f'ROUND(SUM(TRY_CAST("{vc}" AS DOUBLE)),2) AS value '
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f'GROUP BY "{dc}" ORDER BY "{dc}" ASC LIMIT 60'
        )
        if len(unf) >= 3:
            charts.append({"id":"trend","type":"area","size":"full",
                "title":f"{vc} Over Time","xKey":"date","yKey":"value","data":rows,"color":nc(), "dimension": dc})

    # 2. Monthly record count (full width)
    if date_cols and len(charts) < 2:
        dc = date_cols[0]
        rows = safe_rows(
            f"SELECT STRFTIME(CAST(\"{dc}\" AS DATE),'%Y-%m') AS label, COUNT(*) AS value "
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f"GROUP BY label ORDER BY label ASC LIMIT 24"
        )
        unf = unfiltered_safe_rows(
            f"SELECT STRFTIME(CAST(\"{dc}\" AS DATE),'%Y-%m') AS label, COUNT(*) AS value "
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f"GROUP BY label ORDER BY label ASC LIMIT 24"
        )
        if len(unf) >= 3:
            charts.append({"id":"monthly","type":"bar","size":"full",
                "title":"Monthly Record Volume","xKey":"label","yKey":"value","data":rows,"color":nc(), "dimension": dc})

    # 3. Pie donut (half width)
    for col, n in sorted(good_cat, key=lambda x: x[1]):
        if n > 8: continue
        rows = safe_rows(
            f'SELECT "{col}" AS label, COUNT(*) AS value FROM {table} '
            f'WHERE "{col}" IS NOT NULL GROUP BY "{col}" ORDER BY value DESC LIMIT 8'
        )
        unf = unfiltered_safe_rows(f'SELECT "{col}" AS label, COUNT(*) AS value FROM {table} WHERE "{col}" IS NOT NULL GROUP BY "{col}"')
        if 2 <= len(unf) <= 8:
            charts.append({"id":f"pie_{col}","type":"pie","size":"half",
                "title":f"{col} Distribution","data":rows,"color":nc(), "dimension": col})
            break

    # 4 & 5. Bar breakdowns (half width)
    bar_done = 0
    for col, _ in good_cat:
        if bar_done >= 2: break
        if any(c["id"] == f"pie_{col}" for c in charts): continue
        rows = safe_rows(
            f'SELECT "{col}" AS label, COUNT(*) AS value FROM {table} '
            f'WHERE "{col}" IS NOT NULL GROUP BY "{col}" ORDER BY value DESC LIMIT 10'
        )
        if len(rows) < 2: continue
        charts.append({"id":f"bar_{col}","type":"bar","size":"half",
            "title":f"{col} Breakdown","xKey":"label","yKey":"value","data":rows,"color":nc(), "dimension": col})
        bar_done += 1

    # 6. Horizontal bar — category vs metric (AVG for demos, SUM for financials)
    # Always try to include one hbar for a clear comparison view
    SUM_KEYS = ("revenue","billed","billing","amount","collected","income",
                "payment","paid","charge","fee","cost","expense","profit","total")
    AVG_KEYS = ("age","weight","height","bmi","score","duration","days",
                "length","stay","pulse","bp","rate","temperature","temp")

    if good_cat and numeric_stats:
        # Prefer a financial col for SUM hbar, else fall back to avg of a demo col
        fin_col = next((c for c in numeric_stats
            if any(k in c.lower() for k in SUM_KEYS)), None)
        avg_col = next((c for c in numeric_stats
            if any(k in c.lower() for k in AVG_KEYS)), None)

        if fin_col:
            cat_col = good_cat[0][0]
            rows = safe_rows(
                f'SELECT "{cat_col}" AS label, '
                f'ROUND(SUM(TRY_CAST("{fin_col}" AS DOUBLE)),2) AS value '
                f'FROM {table} WHERE "{cat_col}" IS NOT NULL '
                f'GROUP BY "{cat_col}" ORDER BY value DESC LIMIT 10'
            )
            if len(rows) >= 2:
                charts.append({"id":"hbar_fin","type":"hbar","size":"half",
                    "title":f"Total {fin_col} by {cat_col}",
                    "xKey":"value","yKey":"label","data":rows,"color":nc(), "dimension": cat_col})

        if avg_col and good_cat:
            cat_col = good_cat[0][0]
            rows = safe_rows(
                f'SELECT "{cat_col}" AS label, '
                f'ROUND(AVG(TRY_CAST("{avg_col}" AS DOUBLE)),1) AS value '
                f'FROM {table} WHERE "{cat_col}" IS NOT NULL '
                f'GROUP BY "{cat_col}" ORDER BY value DESC LIMIT 10'
            )
            if len(rows) >= 2:
                charts.append({"id":"hbar_avg","type":"hbar","size":"half",
                    "title":f"Average {avg_col} by {cat_col}",
                    "xKey":"value","yKey":"label","data":rows,"color":nc(), "dimension": cat_col})

    # 7. Numeric averages comparison (half width) — AVG only, never SUM
    num_cols = [c for c in numeric_stats
        if not any(k in c.lower() for k in ("rate","score","pct","percent","ratio"))][:6]
    if len(num_cols) >= 2:
        sp = ", ".join(f'ROUND(AVG(TRY_CAST("{c}" AS DOUBLE)),1) AS "{c}"' for c in num_cols)
        rows = safe_rows(f"SELECT {sp} FROM {table}")
        if rows:
            bd = [{"label": c, "value": rows[0].get(c) or 0} for c in num_cols]
            bd = [r for r in bd if r["value"]]
            if len(bd) >= 2:
                charts.append({"id":"num_avgs","type":"bar","size":"half",
                    "title":"Average per Column","xKey":"label","yKey":"value",
                    "data":bd,"color":nc()})

    pinned_charts_refreshed = []
    pinned_kpis_refreshed = []
    try:
        conf_row = con.execute("SELECT config FROM dashboard_configs WHERE file_id = ?", [file_id]).fetchone()
        if conf_row and conf_row[0]:
            import json
            ds_config = json.loads(conf_row[0])
            pinned_charts_refreshed = ds_config.get("pinnedCharts", [])
            pinned_kpis_refreshed = ds_config.get("pinnedKpis", [])
    except Exception as e:
        logger.error(f"Failed to load pinned items: {e}")

    return {
        "file_id": file_id, 
        "kpis": kpis, 
        "charts": charts[:8], 
        "filters": filters[:3], 
        "date_cols": date_cols,
        "pinned_charts": pinned_charts_refreshed,
        "pinned_kpis": pinned_kpis_refreshed
    }


# ── Custom Chart Builder ──────────────────────────────────────────────────────

@router.post("/build_chart")
async def build_custom_chart(req: BuildChartRequest, user=Depends(require_user)):
    check_dashboard_access(req.file_id, user)
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[req.file_id]
    table = ds["table"]
    
    # AI Prompt handling
    if req.prompt:
        import json
        sys_msg = (
            "You are a SQL/Charting assistant. The user provided a natural language prompt to build a chart.\n"
            f"Columns: {ds.get('columns')}\n"
            f"Numeric columns: {list(ds.get('numeric_stats', {}).keys())}\n"
            f"Date columns: {ds.get('date_cols', [])}\n"
            f"Semantic Dictionary: {ds.get('semantic_dictionary', {})}\n"
            f"Currently selected dimension: '{req.dimension}'\n"
            f"Currently selected measure: '{req.measure}'\n"
            "Return a JSON object specifying how to build the chart.\n"
            "Format: {\"dimension\": \"col_name\", \"measure\": \"col_name\", \"agg\": \"SUM|AVG|COUNT|COUNT_DISTINCT|MIN|MAX\", \"chart_type\": \"bar|hbar|line|area|pie|radar\", \"time_grouping\": \"none|weekday|day|month|quarter|year\", \"filters\": {\"optional_col\": \"optional_val\"}}\n"
            "If they want a count, measure can be the same as dimension or any column, and agg must be 'COUNT'. If they want unique counts, use 'COUNT_DISTINCT'.\n"
            "If the user asks to filter data (e.g. 'call type is incoming'), add it to the 'filters' object.\n"
            "Only return valid JSON."
        )
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "system", "content": sys_msg}, {"role": "user", "content": req.prompt}],
                max_tokens=200,
            )
            raw = resp.choices[0].message.content.strip()
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                raw = raw[start:end+1]
            spec = json.loads(raw)
            req.dimension = spec.get("dimension", req.dimension)
            req.measure = spec.get("measure", req.measure)
            req.agg = spec.get("agg", "SUM").upper()
            req.chart_type = spec.get("chart_type", "bar")
            time_grouping = spec.get("time_grouping", req.time_grouping)
            filter_col = spec.get("filter_col") # fallback 
            filter_val = spec.get("filter_val")
            req.filters = spec.get("filters", req.filters or {})
            if filter_col and filter_val and not req.filters:
                req.filters[filter_col] = filter_val
        except Exception as e:
            print(f"[Build Chart AI Error] {e}")
            raise HTTPException(status_code=400, detail="Failed to understand the prompt. Please select columns manually.")
    else:
        time_grouping = req.time_grouping

    if not req.dimension:
        raise HTTPException(status_code=400, detail="Dimension is required.")

    # Substitute calc fields before building SQL
    calc_fields = ds.get("calc_fields", {})
    
    # Safely escape quotes and substitute
    dim_raw = req.dimension
    if dim_raw in calc_fields:
        dim = f"({calc_fields[dim_raw]['sql']})"
    else:
        dim_esc = dim_raw.replace('"', '""')
        dim = f'"{dim_esc}"'
        
    measure_raw = req.measure
    if measure_raw in calc_fields:
        measure = f"({calc_fields[measure_raw]['sql']})"
    else:
        measure_esc = measure_raw.replace('"', '""')
        measure = f'"{measure_esc}"'
        
    # We don't need to replace label_col inside label_sql because we can just construct its raw string here
    label_col_raw = req.label_col
    label_col_sql = ""
    if label_col_raw:
        if label_col_raw in calc_fields:
            label_col_sql = f"({calc_fields[label_col_raw]['sql']})"
        else:
            label_col_esc = label_col_raw.replace('"', '""')
            label_col_sql = f'"{label_col_esc}"'

    agg_op = req.agg.upper()
    valid_aggs = {"SUM", "AVG", "COUNT", "MAX", "MIN", "COUNT_DISTINCT"}
    if agg_op not in valid_aggs:
        agg_op = "SUM"
        
    if agg_op == "COUNT":
        val_sql = "COUNT(*)"
    elif agg_op == "COUNT_DISTINCT":
        val_sql = f'COUNT(DISTINCT {measure})'
    elif agg_op == "AVG":
        val_sql = f'ROUND(AVG(TRY_CAST({measure} AS DOUBLE)), 2)'
    else:
        val_sql = f'{agg_op}(TRY_CAST({measure} AS DOUBLE))'
        if agg_op == "SUM":
            val_sql = f'ROUND({val_sql}, 2)'

    limit = req.limit
    if not limit:
        limit = 10 if req.chart_type == "pie" else 40

    dim_sql = f'CAST({dim} AS VARCHAR)'
    
    # Handle time grouping if specified
    if time_grouping != "none":
        if time_grouping == "hour":
            dim_sql = f"STRFTIME(CAST({dim} AS TIMESTAMP), '%H:00')"
        elif time_grouping in ["day", "date"]:
            dim_sql = f"STRFTIME(CAST({dim} AS DATE), '%Y-%m-%d')"
        elif time_grouping == "week":
            dim_sql = f"STRFTIME(DATE_TRUNC('week', CAST({dim} AS DATE)), '%Y-%m-%d')"
        elif time_grouping == "month":
            dim_sql = f"STRFTIME(CAST({dim} AS DATE), '%Y-%m')"
        elif time_grouping == "year":
            dim_sql = f"STRFTIME(CAST({dim} AS DATE), '%Y')"
        elif time_grouping == "weekday":
            dim_sql = f"STRFTIME(CAST({dim} AS DATE), '%w-%A')"
        elif time_grouping == "quarter":
            dim_sql = f"CONCAT(YEAR(CAST({dim} AS DATE)), '-Q', QUARTER(CAST({dim} AS DATE)))"

    filter_sql = f'WHERE {dim} IS NOT NULL '
    if req.filters:
        for fc, fv in req.filters.items():
            if fc in calc_fields:
                fc_sql = f"({calc_fields[fc]['sql']})"
            else:
                fc_esc = str(fc).replace('"', '""')
                fc_sql = f'"{fc_esc}"'
                
            if isinstance(fv, list):
                if not fv:
                    filter_sql += f" AND FALSE "
                else:
                    vals_joined = ", ".join(f"'{str(x).replace('\'', '\'\'')}'" for x in fv)
                    filter_sql += f" AND {fc_sql} IN ({vals_joined}) "
            else:
                fv_esc = str(fv).replace("'", "''")
                filter_sql += f" AND {fc_sql} = '{fv_esc}' "

    if req.advanced_filters:
        for f in req.advanced_filters:
            fc = f.get("col")
            op = f.get("op", "=")
            val = f.get("val", "")
            
            if str(val).startswith("@"):
                param_name = str(val)[1:]
                if req.parameters and param_name in req.parameters:
                    val = req.parameters[param_name]
                    
            if not fc or not val:
                continue
                
            if op == "<=" and isinstance(val, str) and len(val) == 10 and val.count("-") == 2:
                val = f"{val} 23:59:59"
                
            fc_esc = str(fc).replace('"', '""')
            fv_esc = str(val).replace("'", "''")
            
            allowed_ops = {"=", "!=", ">", "<", ">=", "<="}
            if op not in allowed_ops:
                op = "="
                
            filter_sql += f" AND \"{fc_esc}\" {op} '{fv_esc}' "

    label_sql = ""
    if req.label_col:
        agg_l = req.label_agg or "MAX"
        label_sql = f', {agg_l}({label_col_sql}) AS _label_ext'

    group_by_sql = ""
    group_col = ""
    if req.group_by:
        group_by_raw = req.group_by
        if group_by_raw in calc_fields:
            group_by_sql = f", ({calc_fields[group_by_raw]['sql']}) AS group_val"
            group_col = f", ({calc_fields[group_by_raw]['sql']})"
        else:
            group_by_esc = group_by_raw.replace('"', '""')
            group_by_sql = f', "{group_by_esc}" AS group_val'
            group_col = f', "{group_by_esc}"'

    extra_select_sql = ""
    extra_group_sql = ""
    if req.chart_type == "table" and req.extra_cols:
        for i, col_raw in enumerate(req.extra_cols):
            if col_raw in calc_fields:
                expr = f"({calc_fields[col_raw]['sql']})"
            else:
                col_esc = col_raw.replace('"', '""')
                expr = f'"{col_esc}"'
            extra_select_sql += f', {expr} AS extra_{i}'
            extra_group_sql += f', {expr}'

    sql = (
        f'SELECT {dim_sql} AS label{group_by_sql}{extra_select_sql}, '
        f'{val_sql} AS value{label_sql} '
        f'FROM {table} '
        f'{filter_sql} '
        f'GROUP BY label{group_col}{extra_group_sql} '
        f'HAVING {val_sql} IS NOT NULL '
        f'ORDER BY 1 ASC LIMIT {limit}' if time_grouping != "none" else 
        f'SELECT {dim_sql} AS label{group_by_sql}{extra_select_sql}, '
        f'{val_sql} AS value{label_sql} '
        f'FROM {table} '
        f'{filter_sql} '
        f'GROUP BY {dim}{group_col}{extra_group_sql} '
        f'HAVING {val_sql} IS NOT NULL '
        f'ORDER BY 2 DESC LIMIT {limit}'
    )
    
    logger.info(f"DEBUG BUILD_CHART: parameters={req.parameters} advanced_filters={req.advanced_filters}")
    
    debug_msg = f"DEBUG BUILD_CHART: parameters={req.parameters} advanced_filters={req.advanced_filters}\nDEBUG BUILD_CHART SQL: {sql}\n\n"
    with open("debug_log.txt", "a") as f:
        f.write(debug_msg)
    
    try:
        rows = con.execute(sql).fetchdf().to_dict(orient="records")
        if not rows:
            return {"error": "No data returned for this combination."}
            
        chart_id = f"custom_{datetime.now().strftime('%M%S%f')}"
        title = f"{agg_op.title()} of {req.measure} by {req.dimension}"
        if agg_op == "COUNT":
            title = f"Record Count by {req.dimension}"

        return {
            "id": chart_id,
            "type": req.chart_type,
            "title": title,
            "data": rows,
            "xKey": "label",
            "yKey": "value",
            "size": "half",
            "config": {
                "dimension": req.dimension,
                "measure": req.measure,
                "agg": req.agg,
                "chart_type": req.chart_type,
                "time_grouping": time_grouping,
                "filters": req.filters or {},
                "limit": limit,
                "group_by": req.group_by,
                "label_col": req.label_col,
                "label_agg": req.label_agg or "MAX",
                "mapRegion": req.map_region,
                "gaugeTarget": req.gauge_target,
                "extraCols": req.extra_cols
            }
        }
    except Exception as e:
        print(f"[Build Chart Error] SQL: {sql} | Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build chart: {str(e)}")


# ── Custom KPI Builder ─────────────────────────────────────────────────────────

@router.post("/build_kpi")
async def build_custom_kpi(req: BuildKpiRequest, user=Depends(require_user)):
    check_dashboard_access(req.file_id, user)
    import traceback
    try:
        return await _build_custom_kpi(req)
    except Exception as e:
        with open("d:/MediQuery/kpi_crash.log", "w") as f:
            f.write(traceback.format_exc())
        raise

async def _build_custom_kpi(req: BuildKpiRequest):
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[req.file_id]
    table = ds["table"]
    
    if req.prompt:
        try:
            import json
            sys_msg = (
                "You are a Data Analyst AI. You must return EXACTLY valid JSON, nothing else.\n"
                f"Columns available: {list(ds['columns'])}\n"
                f"Numeric columns: {list(ds.get('numeric_stats', {}).keys())}\n"
                f"Semantic Dictionary: {ds.get('semantic_dictionary', {})}\n"
                "Determine the best numeric column (measure) and aggregation (agg) for this KPI request.\n"
                "Valid aggs: ALL, SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX.\n"
                "If asking for just a 'count of records', measure MUST be a valid column from the list, do NOT leave it empty.\n"
                "If asking to filter data (e.g. 'call type is incoming'), add it to the 'filters' object.\n"
                "Return JSON format: {\"measure\": \"ColumnName\", \"agg\": \"SUM\", \"label\": \"Suggested Label\", \"filters\": {\"optional\": \"optional\"}}"
            )
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": f"Request: {req.prompt}"}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )
            ai_data = json.loads(resp.choices[0].message.content)
            req.measure = ai_data.get("measure", req.measure)
            req.agg = ai_data.get("agg", "ALL")
            req.label = ai_data.get("label", req.label)
            req.filters = ai_data.get("filters", req.filters or {})
            if "filter_col" in ai_data and "filter_val" in ai_data and not req.filters:
                req.filters[ai_data["filter_col"]] = ai_data["filter_val"]
        except Exception as e:
            logger.error(f"AI KPI builder failed: {e}")
            raise HTTPException(status_code=400, detail="AI could not determine the KPI config. Try manually.")

    # Clean up measure
    if req.measure:
        req.measure = req.measure.strip().strip('"').strip("'")
        
    if not req.measure or req.measure not in ds["columns"]:
        if ds["columns"]:
            req.measure = ds["columns"][0] # Fallback to first column
            if req.agg not in ("COUNT", "COUNT_DISTINCT", "ALL"):
                req.agg = "COUNT"
        else:
            raise HTTPException(status_code=400, detail=f"Invalid or missing measure: {req.measure}")

    col = req.measure.replace('"', '""')
    agg = req.agg.upper()
    label = req.label or req.measure

    def fmt(v):
        if v is None: return "N/A"
        try:
            v = float(v)
            if math.isnan(v): return "N/A"
            if abs(v) >= 1_00_00_000: return f"₹{v/1_00_00_000:.2f} Cr"
            if abs(v) >= 1_00_000:    return f"₹{v/1_00_000:.2f} L"
            if abs(v) >= 1_000:       return f"{v/1_000:.1f}K"
            return f"{v:,.2f}"
        except Exception:
            return str(v)

    def raw(v):
        if v is None: return None
        try: 
            v = float(v)
            if math.isnan(v): return None
            return v
        except: return None

    calc_fields = ds.get("calc_fields", {})
    
    filter_sql = f'WHERE "{col}" IS NOT NULL '
    if req.filters:
        for fc, fv in req.filters.items():
            if fc in calc_fields:
                fc_sql = f"({calc_fields[fc]['sql']})"
            else:
                fc_esc = str(fc).replace('"', '""')
                fc_sql = f'"{fc_esc}"'
                
            if isinstance(fv, list):
                if not fv:
                    filter_sql += f" AND FALSE "
                else:
                    vals_joined = ", ".join(f"'{str(x).replace('\'', '\'\'')}'" for x in fv)
                    filter_sql += f" AND {fc_sql} IN ({vals_joined}) "
            else:
                fv_esc = str(fv).replace("'", "''")
                filter_sql += f" AND {fc_sql} = '{fv_esc}' "

    if req.advanced_filters:
        for f in req.advanced_filters:
            fc = f.get("col")
            op = f.get("op", "=")
            val = f.get("val", "")
            
            if str(val).startswith("@"):
                param_name = str(val)[1:]
                if req.parameters and param_name in req.parameters:
                    val = req.parameters[param_name]
                    
            if not fc or not val:
                continue
                
            if op == "<=" and isinstance(val, str) and len(val) == 10 and val.count("-") == 2:
                val = f"{val} 23:59:59"
                
            fc_esc = str(fc).replace('"', '""')
            fv_esc = str(val).replace("'", "''")
            
            allowed_ops = {"=", "!=", ">", "<", ">=", "<="}
            if op not in allowed_ops:
                op = "="
                
            filter_sql += f" AND \"{fc_esc}\" {op} '{fv_esc}' "

    sql = ""
    try:
        if agg == "ALL":
            sql = f'''SELECT
                ROUND(SUM(TRY_CAST("{col}" AS DOUBLE)), 2) AS total,
                ROUND(AVG(TRY_CAST("{col}" AS DOUBLE)), 2) AS avg_val,
                ROUND(MIN(TRY_CAST("{col}" AS DOUBLE)), 2) AS min_val,
                ROUND(MAX(TRY_CAST("{col}" AS DOUBLE)), 2) AS max_val,
                COUNT(*) AS count_val,
                COUNT(DISTINCT "{col}") AS count_dist
            FROM {table} {filter_sql}'''
            row = con.execute(sql).fetchdf().iloc[0].to_dict()
            
            kpi_title = label

            return {
                "label": kpi_title, "_origLabel": label, "agg_mode": "ALL",
                "filters": req.filters or {},
                "avg":   fmt(row.get("avg_val")),
                "total": fmt(row.get("total")), "total_label": "Total",
                "min":   fmt(row.get("min_val")),
                "max":   fmt(row.get("max_val")),
                "count": f"{int(row.get('count_val', 0)):,}",
                "count_dist": f"{int(row.get('count_dist', 0)):,}",
                "_pinned": True,
                "_raw_avg":   raw(row.get("avg_val")),
                "_raw_total":  raw(row.get("total")),
                "_raw_min":    raw(row.get("min_val")),
                "_raw_max":    raw(row.get("max_val")),
                "config": {
                    "measure": req.measure,
                    "agg": req.agg,
                    "label": label,
                    "filters": req.filters or {}
                }
            }

        # Single aggregation modes
        agg_map = {
            "SUM":           f'ROUND(SUM(TRY_CAST("{col}" AS DOUBLE)), 2)',
            "AVG":           f'ROUND(AVG(TRY_CAST("{col}" AS DOUBLE)), 2)',
            "COUNT":         "COUNT(*)",
            "COUNT_DISTINCT": f'COUNT(DISTINCT "{col}")',
            "MIN":           f'ROUND(MIN(TRY_CAST("{col}" AS DOUBLE)), 2)',
            "MAX":           f'ROUND(MAX(TRY_CAST("{col}" AS DOUBLE)), 2)',
        }
        if agg not in agg_map:
            raise HTTPException(status_code=400, detail=f"Unknown aggregation: {agg}")

        sql = f'SELECT {agg_map[agg]} AS result FROM {table} {filter_sql}'
        logger.info(f"EXECUTING KPI SQL: {sql}")
        result = con.execute(sql).fetchdf().iloc[0]["result"]
        agg_label = agg.replace("_", " ").title()
        kpi_label = req.label if req.label else f"{agg_label} of {label}"
            
        formatted = fmt(result)
        raw_result = raw(result)
        return {
            "label": kpi_label, "_origLabel": kpi_label, "agg_mode": agg,
            "filters": req.filters or {},
            "avg":   formatted, "total": formatted, "total_label": agg_label,
            "min":   "—",       "max":   "—",        "count":       "—",
            "_pinned": True,
            "_raw_avg":   raw_result,
            "_raw_total":  raw_result,
            "_raw_min":    None,
            "_raw_max":    None,
            "config": {
                "measure": req.measure,
                "agg": req.agg,
                "label": label,
                "filters": req.filters or {}
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Build KPI Error] SQL: {sql} | Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build KPI: {str(e)}")


# ── Charts (legacy) ───────────────────────────────────────────────────────────

_CHART_COLORS  = ["#E53935","#1565C0","#00897B","#F57C00","#6A1B9A","#2E7D32"]
_SKIP_PATTERNS = ("id","name","patient","phone","email","address","note","comment","remark","description","code")

@router.get("/charts/{file_id}")
async def get_charts(file_id: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[file_id]
    if ds.get("mode") == "document":
        return {"charts": []}

    table         = ds["table"]
    columns       = ds["columns"]
    date_cols     = ds.get("date_cols", [])
    numeric_stats = ds.get("numeric_stats", {})
    charts        = []
    color_idx     = 0

    def next_color():
        nonlocal color_idx
        c = _CHART_COLORS[color_idx % len(_CHART_COLORS)]
        color_idx += 1
        return c

    def safe_rows(sql: str):
        try:
            return con.execute(sql).fetchdf().to_dict(orient="records")
        except Exception:
            return []

    def is_skip_col(col: str) -> bool:
        return any(p in col.lower() for p in _SKIP_PATTERNS)

    good_cat_cols = []
    for col in columns:
        if col in date_cols or col in numeric_stats or is_skip_col(col): continue
        r = unfiltered_safe_rows(f'SELECT COUNT(DISTINCT "{col}") AS n FROM {table} WHERE "{col}" IS NOT NULL')
        n = r[0]["n"] if r else 0
        if 2 <= n <= 15:
            good_cat_cols.append((col, n))

    if date_cols and numeric_stats:
        dc = date_cols[0]
        vc = next((c for c in numeric_stats if any(k in c.lower() for k in
            ("revenue","billed","amount","collected","income","billing","payment"))),
            list(numeric_stats.keys())[0])
        rows = safe_rows(
            f'SELECT CAST("{dc}" AS VARCHAR) AS date, '
            f'ROUND(SUM(TRY_CAST("{vc}" AS DOUBLE)),2) AS value '
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f'GROUP BY "{dc}" ORDER BY "{dc}" ASC LIMIT 60'
        )
        if len(rows) >= 3:
            charts.append({"id":"date_trend","type":"line",
                "title":f"{vc} Over Time","xKey":"date","yKey":"value",
                "yLabel":vc,"data":rows,"color":next_color()})

    for col, n in sorted(good_cat_cols, key=lambda x: x[1]):
        if n > 8: continue
        rows = safe_rows(
            f'SELECT "{col}" AS label, COUNT(*) AS value FROM {table} '
            f'WHERE "{col}" IS NOT NULL GROUP BY "{col}" ORDER BY value DESC LIMIT 8'
        )
        if 2 <= len(rows) <= 8:
            charts.append({"id":f"pie_{col}","type":"pie",
                "title":f"{col} Distribution","data":rows,"color":next_color()})
            break

    bar_done = 0
    for col, _ in good_cat_cols:
        if bar_done >= 2: break
        if any(c["id"] == f"pie_{col}" for c in charts): continue
        rows = safe_rows(
            f'SELECT "{col}" AS label, COUNT(*) AS value FROM {table} '
            f'WHERE "{col}" IS NOT NULL GROUP BY "{col}" ORDER BY value DESC LIMIT 12'
        )
        if len(rows) < 2: continue
        charts.append({"id":f"bar_{col}","type":"bar",
            "title":f"{col} Breakdown","xKey":"label","yKey":"value",
            "yLabel":"Count","data":rows,"color":next_color()})
        bar_done += 1

    if len(numeric_stats) >= 2:
        num_cols = [c for c in numeric_stats
            if not any(k in c.lower() for k in ("rate","score","pct","percent","ratio","id"))][:5]
        if len(num_cols) >= 2:
            sp = ", ".join(f'ROUND(AVG(TRY_CAST("{c}" AS DOUBLE)),1) AS "{c}"' for c in num_cols)
            rows = safe_rows(f"SELECT {sp} FROM {table}")
            if rows:
                bd = [{"label":c,"value":rows[0].get(c) or 0} for c in num_cols]
                bd = [r for r in bd if r["value"]]
                if len(bd) >= 2:
                    charts.append({"id":"numeric_avgs","type":"bar",
                        "title":"Average per Numeric Column",
                        "xKey":"label","yKey":"value","yLabel":"Average",
                        "data":bd,"color":next_color()})

    if len(charts) <= 1 and date_cols:
        dc = date_cols[0]
        rows = safe_rows(
            f"SELECT STRFTIME(CAST(\"{dc}\" AS DATE),'%Y-%m') AS label, COUNT(*) AS value "
            f'FROM {table} WHERE "{dc}" IS NOT NULL '
            f"GROUP BY label ORDER BY label ASC LIMIT 24"
        )
        if len(rows) >= 2:
            charts.append({"id":"monthly_count","type":"bar",
                "title":"Records per Month","xKey":"label","yKey":"value",
                "yLabel":"Count","data":rows,"color":next_color()})

    return {"file_id": file_id, "charts": charts[:6]}


@router.get("/column_values/{file_id}/{column_name}")
async def get_column_values(file_id: str, column_name: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ds = datasets[file_id]
    table = ds["table"]
    if column_name not in ds["columns"]:
        raise HTTPException(status_code=400, detail="Column not found")
    safe_col = column_name.replace('"', '""')
    try:
        rows = con.execute(f'SELECT DISTINCT "{safe_col}" AS val FROM {table} WHERE "{safe_col}" IS NOT NULL ORDER BY val ASC LIMIT 100').fetchdf().to_dict(orient="records")
        return {"values": [str(r["val"]) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


