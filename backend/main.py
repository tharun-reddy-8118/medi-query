from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import math, hashlib

from config import con, client, datasets
from models import QuestionRequest, ForecastRequest, DataRequest, BuildChartRequest, BuildKpiRequest
from parsers import _parse_file, answer_from_document
from formatters import format_result_data, build_answer, clean_value
from sql.cleaner import clean_columns, normalize_date_columns, auto_rename_columns
from sql.resolver import resolve_concept_columns, build_column_directive
from sql.sanitizer import extract_sql, sanitize_sql, fix_hallucinated_columns
from sql.executor import execute_with_retry, verify_and_rerun, build_sql_prompt, _QueryFailed

import pandas as pd

import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

from config import scheduler

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="Healthcare Analytics API", lifespan=lifespan)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Healthcare Analytics API running 🚀"}



from routers.upload import router as upload_router
from routers.ask import router as ask_router
from routers.forecast import router as forecast_router
from routers.dashboard import router as dashboard_router
from routers.narrate import router as narrate_router
from routers.auth import router as auth_router
from routers.connectors import router as connectors_router
from routers.dictionary import router as dictionary_router
from routers.schedule import router as schedule_router

app.include_router(upload_router)
app.include_router(ask_router)
app.include_router(forecast_router)
app.include_router(dashboard_router)
app.include_router(narrate_router)
app.include_router(auth_router)
app.include_router(connectors_router)
app.include_router(dictionary_router)
app.include_router(schedule_router)
