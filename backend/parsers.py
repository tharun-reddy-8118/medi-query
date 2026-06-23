import io
import pandas as pd
from fastapi import HTTPException
from config import client, MODEL_FAST as MODEL
from rag import search_faiss_index

_DOC_CHAR_LIMIT = 12_000   # safe LLM context window limit


def list_excel_sheets(filepath: str) -> list[str]:
    """Return sheet names for an Excel file."""
    try:
        xls = pd.ExcelFile(filepath)
        return xls.sheet_names
    except Exception:
        return []


def _parse_file(filename: str, filepath: str, sheet_name: str | None = None):
    """
    Parse any supported file into either:
      (DataFrame, None)  — structured data  → SQL pipeline
      (None, str)        — plain text        → LLM document Q&A
    """
    fname = filename.lower()

    # ── Excel ──────────────────────────────────────────────────────────────
    if fname.endswith((".xlsx", ".xls")):
        return pd.read_excel(filepath, sheet_name=sheet_name or 0), None

    # ── CSV ────────────────────────────────────────────────────────────────
    if fname.endswith(".csv"):
        return pd.read_csv(filepath), None

    # ── Word (.docx) — always full-text to LLM ────────────────────────────
    if fname.endswith(".docx"):
        try:
            import docx as _docx
        except ImportError:
            raise HTTPException(status_code=400,
                detail="python-docx not installed. Run: pip install python-docx")

        doc = _docx.Document(filepath)
        lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        if not lines:
            raise HTTPException(status_code=400, detail="The Word document appears to be empty.")
        return None, "\n".join(lines)

    # ── PDF — always full-text to LLM ─────────────────────────────────────
    if fname.endswith(".pdf"):
        try:
            import pdfplumber as _pdf
        except ImportError:
            raise HTTPException(status_code=400,
                detail="pdfplumber not installed. Run: pip install pdfplumber")

        text_lines: list = []
        with _pdf.open(filepath) as pdf:
            for page in pdf.pages:
                raw = page.extract_text()
                if raw:
                    text_lines.extend(line.strip() for line in raw.splitlines() if line.strip())

        if not text_lines:
            raise HTTPException(status_code=400, detail="Could not extract any text from the PDF.")
        return None, "\n".join(text_lines)

    raise HTTPException(status_code=400,
        detail=f"Unsupported file type '{filename}'. "
               "Please upload .xlsx, .xls, .csv, .docx, or .pdf")


def answer_from_document(question: str, doc_text: str, file_id: str = None) -> str:
    """Send retrieved document chunks + question to LLM."""
    
    if file_id:
        # Use Advanced RAG
        context = search_faiss_index(file_id, question, top_k=5)
        if not context:
            context = doc_text[:_DOC_CHAR_LIMIT] # fallback
    else:
        context = doc_text[:_DOC_CHAR_LIMIT]

    prompt = f"""You are a helpful assistant. A user has uploaded a document and has a question about it.

--- RELEVANT DOCUMENT EXCERPTS ---
{context}
--- END EXCERPTS ---

User question: {question}

Instructions:
- Answer ONLY based on the document content above.
- Be clear, concise, and accurate.
- If the answer is not in the document, say so honestly.
- Respond naturally — do not repeat "the document says" every sentence.
- No markdown headers. Plain paragraphs. Numbered lists only when listing multiple items."""

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=700,
        )
        if resp.choices and resp.choices[0].message.content.strip():
            return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[doc Q&A LLM error] {e}")

    return "I wasn't able to answer that from the document. Please try rephrasing your question."
