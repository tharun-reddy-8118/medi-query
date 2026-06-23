import os
import duckdb
from openai import OpenAI
from dotenv import load_dotenv
import diskcache

load_dotenv()

# ── LLM ───────────────────────────────────────────────────────────────────────
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)
MODEL_SQL = "llama-3.3-70b-versatile" # Smarter model for SQL generation
MODEL_FAST = "llama-3.1-8b-instant"   # Faster model for simple summaries and parsing

# ── Data Directory ──────────────────────────────────────────────────────────────
DATA_DIR = os.getenv("DATA_DIR", ".")
os.makedirs(DATA_DIR, exist_ok=True)

# ── DuckDB ────────────────────────────────────────────────────────────────────
# Use a persistent database file instead of in-memory to prevent data loss across restarts.
con = duckdb.connect(os.path.join(DATA_DIR, "analytics.duckdb"))

# ── Persistent dataset store ──────────────────────────────────────────────────
# Replaces in-memory dictionary to allow multiple workers and state persistence
datasets = diskcache.Cache(os.path.join(DATA_DIR, 'cache'))
from apscheduler.schedulers.background import BackgroundScheduler
scheduler = BackgroundScheduler()

