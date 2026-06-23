from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from config import datasets, scheduler
from tasks.email_scheduler import send_mock_email, schedules
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/schedule", tags=["schedule"])

class ScheduleRequest(BaseModel):
    file_id: str
    email: str
    frequency: str  # e.g., "daily", "weekly", "minute"
    time: str = "08:00"  # Format: "HH:MM"
    format: str = "KPI Summary"
    day: str = "mon"

@router.post("")
async def schedule_report(req: ScheduleRequest):
    if req.file_id not in datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    job_id = str(uuid.uuid4())
    
    # We will schedule the job using apscheduler
    # For testing, if frequency is 'minute', we schedule it every minute
    # Otherwise we just schedule it daily at 8AM
    
    try:
        hour, minute = map(int, req.time.split(":"))
        
        if req.frequency.lower() == "minute":
            scheduler.add_job(
                send_mock_email,
                'interval',
                minutes=1,
                args=[req.file_id, req.email, "layout_key_mock", req.format],
                id=job_id
            )
        elif req.frequency.lower() == "weekly":
            scheduler.add_job(
                send_mock_email,
                'cron',
                day_of_week=req.day[:3].lower(),
                hour=hour,
                minute=minute,
                args=[req.file_id, req.email, "layout_key_mock", req.format],
                id=job_id
            )
        else: # Daily
            scheduler.add_job(
                send_mock_email,
                'cron',
                hour=hour,
                minute=minute,
                args=[req.file_id, req.email, "layout_key_mock", req.format],
                id=job_id
            )
            
        schedules[job_id] = {
            "file_id": req.file_id,
            "email": req.email,
            "frequency": req.frequency,
            "time": req.time,
            "format": req.format,
            "day": req.day
        }
        
        logger.info(f"Scheduled new report for {req.email} on dataset {req.file_id} ({req.frequency})")
        return {"status": "success", "job_id": job_id, "message": "Report scheduled successfully!"}
        
    except Exception as e:
        logger.error(f"Failed to schedule job: {e}")
        raise HTTPException(status_code=500, detail=str(e))
