/** PayrollList/PayrollDetailDialog.jsx — payroll detail + approval dialog. */
/**
 * Payroll List — Sprint G Enhanced
 * Tabs: Siklus Payroll | Salary Master
 * Features: BPJS breakdown, PPh21, payslip PDF, salary Excel import
 */
import { useEffect, useState } from "react";
import {
  ArrowUpCircle, FileText, ChevronDown, ChevronUp, Shield,
  RefreshCw, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import api, { unwrap, unwrapError } from "@/lib/api";
import { generatePayslipPDF } from "./pdfHelper";

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
      toast.success("Payroll disetujui — siap di-posting");
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
      <DialogContent className="max-w-4xl flex flex-col gap-0 p-0 overflow-hidden" data-testid="hr-payroll-detail">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Detail Payroll</DialogTitle>
          {data && (
            <DialogDescription>
              {data.doc_no} · Period <span className="font-mono">{data.period}</span> · <StatusPill status={data.status} />
              {" "} · {outlets.find(o => o.id === data.outlet_id)?.name || "Group-wide"}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
        {!data ? (<LoadingState rows={5} />) : (
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard size="sm" label="Total Gross" value={fmtRp(data.total_gross)} testId="hr-payroll-detail-gross" />
              <CompactStatCard size="sm" label="BPJS Employee" value={fmtRp(data.total_bpjs_employee)} tone="warning" testId="hr-payroll-detail-bpjs" />
              <CompactStatCard size="sm" label="PPh 21" value={fmtRp(data.total_pph21)} tone="danger" testId="hr-payroll-detail-pph21" />
              <CompactStatCard size="sm" label="Total Take Home" value={fmtRp(data.total_take_home)} tone="success" testId="hr-payroll-detail-take-home" />
            </div>

            {/* BPJS employer summary */}
            <Button
              variant="ghost" size="sm"
              className="-ml-2 text-muted-foreground"
              onClick={() => setExpandBpjs(b => !b)}
              aria-expanded={expandBpjs}
              data-testid="hr-payroll-bpjs-employer-toggle"
            >
              <Shield />
              Kontribusi BPJS perusahaan: {fmtRp(data.total_bpjs_employer)}
              {expandBpjs ? <ChevronUp /> : <ChevronDown />}
            </Button>
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
                empty={<p className="p-4 text-sm text-muted-foreground">Belum ada karyawan pada siklus payroll ini.</p>}
                className="text-xs"
                columns={[
                  { key: "name", label: "Karyawan", primary: true, render: (e) => (
                    <span className="font-medium inline-flex items-center gap-1.5">
                      {e.name}
                      {e.employment_status === "leave" && <Badge variant="outline" className="text-[11px] border-amber-500 text-amber-600" data-testid={`payroll-emp-leave-${e._idx}`}>Cuti</Badge>}
                    </span>
                  ) },
                  { key: "basic", label: "Pokok", numeric: true, render: (e) => <span className="whitespace-nowrap">{fmtRp(e.basic)}</span> },
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
                        <Button size="icon-sm" variant="ghost"
                                aria-label={`Unduh slip gaji ${e.name || ""}`.trim()}
                                onClick={() => downloadPayslip(e)}
                                data-testid={`payslip-btn-${e._idx}`}>
                          <FileText />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Unduh slip gaji (PDF)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              />
            </div>
          </div>
        )}
        {cancelReason !== null && (
          <div className="space-y-1" data-testid="hr-payroll-cancel-form">
            <Label htmlFor="hr-payroll-cancel-reason">Alasan pembatalan * <span className="font-normal text-muted-foreground">(min. 5 karakter)</span></Label>
            <Input id="hr-payroll-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                   placeholder="mis. SC periode ini baru di-post, perlu generate ulang"
                   autoFocus
                   data-testid="hr-payroll-cancel-reason" />
          </div>
        )}
        </div>
        <DialogFooter className="px-5 py-3 border-t border-border/60 gap-2">
          <Button variant="outline" onClick={() => (cancelReason !== null ? setCancelReason(null) : onOpenChange(false))}
                  data-testid="hr-payroll-detail-close">
            {cancelReason !== null ? "Batal" : "Tutup"}
          </Button>
          {canApprove && data && ["draft", "approved"].includes(data.status) && (
            cancelReason === null ? (
              <Button variant="outline" onClick={() => setCancelReason("")} className="text-destructive hover:text-destructive"
                      data-testid="hr-payroll-detail-cancel">
                <X />Batalkan Payroll
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleCancel} disabled={busy || cancelReason.trim().length < 5}
                      data-testid="hr-payroll-cancel-confirm">
                Konfirmasi Pembatalan
              </Button>
            )
          )}
          {cancelReason === null && canApprove && data?.status === "draft" && (
            <Button onClick={handleApprove} disabled={busy}
                    data-testid="hr-payroll-detail-approve">
              <CheckCircle2 />Setujui
            </Button>
          )}
          {cancelReason === null && canApprove && data?.status === "approved" && (
            <Button onClick={handlePost} disabled={busy}
                    data-testid="hr-payroll-detail-post">
              {busy ? <><RefreshCw className="animate-spin" />Memposting…</> : <><ArrowUpCircle />Posting Payroll</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Salary Master Edit Dialog ───────────────────────────────────────────────────
export default PayrollDetailDialog;
