/** Owner portal tour definitions — Full coverage.
 * Phase D Hardening: replaced body targets with stable data-testid anchors.
 */

// ─── Owner Home ────────────────────────────────────────────────────
const ownerHomeTour = {
  name: "Owner Cockpit",
  description: "Cash, profit walk, approvals — semua di satu layar.",
  steps: [
    {
      target: "[data-testid='owner-cockpit-page']",
      title: "Owner Cockpit",
      content: "Dashboard khusus pemilik: **cash position, profit walk, period compare, approvals**. Dioptimalkan untuk penggunaan mobile.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='owner-kpi-row']",
      title: "KPI Summary",
      content: "KPI kritis harian: **Sales Hari Ini**, **Cash Total**, **Pending Approvals**, **Anomalies**. Klik untuk drill-down.",
      placement: "bottom",
    },
    {
      target: "[data-testid='owner-mid-row']",
      title: "Quick Shortcuts",
      content: "Akses cepat ke modul yang paling sering digunakan owner:\n\n\u2022 **Cash Position** — posisi kas sekarang\n\u2022 **My Approvals** — approve PR/PO/Payment\n\u2022 **AI Assistant** — tanya AI tentang bisnis\n\u2022 **Daily Briefing** — ringkasan otomatis pagi hari",
      placement: "top",
    },
    {
      target: "[data-testid='owner-bottom-row']",
      title: "Full Analytics",
      content: "Klik **Full Analytics** untuk masuk ke Executive Dashboard dengan view lebih lengkap dan filter yang lebih detail.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Owner Cash Position ─────────────────────────────────────────────────
const ownerCashPositionTour = {
  name: "Cash Position",
  description: "Lihat posisi kas total group dan proyeksi ke depan.",
  steps: [
    {
      target: "[data-testid='cash-position-page']",
      title: "Cash Position",
      content: "Posisi **kas group** secara real-time: Bank + Petty Cash semua outlet. Monitor apakah ada cash crunch dalam waktu dekat.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='cash-kpi-strip']",
      title: "Komposisi Kas",
      content: "\u2022 **Bank** — saldo rekening perusahaan\n\u2022 **Petty Cash** — kas kecil di tiap outlet\n\u2022 **E-Wallet** — GoPay/OVO/QRIS business\n\nTotal otomatis diupdate dari payment + daily close.",
      placement: "bottom",
    },
    {
      target: "[data-testid='cash-kpi-runway']",
      title: "Proyeksi Kas",
      content: "Proyeksi arus kas berdasarkan **AP jatuh tempo** dan **penerimaan expected**. Flag merah = potensi cash crunch dalam 7 hari.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Owner Approvals ─────────────────────────────────────────────────
const ownerApprovalsTour = {
  name: "My Approvals — Setujui dari Mobile",
  description: "Approve PR, PO, dan Payment Request langsung dari perangkat mobile.",
  steps: [
    {
      target: "[data-testid='owner-cockpit-page']",
      title: "My Approvals",
      content: "Semua **request yang menunggu approval** dari Owner. Tersedia di mobile untuk approve kapan saja, dari mana saja.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='owner-kpi-row']",
      title: "Prioritas Approval",
      content: "\u2022 \ud83d\udd34 **Merah** — sudah >2 hari atau nilai >50 juta\n\u2022 \ud83d\udfe1 **Kuning** — >1 hari atau nilai 10–50 juta\n\u2022 \ud83d\udfe2 **Hijau** — baru, nilai normal",
      placement: "bottom",
    },
    {
      target: "[data-testid='owner-mid-row']",
      title: "Approve & Reject",
      content: "Klik **Approve** atau **Reject** langsung dari daftar. Bisa tambah catatan jika reject. Owner mendapat notifikasi Telegram otomatis untuk item urgent.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Owner Daily Briefing ─────────────────────────────────────────────────
const ownerBriefingTour = {
  name: "Daily Briefing AI",
  description: "Ringkasan bisnis harian otomatis dengan AI analysis.",
  steps: [
    {
      target: "[data-testid='daily-briefing-page']",
      title: "Daily Briefing",
      content: "**Ringkasan bisnis harian** yang di-generate AI setiap pagi. Mencakup: sales kemarin, anomali, pending approvals, dan rekomendasi tindakan.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='briefing-hero']",
      title: "Isi Briefing",
      content: "\u2022 **Sales Summary** — total sales per brand/outlet\n\u2022 **Key Highlights** — performa terbaik dan terburuk\n\u2022 **Anomali** — hal-hal yang perlu perhatian\n\u2022 **Approvals Pending** — yang harus diselesaikan hari ini",
      placement: "bottom",
    },
    {
      target: "[data-testid='briefing-text']",
      title: "Delivery via Telegram",
      content: "Briefing otomatis dikirim ke **Telegram** setiap jam 07.00 WIB. Konfigurasi di Admin > Integrations > Telegram.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Owner AI Assistant ───────────────────────────────────────────────────
const ownerAIAssistantTour = {
  name: "Business Q&A — AI Assistant",
  description: "Tanya apapun tentang bisnis dalam Bahasa Indonesia.",
  steps: [
    {
      target: "[data-testid='exec-qa']",
      title: "Business Q&A",
      content: "Tanya apapun tentang bisnis dalam **Bahasa Indonesia**. AI akan menjawab berdasarkan data real-time ERP.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='exec-qa-suggest-0']",
      title: "Contoh Pertanyaan",
      content: "\u2022 'Kemarin sales The Coffeeshop berapa?'\n\u2022 'Siapa karyawan dengan kasbon terbanyak?'\n\u2022 'Stok bahan baku mana yang kritis?'\n\u2022 'Profit bulan ini vs bulan lalu?'\n\u2022 'Berapa AP yang jatuh tempo minggu ini?'",
      placement: "bottom",
    },
    {
      target: "[data-testid='exec-qa-input']",
      title: "Mulai Bertanya",
      content: "Ketik pertanyaan bisnis Anda. AI mendukung pertanyaan kontekstual (follow-up dari jawaban sebelumnya).",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Owner Digest Settings ────────────────────────────────────────────
const ownerDigestSettingsTour = {
  name: "Pengaturan Daily Briefing",
  description: "Atur pengiriman ringkasan harian via Telegram & kelola langganan.",
  steps: [
    {
      target: "[data-testid='digest-settings-page']",
      title: "Pengaturan Briefing",
      content: "Konfigurasi **Daily Briefing AI** — ringkasan bisnis harian dikirim otomatis ke Anda.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='telegram-setup-card']",
      title: "Hubungkan Telegram",
      content: "Sambungkan **Telegram** agar briefing & alert penting masuk langsung ke chat Anda.",
      placement: "bottom",
    },
    {
      target: "[data-testid='digest-subscriptions-card']",
      title: "Kelola Langganan",
      content: "Atur **siapa menerima** briefing dan **jam pengiriman**. Tiap penerima bisa beda preferensi.",
      placement: "top",
    },
    {
      target: "[data-testid='owner-send-now']",
      title: "Kirim Sekarang",
      content: "Uji konfigurasi dengan **kirim briefing sekarang** — pastikan format & target sudah benar.",
      placement: "left",
      variant: "tip",
    },
  ],
};

export {
  ownerHomeTour,
  ownerCashPositionTour,
  ownerApprovalsTour,
  ownerBriefingTour,
  ownerAIAssistantTour,
  ownerDigestSettingsTour,
};
