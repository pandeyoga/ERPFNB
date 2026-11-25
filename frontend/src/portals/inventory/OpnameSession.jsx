/** Opname Session — active counting form.
 *
 * Optimized 2026-05-26:
 *   - Extracted OpnameLineRow as React.memo to prevent unnecessary re-renders
 *     of all 50-100 rows whenever the user types in a single input.
 *   - Stabilized setCount / setNote callbacks via useCallback.
 *   - Memoized derived data (filtered + variance summary).
 *   - Added AI Variance Explainer panel (non-blocking).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Send, Search, AlertTriangle, ClipboardCheck } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import { FormActionBar, useDirtyState } from "@/components/shared/UnsavedChanges";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import useOutletScope from "@/hooks/useOutletScope";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import AIVariancePanel from "./AIVariancePanel";
import { confirmDialog } from "@/components/shared/confirmDialog";

/* ----------------------------------- Page ----------------------------------- */
export default function OpnameSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { allOutlets } = useOutletScope();
  const [sess, setSess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState({}); // { item_id: { counted_qty, notes } }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = unwrap(await api.get(`/inventory/opname/${id}`));
      setSess(found || null);
      const init = {};
      (found?.lines || []).forEach(ln => {
        if (ln.counted_qty != null) {
          init[ln.item_id] = { counted_qty: ln.counted_qty, notes: ln.notes || "" };
        }
      });
      setCounts(init);
    } catch (e) {
      // UI-07: unknown/forbidden session → render the empty state instead of an uncaught rejection
      setSess(null);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const { dirty, markSaved } = useDirtyState(counts, !loading && !!sess);

  const filtered = useMemo(() => {
    if (!sess) return [];
    const lines = sess.lines || [];
    if (!q) return lines;
    const s = q.toLowerCase();
    return lines.filter(ln => (ln.item_name || "").toLowerCase().includes(s));
  }, [sess, q]);

  // Stabilized callbacks so memoized OpnameLineRow does not re-render on parent typing
  const setCount = useCallback((itemId, val) => {
    setCounts((c) => ({ ...c, [itemId]: { ...(c[itemId] || {}), counted_qty: val } }));
  }, []);
  const setNote = useCallback((itemId, val) => {
    setCounts((c) => ({ ...c, [itemId]: { ...(c[itemId] || {}), notes: val } }));
  }, []);

  async function saveProgress() {
    if (!sess) return;
    const updates = Object.entries(counts)
      .filter(([_, v]) => v.counted_qty !== "" && v.counted_qty != null)
      .map(([item_id, v]) => ({
        item_id,
        counted_qty: Number(v.counted_qty),
        notes: v.notes,
      }));
    if (updates.length === 0) { toast.info("Belum ada perubahan"); return; }
    setSaving(true);
    try {
      const res = await api.patch(`/inventory/opname/${id}/lines`, { lines: updates });
      setSess(unwrap(res));
      markSaved();
      toast.success("Progres disimpan");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan progres");
    } finally { setSaving(false); }
  }

  async function submitOpname() {
    if (!(await confirmDialog("Ajukan opname? Selisih (variance) akan diposting ke stock movements & jurnal."))) return;
    setSubmitting(true);
    try {
      await saveProgress();
      await api.post(`/inventory/opname/${id}/submit`);
      toast.success("Opname diajukan");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengajukan opname");
    } finally { setSubmitting(false); }
  }

  // Detect if session has any variance (to enable AI explainer)
  const hasVariance = useMemo(() => {
    if (!sess) return false;
    return (sess.lines || []).some((ln) => {
      if (ln.counted_qty == null) return false;
      return Number(ln.counted_qty) !== Number(ln.system_qty || 0);
    });
  }, [sess]);

  const backButton = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("/inventory/opname")} data-testid="opn-sess-back">
      <ArrowLeft /> Kembali ke Stock Opname
    </Button>
  );

  if (loading) return <LoadingState rows={8} />;
  if (!sess) {
    return (
      <div className="space-y-3" data-testid="opname-session-page">
        <div>{backButton}</div>
        <div className="glass-card">
          <EmptyState icon={ClipboardCheck} title="Sesi opname tidak ditemukan" description="Sesi mungkin sudah dihapus atau Anda tidak punya akses ke outlet ini." />
        </div>
      </div>
    );
  }

  const outletName = allOutlets.find(o => o.id === sess.outlet_id)?.name || sess.outlet_id;
  const editable = sess.status === "in_progress" && can("outlet.opname.execute");

  return (
    <div data-testid="opname-session-page" className="space-y-3 lg:space-y-4">
      <div>{backButton}</div>
      <div data-testid="opn-sess-header">
        <PageHeader
          icon={ClipboardCheck}
          title={`Opname ${sess.doc_no || sess.id.slice(0, 8)}`}
          subtitle={`${outletName} · periode ${sess.period || "—"}`}
          className="mb-0 md:mb-0"
          actions={<StatusPill status={sess.status} />}
        />
      </div>

      <div data-testid="opn-sess-info" className="glass-card p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Field label="Outlet" value={outletName} />
        <Field label="Tanggal" value={fmtDate(sess.opname_date)} />
        <Field label="Periode" value={sess.period} />
        <Field label="Sudah dihitung" value={`${sess.counted_items || 0}/${sess.total_items || 0}`} />
        <Field label="Nilai variance" value={
          <span className={sess.total_variance_value < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
            {fmtRp(sess.total_variance_value || 0)}
          </span>
        } />
      </div>

      {/* AI Variance Explainer — Phase 9C+ */}
      <AIVariancePanel
        sessionId={sess.id}
        hasVariance={hasVariance}
        disabled={false}
      />

      <div data-testid="opn-sess-search" className="glass-card p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari item…" aria-label="Cari item" className="glass-input pl-9" data-testid="opn-search" />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">Total {filtered.length} item</span>
      </div>

      <div data-testid="opn-sess-table-card" className="glass-card overflow-hidden">
        <div data-testid="opn-sess-table">
          <DataTable
            rows={filtered}
            keyField="item_id"
            rowTestIdPrefix="opn-row"
            empty={<EmptyState title="Tidak ada item" description={q ? "Tidak ada item yang cocok dengan pencarian." : "Sesi ini tidak memiliki item."} />}
            columns={[
              { key: "item", label: "Item", primary: true, render: (ln) => (
                <div>
                  <div className="font-medium">{ln.item_name}</div>
                  <div className="text-xs text-muted-foreground">{ln.unit} · cost {fmtRp(ln.unit_cost || 0)}</div>
                </div>
              ) },
              { key: "system_qty", label: "Sistem", numeric: true,
                render: (ln) => fmtNumber(ln.system_qty || 0, 2) },
              { key: "counted", label: "Fisik", numeric: true, render: (ln) => {
                const cur = counts[ln.item_id]?.counted_qty;
                return (
                  <div className="flex justify-end">
                    <Input
                      type="number" step="0.01"
                      value={cur ?? ""}
                      onChange={(e) => setCount(ln.item_id, e.target.value)}
                      disabled={!editable}
                      placeholder="—"
                      aria-label={`Qty fisik ${ln.item_name || ""}`.trim()}
                      className="glass-input w-28 text-right tabular-nums"
                      data-testid={`opn-count-${ln.item_id}`}
                    />
                  </div>
                );
              } },
              { key: "variance", label: "Variance", numeric: true, render: (ln) => {
                const cur = counts[ln.item_id]?.counted_qty;
                const counted = cur !== "" && cur != null ? Number(cur) : null;
                const variance = counted != null ? counted - Number(ln.system_qty || 0) : null;
                return (
                  <span className={cn("font-semibold",
                    variance == null ? "text-muted-foreground" :
                      variance < 0 ? "text-red-700 dark:text-red-400" :
                      variance > 0 ? "text-emerald-700 dark:text-emerald-400" : "")}>
                    {variance == null ? "—" : `${variance > 0 ? "+" : ""}${fmtNumber(variance, 2)}`}
                  </span>
                );
              } },
              { key: "variance_value", label: "Nilai variance", numeric: true, render: (ln) => {
                const cur = counts[ln.item_id]?.counted_qty;
                const counted = cur !== "" && cur != null ? Number(cur) : null;
                const variance = counted != null ? counted - Number(ln.system_qty || 0) : null;
                const varValue = variance != null ? variance * Number(ln.unit_cost || 0) : 0;
                return (
                  <span className={cn(variance != null && variance < 0 ? "text-red-700 dark:text-red-400" : "")}>
                    {variance != null && variance !== 0 ? fmtRp(varValue) : "—"}
                  </span>
                );
              } },
              { key: "note", label: "Catatan", render: (ln) => {
                const note = counts[ln.item_id]?.notes;
                return (
                  <Input value={note ?? ln.notes ?? ""}
                    onChange={(e) => setNote(ln.item_id, e.target.value)}
                    disabled={!editable}
                    placeholder="—" aria-label={`Catatan ${ln.item_name || ""}`.trim()} className="glass-input" />
                );
              } },
            ]}
          />
        </div>
      </div>

      {/* Simpan/Ajukan selalu terlihat di bawah tabel hitung (DESIGN_SYSTEM §10.4). */}
      {editable && (
        <FormActionBar dirty={dirty} hint={`${sess.counted_items || 0}/${sess.total_items || 0} item sudah dihitung`}>
          <Button onClick={saveProgress} disabled={saving} variant="outline" data-testid="opn-save">
            <Save /> {saving ? "Menyimpan…" : "Simpan progres"}
          </Button>
          <Button onClick={submitOpname} disabled={submitting} data-testid="opn-submit">
            <Send /> {submitting ? "Mengajukan…" : "Ajukan opname"}
          </Button>
        </FormActionBar>
      )}

      {sess.status !== "in_progress" && (
        <div className="glass-card p-4 border-l-4 border-emerald-500 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Sesi opname ini sudah {sess.status}. Tidak bisa diedit lagi.
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
