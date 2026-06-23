from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import hashlib, logging

from config import con, datasets

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/connector", tags=["connectors"])


# ── Models ────────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    db_type: str          # "postgresql" | "mysql"
    host: str
    port: int
    database: str
    username: str
    password: str
    alias: str = ""       # friendly name


class LoadTableRequest(BaseModel):
    db_type: str
    host: str
    port: int
    database: str
    username: str
    password: str
    schema_name: str = "public"
    table_name: str
    alias: str = ""
    limit: int = 100000   # safety cap
    prompt: str = ""
    custom_sql: str = ""


# ── Init connections table ────────────────────────────────────────────────────
try:
    con.execute("""
        CREATE TABLE IF NOT EXISTS saved_connections (
            id VARCHAR PRIMARY KEY,
            alias VARCHAR,
            db_type VARCHAR NOT NULL,
            host VARCHAR NOT NULL,
            port INTEGER NOT NULL,
            database_name VARCHAR NOT NULL,
            username VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
except Exception as e:
    logger.warning(f"Connections table may already exist: {e}")


def _build_dsn(req):
    """Build a DuckDB-compatible connection string (libpq key=value format)."""
    if req.db_type == "postgresql":
        return f"host={req.host} port={req.port} dbname={req.database} user={req.username} password={req.password}"
    elif req.db_type == "mysql":
        return f"host={req.host} port={req.port} database={req.database} user={req.username} password={req.password}"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported database type: {req.db_type}")


def _attach_db(req, attach_name):
    """Install extension, load it, and attach remote database."""
    dsn = _build_dsn(req)
    if req.db_type == "postgresql":
        try:
            con.execute("INSTALL postgres")
        except Exception:
            pass  # already installed
        con.execute("LOAD postgres")
        con.execute(f"ATTACH '{dsn}' AS {attach_name} (TYPE POSTGRES, READ_ONLY)")
    elif req.db_type == "mysql":
        try:
            con.execute("INSTALL mysql")
        except Exception:
            pass  # already installed
        con.execute("LOAD mysql")
        con.execute(f"ATTACH '{dsn}' AS {attach_name} (TYPE MYSQL, READ_ONLY)")


def _safe_detach(name):
    """Detach a database, ignoring errors."""
    try:
        con.execute(f"DETACH {name}")
    except Exception:
        pass


# ── Test Connection ───────────────────────────────────────────────────────────

@router.post("/test")
async def test_connection(req: ConnectRequest):
    """Test if the database connection works."""
    attach_name = f"test_{datetime.now().strftime('%f')}"
    try:
        _attach_db(req, attach_name)
        con.execute(f"SELECT 1")
        _safe_detach(attach_name)
        return {"status": "success", "message": f"Connected to {req.db_type}://{req.host}:{req.port}/{req.database}"}
    except Exception as e:
        _safe_detach(attach_name)
        logger.error(f"Connection test failed: {e}")
        return {"status": "error", "message": str(e)}


# ── List Tables ───────────────────────────────────────────────────────────────

@router.post("/tables")
async def list_tables(req: ConnectRequest):
    """List all tables in the connected database."""
    attach_name = f"browse_{datetime.now().strftime('%f')}"
    try:
        _attach_db(req, attach_name)

        if req.db_type == "postgresql":
            # Get tables with row counts
            tables_df = con.execute(f"""
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_catalog = '{attach_name}'
                  AND table_schema NOT IN ('information_schema', 'pg_catalog')
                  AND table_type = 'BASE TABLE'
                ORDER BY table_schema, table_name
            """).fetchdf()

        elif req.db_type == "mysql":
            tables_df = con.execute(f"""
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_catalog = '{attach_name}'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_schema, table_name
            """).fetchdf()

        tables = []
        for _, row in tables_df.iterrows():
            schema = row.get("table_schema", "public")
            name = row["table_name"]
            try:
                count = con.execute(
                    f'SELECT COUNT(*) FROM {attach_name}."{schema}"."{name}"'
                ).fetchone()[0]
            except Exception:
                count = "?"

            # Get columns
            try:
                cols_df = con.execute(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_catalog = '{attach_name}'
                      AND table_schema = '{schema}'
                      AND table_name = '{name}'
                    ORDER BY ordinal_position
                """).fetchdf()
                columns = [
                    {"name": r["column_name"], "type": r["data_type"]}
                    for _, r in cols_df.iterrows()
                ]
            except Exception:
                columns = []

            tables.append({
                "schema": schema,
                "table": name,
                "rows": count,
                "columns": columns,
            })

        _safe_detach(attach_name)
        return {"tables": tables, "database": req.database}

    except Exception as e:
        logger.error(f"List tables failed: {e}")
        _safe_detach(attach_name)
        raise HTTPException(status_code=500, detail=f"Failed to list tables: {str(e)}")


# ── Load Table as Dataset ─────────────────────────────────────────────────────

@router.post("/load")
async def load_table(req: LoadTableRequest):
    """Load a table from a remote database into the analytics engine."""
    attach_name = f"load_{datetime.now().strftime('%f')}"
    try:
        _attach_db(req, attach_name)

        # Read the remote table into a local DuckDB table
        file_id = f"file_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        local_table = f"data_{file_id}"
        
        if req.custom_sql:
            safe_sql = req.custom_sql.replace("'", "''")
            if req.db_type == "postgresql":
                source = f"postgres_query('{attach_name}', '{safe_sql}')"
            else:
                source = f"mysql_query('{attach_name}', '{safe_sql}')"
        else:
            source = f'{attach_name}."{req.schema_name}"."{req.table_name}"'

        con.execute(
            f"CREATE TABLE {local_table} AS SELECT * FROM {source} LIMIT {req.limit}"
        )

        # Detach remote
        _safe_detach(attach_name)

        # Gather metadata (same logic as upload)
        df = con.execute(f"SELECT * FROM {local_table}").fetchdf()
        columns = list(df.columns)

        # Detect date columns
        date_cols = []
        for col in df.columns:
            if df[col].dtype.name in ("datetime64[ns]", "datetime64[us]", "datetime64[ms]"):
                date_cols.append(col)
            elif df[col].dtype == object:
                try:
                    import pandas as pd
                    pd.to_datetime(df[col].dropna().head(20))
                    date_cols.append(col)
                except Exception:
                    pass

        # Numeric stats
        ID_SKIP = {
            "s_no", "sno", "sr_no", "sr", "serial", "serial_no", "serial_number",
            "id", "patient_id", "emp_id", "employee_id", "record_id", "row_id", "index",
        }
        numeric_stats = {}
        for col in df.select_dtypes(include=["number"]).columns:
            col_key = col.lower().strip().replace(" ", "_").replace(".", "_")
            if col_key in ID_SKIP:
                continue
            try:
                s = float(df[col].sum())
                mn = float(df[col].min())
                mx = float(df[col].max())
                numeric_stats[col] = {"sum": round(s, 2), "min": round(mn, 2), "max": round(mx, 2)}
            except Exception:
                pass

        # Categorical stats
        categorical_stats = {}
        for col in df.select_dtypes(exclude=["number"]).columns:
            if col in date_cols:
                continue
            try:
                nunique = df[col].nunique()
                if 1 < nunique <= 20:
                    categorical_stats[col] = [str(v) for v in df[col].dropna().unique().tolist()]
            except Exception:
                pass

        # Layout key
        display_name = req.alias or f"{req.database}.{req.table_name}"
        layout_str = display_name + "|" + str(len(df)) + "|" + ",".join(sorted(columns))
        layout_key = hashlib.md5(layout_str.encode()).hexdigest()[:20]

        # Store dataset
        datasets[file_id] = {
            "mode": "structured",
            "table": local_table,
            "filename": display_name,
            "layout_key": layout_key,
            "rows": len(df),
            "columns": columns,
            "date_cols": date_cols,
            "sample_rows": df.head(3).fillna("").astype(str).to_dict(orient="records"),
            "numeric_stats": numeric_stats,
            "categorical_stats": categorical_stats,
            "rename_map": {},
            "prompt": req.prompt,
            "created_at": datetime.now().isoformat(),
            "is_saved": False
        }

        return {
            "file_id": file_id,
            "layout_key": layout_key,
            "filename": display_name,
            "rows": len(df),
            "columns": columns,
            "preview": df.head(5).fillna("").to_dict(orient="records"),
            "numeric_columns": list(numeric_stats.keys()),
            "date_columns": date_cols,
            "rename_map": {},
            "doc_mode": False,
            "source": f"{req.db_type}://{req.host}:{req.port}/{req.database}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Load table failed: {e}")
        _safe_detach(attach_name)
        raise HTTPException(status_code=500, detail=f"Failed to load table: {str(e)}")


# ── Save Connection ───────────────────────────────────────────────────────────

@router.post("/save")
async def save_connection(req: ConnectRequest):
    """Save connection details for reuse (password NOT stored)."""
    conn_id = f"conn_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    try:
        con.execute(
            "INSERT INTO saved_connections (id, alias, db_type, host, port, database_name, username) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            [conn_id, req.alias or req.database, req.db_type, req.host, req.port, req.database, req.username]
        )
        return {"id": conn_id, "message": "Connection saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")


@router.get("/saved")
async def list_saved_connections():
    """List all saved connections."""
    try:
        rows = con.execute(
            "SELECT id, alias, db_type, host, port, database_name, username, created_at "
            "FROM saved_connections ORDER BY created_at DESC"
        ).fetchdf().to_dict(orient="records")
        return {"connections": rows}
    except Exception:
        return {"connections": []}


@router.delete("/saved/{conn_id}")
async def delete_saved_connection(conn_id: str):
    try:
        con.execute("DELETE FROM saved_connections WHERE id = ?", [conn_id])
        return {"message": "Deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
