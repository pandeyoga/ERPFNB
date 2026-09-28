/** Manual Journal Form — free-form line editor with COA picker, balance check, dim outlet/brand.
 *  Phase 9D: AI Categorize chip suggests COA + cost center based on header description and per-line memo.
 *  Fase 1: AI Journal Generator integration untuk full entry generation dari natural language.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineHelp } from "@/components/shared/InlineHelp";
import ForecastGuardBanner from "@/components/shared/ForecastGuardBanner";
import AICategorizeChip from "@/components/shared/AICategorizeChip";
import PeriodLockBanner from "@/components/shared/PeriodLockBanner";
import AIJournalGenerator from "@/components/finance/AIJournalGenerator";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ManualJournalForm() {
  const navigate = useNavigate();
  const [coas, setCoas] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [verdicts, setVerdicts] = useState({});  // key -> verdict
  const [confirmReason, setConfirmReason] = useState("");
  const [form, setForm] = useState({
    entry_date: todayJakartaISO(),
    description: "",
    lines: [
      { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" },
      { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" },
    ],
  });

  useEffect(() => {
    setLoadingRefs(true);
    Promise.all([
      api.get("/master/chart-of-accounts", { params: { per_page: 100 } }),
      api.get("/master/outlets", { params: { per_page: 100 } }),
      api.get("/master/brands", { params: { per_page: 100 } }),
    ]).then(([c, o, b]) => {
      setCoas((unwrap(c) || []).filter(x => x.is_postable && x.active));
      setOutlets(unwrap(o) || []);
      setBrands(unwrap(b) || []);
    }).catch(() => {}).finally(() => setLoadingRefs(false));
  }, []);

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f,
      lines: [...f.lines, { coa_id: "", dr: 0, cr: 0, memo: "", dim_outlet: "", dim_brand: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const totals = useMemo(() => {
    const dr = form.lines.reduce((s, l) => s + Number(l.dr || 0), 0);
    const cr = form.lines.reduce((s, l) => s + Number(l.cr || 0), 0);
    return { dr, cr, balanced: Math.abs(dr - cr) < 0.5 && dr > 0 };
  }, [form.lines]);

  // Aggregate Dr lines on expense/cogs COA per outlet for forecast guard
  const guardScopes = useMemo(() => {
    const map = new Map();
    form.lines.forEach(l => {
      const dr = Number(l.dr || 0);
      if (dr <= 0) return;
      if (!l.coa_id) return;
      const coa = coas.find(c => c.id === l.coa_id);
      if (!coa) return;
      if (!["expense", "cogs"].includes(coa.type)) return;
      const key = `${l.dim_outlet || "_"}|${l.dim_brand || "_"}`;
      if (!map.has(key)) {
        map.set(key, {
          outletId: l.dim_outlet || null,
          brandId: l.dim_brand || null,
          amount: 0,
          coaCodes: new Set(),
        });
      }
      const e = map.get(key);
      e.amount += dr;
      e.coaCodes.add(coa.code);
    });
    return Array.from(map.values()).map(e => ({
      ...e, coaCodes: Array.from(e.coaCodes),
    }));
  }, [form.lines, coas]);

  // Prune stale verdicts when a scope is removed (e.g., outlet changed/line removed)
  useEffect(() => {
    const validKeys = new Set(
      guardScopes.map(s => `${s.outletId || "_"}|${s.brandId || "_"}`),
    );
    setVerdicts(prev => {
      const next = {};
      let changed = false;
      Object.entries(prev).forEach(([k, v]) => {
        if (validKeys.has(k)) next[k] = v;
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [guardScopes]);

  const hasSevereGuard = useMemo(
    () => Object.values(verdicts).some(v => v?.severity === "severe"), [verdicts],
  );
  const hasMildGuard = useMemo(
    () => Object.values(verdicts).some(v => v?.severity === "mild"), [verdicts],
  );
  const needsReason = hasSevereGuard || hasMildGuard;

  async function save() {
    if (!form.entry_date) { toast.error("Tanggal wajib"); return; }
    if (!form.description.trim()) { toast.error("Deskripsi wajib"); return; }
    if (!totals.balanced) { toast.error("Dr dan Cr harus balance dan > 0"); return; }
    if (form.lines.some(l => !l.coa_id)) { toast.error("Pilih COA untuk setiap line"); return; }
    if (form.lines.some(l => Number(l.dr || 0) > 0 && Number(l.cr || 0) > 0)) {
      toast.error("Satu line hanya boleh berisi Dr ATAU Cr, tidak keduanya"); return;
    }
    if (needsReason && !confirmReason.trim()) {
      toast.error("Pengeluaran melewati forecast — wajib isi alasan/justifikasi");
      return;
    }
    setSaving(true);
    try {
      const finalDesc = needsReason && confirmReason.trim()
        ? `${form.description.trim()} | Forecast guard reason: ${confirmReason.trim()}`
        : form.description.trim();
      const payload = {
        entry_date: form.entry_date,
        description: finalDesc,
        lines: form.lines.map(l => ({
          coa_id: l.coa_id,
          dr: Number(l.dr || 0),
          cr: Number(l.cr || 0),
          memo: l.memo,
          dim_outlet: l.dim_outlet || null,
          dim_brand: l.dim_brand || null,
        })).filter(l => l.dr > 0 || l.cr > 0),
      };
      const res = await api.post("/finance/journals/manual", payload);
      const je = unwrap(res);
      toast.success(`JE ${je.doc_no} dibuat`);
      navigate(`/finance/journals/${je.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal post manual JE");
    } finally { setSaving(false); }
  }

  const [periodLocked, setPeriodLocked] = useState(false);
  // Compute target period from entry_date for the lock banner
  // (purely cosmetic; backend also enforces)

  function handleAIGenerated(aiResult) {
    // Apply AI-generated journal entry to form
    const newLines = aiResult.lines.map(line => ({
      coa_id: line.coa_id,
      dr: line.dr || 0,
      cr: line.cr || 0,
      memo: line.memo || "",
      dim_outlet: line.dim_outlet || "",
      dim_brand: line.dim_brand || "",
    }));

    setForm({
      entry_date: aiResult.entry_date || todayJakartaISO(),
      description: aiResult.description || "",
      lines: newLines.length > 0 ? newLines : form.lines,
    });

    toast.success("Journal entry AI berhasil dimuat! Silakan review dan edit jika perlu.");
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="mje-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="mje-header">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2" data-testid="mje-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2">
          Manual Journal Entry <InlineHelp id="je-dr-cr" placement="bottom-start" />
        </h2>
        <div className="ml-auto">
          <Button onClick={save} disabled={saving || periodLocked || !totals.balanced || (needsReason && !confirmReason.trim())} className="rounded-full pill-active gap-2" data-testid="mje-save">
            <Save className="h-4 w-4" /> {saving ? "…" : (hasSevereGuard ? "Post (with reason)" : "Post JE")}
          </Button>
        </div>
      </div>

      {/* AI Journal Generator */}
      <AIJournalGenerator onGenerated={handleAIGenerated} />

      <PeriodLockBanner
        date={form.entry_date}
        action="post Journal Entry"
        onLockState={({ locked, closed }) => setPeriodLocked(locked || closed)}
      />

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Entry Date *</Label>
          <Input type="date" value={form.entry_date}
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
            className="glass-input mt-1" data-testid="mje-date" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Description *</Label>
          <Input value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="mis. Reklasifikasi expense April 2026"
            className="glass-input mt-1" data-testid="mje-desc" />
          <div className="mt-1.5">
            <AICategorizeChip
              description={form.description}
              testId="mje-ai-categ"
              onApply={(s) => {
                // Apply COA to the first line that has no COA selected; else the first line.
                setForm(f => {
                  const idx = f.lines.findIndex(l => !l.coa_id);
                  const target = idx >= 0 ? idx : 0;
                  const lines = [...f.lines];
                  lines[target] = {
                    ...lines[target],
                    coa_id: s.gl_id,
                    memo: lines[target].memo || f.description,
                    dim_outlet: s.cost_center_outlet_id || lines[target].dim_outlet,
                  };
                  return { ...f, lines };
                });
              }}
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Lines</h3>
          <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="mje-add-line">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        <DataTable
          rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          loading={loadingRefs}
          loadingRows={2}
          stickyHeader={false}
          rowTestIdPrefix="mje-line"
          empty={<div className="p-6"><EmptyState title="Belum ada baris" description="Tambah baris untuk mulai input jurnal." /></div>}
          columns={[
            { key: "coa_id", label: "COA *", primary: true,
              help: <InlineHelp id="manual-journal-coa" size="xs" placement="top" />,
              render: (r) => (
                <SimpleSelect
                  value={r.coa_id}
                  onValueChange={v => setLine(r._idx, "coa_id", v)}
                  options={[{ value: "", label: "-- pilih COA --" }, ...coas.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                  placeholder="-- pilih COA --"
                  className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                  testId={`mje-line-coa-${r._idx}`}
                />
              ) },
            { key: "dr", label: "Debit", numeric: true,
              render: (r) => (
                <Input type="number" min="0" value={r.dr}
                  onChange={e => setLine(r._idx, "dr", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-28"
                  data-testid={`mje-line-dr-${r._idx}`} />
              ) },
            { key: "cr", label: "Kredit", numeric: true,
              render: (r) => (
                <Input type="number" min="0" value={r.cr}
                  onChange={e => setLine(r._idx, "cr", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-28"
                  data-testid={`mje-line-cr-${r._idx}`} />
              ) },
            { key: "memo", label: "Memo",
              help: <InlineHelp id="manual-journal-memo" size="xs" placement="top" />,
              render: (r) => (
                <Input value={r.memo}
                  onChange={e => setLine(r._idx, "memo", e.target.value)}
                  placeholder="—" className="glass-input h-9"
                  data-testid={`mje-line-memo-${r._idx}`} />
              ) },
            { key: "dim_outlet", label: "Outlet",
              help: <InlineHelp id="manual-journal-dimensions" size="xs" placement="top" />,
              render: (r) => (
                <SimpleSelect
                  value={r.dim_outlet}
                  onValueChange={v => setLine(r._idx, "dim_outlet", v)}
                  options={[{ value: "", label: "—" }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
                  placeholder="—"
                  className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                  testId={`mje-line-outlet-${r._idx}`}
                />
              ) },
            { key: "dim_brand", label: "Brand",
              render: (r) => (
                <SimpleSelect
                  value={r.dim_brand}
                  onValueChange={v => setLine(r._idx, "dim_brand", v)}
                  options={[{ value: "", label: "—" }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
                  placeholder="—"
                  className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                  testId={`mje-line-brand-${r._idx}`}
                />
              ) },
          ]}
          rowAction={(r) => (
            <button onClick={() => removeLine(r._idx)} disabled={form.lines.length <= 2} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center disabled:opacity-30" data-testid={`mje-line-remove-${r._idx}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          footer={
            <tr className="font-bold" data-testid="mje-totals-row">
              <td className="px-4 py-3 text-right">Total</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="mje-total-dr">{fmtRp(totals.dr)}</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="mje-total-cr">{fmtRp(totals.cr)}</td>
              <td colSpan={4} />
            </tr>
          }
        />
        <div className={cn(
          "mt-3 flex items-center gap-2 text-sm",
          totals.balanced ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        )} data-testid="mje-balance-status">
          {totals.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium">
            {totals.balanced
              ? "Balance — siap di-post"
              : `Belum balance (Δ ${fmtRp(totals.dr - totals.cr)}). Total Dr harus sama dengan Cr dan > 0.`}
          </span>
        </div>
      </div>

      {/* Forecast Guard banners — one per (outlet, brand) scope of expense Dr */}
      {guardScopes.length > 0 && (
        <div className="space-y-2">
          {guardScopes.map((s, i) => {
            const key = `${s.outletId || "_"}|${s.brandId || "_"}`;
            return (
              <div key={`guard-${key}`}>
                {(s.outletId || s.brandId) && (
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 ml-1">
                    Scope: {s.outletId ? outlets.find(o => o.id === s.outletId)?.name || "Outlet" : ""}
                    {s.outletId && s.brandId ? " · " : ""}
                    {s.brandId ? brands.find(b => b.id === s.brandId)?.name || "Brand" : ""}
                    {" "}— Expense Dr {fmtRp(s.amount)} ({s.coaCodes.join(", ")})
                  </div>
                )}
                <ForecastGuardBanner
                  amount={s.amount}
                  outletId={s.outletId}
                  brandId={s.brandId}
                  kind="expense"
                  period={form.entry_date?.slice(0, 7)}
                  onChange={v => setVerdicts(prev => ({ ...prev, [key]: v }))}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Reason input shown when guard triggered */}
      {needsReason && (
        <div className={cn(
          "glass-card p-4 border-2",
          hasSevereGuard ? "border-red-500/40" : "border-amber-500/40",
        )}>
          <Label className="text-xs uppercase text-muted-foreground font-semibold">
            Alasan / Justifikasi (wajib karena {hasSevereGuard ? "jauh" : ""} di atas forecast)
          </Label>
          <Textarea
            value={confirmReason}
            onChange={e => setConfirmReason(e.target.value)}
            placeholder="mis. One-off renovasi outlet, bayar deposit vendor baru, koreksi periode lalu, dll."
            className="glass-input mt-1 min-h-[60px]"
            data-testid="mje-guard-reason"
          />
          <div className="text-[11px] text-muted-foreground mt-1.5">
            Alasan ini akan digabung ke description JE untuk audit trail.
          </div>
        </div>
      )}
    </div>
  );
}
