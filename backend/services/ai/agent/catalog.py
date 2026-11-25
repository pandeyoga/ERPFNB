"""Katalog aksi untuk agen: dibangun OTOMATIS dari semua route FastAPI `/api/*`.

Setiap endpoint = satu "aksi" dengan: method, path, ringkasan (docstring), parameter path & query, skema body
(bila model Pydantic) atau petunjuk body (`body_hints.py`), **izin yang dibutuhkan** (diintrospeksi dari dependensi
`require_perm` / `require_any_perm`), jenis (baca/tulis), dan tingkat risiko. Modul baru (mis. reservasi, kelak menu
& resep) otomatis masuk katalog tanpa kode tambahan — cukup endpoint + izin seperti biasa.

Pengecualian (keputusan D5): login/token/password, peran & izin & akun pengguna (tulis), pengaturan sistem/AI,
endpoint agen sendiri, endpoint publik website, webhook.
Rencana: docs/ai/AGENTIC_AI_PLAN_2026-11-25.md §6.4.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi.routing import APIRoute

READ_METHODS = {"GET"}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Prefix yang tidak pernah boleh dipakai agen (baca maupun tulis)
EXCLUDED_PREFIXES = (
    "/api/auth", "/api/ai/agent", "/api/ai/policy", "/api/system-settings", "/api/public", "/api/telegram",
    "/api/health", "/api/uploads", "/api/files", "/api/loyalty/auth", "/api/loyalty/me", "/api/tour-analytics",
    "/api/admin/menu/public", "/api/wa",
    # D5: backup/impor/hapus massal seluruh data (khusus Super Admin, lewat layar Data Management)
    "/api/admin/data",
    # telemetri & endpoint akun pelanggan loyalty (bukan aksi staf)
    "/api/errors", "/api/admin/cms/analytics/track", "/api/loyalty/register", "/api/loyalty/login",
    "/api/loyalty/logout",
)
EXCLUDED_PATHS = {"/api/", "/api"}
# Dependensi yang menandai endpoint milik PELANGGAN (token pelanggan, bukan staf) → tidak masuk katalog
CUSTOMER_DEPS = {"get_current_customer", "get_current_customer_profile"}
# Prefix yang boleh DIBACA tetapi tidak boleh DITULIS agen (D5: peran, izin, akun pengguna)
# Business rules (matriks persetujuan & ambang) = kontrol tata kelola → hanya dibaca.
READ_ONLY_PREFIXES = ("/api/admin/roles", "/api/admin/users", "/api/admin/permissions", "/api/users",
                      "/api/admin/business-rules")
# Endpoint POST yang sebenarnya hanya membaca/menghitung (aman dijalankan langsung)
READ_LIKE_POSTS = {
    "/api/sourcing/price-check", "/api/ai/categorize", "/api/ai/generate-journal-entry", "/api/ai/ocr/receipt",
    "/api/forecasting/guard/check", "/api/tax/calculate", "/api/outlet-budget/precheck-pr",
    # Impor Cerdas: membuat/mengubah PRATINJAU batch (draf, belum menulis data bisnis) — commit tetap aksi tulis
    "/api/imports", "/api/imports/{batch_id}",
    # AI Finance: analisis (OCR struk, rekonsiliasi) tidak membukukan apa pun
    "/api/ai/finance/receipts/analyze", "/api/ai/finance/recon/{session_id}/analyze",
}

_HIGH = re.compile(r"/(post|approve|reject|validate|send|pay|reverse|close|cancel|receive|submit|lock|unlock|apply|"
                   r"execute|disburse|settle|void|finalize|release)(/|$)|/grs$|/payments?(/|$)|payment-runs")
_CRITICAL = re.compile(r"/(delete|bulk|import|restore|purge|reset|archive)(/|$)|payroll|/commit/")

# Sinonim Indonesia → kata yang muncul di path/docstring (pencarian katalog)
SYNONYMS: dict[str, list[str]] = {
    "penjualan": ["sales", "daily-sales", "revenue"], "omset": ["sales", "revenue"], "pembelian": ["purchase", "po", "procurement"],
    "pesanan": ["po", "order"], "permintaan": ["pr", "request"], "penerimaan": ["gr", "receipt", "receive"],
    "pemasok": ["vendor", "supplier"], "supplier": ["vendor"], "stok": ["inventory", "stock", "item"],
    "barang": ["item", "inventory"], "bahan": ["item", "inventory"], "gudang": ["inventory", "warehouse"],
    "opname": ["opname", "count"], "transfer": ["transfer"], "jurnal": ["journal", "je", "gl"], "akun": ["coa", "account"],
    "hutang": ["ap", "payable"], "piutang": ["ar", "receivable", "invoice"], "bayar": ["payment", "pay"],
    "pembayaran": ["payment"], "kas": ["cash", "petty"], "bank": ["bank", "recon"], "pajak": ["tax", "efaktur", "ebupot"],
    "aset": ["asset", "depreciation"], "anggaran": ["budget"], "laporan": ["report", "export"], "laba": ["profit", "pl"],
    "rugi": ["loss", "pl"], "neraca": ["balance"], "karyawan": ["employee", "hr"], "pegawai": ["employee", "hr"],
    "gaji": ["payroll", "salary"], "cuti": ["leave"], "absensi": ["attendance"], "reservasi": ["reservation", "reservations"],
    "meja": ["table", "reservation"], "pelanggan": ["customer", "crm", "loyalty"], "member": ["loyalty", "member"],
    "poin": ["points", "loyalty"], "voucher": ["voucher"], "menu": ["menu"], "resep": ["recipe", "bom"],
    "toko": ["outlet"], "cabang": ["outlet"], "harga": ["price", "pricing", "sourcing", "market"],
    "acuan": ["benchmark", "market-list"], "penawaran": ["offer", "quote", "rfq"], "anomali": ["anomaly"],
    "persetujuan": ["approval", "approve"], "setujui": ["approve"], "tolak": ["reject"], "hapus": ["delete"],
    "ubah": ["update", "patch"], "buat": ["create"], "tambah": ["create", "add"], "posting": ["post"],
    "ramalan": ["forecast"], "perkiraan": ["forecast"], "notifikasi": ["notification"], "website": ["cms", "seo"],
    "tutup": ["close", "period"], "periode": ["period"], "kategori": ["category"], "wilayah": ["region"],
}


@dataclass
class Op:
    id: str
    method: str
    path: str
    summary: str
    description: str
    domain: str
    kind: str                      # read | write
    risk: str                      # rendah | sedang | tinggi | kritis
    perms_all: list[str] = field(default_factory=list)
    perms_any: list[str] = field(default_factory=list)
    path_params: list[dict] = field(default_factory=list)
    query_params: list[dict] = field(default_factory=list)
    body_schema: Optional[dict] = None
    body_hint: Optional[str] = None
    tokens: set[str] = field(default_factory=set)

    def allowed_for(self, perms: set[str]) -> bool:
        if "*" in perms:
            return True
        if self.perms_all and not all(p in perms for p in self.perms_all):
            return False
        if self.perms_any and not any(p in perms for p in self.perms_any):
            return False
        return True

    def public(self, *, detail: bool = False) -> dict:
        out: dict[str, Any] = {"op_id": self.id, "method": self.method, "path": self.path, "ringkasan": self.summary,
                               "jenis": "baca" if self.kind == "read" else "tulis", "risiko": self.risk}
        if self.path_params:
            out["path_params"] = [p["name"] for p in self.path_params]
        if self.query_params:
            out["query"] = [f"{p['name']}{'' if p.get('required') else '?'}:{p['type']}" for p in self.query_params]
        if detail:
            out["keterangan"] = self.description[:1500]
            if self.body_schema:
                out["body_schema"] = self.body_schema
            if self.body_hint:
                out["body_petunjuk"] = self.body_hint
        elif self.body_hint or self.body_schema:
            out["body"] = "lihat detail (detail=true)"
        return out


def _slug(method: str, path: str) -> str:
    p = re.sub(r"[{}]", "", path.removeprefix("/api/"))
    return f"{method.lower()}_{re.sub(r'[^a-zA-Z0-9]+', '_', p).strip('_')}"


def _dep_names(dependant) -> set[str]:
    out: set[str] = set()
    stack = list(dependant.dependencies)
    while stack:
        d = stack.pop()
        out.add((getattr(d.call, "__name__", "") or "").strip())
        stack.extend(d.dependencies)
    return out


def _perm_requirements(dependant) -> tuple[list[str], list[str]]:
    """Kumpulkan izin dari dependensi require_perm (semua) / require_any_perm (salah satu).
    Penjaga berbasis peran (`require_role(roles)`, closure `roles`) dianggap butuh "*" (Super Admin) agar AI
    tidak menawarkannya ke pengguna biasa; route tetap memeriksa sendiri saat dijalankan."""
    all_p: list[str] = []
    any_p: list[str] = []
    stack = list(dependant.dependencies)
    while stack:
        d = stack.pop()
        call = d.call
        qn = getattr(call, "__qualname__", "") or ""
        code = getattr(call, "__code__", None)
        if code is not None and "perms" in code.co_freevars and call.__closure__:
            perms = call.__closure__[code.co_freevars.index("perms")].cell_contents
            if "require_any_perm" in qn:
                any_p.extend(perms)
            elif "require_perm" in qn:
                all_p.extend(perms)
        elif code is not None and "roles" in code.co_freevars and call.__closure__:
            all_p.append("*")
        stack.extend(d.dependencies)
    return sorted(set(all_p)), sorted(set(any_p))


def _type_name(field_) -> str:
    ann = getattr(field_.field_info, "annotation", None) or getattr(field_, "type_", None)
    s = getattr(ann, "__name__", None) or str(ann)
    s = s.replace("typing.", "").replace("Optional[", "").rstrip("]")
    return {"str": "string", "int": "integer", "float": "number", "bool": "boolean"}.get(s, s)


def _params(fields) -> list[dict]:
    out = []
    for f in fields:
        info = f.field_info
        default = None if f.required else getattr(info, "default", None)
        out.append({"name": f.alias or f.name, "type": _type_name(f), "required": bool(f.required),
                    "default": default if isinstance(default, (str, int, float, bool)) else None,
                    "desc": getattr(info, "description", None)})
    return out


def _body_schema(route: APIRoute) -> Optional[dict]:
    bf = route.body_field
    if bf is None:
        return None
    ann = getattr(bf.field_info, "annotation", None) or getattr(bf, "type_", None)
    try:
        from pydantic import BaseModel
        if isinstance(ann, type) and issubclass(ann, BaseModel):
            sch = ann.model_json_schema()
            sch.pop("title", None)
            return sch
    except Exception:  # noqa: BLE001
        return None
    return None


_KEY_RE = re.compile(r"""(?:payload|data|body|p|ln|line|it|item)\.get\(["'](\w+)["']|(?:payload|data|body)\[["'](\w+)["']\]""")
_CALL_RE = re.compile(r"await\s+([\w\.]+)\(")


def _auto_hint(route: APIRoute) -> Optional[str]:
    """Field yang dibaca endpoint & service yang dipanggilnya (petunjuk bila tidak ada skema/petunjuk tertulis)."""
    import inspect
    try:
        src = inspect.getsource(route.endpoint)
    except (OSError, TypeError):
        return None
    keys: list[str] = []

    def collect(code: str) -> None:
        for a, b in _KEY_RE.findall(code):
            k = a or b
            if k and k not in keys and not k.startswith("_"):
                keys.append(k)
    collect(src)
    g = route.endpoint.__globals__
    for name in _CALL_RE.findall(src)[:4]:
        mod, _, fn = name.rpartition(".")
        obj = g.get(mod) if mod else g.get(fn)
        f = getattr(obj, fn, None) if mod else obj
        if callable(f):
            try:
                collect(inspect.getsource(f))
            except (OSError, TypeError):
                pass
    if not keys:
        return None
    return ("Field yang dikenali endpoint (otomatis dari kode; tidak semua wajib): " + ", ".join(keys[:40])
            + ". Bila ragu, baca contoh data sejenis lewat aksi GET terkait.")


def _risk(method: str, path: str) -> str:
    if method in READ_METHODS or path in READ_LIKE_POSTS:
        return "rendah"
    if method == "DELETE" or _CRITICAL.search(path):
        return "kritis"
    if _HIGH.search(path):
        return "tinggi"
    return "sedang"


def _tokens(*parts: str) -> set[str]:
    words = set()
    for p in parts:
        for w in re.split(r"[^a-zA-Z0-9]+", (p or "").lower()):
            if len(w) >= 2:
                words.add(w)
                if w.endswith("s") and len(w) > 3:
                    words.add(w[:-1])
    return words


_CATALOG: Optional[list[Op]] = None


def build(app) -> list[Op]:
    from .body_hints import BODY_HINTS
    ops: list[Op] = []
    seen: set[str] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/"):
            continue
        if route.path.startswith(EXCLUDED_PREFIXES) or route.path in EXCLUDED_PATHS:
            continue
        if _dep_names(route.dependant) & CUSTOMER_DEPS:
            continue
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            kind = "read" if (method in READ_METHODS or route.path in READ_LIKE_POSTS) else "write"
            if kind == "write" and route.path.startswith(READ_ONLY_PREFIXES):
                continue
            oid = _slug(method, route.path)
            if oid in seen:
                continue
            seen.add(oid)
            doc = (route.endpoint.__doc__ or "").strip()
            summary = (route.summary or doc.split("\n")[0] or route.name.replace("_", " ")).strip()
            all_p, any_p = _perm_requirements(route.dependant)
            domain = route.path.split("/")[2]
            op = Op(id=oid, method=method, path=route.path, summary=summary[:200], description=doc, domain=domain,
                    kind=kind, risk=_risk(method, route.path), perms_all=all_p, perms_any=any_p,
                    path_params=_params(route.dependant.path_params),
                    query_params=_params(route.dependant.query_params),
                    body_schema=_body_schema(route) if method in WRITE_METHODS else None,
                    body_hint=BODY_HINTS.get(f"{method} {route.path}"))
            if method in WRITE_METHODS and not op.body_hint and not op.body_schema and route.body_field is not None:
                op.body_hint = _auto_hint(route)
            op.tokens = _tokens(route.path, summary, doc[:400], route.name, " ".join(route.tags or []))
            ops.append(op)
    return ops


def catalog(app=None) -> list[Op]:
    global _CATALOG
    if _CATALOG is None:
        if app is None:
            from .executor import get_app
            app = get_app()
        _CATALOG = build(app)
    return _CATALOG


def reset() -> None:
    global _CATALOG
    _CATALOG = None


def get(op_id: str) -> Optional[Op]:
    return next((o for o in catalog() if o.id == op_id), None)


def search(query: str, perms: set[str], *, kind: Optional[str] = None, domain: Optional[str] = None,
           limit: int = 12) -> list[Op]:
    q = _tokens(query)
    expanded = set(q)
    for w in q:
        expanded.update(SYNONYMS.get(w, []))
    scored = []
    for op in catalog():
        if kind in ("read", "write") and op.kind != kind:
            continue
        if domain and op.domain != domain:
            continue
        if not op.allowed_for(perms):
            continue
        hits = expanded & op.tokens
        if not hits:
            continue
        score = sum(3 if w in q else 1 for w in hits)
        score += 2 * sum(1 for w in hits if w in op.path.lower())
        score -= 0.01 * len(op.path)
        scored.append((score, op))
    scored.sort(key=lambda x: -x[0])
    return [o for _, o in scored[:limit]]


def domains(perms: set[str]) -> dict[str, dict]:
    """Ringkasan domain yang bisa diakses pengguna: jumlah aksi baca/tulis."""
    out: dict[str, dict] = {}
    for op in catalog():
        if not op.allowed_for(perms):
            continue
        d = out.setdefault(op.domain, {"baca": 0, "tulis": 0})
        d["baca" if op.kind == "read" else "tulis"] += 1
    return dict(sorted(out.items()))
