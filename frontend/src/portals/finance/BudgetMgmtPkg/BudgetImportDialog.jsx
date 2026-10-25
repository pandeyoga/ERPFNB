/** BudgetManagement/BudgetImportDialog.jsx — import budget from Excel. */
/** Budget Management — Sprint B + Sprint G (Excel import) */
import { useState, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";
import { toast } from "sonner";

function BudgetImportDialog({ open, onOpenChange, onImported }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const downloadTemplate = async () => {
    try {
      const r = await api.get("/budget/template-excel", { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = "budget_template.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh template");
    }
  };

  const handleImport = async () => {
    if (!file) { toast.error("Pilih file terlebih dahulu"); return; }
    if (!period) { toast.error("Pilih periode"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/budget/import-excel?period=${period}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = r.data?.data;
      setResult(d);
      if (d?.success) {
        toast.success(`Impor berhasil: ${d.imported} baris budget`);
        onImported();
      } else {
        toast.error("Impor gagal: " + (d?.errors?.[0] || "kesalahan tidak diketahui"));
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengimpor budget");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setFile(null); setResult(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-md" data-testid="budget-import-dialog">
        <DialogHeader>
          <DialogTitle>Impor Budget dari Excel</DialogTitle>
          <DialogDescription>
            Unggah file Excel (.xlsx) dengan kolom: coa_code, amount, category (opsional)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Header Excel: <strong>coa_code | coa_name | amount | category</strong>.
              Category: food_cost, beverage_cost, labor_cost, rent, dll.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate} data-testid="budget-import-template">
            <Download /> Unduh Template Excel
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="budget-import-period">Periode <span className="text-destructive">*</span></Label>
            <Input id="budget-import-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
              data-testid="budget-import-period" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-import-file">File Excel (.xlsx) <span className="text-destructive">*</span></Label>
            <Input id="budget-import-file" type="file" accept=".xlsx,.csv" ref={fileRef}
                   onChange={e => { setFile(e.target.files[0]); setResult(null); }}
                   data-testid="budget-import-file" />
          </div>
          {result && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              {result.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.imported} baris berhasil diimpor untuk periode {result.period}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Impor gagal
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs font-medium text-destructive">{result.errors.length} error:</div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} className="text-xs text-destructive">{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setFile(null); setResult(null); onOpenChange(false); }}
                  data-testid="budget-import-cancel">Batal</Button>
          <Button onClick={handleImport} disabled={busy || !file}
                  data-testid="budget-import-submit">
            {busy ? <RefreshCw className="animate-spin" /> : <Upload />}
            Impor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BudgetImportDialog;
