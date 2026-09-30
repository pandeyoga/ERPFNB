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



import { PTKP_OPTIONS, STD_COMPONENTS } from "@/lib/payroll";
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtPct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

// ── Payslip PDF generator ──────────────────────────────────────────────────────

function PayrollDetailDialog({ pid, open, onOpenChange, outlets, canApprove, onPosted, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandBpjs, setExpandBpjs] = useState(false);
  const [cancelReason, setCancelReason] = useState(null);

  useEffect(() => {
    setCancelReason(null);
    if (!pid) { setData(null); return; }
    api.get(`/hr/payroll/${pid}`).then(r => setData(unwrap(r))).catch(() => {});
  }, [pid]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      setData(unwrap(await api.post(`/hr/payroll/${pid}/approve`)));
      toast.success("Payroll di-approve — siap di-post");
      onChanged?.();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await api.post(`/hr/payroll/${pid}/cancel`, { reason: cancelReason });
      toast.success("Payroll dibatalkan — periode bisa di-generate ulang");
      await onPosted();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

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
            {data.status === "cancelled" && (
              <Alert variant="destructive" data-testid="hr-payroll-cancelled-note">
                <AlertDescription className="text-xs">Dibatalkan: {data.cancel_reason}</AlertDescription>
              </Alert>
            )}
            {(data.warnings || []).length > 0 && (
              <Alert data-testid="hr-payroll-warnings">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs space-y-0.5">
                  {data.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </AlertDescription>
              </Alert>
            )}
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
                rows={(data.employees || []).map((e, idx) => ({
                  ...e, _idx: idx, _key: idx,
                  // legacy seeded cycles used employee_name/gross_salary
                  name: e.name ?? e.employee_name, basic: e.basic ?? e.gross_salary,
                  gross: e.gross ?? e.gross_salary,
                  allowances_total: e.allowances_total ?? (typeof e.allowances === "number" ? e.allowances : 0),
                }))}
                keyField="_key"
                rowTestIdPrefix="payroll-emp"
                className="text-xs"
                columns={[
                  { key: "name", label: "Karyawan", primary: true, render: (e) => (
                    <span className="font-medium inline-flex items-center gap-1.5">
                      {e.name}
                      {e.employment_status === "leave" && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600" data-testid={`payroll-emp-leave-${e._idx}`}>Cuti</Badge>}
                    </span>
                  ) },
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
        {cancelReason !== null && (
          <div className="space-y-1" data-testid="hr-payroll-cancel-form">
            <Label className="text-xs">Alasan pembatalan *</Label>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                   placeholder="mis. SC periode ini baru di-post, perlu generate ulang"
                   data-testid="hr-payroll-cancel-reason" />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          {canApprove && data && ["draft", "approved"].includes(data.status) && (
            cancelReason === null ? (
              <Button variant="outline" onClick={() => setCancelReason("")} className="rounded-full text-destructive"
                      data-testid="hr-payroll-detail-cancel">
                <X className="h-4 w-4 mr-2" />Batalkan
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleCancel} disabled={busy || cancelReason.trim().length < 5}
                      className="rounded-full" data-testid="hr-payroll-cancel-confirm">
                Konfirmasi Batal
              </Button>
            )
          )}
          {canApprove && data?.status === "draft" && (
            <Button onClick={handleApprove} disabled={busy} className="rounded-full"
                    data-testid="hr-payroll-detail-approve">
              <CheckCircle2 className="h-4 w-4 mr-2" />Approve
            </Button>
          )}
          {canApprove && data?.status === "approved" && (
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
