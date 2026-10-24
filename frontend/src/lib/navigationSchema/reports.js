/** navigationSchema/reports.js — Report Center (katalog laporan Excel lintas modul). */

import { FileSpreadsheet } from "lucide-react";

export const reportsNav = {
  id: "reports",
  name: "Report Center",
  sections: [
    {
      id: "catalog",
      name: "Report Center",
      icon: FileSpreadsheet,
      items: [
        // Tiap laporan (/reports/daily-sales, …) dibuka dari katalog; matchPaths membuat
        // item ini tetap aktif di sidebar & breadcrumb saat membuka laporan.
        { id: "catalog", name: "Report Center", path: "/reports", matchPaths: ["/reports"] },
      ],
    },
  ],
};
