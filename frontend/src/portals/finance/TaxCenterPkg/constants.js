/** TaxCenter/constants.js */
import { useEffect, useState } from "react";
import { Receipt, Calculator, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ───── helpers ────────────────────────────────────────────────────────

const TABS = [
  { id: "ppn",   label: "PPN",      icon: Receipt,      color: "blue"   },
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

/** Warna teks/aksen per jenis pajak (aman untuk light & dark mode). */
const TONE_TEXT = {
  blue:   "text-sky-700 dark:text-sky-300",
  purple: "text-violet-700 dark:text-violet-300",
  amber:  "text-amber-700 dark:text-amber-300",
  rose:   "text-rose-700 dark:text-rose-300",
};

/** Kotak catatan/info bertint per jenis pajak. */
const NOTE_TONE = {
  blue:   "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  purple: "border-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  amber:  "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  rose:   "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200",
};

function fmtRpShort(n) {
  if (!n && n !== 0) return "-";
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n/1_000_000).toFixed(2)}jt`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n/1_000).toFixed(0)}rb`;
  return `Rp ${n.toFixed(0)}`;
}

// ───── RateInput ────────────────────────────────────────────────────────────
function RateInput({ label, keyName, value, onChange, pctDisplay, disabled, hint }) {
  const [local, setLocal] = useState(String(value || ""));
  const id = `rate-${keyName}`;

  useEffect(() => { setLocal(String(value || "")); }, [value]);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs md:text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number" step="0.001" min="0" max="1"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { const v = parseFloat(local); if (!isNaN(v)) onChange(keyName, v); }}
          disabled={disabled}
          className="w-32 tabular-nums"
        />
        <span className="text-sm font-semibold text-muted-foreground">
          = {pctDisplay !== undefined ? pctDisplay : `${(parseFloat(local||0)*100).toFixed(1)}%`}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export { TABS, PPH_LABELS, TONE_TEXT, NOTE_TONE, fmtRpShort, RateInput };
