import re
import pandas as pd
from fastapi import HTTPException

from config import con, client, MODEL_SQL
from sql.resolver import CONCEPT_MAP
from sql.sanitizer import extract_sql, sanitize_sql, fix_hallucinated_columns, ensure_columns_quoted


class _QueryFailed(Exception):
    """Internal — never surfaced to the user."""
    pass


def execute_with_retry(sql: str, columns: list, date_cols: list, table: str) -> pd.DataFrame:
    try:
        return con.execute(sql).fetchdf()
    except Exception as first_err:
        print(f"[SQL attempt 1 failed] {first_err}\nSQL: {sql}")
        fix_prompt = f"""This DuckDB SQL query failed:

Error: {first_err}

SQL:
{sql}

Table: {table}
Columns (MUST be double-quoted since they contain spaces): {columns}
Date columns (already DATE type — never cast them): {date_cols}

CRITICAL: All column names MUST be wrapped in double quotes e.g. "Total Billed In INR"
Return ONLY the corrected SQL. No markdown, no explanation."""
        try:
            resp = client.chat.completions.create(
                model=MODEL_SQL,
                messages=[{"role": "user", "content": fix_prompt}],
                max_tokens=400,
            )
            fixed_raw = (resp.choices[0].message.content or "").strip()
            fixed_sql = extract_sql(fixed_raw)
            fixed_sql = ensure_columns_quoted(fixed_sql, columns)
            fixed_sql = sanitize_sql(fixed_sql, date_cols)
            fixed_sql = fix_hallucinated_columns(fixed_sql, columns)
            return con.execute(fixed_sql).fetchdf()
        except Exception as retry_err:
            print(f"[SQL attempt 2 failed] {retry_err}")
            raise _QueryFailed("both attempts failed")


def verify_and_rerun(
    sql: str,
    result_df: pd.DataFrame,
    resolved: dict,
    question: str,
    table: str,
    columns: list,
    date_cols: list,
) -> pd.DataFrame:
    """Post-execution guard — if LLM grouped by the wrong column, rewrite and re-run."""
    gby_match = re.search(
        r"GROUP\s+BY\s+([\w,\s]+?)(?:\s+ORDER|\s+HAVING|\s+LIMIT|;|$)",
        sql, re.IGNORECASE
    )
    if not gby_match:
        return result_df

    actual_group_cols = {c.strip().lower() for c in gby_match.group(1).split(",")}
    q_lower = question.lower()
    mismatch = False

    for concept, correct_col in resolved.items():
        if concept not in ("doctor", "department", "patient", "insurance",
                           "admission_type", "city", "diagnosis"):
            continue
        if not any(t in q_lower for t in CONCEPT_MAP[concept]["question_triggers"]):
            continue
        if correct_col.lower() not in actual_group_cols:
            mismatch = True
            break

    if not mismatch:
        return result_df

    revenue_col = resolved.get("revenue")
    group_col = None

    for concept in ("doctor", "department", "patient", "insurance", "city", "diagnosis"):
        if concept in resolved and any(
            t in q_lower for t in CONCEPT_MAP[concept]["question_triggers"]
        ):
            group_col = resolved[concept]
            break

    if not group_col:
        return result_df

    if revenue_col:
        corrected_sql = (
            f"SELECT {group_col}, SUM({revenue_col}) AS total_revenue "
            f"FROM {table} WHERE {group_col} IS NOT NULL "
            f"GROUP BY {group_col} ORDER BY total_revenue DESC;"
        )
    else:
        corrected_sql = (
            f"SELECT {group_col}, COUNT(*) AS count "
            f"FROM {table} WHERE {group_col} IS NOT NULL "
            f"GROUP BY {group_col} ORDER BY count DESC;"
        )

    try:
        return con.execute(corrected_sql).fetchdf()
    except Exception:
        return result_df


def build_sql_prompt(
    question: str,
    table: str,
    columns: list,
    date_cols: list,
    sample_rows: list,
    numeric_stats: dict,
    categorical_stats: dict,
    column_directive: str,
    history: list[dict] = None,
) -> str:
    date_hint = ""
    if date_cols:
        date_hint = (
            f"\nDate columns (stored as DATE — compare using ISO 'YYYY-MM-DD'): {date_cols}\n"
            "NEVER use CAST(), STRPTIME(), or TO_DATE() on these — they are already dates.\n"
        )

    sample_hint = ""
    if sample_rows:
        lines = ["  " + " | ".join(f"{k}: {v}" for k, v in row.items()) for row in sample_rows]
        sample_hint = "\nSample rows (use EXACT column names):\n" + "\n".join(lines) + "\n"

    stats_hint = ""
    if numeric_stats:
        lines = [f"  {c}: sum={s['sum']}, min={s['min']}, max={s['max']}" for c, s in numeric_stats.items()]
        stats_hint = "\nNumeric column stats:\n" + "\n".join(lines) + "\n"

    cat_hint = ""
    if categorical_stats:
        lines = [f"  {c}: {vals}" for c, vals in categorical_stats.items()]
        cat_hint = "\nCategorical Values (use EXACTLY as spelled):\n" + "\n".join(lines) + "\n"

    directive_block = f"\n{column_directive}\n" if column_directive else ""

    history_block = ""
    if history:
        hist_lines = []
        for h in history[-6:]: # Keep last few messages to avoid token blowup
            role = "User" if h.get("role") == "user" else "AI"
            hist_lines.append(f"{role}: {h.get('text', '')}")
        history_block = "\nPrevious Conversation Context:\n" + "\n".join(hist_lines) + "\n"

    # Format columns with double quotes so the LLM sees exactly how to use them
    quoted_cols = [f'"{c}"' for c in columns]

    return f"""You are a DuckDB SQL expert. Generate ONLY a valid DuckDB SELECT statement.

Table: {table}
All columns (use EXACTLY as shown including double quotes): {quoted_cols}
{date_hint}{sample_hint}{stats_hint}{cat_hint}{directive_block}
CRITICAL RULES:
1. You MUST enclose your thinking inside <thought>...</thought> tags to reason about the exact column names and filter values to use.
2. You MUST enclose your final DuckDB SQL query inside <sql>...</sql> tags. The query must end with a semicolon.
3. ALWAYS wrap every column name in double quotes: "Column Name" — columns have spaces and SQL keywords in them.
4. For text filters use ILIKE: WHERE "col" ILIKE 'value'. Use the exact spelling from Categorical Values if available!
5. ALWAYS write WHERE "col" IS NOT NULL for any column used in GROUP BY.
6. Date filters must use ISO format: WHERE "date_col" = '2024-01-15'. NEVER use CAST/STRPTIME/TO_DATE on date columns.
7. If user says "how many", use COUNT(*). If user asks for money/revenue, use SUM() and ALWAYS end the alias with '_revenue' or '_amount' (e.g. AS total_revenue).
8. NEVER put double quotes inside string literals. Use 'value' or '%value%', NOT '"value"'.
9. If calculating a percentage or ratio, ALWAYS name the output alias ending with '_pct' (e.g. revenue_pct).

EXAMPLE — "doctor wise revenue":
<thought>
The user wants revenue by doctor. The categorical list shows "Doctor Name" and the metric is "Total Billed In INR". I will group by "Doctor Name" and sum the metric.
</thought>
<sql>
SELECT "Doctor Name", SUM("Total Billed In INR") AS total_revenue
FROM {table}
WHERE "Doctor Name" IS NOT NULL
GROUP BY "Doctor Name"
ORDER BY total_revenue DESC;
</sql>
{history_block}
Question: {question}
Answer:"""