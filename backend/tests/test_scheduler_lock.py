"""Job terjadwal saat backend berjalan di beberapa worker/instance: satu tick cron hanya dijalankan sekali
(kunci `scheduler_locks`), "Jalankan sekarang" tetap jalan, dan DB bermasalah tidak menghentikan job. Tanpa jaringan."""
import asyncio

import mongomock_motor

from core import db as core_db


def test_one_tick_runs_once_across_workers(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["sched_lock"]
    monkeypatch.setattr(core_db, "_db", mdb)
    from datetime import datetime

    from services._scheduler import _state

    class Frozen(datetime):                       # tick tetap → uji tidak bergantung pada pergantian menit
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 11, 25, 7, 0, 0, 250_000, tzinfo=tz)
    monkeypatch.setattr(_state, "datetime", Frozen)
    calls = []

    async def job():
        calls.append(1)

    async def go():
        workers = [_state._wrap_job("ai_auditor", job, scheduled=True) for _ in range(3)]   # 3 worker, tick sama
        await asyncio.gather(*(w() for w in workers))
        assert len(calls) == 1
        assert await mdb.scheduler_locks.count_documents({"job_id": "ai_auditor"}) == 1
        assert await mdb.scheduler_runs.count_documents({"job_id": "ai_auditor"}) == 1     # riwayat tidak dobel
        await _state._wrap_job("ai_auditor", job)()                                           # Jalankan sekarang
        assert len(calls) == 2
        await _state._wrap_job("ai_inbox", job, scheduled=True)()                             # job lain: kunci sendiri
        assert len(calls) == 3

        class Broken:
            def __getattr__(self, name):
                raise RuntimeError("db down")
        monkeypatch.setattr(core_db, "_db", Broken())
        assert await _state._claim_tick("ai_retention") is True                               # gagal terbuka
    asyncio.run(go())
