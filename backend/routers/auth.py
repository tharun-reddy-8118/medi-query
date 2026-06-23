from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import hashlib, secrets, json, logging

from config import con

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

# ── JWT-like token system (lightweight, no external deps) ─────────────────────
# Uses HMAC-SHA256 tokens stored in DuckDB. No python-jose needed.

SECRET_KEY = secrets.token_hex(32)
TOKEN_EXPIRE_DAYS = 30


def _hash_password(password: str) -> str:
    """Simple SHA-256 hash with salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"


def _verify_password(password: str, stored: str) -> bool:
    salt, hashed = stored.split(":", 1)
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest() == hashed


def _create_token(user_id: str, email: str) -> str:
    """Create a simple signed token: base64(payload).signature"""
    import base64, hmac
    payload = json.dumps({
        "user_id": user_id,
        "email": email,
        "exp": (datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)).isoformat(),
    })
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
    return f"{payload_b64}.{sig}"


def _decode_token(token: str) -> dict | None:
    import base64, hmac
    try:
        payload_b64, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        if datetime.fromisoformat(payload["exp"]) < datetime.utcnow():
            return None
        return payload
    except Exception:
        return None


# ── Init users table ──────────────────────────────────────────────────────────
try:
    con.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            email VARCHAR UNIQUE NOT NULL,
            password_hash VARCHAR NOT NULL,
            role VARCHAR DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
except Exception as e:
    logger.warning(f"Users table may already exist: {e}")

try:
    con.execute("""
        CREATE TABLE IF NOT EXISTS user_dashboards (
            user_id VARCHAR,
            file_id VARCHAR,
            PRIMARY KEY (user_id, file_id)
        )
    """)
except Exception as e:
    logger.warning(f"user_dashboards table may already exist: {e}")


# ── Bootstrap Admin ───────────────────────────────────────────────────────────
try:
    # Ensure default admin always exists
    has_default_admin = con.execute("SELECT id FROM users WHERE email = 'admin@admin.com'").fetchone()
    if not has_default_admin:
        default_user_id = f"user_{secrets.token_hex(8)}"
        default_password = _hash_password("admin123")
        con.execute(
            "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            [default_user_id, "Admin", "admin@admin.com", default_password, "admin"]
        )
        logger.info("Default admin user created: admin@admin.com / admin123")
except Exception as e:
    logger.warning(f"Failed to bootstrap admin: {e}")

# ── Models ────────────────────────────────────────────────────────────────────

class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Dependency: get current user ──────────────────────────────────────────────

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    payload = _decode_token(credentials.credentials)
    if not payload:
        return None
    return payload


async def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = _decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    row = con.execute("SELECT role FROM users WHERE id = ?", [payload["user_id"]]).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User no longer exists")
        
    payload["role"] = row[0]
    return payload


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = await require_user(credentials)
    
    # Check role from DB to ensure it's up-to-date
    row = con.execute("SELECT role FROM users WHERE id = ?", [payload["user_id"]]).fetchone()
    if not row or row[0] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    return payload


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/users")
async def create_user(req: AdminCreateUserRequest, _=Depends(require_admin)):
    """Create a new user (admin only)."""
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if req.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")

    # Check if email already exists
    existing = con.execute(
        "SELECT id FROM users WHERE email = ?", [req.email.lower()]
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = f"user_{secrets.token_hex(8)}"
    password_hash = _hash_password(req.password)

    con.execute(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
        [user_id, req.name.strip(), req.email.lower(), password_hash, req.role]
    )

    return {
        "message": "User created successfully",
        "user": {
            "id": user_id,
            "name": req.name.strip(),
            "email": req.email.lower(),
            "role": req.role,
        }
    }


@router.post("/login")
async def login(req: LoginRequest):
    row = con.execute(
        "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
        [req.email.lower()]
    ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id, name, email, password_hash, role = row

    if not _verify_password(req.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(user_id, email)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
        }
    }


@router.get("/me")
async def get_me(user=Depends(require_user)):
    row = con.execute(
        "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
        [user["user_id"]]
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "role": row[3],
        "created_at": str(row[4]),
    }


# ── Admin Endpoints ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(_=Depends(require_admin)):
    """List all registered users (admin only)."""
    try:
        users = con.execute(
            "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
        ).fetchdf().to_dict(orient="records")
        # Convert timestamps to strings
        for u in users:
            u["created_at"] = str(u["created_at"])
        return {"users": users}
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail="Failed to list users")


class RoleUpdateRequest(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, req: RoleUpdateRequest, _=Depends(require_admin)):
    """Update a user's role (admin only)."""
    if req.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Don't let an admin demote themselves accidentally
    # (Though we won't strictly block it, we should ensure the target user exists)
    row = con.execute("SELECT id FROM users WHERE id = ?", [user_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
        
    con.execute("UPDATE users SET role = ? WHERE id = ?", [req.role, user_id])
    return {"message": f"User role updated to {req.role}"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user=Depends(require_admin)):
    """Delete a user account (admin only)."""
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    row = con.execute("SELECT id FROM users WHERE id = ?", [user_id]).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
        
    con.execute("DELETE FROM users WHERE id = ?", [user_id])
    con.execute("DELETE FROM user_dashboards WHERE user_id = ?", [user_id])
    return {"message": "User deleted"}


@router.get("/users/{user_id}/dashboards")
async def get_user_dashboards(user_id: str, _=Depends(require_admin)):
    """Get dashboards assigned to a user (admin only)."""
    try:
        rows = con.execute("SELECT file_id FROM user_dashboards WHERE user_id = ?", [user_id]).fetchall()
        return {"file_ids": [r[0] for r in rows]}
    except Exception as e:
        logger.error(f"Error fetching user dashboards: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch assigned dashboards")


class AssignDashboardsRequest(BaseModel):
    file_ids: list[str]


@router.post("/users/{user_id}/dashboards")
async def assign_user_dashboards(user_id: str, req: AssignDashboardsRequest, _=Depends(require_admin)):
    """Assign dashboards to a user (admin only)."""
    try:
        # Verify user exists
        row = con.execute("SELECT id FROM users WHERE id = ?", [user_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
            
        con.execute("BEGIN TRANSACTION")
        try:
            con.execute("DELETE FROM user_dashboards WHERE user_id = ?", [user_id])
            for fid in req.file_ids:
                con.execute("INSERT INTO user_dashboards (user_id, file_id) VALUES (?, ?)", [user_id, fid])
            con.execute("COMMIT")
        except Exception as e:
            con.execute("ROLLBACK")
            raise e
            
        return {"message": "Dashboards assigned successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning dashboards: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign dashboards")
