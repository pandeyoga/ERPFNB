/** PayrollList/index.jsx — payroll list orchestrator. */
/**
 * Payroll List — Sprint G Enhanced
 * Tabs: Siklus Payroll | Salary Master
 * Features: BPJS breakdown, PPh21, payslip PDF, salary Excel import
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, CalendarClock, ArrowUpCircle, Upload, Users, CheckCircle2, Edit3, X, Download,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import { InlineHelp } from "@/components/shared/InlineHelp";
import { fmtRp } from "@/lib/format";
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

// ── Payslip PDF generator ──────────────────────────────────────────────────────
import { generatePayslipPDF } from "./pdfHelper";
import PayrollFormDialog from "./PayrollFormDialog";
import PayrollDetailDialog from "./PayrollDetailDialog";
import { SalaryMasterDialog, SalaryImportDialog } from "./SalaryDialogs";
import useExcelExport from "@/hooks/useExcelExport";

export default function PayrollList() {
  const { user } = useAuth();
  const { allOutlets: outlets } = useOutletScope();
  const [tab, setTab] = useState("cycles");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editSm, setEditSm] = useState(null); // employee data being edited
  const [importOpen, setImportOpen] = useState(false);

  const canApprove = (user?.permissions || []).includes("hr.advance.approve")
    || (user?.permissions || []).includes("*");
  const { downloading, exportXlsx } = useExcelExport();

  // Payroll cycles — always loaded
  const {
    data: items = [],
    isLoading: loading,
    refetch: refetchCycles,
  } = useQuery({
    queryKey: ["hr", "payroll-cycles", { per_page: 30 }],
    queryFn: async () => {
      const r = await api.get("/hr/payroll", { params: { per_page: 30 } });
      return unwrap(r) || [];
    },
    staleTime: 30 * 1000,
  });

  // Salary masters — only loaded when on "salary" tab
  const {
    data: salaryMasters = [],
    isLoading: smLoading,
    refetch: refetchSalaryMasters,
  } = useQuery({
    queryKey: ["hr", "salary-master", { per_page: 200 }],
    queryFn: async () => {
      try {
        const r = await api.get("/hr/salary-master", { params: { per_page: 200 } });
        return unwrap(r) || [];
      } catch (e) {
        toast.error(unwrapError(e));
        throw e;
      }
    },
    enabled: tab === "salary",
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-4" data-testid="hr-payroll-page">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="cycles" className="gap-2">
                <CalendarClock className="h-4 w-4" /> Siklus Payroll
              </TabsTrigger>
              <TabsTrigger value="salary" className="gap-2">
                <Users className="h-4 w-4" /> Salary Master
              </TabsTrigger>
            </TabsList>
            {tab === "cycles" && <InlineHelp id="hr-payroll-cycles" size="sm" />}
            {tab === "salary" && <InlineHelp id="hr-salary-master" size="sm" />}
          </div>
          <div className="flex gap-2">
            {tab === "cycles" && canApprove && (
              <Button onClick={() => setShowForm(true)} className="rounded-full" data-testid="hr-payroll-create">
                <Plus className="h-4 w-4 mr-2" /> Generate Payroll
              </Button>
            )}
            {tab === "cycles" && (
              <Button
                variant="outline"
                onClick={() => exportXlsx("/hr/payroll/export/xlsx", "payroll_cycles.xlsx")}
                disabled={downloading}
                className="rounded-full gap-2"
                data-testid="hr-payroll-export-xlsx"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Mengunduh..." : "Export Excel"}
              </Button>
            )}
            {tab === "salary" && canApprove && (
              <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-full" data-testid="salary-import-btn">
                <Upload className="h-4 w-4 mr-2" /> Import Excel/CSV
              </Button>
            )}
          </div>
        </div>

        {/* ─── Cycles Tab ─── */}
        <TabsContent value="cycles" className="mt-4">
          <div className="text-sm text-muted-foreground mb-3">
            Payroll cycle bulanan — gaji + service share + incentive − kasbon − BPJS − PPh21.
          </div>
          {loading ? (
            <LoadingState rows={5} />
          ) : items.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Belum ada payroll cycle"
              description="Generate payroll bulanan untuk membuat draft, lalu post ke jurnal." />
          ) : (
            <div className="glass-card overflow-hidden">
              <DataTable
                rows={items}
                keyField="id"
                rowTestIdPrefix="hr-payroll-row"
                onRowClick={(it) => setDetailId(it.id)}
                columns={[
                  { key: "doc_no", label: "Doc No", primary: true, render: (it) => <span className="font-mono text-xs">{it.doc_no}</span> },
                  { key: "period", label: "Period", render: (it) => <span className="font-mono">{it.period}</span> },
                  { key: "outlet", label: "Outlet", render: (it) => <span className="text-sm">{outlets.find(o => o.id === it.outlet_id)?.name || "Group-wide"}</span> },
                  { key: "total_gross", label: "Gross", numeric: true, sortable: true, render: (it) => <span className="text-sm">{fmtRp(it.total_gross)}</span> },
                  { key: "total_bpjs_employee", label: "BPJS", numeric: true, render: (it) => <span className="text-xs text-amber-600">{it.total_bpjs_employee ? fmtRp(it.total_bpjs_employee) : "-"}</span> },
                  { key: "total_pph21", label: "PPh21", numeric: true, render: (it) => <span className="text-xs text-red-500">{it.total_pph21 ? fmtRp(it.total_pph21) : "-"}</span> },
                  { key: "total_take_home", label: "Take Home", numeric: true, sortable: true, render: (it) => <span className="font-semibold">{fmtRp(it.total_take_home)}</span> },
                  { key: "status", label: "Status", align: "center", render: (it) => <StatusPill status={it.status} /> },
                ]}
                rowAction={(it) => (
                  canApprove && it.status !== "posted" ? (
                    <Button size="sm" variant="default" className="rounded-full"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await api.post(`/hr/payroll/${it.id}/post`);
                          toast.success("Payroll di-post");
                          await refetchCycles();
                        } catch (err) { toast.error(unwrapError(err)); }
                      }}
                      data-testid={`hr-payroll-post-${it.id}`}>
                      <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Post
                    </Button>
                  ) : null
                )}
              />
            </div>
          )}
        </TabsContent>

        {/* ─── Salary Master Tab ─── */}
        <TabsContent value="salary" className="mt-4">
          <div className="text-sm text-muted-foreground mb-3">
            Konfigurasi komponen gaji per karyawan: gaji pokok, tunjangan, BPJS, dan status PTKP untuk PPh21.
          </div>
          {smLoading ? (
            <LoadingState rows={5} />
          ) : salaryMasters.length === 0 ? (
            <EmptyState icon={Users} title="Belum ada salary master"
              description="Klik karyawan untuk mengatur gaji pokok, tunjangan, dan BPJS." />
          ) : (
            <div className="glass-card overflow-hidden">
              <DataTable
                rows={salaryMasters}
                keyField="employee_id"
                rowTestIdPrefix="salary-master-row"
                columns={[
                  { key: "employee_name", label: "Karyawan", primary: true, render: (sm) => (
                    <div>
                      <div className="font-medium text-sm">{sm.employee_name}</div>
                      <div className="text-xs text-muted-foreground">{sm.employee_code}</div>
                    </div>
                  ) },
                  { key: "outlet", label: "Outlet", render: (sm) => <span className="text-sm">{outlets.find(o => o.id === sm.outlet_id)?.name || "-"}</span> },
                  { key: "basic_salary", label: "Gaji Pokok", numeric: true, sortable: true, render: (sm) => fmtRp(sm.basic_salary) },
                  { key: "allowances_total", label: "Tunjangan", numeric: true, render: (sm) => <span className="text-sm">{fmtRp(sm.allowances_total)}</span> },
                  { key: "bpjs_employee", label: "BPJS (EE)", numeric: true, render: (sm) => <span className="text-xs text-amber-600">{fmtRp(sm.bpjs_employee)}</span> },
                  { key: "pph21_monthly", label: "PPh21/bln", numeric: true, render: (sm) => <span className="text-xs text-red-500">{fmtRp(sm.pph21_monthly)}</span> },
                  { key: "ptkp_status", label: "PTKP", align: "center", render: (sm) => <Badge variant="outline" className="text-xs">{sm.ptkp_status}</Badge> },
                  { key: "bpjs_enrolled", label: "BPJS", align: "center", render: (sm) => sm.bpjs_enrolled
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                    : <X className="h-4 w-4 text-muted-foreground mx-auto" /> },
                ]}
                rowAction={(sm) => (
                  canApprove ? (
                    <Button size="sm" variant="ghost" onClick={() => setEditSm(sm)} data-testid={`edit-sm-${sm.employee_id}`}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null
                )}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PayrollFormDialog open={showForm} onOpenChange={setShowForm}
        outlets={outlets} onCreated={async () => { setShowForm(false); await refetchCycles(); }} />
      <PayrollDetailDialog pid={detailId} open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        outlets={outlets} canApprove={canApprove}
        onPosted={async () => { setDetailId(null); await refetchCycles(); }} />
      {editSm && (
        <SalaryMasterDialog smData={editSm} outlets={outlets}
          onClose={() => setEditSm(null)}
          onSaved={() => { setEditSm(null); refetchSalaryMasters(); }} />
      )}
      <SalaryImportDialog open={importOpen} onOpenChange={setImportOpen}
        onImported={() => { setImportOpen(false); refetchSalaryMasters(); }} />
    </div>
  );
}

// ── Payroll Form Dialog ─────────────────────────────────────────────────────────