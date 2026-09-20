/** PayrollList/PayrollFormDialog.jsx — create payroll run dialog. */
/**
 * Payroll List — Sprint G Enhanced
 * Tabs: Siklus Payroll | Salary Master
 * Features: BPJS breakdown, PPh21, payslip PDF, salary Excel import
 */
import { useEffect, useState, useRef } from "react";
import {
  Plus, CalendarClock, ArrowUpCircle, FileText, Download,
  Upload, Users, ChevronDown, ChevronUp, Wallet, Shield,
  RefreshCw, AlertCircle, CheckCircle2, FileSpreadsheet, Edit3,
  Save, X, Info
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp, fmtDate } from "@/lib/format";
import { validateNPWP } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api, { unwrap, unwrapError } from "@/lib/api";
import useOutletScope from "@/hooks/useOutletScope";

const PTKP_OPTIONS = [
  "TK/0", "TK/1", "TK/2", "TK/3",
  "K/0", "K/1", "K/2", "K/3",
  "K/I/0", "K/I/1", "K/I/2", "K/I/3",
];

const STD_COMPONENTS = [
  { code: "TUNJ_JABATAN", name: "Tunjangan Jabatan" },
  { code: "TUNJ_MAKAN", name: "Tunjangan Makan" },
  { code: "TUNJ_TRANSPORT", name: "Tunjangan Transport" },
  { code: "TUNJ_KESEHATAN", name: "Tunjangan Kesehatan" },
];

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtPct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

// ── Payslip PDF generator ──────────────────────────────────────────────────────

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
            <Label>Period *</Label>
            <Input type="month" value={form.period}
                    onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                    data-testid="hr-payroll-period" />
          </div>
          <div className="space-y-1">
            <Label>Outlet</Label>
            <Select value={form.outlet_id || "all"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "all" ? "" : v }))}>
              <SelectTrigger data-testid="hr-payroll-outlet"><SelectValue placeholder="— Group-wide —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Group-wide —</SelectItem>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-payroll-submit">
            {submitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating…</> : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payroll Detail Dialog ───────────────────────────────────────────────────────
export default PayrollFormDialog;
