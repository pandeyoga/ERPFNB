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
  name: "Approval Center",
  description: "Inbox persetujuan terpusat + delegasi untuk semua dokumen.",
  steps: [
    {
      target: "[data-testid='approval-center']",
      title: "Approval Center",
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
        "Kartu KPI per tipe dokumen — klik salah satu untuk **filter cepat** antrean ke jenis tertentu.",
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
        "Kartu statistik per tipe dokumen. Klik untuk **filter cepat** antrean ke jenis tertentu.",
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


export { generalNavigationTour, approvalCenterTour, myApprovalsTour };
