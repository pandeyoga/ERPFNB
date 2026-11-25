/** navigationSchema/ai.js — Asisten AI (percakapan, persetujuan usulan aksi, pemakaian & pengaturan).
 * Tiap seksi berisi satu halaman → sidebar & breadcrumb: "Asisten AI › Percakapan" (tanpa judul ganda). */

import { MessageSquare, ShieldCheck, Settings2 } from "lucide-react";

export const aiNav = {
  id: "ai",
  name: "Asisten AI",
  sections: [
    { id: "chat", name: "Percakapan", icon: MessageSquare, items: [{ id: "chat", name: "Percakapan", path: "/ai" }] },
    { id: "approvals", name: "Persetujuan AI", icon: ShieldCheck, items: [{ id: "approvals", name: "Persetujuan AI", path: "/ai/approvals" }] },
    { id: "settings", name: "Pemakaian & Pengaturan", icon: Settings2, items: [{ id: "settings", name: "Pemakaian & Pengaturan", path: "/ai/settings" }] },
  ],
};
