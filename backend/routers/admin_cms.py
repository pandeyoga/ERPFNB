"""Sprint D — Admin CMS API (CRUD with auth) untuk manage Compro content.

This file is now a thin composition of sub-routers. Each sub-router lives in
`routers/_admin_cms/` and is split by resource:

- brands     → /api/admin/cms/brands/*
- outlets    → /api/admin/cms/outlets/*
- news       → /api/admin/cms/news/*
- menu       → /api/admin/cms/menu/*
- uploads    → /api/admin/cms/upload-image, /delete-image, /schedule/*, /jobs/*
- instagram  → /api/admin/cms/brands/{brand_id}/instagram/*

External imports (`from routers import admin_cms; app.include_router(admin_cms.router)`)
continue to work unchanged.
"""
from fastapi import APIRouter

from routers._admin_cms.brands import router as brands_router
from routers._admin_cms.outlets import router as outlets_router
from routers._admin_cms.news import router as news_router
from routers._admin_cms.menu import router as menu_router
from routers._admin_cms.uploads import router as uploads_router
from routers._admin_cms.instagram import router as instagram_router


router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms"])
router.include_router(brands_router)
router.include_router(outlets_router)
router.include_router(news_router)
router.include_router(menu_router)
router.include_router(uploads_router)
router.include_router(instagram_router)
