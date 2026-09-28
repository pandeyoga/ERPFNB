/**
 * portalGate.js — shared route-level RBAC helper for portal shells.
 *
 * Why: the App.js `RequirePortal` guard only checks that the user has ANY
 * permission with a given portal prefix (e.g. `finance.*`). A role with a
 * narrow feature perm inside that prefix can still land on the portal shell
 * and — without route-level guards — URL-tamper into sensitive sub-routes.
 *
 * Pattern is copied from `portals/admin/AdminPortal.jsx` (PART O fix), extracted
 * here so all 7 non-admin portals apply IDENTICAL defense-in-depth.
 *
 * Usage:
 *   import { Gate, useGate } from "@/lib/portalGate";
 *   const g = useGate(user);
 *   // <Route path="ap-aging" element={g("finance.ap.read", <APAging/>)} />
 *   // <Route path="something" element={<Gate user={user} need="finance.report.profit_loss"><X/></Gate>} />
 *
 * `need` can be:
 *   - a bare namespace: "finance.ap"   → passes if user has "finance.ap" OR any "finance.ap.*"
 *   - a specific perm : "finance.ap.read" → passes if user has that exact perm
 *   - an array of needs: ["finance.report.profit_loss", "finance.report.balance_sheet"] →
 *     passes if ANY matches (OR semantics; keeps existing "manager sees several report kinds")
 *
 * SUPER_ADMIN (`*` in perms) always passes.
 */
import React from "react";
import { Navigate } from "react-router-dom";

export function permitted(user, need) {
  const perms = (user && user.permissions) || [];
  if (perms.includes("*")) return true;
  const needs = Array.isArray(need) ? need : [need];
  return needs.some((n) => {
    if (!n) return true; // empty need = public within portal
    return perms.some((p) => p === n || p.startsWith(n + "."));
  });
}

export function Gate({ user, need, children, redirect = "/no-access" }) {
  if (!permitted(user, need)) return <Navigate to={redirect} replace />;
  return children;
}

// Convenience factory so portal shells can write concise `g(need, element)`.
// Named `makeGate` (not `useGate`) intentionally — this is a plain factory, NOT
// a React hook, so it may be called after an early return.
export function makeGate(user) {
  return function g(need, element) {
    return (
      <Gate user={user} need={need}>
        {element}
      </Gate>
    );
  };
}
