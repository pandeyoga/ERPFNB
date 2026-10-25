/** PayrollList/SalaryDialogs.jsx — salary master + import dialogs. */
/**
 * Payroll List — Sprint G Enhanced
 * Tabs: Siklus Payroll | Salary Master
 * Features: BPJS breakdown, PPh21, payslip PDF, salary Excel import
 */
import { useEffect, useState, useRef } from "react";
import {
  Download, Upload, RefreshCw, AlertCircle, CheckCircle2, Save, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fmtRp } from "@/lib/format";
import { validateNPWP } from "@/lib/utils";
import { toast } from "sonner";
import api, { unwrap, unwrapError } from "@/lib/api";
import { PTKP_OPTIONS, STD_COMPONENTS } from "@/lib/payroll";

function SalaryMasterDialog({ smData, outlets, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Load full salary master for employee
    api.get(`/hr/salary-master/${smData.employee_id}`)
      .then(r => {
        const d = unwrap(r);
        // Ensure standard components exist
        const existing = d?.components || [];
        const merged = ["TUNJ_JABATAN", "TUNJ_MAKAN", "TUNJ_TRANSPORT", "TUNJ_KESEHATAN"].map(code => {
          const found = existing.find(c => c.code === code);
          const std = STD_COMPONENTS.find(s => s.code === code);
          return { code, name: (found?.name || std?.name || code), amount: found?.amount ?? 0 };
        });
        setForm({
          basic_salary: d?.basic_salary ?? smData.basic_salary ?? 0,
          components: merged,
          bpjs_enrolled: d?.bpjs_enrolled ?? true,
          ptkp_status: d?.ptkp_status ?? "TK/0",
          npwp: d?.npwp ?? "",
          notes: d?.notes ?? "",
        });
      })
      .catch(() => {
        setForm({
          basic_salary: smData.basic_salary ?? 0,
          components: STD_COMPONENTS.map(s => ({ ...s })),
          bpjs_enrolled: smData.bpjs_enrolled ?? true,
          ptkp_status: smData.ptkp_status ?? "TK/0",
          npwp: smData.npwp ?? "",
          notes: "",
        });
      });
  }, [smData.employee_id]);

  const totalAllowances = (form?.components || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const totalFixed = parseFloat(form?.basic_salary || 0) + totalAllowances;

  const handleSave = async () => {
    setBusy(true);
    try {
      await api.put(`/hr/salary-master/${smData.employee_id}`, form);
      toast.success(`Salary master ${smData.employee_name} disimpan`);
      onSaved();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const updateComp = (code, val) => {
    setForm(f => ({
      ...f,
      components: f.components.map(c => c.code === code ? { ...c, amount: parseFloat(val) || 0 } : c),
    }));
  };

  if (!form) return null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg flex flex-col gap-0 p-0 overflow-hidden" data-testid="salary-master-dialog">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Salary Master — {smData.employee_name}</DialogTitle>
          <DialogDescription>
            {outlets.find(o => o.id === smData.outlet_id)?.name || "-"} · Posisi: {smData.position || "-"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
          {/* Basic Salary */}
          <div className="space-y-1">
            <Label htmlFor="sm-basic-salary">Gaji Pokok (Rp) *</Label>
            <Input id="sm-basic-salary" type="number" value={form.basic_salary}
                   onChange={e => setForm(f => ({ ...f, basic_salary: parseFloat(e.target.value) || 0 }))}
                   data-testid="basic-salary-input" />
          </div>

          {/* Allowances */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold mb-2">Tunjangan Tetap</legend>
            <div className="grid grid-cols-2 gap-3">
              {form.components.map(comp => (
                <div key={comp.code} className="space-y-1">
                  <Label htmlFor={`sm-comp-${comp.code}`}>{comp.name} (Rp)</Label>
                  <Input id={`sm-comp-${comp.code}`} type="number" value={comp.amount}
                         onChange={e => updateComp(comp.code, e.target.value)}
                         data-testid={`comp-${comp.code}`} />
                </div>
              ))}
            </div>
          </fieldset>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm border rounded-md px-3 py-2 bg-muted/30">
            <span className="text-muted-foreground">Total Gaji Tetap</span>
            <span className="font-semibold tabular-nums" data-testid="sm-total-fixed">{fmtRp(totalFixed)}</span>
          </div>

          {/* BPJS + PTKP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sm-ptkp">Status PTKP (PPh21) *</Label>
              <Select value={form.ptkp_status} onValueChange={v => setForm(f => ({ ...f, ptkp_status: v }))}>
                <SelectTrigger id="sm-ptkp" data-testid="ptkp-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PTKP_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sm-npwp">NPWP</Label>
              <Input id="sm-npwp" value={form.npwp}
                     onChange={e => setForm(f => ({ ...f, npwp: e.target.value }))}
                     placeholder="00.000.000.0-000.000"
                     data-testid="npwp-input" />
              {form.npwp && (() => {
                const v = validateNPWP(form.npwp);
                return !v.valid
                  ? <p className="text-xs text-destructive">{v.message}</p>
                  : <p className="text-xs text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Format NPWP valid</p>;
              })()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="sm-bpjs"
              checked={form.bpjs_enrolled}
              onCheckedChange={v => setForm(f => ({ ...f, bpjs_enrolled: v }))}
              data-testid="bpjs-switch"
            />
            <div>
              <Label htmlFor="sm-bpjs" className="text-sm font-medium cursor-pointer">Terdaftar BPJS</Label>
              <div className="text-xs text-muted-foreground">
                JHT 2% + JP 1% + JKes 1% = ~{fmtRp(Math.round(totalFixed * 0.04 * 100) / 100)}/bln (karyawan)
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sm-notes">Catatan</Label>
            <Input id="sm-notes" value={form.notes}
                   onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                   placeholder="Opsional..." />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t border-border/60">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={busy}
                  data-testid="save-salary-master">
            {busy ? <RefreshCw className="animate-spin" /> : <Save />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Salary Import Dialog ─────────────────────────────────────────────────────────
function SalaryImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) { toast.error("Pilih file terlebih dahulu"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/hr/salary-master/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = unwrap(r);
      setResult(d);
      toast.success(`Import selesai: ${d.imported} baru, ${d.updated} diperbarui`);
      if (d.imported + d.updated > 0) onImported();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const headers = ["employee_code", "full_name", "basic_salary", "tunjangan_jabatan", "tunjangan_makan", "tunjangan_transport", "tunjangan_kesehatan", "bpjs_enrolled", "ptkp_status", "npwp"];
    const sample = ["CFS-001", "Nama Karyawan", "4000000", "500000", "300000", "300000", "0", "true", "TK/0", ""];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "salary_master_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setFile(null); setResult(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-md" data-testid="salary-import-dialog">
        <DialogHeader>
          <DialogTitle>Impor Salary Master</DialogTitle>
          <DialogDescription>Upload file Excel (.xlsx) atau CSV dengan data gaji karyawan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Kolom: employee_code, basic_salary, tunjangan_jabatan, tunjangan_makan, tunjangan_transport, bpjs_enrolled (true/false), ptkp_status, npwp
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full" data-testid="salary-import-template">
            <Download /> Unduh Template CSV
          </Button>
          <div className="space-y-1">
            <Label htmlFor="salary-import-file">File Excel / CSV *</Label>
            <Input id="salary-import-file" type="file" accept=".xlsx,.csv" ref={fileRef}
                   onChange={e => { setFile(e.target.files[0]); setResult(null); }}
                   data-testid="salary-import-file" />
          </div>
          {result && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {result.imported} baru · {result.updated} diperbarui
              </div>
              {result.errors?.length > 0 && (
                <div className="space-y-1 mt-2">
                  <div className="text-xs font-medium text-destructive">{result.errors.length} error:</div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} className="text-xs text-destructive flex gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />{e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setFile(null); setResult(null); onOpenChange(false); }}>Tutup</Button>
          <Button onClick={handleUpload} disabled={busy || !file}
                  data-testid="salary-import-submit">
            {busy ? <RefreshCw className="animate-spin" /> : <Upload />}
            Impor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { SalaryMasterDialog, SalaryImportDialog };
