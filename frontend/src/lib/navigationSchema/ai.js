/** navigationSchema/ai.js — Asisten AI (percakapan, persetujuan usulan aksi, pemakaian & pengaturan).
 * Tiap seksi berisi satu halaman → sidebar & breadcrumb: "Asisten AI › Percakapan" (tanpa judul ganda). */

import { MessageSquare, ShieldCheck, Settings2, LayoutDashboard, FileUp } from "lucide-react";

export const aiNav = {
  id: "ai",
  name: "Asisten AI",
  sections: [
    { id: "chat", name: "Percakapan", icon: MessageSquare, items: [{ id: "chat", name: "Percakapan", path: "/ai" }] },
    { id: "dashboard", name: "Dashboard AI", icon: LayoutDashboard, items: [{ id: "dashboard", name: "Dashboard AI", path: "/ai/dashboard" }] },
    { id: "import", name: "Impor Cerdas", icon: FileUp, items: [{ id: "import", name: "Impor Cerdas", path: "/ai/import" }] },
    { id: "approvals", name: "Persetujuan AI", icon: ShieldCheck, items: [{ id: "approvals", name: "Persetujuan AI", path: "/ai/approvals" }] },
    { id: "settings", name: "Pemakaian & Pengaturan", icon: Settings2, items: [{ id: "settings", name: "Pemakaian & Pengaturan", path: "/ai/settings" }] },
  ],
};
