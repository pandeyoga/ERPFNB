/** PayrollList/pdfHelper.js — PDF payslip generator. */
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

function generatePayslipPDF(cycle, empData, companyName, outlets) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
  const W = 148, ml = 12, mr = W - 12;
  let y = 15;
  const line = () => { doc.setLineWidth(0.2); doc.line(ml, y, mr, y); y += 3; };
  const gap = (n = 4) => { y += n; };
  const txt = (text, x, bold = false, size = 9) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(text), x, y);
  };
  const row = (label, value, color = false) => {
    txt(label, ml);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(fmtRp(value), mr, y, { align: "right" });
    if (color && value > 0) { doc.setTextColor(200, 50, 50); doc.text(fmtRp(value), mr, y, { align: "right" }); doc.setTextColor(0); }
    y += 5;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName || "PT. FnB Group", ml, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Slip Gaji / Payslip", ml, y);
  doc.text(`Periode: ${cycle.period || "-"}`, mr, y, { align: "right" });
  y += 3;
  line();

  // Employee info
  txt("Karyawan", ml, true, 8);
  doc.setFontSize(8); doc.text(empData.name || "-", ml + 25, y); y += 4;
  txt("NPWP", ml, false, 8);
  doc.setFontSize(8); doc.text(empData.npwp || "-", ml + 25, y); y += 4;
  txt("Status PTKP", ml, false, 8);
  doc.setFontSize(8); doc.text(empData.ptkp_status || "TK/0", ml + 25, y); y += 4;
  const outletName = outlets?.find(o => o.id === empData.outlet_id)?.name || "-";
  txt("Outlet", ml, false, 8);
  doc.setFontSize(8); doc.text(outletName, ml + 25, y); y += 3;
  line();

  // Pendapatan
  txt("PENDAPATAN", ml, true, 9); y += 5;
  row("Gaji Pokok", empData.basic);
  if (empData.allowances_total > 0) {
    (empData.allowances || []).forEach(a => { if (a.amount > 0) row(a.name || "Tunjangan", a.amount); });
  }
  if (empData.service_share > 0) row("Service Share", empData.service_share);
  if (empData.incentive_share > 0) row("Incentive", empData.incentive_share);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Total Pendapatan", ml, y);
  doc.text(fmtRp(empData.gross), mr, y, { align: "right" }); y += 3;
  line();

  // Potongan
  txt("POTONGAN", ml, true, 9); y += 5;
  if (empData.bpjs_employee > 0) {
    row("BPJS TK (JHT+JP)", (empData.bpjs_detail?.jht_employee || 0) + (empData.bpjs_detail?.jp_employee || 0));
    row("BPJS Kesehatan", empData.bpjs_detail?.jkes_employee || 0);
  }
  if (empData.pph21 > 0) row("PPh 21", empData.pph21);
  if (empData.advance_repayment > 0) row("Cicilan Kasbon", empData.advance_repayment);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Total Potongan", ml, y);
  doc.text(fmtRp(empData.deductions + (empData.advance_repayment || 0)), mr, y, { align: "right" }); y += 3;
  line();

  // Take home
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("TAKE HOME PAY", ml, y);
  doc.text(fmtRp(empData.take_home), mr, y, { align: "right" }); y += 3;
  line();

  // Footer
  gap(6);
  txt(`Doc: ${cycle.doc_no || "-"} | Digenerate: ${new Date().toLocaleDateString("id-ID")}`, ml, false, 7);
  y += 4;
  txt("Tanda Tangan HRD", ml, false, 8);
  doc.line(ml + 30, y + 2, ml + 65, y + 2);

  doc.save(`Payslip_${empData.name?.replace(/ /g, "_")}_${cycle.period}.pdf`);
}

// ── Main component ─────────────────────────────────────────────────────────────
export { generatePayslipPDF };
