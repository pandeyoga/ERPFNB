/** PaymentRunTemplateList.jsx — Daftar template + Create + Apply dialog */
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Plus, Play, Pencil, Trash2, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";

import api, { unwrap, unwrapWithMeta } from "@/lib/api";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";

export default function PaymentRunTemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null); // template to apply
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/payment-run-templates");
      const { data, meta: m } = unwrapWithMeta(res);
      setTemplates(data || []);
      setMeta(m || {});
    } catch { toast.error("Gagal memuat template"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/finance/payment-run-templates/${deleteTarget.id}`);
      toast.success("Template dihapus");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-4" data-testid="prn-template-list-page">
      {/* Toolbar */}
      <div className="glass-card p-4 flex items-center gap-3 flex-wrap" data-testid="prn-template-toolbar">
        <div>
          <h2 className="font-semibold text-sm">Payment Run Templates</h2>
          <p className="text-xs text-muted-foreground">
            Simpan konfigurasi vendor + jumlah untuk pembayaran tetap bulanan. Apply template → langsung ke Payment Run.
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full gap-2 h-9 bg-foreground text-background hover:bg-foreground/90 text-sm"
            data-testid="prn-tmpl-create-btn">
            <Plus className="h-4 w-4" />Buat Template
          </Button>
        </div>
      </div>

      {loading && <LoadingState rows={4} />}
      {!loading && templates.length === 0 && (
        <EmptyState icon={Layout} title="Belum ada template"
          description="Buat template sekali, apply tiap bulan untuk menghemat waktu pembayaran vendor tetap."
          actionLabel="Buat Template Pertama" onAction={() => setShowCreate(true)}
          data-testid="prn-tmpl-empty" />
      )}

      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="prn-tmpl-grid">
          {templates.map(t => (
            <TemplateCard key={t.id} template={t}
              onApply={() => setApplyTarget(t)}
              onEdit={() => navigate(`/finance/payment-run-templates/${t.id}`)}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTemplateDialog onClose={() => setShowCreate(false)} onCreated={(id) => {
          setShowCreate(false);
          navigate(`/finance/payment-run-templates/${id}`);
        }} />
      )}

      {applyTarget && (
        <ApplyDialog template={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={(result) => {
            setApplyTarget(null);
            if (result.run_id) navigate(`/finance/payment-runs/${result.run_id}`);
            else navigate("/finance/payment-requests");
          }} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent data-testid="prn-tmpl-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Template "<strong>{deleteTarget?.name}</strong>" akan dihapus permanen. Data pembayaran yang sudah dibuat tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="prn-tmpl-delete-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90"
              data-testid="prn-tmpl-delete-confirm">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({ template: t, onApply, onEdit, onDelete }) {
  return (
    <div className="glass-card p-5 space-y-4 hover:shadow-lg transition-shadow" data-testid={`prn-tmpl-card-${t.id}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
          <Layout className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate" data-testid={`prn-tmpl-name-${t.id}`}>{t.name}</div>
          {t.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoRow icon={<CalendarDays className="h-3 w-3" />} label="Jadwal" value={`Setiap tgl ${t.schedule_day}`} />
        <InfoRow icon={<CheckCircle2 className="h-3 w-3" />} label="Items" value={`${t.item_count} payee`} />
        <InfoRow icon={null} label="Total" value={fmtRp(t.total_amount)} bold />
        <InfoRow icon={<Clock className="h-3 w-3" />}
          label="Terakhir applied"
          value={t.last_applied_at ? fmtRelative(t.last_applied_at) : "Belum pernah"} />
      </div>

      <div className="text-[10px] text-muted-foreground truncate">
        Bank: {t.bank_account_name || t.bank_account_id}
      </div>

      {t.auto_approve && (
        <div className="inline-flex px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          Auto-Approve: On
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/40">
        <Button onClick={onApply} className="flex-1 h-8 gap-1.5 text-xs" data-testid={`prn-tmpl-apply-${t.id}`}>
          <Play className="h-3 w-3" />Apply
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onEdit} data-testid={`prn-tmpl-edit-${t.id}`}
          title="Edit template">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:border-red-300"
          onClick={onDelete} data-testid={`prn-tmpl-delete-${t.id}`} title="Hapus template">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, bold = false }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span>{label}:</span>
      <span className={`text-foreground ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

// ── Apply Dialog ──────────────────────────────────────────────────────────────
function ApplyDialog({ template, onClose, onApplied }) {
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    if (!paymentDate) { toast.error("Payment date wajib"); return; }
    setApplying(true);
    try {
      const res = await api.post(`/finance/payment-run-templates/${template.id}/apply`, {
        payment_date: paymentDate,
        notes,
      });
      const result = unwrap(res);
      if (result.run_doc_no) {
        toast.success(`Template applied — Payment Run ${result.run_doc_no} siap`);
      } else {
        toast.success(`${result.pr_doc_nos?.length || 0} Payment Request dibuat, menunggu approval`);
      }
      onApplied(result);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal apply template");
    } finally { setApplying(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="prn-tmpl-apply-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />Apply Template: {template.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Template summary */}
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items:</span>
              <strong>{template.item_count} payment</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total gross:</span>
              <strong data-testid="apply-dialog-total">{fmtRp(template.total_amount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank:</span>
              <span className="text-right text-xs">{template.bank_account_name || template.bank_account_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-approve & create run:</span>
              <span className={template.auto_approve ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                {template.auto_approve ? "Ya — langsung ke Payment Run" : "Tidak — PRs perlu approval"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="glass-input" data-testid="apply-dialog-date" />
          </div>
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Mis: Pembayaran vendor Juni 2026"
              className="glass-input" data-testid="apply-dialog-notes" />
          </div>

          {template.auto_approve && (
            <div className="text-xs text-muted-foreground bg-sky-500/10 rounded-lg px-3 py-2">
              Akan membuat {template.item_count} Payment Request (approved) + 1 draft Payment Run siap dikonfirmasi.
            </div>
          )}
          {!template.auto_approve && (
            <div className="text-xs text-muted-foreground bg-amber-500/10 rounded-lg px-3 py-2">
              Akan membuat {template.item_count} Payment Request (submitted). Perlu approval sebelum bisa di-run.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="apply-dialog-cancel">Batal</Button>
          <Button onClick={handleApply} disabled={applying} data-testid="apply-dialog-submit">
            <Play className="h-4 w-4 mr-1.5" />
            {applying ? "Memproses..." : "Apply Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Template Dialog (simple — items added in detail page) ──────────────
function CreateTemplateDialog({ onClose, onCreated }) {
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({
    name: "", description: "", bank_account_id: "",
    schedule_day: 15, auto_approve: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/master/bank-accounts?page=1&per_page=50").then(r => setBanks(unwrap(r) || [])).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Nama template wajib"); return; }
    if (!form.bank_account_id) { toast.error("Bank account wajib"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/finance/payment-run-templates", {
        ...form,
        items: [],  // items added in detail page
      });
      const tmpl = unwrap(res);
      toast.success(`Template "${tmpl.name}" dibuat. Tambahkan items di halaman detail.`);
      onCreated(tmpl.id);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal membuat template");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="create-template-dialog">
        <DialogHeader>
          <DialogTitle>Buat Template Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nama Template <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Mis: Vendor Tetap Bulanan" className="glass-input"
              data-testid="tmpl-form-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Input value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Sewa kantor, retainer konsultan..." className="glass-input"
              data-testid="tmpl-form-desc" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bank Account <span className="text-red-500">*</span></Label>
              <SimpleSelect
                value={form.bank_account_id}
                onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}
                options={[{ value: "", label: "— Pilih bank —" }, ...banks.map(b => ({ value: b.id, label: `${b.bank} ${b.account_number} — ${b.name}` }))]}
                placeholder="— Pilih bank —"
                className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                testId="tmpl-form-bank"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Bayar Bulanan</Label>
              <Input type="number" min={1} max={28} value={form.schedule_day}
                onChange={e => setForm(f => ({ ...f, schedule_day: parseInt(e.target.value) }))}
                className="glass-input" data-testid="tmpl-form-day" />
              <p className="text-[10px] text-muted-foreground">Hari ke-1 s/d 28 tiap bulan</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="auto-approve" checked={form.auto_approve}
              onChange={e => setForm(f => ({ ...f, auto_approve: e.target.checked }))}
              className="h-4 w-4 accent-primary" data-testid="tmpl-form-auto-approve" />
            <Label htmlFor="auto-approve" className="cursor-pointer">
              Auto-approve — Payment Run langsung siap tanpa approval manual
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="tmpl-create-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="tmpl-create-submit">
            {submitting ? "Menyimpan..." : "Buat & Tambah Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
