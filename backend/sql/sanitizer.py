import re

# ── SQL keywords — never replace these with column names ─────────────────────
_SQL_KEYWORDS = {
    "select","from","where","group","by","order","having","limit",
    "count","sum","avg","max","min","round","distinct","as","and","or",
    "not","in","like","ilike","between","is","null","true","false",
    "asc","desc","on","join","inner","left","right","outer","case",
    "when","then","else","end","cast","try_cast","double","date",
    "varchar","integer","year","month","day","strptime","all","top",
    "with","over","partition","row_number","strftime","coalesce",
}

_BAD_FUNC_SUBS = [
    (r"\bEXIT\s*\(([^)]+)\)",                              r"\1"),
    (r"\bDATEPART\s*\(\s*'month'\s*,\s*([^)]+)\)",        r"MONTH(\1)"),
    (r"\bDATEPART\s*\(\s*'year'\s*,\s*([^)]+)\)",         r"YEAR(\1)"),
    (r"\bDATEPART\s*\(\s*'day'\s*,\s*([^)]+)\)",          r"DAY(\1)"),
    (r"\bDATE_FORMAT\s*\(([^,]+),\s*([^)]+)\)",           r"STRFTIME(\1, \2)"),
    (r"\bCONVERT\s*\(\s*DATE\s*,\s*([^)]+)\)",            r"CAST(\1 AS DATE)"),
    (r"\bTO_DATE\s*\(([^)]+)\)",                           r"CAST(\1 AS DATE)"),
    (r"\bSTR_TO_DATE\s*\(([^,]+),\s*([^)]+)\)",           r"STRPTIME(\1, \2)"),
]


# ── SQL Extraction ────────────────────────────────────────────────────────────

def extract_sql(raw: str) -> str:
    xml_match = re.search(r"<sql>(.*?)</sql>", raw, re.IGNORECASE | re.DOTALL)
    if xml_match:
        sql_block = xml_match.group(1)
    else:
        sql_block = raw

    cleaned = re.sub(r"```(?:sql)?", "", sql_block, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```", "", cleaned).strip()
    match = re.search(r"(SELECT\b.*?)(?:;|$)", cleaned, re.IGNORECASE | re.DOTALL)
    if not match:
        raise ValueError(f"No SELECT found in LLM output:\n{raw[:400]}")
    return match.group(1).strip() + ";"


# ── Ensure all column names are double-quoted ─────────────────────────────────

def ensure_columns_quoted(sql: str, real_columns: list) -> str:
    # Step 0: strip LLM-emitted escaped quotes like "\"Gender\"" → "Gender"
    # The LLM sometimes wraps column names in both escaped and real double quotes
    sql = re.sub(r'"\\\"([^"]+)\\\""', r'"\1"', sql)   # "\"Col\""  → "Col"
    sql = re.sub(r'\\"([^"]+)\\"',     r'"\1"', sql)   # \"Col\"    → "Col"

    # Step 1: sort longest-first so "Total Billed In INR" matches before "INR"
    sorted_cols = sorted(real_columns, key=len, reverse=True)
    for col in sorted_cols:
        quoted = f'"{col}"'
        # Skip if already properly quoted
        if quoted in sql:
            continue
        escaped = re.escape(col)
        # Only match when NOT already surrounded by double-quotes
        pattern = r'(?<!")' + escaped + r'(?!")'
        sql = re.sub(pattern, quoted, sql, flags=re.IGNORECASE)
    return sql


# ── Fix ILIKE / LIKE on DATE columns ─────────────────────────────────────────
# DATE columns cannot use ILIKE — must cast to VARCHAR first.
# e.g. "Follow Up Date" ILIKE '2026-03-%'
#   → CAST("Follow Up Date" AS VARCHAR) ILIKE '2026-03-%'

def _fix_ilike_on_date_cols(sql: str, date_cols: list) -> str:
    for col in date_cols:
        quoted = re.escape(f'"{col}"')
        bare   = re.escape(col)
        # Match: "Col" ILIKE / "Col" LIKE  (also bare Col ILIKE)
        for pattern in [quoted, bare]:
            sql = re.sub(
                r'(' + pattern + r')\s+(I?LIKE)\s+',
                lambda m, c=f'"{col}"': f'CAST({c} AS VARCHAR) {m.group(2)} ',
                sql, flags=re.IGNORECASE
            )
        # Also handle STRFTIME / CAST comparisons that might have been
        # converted into ILIKE by ilike_string_comparisons — rewrite as
        # proper date string match
        # e.g. CAST("Follow Up Date" AS VARCHAR) ILIKE '2026-03-%' → fine as-is
    return sql


# ── Fuzzy column matcher ──────────────────────────────────────────────────────

def _col_tokens(name: str) -> set:
    return set(re.split(r"[_\s]+", name.lower()))


def find_closest_column(name: str, real_columns: list) -> str | None:
    nl = name.lower()
    for col in real_columns:
        if col.lower() == nl:
            return col
    for col in real_columns:
        if nl in col.lower() or col.lower() in nl:
            return col
    scores = [
        (col, len(_col_tokens(name) & _col_tokens(col)) /
              max(len(_col_tokens(name)), len(_col_tokens(col)), 1))
        for col in real_columns
    ]
    best_col, best_score = max(scores, key=lambda x: x[1])
    return best_col if best_score >= 0.4 else None


def fix_hallucinated_columns(sql: str, real_columns: list) -> str:
    """Fix single-word unquoted column references only — multi-word cols
    are already handled by ensure_columns_quoted which runs first."""
    real_lower = {c.lower(): c for c in real_columns}

    def replace_id(m: re.Match) -> str:
        word = m.group(0)
        if word.lower() in _SQL_KEYWORDS:
            return word

        return word


    result = []
    i = 0
    while i < len(sql):

        if sql[i] == '"':
            end = sql.find('"', i + 1)
            if end == -1:
                result.append(sql[i:])
                break
            result.append(sql[i:end+1])
            i = end + 1
            continue
        
        if sql[i] == "'":
            end = sql.find("'", i + 1)
            if end == -1:
                result.append(sql[i:])
                break
            result.append(sql[i:end+1])
            i = end + 1
            continue
        result.append(sql[i])
        i += 1
    return "".join(result)


# ── Sanitisation helpers ──────────────────────────────────────────────────────

def _fix_date_literals(sql: str) -> str:
    pat = re.compile(r"'(\d{1,2})[/-](\d{1,2})[/-](\d{4})'")
    def rewrite(m: re.Match) -> str:
        p1, p2, year = m.group(1), m.group(2), m.group(3)
        return f"'{year}-{p2.zfill(2)}-{p1.zfill(2)}'"
    return pat.sub(rewrite, sql)


def _cast_varchar_arithmetic(sql: str) -> str:
    def wrap(m: re.Match) -> str:
        left, op, right = m.group(1), m.group(2), m.group(3)
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", left):
            left = f"TRY_CAST({left} AS DOUBLE)"
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", right):
            right = f"TRY_CAST({right} AS DOUBLE)"
        return f"{left} {op} {right}"
    sql = re.sub(r"([A-Za-z_][A-Za-z0-9_]*)\s*([*/])\s*(\d+(?:\.\d+)?)", wrap, sql)
    sql = re.sub(r"(\d+(?:\.\d+)?)\s*([*/])\s*([A-Za-z_][A-Za-z0-9_]*)", wrap, sql)
    return sql


def _inject_not_null_for_group_by(sql: str) -> str:
    group_match = re.search(
        r'GROUP\s+BY\s+((?:"[^"]+"|[\w,\s])+?)(?:\s+ORDER|\s+HAVING|\s+LIMIT|;|$)',
        sql, re.IGNORECASE
    )
    if not group_match:
        return sql

    group_cols_raw = group_match.group(1)
    # Extract column names — handle both "quoted col" and bare_col
    group_cols = re.findall(r'"([^"]+)"|(\b\w+\b)', group_cols_raw)
    group_cols = [a or b for a, b in group_cols if (a or b).lower() not in _SQL_KEYWORDS]

    for col in group_cols:
        quoted_col = f'"{col}"'
        null_check = f'{quoted_col} IS NOT NULL'
        if re.search(re.escape(null_check), sql, re.IGNORECASE):
            continue
        if re.search(r"\bWHERE\b", sql, re.IGNORECASE):
            sql = re.sub(
                r"(\bWHERE\b\s+)",
                r"\g<1>" + null_check + " AND ",
                sql, count=1, flags=re.IGNORECASE,
            )
        else:
            sql = re.sub(
                r"(\bGROUP\s+BY\b)",
                f"WHERE {null_check} GROUP BY",
                sql, count=1, flags=re.IGNORECASE,
            )
    return sql


def _ilike_string_comparisons(sql: str) -> str:
    _iso = re.compile(r"'\d{4}-\d{2}-\d{2}'")

    def rewrite(m: re.Match) -> str:
        col, op, val = m.group(1), m.group(2), m.group(3)
        if _iso.match(val):
            return m.group(0)
        if re.fullmatch(r"[\d.]+", val.strip("'")):
            return m.group(0)
        if op.strip() in ("!=", "<>"):
            return f"{col} NOT ILIKE {val}"
        return f"{col} ILIKE {val}"

    return re.sub(r'("?[\w .]+"?)\s*(=|!=|<>)\s*(\'[^\']*\')', rewrite, sql)

def _clean_nested_quotes(sql: str) -> str:
    """Fix LLM hallucinating '"Value"' instead of 'Value' or '%"Value"%'"""
    sql = re.sub(r'\'"([^"]+)"\'', r"'\1'", sql) 
    sql = re.sub(r'\'%"([^"]+)"%\'', r"'%\1%'", sql)
    sql = re.sub(r'\'"%([^"]+)%"\'', r"'%\1%'", sql)
    return sql


def sanitize_sql(sql: str, date_cols: list) -> str:
    for pat, rep in _BAD_FUNC_SUBS:
        sql = re.sub(pat, rep, sql, flags=re.IGNORECASE)
    for col in date_cols:
        sql = re.sub(
            r'CAST\s*\(\s*["\']?' + re.escape(col) + r'["\']?\s+AS\s+DATE\s*\)',
            f'"{col}"', sql, flags=re.IGNORECASE,
        )
    sql = _fix_date_literals(sql)
    sql = _clean_nested_quotes(sql)
    sql = _ilike_string_comparisons(sql)
    sql = _fix_ilike_on_date_cols(sql, date_cols)   
    sql = _cast_varchar_arithmetic(sql)
    sql = _inject_not_null_for_group_by(sql)
    return sql