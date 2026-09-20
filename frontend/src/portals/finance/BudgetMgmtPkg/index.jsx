/** BudgetManagement/index.jsx — budget management orchestrator. */
/** Budget Management — Sprint B + Sprint G (Excel import) */
import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import {
  Target, Plus, Edit2, Trash2, Loader2, X, Search, ChevronRight,
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw,
  Send, Check, Lock, XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { EMPTY_FORM, CATEGORIES, APPROVAL_STATUS_LABELS } from "./constants";
import BudgetImportDialog from "./BudgetImportDialog";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function BudgetManagement() {
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
          api.get("/admin/brands").catch(() => ({ data: { data: [] } }))
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
    } catch { toast.error("Gagal memuat budgets"); }
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
    if (!(await confirmDialog("Submit budget ini untuk approval?"))) return;
    try {
      await api.post(`/budget/budgets/${id}/submit`);
      toast.success("Budget berhasil disubmit untuk approval");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit budget");
    }
  }

  const totalBudgeted = (b) => (b.lines || []).reduce((s, l) => s + parseFloat(l.amount || 0), 0);

  return (
    <div className="space-y-6" data-testid="budget-management">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="h-6 w-6" /> Manajemen Budget
          </h2>
          <p className="text-muted-foreground text-sm">Kelola budget per COA dan periode</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="import-budget-btn">
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={openCreate} data-testid="create-budget-btn">
            <Plus className="h-4 w-4 mr-2" /> Buat Budget
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Filter Periode</Label>
              <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                data-testid="filter-period" />
            </div>
            <div className="space-y-2">
              <Label>Filter Year</Label>
              <Input type="text" placeholder="YYYY" value={filterYear} onChange={e => setFilterYear(e.target.value)}
                data-testid="filter-year" />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={filterScope} onValueChange={setFilterScope}>
                <SelectTrigger data-testid="filter-scope">
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
            <div className="space-y-2">
              <Label>Approval Status</Label>
              <Select value={filterApprovalStatus} onValueChange={setFilterApprovalStatus}>
                <SelectTrigger data-testid="filter-approval-status">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Menunggu Approval</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="locked">Terkunci</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filterPeriod || (filterScope && filterScope !== "all") || (filterApprovalStatus && filterApprovalStatus !== "all") || filterYear) && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => { 
                setFilterPeriod(""); 
                setFilterScope("all"); 
                setFilterApprovalStatus("all"); 
                setFilterYear(""); 
              }}>
                <X className="h-4 w-4 mr-1" /> Reset Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget List */}
      <Card data-testid="budget-list-card">
        <CardContent className="pt-4">
          <DataTable
            rows={budgets}
            keyField="id"
            loading={loading}
            rowTestIdPrefix="budget-row"
            empty={(
              <div className="text-center py-12 text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2" />
                <p>Belum ada budget.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  Buat Budget Pertama
                </Button>
              </div>
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
                render: (b) => {
                  const statusInfo = APPROVAL_STATUS_LABELS[b.approval_status] || APPROVAL_STATUS_LABELS.draft;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                      {StatusIcon && <StatusIcon className="h-3 w-3" />}
                      {statusInfo.label}
                    </Badge>
                  );
                } },
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
                      data-testid="submit-budget-btn" title="Submit untuk approval">
                      <Send className="h-4 w-4 mr-1" /> Submit
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Edit budget" onClick={() => openEdit(b)} data-testid="edit-budget-btn">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Hapus budget" className="text-red-500" onClick={() => handleDelete(b.id)}
                      data-testid="delete-budget-btn">
                      <Trash2 className="h-4 w-4" />
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="budget-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Budget" : "Buat Budget Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label>Nama Budget</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`Budget ${form.period}`} data-testid="budget-name-input" />
              </div>
              <div className="space-y-2">
                <Label>Periode *</Label>
                <Input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  data-testid="budget-period-input" />
              </div>
            </div>

            {/* Scope Selection */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Scope *</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v, outlet_id: "", brand_id: "" }))}>
                  <SelectTrigger data-testid="budget-scope-select">
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
                <div className="space-y-2">
                  <Label>Outlet *</Label>
                  <Select value={form.outlet_id} onValueChange={v => setForm(f => ({ ...f, outlet_id: v }))}>
                    <SelectTrigger data-testid="budget-outlet-select">
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
                <div className="space-y-2">
                  <Label>Brand *</Label>
                  <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}>
                    <SelectTrigger data-testid="budget-brand-select">
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

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan..." rows={2} />
            </div>

            {/* COA Search & Lines */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Baris Budget (COA)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari COA (kode atau nama)..."
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
                    <button key={c.id} onClick={() => addLine(c)}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
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
                          <div className="font-mono text-xs text-muted-foreground">{line.coa_code}</div>
                          <div className="text-sm">{line.coa_name}</div>
                        </div>
                      ) },
                    { key: "category", label: "Kategori",
                      render: (line) => (
                        <Select value={line.category} onValueChange={v => updateLine(line._idx, "category", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) },
                    { key: "amount", label: "Amount (Rp)", numeric: true,
                      render: (line) => (
                        <Input type="number" className="text-right tabular-nums h-8 w-32" value={line.amount}
                          onChange={e => updateLine(line._idx, "amount", parseFloat(e.target.value) || 0)}
                          data-testid={`line-amount-${line._idx}`} />
                      ) },
                  ]}
                  rowAction={(line) => (
                    <Button variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => removeLine(line._idx)}>
                      <X className="h-4 w-4" />
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
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Perbarui" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ── Budget Excel Import Dialog ──────────────────────────────────────────────
