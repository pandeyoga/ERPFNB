/** AR Ledger — Sprint 2 Complete
 * Tabs: Invoices | Customers | Aging Report | Reconciliation
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Plus, FileText, Send, DollarSign, X, Loader2,
  Edit2, AlertTriangle, RefreshCw, Download, Bell,
  TrendingDown, BarChart3, Eye,
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
import DataTable from "@/components/shared/DataTable";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, formatDateID } from "@/lib/format";
import { InvoiceCreateDialog, CustomerCreateDialog, ReceiptDialog, InvoiceDetailDialog, CustomerEditDialog, InvoiceEditDialog, ReminderDialog } from "../ARInvoiceDialogs";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useExcelExport from "@/hooks/useExcelExport";
import { confirmDialog } from "@/components/shared/confirmDialog";

// ── Status helpers ──────────────────────────────

const STATUS_MAP = {
  draft:       { label: "Draft",         variant: "secondary",    color: "" },
  sent:        { label: "Terkirim",      variant: "default",      color: "" },
  partial:     { label: "Sebagian",      variant: "outline",      color: "border-amber-500 text-amber-700" },
  paid:        { label: "Lunas",         variant: "default",      color: "bg-green-600" },
  overdue:     { label: "Jatuh Tempo",   variant: "destructive",  color: "" },
  cancelled:   { label: "Dibatalkan",    variant: "secondary",    color: "" },
  written_off: { label: "Write-off",     variant: "secondary",    color: "bg-zinc-300 text-zinc-700" },
};

function StatusBadge({ status }) {
  const m = STATUS_MAP[status] || STATUS_MAP.draft;
  return <Badge variant={m.variant} className={m.color}>{m.label}</Badge>;
}

// ── Main Component ──────────────────────────────

export default function ARInvoiceList() {
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

  return (
    <div className="space-y-6" data-testid="ar-invoice-list">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> AR Ledger
          </h2>
          <p className="text-muted-foreground text-sm">Kelola invoice piutang, customer, dan rekonsiliasi AR</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCustomerDialog(true)} data-testid="add-customer-btn">
            <Plus className="h-4 w-4 mr-2" /> Customer Baru
          </Button>
          <Button variant="outline"
            onClick={() => exportXlsx("/ar/invoices/write-off/export/xlsx", "ar_writeoff.xlsx")}
            disabled={downloading}
            data-testid="ar-writeoff-export-xlsx"
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? "Mengunduh..." : "Export Write-off"}
          </Button>
          <Button onClick={() => setInvoiceDialog(true)} data-testid="create-invoice-btn">
            <Plus className="h-4 w-4 mr-2" /> Invoice Baru
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ar-kpi-strip">
          <Card data-testid="ar-kpi-count"><CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Invoice</div>
            <div className="text-xl font-bold">{summary.count}</div>
          </CardContent></Card>
          <Card data-testid="ar-kpi-total"><CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Tagihan</div>
            <div className="text-xl font-bold">{formatCurrency(summary.total)}</div>
          </CardContent></Card>
          <Card data-testid="ar-kpi-outstanding"><CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(summary.outstanding)}</div>
          </CardContent></Card>
          <Card data-testid="ar-kpi-overdue"><CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Jatuh Tempo</div>
            <div className="text-xl font-bold text-red-600">{summary.overdue}</div>
          </CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="ar-tabs">
        <TabsList>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
          <TabsTrigger value="aging" data-testid="tab-aging">Aging Report</TabsTrigger>
          <TabsTrigger value="recon" data-testid="tab-recon">Rekonsiliasi</TabsTrigger>
        </TabsList>

        {/* ── INVOICES TAB ──────────────────────────── */}
        <TabsContent value="invoices" className="mt-4">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
              className="w-40" placeholder="Periode" data-testid="filter-period" />
            <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44" data-testid="filter-status">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadInvoices} data-testid="invoices-refresh">
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
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p>Belum ada invoice</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setInvoiceDialog(true)}>
                      Buat Invoice Pertama
                    </Button>
                  </div>
                )}
                rowClassName={(inv) => (inv.status === "overdue" ? "bg-red-50 dark:bg-red-950/20" : "")}
                columns={[
                  { key: "invoice_no", label: "No Invoice", sortable: true, primary: true,
                    render: (inv) => <span className="font-mono text-sm font-medium">{inv.invoice_no}</span> },
                  { key: "customer_name", label: "Customer", sortable: true,
                    render: (inv) => (
                      <div>
                        <div>{inv.customer_name}</div>
                        {inv.channel && <Badge variant="outline" className="text-xs mt-0.5">{inv.channel}</Badge>}
                      </div>
                    ) },
                  { key: "invoice_date", label: "Tgl Invoice", sortable: true,
                    render: (inv) => <span className="text-sm">{formatDateID(inv.invoice_date)}</span> },
                  { key: "due_date", label: "Jatuh Tempo", sortable: true,
                    render: (inv) => <span className={`text-sm ${inv.status === "overdue" ? "text-red-600 font-medium" : ""}`}>{formatDateID(inv.due_date)}</span> },
                  { key: "total_amount", label: "Total", numeric: true, sortable: true,
                    render: (inv) => <span className="text-sm font-semibold">{formatCurrency(inv.total_amount)}</span> },
                  { key: "outstanding", label: "Outstanding", numeric: true, sortable: true,
                    render: (inv) => inv.outstanding > 0
                      ? <span className="text-orange-600 font-medium">{formatCurrency(inv.outstanding)}</span>
                      : <span className="text-green-600 text-sm">Lunas</span> },
                  { key: "status", label: "Status",
                    render: (inv) => <StatusBadge status={inv.status} /> },
                ]}
                rowAction={(inv) => (
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Detail" aria-label="Lihat detail invoice"
                      onClick={() => setDetailDialog(inv)} data-testid={`view-invoice-${inv.invoice_no}`}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {inv.status === "draft" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Kirim" aria-label="Kirim invoice"
                        onClick={() => handleSendInvoice(inv)} data-testid={`send-invoice-${inv.invoice_no}`}>
                        <Send className="h-3 w-3" />
                      </Button>
                    )}
                    {inv.status === "draft" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit Invoice" aria-label="Edit invoice"
                        onClick={() => setInvoiceEdit(inv)} data-testid={`edit-invoice-${inv.invoice_no}`}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    {inv.outstanding > 0 && inv.status !== "draft" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Kirim Pengingat Pembayaran" aria-label="Kirim pengingat"
                        onClick={() => setReminderDialog(inv)} data-testid={`remind-invoice-${inv.invoice_no}`}>
                        <Bell className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Download PDF" aria-label="Download PDF"
                      onClick={() => handleDownloadPDF(inv)} data-testid={`pdf-invoice-${inv.invoice_no}`}>
                      <Download className="h-3 w-3" />
                    </Button>
                    {inv.outstanding > 0 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-700" title="Catat Pembayaran" aria-label="Catat pembayaran"
                        onClick={() => setReceiptDialog(inv)} data-testid={`record-payment-${inv.invoice_no}`}>
                        <DollarSign className="h-3 w-3" />
                      </Button>
                    )}
                    {(inv.status === "overdue" || (inv.outstanding > 0 && inv.status !== "draft")) && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Write Off Piutang Tak Tertagih"
                        onClick={() => { setWriteOffDialog(inv); setWriteOffReason(""); }}
                        data-testid={`write-off-${inv.invoice_no}`}>
                        <TrendingDown className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CUSTOMERS TAB ──────────────────────────── */}
        <TabsContent value="customers" className="mt-4">
          <Card data-testid="customers-table-card">
            <CardContent className="pt-4">
              <DataTable
                rows={customers}
                keyField="id"
                loading={loading}
                rowTestIdPrefix="customer-row"
                empty={(
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 mb-2" />
                    <p>Belum ada customer AR</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setCustomerDialog(true)}>
                      Tambah Customer
                    </Button>
                  </div>
                )}
                columns={[
                  { key: "name", label: "Nama Customer", sortable: true, primary: true,
                    render: (c) => <span className="font-medium">{c.name}</span> },
                  { key: "channel", label: "Channel",
                    render: (c) => <Badge variant="outline">{c.channel}</Badge> },
                  { key: "npwp", label: "NPWP",
                    render: (c) => <span className="font-mono text-xs">{c.npwp || "-"}</span> },
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
                      ? <span className="text-orange-600 font-semibold">{formatCurrency(c.total_outstanding)}</span>
                      : <span className="text-muted-foreground">-</span>) },
                ]}
                rowAction={(c) => (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit Customer" aria-label="Edit customer"
                    onClick={() => setCustomerEdit(c)} data-testid={`edit-customer-${c.id}`}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AGING REPORT TAB ──────────────────────────── */}
        <TabsContent value="aging" className="mt-4" data-testid="aging-tab">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : aging ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">AR Aging Report</h3>
                  <p className="text-sm text-muted-foreground">Per tanggal: {formatDateID(aging.as_of)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadAging}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>

              {/* Bucket Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="aging-buckets">
                {[
                  { key: "current",  label: "Belum JT",    color: "text-green-600" },
                  { key: "1_30",     label: "1-30 Hari",   color: "text-amber-500" },
                  { key: "31_60",    label: "31-60 Hari",  color: "text-orange-500" },
                  { key: "61_90",    label: "61-90 Hari",  color: "text-red-500" },
                  { key: "over_90",  label: ">90 Hari",    color: "text-red-700" },
                ].map(({ key, label, color }) => (
                  <Card key={key}>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className={`text-lg font-bold mt-1 ${color}`}>
                        {formatCurrency(aging.buckets[key] || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {aging.items[key]?.length || 0} invoice
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Total */}
              <Card className="bg-muted/40">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Total Outstanding</div>
                    <div className="text-2xl font-bold text-orange-600">
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
                    <CardTitle className="text-base">Per Customer</CardTitle>
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
                          render: (c) => <span className="text-sm text-amber-600">{formatCurrency(c.buckets["1_30"] || 0)}</span> },
                        { key: "31_60", label: "31-60 Hari", numeric: true, sortable: true,
                          sortAccessor: (c) => c.buckets["31_60"] || 0,
                          render: (c) => <span className="text-sm text-orange-600">{formatCurrency(c.buckets["31_60"] || 0)}</span> },
                        { key: "over_60", label: ">60 Hari", numeric: true, sortable: true,
                          sortAccessor: (c) => (c.buckets["61_90"] || 0) + (c.buckets["over_90"] || 0),
                          render: (c) => <span className="text-sm text-red-600">{formatCurrency((c.buckets["61_90"] || 0) + (c.buckets["over_90"] || 0))}</span> },
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
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="mx-auto h-8 w-8 mb-2" />
              <p>Klik refresh untuk memuat aging report</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={loadAging}>
                <RefreshCw className="h-4 w-4 mr-1" /> Muat Aging
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── RECONCILIATION TAB ──────────────────────────── */}
        <TabsContent value="recon" className="mt-4" data-testid="recon-tab">
          <div className="flex items-end gap-3 mb-6">
            <div className="space-y-1">
              <Label>Periode</Label>
              <Input type="month" value={reconPeriod} onChange={e => setReconPeriod(e.target.value)}
                className="w-44" data-testid="recon-period-input" />
            </div>
            <Button onClick={() => reconQuery.refetch()} data-testid="load-recon-btn">
              <BarChart3 className="h-4 w-4 mr-2" /> Muat Rekonsiliasi
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
                    { id: "received", label: "- Pembayaran Diterima", amount: recon.receipts_received, cls: "text-red-600 font-medium", amtCls: "text-red-600 font-semibold", paren: true },
                    { id: "closing", label: "Saldo Akhir", amount: recon.closing_balance, cls: "font-bold text-base", amtCls: "font-bold text-base text-orange-600", paren: false, isTotal: true },
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
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="mx-auto h-8 w-8 mb-2" />
              <p>Pilih periode dan klik "Muat Rekonsiliasi"</p>
            </div>
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
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" /> Write Off Piutang
            </DialogTitle>
            <DialogDescription>
              Invoice <strong>{writeOffDialog?.invoice_no}</strong> — Outstanding:{" "}
              <strong>{writeOffDialog ? formatCurrency(writeOffDialog.outstanding) : ""}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              Tindakan ini akan membuat jurnal: <strong>Dr Beban Piutang Tak Tertagih / Cr Piutang Usaha</strong>.
              Status invoice akan berubah menjadi <strong>Write-off</strong> dan tidak bisa dikembalikan.
            </div>
            <div>
              <Label htmlFor="write-off-reason" className="text-sm font-medium">
                Alasan Write-off <span className="text-red-500">*</span>
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

