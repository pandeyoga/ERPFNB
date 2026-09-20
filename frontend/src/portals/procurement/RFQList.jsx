/**
 * RFQ List Page — Sprint E
 * Lists all Requests for Quotation with status filters and quick actions.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSearch, Plus, RefreshCw, Search, Filter,
  CheckCircle2, Clock, Send, XCircle, FileCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDateID } from "@/lib/format";

const STATUS_META = {
  draft:            { label: "Draft",           color: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",    icon: <Clock className="h-3 w-3" /> },
  sent:             { label: "Dikirim",          color: "bg-blue-500/10 text-blue-600 border-blue-500/20",    icon: <Send className="h-3 w-3" /> },
  quotes_received:  { label: "Quotes Masuk",     color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <FileSearch className="h-3 w-3" /> },
  accepted:         { label: "Diterima",         color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:        { label: "Dibatalkan",       color: "bg-red-500/10 text-red-500 border-red-500/20",       icon: <XCircle className="h-3 w-3" /> },
};

export default function RFQList() {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { per_page: 30 };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/rfq", { params });
      if (res.data.success) {
        setRfqs(res.data.data.items || []);
        setMeta(res.data.data.meta || {});
      }
    } catch (err) {
      toast.error("Gagal memuat RFQ");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => navigate("/procurement/rfq/new");

  const columns = [
    { key: "rfq_no", label: "No. RFQ", primary: true, sortable: true,
      render: (rfq) => <span className="font-mono font-medium text-sm" data-testid={`rfq-no-${rfq.rfq_no}`}>{rfq.rfq_no}</span> },
    { key: "title", label: "Judul", sortable: true,
      render: (rfq) => (<div><p className="font-medium text-sm">{rfq.title}</p><p className="text-xs text-muted-foreground">{rfq.items?.length || 0} item</p></div>) },
    { key: "vendors", label: "Vendor", render: (rfq) => <span className="text-sm">{rfq.vendor_ids?.length || 0} vendor</span> },
    { key: "deadline", label: "Deadline", sortable: true, sortAccessor: (rfq) => rfq.deadline || "",
      render: (rfq) => <span className="text-sm">{rfq.deadline ? formatDateID(rfq.deadline) : "-"}</span> },
    { key: "quotes", label: "Quotes",
      render: (rfq) => (<><span className="text-sm font-medium">{rfq.quotes?.length || 0}</span><span className="text-xs text-muted-foreground"> / {rfq.vendor_ids?.length || 0}</span></>) },
    { key: "status", label: "Status",
      render: (rfq) => { const sm = STATUS_META[rfq.status] || STATUS_META.draft; return <Badge variant="outline" className={`gap-1 ${sm.color}`} data-testid={`rfq-status-${rfq.rfq_no}`}>{sm.icon}{sm.label}</Badge>; } },
  ];

  return (
    <div className="space-y-6 p-6" data-testid="rfq-list-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Request for Quotation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Minta penawaran harga dari vendor sebelum membuat PO
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="create-rfq-btn">
          <Plus className="h-4 w-4 mr-2" />Buat RFQ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row" data-testid="rfq-filters">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor RFQ atau judul..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="rfq-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="rfq-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} aria-label="Refresh daftar RFQ" data-testid="rfq-refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card data-testid="rfq-table-card">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={rfqs}
            keyField="id"
            loading={loading}
            onRowClick={(rfq) => navigate(`/procurement/rfq/${rfq.id}`)}
            rowTestIdPrefix="rfq-row"
            rowAction={(rfq) => (
              <Button size="sm" variant="outline" onClick={() => navigate(`/procurement/rfq/${rfq.id}`)} data-testid={`rfq-detail-${rfq.rfq_no}`}>
                Detail
              </Button>
            )}
            empty={
              <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="rfq-empty">
                <FileSearch className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">Belum ada RFQ</p>
                <Button onClick={handleCreate} data-testid="rfq-empty-create-btn"><Plus className="h-4 w-4 mr-2" />Buat RFQ Pertama</Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {meta.total > 0 && (
        <p className="text-xs text-muted-foreground text-center" data-testid="rfq-meta">
          Menampilkan {rfqs.length} dari {meta.total} RFQ
        </p>
      )}
    </div>
  );
}
