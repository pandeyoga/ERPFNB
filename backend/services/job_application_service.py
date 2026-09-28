"""Job Application Service

Handle job applications from public careers page.
Store applications and notify HR team.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize

logger = logging.getLogger("aurora.job_application")


def _now():
    return datetime.now(timezone.utc).isoformat()


async def create_application(data: dict) -> dict:
    """Create job application from public form submission.
    
    Args:
        data: {
            job_id: str (optional - can apply without specific job),
            name: str (required),
            email: str (required),
            phone: str (optional),
            message: str (optional - cover letter),
            cv_url: str (optional - uploaded CV file URL),
        }
    
    Returns:
        Created application document
    """
    db = get_db()
    
    # Validate required fields
    if not data.get("name") or not data.get("email"):
        raise ValueError("Name and email are required")
    
    # Get job details if job_id provided
    job = None
    job_title = None
    if data.get("job_id"):
        job = await db.jobs.find_one({"id": data["job_id"], "deleted_at": None})
        if job:
            job_title = job.get("title")
    
    # Create application document
    application = {
        "id": str(uuid.uuid4()),
        "job_id": data.get("job_id"),
        "job_title": job_title or "General Application",
        "name": data["name"],
        "email": data["email"],
        "phone": data.get("phone"),
        "message": data.get("message"),
        "cv_url": data.get("cv_url"),
        "status": "new",  # new, reviewed, shortlisted, rejected, hired
        "source": "website",
        "applied_at": _now(),
        "created_at": _now(),
        "updated_at": _now(),
        "reviewed_at": None,
        "reviewed_by": None,
        "notes": "",
    }
    
    await db.job_applications.insert_one(application)
    
    logger.info(f"Job application created: {application['id']} from {application['name']} ({application['email']})")
    
    # Send notification to HR
    await _notify_hr_new_application(application)
    
    return serialize(application)


async def _notify_hr_new_application(application: dict):
    """Send notification to HR team about new job application."""
    db = get_db()
    
    # Find HR users
    hr_users = []
    async for user in db.users.find({
        "role_ids": {"$exists": True},
        "status": "active",
        "deleted_at": None,
    }):
        # Check if user has HR role
        for role_id in user.get("role_ids", []):
            role = await db.roles.find_one({"id": role_id})
            if role and role.get("code") in ["HR", "HR_MANAGER"]:
                hr_users.append(user)
                break
    
    # Create notification for each HR user
    for user in hr_users:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "job_application",
            "title": "New Job Application",
            "body": f"{application['name']} applied for {application['job_title']}",
            "link": f"/hr/applications/{application['id']}",
            "read_at": None,
            "created_at": _now(),
        })
    
    logger.info(f"Notified {len(hr_users)} HR users about new application {application['id']}")
    
    # Optional: Send email to HR (will be MOCKED)
    try:
        from services import email_service
        await email_service.send_email(
            to="hr@fnbgroup.id",  # or get from config
            subject=f"New Job Application: {application['job_title']}",
            body_html=f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>New Job Application Received</h2>
                <p><strong>Position:</strong> {application['job_title']}</p>
                <p><strong>Applicant:</strong> {application['name']}</p>
                <p><strong>Email:</strong> {application['email']}</p>
                <p><strong>Phone:</strong> {application.get('phone', 'N/A')}</p>
                <p><strong>Applied:</strong> {application['applied_at']}</p>
                {f"<p><strong>Message:</strong><br>{application.get('message', 'N/A')}</p>" if application.get('message') else ""}
                <p><a href="https://app.fnbgroup.id/hr/applications/{application['id']}">View Application</a></p>
            </body>
            </html>
            """,
            template="new_job_application",
        )
    except Exception as e:
        logger.error(f"Failed to send email notification for application {application['id']}: {e}")


async def list_applications(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List job applications with filters."""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    cursor = db.job_applications.find(query).sort("applied_at", -1).skip(offset).limit(limit)
    applications = await cursor.to_list(limit)
    total = await db.job_applications.count_documents(query)
    
    return {
        "items": [serialize(app) for app in applications],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def get_application(application_id: str) -> dict:
    """Get single application by ID."""
    db = get_db()
    
    application = await db.job_applications.find_one({"id": application_id})
    if not application:
        raise ValueError(f"Application {application_id} not found")
    
    return serialize(application)


async def update_application_status(
    application_id: str,
    status: str,
    notes: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    """Update application status (new → reviewed → shortlisted/rejected → hired)."""
    db = get_db()
    
    valid_statuses = ["new", "reviewed", "shortlisted", "rejected", "hired"]
    if status not in valid_statuses:
        raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")
    
    update_doc = {
        "status": status,
        "updated_at": _now(),
    }
    
    if notes:
        update_doc["notes"] = notes
    
    if status in ["reviewed", "shortlisted", "rejected", "hired"]:
        update_doc["reviewed_at"] = _now()
        if user_id:
            update_doc["reviewed_by"] = user_id
    
    await db.job_applications.update_one(
        {"id": application_id},
        {"$set": update_doc}
    )
    
    logger.info(f"Application {application_id} status updated to {status}")
    
    return await get_application(application_id)


async def get_application_stats() -> dict:
    """Get application statistics by status."""
    db = get_db()
    
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    # Aggregate stats - limit to 100 status groups (more than enough for enum statuses)
    result = await db.job_applications.aggregate(pipeline).to_list(100)
    
    stats = {
        "new": 0,
        "reviewed": 0,
        "shortlisted": 0,
        "rejected": 0,
        "hired": 0,
    }
    
    for item in result:
        status = item["_id"]
        if status in stats:
            stats[status] = item["count"]
    
    stats["total"] = sum(stats.values())
    
    return stats
