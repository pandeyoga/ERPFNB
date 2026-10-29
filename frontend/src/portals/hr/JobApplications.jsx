/**
 * JobApplications — HR portal view for managing incoming job applications.
 * Allows HR to review, filter, update status (new/reviewed/shortlisted/rejected/hired),
 * and add internal notes. (DataTable migration: sortable list, row→detail.)
 */
import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, User, Mail, Phone, Calendar, MessageSquare,
  Search, RefreshCw, FileText, CheckCircle,
  XCircle, Star, Eye, Clock,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";

dayjs.extend(relativeTime);
dayjs.locale("id");

const STATUS_CONFIG = {
  new:         { label: "Baru",         variant: "info",    icon: Clock },
  reviewed:    { label: "Ditinjau",     variant: "warning", icon: Eye },
  shortlisted: { label: "Kandidat",     variant: "success", icon: Star },
  rejected:    { label: "Ditolak",      variant: "danger",  icon: XCircle },
  hired:       { label: "Diterima",     variant: "success", icon: CheckCircle },
};

const DEPT_OPTIONS = [
  "Culinary", "Beverage", "Operations", "Management",
  "Marketing", "Finance", "IT", "HR", "F&B",
];

export default function JobApplications() {
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Detail dialog
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (statusFilter !== "all") params.status = statusFilter;
      if (deptFilter !== "all") params.department = deptFilter;
      if (searchQ) params.q = searchQ;
      const res = await api.get("/hr/job-applications", { params });
      const data = unwrap(res);
      setApps(data?.items || []);
      setTotal(data?.total || 0);
    } catch (err) {
      toast.error("Gagal memuat data lamaran: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, statusFilter, deptFilter, searchQ]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQ(searchInput);
    setPage(1);
  };

  const openDetail = (app) => {
    setSelected(app);
    setNoteText(app.notes || "");
    setDetailOpen(true);
  };

  const updateStatus = async (appId, newStatus) => {
    setUpdating(true);
    try {
      const res = await api.patch(`/hr/job-applications/${appId}`, {
        status: newStatus,
        notes: noteText,
      });
      const updated = unwrap(res);
      setApps((prev) => prev.map((a) => a.id === appId ? updated : a));
      setSelected(updated);
      toast.success("Status lamaran diperbarui.");
    } catch (err) {
      toast.error("Gagal memperbarui: " + (err?.message || ""));
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await api.patch(`/hr/job-applications/${selected.id}`, {
        notes: noteText,
      });
      const updated = unwrap(res);
      setApps((prev) => prev.map((a) => a.id === selected.id ? updated : a));
      setSelected(updated);
      toast.success("Catatan disimpan.");
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err?.message || ""));
    } finally {
      setUpdating(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="job-applications-page">
      <PageHeader
        icon={Briefcase}
        title="Job Applications"
        subtitle={`${total} lamaran masuk dari portal karir publik`}
        actions={
          <>
            <InlineHelp id="hr-job-applications" size="sm" />
            <Button variant="outline" onClick={load} disabled={loading} data-testid="refresh-applications">
              <RefreshCw className={cn(loading && "animate-spin")} />
              Muat ulang
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="job-applications-filters">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]" role="search">
          <Input
            type="search"
            placeholder="Cari nama, email, posisi..."
            aria-label="Cari lamaran (nama, email, posisi)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            data-testid="search-applications"
          />
          <Button type="submit" size="icon" variant="outline" aria-label="Cari" data-testid="search-applications-submit">
            <Search />
          </Button>
        </form>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Filter status" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department Filter */}
        <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Filter departemen" data-testid="dept-filter">
            <SelectValue placeholder="Departemen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua departemen</SelectItem>
            {DEPT_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick status filter — segmented pills (gaya sama dengan Tabs: h-8, 13px, aktif = pill-active) */}
      <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-[calc(var(--radius)-2px)] bg-white/35 dark:bg-white/5 border border-border/60 p-1"
           role="group" aria-label="Filter cepat status lamaran" data-testid="job-applications-status-chips">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => {
          const count = apps.filter((a) => a.status === k).length;
          if (count === 0 && statusFilter !== "all" && statusFilter !== k) return null;
          const active = statusFilter === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => { setStatusFilter(active ? "all" : k); setPage(1); }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "pill-active" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`status-chip-${k}`}
            >
              {v.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="glass-card" data-testid="job-applications-table-card">
        <DataTable
          columns={[
            {
              key: "name", label: "Pelamar", primary: true, sortable: true,
              render: (app) => (
                <div>
                  <div className="font-medium text-foreground">{app.name}</div>
                  <div className="text-xs text-muted-foreground">{app.email}</div>
                </div>
              ),
            },
            { key: "job_title", label: "Posisi", sortable: true, render: (app) => app.job_title },
            {
              key: "job_dept", label: "Dept.", sortable: true,
              render: (app) => <span className="text-xs bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">{app.job_dept}</span>,
            },
            {
              key: "applied_at", label: "Tanggal", sortable: true,
              render: (app) => <span className="text-xs text-muted-foreground">{app.applied_at ? dayjs(app.applied_at).fromNow() : "-"}</span>,
            },
            {
              key: "status", label: "Status", align: "center", sortable: true,
              render: (app) => {
                const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;
                return <StatusPill status={app.status} label={sc.label} variant={sc.variant} />;
              },
            },
          ]}
          rows={apps}
          loading={loading}
          defaultSort={{ key: "applied_at", dir: "desc" }}
          onRowClick={openDetail}
          empty={<EmptyState icon={Briefcase} title="Belum ada lamaran"
            description="Lamaran dari halaman karir publik (/careers) akan muncul di sini." />}
          rowAction={(app) => (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openDetail(app)}
              data-testid={`app-view-${app.id}`}
              aria-label={`Lihat detail lamaran ${app.name}`}
              title="Lihat detail"
            >
              <Eye />
            </Button>
          )}
          rowTestIdPrefix="app-row"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 text-sm text-muted-foreground" data-testid="job-applications-pagination">
            <span>Halaman {page} dari {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="job-applications-prev">
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="job-applications-next">
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg" data-testid="application-detail-dialog">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  Melamar untuk <strong>{selected.job_title}</strong> — {selected.job_brand} · {selected.job_dept}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <a href={`mailto:${selected.email}`} className="hover:underline truncate">{selected.email}</a>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{selected.phone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>{selected.applied_at ? dayjs(selected.applied_at).format("DD MMM YYYY HH:mm") : "-"}</span>
                  </div>
                </div>

                {/* Cover Letter */}
                {selected.message && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Cover Letter
                    </h3>
                    <div className="text-sm text-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">
                      {selected.message}
                    </div>
                  </div>
                )}

                {/* Status Actions */}
                <div className="space-y-1.5">
                  <h3 id="app-status-label" className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    Ubah Status
                    <InlineHelp id="hr-job-application-status" size="xs" />
                  </h3>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="app-status-label">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={selected.status === k ? "default" : "outline"}
                        disabled={updating}
                        onClick={() => updateStatus(selected.id, k)}
                        aria-pressed={selected.status === k}
                        data-testid={`status-btn-${k}`}
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="app-notes" className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Catatan Internal
                  </Label>
                  <Textarea
                    id="app-notes"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Tambahkan catatan internal untuk tim HR..."
                    rows={3}
                    className="resize-none"
                    data-testid="notes-textarea"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
                <Button onClick={saveNotes} disabled={updating} data-testid="save-notes-btn">
                  Simpan Catatan
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
