#!/usr/bin/env python3
"""tour_render_probe.py — RUNTIME tour target validation via Playwright — Phase 3.

Complements audit_tours[_v2].py (static AST) with a LIVE browser walk that verifies
each tour step's target selector actually mounts in the DOM at runtime after
navigating to the tour's route. Answers: "when a user reaches this page and
launches this tour, do all the target elements truly exist?"

Strategy:
  1. Login as SUPER_ADMIN (sees all portals + all routes).
  2. For each unique route in artifacts/tour_map_expanded.json:
     - Navigate to `${PREVIEW_URL}${route}` (skip routes with :param — dynamic).
     - Wait for content to render.
     - For each expected target selector, run `document.querySelector(sel)` in-page.
     - Record present/absent.
  3. Aggregate report:
     - PASS = all targets present.
     - PARTIAL = 1+ target missing (may be conditional UI — e.g. empty-state cards).
     - FAIL = ALL targets missing (route likely broken or renamed).
     - SKIPPED = route uses :param (dynamic segment we can't guess).

Note: Some routes gate on data (e.g. detail pages) or on non-admin roles; we
run as SUPER_ADMIN to maximize visibility. Missing targets on data-driven pages
usually mean "no data available", not a broken tour.

Env:
  PREVIEW_URL (default https://repo-sync-tour.preview.emergentagent.com)
  ADMIN_EMAIL, ADMIN_PASSWORD (default admin@fnbgroup.id / Demo@2026)

Exit 0 if PASS+PARTIAL >= 90% of testable routes (any FAIL counts).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ARTIFACTS = Path("/app/scripts/artifacts")
TOUR_MAP = ARTIFACTS / "tour_map_expanded.json"
REPORT = ARTIFACTS / "tour_render_report.json"
REPORT.parent.mkdir(exist_ok=True, parents=True)

PREVIEW_URL = os.environ.get("PREVIEW_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@fnbgroup.id")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Demo@2026")


def _c(col: str, s: str) -> str:
    return f"\033[{col}m{s}\033[0m"


async def run() -> int:
    # Load tour map (produced by dump_tour_map.py)
    if not TOUR_MAP.exists():
        print("tour_map_expanded.json missing — run dump_tour_map.py first")
        return 2
    entries = json.loads(TOUR_MAP.read_text())

    # De-dup by route (multiple tours per route → union of targets)
    per_route: dict[str, dict] = {}
    for e in entries:
        r = e["route"]
        if r not in per_route:
            per_route[r] = {"route": r, "tours": [], "targets": set()}
        per_route[r]["tours"].append(e["tour_id"])
        for t in e["targets"]:
            per_route[r]["targets"].add(t)

    total_routes = len(per_route)
    dynamic = [r for r in per_route if ":" in r or "*" in r]
    static_routes = [r for r in per_route if r not in dynamic]

    print(_c("1;36", "=" * 78))
    print(_c("1;36", f"  TOUR RENDER PROBE (Phase 3) — {total_routes} routes, "
                     f"{len(static_routes)} testable (static), {len(dynamic)} dynamic (skipped)"))
    print(_c("1;36", "=" * 78))
    print(f"  Preview: {PREVIEW_URL}")

    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        page.set_default_timeout(20000)

        # Login helper (idempotent — can be called again on session loss)
        async def do_login():
            await page.goto(f"{PREVIEW_URL}/login", wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(1200)
            try:
                await page.fill('input[type="email"]', ADMIN_EMAIL)
                await page.fill('input[type="password"]', ADMIN_PASSWORD)
                await page.click('button:has-text("Masuk")')
            except Exception as e:
                return False, f"login form fill failed: {e}"
            await page.wait_for_timeout(3200)
            cur = page.url
            if "/login" in cur:
                return False, f"login did not redirect (still {cur})"
            return True, cur

        # Login
        print(_c("36", "• Login as SUPER_ADMIN"))
        ok, msg = await do_login()
        if not ok:
            print(_c("31", msg))
            return 2
        print(_c("32", f"  ✅ logged in — url={msg}"))

        # Iterate static routes
        results = []
        pass_ct = partial_ct = fail_ct = err_ct = 0

        for i, route in enumerate(sorted(static_routes), 1):
            spec = per_route[route]
            targets = sorted(spec["targets"])
            if not targets:
                # No targets — nothing to probe
                results.append({
                    "route": route, "tours": spec["tours"], "targets": [],
                    "verdict": "NO_TARGETS", "found": [], "missing": [],
                })
                continue

            try:
                await page.goto(f"{PREVIEW_URL}{route}", wait_until="domcontentloaded", timeout=20000)
                # generous wait for lazy chunks + data fetch
                await page.wait_for_timeout(1500)
                # Smart wait: try to wait for at LEAST one tour target to appear
                # (up to 8s). This lets data-heavy pages finish their "Memuat…" state
                # before we probe for target presence.
                for sel in targets[:5]:  # try up to first 5 selectors
                    try:
                        await page.wait_for_selector(sel, timeout=1600, state="attached")
                        break
                    except Exception:
                        continue
                # additional short settle after first target appears
                await page.wait_for_timeout(400)
                # After navigation, check if we ended on /no-access (route may be
                # blocked for SUPER_ADMIN if perm not seeded — rare) or /login
                final_url = page.url
                if "/login" in final_url:
                    # Session lost — re-login and RETRY this route once
                    print(_c("33", f"  [{i:>3}/{len(static_routes)}] {route:<45} session lost, re-login…"))
                    ok, _ = await do_login()
                    if ok:
                        await page.goto(f"{PREVIEW_URL}{route}",
                                        wait_until="domcontentloaded", timeout=20000)
                        await page.wait_for_timeout(1800)
                        final_url = page.url
                    if "/login" in final_url:
                        results.append({
                            "route": route, "tours": spec["tours"],
                            "targets": targets, "verdict": "NO_ACCESS",
                            "final_url": final_url,
                            "found": [], "missing": targets,
                        })
                        err_ct += 1
                        print(_c("33", f"  [{i:>3}/{len(static_routes)}] {route:<45} STILL NO_ACCESS after re-login"))
                        continue

                if "/no-access" in final_url:
                    results.append({
                        "route": route, "tours": spec["tours"],
                        "targets": targets, "verdict": "NO_ACCESS",
                        "final_url": final_url,
                        "found": [], "missing": targets,
                    })
                    err_ct += 1
                    print(_c("33", f"  [{i:>3}/{len(static_routes)}] {route:<45} NO_ACCESS (perm)"))
                    continue

                # Check each target
                async def _scan_targets():
                    _found, _missing = [], []
                    for sel in targets:
                        try:
                            exists = await page.evaluate(
                                "sel => !!document.querySelector(sel)", sel
                            )
                            (_found if exists else _missing).append(sel)
                        except Exception:
                            _missing.append(sel)
                    return _found, _missing

                found, missing = await _scan_targets()

                # Retry-on-all-missing: redirect stubs (e.g. /finance/comparatives →
                # /finance/reports?tab=…) and data-heavy async tabs may mount targets
                # AFTER the initial smart-wait window. Give them a fair second chance
                # by waiting for any target to attach, then re-scan. This does NOT
                # weaken the gate — the target must still genuinely appear in the DOM.
                if missing and len(missing) == len(targets):
                    for sel in targets[:5]:
                        try:
                            await page.wait_for_selector(sel, timeout=4000, state="attached")
                            break
                        except Exception:
                            continue
                    await page.wait_for_timeout(600)
                    found, missing = await _scan_targets()

                if not missing:
                    verdict = "PASS"
                    pass_ct += 1
                    marker = _c("32", "✅")
                elif len(missing) == len(targets):
                    verdict = "FAIL"
                    fail_ct += 1
                    marker = _c("31", "❌")
                else:
                    verdict = "PARTIAL"
                    partial_ct += 1
                    marker = _c("33", "⚠️")

                results.append({
                    "route": route, "tours": spec["tours"],
                    "targets": targets, "verdict": verdict,
                    "final_url": final_url,
                    "found": found, "missing": missing,
                })
                short_route = (route[:42] + "…") if len(route) > 43 else route
                print(f"  [{i:>3}/{len(static_routes)}] {marker} {short_route:<45} "
                      f"{verdict:<8} {len(found)}/{len(targets)}"
                      + (f"  missing={missing[:3]}" if missing else ""))
            except Exception as e:
                results.append({
                    "route": route, "tours": spec["tours"],
                    "targets": targets, "verdict": "ERROR",
                    "error": str(e), "found": [], "missing": targets,
                })
                err_ct += 1
                print(_c("31", f"  [{i:>3}/{len(static_routes)}] {route:<45} ERROR: {str(e)[:60]}"))

        await ctx.close()
        await browser.close()

    # Save report
    testable = len(static_routes)
    no_targets = sum(1 for r in results if r["verdict"] == "NO_TARGETS")
    report = {
        "preview_url": PREVIEW_URL,
        "total_routes": total_routes,
        "static_testable": testable,
        "dynamic_skipped": len(dynamic),
        "verdict_counts": {
            "PASS": pass_ct,
            "PARTIAL": partial_ct,
            "FAIL": fail_ct,
            "NO_ACCESS": err_ct,
            "NO_TARGETS": no_targets,
        },
        "results": results,
    }
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    print()
    print(_c("1;36", "=" * 78))
    print(_c("1;36", "  SUMMARY"))
    print(_c("1;36", "=" * 78))
    print(f"  total routes in map: {total_routes}")
    print(f"  static testable   : {testable}")
    print(f"  dynamic skipped   : {len(dynamic)}")
    print(f"  PASS      : {_c('32', str(pass_ct))}")
    print(f"  PARTIAL   : {_c('33', str(partial_ct))}  (some targets missing — may be conditional UI)")
    print(f"  FAIL      : {_c('31', str(fail_ct))}    (ALL targets missing — likely broken)")
    print(f"  NO_ACCESS : {_c('31', str(err_ct))}    (route blocked/errored)")
    print(f"  NO_TARGETS: {no_targets}   (tour has zero targets)")
    print(f"  report    : {REPORT}")

    testable_denom = max(1, pass_ct + partial_ct + fail_ct + err_ct)
    healthy_ratio = (pass_ct + partial_ct) / testable_denom
    print(f"  health ratio: {healthy_ratio:.1%} (PASS+PARTIAL / testable)")

    # Gate: 90% healthy AND 0 FAILs (partial is acceptable — often empty-state)
    if fail_ct == 0 and healthy_ratio >= 0.90:
        print(_c("1;32", "  ✅ TOUR RUNTIME RENDER GATE GREEN"))
        return 0
    print(_c("1;31", f"  ❌ GATE FAIL — FAIL={fail_ct} healthy_ratio={healthy_ratio:.1%} (need 0 FAILs and >=90% healthy)"))
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
