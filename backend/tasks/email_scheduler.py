import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory store for schedules (For production, use a database or APScheduler's SQLAlchemyJobStore)
schedules = {}

def send_mock_email(file_id: str, email: str, layout_key: str, report_format: str = "KPI Summary"):
    """
    In a real environment, this function would use smtplib and jinja2 
    to compile an HTML email and send it via an SMTP server.
    
    Since we are mocking it, we will generate an HTML file locally 
    and log the 'sent' status.
    """
    logger.info(f"[SCHEDULER] Triggered scheduled report for {file_id} -> {email} with format: {report_format}")
    
    # We would normally fetch the latest KPIs from the backend logic here
    # For demonstration, we'll build a mock summary
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background: #f4f7f6; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <h2 style="color: #6C63FF; margin-top: 0;">MediQuery Automated Report</h2>
                <p>Hello,</p>
                <p>Here is your scheduled summary for dashboard <strong>{file_id}</strong>.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">Key Metrics</h3>
                    <ul style="color: #555;">
                        <li><strong>Format Requested:</strong> {report_format}</li>
                        <li><strong>Total Records:</strong> Updated recently</li>
                        <li><strong>Status:</strong> All systems nominal</li>
                    </ul>
                </div>
                
                <p>To view your full interactive dashboard, click the link below:</p>
                <a href="http://localhost:5173/" style="display: inline-block; padding: 10px 20px; background: #6C63FF; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
                
                <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated message from MediQuery.<br/>
                    Generated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </div>
        </body>
    </html>
    """
    
    # Save to a file so the user can see what it looks like
    filename = f"mock_email_{file_id}_{datetime.now().strftime('%H%M%S')}.html"
    filepath = os.path.join(os.getcwd(), filename)
    
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"[SCHEDULER] Mock email successfully 'sent' and saved to {filepath}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Failed to save mock email: {e}")

