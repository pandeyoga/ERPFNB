/** Users/helpers.js — pure helpers + small display components. */
import { useEffect, useState } from "react";
import {
  Plus, Edit2, Trash2, Search, KeyRound, Building2, Store, Globe2,
  ShieldCheck, Users2, UserCog,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

/* ─── Access Level helper ──────────────────────────────────────────── */

function isFullAccess(user) {
  const perms = user?.permissions || [];
  return perms.includes("*");
}

function resolveAccessLevel(u, outlets = []) {
  // "full" = assigned to all outlets (or user has global perm)
  const allOutletIds = outlets.map((o) => o.id);
  const hasAll = allOutletIds.length > 0 && allOutletIds.every((id) => (u.outlet_ids || []).includes(id));
  if (!u.outlet_ids || u.outlet_ids.length === 0) return "none";
  if (hasAll || (u.outlet_ids || []).length >= allOutletIds.length) return "full";
  return "partial";
}

/* ─── Badge components ─────────────────────────────────────────────── */
function AccessBadge({ u, outlets = [], brands = [] }) {
  const lvl = resolveAccessLevel(u, outlets);
  if (lvl === "full")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
        <Globe2 className="h-3 w-3" /> Full Access
      </span>
    );
  if (lvl === "partial") {
    const names = (u.outlet_ids || [])
      .map((id) => outlets.find((o) => o.id === id)?.name)
      .filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1">
        {names.slice(0, 2).map((n) => (
          <span key={n} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
            <Store className="h-3 w-3" /> {n}
          </span>
        ))}
        {names.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{names.length - 2}</span>
        )}
      </div>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground">Tidak ada outlet</span>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */

export { isFullAccess, resolveAccessLevel, AccessBadge };
