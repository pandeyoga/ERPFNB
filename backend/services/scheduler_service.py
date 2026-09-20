"""Scheduler service — thin facade.

All logic lives in services/_scheduler/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._scheduler import (  # noqa: F401
    _scheduler,
    _JOB_REGISTRY,
    _register,
    _record_run,
    _wrap_job,
    _ensure_registered,
    start_scheduler,
    shutdown_scheduler,
    list_jobs,
    run_job_now,
    list_runs,
)
