/**
 * RFQ Detail Page — Sprint E
 * Shows RFQ detail, vendor quote entry, comparison matrix, and accept-to-PO flow.
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Send, CheckCircle2, X, RefreshCw,
  Trophy, Clock, FileCheck, AlertCircle, FileSearch, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api, { fetchAll, unwrap } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { confirmDialog } from "@/components/shared/confirmDialog";
import StatusPill from "@/components/shared/StatusPill";

// ──── RFQ Create Form (when navigating to /rfq/new)
export function RFQForm() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    vendor_ids: [],
    deadline: "",
    notes: "",
  });
  const [lines, setLines] = useState([{ item_name: "", qty: 1, uom: "pcs", est_unit_price: 0 }]);

  useEffect(() => {
    // Semua vendor aktif (bukan hanya halaman pertama) — dipilih lewat pencarian di bawah.
    fetchAll("/master/vendors", { active: true }).then(r => setVendors(unwrap(r) || [])).catch(() => {});
    api.get("/master/items").then(r => setItems(r.data.data?.items || r.data.data || []));
  }, []);

  const vq = vendorQuery.trim().toLowerCase();
  const shownVendors = vendors.filter(v =>
    form.vendor_ids.includes(v.id) || !vq || `${v.name} ${v.code || ""}`.toLowerCase().includes(vq));

  const addLine = () => setLines(l => [...l, { item_name: "", qty: 1, uom: "pcs", est_unit_price: 0 }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, key, val) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [key]: val } : ln));

  const handleSubmit = async () => {
    if (!form.title) return toast.error("Judul RFQ wajib diisi");
    if (form.vendor_ids.length === 0) return toast.error("Pilih setidaknya 1 vendor");
    if (lines.every(l => !l.item_name)) return toast.error("Tambahkan setidaknya 1 item");
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: lines.filter(l => l.item_name).map((l, i) => ({ ...l, line_no: i + 1 })),
      };
      const res = await api.post("/rfq", payload);
      toast.success(`RFQ ${res.data.data.rfq_no} dibuat`);
      navigate(`/procurement/rfq/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal membuat RFQ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 lg:space-y-4 max-w-3xl mx-auto" data-testid="rfq-form-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/procurement/rfq")} className="-ml-2 mb-1" data-testid="rfq-form-back">
          <ArrowLeft /> Kembali ke RFQ
        </Button>
        <PageHeader
          icon={FileSearch}
          title="RFQ Baru"
          subtitle="Request for Quotation — kirim permintaan penawaran harga ke beberapa vendor."
          className="mb-0 md:mb-0"
        />
      </div>

      <Card data-testid="rfq-form-info-card">
        <CardHeader><CardTitle>Informasi RFQ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="rfq-form-title" className="text-xs md:text-sm font-medium">Judul RFQ *</Label>
            <Input id="rfq-form-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Mis: Permintaan Harga Bahan Baku Mei 2026" data-testid="rfq-form-title" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rfq-form-deadline" className="text-xs md:text-sm font-medium">Batas waktu balasan</Label>
            <Input id="rfq-form-deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} data-testid="rfq-form-deadline" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rfq-form-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
            <Textarea id="rfq-form-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Syarat pengiriman, spesifikasi khusus..." data-testid="rfq-form-notes" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="rfq-form-vendors-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vendor *</CardTitle>
            <Badge variant="outline" data-testid="rfq-form-vendor-count">{form.vendor_ids.length} dipilih</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={vendorQuery}
              onChange={e => setVendorQuery(e.target.value)}
              placeholder={`Cari dari ${vendors.length} vendor…`}
              aria-label="Cari vendor"
              className="glass-input pl-9"
              data-testid="rfq-form-vendor-search"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1" data-testid="rfq-form-vendor-list">
            {shownVendors.length === 0 && (
              <p className="col-span-2 text-sm text-muted-foreground py-2">Tidak ada vendor yang cocok.</p>
            )}
            {shownVendors.map(v => (
              <button
                key={v.id}
                type="button"
                aria-pressed={form.vendor_ids.includes(v.id)}
                onClick={() => setForm(f => ({ ...f, vendor_ids: f.vendor_ids.includes(v.id) ? f.vendor_ids.filter(x => x !== v.id) : [...f.vendor_ids, v.id] }))}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  form.vendor_ids.includes(v.id) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50"
                }`}
                data-testid={`rfq-form-vendor-${v.id}`}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: form.vendor_ids.includes(v.id) ? "currentColor" : "transparent", border: "1.5px solid currentColor" }} />
                {v.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="rfq-form-items-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Item yang diminta</CardTitle>
            <Button size="sm" variant="outline" onClick={addLine} data-testid="rfq-form-add-line"><Plus /> Tambah item</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-start" data-testid={`rfq-form-line-${i}`}>
              <div className="flex-1 space-y-1">
                <Input placeholder="Nama item" aria-label={`Nama item baris ${i + 1}`} value={line.item_name} onChange={e => updateLine(i, "item_name", e.target.value)} data-testid={`rfq-form-line-${i}-name`} />
              </div>
              <div className="w-20">
                <Input type="number" min="1" placeholder="Qty" aria-label={`Qty baris ${i + 1}`} value={line.qty} onChange={e => updateLine(i, "qty", Number(e.target.value))} data-testid={`rfq-form-line-${i}-qty`} />
              </div>
              <div className="w-20">
                <Input placeholder="Unit" aria-label={`Unit baris ${i + 1}`} value={line.uom} onChange={e => updateLine(i, "uom", e.target.value)} data-testid={`rfq-form-line-${i}-uom`} />
              </div>
              <div className="w-28">
                <Input type="number" placeholder="Est. harga" aria-label={`Estimasi harga baris ${i + 1}`} value={line.est_unit_price || ""} onChange={e => updateLine(i, "est_unit_price", Number(e.target.value))} data-testid={`rfq-form-line-${i}-price`} />
              </div>
              <Button size="icon" variant="ghost" aria-label={`Hapus baris ${i + 1}`} onClick={() => removeLine(i)} data-testid={`rfq-form-line-${i}-remove`}><X /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/procurement/rfq")} data-testid="rfq-form-cancel">Batal</Button>
        <Button onClick={handleSubmit} disabled={saving} data-testid="rfq-form-submit">
          {saving ? <RefreshCw className="animate-spin" /> : <Plus />}
          Buat RFQ
        </Button>
      </div>
    </div>
  );
}

// ──── RFQ Detail
export default function RFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState("");
  const [quoteForm, setQuoteForm] = useState({ lines: [], notes: "" });
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rfqRes, matRes] = await Promise.all([
        api.get(`/rfq/${id}`),
        api.get(`/rfq/${id}/compare`).catch(() => ({ data: { data: null } })),
      ]);
      setRfq(rfqRes.data.data);
      setMatrix(matRes.data.data);
    } catch {
      toast.error("Gagal memuat RFQ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSendRFQ = async () => {
    try {
      await api.post(`/rfq/${id}/send`);
      toast.success("RFQ ditandai sudah dikirim");
      load();
    } catch {
      toast.error("Gagal mengubah status RFQ");
    }
  };

  const openQuoteDialog = (vendorId, vendorName) => {
    setQuoteVendorId(vendorId);
    const existingQuote = rfq?.quotes?.find(q => q.vendor_id === vendorId);
    setQuoteForm({
      lines: (rfq?.items || []).map(item => {
        const existingLine = existingQuote?.lines?.find(l => l.item_id === item.item_id);
        return {
          item_id: item.item_id,
          item_name: item.item_name,
          unit_price: existingLine?.unit_price || 0,
          moq: existingLine?.moq || 1,
          lead_time_days: existingLine?.lead_time_days || 3,
          notes: existingLine?.notes || "",
        };
      }),
      notes: existingQuote?.notes || "",
    });
    setQuoteDialog(true);
  };

  const handleSaveQuote = async () => {
    setSaving(true);
    try {
      await api.post(`/rfq/${id}/quotes/${quoteVendorId}`, quoteForm);
      toast.success("Penawaran disimpan");
      setQuoteDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menyimpan penawaran");
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (vendorId) => {
    if (!(await confirmDialog("Terima penawaran vendor ini dan buat PO draft?"))) return;
    setAccepting(vendorId);
    try {
      const res = await api.post(`/rfq/${id}/accept/${vendorId}`);
      toast.success(`PO ${res.data.data?.po?.po_no || ""} berhasil dibuat!`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menerima penawaran");
    } finally {
      setAccepting("");
    }
  };

  if (loading) return <div data-testid="rfq-detail-loading"><LoadingState rows={6} /></div>;
  if (!rfq) return (
    <div className="glass-card" data-testid="rfq-detail-not-found">
      <EmptyState icon={FileSearch} title="RFQ tidak ditemukan" description="RFQ mungkin sudah dihapus atau Anda tidak punya akses."
        action={<Button variant="outline" onClick={() => navigate("/procurement/rfq")}><ArrowLeft /> Kembali ke RFQ</Button>} />
    </div>
  );


  const quotedVendorIds = (rfq.quotes || []).map(q => q.vendor_id);
  const vendorMap = rfq.vendor_map || {};

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="rfq-detail-page">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/procurement/rfq")} className="-ml-2 mb-1" data-testid="rfq-detail-back">
          <ArrowLeft /> Kembali ke RFQ
        </Button>
        <PageHeader
          icon={FileSearch}
          title={<span data-testid="rfq-detail-no">{rfq.rfq_no}</span>}
          subtitle={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span data-testid="rfq-detail-status"><StatusPill status={rfq.status} /></span>
              <span data-testid="rfq-detail-title">{rfq.title}</span>
            </span>
          }
          className="mb-0 md:mb-0"
          actions={
            <>
              {rfq.po_id && (
                <Button asChild variant="outline" data-testid="rfq-detail-po-badge">
                  <Link to={`/procurement/po/${rfq.po_id}`}><FileCheck /> Lihat PO</Link>
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang RFQ" data-testid="rfq-detail-refresh"><RefreshCw /></Button>
              {rfq.status === "draft" && (
                <Button onClick={handleSendRFQ} data-testid="rfq-detail-send">
                  <Send /> Tandai dikirim
                </Button>
              )}
            </>
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="rfq-detail-tabs">
          <TabsTrigger value="overview" data-testid="rfq-tab-overview">Ringkasan</TabsTrigger>
          <TabsTrigger value="quotes" data-testid="rfq-tab-quotes">Penawaran ({rfq.quotes?.length || 0})</TabsTrigger>
          <TabsTrigger value="compare" data-testid="rfq-tab-compare">Perbandingan</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-3" data-testid="rfq-overview-content">
          <div className="grid gap-3 lg:gap-4 sm:grid-cols-2">
            <Card data-testid="rfq-overview-items">
              <CardHeader><CardTitle>Item diminta</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(rfq.items || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm" data-testid={`rfq-overview-item-${i}`}>
                      <span>{item.item_name}</span>
                      <span className="text-muted-foreground">{item.qty} {item.uom}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="rfq-overview-vendors">
              <CardHeader><CardTitle>Vendor yang dikirimi</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(rfq.vendor_ids || []).map(vid => (
                    <div key={vid} className="flex items-center justify-between text-sm" data-testid={`rfq-overview-vendor-${vid}`}>
                      <span>{vendorMap[vid] || vid}</span>
                      {quotedVendorIds.includes(vid)
                        ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20 text-xs">Sudah menawar</Badge>
                        : <Badge variant="outline" className="text-xs">Belum menawar</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          {rfq.notes && (
            <Card data-testid="rfq-overview-notes"><CardContent className="pt-4"><p className="text-sm"><span className="font-medium">Catatan:</span> {rfq.notes}</p></CardContent></Card>
          )}
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes" className="space-y-3" data-testid="rfq-quotes-content">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rfq.quotes?.length || 0} dari {rfq.vendor_ids?.length || 0} vendor sudah memberikan penawaran</p>
          </div>
          {/* Vendor cards - enter/view quotes */}
          <div className="grid gap-3 lg:gap-4 sm:grid-cols-2" data-testid="rfq-quote-cards">
            {(rfq.vendor_ids || []).map(vid => {
              const vname = vendorMap[vid] || vid;
              const quote = rfq.quotes?.find(q => q.vendor_id === vid);
              return (
                <Card key={vid} data-testid={`rfq-quote-card-${vid}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle>{vname}</CardTitle>
                      {quote
                        ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Sudah menawar</Badge>
                        : <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>
                      }
                    </div>
                  </CardHeader>
                  <CardContent>
                    {quote && (
                      <div className="mb-3 space-y-1">
                        {quote.lines?.map((ln, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{ln.item_name || ln.item_id}</span>
                            <span className="font-medium tabular-nums">{formatCurrency(ln.unit_price)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                          <span>Total estimasi</span>
                          <span className="tabular-nums">{formatCurrency(quote.total_est || 0)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={quote ? "outline" : "default"}
                        className="flex-1"
                        onClick={() => openQuoteDialog(vid, vname)}
                        disabled={rfq.status === "accepted" || rfq.status === "cancelled"}
                        data-testid={`rfq-quote-edit-${vid}`}
                      >
                        {quote ? "Ubah penawaran" : "Input penawaran"}
                      </Button>
                      {quote && rfq.status !== "accepted" && rfq.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="success"
                          className="flex-1"
                          onClick={() => handleAccept(vid)}
                          disabled={accepting === vid}
                          data-testid={`rfq-quote-accept-${vid}`}
                        >
                          {accepting === vid
                            ? <RefreshCw className="animate-spin" />
                            : <Trophy />}
                          Terima
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" data-testid="rfq-compare-content">
          {!matrix || !matrix.vendors?.length ? (
            <div className="glass-card" data-testid="rfq-compare-empty">
              <EmptyState icon={AlertCircle} title="Belum ada penawaran untuk dibandingkan"
                description="Input penawaran vendor di tab Penawaran terlebih dahulu." />
            </div>
          ) : (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-0">
                  <DataTable
                    rows={matrix.items}
                    keyField="item_id"
                    rowTestIdPrefix="rfq-compare-row"
                    columns={[
                      { key: "item_name", label: "Item", primary: true, headerClassName: "min-w-[140px]",
                        render: (item) => <span className="font-medium text-sm">{item.item_name}</span> },
                      { key: "qty", label: "Qty",
                        render: (item) => <span className="text-sm text-muted-foreground">{item.qty} {item.uom}</span> },
                      ...matrix.vendors.map((v) => ({
                        key: `v_${v.vendor_id}`,
                        label: v.vendor_name,
                        align: "center",
                        render: (item) => {
                          const q = item.quotes[v.vendor_id];
                          return q?.unit_price != null ? (
                            <div className={`rounded px-2 py-0.5 text-sm inline-block ${q.is_cheapest ? "bg-emerald-500/15 text-emerald-800 font-semibold" : ""}`}>
                              {formatCurrency(q.unit_price)}
                              {q.is_cheapest && <Trophy className="inline h-3 w-3 ml-1" />}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        },
                      })),
                    ]}
                    footer={
                      <tr className="font-semibold bg-muted/30" data-testid="rfq-compare-total-row">
                        <td className="px-4 py-2.5">Total Estimasi</td>
                        <td className="px-4 py-2.5" />
                        {matrix.vendors.map((v) => (
                          <td key={v.vendor_id} className="px-4 py-2.5 text-center tabular-nums">
                            {formatCurrency(v.total_est)}
                          </td>
                        ))}
                      </tr>
                    }
                  />
                </CardContent>
              </Card>

              {rfq.status !== "accepted" && rfq.status !== "cancelled" && (
                <div className="flex flex-wrap gap-2" data-testid="rfq-compare-accept-buttons">
                  {matrix.vendors.map(v => (
                    <Button
                      key={v.vendor_id}
                      onClick={() => handleAccept(v.vendor_id)}
                      disabled={accepting === v.vendor_id || !rfq.quotes?.some(q => q.vendor_id === v.vendor_id)}
                      variant="outline"
                      data-testid={`rfq-compare-accept-${v.vendor_id}`}
                    >
                      {accepting === v.vendor_id
                        ? <RefreshCw className="animate-spin" />
                        : <Trophy />}
                      Terima {v.vendor_name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quote Entry Dialog */}
      <Dialog open={quoteDialog} onOpenChange={setQuoteDialog}>
        <DialogContent className="max-w-xl" data-testid="quote-dialog">
          <DialogHeader><DialogTitle>Penawaran — {vendorMap[quoteVendorId] || quoteVendorId}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {quoteForm.lines.map((line, i) => (
              <div key={i} className="space-y-2" data-testid={`quote-line-${i}`}>
                <p className="text-sm font-medium">{line.item_name || `Item ${i + 1}`}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`quote-line-${i}-price`} className="text-xs">Harga satuan (Rp)</Label>
                    <Input id={`quote-line-${i}-price`} type="number" min="0" value={line.unit_price || ""}
                      onChange={e => setQuoteForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, unit_price: Number(e.target.value) } : l) }))}
                      placeholder="0"
                      data-testid={`quote-line-${i}-price`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`quote-line-${i}-moq`} className="text-xs">Min. order</Label>
                    <Input id={`quote-line-${i}-moq`} type="number" min="1" value={line.moq || 1}
                      onChange={e => setQuoteForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, moq: Number(e.target.value) } : l) }))}
                      data-testid={`quote-line-${i}-moq`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`quote-line-${i}-lead`} className="text-xs">Lead time (hari)</Label>
                    <Input id={`quote-line-${i}-lead`} type="number" min="1" value={line.lead_time_days || 3}
                      onChange={e => setQuoteForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, lead_time_days: Number(e.target.value) } : l) }))}
                      data-testid={`quote-line-${i}-lead-time`}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="quote-notes" className="text-xs md:text-sm font-medium">Catatan vendor</Label>
              <Textarea id="quote-notes" rows={2} value={quoteForm.notes}
                onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Kondisi pembayaran, syarat khusus..."
                data-testid="quote-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialog(false)} data-testid="quote-cancel">Batal</Button>
            <Button onClick={handleSaveQuote} disabled={saving} data-testid="quote-save">
              {saving ? <RefreshCw className="animate-spin" /> : null}
              Simpan penawaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
