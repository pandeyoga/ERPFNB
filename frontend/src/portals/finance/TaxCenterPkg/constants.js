/** TaxCenter/constants.js */
import { useEffect, useState, useCallback } from "react";
import { Receipt, ToggleLeft, ToggleRight, Calculator, ChevronDown, ChevronRight,
         AlertTriangle, CheckCircle2, Info, RefreshCw, TrendingDown, FileDown } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";

// ───── helpers ────────────────────────────────────────────────────────

const TABS = [
  { id: "ppn",   label: "PPN",      icon: Receipt,     color: "blue"   },
  { id: "pph21", label: "PPh 21",   icon: TrendingDown, color: "purple" },
  { id: "pph23", label: "PPh 23",   icon: Calculator,   color: "amber"  },
  { id: "pph42", label: "PPh 4(2)", icon: Receipt,      color: "rose"   },
];

const PPH_LABELS = {
  ppn:   { full: "PPN (Pajak Pertambahan Nilai)",         law: "Perpu 2/2024 — efektif 2025" },
  pph21: { full: "PPh Pasal 21 (Karyawan)",               law: "UU HPP No. 7/2021" },
  pph23: { full: "PPh Pasal 23 (Jasa/Royalti)",           law: "UU PPh" },
  pph42: { full: "PPh Pasal 4 Ayat 2 (Final)",            law: "UU PPh" },
};

const colMap = {
  blue:   "bg-blue-50 border-blue-200 text-blue-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
  amber:  "bg-amber-50 border-amber-200 text-amber-700",
  rose:   "bg-rose-50 border-rose-200 text-rose-700",
};

const badgeColor = {
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  amber:  "bg-amber-100 text-amber-700 border-amber-200",
  rose:   "bg-rose-100 text-rose-700 border-rose-200",
};

function fmtRpShort(n) {
  if (!n && n !== 0) return "-";
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n/1_000_000).toFixed(2)}jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n/1_000).toFixed(0)}rb`;
  return `Rp ${n.toFixed(0)}`;
}

// ───── ToggleSwitch ────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, color = "blue", disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none",
        checked
          ? (color === "blue" ? "bg-blue-500" : color === "purple" ? "bg-purple-500" : color === "amber" ? "bg-amber-500" : "bg-rose-500")
          : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300",
        checked ? "translate-x-8" : "translate-x-1"
      )} />
    </button>
  );
}

// ───── RateInput ────────────────────────────────────────────────────────────
function RateInput({ label, keyName, value, onChange, pctDisplay, disabled, hint }) {
  const [local, setLocal] = useState(String(value || ""));

  useEffect(() => { setLocal(String(value || "")); }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number" step="0.001" min="0" max="1"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { const v = parseFloat(local); if (!isNaN(v)) onChange(keyName, v); }}
          disabled={disabled}
          className="w-32 tabular-nums"
        />
        <span className="text-sm font-semibold text-gray-600">
          = {pctDisplay !== undefined ? pctDisplay : `${(parseFloat(local||0)*100).toFixed(1)}%`}
        </span>
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ───── PPh21 Calculator Widget ─────────────────────────────────────────────────

export { TABS, PPH_LABELS, fmtRpShort, ToggleSwitch, RateInput, badgeColor, colMap };
