from fastapi import APIRouter, HTTPException
import logging

from config import con, client, MODEL_FAST as MODEL, datasets

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/narrate/{file_id}")
async def narrate_dashboard(file_id: str):
    """Generate an AI executive narrative summary of the dashboard."""
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds = datasets[file_id]
    if ds.get("mode") == "document":
        raise HTTPException(status_code=400, detail="Narration not available for document mode.")

    table         = ds["table"]
    columns       = ds["columns"]
    date_cols     = ds.get("date_cols", [])
    numeric_stats = ds.get("numeric_stats", {})

    # ── Gather data context (no raw rows — just aggregated stats) ─────────
    context_parts = []

    # Row count
    try:
        row_count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        context_parts.append(f"Total records: {row_count:,}")
    except Exception:
        row_count = "?"

    # Numeric column stats
    for col, stats in numeric_stats.items():
        try:
            row = con.execute(
                f'SELECT ROUND(SUM(TRY_CAST("{col}" AS DOUBLE)),2) AS total, '
                f'ROUND(AVG(TRY_CAST("{col}" AS DOUBLE)),2) AS avg, '
                f'ROUND(MIN(TRY_CAST("{col}" AS DOUBLE)),2) AS min_val, '
                f'ROUND(MAX(TRY_CAST("{col}" AS DOUBLE)),2) AS max_val '
                f'FROM {table}'
            ).fetchone()
            context_parts.append(
                f"Column '{col}': Total={row[0]}, Average={row[1]}, Min={row[2]}, Max={row[3]}"
            )
        except Exception:
            pass

    # Top categorical breakdowns
    cat_stats = ds.get("categorical_stats", {})
    for col in list(cat_stats.keys())[:3]:
        try:
            rows = con.execute(
                f'SELECT "{col}" AS label, COUNT(*) AS cnt FROM {table} '
                f'WHERE "{col}" IS NOT NULL GROUP BY "{col}" ORDER BY cnt DESC LIMIT 5'
            ).fetchdf().to_dict(orient="records")
            if rows:
                breakdown = ", ".join(f"{r['label']} ({r['cnt']})" for r in rows)
                context_parts.append(f"Top values for '{col}': {breakdown}")
        except Exception:
            pass

    # Date range
    for dc in date_cols[:1]:
        try:
            dr = con.execute(
                f'SELECT MIN("{dc}") AS start_date, MAX("{dc}") AS end_date FROM {table} '
                f'WHERE "{dc}" IS NOT NULL'
            ).fetchone()
            if dr and dr[0] and dr[1]:
                context_parts.append(f"Date range ({dc}): {dr[0]} to {dr[1]}")
        except Exception:
            pass

    # Trends (monthly aggregation on first numeric col)
    if date_cols and numeric_stats:
        dc = date_cols[0]
        nc = list(numeric_stats.keys())[0]
        try:
            trend_rows = con.execute(
                f"SELECT STRFTIME(CAST(\"{dc}\" AS DATE),'%Y-%m') AS month, "
                f'ROUND(SUM(TRY_CAST("{nc}" AS DOUBLE)),2) AS total '
                f'FROM {table} WHERE "{dc}" IS NOT NULL '
                f"GROUP BY month ORDER BY month ASC LIMIT 12"
            ).fetchdf().to_dict(orient="records")
            if len(trend_rows) >= 2:
                trend_str = ", ".join(f"{r['month']}={r['total']}" for r in trend_rows)
                context_parts.append(f"Monthly trend for '{nc}': {trend_str}")
        except Exception:
            pass

    data_context = "\n".join(f"- {p}" for p in context_parts)

    # ── AI Prompt ─────────────────────────────────────────────────────────
    system_prompt = (
        "You are a senior business intelligence analyst presenting a dashboard summary to executives.\n"
        "Write a professional, insightful narrative (3-5 paragraphs) based on the data summary below.\n"
        "Guidelines:\n"
        "- Start with a high-level overview of the dataset\n"
        "- Highlight key metrics and their significance\n"
        "- Identify notable trends, patterns, or anomalies\n"
        "- Provide actionable insights or recommendations\n"
        "- Use concrete numbers from the data\n"
        "- Keep the tone professional but accessible\n"
        "- Use Indian number format (lakhs, crores) for large numbers\n"
        "- Do NOT use markdown headers or bullet points — write in flowing paragraphs\n"
        "- End with a forward-looking recommendation\n"
    )

    user_prompt = (
        f"Dataset Columns: {columns}\n"
        f"Semantic Dictionary: {ds.get('semantic_dictionary', {})}\n"
        f"Date columns: {date_cols}\n"
        f"Data summary:\n{data_context}\n\n"
        "Please write an executive narrative summary of this dashboard."
    )

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=800,
            temperature=0.7,
        )
        narrative = resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Narration AI error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate narrative.")

    return {
        "narrative": narrative,
        "row_count": row_count,
        "column_count": len(columns),
        "numeric_columns": list(numeric_stats.keys()),
    }
