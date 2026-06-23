import math
from config import client, MODEL_FAST as MODEL

# ── Money column detection ────────────────────────────────────────────────────
_MONEY_KW = {
    "revenue", "amount", "payment", "paid", "fee", "charge", "cost", "price",
    "billing", "bill", "income", "salary", "wage", "balance", "due",
    "receipt", "collection", "earning", "inr", "billed", "collected",
    "contribution", "sales", "spend", "profit", "value",
}
_COUNT_KW = {
    "count", "num", "number", "qty", "quantity", "surgeries", "surgery",
    "patients", "visits", "admissions", "cases", "procedures", "records",
}
_PCT_KW = {
    "percent", "pct", "percentage", "ratio", "rate", "margin", "proportion"
}


def _is_money_col(name: str) -> bool:
    low = name.lower()
    if any(k in low for k in _COUNT_KW) or any(k in low for k in _PCT_KW):
        return False
    return any(k in low for k in _MONEY_KW)


def _fmt_indian(v) -> str:
    try:
        n = float(v)
    except (ValueError, TypeError):
        return str(v)
    neg = n < 0
    a   = abs(n)
    pre = "-" if neg else ""
    if a >= 1_00_00_000:  return f"{pre}₹{a / 1_00_00_000:.2f} crore"
    if a >= 1_00_000:     return f"{pre}₹{a / 1_00_000:.2f} lakh"
    if a >= 1_000:        return f"{pre}₹{a:,.0f}"
    return f"{pre}₹{int(a) if a == int(a) else round(a, 2)}"


def clean_value(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def format_result_data(rows: list) -> list:
    out = []
    for row in rows:
        new = {}
        for k, v in row.items():
            if _is_money_col(k) and v is not None:
                try:
                    f = float(v)
                    new[k] = v if (f == int(f) and f < 10_000) else _fmt_indian(v)
                except (ValueError, TypeError):
                    new[k] = v
            elif any(pct in k.lower() for pct in _PCT_KW) and v is not None:
                try:
                    f = float(v)
                    new[k] = f"{round(f, 2)}%"
                except (ValueError, TypeError):
                    new[k] = v
            else:
                new[k] = v
        out.append(new)
    return out


def build_answer(question: str, result_data: list) -> str:
    if not result_data:
        return "No results found for that query."

    result_text = "\n".join(
        ", ".join(f"{k}: {v}" for k, v in row.items())
        for row in result_data
    )

    prompt = f"""You are a helpful healthcare data assistant.

User asked: "{question}"

Query result:
{result_text}

Instructions:
- Write a clean, natural, concise answer in plain English.
- Do NOT mention SQL, tables, rows, or records.
- Do NOT use markdown or bullet points.
- For lists, write as a natural numbered list or a sentence.
- For a single value, state it directly.
- Keep it short and direct.
- Numeric values are already formatted (e.g. "₹2.14 crore"). Use them as-is.
- The column names in the result ARE the actual data dimension
  (e.g. if result has "ConsultantName" column, refer to it as "doctor")."""

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
        )
        if resp.choices and resp.choices[0].message.content.strip():
            return resp.choices[0].message.content.strip()
    except Exception:
        pass

    return result_text
