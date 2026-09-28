#!/usr/bin/env python3
"""Find truly-unused service modules by parsing imports across backend."""
import ast, os, re
from pathlib import Path

BACKEND = Path("/app/backend")
SERVICES = BACKEND / "services"

service_mods = set()
for f in SERVICES.glob("*.py"):
    if f.stem != "__init__":
        service_mods.add(f.stem)

# Collect every python file's text outside the service file itself
used = set()
for py in BACKEND.rglob("*.py"):
    if "__pycache__" in str(py):
        continue
    text = py.read_text(encoding="utf-8", errors="ignore")
    for mod in service_mods:
        # skip self
        if py == SERVICES / f"{mod}.py":
            continue
        # match `services import ... mod ...`, `services.mod`, `from services.mod`
        if re.search(rf'\bservices\.{mod}\b', text) or re.search(rf'\bfrom services\.{mod}\b', text):
            used.add(mod)
        # multi-import single-line: from services import a, b, mod
        for m in re.finditer(r'from services import ([^\n(]+)', text):
            names = re.split(r'[,\s]+', m.group(1))
            if mod in names:
                used.add(mod)
        # multi-import parenthesized (multiline): from services import (\n a,\n b,\n)
        for m in re.finditer(r'from services import \(([^)]*)\)', text, re.DOTALL):
            names = re.split(r'[,\s]+', m.group(1))
            if mod in names:
                used.add(mod)

unused = sorted(service_mods - used)
print(f"Total service modules: {len(service_mods)}")
print(f"Used: {len(used)}")
print(f"\n=== TRULY UNUSED SERVICE MODULES ({len(unused)}) ===")
for m in unused:
    size = (SERVICES / f"{m}.py").stat().st_size
    print(f"  {m}.py ({size} bytes)")
