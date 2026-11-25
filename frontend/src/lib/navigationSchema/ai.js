/** navigationSchema/ai.js — Asisten AI, dikelompokkan per kebutuhan: percakapan, analisis, data masuk, otomasi,
 * pengetahuan, pengaturan. Item hanya tampil bila guard route-nya lolos (canOpenPath). */

import { MessageSquare, LayoutDashboard, FileInput, Workflow, BookMarked, Settings2 } from "lucide-react";

export const aiNav = {
  id: "ai",
  name: "Asisten AI",
  sections: [
    { id: "chat", name: "Percakapan", icon: MessageSquare, items: [
      { id: "chat", name: "Percakapan", path: "/ai" },
      { id: "approvals", name: "Persetujuan AI", path: "/ai/approvals" },
    ] },
    { id: "analysis", name: "Analisis & Laporan", icon: LayoutDashboard, items: [
      { id: "dashboard", name: "Dashboard AI", path: "/ai/dashboard" },
      { id: "documents", name: "Dokumen AI", path: "/ai/documents" },
    ] },
    { id: "data-in", name: "Data Masuk", icon: FileInput, items: [
      { id: "import", name: "Impor Cerdas", path: "/ai/import" },
      { id: "data-quality", name: "Kualitas Data", path: "/ai/data-quality" },
    ] },
    { id: "automation", name: "Otomasi", icon: Workflow, items: [
      { id: "automations", name: "Monitor & Otomasi", path: "/ai/automations" },
      { id: "whatsapp", name: "WhatsApp", path: "/ai/whatsapp" },
    ] },
    { id: "knowledge", name: "Memori & Pengetahuan", icon: BookMarked, items: [
      { id: "knowledge", name: "Memori & Pengetahuan", path: "/ai/knowledge" },
    ] },
    { id: "settings", name: "Pemakaian & Pengaturan", icon: Settings2, items: [
      { id: "settings", name: "Pemakaian & Pengaturan", path: "/ai/settings" },
    ] },
  ],
};
