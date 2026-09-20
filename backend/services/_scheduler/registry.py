"""Register all scheduler jobs."""
from __future__ import annotations

from services._scheduler._state import _JOB_REGISTRY, _register
from services._scheduler.jobs import (
    job_anomaly_scan,
    job_low_stock_digest,
    job_ar_aging_alert,
    job_sales_reminder,
    job_payroll_due_reminder,
    job_period_close_reminder,
    job_voucher_expiry_check,
    job_service_charge_reminder,
    job_flush_logs,
)


def _ensure_registered() -> None:
    """Register all jobs into _JOB_REGISTRY if not already done."""
    if _JOB_REGISTRY:
        return
    _register("anomaly_scan", "Anomaly Scan", "0 3 * * *", job_anomaly_scan,
               description="Scan anomali di daily sales & inventory setiap jam 03:00 WIB.")
    _register("low_stock_digest", "Low Stock Digest", "0 7 * * *", job_low_stock_digest,
               description="Kirim ringkasan stok rendah via Telegram jam 07:00 WIB.")
    _register("ar_aging_alert", "AR Aging Alert", "0 8 1 * *", job_ar_aging_alert,
               description="Alert via Telegram jika ada AR >90 hari, setiap tgl 1.")
    _register("sales_reminder", "Sales Reminder", "0 8 * * 1-6", job_sales_reminder,
               description="Ingatkan outlet yang belum input daily sales kemarin.")
    _register("payroll_due_reminder", "Payroll Due Reminder", "0 9 20,25 * *", job_payroll_due_reminder,
               description="Pengingat payroll setiap tgl 20 & 25.")
    _register("period_close_reminder", "Period Close Reminder", "0 9 27-31,1-3 * *", job_period_close_reminder,
               description="Pengingat close period akhir/awal bulan.")
    _register("voucher_expiry_check", "Voucher Expiry Check", "0 8 * * *", job_voucher_expiry_check,
               description="Cek voucher yang segera kadaluarsa.")
    _register("service_charge_reminder", "Service Charge Reminder", "0 9 25 * *", job_service_charge_reminder,
               description="Pengingat service charge belum didistribusi, tgl 25.")
    _register("flush_logs", "Flush Logs", "*/10 * * * *", job_flush_logs,
               description="Persist buffered application logs ke koleksi log_entries setiap 10 menit.")
