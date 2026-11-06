"""Katalog izin TERKELOMPOK untuk layar Peran & Hak Akses: portal → modul → izin.

Sumber kode izin tetap `core/perms_catalog.py` (satu daftar datar; dipakai juga approval matrix). File ini hanya
MENURUNKAN struktur yang dibaca manusia: portal & modul dari prefix kode, jenis aksi dari segmen terakhir
(untuk tingkat cepat "Lihat saja" / "Penuh"), label bahasa Indonesia, penanda izin sensitif, dan dependensi
("ubah/approve butuh lihat"). Pola mengikuti DAHOST `data/permission_catalog.py`.

Menambah izin baru: tulis di perms_catalog.py; bila prefix/modulnya baru, beri label di PORTALS / MODULES di sini.
"""
from __future__ import annotations

from core.perms_catalog import PERMISSIONS_CATALOG

# prefix kode → (id portal, label portal). Urutan = urutan tampil.
PORTALS: list[tuple[str, str, tuple[str, ...]]] = [
    ("outlet", "Outlet", ("outlet", "outlet_budget", "reservations", "loyalty", "vouchers", "crm")),
    ("procurement", "Procurement", ("procurement",)),
    ("inventory", "Inventory", ("inventory",)),
    ("finance", "Finance", ("finance", "tax")),
    ("hr", "HR", ("hr",)),
    ("executive", "Executive & Owner", ("executive", "owner", "anomaly")),
    ("admin", "Admin", ("admin", "report_schedules")),
    ("system", "Sistem", ("system",)),
    ("tools", "AI & Alat", ("ai", "search")),
]
_PREFIX_PORTAL = {p: (pid, label) for pid, label, prefixes in PORTALS for p in prefixes}

MODULES: dict[str, str] = {
    "outlet": "Akses portal Outlet", "outlet.daily_sales": "Daily Sales", "outlet.petty_cash": "Petty Cash",
    "outlet.urgent_purchase": "Urgent Purchase", "outlet.kdo": "KDO (order dapur)", "outlet.bdo": "BDO (order bar)",
    "outlet.fdo": "FDO", "outlet.daily_close": "Daily Close", "outlet.opname": "Stock Opname toko",
    "outlet_budget": "Budget outlet", "reservations": "Reservasi", "loyalty": "Loyalty (kasir)", "vouchers": "Voucher",
    "crm": "CRM", "crm.customer": "CRM — customer", "loyalty.transaction": "Loyalty — transaksi poin",
    "loyalty.redemption": "Loyalty — penukaran poin",
    "procurement": "Akses portal Procurement", "procurement.pr": "Purchase Request (PR)",
    "procurement.po": "Purchase Order (PO)", "procurement.gr": "Goods Receipt (GR)", "procurement.vendor": "Vendor",
    "procurement.rfq": "RFQ", "procurement.market_list": "Harga acuan (Market List)", "procurement.sourcing": "Sourcing",
    "procurement.price_list": "Penawaran supplier",
    "inventory": "Akses portal Inventory", "inventory.item": "Item", "inventory.balance": "Stock Balance",
    "inventory.movement": "Stock Movement", "inventory.transfer": "Stock Transfer",
    "inventory.adjustment": "Stock Adjustment", "inventory.opname": "Stock Opname",
    "inventory.valuation": "Stock Valuation",
    "finance.sales": "Validasi Daily Sales", "finance.ap": "Hutang (AP)", "finance.payment": "Payment",
    "finance.journal_entry": "Journal", "finance.tax": "Pajak", "finance.period": "Period closing",
    "finance.report": "Laporan keuangan", "finance.bank_reconciliation": "Bank reconciliation",
    "finance.cash": "Kas & Bank", "finance.asset": "Fixed Asset", "finance.budget": "Budget",
    "finance.ar": "Piutang (AR)", "finance.payment_request": "Payment Request", "tax.efaktur": "e-Faktur",
    "tax.ebupot": "e-Bupot",
    "hr": "Akses HR (umum)", "hr.advance": "Kasbon (Advance)", "hr.service_charge": "Service Charge",
    "hr.incentive": "Insentif", "hr.voucher": "Voucher karyawan", "hr.foc": "FOC", "hr.travel_incentive": "Travel incentive",
    "hr.lb_fund": "LB Fund", "hr.leave": "Cuti", "hr.employee": "Karyawan", "hr.payroll": "Payroll",
    "executive": "Akses portal Executive", "executive.dashboard": "Dashboard", "executive.drilldown": "Drilldown",
    "executive.dashboard_view": "Tampilan dashboard", "executive.budget": "Approval budget", "owner.cockpit": "Owner cockpit",
    "owner.digest": "Daily digest", "anomaly.feed": "Anomaly feed", "anomaly": "Triage anomali", "anomaly.scan": "Scan anomali",
    "admin.loyalty": "Loyalty (admin)", "admin.master_data": "Master data", "admin.user": "User",
    "admin.role": "Peran & hak akses", "admin.business_rules": "Business rules", "admin.workflow": "Workflow",
    "admin.number_series": "Penomoran dokumen", "admin.audit_log": "Audit log", "admin.system_settings": "System settings",
    "admin.approval": "Approval matrix", "admin.settings": "Pengaturan admin", "admin.cms": "CMS website",
    "report_schedules": "Laporan terjadwal",
    "system.metrics": "Metrics", "system.logs": "Logs", "system.scheduler": "Scheduler", "system.archival": "Archival",
    "system.settings": "Pengaturan sistem",
    "ai.chat": "AI chat", "ai.autocomplete": "AI autocomplete", "ai.ocr": "AI OCR (scan struk)", "ai.categorize": "AI kategori",
    "ai.forecast": "Forecast", "ai.anomaly": "AI anomali", "ai.exec_qa": "Executive Q&A", "ai.vendor_recommend": "Rekomendasi vendor",
    "search.global": "Pencarian global",
}

# segmen terakhir → jenis aksi (untuk tingkat cepat & urutan tampil)
_ACTION = {
    "read": "view", "view": "view", "access": "view", "monitor": "view",
    "create": "create", "submit": "create", "request_increase": "create", "replenish_request": "create", "issue": "create",
    "request_fix": "create", "use": "use",
    "update": "edit", "write": "edit", "set": "edit", "adjust_points": "edit", "manage_customers": "edit",
    "manage_rewards": "edit", "save": "edit",
    "delete": "delete", "disable": "delete", "cancel": "delete", "dispose": "delete",
    "approve": "approve", "reject": "approve", "validate": "approve", "approve_increase": "approve", "post": "approve",
    "lock": "approve", "unlock": "approve", "close_step": "approve", "write_to_locked": "approve", "mark_paid": "approve",
    "export": "export",
    "manage": "manage", "manager": "manage", "settings": "manage",
}
# kata kerja "jalankan" (aksi run) — dipakai juga untuk mengenali izin 2 segmen "<modul>.<aksi>"
_RUN_VERBS = {"redeem", "reports", "execute", "calculate", "trigger", "scan", "send", "receive", "start", "consolidate",
              "reverse", "impersonate", "reset_password", "bulk_import", "triage", "depreciate", "revalue"}
ACTION_ORDER = ["view", "use", "create", "edit", "delete", "approve", "export", "manage", "run"]
ACTION_LABELS = {"view": "Lihat", "use": "Pakai", "create": "Buat", "edit": "Ubah", "delete": "Hapus",
                 "approve": "Approve", "export": "Ekspor", "manage": "Kelola", "run": "Jalankan"}

# Izin berdampak besar: UI memberi tanda & konfirmasi.
SENSITIVE = {
    "*", "admin.role.manage", "admin.user.create", "admin.user.update", "admin.user.disable",
    "admin.user.reset_password", "admin.user.impersonate", "admin.system_settings.manage", "system.settings.manage",
    "system.scheduler.manage", "system.archival.manage", "finance.period.unlock", "finance.period.write_to_locked",
    "finance.journal_entry.reverse", "finance.payment.mark_paid", "finance.payment_request.mark_paid",
    "admin.master_data.bulk_import", "finance.asset.delete", "admin.approval.write", "admin.workflow.manage",
}

_VERBS = [  # label Inggris lama → kata kerja Indonesia (kata pertama)
    ("Read", "Lihat"), ("View", "Lihat"), ("Create", "Buat"), ("Update", "Ubah"), ("Edit", "Ubah"), ("Delete", "Hapus"),
    ("Approve", "Setujui"), ("Reject", "Tolak"), ("Manage", "Kelola"), ("Export", "Ekspor"), ("Send", "Kirim"),
    ("Cancel", "Batalkan"), ("Post", "Posting"), ("Submit", "Ajukan"), ("Validate", "Validasi"), ("Consolidate", "Konsolidasi"),
    ("Lock", "Kunci"), ("Unlock", "Buka kunci"), ("Receive", "Terima"), ("Calculate", "Hitung"), ("Issue", "Terbitkan"),
    ("Redeem", "Tukar"), ("Use", "Pakai"), ("Configure", "Atur"), ("Accept", "Terima"), ("Disable", "Nonaktifkan"),
    ("Reset", "Reset"), ("Write", "Ubah"), ("Request", "Ajukan"), ("Trigger", "Jalankan"), ("Start", "Mulai"),
]


def _split(code: str) -> tuple[str, str, str]:
    """(prefix, module_key, last segment)."""
    parts = code.split(".")
    if len(parts) == 1:
        return parts[0], parts[0], ""
    if len(parts) == 2:
        # "procurement.view" / "outlet_budget.read" / "hr.read" → modul = prefix (aksi di segmen kedua);
        # "finance.bank_reconciliation" / "reservations.reports" → izin = modulnya sendiri (aksi: kelola)
        if parts[1] in _ACTION or parts[1] in _RUN_VERBS:
            return parts[0], parts[0], parts[1]
        return parts[0], code, "manage"
    return parts[0], f"{parts[0]}.{parts[1]}", parts[-1]


def _action(last: str) -> str:
    return _ACTION.get(last, "run")


# Label yang ditulis ulang (label Inggris lama terlalu singkat / ambigu)
LABEL_OVERRIDES = {
    "finance.report.profit_loss": "Lihat laporan Laba Rugi (P&L)",
    "finance.report.balance_sheet": "Lihat Neraca (Balance Sheet)",
    "finance.report.cashflow": "Lihat laporan Cashflow",
    "finance.bank_reconciliation": "Kelola Bank reconciliation",
    "reservations.reports": "Lihat laporan reservasi",
    "outlet.manager": "Akses fitur manajer toko",
    "procurement.view": "Buka portal Procurement",
    "inventory.view": "Buka portal Inventory",
    "executive.view": "Buka portal Executive",
    "hr.read": "Lihat data HR (umum)",
    "hr.write": "Ubah data HR (umum)",
    "procurement.vendor.scorecard": "Lihat vendor scorecard",
    "outlet.daily_close.execute": "Jalankan Daily Close",
    "outlet.opname.execute": "Jalankan stock opname toko",
    "owner.cockpit.access": "Buka Owner cockpit",
    "procurement.rfq.read": "Lihat RFQ",
    "procurement.rfq.create": "Buat & ubah RFQ, catat penawaran",
    "procurement.rfq.approve": "Terima penawaran RFQ",
    "procurement.pr.consolidate": "Konsolidasi PR",
    "procurement.market_list.manage": "Tetapkan harga acuan & review item baru",
    "procurement.sourcing.read": "Lihat analisis sourcing, harga acuan & penawaran",
    "procurement.price_list.manage": "Kelola penawaran supplier (termasuk impor)",
    "procurement.sourcing.settings": "Atur periode harga acuan & ambang peringatan",
    "outlet_budget.monitor": "Pantau budget semua outlet",
    "finance.payment_request.submit": "Ajukan payment request untuk approval",
}


def _label_id(label: str) -> str:
    for en, idn in _VERBS:
        if label.startswith(en + " ") or label == en:
            return idn + label[len(en):]
    return label


def _humanize(key: str) -> str:
    return key.split(".")[-1].replace("_", " ").capitalize()


def describe(entry: dict) -> dict:
    code = entry["code"]
    prefix, module_key, last = _split(code)
    action = _action(last) if code != "*" else "manage"
    return {
        "code": code,
        "label": LABEL_OVERRIDES.get(code) or _label_id(entry.get("label") or code),
        "label_en": entry.get("label"),
        "action": action,
        "action_label": ACTION_LABELS[action],
        "sensitive": code in SENSITIVE,
        "module": module_key,
        "portal": _PREFIX_PORTAL.get(prefix, ("other", "Lainnya"))[0],
    }


def grouped() -> dict:
    """{ super: {...}, portals: [{id, label, modules: [{id, label, permissions: [...]}]}] }."""
    seen: set[str] = set()
    portals: dict[str, dict] = {pid: {"id": pid, "label": label, "modules": {}} for pid, label, _ in PORTALS}
    portals["other"] = {"id": "other", "label": "Lainnya", "modules": {}}
    super_entry = None
    for e in PERMISSIONS_CATALOG:
        if e["code"] in seen:
            continue
        seen.add(e["code"])
        d = describe(e)
        if d["code"] == "*":
            super_entry = {**d, "label": "Akses penuh ke semua fitur (Super Admin)"}
            continue
        mods = portals[d["portal"]]["modules"]
        mod = mods.setdefault(d["module"], {"id": d["module"], "label": MODULES.get(d["module"]) or _humanize(d["module"]),
                                            "permissions": []})
        mod["permissions"].append(d)
    out = []
    for p in portals.values():
        if not p["modules"]:
            continue
        mods = list(p["modules"].values())
        for m in mods:
            m["permissions"].sort(key=lambda x: (ACTION_ORDER.index(x["action"]), x["code"]))
            views = [x["code"] for x in m["permissions"] if x["action"] == "view"]
            # Ubah/approve/dll. di modul yang punya izin "lihat" butuh izin lihat itu (UI menambahkannya otomatis)
            for x in m["permissions"]:
                x["requires"] = views[:1] if (views and x["action"] != "view") else []
        out.append({"id": p["id"], "label": p["label"], "modules": mods,
                    "count": sum(len(m["permissions"]) for m in mods)})
    return {"super": super_entry, "portals": out, "actions": [{"id": a, "label": ACTION_LABELS[a]} for a in ACTION_ORDER]}


def known_codes() -> set[str]:
    return {e["code"] for e in PERMISSIONS_CATALOG}
