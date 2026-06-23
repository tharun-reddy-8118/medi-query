import re

# ── Concept map ───────────────────────────────────────────────────────────────
CONCEPT_MAP = {
    "doctor": {
        "question_triggers": [
            "doctor", "physician", "surgeon", "consultant", "clinician",
            "dr ", "dr.", "doctor_wise", "physician wise", "surgeon wise",
            "consultant wise", "attending", "specialist",
        ],
        "column_patterns": [
            "doctor", "physician", "surgeon", "consultant", "clinician",
            "attending", "specialist", "provider", "performed", "dr",
            "medical_officer", "mo", "staff_name", "staff", "practitioner",
        ],
    },
    "department": {
        "question_triggers": [
            "department", "dept", "ward", "unit", "specialty", "speciality",
            "department wise", "dept wise", "specialty wise",
        ],
        "column_patterns": [
            "department", "dept", "ward", "unit", "specialty", "speciality",
            "service", "division", "section", "branch",
        ],
    },
    "patient": {
        "question_triggers": [
            "patient", "patient wise", "person", "individual", "uhid",
            "patient id", "patient name",
        ],
        "column_patterns": [
            "patient", "uhid", "pid", "patient_id", "patient_name",
            "person", "name", "individual",
        ],
    },
    "insurance": {
        "question_triggers": [
            "insurance", "payer", "scheme", "coverage", "insurer",
            "insurance wise", "scheme wise",
        ],
        "column_patterns": [
            "insurance", "payer", "scheme", "coverage", "insurer",
            "policy", "provider_insurance",
        ],
    },
    "admission_type": {
        "question_triggers": [
            "admission type", "admit type", "type of admission",
            "ip", "op", "inpatient", "outpatient", "emergency",
        ],
        "column_patterns": [
            "admission_type", "admit_type", "visit_type", "ip_op",
            "category", "patient_type",
        ],
    },
    "city": {
        "question_triggers": ["city", "location", "place", "area", "region", "city wise"],
        "column_patterns": ["city", "location", "place", "area", "region", "locality"],
    },
    "date": {
        "question_triggers": [
            "date", "day", "when", "admission date", "discharge date",
            "visit date", "entry date",
        ],
        "column_patterns": [
            "date", "day", "admission_date", "discharge_date",
            "visit_date", "entry_date", "enter_date", "created",
        ],
    },
    "revenue": {
        "question_triggers": [
            "revenue", "amount", "billing", "bill", "total", "income",
            "collection", "earned", "payment", "paid",
        ],
        "column_patterns": [
            "revenue", "amount", "billing", "bill", "total", "income",
            "collection", "payment", "paid", "fee", "charge", "inr",
            "billed", "collected",
        ],
    },
    "diagnosis": {
        "question_triggers": [
            "diagnosis", "disease", "condition", "icd", "complaint",
            "diagnosis wise",
        ],
        "column_patterns": [
            "diagnosis", "disease", "condition", "icd", "complaint",
            "ailment", "disorder",
        ],
    },
}

_CONCEPT_LABELS = {
    "doctor":         '"doctor / physician / surgeon / consultant"',
    "department":     '"department / dept / ward / specialty"',
    "patient":        '"patient / uhid / patient id"',
    "insurance":      '"insurance / payer / scheme"',
    "admission_type": '"admission type / ip / op"',
    "city":           '"city / location / area"',
    "date":           '"date / admission date / visit date"',
    "revenue":        '"revenue / amount / billing / total"',                 
    "diagnosis":      '"diagnosis / disease / condition"',
}


def _score_column(col_name: str, patterns: list[str]) -> float:
    col_lower = col_name.lower()
    col_tokens = set(re.split(r"[_\s]+", col_lower))
    best = 0.0
    for pat in patterns:
        pat_lower = pat.lower()
        pat_tokens = set(re.split(r"[_\s]+", pat_lower))
        if col_lower == pat_lower:
            return 1.0
        if pat_lower in col_lower:
            best = max(best, 0.9)
        if col_lower in pat_lower:
            best = max(best, 0.75)
        overlap = col_tokens & pat_tokens
        if overlap:
            score = len(overlap) / max(len(col_tokens), len(pat_tokens))
            best = max(best, score * 0.8)
    return best


def resolve_concept_columns(question: str, columns: list[str]) -> dict[str, str]:
    """Map question concepts → best matching actual column names."""
    q_lower = question.lower()
    resolved: dict[str, str] = {}
    for concept, config in CONCEPT_MAP.items():
        if not any(t in q_lower for t in config["question_triggers"]):
            continue
        scores = [(col, _score_column(col, config["column_patterns"])) for col in columns]
        scores.sort(key=lambda x: x[1], reverse=True)
        best_col, best_score = scores[0]
        if best_score >= 0.35:
            resolved[concept] = best_col
    return resolved


def build_column_directive(resolved: dict[str, str]) -> str:
    """Build a hard directive block injected into the SQL prompt."""
    if not resolved:
        return ""
    lines = ["COLUMN MAPPING — use EXACTLY these columns, do not substitute with any other:\n"]
    for concept, col in resolved.items():
        label = _CONCEPT_LABELS.get(concept, f'"{concept}"')
        lines.append(f"  • When user says {label}  →  use column: {col}")
    lines.append(
        "\nCRITICAL: If user says 'doctor wise', GROUP BY the doctor column above. "
        "Never use a department or specialty column when the user asked for doctor."
    )
    return "\n".join(lines)
