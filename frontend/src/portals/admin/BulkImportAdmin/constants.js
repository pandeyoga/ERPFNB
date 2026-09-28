/** BulkImport/constants.js — entity configs, step labels, helpers. */
/**
 * Bulk Excel Import - Admin Master Data Import
 *
 * Flow:
 * 1. Select entity type (Items/Vendors/Employees/COA/Customers)
 * 2. Download template Excel
 * 3. Upload filled Excel file
 * 4. Preview validation results (valid/invalid rows)
 * 5. Commit import (upsert to database)
 * 6. Show result summary
 *
 * Sprint D enhancements:
 * - Download Error CSV/XLSX button for invalid rows
 * - Max rows guardrail display
 * - Improved error display with field-level detail
 */
import { useState, useEffect, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Package, Users, Briefcase, BookOpen, UserCheck,
  Loader2, FileText, ChevronRight, Info, RotateCcw, FileDown,
  ArrowRight, ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import api from "@/lib/api";


const ENTITY_ICONS = {
  items:     Package,
  vendors:   Briefcase,
  employees: Users,
  coa:       BookOpen,
  customers: UserCheck,
};

const ENTITY_COLORS = {
  items:     "from-blue-500/15 to-cyan-500/15 text-blue-600",
  vendors:   "from-purple-500/15 to-violet-500/15 text-purple-600",
  employees: "from-green-500/15 to-emerald-500/15 text-green-600",
  coa:       "from-amber-500/15 to-yellow-500/15 text-amber-600",
  customers: "from-rose-500/15 to-pink-500/15 text-rose-600",
};

const STEP_LABELS = ["Pilih Entity", "Download Template", "Upload & Preview", "Commit Import", "Selesai"];
const MAX_ROWS = 1000;

/** Export invalid rows as CSV string and trigger download */
function downloadErrorCSV(entityLabel, invalidRows) {
  if (!invalidRows?.length) return;
  const headers = ["Row #", "Errors", ...Object.keys(invalidRows[0].data)];
  const csvRows = [
    headers.join(","),
    ...invalidRows.map(row =>
      [
        row.row_num,
        `"${row.errors.join("; ")}"`  ,
        ...headers.slice(2).map(h => `"${row.data[h] ?? ""}"`),
      ].join(",")
    ),
  ];
  const csv = csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `errors_${entityLabel.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


export { ENTITY_ICONS, ENTITY_COLORS, STEP_LABELS, MAX_ROWS, downloadErrorCSV };
