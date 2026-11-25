/** BudgetManagement/index.jsx — budget management orchestrator. */
/** Budget Management — Sprint B + Sprint G (Excel import) */
import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import {
  Target, Plus, Edit2, Trash2, Loader2, X, Search, ChevronRight, Upload, Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { EMPTY_FORM, CATEGORIES, APPROVAL_STATUSES } from "./constants";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import BudgetImportDialog from "./BudgetImportDialog";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function BudgetManagement({ embedded = false }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterScope, setFilterScope] = useState("all");
  const [filterApprovalStatus, setFilterApprovalStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("");

  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // budget id or null
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // COA search for line items
  const [coaSearch, setCoaSearch] = useState("");
  const [coaResults, setCoaResults] = useState([]);
  const [coaSearching, setCoaSearching] = useState(false);

  // Load outlets and brands
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [outletRes, brandRes] = await Promise.all([
          api.get("/public/outlets"),
          api.get("/master/brands").catch(() => ({ data: { data: [] } }))
        ]);
        if (outletRes.data) setOutlets(outletRes.data.data || []);
        if (brandRes.data) setBrands(brandRes.data.data || []);
      } catch (err) {
        logger.error("Failed to load budget master data", { error: err.message });
      }
    }
    loadMasterData();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPeriod) params.period = filterPeriod;
      if (filterScope && filterScope !== "all") params.scope = filterScope;
      if (filterApprovalStatus && filterApprovalStatus !== "all") params.approval_status = filterApprovalStatus;
      if (filterYear) params.year = filterYear;
      const res = await api.get("/budget/budgets", { params });
      if (res.data.success) setBudgets(res.data.data?.items || []);
    } catch { toast.error("Gagal memuat daftar budget"); }
    finally { setLoading(false); }
  }, [filterPeriod, filterScope, filterApprovalStatus, filterYear]);

  useEffect(() => { load(); }, [load]);

  async function searchCOA(q) {
    if (!q || q.length < 2) { setCoaResults([]); return; }
    setCoaSearching(true);
    try {
      const res = await api.get("/master/chart-of-accounts", { params: { q, limit: 10 } });
      setCoaResults(res.data?.data?.items || []);
    } catch {} finally { setCoaSearching(false); }
  }

  function addLine(coa) {
    if (form.lines.some(l => l.coa_id === coa.id)) {
      toast.warning("COA sudah ada di daftar");
      return;
    }
    setForm(f => ({
      ...f,
      lines: [...f.lines, {
        coa_id: coa.id,
        coa_code: coa.code,
        coa_name: coa.name,
        category: "OPEX",
        amount: 0,
      }],
    }));
    setCoaSearch("");
    setCoaResults([]);
  }

  function removeLine(idx) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  }

  function updateLine(idx, key, value) {
    setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, [key]: value } : l) }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(budget) {
    setEditing(budget.id);
    setForm({
      name: budget.name,
      period: budget.period,
      notes: budget.notes || "",
      // Bug fix: scope/outlet/brand ikut dimuat agar dialog Edit tidak menampilkan Scope kosong.
      scope: budget.scope || "outlet",
      outlet_id: budget.outlet_id || "",
      brand_id: budget.brand_id || "",
      lines: (budget.lines || []).map(l => ({ ...l })),
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.period) { toast.error("Periode wajib diisi"); return; }
    if (form.lines.length === 0) { toast.error("Minimal 1 baris budget"); return; }
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/budget/budgets/${editing}`, form);
        toast.success("Budget diperbarui");
      } else {
        await api.post("/budget/budgets", form);
        toast.success("Budget dibuat");
      }
      setFormOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan budget");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!(await confirmDialog("Hapus budget ini?"))) return;
    try {
      await api.delete(`/budget/budgets/${id}`);
      toast.success("Budget dihapus");
      load();
    } catch { toast.error("Gagal menghapus"); }
  }

  async function handleSubmitForApproval(id) {
    if (!(await confirmDialog("Ajukan budget ini untuk approval?"))) return;
    try {
      await api.post(`/budget/budgets/${id}/submit`);
      toast.success("Budget berhasil diajukan untuk approval");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengajukan budget");
    }
  }

  const totalBudgeted = (b) => (b.lines || []).reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  const pageActions = (
    <>
      <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="import-budget-btn">
        <Upload /> Impor Excel
      </Button>
      <Button onClick={openCreate} data-testid="create-budget-btn">
        <Plus /> Buat Budget
      </Button>
    </>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="budget-management">
      <PageHeader
          icon={Target}
          title="Budget Management"
          subtitle="Kelola budget per COA dan periode, lalu ajukan untuk approval."
          className="mb-0 md:mb-0"
          actions={pageActions}
        />

      {/* Filter */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bm-filter-period">Periode</Label>
              <Input id="bm-filter-period" type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                data-testid="filter-period" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bm-filter-year">Tahun</Label>
              <Input id="bm-filter-year" type="text" inputMode="numeric" placeholder="YYYY" value={filterYear} onChange={e => setFilterYear(e.target.value)}
                data-testid="filter-year" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bm-filter-scope">Scope</Label>
              <Select value={filterScope} onValueChange={setFilterScope}>
                <SelectTrigger id="bm-filter-scope" data-testid="filter-scope">
                  <SelectValue placeholder="Semua Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Scope</SelectItem>
                  <SelectItem value="outlet">Outlet</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bm-filter-status">Status approval</Label>
              <Select value={filterApprovalStatus} onValueChange={setFilterApprovalStatus}>
                <SelectTrigger id="bm-filter-status" data-testid="filter-approval-status">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {APPROVAL_STATUSES.map(st => (
                    <SelectItem key={st} value={st}>{statusLabel(st)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filterPeriod || (filterScope && filterScope !== "all") || (filterApprovalStatus && filterApprovalStatus !== "all") || filterYear) && (
            <div className="mt-2">
              <Button variant="ghost" size="sm" onClick={() => {
                setFilterPeriod("");
                setFilterScope("all");
                setFilterApprovalStatus("all");
                setFilterYear("");
              }} data-testid="budget-filter-reset">
                <X /> Reset filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget List */}
      <Card data-testid="budget-list-card" className="overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            rows={budgets}
            keyField="id"
            loading={loading}
            rowTestIdPrefix="budget-row"
            empty={(
              <EmptyState
                icon={Target}
                title="Belum ada budget"
                description="Buat budget per COA atau impor dari Excel untuk mulai membandingkan realisasi."
                action={(
                  <Button variant="outline" size="sm" onClick={openCreate} data-testid="create-first-budget-btn">
                    Buat Budget Pertama
                  </Button>
                )}
              />
            )}
            columns={[
              { key: "name", label: "Nama", primary: true, sortable: true,
                render: (b) => (
                  <div className="font-medium">
                    {b.name}
                    {b.outlet_name && <div className="text-xs text-muted-foreground">{b.outlet_name}</div>}
                    {b.brand_name && <div className="text-xs text-muted-foreground">{b.brand_name}</div>}
                  </div>
                ) },
              { key: "period", label: "Periode", sortable: true,
                render: (b) => <Badge variant="outline">{b.period}</Badge> },
              { key: "scope", label: "Scope",
                render: (b) => <Badge variant="secondary">{b.scope}</Badge> },
              { key: "approval_status", label: "Status",
                render: (b) => <StatusPill status={b.approval_status || "draft"} /> },
              { key: "line_count", label: "Jumlah Baris",
                sortAccessor: (b) => (b.lines || []).length,
                render: (b) => `${(b.lines || []).length} baris` },
              { key: "total", label: "Total Budget", numeric: true, sortable: true,
                sortAccessor: (b) => totalBudgeted(b),
                render: (b) => formatCurrency(totalBudgeted(b)) },
            ]}
            rowAction={(b) => {
              const canEdit = b.approval_status === "draft" || b.approval_status === "rejected";
              const canSubmit = b.approval_status === "draft";
              return (
                <div className="flex items-center justify-end gap-1">
                  {canSubmit && (
                    <Button variant="ghost" size="sm" onClick={() => handleSubmitForApproval(b.id)}
                      data-testid="submit-budget-btn" title="Ajukan untuk approval">
                      <Send /> Ajukan
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon-sm" aria-label="Edit budget" onClick={() => openEdit(b)} data-testid="edit-budget-btn">
                      <Edit2 />
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon-sm" aria-label="Hapus budget" className="text-red-700 dark:text-red-400" onClick={() => handleDelete(b.id)}
                      data-testid="delete-budget-btn">
                      <Trash2 />
                    </Button>
                  )}
                </div>
              );
            }}
          />
        </CardContent>
      </Card>

      <BudgetImportDialog open={importOpen} onOpenChange={setImportOpen}
        onImported={() => { setImportOpen(false); load(); }} />

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl" data-testid="budget-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Budget" : "Buat Budget Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget-name-input">Nama Budget</Label>
                <Input id="budget-name-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`Budget ${form.period}`} data-testid="budget-name-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-period-input">Periode <span className="text-destructive">*</span></Label>
                <Input id="budget-period-input" type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  data-testid="budget-period-input" />
              </div>
            </div>

            {/* Scope Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget-scope-select">Scope <span className="text-destructive">*</span></Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v, outlet_id: "", brand_id: "" }))}>
                  <SelectTrigger id="budget-scope-select" data-testid="budget-scope-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outlet">Outlet</SelectItem>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {form.scope === "outlet" && (
                <div className="space-y-1.5">
                  <Label htmlFor="budget-outlet-select">Outlet <span className="text-destructive">*</span></Label>
                  <Select value={form.outlet_id} onValueChange={v => setForm(f => ({ ...f, outlet_id: v }))}>
                    <SelectTrigger id="budget-outlet-select" data-testid="budget-outlet-select">
                      <SelectValue placeholder="Pilih Outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {form.scope === "brand" && (
                <div className="space-y-1.5">
                  <Label htmlFor="budget-brand-select">Brand <span className="text-destructive">*</span></Label>
                  <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}>
                    <SelectTrigger id="budget-brand-select" data-testid="budget-brand-select">
                      <SelectValue placeholder="Pilih Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget-notes-input">Catatan</Label>
              <Textarea id="budget-notes-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan…" rows={2} data-testid="budget-notes-input" />
            </div>

            {/* COA Search & Lines */}
            <div className="space-y-2">
              <Label htmlFor="coa-search-input">Baris Budget (COA) <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="coa-search-input"
                    placeholder="Cari COA (kode atau nama, min. 2 huruf)…"
                    value={coaSearch}
                    onChange={e => { setCoaSearch(e.target.value); searchCOA(e.target.value); }}
                    className="pl-9"
                    data-testid="coa-search-input"
                  />
                </div>
              </div>
              {coaResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto shadow-sm">
                  {coaResults.map(c => (
                    <button key={c.id} type="button" onClick={() => addLine(c)}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                      data-testid={`coa-result-${c.code}`}>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">{c.code}</span>
                      <span>{c.name}</span>
                      <ChevronRight className="ml-auto h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {form.lines.length > 0 && (
                <DataTable
                  rows={form.lines.map((line, idx) => ({ ...line, _idx: idx }))}
                  keyField="_idx"
                  stickyHeader={false}
                  rowTestIdPrefix="budget-line"
                  empty={<EmptyState title="Belum ada baris" description="Cari & tambahkan COA di atas." />}
                  columns={[
                    { key: "coa", label: "COA", primary: true,
                      render: (line) => (
                        <div>
                          <div className="text-xs font-medium tabular-nums text-muted-foreground">{line.coa_code}</div>
                          <div className="text-sm">{line.coa_name}</div>
                        </div>
                      ) },
                    { key: "category", label: "Kategori",
                      render: (line) => (
                        <Select value={line.category} onValueChange={v => updateLine(line._idx, "category", v)}>
                          <SelectTrigger className="h-8 text-xs" aria-label={`Kategori ${line.coa_code}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) },
                    { key: "amount", label: "Jumlah (Rp)", numeric: true,
                      render: (line) => (
                        <Input type="number" aria-label={`Jumlah ${line.coa_code}`} className="text-right tabular-nums h-8 w-32" value={line.amount}
                          onChange={e => updateLine(line._idx, "amount", parseFloat(e.target.value) || 0)}
                          data-testid={`line-amount-${line._idx}`} />
                      ) },
                  ]}
                  rowAction={(line) => (
                    <Button variant="ghost" size="icon-sm" aria-label="Hapus baris" onClick={() => removeLine(line._idx)}>
                      <X />
                    </Button>
                  )}
                  footer={
                    <tr className="font-semibold">
                      <td colSpan={2} className="px-4 py-2.5">TOTAL</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(form.lines.reduce((s, l) => s + parseFloat(l.amount || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  }
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-save-budget">
              {submitting && <Loader2 className="animate-spin" />}
              {editing ? "Perbarui" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ── Budget Excel Import Dialog ──────────────────────────────────────────────
