/** PayrollList/PayrollFormDialog.jsx — create payroll run dialog. */
/**
 * Payroll List — Sprint G Enhanced
 * Tabs: Siklus Payroll | Salary Master
 * Features: BPJS breakdown, PPh21, payslip PDF, salary Excel import
 */
import { useState } from "react";
import { RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import api, { unwrapError } from "@/lib/api";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PayrollFormDialog({ open, onOpenChange, outlets, onCreated }) {
  const [form, setForm] = useState({ period: currentPeriod(), outlet_id: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post("/hr/payroll", {
        period: form.period,
        outlet_id: form.outlet_id || undefined,
      });
      toast.success("Payroll cycle dibuat (draft) — BPJS & PPh21 dihitung otomatis");
      await onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-payroll-form-dialog">
        <DialogHeader>
          <DialogTitle>Generate Payroll Cycle</DialogTitle>
          <DialogDescription>Auto-konsolidasi gaji + tunjangan + service + incentive − kasbon − BPJS − PPh21.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              BPJS (JHT 2%+JP 1%+JKes 1%) dan PPh21 (jika diaktifkan) akan dihitung otomatis dari Salary Master.
            </AlertDescription>
          </Alert>
          <div className="space-y-1">
            <Label htmlFor="hr-payroll-period">Periode *</Label>
            <Input id="hr-payroll-period" type="month" value={form.period}
                    onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                    data-testid="hr-payroll-period" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr-payroll-outlet">Outlet</Label>
            <Select value={form.outlet_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "all" ? "" : v }))}>
              <SelectTrigger id="hr-payroll-outlet" data-testid="hr-payroll-outlet"><SelectValue placeholder="— Group-wide —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Group-wide —</SelectItem>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting}
                  data-testid="hr-payroll-submit">
            {submitting ? <><RefreshCw className="animate-spin" />Memproses…</> : "Buat Payroll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payroll Detail Dialog ───────────────────────────────────────────────────────
export default PayrollFormDialog;
