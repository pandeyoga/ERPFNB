/** AR Ledger — Sprint 2 Complete
 * Tabs: Invoices | Customers | Aging Report | Reconciliation
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Plus, FileText, Send, DollarSign, Loader2,
  Edit2, AlertTriangle, RefreshCw, Download, Bell,
  TrendingDown, BarChart3, Eye, MoreHorizontal, Receipt, Wallet, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, formatDateID } from "@/lib/format";
import { InvoiceCreateDialog, CustomerCreateDialog, ReceiptDialog, InvoiceDetailDialog, CustomerEditDialog, InvoiceEditDialog, ReminderDialog } from "../ARInvoiceDialogs";
import useExcelExport from "@/hooks/useExcelExport";
import { confirmDialog } from "@/components/shared/confirmDialog";

// ── Status helpers ──────────────────────────────

// Status invoice AR — label & warna dari kamus global StatusPill.
const AR_STATUSES = ["draft", "sent", "partial", "paid", "overdue", "cancelled", "written_off"];

// ── Main Component ──────────────────────────────

export default function ARInvoiceList({ embedded = false }) {
  const [activeTab, setActiveTab] = useState("invoices");

  // filters
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [reconPeriod, setReconPeriod] = useState(new Date().toISOString().slice(0, 7));

  // dialogs
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(null); // invoice object
  const [detailDialog, setDetailDialog] = useState(null);   // invoice object
  const [writeOffDialog, setWriteOffDialog] = useState(null); // invoice object
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writeOffLoading, setWriteOffLoading] = useState(false);
  const [customerEdit, setCustomerEdit] = useState(null);   // customer object
  const [invoiceEdit, setInvoiceEdit] = useState(null);     // invoice object (draft)
  const [reminderDialog, setReminderDialog] = useState(null); // invoice object
  const { downloading, exportXlsx } = useExcelExport();

  // ── Invoices (per tab) ──────────────────────────
  const invoicesQuery = useQuery({
    queryKey: ["ar", "invoices", { filterPeriod, filterStatus }],
    queryFn: async () => {
      const params = { per_page: 100 };
      if (filterPeriod) params.period = filterPeriod;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get("/ar/invoices", { params });
      if (!res.data?.success) return [];
      return res.data.data.items || [];
    },
    enabled: activeTab === "invoices",
    staleTime: 30 * 1000,
    onError: () => toast.error("Gagal memuat invoice"),
  });
  const invoices = invoicesQuery.data || [];
  const loadInvoices = () => invoicesQuery.refetch();

  const customersQuery = useQuery({
    queryKey: ["ar", "customers"],
    queryFn: async () => {
      const res = await api.get("/ar/customers");
      if (!res.data?.success) return [];
      return res.data.data.items || [];
    },
    enabled: activeTab === "customers",
    staleTime: 60 * 1000,
    onError: () => toast.error("Gagal memuat customer"),
  });
  const customers = customersQuery.data || [];

  const agingQuery = useQuery({
    queryKey: ["ar", "aging"],
    queryFn: async () => {
      const res = await api.get("/ar/aging");
      if (!res.data?.success) return null;
      return res.data.data;
    },
    enabled: activeTab === "aging",
    staleTime: 60 * 1000,
    onError: () => toast.error("Gagal memuat aging"),
  });
  const aging = agingQuery.data || null;
  const loadAging = () => agingQuery.refetch();

  const reconQuery = useQuery({
    queryKey: ["ar", "reconciliation", { reconPeriod }],
    queryFn: async () => {
      const res = await api.get("/ar/reconciliation", { params: { period: reconPeriod } });
      if (!res.data?.success) return null;
      return res.data.data;
    },
    enabled: activeTab === "recon",
    staleTime: 60 * 1000,
    onError: () => toast.error("Gagal memuat rekonsiliasi"),
  });
  const recon = reconQuery.data || null;

  // Aggregate loading state per active tab
  const loading = (
    (activeTab === "invoices" && invoicesQuery.isLoading) ||
    (activeTab === "customers" && customersQuery.isLoading) ||
    (activeTab === "aging" && agingQuery.isLoading) ||
    (activeTab === "recon" && reconQuery.isLoading)
  );

  // KPI summary derived from invoices
  const summary = useMemo(() => {
    if (!invoices.length) return null;
    const total = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const outstanding = invoices.reduce((s, i) => s + (i.outstanding || 0), 0);
    const overdue = invoices.filter(i => i.status === "overdue").length;
    return { total, outstanding, overdue, count: invoices.length };
  }, [invoices]);

  const handleSendInvoice = async (inv) => {
    if (!(await confirmDialog(`Tandai invoice ${inv.invoice_no} sebagai terkirim?`))) return;
    try {
      await api.post(`/ar/invoices/${inv.id}/send`);
      toast.success("Invoice ditandai terkirim");
      invoicesQuery.refetch();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  };

  const handleDownloadPDF = async (inv) => {
    try {
      const res = await api.post(`/ar/invoices/${inv.id}/pdf`, {}, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `${inv.invoice_no}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal generate PDF"); }
  };

  const handleConfirmWriteOff = async () => {
    if (!writeOffDialog || !writeOffReason.trim()) {
      toast.error("Alasan write-off wajib diisi");
      return;
    }
    setWriteOffLoading(true);
    try {
      await api.post(`/ar/invoices/${writeOffDialog.id}/write-off`, { reason: writeOffReason });
      toast.success(`Invoice ${writeOffDialog.invoice_no} berhasil di-write off`);
      setWriteOffDialog(null);
      setWriteOffReason("");
      invoicesQuery.refetch();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal write-off invoice");
    } finally {
      setWriteOffLoading(false);
    }
  };

  const subtitle = "Kelola invoice piutang, customer, aging, dan rekonsiliasi AR.";
  const headerActions = (
    <>
      <Button variant="outline" onClick={() => setCustomerDialog(true)} data-testid="add-customer-btn">
        <Plus className="h-4 w-4" /> Customer Baru
      </Button>
      <Button variant="outline"
        onClick={() => exportXlsx("/ar/invoices/write-off/export/xlsx", "ar_writeoff.xlsx")}
        disabled={downloading}
        data-testid="ar-writeoff-export-xlsx"
      >
        <Download className="h-4 w-4" />
        {downloading ? "Mengunduh..." : "Ekspor write-off"}
      </Button>
      <Button onClick={() => setInvoiceDialog(true)} data-testid="create-invoice-btn">
        <Plus className="h-4 w-4" /> Invoice Baru
      </Button>
    </>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="ar-invoice-list">
      {/* Header */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        </div>
      ) : (
        <PageHeader icon={Users} title="AR Invoices" subtitle={subtitle} actions={headerActions} />
      )}

      {/* KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ar-kpi-strip">
          <CompactStatCard label="Total invoice" icon={FileText} color="aurora-1" value={summary.count} testId="ar-kpi-count" />
          <CompactStatCard label="Total tagihan" icon={Receipt} color="aurora-2" value={formatCurrency(summary.total)} testId="ar-kpi-total" />
          <CompactStatCard label="Outstanding" icon={Wallet} color="aurora-5" tone="warning" value={formatCurrency(summary.outstanding)} testId="ar-kpi-outstanding" />
          <CompactStatCard label="Jatuh tempo" icon={AlertTriangle} color="aurora-6" tone={summary.overdue > 0 ? "danger" : "default"} value={summary.overdue}
            sub="invoice lewat jatuh tempo" testId="ar-kpi-overdue" />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="ar-tabs">
        <TabsList>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
          <TabsTrigger value="aging" data-testid="tab-aging">Aging report</TabsTrigger>
          <TabsTrigger value="recon" data-testid="tab-recon">Reconciliation</TabsTrigger>
        </TabsList>

        {/* ── INVOICES TAB ──────────────────────────── */}
        <TabsContent value="invoices">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
              className="w-44" placeholder="Periode" aria-label="Filter periode invoice" data-testid="filter-period" />
            <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44" aria-label="Filter status invoice" data-testid="filter-status">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {AR_STATUSES.map((k) => (
                  <SelectItem key={k} value={k}>{statusLabel(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadInvoices} aria-label="Muat ulang invoice" title="Muat ulang" data-testid="invoices-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Card data-testid="invoices-table-card">
            <CardContent className="pt-4">
              <DataTable
                rows={invoices}
                keyField="id"
                loading={loading}
                rowTestIdPrefix="invoice-row"
                empty={(
                  <EmptyState icon={FileText} title="Belum ada invoice"
                    description="Buat invoice AR untuk customer B2B, catering, atau aggregator."
                    action={<Button variant="outline" size="sm" onClick={() => setInvoiceDialog(true)} data-testid="ar-empty-create-invoice">
                      <Plus className="h-4 w-4" /> Buat Invoice Pertama</Button>} />
                )}
                rowClassName={(inv) => (inv.status === "overdue" ? "bg-red-50 dark:bg-red-950/20" : "")}
                columns={[
                  { key: "invoice_no", label: "No Invoice", sortable: true, primary: true,
                    render: (inv) => <span className="font-mono text-xs font-medium whitespace-nowrap">{inv.invoice_no}</span> },
                  { key: "customer_name", label: "Customer", sortable: true,
                    render: (inv) => (
                      <div>
                        <div>{inv.customer_name}</div>
                        {inv.channel && <Badge variant="outline" className="text-xs mt-0.5">{inv.channel}</Badge>}
                      </div>
                    ) },
                  { key: "invoice_date", label: "Tgl Invoice", sortable: true,
                    render: (inv) => <span className="text-sm whitespace-nowrap">{formatDateID(inv.invoice_date)}</span> },
                  { key: "due_date", label: "Jatuh Tempo", sortable: true,
                    render: (inv) => <span className={`text-sm whitespace-nowrap ${inv.status === "overdue" ? "text-red-700 dark:text-red-400 font-medium" : ""}`}>{formatDateID(inv.due_date)}</span> },
                  { key: "total_amount", label: "Total", numeric: true, sortable: true,
                    render: (inv) => <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(inv.total_amount)}</span> },
                  { key: "outstanding", label: "Outstanding", numeric: true, sortable: true,
                    render: (inv) => inv.outstanding > 0
                      ? <span className="text-orange-800 dark:text-orange-400 font-medium whitespace-nowrap">{formatCurrency(inv.outstanding)}</span>
                      : <span className="text-emerald-700 dark:text-emerald-400 text-sm">Lunas</span> },
                  { key: "status", label: "Status",
                    render: (inv) => <StatusPill status={inv.status} /> },
                ]}
                rowAction={(inv) => {
                  const canRemind = inv.outstanding > 0 && inv.status !== "draft";
                  const canWriteOff = inv.status === "overdue" || (inv.outstanding > 0 && inv.status !== "draft");
                  return (
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon-sm" variant="ghost" title="Detail" aria-label="Lihat detail invoice"
                        onClick={() => setDetailDialog(inv)} data-testid={`view-invoice-${inv.invoice_no}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {inv.status === "draft" && (
                        <Button size="icon-sm" variant="ghost" title="Kirim invoice" aria-label="Kirim invoice"
                          onClick={() => handleSendInvoice(inv)} data-testid={`send-invoice-${inv.invoice_no}`}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {inv.outstanding > 0 && (
                        <Button size="icon-sm" variant="ghost" className="text-emerald-700 dark:text-emerald-400" title="Catat pembayaran" aria-label="Catat pembayaran"
                          onClick={() => setReceiptDialog(inv)} data-testid={`record-payment-${inv.invoice_no}`}>
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="Aksi lain" title="Aksi lain" data-testid={`invoice-more-${inv.invoice_no}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === "draft" && (
                            <DropdownMenuItem onSelect={() => setInvoiceEdit(inv)} data-testid={`edit-invoice-${inv.invoice_no}`}>
                              <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit invoice
                            </DropdownMenuItem>
                          )}
                          {canRemind && (
                            <DropdownMenuItem onSelect={() => setReminderDialog(inv)} data-testid={`remind-invoice-${inv.invoice_no}`}>
                              <Bell className="h-3.5 w-3.5 mr-2" /> Kirim pengingat
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => handleDownloadPDF(inv)} data-testid={`pdf-invoice-${inv.invoice_no}`}>
                            <Download className="h-3.5 w-3.5 mr-2" /> Unduh PDF
                          </DropdownMenuItem>
                          {canWriteOff && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-700 dark:text-red-400 focus:text-red-700"
                                onSelect={() => { setWriteOffDialog(inv); setWriteOffReason(""); }}
                                data-testid={`write-off-${inv.invoice_no}`}>
                                <TrendingDown className="h-3.5 w-3.5 mr-2" /> Write-off piutang
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CUSTOMERS TAB ──────────────────────────── */}
        <TabsContent value="customers">
          <Card data-testid="customers-table-card">
            <CardContent className="pt-4">
              <DataTable
                rows={customers}
                keyField="id"
                loading={loading}
                rowTestIdPrefix="customer-row"
                empty={(
                  <EmptyState icon={Users} title="Belum ada customer AR"
                    description="Tambahkan customer untuk mulai menerbitkan invoice."
                    action={<Button variant="outline" size="sm" onClick={() => setCustomerDialog(true)} data-testid="ar-empty-add-customer">
                      <Plus className="h-4 w-4" /> Tambah Customer</Button>} />
                )}
                columns={[
                  { key: "name", label: "Nama Customer", sortable: true, primary: true,
                    render: (c) => <span className="font-medium">{c.name}</span> },
                  { key: "channel", label: "Channel",
                    render: (c) => <Badge variant="outline">{c.channel}</Badge> },
                  { key: "npwp", label: "NPWP",
                    render: (c) => <span className="text-xs tabular-nums whitespace-nowrap">{c.npwp || "-"}</span> },
                  { key: "contact", label: "Kontak",
                    render: (c) => (
                      <div>
                        <div className="text-sm">{c.contact_person || "-"}</div>
                        <div className="text-xs text-muted-foreground">{c.email || c.phone || ""}</div>
                      </div>
                    ) },
                  { key: "credit_terms_days", label: "Terms (Hari)", numeric: true, sortable: true,
                    render: (c) => c.credit_terms_days || 30 },
                  { key: "total_outstanding", label: "Outstanding", numeric: true, sortable: true,
                    render: (c) => (c.total_outstanding > 0
                      ? <span className="text-orange-800 dark:text-orange-400 font-semibold">{formatCurrency(c.total_outstanding)}</span>
                      : <span className="text-muted-foreground">-</span>) },
                ]}
                rowAction={(c) => (
                  <Button size="icon-sm" variant="ghost" title="Edit customer" aria-label="Edit customer"
                    onClick={() => setCustomerEdit(c)} data-testid={`edit-customer-${c.id}`}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AGING REPORT TAB ──────────────────────────── */}
        <TabsContent value="aging" data-testid="aging-tab">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : aging ? (
            <div className="space-y-3 lg:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base md:text-lg font-semibold">AR aging report</h2>
                  <p className="text-xs md:text-sm text-muted-foreground">Per tanggal: {formatDateID(aging.as_of)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadAging} data-testid="aging-refresh">
                  <RefreshCw className="h-4 w-4" /> Muat ulang
                </Button>
              </div>

              {/* Bucket Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="aging-buckets">
                {[
                  { key: "current",  label: "Belum jatuh tempo", tone: "success", color: "aurora-4", icon: CheckCircle2 },
                  { key: "1_30",     label: "1-30 hari",   tone: "warning", color: "aurora-5", icon: Clock },
                  { key: "31_60",    label: "31-60 hari",  tone: "warning", color: "aurora-5", icon: Clock },
                  { key: "61_90",    label: "61-90 hari",  tone: "danger",  color: "aurora-6", icon: AlertCircle },
                  { key: "over_90",  label: ">90 hari",    tone: "danger",  color: "aurora-6", icon: AlertTriangle },
                ].map(({ key, label, tone, color, icon }) => (
                  <CompactStatCard key={key} label={label} icon={icon} color={color}
                    tone={(aging.buckets[key] || 0) > 0 ? tone : "default"}
                    value={formatCurrency(aging.buckets[key] || 0)}
                    sub={`${aging.items[key]?.length || 0} invoice`}
                    testId={`aging-bucket-${key}`} />
                ))}
              </div>

              {/* Total */}
              <Card data-testid="aging-total-card">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Total outstanding</div>
                    <div className="text-xl font-semibold tabular-nums text-orange-800 dark:text-orange-400">
                      {formatCurrency(aging.total_outstanding)}
                    </div>
                  </div>
                  {aging.total_outstanding > 0 && (
                    <Progress
                      value={((aging.buckets.current || 0) / aging.total_outstanding) * 100}
                      className="h-2 mt-2"
                    />
                  )}
                </CardContent>
              </Card>

              {/* By Customer */}
              {aging.by_customer?.length > 0 && (
                <Card data-testid="aging-by-customer">
                  <CardHeader>
                    <CardTitle>Per customer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      rows={aging.by_customer}
                      keyField="customer_name"
                      rowTestIdPrefix="aging-customer"
                      defaultSort={{ key: "total", dir: "desc" }}
                      empty={<div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data</div>}
                      columns={[
                        { key: "customer_name", label: "Customer", sortable: true, primary: true,
                          render: (c) => <span className="font-medium">{c.customer_name || "—"}</span> },
                        { key: "current", label: "Belum JT", numeric: true, sortable: true,
                          sortAccessor: (c) => c.buckets.current || 0,
                          render: (c) => <span className="text-sm text-green-700">{formatCurrency(c.buckets.current || 0)}</span> },
                        { key: "1_30", label: "1-30 Hari", numeric: true, sortable: true,
                          sortAccessor: (c) => c.buckets["1_30"] || 0,
                          render: (c) => <span className="text-sm text-amber-800 dark:text-amber-400">{formatCurrency(c.buckets["1_30"] || 0)}</span> },
                        { key: "31_60", label: "31-60 Hari", numeric: true, sortable: true,
                          sortAccessor: (c) => c.buckets["31_60"] || 0,
                          render: (c) => <span className="text-sm text-orange-800 dark:text-orange-400">{formatCurrency(c.buckets["31_60"] || 0)}</span> },
                        { key: "over_60", label: ">60 Hari", numeric: true, sortable: true,
                          sortAccessor: (c) => (c.buckets["61_90"] || 0) + (c.buckets["over_90"] || 0),
                          render: (c) => <span className="text-sm text-red-700 dark:text-red-400">{formatCurrency((c.buckets["61_90"] || 0) + (c.buckets["over_90"] || 0))}</span> },
                        { key: "total", label: "Total", numeric: true, sortable: true,
                          sortAccessor: (c) => c.total_outstanding || 0,
                          render: (c) => <span className="font-semibold">{formatCurrency(c.total_outstanding)}</span> },
                      ]}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <EmptyState icon={TrendingDown} title="Aging report belum dimuat"
              description="Klik muat ulang untuk mengambil aging report terbaru."
              action={<Button variant="outline" size="sm" onClick={loadAging} data-testid="aging-load">
                <RefreshCw className="h-4 w-4" /> Muat aging</Button>} />
          )}
        </TabsContent>

        {/* ── RECONCILIATION TAB ──────────────────────────── */}
        <TabsContent value="recon" data-testid="recon-tab">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="space-y-1">
              <Label htmlFor="recon-period-input">Periode</Label>
              <Input id="recon-period-input" type="month" value={reconPeriod} onChange={e => setReconPeriod(e.target.value)}
                className="w-44" data-testid="recon-period-input" />
            </div>
            <Button variant="outline" onClick={() => reconQuery.refetch()} data-testid="load-recon-btn">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : recon ? (
            <Card data-testid="recon-card">
              <CardHeader>
                <CardTitle>Rekonsiliasi AR — {recon.period}</CardTitle>
                <CardDescription>Saldo pembuka + invoice diterbitkan - pembayaran diterima = saldo penutup</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  rows={[
                    { id: "opening", label: "Saldo Awal", amount: recon.opening_balance, cls: "font-medium", amtCls: "font-semibold", paren: false },
                    { id: "issued", label: "+ Invoice Diterbitkan", amount: recon.invoices_issued, cls: "text-green-700 font-medium", amtCls: "text-green-700 font-semibold", paren: false },
                    { id: "received", label: "- Pembayaran Diterima", amount: recon.receipts_received, cls: "text-red-700 dark:text-red-400 font-medium", amtCls: "text-red-700 dark:text-red-400 font-semibold", paren: true },
                    { id: "closing", label: "Saldo Akhir", amount: recon.closing_balance, cls: "font-bold text-base", amtCls: "font-bold text-base text-orange-800 dark:text-orange-400", paren: false, isTotal: true },
                  ]}
                  keyField="id"
                  rowTestIdPrefix="recon-row"
                  rowClassName={(r) => (r.isTotal ? "border-t-2 border-border bg-muted/30" : "")}
                  columns={[
                    { key: "label", label: "Keterangan", primary: true,
                      render: (r) => <span className={r.cls}>{r.label}</span> },
                    { key: "amount", label: "Jumlah", numeric: true,
                      render: (r) => <span className={r.amtCls}>{r.paren ? `(${formatCurrency(r.amount)})` : formatCurrency(r.amount)}</span> },
                  ]}
                />
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={BarChart3} title="Belum ada data rekonsiliasi"
              description="Pilih periode lalu klik muat ulang." />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ──────────────────────────────────── */}
      <InvoiceCreateDialog
        open={invoiceDialog}
        onOpenChange={setInvoiceDialog}
        onCreated={() => { setInvoiceDialog(false); invoicesQuery.refetch(); setActiveTab("invoices"); }}
      />

      <CustomerCreateDialog
        open={customerDialog}
        onOpenChange={setCustomerDialog}
        onCreated={() => { setCustomerDialog(false); customersQuery.refetch(); }}
      />

      {receiptDialog && (
        <ReceiptDialog
          invoice={receiptDialog}
          onClose={() => setReceiptDialog(null)}
          onRecorded={() => { setReceiptDialog(null); invoicesQuery.refetch(); }}
        />
      )}

      {detailDialog && (
        <InvoiceDetailDialog
          invoice={detailDialog}
          onClose={() => setDetailDialog(null)}
          onSend={() => { handleSendInvoice(detailDialog); setDetailDialog(null); }}
          onPayment={() => { setReceiptDialog(detailDialog); setDetailDialog(null); }}
        />
      )}

      {/* Write-off Dialog */}
      <Dialog open={!!writeOffDialog} onOpenChange={open => { if (!open) { setWriteOffDialog(null); setWriteOffReason(""); } }}>
        <DialogContent className="max-w-md" data-testid="write-off-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <TrendingDown className="h-5 w-5" /> Write Off Piutang
            </DialogTitle>
            <DialogDescription>
              Invoice <strong>{writeOffDialog?.invoice_no}</strong> — Outstanding:{" "}
              <strong>{writeOffDialog ? formatCurrency(writeOffDialog.outstanding) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-800 dark:text-red-400">
              Tindakan ini akan membuat jurnal: <strong>Dr Beban Piutang Tak Tertagih / Cr Piutang Usaha</strong>.
              Status invoice akan berubah menjadi <strong>Write-off</strong> dan tidak bisa dikembalikan.
            </div>
            <div>
              <Label htmlFor="write-off-reason" className="text-sm font-medium">
                Alasan Write-off <span className="text-red-700 dark:text-red-400">*</span>
              </Label>
              <Textarea
                id="write-off-reason"
                value={writeOffReason}
                onChange={e => setWriteOffReason(e.target.value)}
                placeholder="Contoh: Pelanggan pailit, piutang tidak dapat ditagih setelah 180 hari..."
                className="mt-1.5 resize-none"
                rows={3}
                data-testid="write-off-reason-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setWriteOffDialog(null); setWriteOffReason(""); }}
              disabled={writeOffLoading} data-testid="write-off-cancel">
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirmWriteOff}
              disabled={writeOffLoading || !writeOffReason.trim()}
              data-testid="write-off-confirm">
              {writeOffLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : "Konfirmasi Write-off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Edit Dialog */}
      {customerEdit && (
        <CustomerEditDialog
          customer={customerEdit}
          onClose={() => setCustomerEdit(null)}
          onSaved={() => { setCustomerEdit(null); customersQuery.refetch(); }}
        />
      )}

      {/* Invoice Edit Dialog (draft) */}
      {invoiceEdit && (
        <InvoiceEditDialog
          invoice={invoiceEdit}
          onClose={() => setInvoiceEdit(null)}
          onSaved={() => { setInvoiceEdit(null); invoicesQuery.refetch(); }}
        />
      )}

      {/* Reminder Dialog */}
      {reminderDialog && (
        <ReminderDialog
          invoice={reminderDialog}
          onClose={() => setReminderDialog(null)}
          onSent={() => { setReminderDialog(null); invoicesQuery.refetch(); }}
        />
      )}
    </div>
  );
}


// ── Invoice Create Dialog ────────────────────────────────────

