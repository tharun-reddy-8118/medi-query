from fastapi import APIRouter, HTTPException
from config import datasets, con
from pydantic import BaseModel
from models import CreateCalculatedFieldRequest
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ColumnDefinition(BaseModel):
    col_name: str
    label: str
    description: str
    category: str  # Dimension, Measure, Date, ID
    is_calculated: bool = False
    expression: str | None = None


class DictionaryUpdateRequest(BaseModel):
    file_id: str
    definitions: list[ColumnDefinition]

@router.get("/dictionary/{file_id}")
async def get_dictionary(file_id: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ds = datasets[file_id]
    if ds.get("mode") == "document":
        return {"definitions": []}
    
    # Return existing dictionary or generate default one
    dictionary = ds.get("semantic_dictionary", {})
    
    defs = []
    for col in ds["columns"]:
        if col in dictionary:
            defs.append(dictionary[col])
        else:
            cat = "Dimension"
            if col in ds.get("numeric_stats", {}):
                cat = "Measure"
            elif col in ds.get("date_cols", []):
                cat = "Date"
            
            # Simple heuristic for ID
            if "id" in col.lower().split("_"):
                cat = "ID"
                
            defs.append({
                "col_name": col,
                "label": col.replace("_", " ").title(),
                "description": "",
                "category": cat,
                "is_calculated": False,
                "expression": None
            })
    return {"definitions": defs}


@router.post("/dictionary")
async def update_dictionary(req: DictionaryUpdateRequest):
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[req.file_id]
    
    dictionary = {}
    for dfn in req.definitions:
        dictionary[dfn.col_name] = dfn.dict()
        
    ds["semantic_dictionary"] = dictionary
    datasets[req.file_id] = ds  # update the diskcache
    
    return {"status": "success", "message": "Dictionary updated"}

@router.post("/dictionary/{file_id}/calculated_field")
async def create_calculated_field(file_id: str, req: CreateCalculatedFieldRequest):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[file_id]
    table = ds.get("table")
    if not table:
        raise HTTPException(status_code=400, detail="Cannot add calculated field to this dataset")

    col_name = req.col_name.strip()
    expr = req.expression.strip()
    
    if not col_name or not expr:
        raise HTTPException(status_code=400, detail="Name and expression are required")

    # 1. Validate syntax and get the resulting type
    try:
        res = con.execute(f"SELECT typeof(({expr})) AS t FROM {table} LIMIT 1").fetchdf()
        if res.empty:
            raise Exception("No data returned")
        dtype = res.iloc[0]["t"]
    except Exception as e:
        logger.error(f"Calculated field validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid expression: {str(e)}")

    # 2. Add column to table
    # If the column already exists, drop it first to allow editing
    try:
        # Check if it exists
        con.execute(f"ALTER TABLE {table} DROP COLUMN \"{col_name}\"")
    except Exception:
        pass # Fine if it doesn't exist
        
    try:
        # Since we just need a type, we map DuckDB types or just use DOUBLE if numeric
        # It's safer to just let DuckDB cast it correctly or use a flexible type like VARCHAR then cast back, 
        # but DOUBLE or VARCHAR works. Actually, we can use the exact dtype DuckDB returned.
        con.execute(f"ALTER TABLE {table} ADD COLUMN \"{col_name}\" {dtype}")
        con.execute(f"UPDATE {table} SET \"{col_name}\" = ({expr})")
    except Exception as e:
        logger.error(f"Calculated field execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add column: {str(e)}")

    # 3. Update dataset metadata
    if col_name not in ds["columns"]:
        ds["columns"].append(col_name)

    is_numeric = any(n in dtype.upper() for n in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL"])
    is_date = any(d in dtype.upper() for d in ["DATE", "TIME", "TIMESTAMP", "INTERVAL"])
    
    if is_date:
        if "date_cols" not in ds:
            ds["date_cols"] = []
        if col_name not in ds["date_cols"]:
            ds["date_cols"].append(col_name)
    
    if is_numeric:
        try:
            s  = con.execute(f"SELECT SUM(\"{col_name}\") FROM {table}").fetchone()[0] or 0
            mn = con.execute(f"SELECT MIN(\"{col_name}\") FROM {table}").fetchone()[0] or 0
            mx = con.execute(f"SELECT MAX(\"{col_name}\") FROM {table}").fetchone()[0] or 0
            ds.setdefault("numeric_stats", {})[col_name] = {"sum": round(float(s), 2), "min": round(float(mn), 2), "max": round(float(mx), 2)}
        except Exception:
            pass

    # 4. Update dictionary
    dictionary = ds.get("semantic_dictionary", {})
    dictionary[col_name] = {
        "col_name": col_name,
        "label": col_name.title(),
        "description": f"Calculated as: {expr}",
        "category": "Date" if is_date else ("Measure" if is_numeric else "Dimension"),
        "is_calculated": True,
        "expression": expr
    }
    ds["semantic_dictionary"] = dictionary
    datasets[file_id] = ds
    
    return {"status": "success", "message": f"Calculated field '{col_name}' added"}

@router.delete("/dictionary/{file_id}/calculated_field/{col_name}")
async def delete_calculated_field(file_id: str, col_name: str):
    if file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    ds = datasets[file_id]
    table = ds.get("table")
    if not table:
        raise HTTPException(status_code=400, detail="Cannot delete calculated field from this dataset")

    # Only drop if it exists
    try:
        con.execute(f"ALTER TABLE {table} DROP COLUMN \"{col_name}\"")
    except Exception as e:
        logger.error(f"Failed to drop column {col_name}: {e}")

    # Remove from datasets columns
    if col_name in ds.get("columns", []):
        ds["columns"].remove(col_name)

    if col_name in ds.get("numeric_stats", {}):
        del ds["numeric_stats"][col_name]
        
    if col_name in ds.get("date_cols", []):
        ds["date_cols"].remove(col_name)

    # Remove from dictionary
    dictionary = ds.get("semantic_dictionary", {})
    if col_name in dictionary:
        del dictionary[col_name]
        
    ds["semantic_dictionary"] = dictionary
    datasets[file_id] = ds
    
    return {"status": "success", "message": f"Calculated field '{col_name}' deleted"}
