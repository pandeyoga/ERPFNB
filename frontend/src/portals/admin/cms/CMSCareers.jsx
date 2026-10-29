/**
 * CMSCareers.jsx — Sprint Compro-Next
 * Admin management of job listings: create, edit, toggle active/inactive
 */
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Edit2, Power, PowerOff, Search, RefreshCw, Loader2, Briefcase,
  MapPin, Clock, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import EmptyState from "@/components/shared/EmptyState";

const DEPARTMENTS = [
  "All", "Operations", "Finance", "Marketing", "IT", "HR", "F&B", "Culinary", "Management", "Other",
];
const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

const EMPTY_FORM = {
  title: "",
  department: "Operations",
  location: "",
  job_type: "Full-time",
  description: "",
  requirements: "",
  application_email: "",
  brand: "",
  is_active: true,
};

const TYPE_COLORS = {
  "Full-time":   "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  "Part-time":   "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
  "Contract":    "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  "Internship":  "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
};

export default function CMSCareers() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (deptFilter && deptFilter !== "all") params.department = deptFilter;
      if (!showInactive) params.is_active = true;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/admin/cms/jobs", { params });
      const data = res.data?.data || res.data;
      const items = Array.isArray(data) ? data : data?.items || [];
      setJobs(items);
      setTotal(data?.total || items.length);
    } catch {
      toast.error("Gagal memuat lowongan");
    } finally {
      setLoading(false);
    }
  }, [deptFilter, showInactive, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing({});
  }

  function openEdit(job) {
    setForm({
      title: job.title || "",
      department: job.department || "Operations",
      location: job.location || "",
      job_type: job.job_type || "Full-time",
      description: job.description || "",
      requirements: job.requirements || "",
      application_email: job.application_email || "",
      brand: job.brand || "",
      is_active: job.is_active !== false,
    });
    setEditing(job);
  }

  async function saveJob() {
    if (!form.title || !form.department || !form.location) {
      toast.error("Judul, departemen, dan lokasi wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await api.put(`/admin/cms/jobs/${editing.id}`, form);
        toast.success("Lowongan diupdate");
      } else {
        await api.post("/admin/cms/jobs", form);
        toast.success("Lowongan dibuat");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e?.response?.data?.errors?.[0]?.message || e?.response?.data?.detail) || "Gagal menyimpan lowongan");
    } finally {
      setSaving(false);
    }
  }

  async function doToggle() {
    const job = confirmToggle;
    setConfirmToggle(null);
    try {
      await api.put(`/admin/cms/jobs/${job.id}`, { is_active: !job.is_active });
      toast.success(job.is_active ? "Lowongan dinonaktifkan" : "Lowongan diaktifkan");
      load();
    } catch {
      toast.error("Gagal mengubah status lowongan");
    }
  }

  const activeCount = jobs.filter((j) => j.is_active).length;

  return (
    <div className="space-y-3" data-testid="cms-careers">
      {/* Toolbar: ringkasan + aksi utama (judul sudah di PageHeader/tab CMS Studio) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {total} lowongan total &mdash; {activeCount} aktif &mdash; tampil di halaman Careers publik
        </p>
        <Button onClick={openCreate} data-testid="new-job-btn">
          <Plus className="h-4 w-4" /> Lowongan Baru
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari lowongan…"
            className="pl-9"
            aria-label="Cari lowongan"
            data-testid="jobs-search"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]" aria-label="Filter departemen" data-testid="dept-filter">
            <SelectValue placeholder="Departemen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Departemen</SelectItem>
            {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Tampilkan nonaktif
        </label>
        <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang" title="Muat ulang" data-testid="jobs-refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Jobs table/list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState icon={Briefcase} title="Belum ada lowongan" description="Klik Lowongan Baru untuk membuat lowongan pertama." />
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className={`overflow-hidden transition-opacity ${job.is_active ? "" : "opacity-60"}`}
              data-testid={`job-row-${job.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Briefcase className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-semibold">{job.title}</h3>
                      <Badge
                        variant="outline"
                        className={`text-xs ${TYPE_COLORS[job.job_type] || ""}`}
                      >
                        {job.job_type}
                      </Badge>
                      {!job.is_active && (
                        <Badge variant="outline" className="text-xs border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400">Nonaktif</Badge>
                      )}
                      {job.brand && (
                        <Badge variant="outline" className="text-xs">{job.brand}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job.department}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {job.created_at ? new Date(job.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </span>
                    </div>
                    {/* Expandable description */}
                    {expandedId === job.id && (
                      <div className="mt-3 space-y-2">
                        {job.description && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Deskripsi</div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                          </div>
                        )}
                        {job.requirements && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Requirements</div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
                          </div>
                        )}
                        {job.application_email && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Apply ke:</span>{" "}
                            <a href={`mailto:${job.application_email}`} className="text-primary underline">{job.application_email}</a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={expandedId === job.id ? "Sembunyikan detail" : "Lihat detail"}
                      aria-expanded={expandedId === job.id}
                      onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                      data-testid={`expand-job-${job.id}`}
                    >
                      {expandedId === job.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(job)}
                      data-testid={`edit-job-${job.id}`}
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setConfirmToggle(job)}
                      title={job.is_active ? "Nonaktifkan" : "Aktifkan"}
                      aria-label={job.is_active ? "Nonaktifkan lowongan" : "Aktifkan lowongan"}
                      data-testid={`toggle-job-${job.id}`}
                    >
                      {job.is_active ? <PowerOff className="h-3.5 w-3.5 text-red-700 dark:text-red-400" /> : <Power className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl" data-testid="job-dialog">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Lowongan" : "Lowongan Baru"}</DialogTitle>
            <DialogDescription>Lowongan aktif akan tampil di halaman Careers publik.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="job-form-judul-posisi">Judul Posisi *</Label>
                <Input id="job-form-judul-posisi"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5"
                  placeholder="e.g. Barista, Finance Staff"
                  data-testid="job-form-title"
                />
              </div>
              <div>
                <Label htmlFor="job-form-departemen">Departemen *</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger id="job-form-departemen" className="mt-1.5" data-testid="job-form-dept">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="job-form-tipe-pekerjaan">Tipe Pekerjaan</Label>
                <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
                  <SelectTrigger id="job-form-tipe-pekerjaan" className="mt-1.5" data-testid="job-form-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="job-form-lokasi">Lokasi *</Label>
                <Input id="job-form-lokasi"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="mt-1.5"
                  placeholder="e.g. Bali, Remote, Seminyak"
                  data-testid="job-form-location"
                />
              </div>
              <div>
                <Label htmlFor="job-form-brand-outlet">Brand / Outlet</Label>
                <Input id="job-form-brand-outlet"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="mt-1.5"
                  placeholder="e.g. The Coffeeshop, The Restaurant"
                  data-testid="job-form-brand"
                />
              </div>
              <div>
                <Label htmlFor="job-form-email-lamaran">Email Lamaran</Label>
                <Input id="job-form-email-lamaran"
                  type="email"
                  value={form.application_email}
                  onChange={(e) => setForm({ ...form, application_email: e.target.value })}
                  className="mt-1.5"
                  placeholder="hr@fnbgroup.id"
                  data-testid="job-form-email"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="job-form-deskripsi-pekerjaan">Deskripsi Pekerjaan</Label>
              <Textarea id="job-form-deskripsi-pekerjaan"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1.5"
                placeholder="Jelaskan tanggung jawab dan tugas utama…"
                data-testid="job-form-description"
              />
            </div>
            <div>
              <Label htmlFor="job-form-requirements-kualifikasi">Requirements / Kualifikasi</Label>
              <Textarea id="job-form-requirements-kualifikasi"
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                rows={4}
                className="mt-1.5"
                placeholder="- Min D3/S1 semua jurusan&#10;- Pengalaman 1 tahun…"
                data-testid="job-form-requirements"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                data-testid="job-form-active"
              />
              Aktif (tampil di halaman Careers publik)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Batal</Button>
            <Button onClick={saveJob} disabled={saving} data-testid="save-job-btn">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan…</> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Toggle */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent data-testid="confirm-toggle-job">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? "Nonaktifkan Lowongan?" : "Aktifkan Lowongan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? `"${confirmToggle?.title}" tidak akan tampil di halaman publik.`
                : `"${confirmToggle?.title}" akan tampil kembali di halaman publik.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doToggle}
              className={confirmToggle?.is_active ? buttonVariants({ variant: "destructive" }) : ""}
              data-testid="confirm-toggle-job-action"
            >
              {confirmToggle?.is_active ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
