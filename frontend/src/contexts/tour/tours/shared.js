/** Shared / general navigation tour definitions. */

const generalNavigationTour = {
  name: "Navigasi Umum — ERP Portal",
  description: "Kenali komponen UI umum di seluruh sistem.",
  steps: [
    {
      target: "body",
      title: "Selamat datang di FnB Group ERP",
      content:
        "Sistem ERP multi-brand untuk FnB Group. Mari kenali komponen UI utama.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='logo-home-button']",
      title: "Logo & Beranda",
      content:
        "Klik **logo** untuk kembali ke Beranda — landing modul terakhir yang Anda buka. Semua modul lain tersedia di sidebar kiri.",
      placement: "bottom",
    },
    {
      target: "[data-testid='open-global-search']",
      title: "Global Search",
      content:
        "Tekan **⌘K** atau klik di sini untuk cari items, vendors, employees, transaksi (PR/PO/PAY/JAE doc no). Sangat powerful!",
      placement: "bottom",
    },
    {
      target: "[data-testid='help-tour-button']",
      title: "Help & Tour",
      content:
        "Tombol ini — kapan saja butuh panduan, klik di sini untuk mulai tour relevan dengan halaman aktif.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ============================================================
// APPROVAL CENTER (shared across all portals — /{portal}/approvals)
// ============================================================
const approvalCenterTour = {
  name: "Pusat Persetujuan",
  description: "Inbox persetujuan terpusat + delegasi untuk semua dokumen.",
  steps: [
    {
      target: "[data-testid='approval-center']",
      title: "Pusat Persetujuan",
      content:
        "**Satu inbox** untuk semua dokumen yang menunggu persetujuan Anda (PR, PO, Payment, Journal, Budget, dll) lintas modul.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='approval-kpi']",
      title: "Ringkasan per Tipe",
      content:
        "Tab per tipe dokumen beserta jumlahnya — klik salah satu untuk **filter cepat** antrean ke jenis tertentu.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-queue']",
      title: "Antrean Persetujuan",
      content:
        "Tab **Queue** berisi item menunggu. Approve/Reject langsung; reject wajib isi alasan untuk jejak audit.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-delegation']",
      title: "Delegasi",
      content:
        "Akan cuti? Buat **delegasi** agar approval Anda dialihkan ke rekan untuk periode tertentu.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ============================================================
// MY APPROVALS (rendered at /approvals & /{portal}/approvals)
// ============================================================
const myApprovalsTour = {
  name: "My Approvals",
  description: "Inbox persetujuan personal — approve/reject cepat tanpa buka detail.",
  steps: [
    {
      target: "[data-testid='my-approvals-page']",
      title: "My Approvals",
      content:
        "**Satu inbox** untuk semua dokumen yang menunggu keputusan Anda (PR, PO, Payment, Journal, Budget) lintas modul.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='stat-total']",
      title: "Filter per Tipe",
      content:
        "Tab per tipe dokumen beserta jumlahnya. Klik untuk **filter cepat** antrean ke jenis tertentu.",
      placement: "bottom",
    },
    {
      target: "[data-testid='my-approvals-refresh']",
      title: "Refresh",
      content:
        "Muat ulang antrean. Di mobile, **swipe ← →** pada kartu untuk approve/reject; reject wajib isi alasan (jejak audit).",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ============================================================
// EXPORT REGISTRY
// ============================================================


// ============================================================
// ASISTEN AI (/ai + panel di TopNav)
// ============================================================
const aiAssistantTour = {
  name: "Asisten AI",
  description: "Tanya, analisis, baca foto/PDF/Excel, dan minta AI menyiapkan aksi yang Anda setujui.",
  steps: [
    {
      target: "[data-testid='ai-chat-page']",
      title: "Asisten AI",
      content:
        "AI membaca data **sesuai izin Anda** di semua modul, bisa mencari di web, dan menyiapkan aksi (buat/ubah/hapus) yang **selalu menunggu persetujuan** Anda.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='ai-input']",
      title: "Tulis permintaan",
      content:
        "Contoh: *Bandingkan sales per toko minggu ini vs lalu*, *Buat PO dari PR-2611-0004*, *Bagaimana cara tutup buku?*. Konteks brand/toko di TopNav ikut terkirim.",
      placement: "top",
    },
    {
      target: "[data-testid='ai-attach']",
      title: "Lampiran",
      content: "Lampirkan **foto struk/invoice, PDF, atau Excel/CSV** — AI membaca isinya (OCR) lalu bisa menyiapkan jurnal atau entri data.",
      placement: "top",
      variant: "tip",
    },
    {
      target: "[data-testid='ai-session-list']",
      title: "Riwayat percakapan",
      content: "Percakapan tersimpan di sini dan sama dengan panel **Asisten AI** (ikon robot di kanan atas) yang bisa dibuka dari halaman mana pun.",
      placement: "right",
    },
  ],
};

export { generalNavigationTour, approvalCenterTour, myApprovalsTour, aiAssistantTour };
