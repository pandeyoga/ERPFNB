#!/usr/bin/env python3
"""dump_tour_map.py — export (route, tour_id, [targets]) tuples to JSON for browser validation.

Reads:
  - frontend/src/contexts/tour/tourMap.js   → pathToTours mapping
  - frontend/src/contexts/tour/tours/*.js   → tour steps + targets

Writes:
  - scripts/artifacts/tour_map_expanded.json — [{route, tour_id, targets: [selector, ...]}]

This is consumed by scripts/tour_render_probe.py (Playwright) which walks each
route and asserts each target actually mounts in the DOM at runtime.
"""
import json
import re
from pathlib import Path

ROOT = Path("/app")
SRC = ROOT / "frontend/src"
TOUR_MAP_JS = SRC / "contexts/tour/tourMap.js"
TOURS_DIR = SRC / "contexts/tour/tours"
OUT = ROOT / "scripts/artifacts/tour_map_expanded.json"
OUT.parent.mkdir(exist_ok=True, parents=True)


def parse_path_to_tours(js: str) -> dict[str, list[str]]:
    """Parse `const pathToTours = { "/path": ["tour-id-1", ...] }` map."""
    # Find the block starting with pathToTours
    m = re.search(r"const\s+pathToTours\s*=\s*\{(.*?)\n\}\s*;", js, re.DOTALL)
    if not m:
        raise SystemExit("pathToTours block not found in tourMap.js")
    body = m.group(1)
    out: dict[str, list[str]] = {}
    # Match:  "/path": ["a", "b"],   OR   '/path': ['a']
    entry_re = re.compile(r"""["']([^"']+)["']\s*:\s*\[\s*(.*?)\s*\]""", re.DOTALL)
    for e in entry_re.finditer(body):
        path = e.group(1)
        ids_blob = e.group(2)
        ids = re.findall(r"""["']([a-zA-Z0-9_\-]+)["']""", ids_blob)
        out[path] = ids
    return out


def parse_tour_steps(js: str) -> dict[str, list[str]]:
    """Parse tour objects from a tour domain file.

    Returns {tour_var_name: [target_selectors]} — variable name (not tour_id!).
    The registry.js maps var → tour_id; caller merges via `steps_by_var`.
    """
    out: dict[str, list[str]] = {}
    # Find each `const <name>Tour = { ... };` block
    tour_re = re.compile(
        r"""const\s+([a-zA-Z_][a-zA-Z0-9_]*Tour)\s*=\s*\{(.*?)\n\};""",
        re.DOTALL,
    )
    for m in tour_re.finditer(js):
        name = m.group(1)
        body = m.group(2)
        # Extract target: "..." (can contain single quotes) OR target: '...' (can contain double quotes)
        # Two separate regexes so inner quotes don't terminate the outer match.
        targets = (
            re.findall(r'target:\s*"([^"]+)"', body)
            + re.findall(r"target:\s*'([^']+)'", body)
        )
        out[name] = targets
    return out


def parse_registry(js: str) -> dict[str, str]:
    """Parse `tourRegistry = { "id-a": aTour, "id-b": bTour, ... }` → {id: varName}."""
    m = re.search(r"tourRegistry\s*=\s*\{(.*?)\n\}\s*;", js, re.DOTALL)
    if not m:
        raise SystemExit("tourRegistry block not found in tours/registry.js")
    body = m.group(1)
    out: dict[str, str] = {}
    entry_re = re.compile(r"""["']([a-zA-Z0-9_\-]+)["']\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*Tour)\s*,?""")
    for e in entry_re.finditer(body):
        out[e.group(1)] = e.group(2)
    return out


def main() -> None:
    tour_map_js = TOUR_MAP_JS.read_text()
    path_to_tours = parse_path_to_tours(tour_map_js)
    print(f"path_to_tours: {len(path_to_tours)} routes")

    # Parse each domain file (skip registry itself for step extraction)
    steps_by_var: dict[str, list[str]] = {}
    for f in sorted(TOURS_DIR.glob("*.js")):
        if f.name == "registry.js":
            continue
        steps = parse_tour_steps(f.read_text())
        for var, targets in steps.items():
            steps_by_var[var] = targets

    print(f"tour vars discovered: {len(steps_by_var)}")

    registry_js = (TOURS_DIR / "registry.js").read_text()
    id_to_var = parse_registry(registry_js)
    print(f"tour ids in registry: {len(id_to_var)}")

    # Expand (route, tour_id, targets)
    expanded: list[dict] = []
    seen_pairs = set()
    for route, ids in path_to_tours.items():
        for tid in ids:
            key = (route, tid)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            var = id_to_var.get(tid)
            if not var:
                targets = []
                status = "MISSING_IN_REGISTRY"
            else:
                targets = steps_by_var.get(var, [])
                status = "OK"
            expanded.append({
                "route": route,
                "tour_id": tid,
                "tour_var": var,
                "targets": targets,
                "status": status,
            })

    OUT.write_text(json.dumps(expanded, indent=2, ensure_ascii=False))
    print(f"wrote {OUT} with {len(expanded)} (route, tour_id) pairs")
    missing = [e for e in expanded if e["status"] != "OK"]
    if missing:
        print(f"  ⚠️  {len(missing)} pairs have missing tour vars — check registry consistency")
    total_targets = sum(len(e["targets"]) for e in expanded)
    print(f"  total step targets across all tours: {total_targets}")


if __name__ == "__main__":
    main()
