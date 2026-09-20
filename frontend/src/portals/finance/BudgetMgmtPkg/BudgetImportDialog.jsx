/** BudgetManagement/BudgetImportDialog.jsx — import budget from Excel. */
/** Budget Management — Sprint B + Sprint G (Excel import) */
import { useState, useEffect, useCallback, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES } from "./constants";

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
        toast.success(`Import berhasil: ${d.imported} baris budget`);
        onImported();
      } else {
        toast.error("Import gagal: " + (d?.errors?.[0] || "Unknown error"));
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal import");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setFile(null); setResult(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-md" data-testid="budget-import-dialog">
        <DialogHeader>
          <DialogTitle>Import Budget dari Excel</DialogTitle>
          <DialogDescription>
            Upload file Excel (.xlsx) dengan kolom: coa_code, amount, category (opsional)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Header Excel: <strong>coa_code | coa_name | amount | category</strong>.
              Category: food_cost, beverage_cost, labor_cost, rent, dll.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template Excel
          </Button>
          <div className="space-y-2">
            <Label>Periode *</Label>
            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>File Excel (.xlsx)</Label>
            <Input type="file" accept=".xlsx,.csv" ref={fileRef}
                   onChange={e => { setFile(e.target.files[0]); setResult(null); }}
                   data-testid="budget-import-file" />
          </div>
          {result && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              {result.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.imported} baris berhasil diimport untuk periode {result.period}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Import gagal
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
          <Button variant="ghost" onClick={() => { setFile(null); setResult(null); onOpenChange(false); }}>Tutup</Button>
          <Button onClick={handleImport} disabled={busy || !file} className="rounded-full"
                  data-testid="budget-import-submit">
            {busy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BudgetImportDialog;
