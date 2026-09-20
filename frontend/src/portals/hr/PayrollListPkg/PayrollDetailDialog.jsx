/** PayrollList/PayrollDetailDialog.jsx — payroll detail + approval dialog. */
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
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";
import { validateNPWP } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import api, { unwrap, unwrapError } from "@/lib/api";
import useOutletScope from "@/hooks/useOutletScope";
import { Tile } from "./SalaryDialogs";
import { generatePayslipPDF } from "./pdfHelper";

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

function PayrollDetailDialog({ pid, open, onOpenChange, outlets, canApprove, onPosted }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandBpjs, setExpandBpjs] = useState(false);

  useEffect(() => {
    if (!pid) { setData(null); return; }
    api.get(`/hr/payroll/${pid}`).then(r => setData(unwrap(r))).catch(() => {});
  }, [pid]);

  const handlePost = async () => {
    setBusy(true);
    try {
      await api.post(`/hr/payroll/${pid}/post`);
      toast.success("Payroll posted (advance schedule auto-paid)");
      await onPosted();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const downloadPayslip = (empData) => {
    if (!data) return;
    generatePayslipPDF(data, empData, undefined, outlets);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="hr-payroll-detail">
        <DialogHeader>
          <DialogTitle>Payroll Detail</DialogTitle>
          {data && (
            <DialogDescription>
              {data.doc_no} · Period <span className="font-mono">{data.period}</span> · <StatusPill status={data.status} />
              {" "} · {outlets.find(o => o.id === data.outlet_id)?.name || "Group-wide"}
            </DialogDescription>
          )}
        </DialogHeader>
        {!data ? (<LoadingState rows={5} />) : (
          <div className="space-y-4">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Tile label="Total Gross" value={fmtRp(data.total_gross)} />
              <Tile label="BPJS Employee" value={fmtRp(data.total_bpjs_employee)} accent="amber" />
              <Tile label="PPh 21" value={fmtRp(data.total_pph21)} accent="red" />
              <Tile label="Total Take Home" value={fmtRp(data.total_take_home)} highlight />
            </div>

            {/* BPJS employer summary */}
            <button
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpandBpjs(b => !b)}
            >
              <Shield className="h-3.5 w-3.5" />
              BPJS Employer Contribution: {fmtRp(data.total_bpjs_employer)}
              {expandBpjs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expandBpjs && (
              <Alert>
                <AlertDescription className="text-xs">
                  JKK 0.54% + JKM 0.30% + JHT 3.70% + JP 2.00% + JKes 4.00% = total <strong>{fmtRp(data.total_bpjs_employer)}</strong> beban perusahaan (tidak dipotong dari karyawan).
                </AlertDescription>
              </Alert>
            )}

            {/* Per-employee table */}
            <div className="glass-card overflow-hidden">
              <DataTable
                rows={(data.employees || []).map((e, idx) => ({ ...e, _idx: idx, _key: idx }))}
                keyField="_key"
                rowTestIdPrefix="payroll-emp"
                className="text-xs"
                columns={[
                  { key: "name", label: "Karyawan", primary: true, render: (e) => <span className="font-medium">{e.name}</span> },
                  { key: "basic", label: "Pokok", numeric: true, render: (e) => fmtRp(e.basic) },
                  { key: "allowances_total", label: "Tunj.", numeric: true, render: (e) => <span className="text-muted-foreground">{fmtRp(e.allowances_total)}</span> },
                  { key: "sc_inc", label: "SC+Inc", numeric: true, render: (e) => <span className="text-muted-foreground">{fmtRp((e.service_share || 0) + (e.incentive_share || 0))}</span> },
                  { key: "gross", label: "Gross", numeric: true, render: (e) => <span className="font-medium">{fmtRp(e.gross)}</span> },
                  { key: "bpjs_employee", label: "BPJS", numeric: true, render: (e) => <span className="text-amber-600">{fmtRp(e.bpjs_employee)}</span> },
                  { key: "pph21", label: "PPh21", numeric: true, render: (e) => <span className="text-red-500">{fmtRp(e.pph21)}</span> },
                  { key: "advance_repayment", label: "Kasbon", numeric: true, render: (e) => <span className="text-muted-foreground">{fmtRp(e.advance_repayment)}</span> },
                  { key: "take_home", label: "Take Home", numeric: true, render: (e) => <span className="font-bold">{fmtRp(e.take_home)}</span> },
                ]}
                rowAction={(e) => (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                                aria-label="Download payslip"
                                onClick={() => downloadPayslip(e)}
                                data-testid={`payslip-btn-${e._idx}`}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download Payslip PDF</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          {canApprove && data && data.status !== "posted" && (
            <Button onClick={handlePost} disabled={busy} className="rounded-full"
                    data-testid="hr-payroll-detail-post">
              {busy ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Posting…</> : <><ArrowUpCircle className="h-4 w-4 mr-2" />Post Payroll</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Salary Master Edit Dialog ───────────────────────────────────────────────────
export default PayrollDetailDialog;
