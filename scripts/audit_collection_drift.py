#!/usr/bin/env python3
"""Comprehensive collection-drift scanner.
For every db.<collection> read reference in services+routers, flag collections
that are EMPTY in the live DB (potential RC-1 drift / dead reads)."""
import asyncio, os, re
from pathlib import Path
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path("/app/backend")

# Read MONGO_URL + DB_NAME from backend/.env (NEVER hardcode DB — RC-1 / guardrails §10).
_env = BACKEND / ".env"
if _env.exists():
    for _ln in _env.read_text().splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "test_database")
db = AsyncIOMotorClient(_MONGO_URL)[_DB_NAME]

PAT = re.compile(r'db\.([a-z][a-z0-9_]*)\s*\.\s*(find|find_one|aggregate|count_documents|distinct|update_one|update_many|insert_one|insert_many|delete_one|delete_many)')
IGNORE = {"command", "client", "name"}


async def main():
    live = {c: await db[c].count_documents({}) for c in await db.list_collection_names()}

    # collection -> {op -> set of file:line}
    refs = defaultdict(lambda: defaultdict(set))
    for py in list((BACKEND/"services").rglob("*.py")) + list((BACKEND/"routers").rglob("*.py")):
        if "__pycache__" in str(py):
            continue
        for i, line in enumerate(py.read_text(errors="ignore").splitlines(), 1):
            for m in PAT.finditer(line):
                coll, op = m.group(1), m.group(2)
                if coll in IGNORE:
                    continue
                refs[coll][op].add(f"{py.relative_to(BACKEND)}:{i}")

    print("=== COLLECTIONS REFERENCED IN CODE BUT EMPTY/MISSING IN DB ===")
    print("(read ops on empty collection = likely drift or dead feature)\n")
    read_ops = {"find", "find_one", "aggregate", "count_documents", "distinct"}
    suspects = []
    for coll in sorted(refs):
        n = live.get(coll, None)
        has_read = any(op in read_ops for op in refs[coll])
        has_write = any(op in {"insert_one", "insert_many"} for op in refs[coll])
        if (n is None or n == 0) and has_read:
            # only interesting if NOT written by code either (pure dead read) OR written elsewhere
            tag = "MISSING" if n is None else "EMPTY"
            suspects.append((coll, tag, has_write))
            readers = []
            for op in read_ops:
                readers += list(refs[coll].get(op, []))
            print(f"  [{tag}] db.{coll}  (written_by_code={has_write})")
            for r in sorted(readers)[:6]:
                print(f"        read @ {r}")
    if not suspects:
        print("  none")

asyncio.run(main())
