/**
 * JobListings — HR portal: manage job openings visible on the public /careers page.
 * Allows HR to create, edit (title/description/active), and toggle active status.
 */
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Briefcase, Edit2, ToggleLeft, ToggleRight, RefreshCw,
  Building, MapPin, Clock, CheckCircle, XCircle, Users,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { useNavigate } from "react-router-dom";

dayjs.locale("id");

const DEPARTMENTS = [
  "Culinary", "Beverage", "Operations", "Management",
  "Marketing", "Finance", "IT", "HR", "F&B",
];
const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

const EMPTY_FORM = {
  title: "",
  department: "Culinary",
  brand: "FnB Group",
  location: "",
  job_type: "Full-time",
  description: "",
  requirements: "",
  application_email: "hr@fnbgroup.id",
  is_active: true,
};

export default function JobListings() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/job-listings");
      const data = unwrap(res);
      setJobs(data || []);
    } catch (err) {
      toast.error("Gagal memuat lowongan: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (job) => {
    setForm({
      title: job.title || "",
      department: job.department || "Culinary",
      brand: job.brand || "FnB Group",
      location: job.location || "",
      job_type: job.job_type || "Full-time",
      description: job.description || "",
      requirements: job.requirements || "",
      application_email: job.application_email || "hr@fnbgroup.id",
      is_active: job.is_active !== false,
    });
    setEditingId(job.id);
    setDialogOpen(true);
  };

  const toggleActive = async (job) => {
    try {
      const res = await api.patch(`/hr/job-listings/${job.id}`, { is_active: !job.is_active });
      unwrap(res);
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, is_active: !j.is_active } : j));
      toast.success(job.is_active ? "Lowongan dinonaktifkan." : "Lowongan diaktifkan.");
    } catch (err) {
      toast.error("Gagal update: " + (err?.message || ""));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.department.trim()) {
      toast.error("Judul dan departemen wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await api.patch(`/hr/job-listings/${editingId}`, form);
        const updated = unwrap(res);
        setJobs((prev) => prev.map((j) => j.id === editingId ? updated : j));
        toast.success("Lowongan berhasil diperbarui.");
      } else {
        const res = await api.post("/hr/job-listings", form);
        const created = unwrap(res);
        setJobs((prev) => [created, ...prev]);
        toast.success("Lowongan baru berhasil dibuat.");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const activeCount = jobs.filter((j) => j.is_active).length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="job-listings-page">
      <PageHeader
        icon={Briefcase}
        title="Job Listings"
        subtitle={`${activeCount} lowongan aktif ditampilkan di halaman karir publik`}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}
                    aria-label="Muat ulang" title="Muat ulang" data-testid="refresh-job-listings">
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
            <Button
              onClick={() => navigate("/hr/job-applications")}
              variant="outline"
              data-testid="view-applications-btn"
            >
              <Users />
              Lihat Lamaran
            </Button>
            <Button onClick={openCreate} data-testid="create-job-btn">
              <Plus />
              Tambah Lowongan
            </Button>
          </>
        }
      />

      {/* Job Cards */}
      {loading ? (
        <LoadingState rows={4} />
      ) : jobs.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Briefcase}
            title="Belum ada lowongan"
            description="Lowongan aktif akan tampil di halaman karir publik."
            action={<Button size="sm" onClick={openCreate}><Plus /> Tambah Lowongan</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={cn(
                "glass-card p-4 flex flex-col gap-2.5 border-l-4 transition-opacity",
                job.is_active ? "border-l-emerald-500" : "border-l-muted opacity-70"
              )}
              data-testid={`job-card-${job.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-semibold text-foreground leading-tight">{job.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.brand}</p>
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0",
                  job.is_active
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {job.is_active
                    ? <><CheckCircle className="h-3 w-3" /> Aktif</>
                    : <><XCircle className="h-3 w-3" /> Nonaktif</>
                  }
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Building className="h-3 w-3" />{job.department}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || "-"}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.job_type}</span>
              </div>

              {job.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
              )}

              <div className="text-xs text-muted-foreground">
                Dibuat: {job.created_at ? dayjs(job.created_at).format("DD MMM YYYY") : "-"}
              </div>

              {/* Actions — dorong ke bawah supaya tombol sejajar antar kartu */}
              <div className="flex gap-2 pt-1 mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(job)}
                  data-testid={`edit-job-${job.id}`}
                >
                  <Edit2 /> Ubah
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => toggleActive(job)}
                  data-testid={`toggle-job-${job.id}`}
                >
                  {job.is_active
                    ? <><ToggleRight className="text-emerald-700 dark:text-emerald-400" /> Nonaktifkan</>
                    : <><ToggleLeft /> Aktifkan</>
                  }
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl flex flex-col gap-0 p-0 overflow-hidden" data-testid="job-form-dialog">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>{editingId ? "Ubah Lowongan" : "Tambah Lowongan Baru"}</DialogTitle>
            <DialogDescription>
              Lowongan ini akan {form.is_active ? "langsung tampil" : "tersimpan tapi tidak tampil"} di halaman /careers
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="job-title">Judul Posisi *</Label>
                <Input
                  id="job-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="mis. Head Chef — The Coffeeshop"
                  data-testid="job-title-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-dept">Departemen *</Label>
                <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger id="job-dept" data-testid="job-dept-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-type">Tipe Pekerjaan</Label>
                <Select value={form.job_type} onValueChange={(v) => setForm((f) => ({ ...f, job_type: v }))}>
                  <SelectTrigger id="job-type" data-testid="job-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-brand">Brand</Label>
                <Input
                  id="job-brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="mis. The Coffeeshop"
                  data-testid="job-brand-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-location">Lokasi</Label>
                <Input
                  id="job-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="mis. Bandung Timur"
                  data-testid="job-location-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="job-description">Deskripsi Pekerjaan</Label>
              <Textarea
                id="job-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Jelaskan tanggung jawab utama posisi ini..."
                rows={3}
                className="resize-y"
                data-testid="job-description-input"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="job-requirements">Persyaratan</Label>
              <Textarea
                id="job-requirements"
                value={form.requirements}
                onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
                placeholder="Pendidikan, pengalaman, keahlian yang dibutuhkan..."
                rows={3}
                className="resize-y"
                data-testid="job-requirements-input"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="job-application-email">Email Lamaran</Label>
              <Input
                id="job-application-email"
                type="email"
                value={form.application_email}
                onChange={(e) => setForm((f) => ({ ...f, application_email: e.target.value }))}
                placeholder="hr@fnbgroup.id"
                data-testid="job-application-email-input"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="job-active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded"
                data-testid="job-active-checkbox"
              />
              <Label htmlFor="job-active" className="text-sm">
                Tampilkan di halaman karir publik (aktif)
              </Label>
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border/60">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-job-btn">
              {saving ? "Menyimpan…" : editingId ? "Simpan Perubahan" : "Buat Lowongan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
