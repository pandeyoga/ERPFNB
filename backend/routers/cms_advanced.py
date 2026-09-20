"""CMS Advanced — Content Versioning + Media Library + Approval Workflow +
Analytics + Bulk Ops + Page Builder.

This file is now a thin composition of sub-routers. Each sub-router lives in
`routers/_cms_advanced/` and is split by feature:

- analytics  → /analytics/track, /analytics/overview, /analytics/popular
- workflow   → /pending-reviews, /{ct}/{id}/submit-for-review, /approve, /reject, /workflow-history
- bulk       → /{ct}/bulk-action
- pages      → /pages/*
- versions   → /{ct}/{id}/versions[/{n}[/restore]]
- media      → /media/*

External imports continue to work unchanged:
  - `app.include_router(cms_advanced.router)` → same router exposed
  - `from routers.cms_advanced import create_version_snapshot` → re-exported
"""
from fastapi import APIRouter

from routers._cms_advanced._common import (  # re-exported for external callers  # noqa: F401
    create_version_snapshot,
    CONTENT_COLLECTION_MAP,
    WORKFLOW_STATUSES,
    NOW,
)
from routers._cms_advanced.analytics import router as analytics_router
from routers._cms_advanced.workflow import router as workflow_router
from routers._cms_advanced.bulk import router as bulk_router
from routers._cms_advanced.pages import router as pages_router
from routers._cms_advanced.versions import router as versions_router
from routers._cms_advanced.media import router as media_router


router = APIRouter(prefix="/api/admin/cms", tags=["cms-advanced"])
router.include_router(analytics_router)
router.include_router(workflow_router)
router.include_router(bulk_router)
router.include_router(pages_router)
router.include_router(versions_router)
router.include_router(media_router)
