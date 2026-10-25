/** Generic Master Data CRUD: items, vendors, employees, COA, etc. */
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Search, Package } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";
import { fmtRp } from "@/lib/format";
/** Schema: which fields each entity has, plus labels.
 *  Label field TANPA tanda "*": penanda wajib dirender otomatis dari `required`.
 *  `singular` dipakai untuk tombol/judul dialog ("Tambah Item", "Edit Vendor"). */
const SCHEMA = {
  items: {
    label: "Items", singular: "Item", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "name_local", label: "Nama (Bahasa)" },
      { key: "sku", label: "SKU" },
      { key: "unit_default", label: "Satuan", required: true, default: "pcs" },
      { key: "is_direct_purchase", label: "Pembelian Langsung", type: "bool" },
      { key: "notes", label: "Catatan", type: "textarea" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "unit_default", "is_direct_purchase", "active"],
  },
  vendors: {
    label: "Vendors", singular: "Vendor", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama Vendor", required: true },
      { key: "npwp", label: "NPWP" },
      { key: "address", label: "Alamat", type: "textarea" },
      { key: "phone", label: "Telepon" },
      { key: "email", label: "Email", type: "email" },
      { key: "contact_name", label: "Nama Kontak" },
      { key: "default_payment_terms_days", label: "Termin Pembayaran (hari)", type: "number", default: 30 },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "phone", "default_payment_terms_days", "active"],
  },
  employees: {
    label: "Employees", singular: "Employee", uniq: "code", nameField: "full_name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "full_name", label: "Nama Lengkap", required: true },
      { key: "outlet_id", label: "Outlet", type: "outlet", required: true },
      { key: "position", label: "Posisi" },
      { key: "department", label: "Departemen" },
      { key: "join_date", label: "Tanggal Bergabung", type: "date" },
      { key: "npwp", label: "NPWP" },
      { key: "status", label: "Status", type: "select", options: [
        { v: "active", l: "Aktif" }, { v: "leave", l: "Cuti" }, { v: "terminated", l: "Terminated" },
      ], default: "active" },
    ],
    columns: ["code", "full_name", "position", "salary_summary", "status"],
    columnLabels: { salary_summary: "Gaji Pokok" },
    cellRender: { salary_summary: (v) => <SalaryCell summary={v} /> },
  },
  "chart-of-accounts": {
    label: "Chart of Accounts", singular: "Akun COA", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "name_id", label: "Nama (Bahasa)" },
      { key: "type", label: "Tipe", type: "select", required: true, options: [
        { v: "asset", l: "Asset" }, { v: "liability", l: "Liability" },
        { v: "equity", l: "Equity" }, { v: "revenue", l: "Revenue" },
        { v: "cogs", l: "COGS" }, { v: "expense", l: "Expense" },
      ]},
      { key: "normal_balance", label: "Saldo Normal", type: "select", required: true, options: [
        { v: "Dr", l: "Debit (Dr)" }, { v: "Cr", l: "Kredit (Cr)" },
      ]},
      { key: "is_postable", label: "Bisa Diposting (leaf)", type: "bool", default: true },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "normal_balance", "is_postable", "active"],
  },
  brands: {
    label: "Brands", singular: "Brand", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama Brand", required: true },
      { key: "color", label: "Warna (hex)", placeholder: "#5B5FE3" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "color", "active"],
  },
  outlets: {
    label: "Outlets", singular: "Outlet", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama Outlet", required: true },
      { key: "address", label: "Alamat", type: "textarea" },
      { key: "phone", label: "Telepon" },
      { key: "open_time", label: "Jam Buka", placeholder: "08:00" },
      { key: "close_time", label: "Jam Tutup", placeholder: "22:00" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "phone", "open_time", "close_time", "active"],
  },
  categories: {
    label: "Categories", singular: "Category", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "type", label: "Tipe", type: "select", required: true, options: [
        { v: "item", l: "Item" }, { v: "expense", l: "Expense" }, { v: "revenue", l: "Revenue" },
      ]},
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "active"],
  },
  "payment-methods": {
    label: "Payment Methods", singular: "Payment Method", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "type", label: "Tipe", type: "select", required: true, options: [
        { v: "cash", l: "Cash" }, { v: "transfer", l: "Transfer" },
        { v: "qris", l: "QRIS" }, { v: "card", l: "Card" }, { v: "other", l: "Lainnya" },
      ]},
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "active"],
  },
  "bank-accounts": {
    label: "Bank Accounts", singular: "Bank Account", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "bank", label: "Bank", required: true },
      { key: "account_number", label: "No. Rekening", required: true },
      { key: "currency", label: "Mata Uang", default: "IDR" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "bank", "account_number", "currency", "active"],
  },
  "tax-codes": {
    label: "Tax Codes", singular: "Tax Code", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Kode", required: true },
      { key: "name", label: "Nama", required: true },
      { key: "rate", label: "Tarif (mis. 0.11 = 11%)", type: "number" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "rate", "active"],
  },
};

/** Label kolom tabel = label field (bahasa sama dengan form), fallback ke columnLabels/key. */
function columnLabel(schema, col) {
  if (schema.columnLabels?.[col]) return schema.columnLabels[col];
  const f = schema.fields.find((x) => x.key === col);
  return f ? f.label : col.replace(/_/g, " ");
}

const ENTITY_TABS = [
  { key: "items", label: "Items" },
  { key: "vendors", label: "Vendors" },
  { key: "employees", label: "Employees" },
  { key: "outlets", label: "Outlets" },
  { key: "brands", label: "Brands" },
  { key: "categories", label: "Categories" },
  { key: "chart-of-accounts", label: "COA" },
  { key: "payment-methods", label: "Payment methods" },
  { key: "bank-accounts", label: "Bank accounts" },
  { key: "tax-codes", label: "Tax codes" },
];

/** Generic master-data CRUD page.
 *  - Satu <h1> lewat PageHeader ("Master Data") dengan aksi utama "Tambah <entitas>".
 *  - `tabs`: baris tab entitas dari MasterDataHub (dirender tepat di bawah header).
 *    Tanpa `tabs` dan tanpa `hideEntityTabs`, halaman merender tab entitasnya sendiri. */
export default function MasterData({ hideEntityTabs = false, tabs = null } = {}) {
  const { entity } = useParams();
  const navigate = useNavigate();
  const schema = SCHEMA[entity];

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });
  const [editing, setEditing] = useState(null);

  async function load() {
    if (!schema) return;
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (q) params.q = q;
      const res = await api.get(`/master/${entity}`, { params });
      setData(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setQ("");
  }, [entity]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity, page]);
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [q]);

  const entityTabs = tabs || (!hideEntityTabs && (
    <Tabs value={entity} onValueChange={(v) => navigate(`/admin/master/${v}`)}>
      <TabsList>
        {ENTITY_TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} data-testid={`master-tab-${t.key}`}>{t.label}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  ));

  const header = (
    <PageHeader
      icon={Package}
      title="Master Data"
      subtitle={schema
        ? `${schema.label} — data master yang dipakai di seluruh modul ERP.`
        : "Kelola semua data master dalam satu tempat."}
      actions={schema && (
        <Button onClick={() => setEditing({ ...defaultsFor(schema) })} data-testid="master-new">
          <Plus /> Tambah {schema.singular}
        </Button>
      )}
    />
  );

  if (!schema) {
    return (
      <div className="space-y-3" data-testid="master-data-page">
        {header}
        {entityTabs}
        <EmptyState title="Entitas tidak ditemukan" description={`'${entity}' tidak dikenali`} />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-3" data-testid="master-data-page">
      {header}
      {entityTabs}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={`Cari ${schema.label.toLowerCase()}…`}
                 aria-label={`Cari ${schema.label}`}
                 value={q} onChange={e => setQ(e.target.value)}
                 className="glass-input pl-9" data-testid="master-search" />
        </div>
        {!loading && (
          <span className="text-xs text-muted-foreground tabular-nums">{meta.total ?? data.length} data</span>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden" data-testid="master-table-card">
        <DataTable
          columns={schema.columns.map((c, i) => ({
            key: c,
            label: columnLabel(schema, c),
            primary: i === 0,
            sortable: !schema.cellRender?.[c],
            render: (row) => (schema.cellRender?.[c] ? schema.cellRender[c](row[c], row) : renderCell(row[c], c, schema)),
          }))}
          rows={data}
          loading={loading}
          empty={(
            <EmptyState
              title={`Belum ada data ${schema.label}`}
              description={q ? "Tidak ada yang cocok dengan pencarian." : `Klik "Tambah ${schema.singular}" untuk membuat data pertama.`}
            />
          )}
          renderExpanded={(row) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm" data-testid={`master-detail-${row.id}`}>
              {schema.fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3 border-b border-border/20 py-1">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-right">{renderCell(row[f.key], f.key, schema)}</span>
                </div>
              ))}
              {entity === "employees" && <div className="sm:col-span-2 pt-2"><SalaryReadOnly summary={row.salary_summary} /></div>}
            </div>
          )}
          rowAction={(row) => {
            const name = row[schema.nameField] || row.code;
            return (
              <div className="flex items-center gap-1 justify-end">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row)}
                        title={`Edit ${schema.singular}`} aria-label={`Edit ${name}`}
                        data-testid={`master-edit-${row.id}`}>
                  <Edit2 className="!h-3.5 !w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteRow(entity, row, load)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                        title={`Hapus ${schema.singular}`} aria-label={`Hapus ${name}`}
                        data-testid={`master-delete-${row.id}`}>
                  <Trash2 className="!h-3.5 !w-3.5" />
                </Button>
              </div>
            );
          }}
          rowTestIdPrefix="master-row"
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      data-testid="master-prev">Sebelumnya</Button>
              <span className="px-1 tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      data-testid="master-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>

      <EntityDialog entity={entity} schema={schema} editing={editing}
                     onClose={() => setEditing(null)}
                     onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function renderCell(v, col, schema) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  // `active` dicek lebih dulu (sebelumnya jatuh ke cabang boolean → "Yes/No"); label status
  // memakai kamus StatusPill bersama (Active/Inactive) agar sama dengan portal lain.
  if (col === "active") {
    return <StatusPill status={v ? "active" : "inactive"} />;
  }
  if (col === "status" && typeof v === "string") {
    return <StatusPill status={v} />;
  }
  if (typeof v === "boolean") {
    return <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
      v ? "status-active" : "status-disabled")}>{v ? "Ya" : "Tidak"}</span>;
  }
  if (col === "color" && typeof v === "string" && v.startsWith("#")) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded border border-border/50" style={{ background: v }} />
        <span className="text-xs tabular-nums">{v}</span>
      </div>
    );
  }
  // Kode/nomor dokumen: konvensi lintas portal = Inter font-medium tabular-nums (bukan font-mono)
  if (col === "code" || col === "account_number" || col === "sku") {
    return <span className="font-medium tabular-nums">{String(v)}</span>;
  }
  // Field select → tampilkan label opsi (mis. status "active" → "Aktif", tipe "liability" → "Liability")
  const field = schema?.fields?.find((f) => f.key === col);
  if (field?.type === "select") {
    const opt = field.options.find((o) => o.v === v);
    if (opt) return <span>{opt.l}</span>;
  }
  return <span>{String(v)}</span>;
}

function defaultsFor(schema) {
  const obj = {};
  schema.fields.forEach(f => {
    if (f.default !== undefined) obj[f.key] = f.default;
  });
  return obj;
}

async function deleteRow(entity, row, refresh) {
  if (!(await confirmDialog({
    title: "Hapus data",
    description: `Hapus ${row.name || row.full_name || row.code}? Tindakan ini tidak bisa dibatalkan.`,
    destructive: true,
    confirmText: "Hapus",
  }))) return;
  try {
    await api.delete(`/master/${entity}/${row.id}`);
    toast.success("Data dihapus");
    refresh();
  } catch (e) {
    toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menghapus");
  }
}

function EntityDialog({ entity, schema, editing, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const isNew = editing && !editing.id;

  useEffect(() => {
    if (editing) setForm({ ...editing });
  }, [editing]);

  if (!editing) return null;

  const submit = async () => {
    // basic validation
    const missing = schema.fields.filter(f => f.required && !form[f.key] && form[f.key] !== false);
    if (missing.length) {
      toast.error(`Kolom wajib: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      // Coerce types
      const { salary_summary: _ss, ...payload } = form;
      schema.fields.forEach(f => {
        if (f.type === "number" && payload[f.key] !== undefined && payload[f.key] !== "") {
          payload[f.key] = Number(payload[f.key]);
        }
      });
      if (isNew) {
        await api.post(`/master/${entity}`, payload);
        toast.success(`${schema.singular} ditambahkan`);
      } else {
        await api.patch(`/master/${entity}/${editing.id}`, payload);
        toast.success("Perubahan disimpan");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  // Field pendek dua kolom; textarea, outlet & switch selebar penuh
  const isWide = (f) => f.type === "textarea" || f.type === "outlet" || f.type === "bool";

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-2xl" data-testid="master-dialog">
        <DialogHeader>
          <DialogTitle>{isNew ? `Tambah ${schema.singular}` : `Edit ${schema.singular}`}</DialogTitle>
          <DialogDescription>
            Kolom bertanda <span className="text-destructive">*</span> wajib diisi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schema.fields.map((f) => (
            <div key={f.key} className={isWide(f) ? "sm:col-span-2" : undefined}>
              <FieldRender field={f} value={form[f.key]}
                            isNew={isNew} uniq={schema.uniq}
                            onChange={(v) => setForm({...form, [f.key]: v})} />
            </div>
          ))}
          {entity === "employees" && (
            <div className="sm:col-span-2"><SalaryReadOnly summary={editing.salary_summary} isNew={isNew} /></div>
          )}
        </div>
        <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 px-5 py-3 border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <Button variant="outline" onClick={onClose} data-testid="master-form-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="master-form-save">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const fmtIDR = (n) => fmtRp(Number(n || 0)); // DUP-10

function SalaryCell({ summary }) {
  if (!summary) return <span className="text-muted-foreground">—</span>;
  if (!summary.has_master) return <span className="text-[11px] px-2 py-0.5 rounded-full status-disabled">Belum diatur</span>;
  return <span className="tabular-nums">{fmtIDR(summary.basic_salary)}</span>;
}

/** CTL-10: pay is owned by Salary Master; the employee form only displays it. */
function SalaryReadOnly({ summary, isNew }) {
  const rows = summary?.has_master ? [
    ["Gaji Pokok", fmtIDR(summary.basic_salary)],
    ["Tunjangan Tetap", fmtIDR(summary.allowances_total)],
    ["Total Gaji Tetap", fmtIDR(summary.total_fixed_pay)],
    ["PTKP / BPJS", `${summary.ptkp_status} · ${summary.bpjs_enrolled ? "BPJS terdaftar" : "Tanpa BPJS"}`],
  ] : [];
  return (
    <div className="rounded-lg border border-border/60 bg-foreground/[0.03] p-3 space-y-2" data-testid="employee-salary-readonly">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Gaji (hanya-baca · Salary Master)</span>
        <Link to="/hr/payroll?tab=salary" className="text-xs underline underline-offset-2" data-testid="employee-salary-master-link">
          Kelola di Salary Master
        </Link>
      </div>
      {isNew ? (
        <p className="text-xs text-muted-foreground">Simpan karyawan dulu, lalu atur gaji di Salary Master sebelum generate payroll.</p>
      ) : !summary ? (
        <p className="text-xs text-muted-foreground">Anda tidak punya akses melihat data gaji.</p>
      ) : !summary.has_master ? (
        <p className="text-xs text-amber-600" data-testid="employee-salary-missing">Belum diatur — karyawan ini akan memblokir generate payroll sampai Salary Master diisi.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {rows.map(([l, v]) => (
            <div key={l} className="contents"><span className="text-xs text-muted-foreground">{l}</span><span className="text-right tabular-nums">{v}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Label standar form: text-xs/sm medium, penanda wajib dari `required`. */
function FieldLabel({ field, htmlFor, className }) {
  return (
    <Label htmlFor={htmlFor} className={cn("text-xs md:text-sm font-medium", className)}>
      {field.label}{field.required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

function OutletField({ field, value, onChange }) {
  const { data: outlets = [] } = useQuery({
    queryKey: ["master", "outlets", "picker"],
    queryFn: async () => unwrap(await fetchAll("/master/outlets", { active: true })) || [],
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className="space-y-1.5" data-testid="master-field-outlet">
      <FieldLabel field={field} />
      <SimpleSelect
        value={value || ""}
        onValueChange={onChange}
        options={[{ value: "", label: "— pilih outlet —" }, ...outlets.map(o => ({ value: o.id, label: `${o.code ? o.code + " · " : ""}${o.name}` }))]}
        placeholder="— pilih outlet —"
        className="glass-input w-full"
        ariaLabel={field.label}
        data-testid="master-field-outlet-select"
      />
      <p className="text-[11px] text-muted-foreground">Menentukan payroll per-outlet & alokasi service charge.</p>
    </div>
  );
}

function FieldRender({ field, value, onChange, isNew, uniq }) {
  const disabled = !isNew && field.key === uniq;
  const id = `master-field-${field.key}`;
  if (field.type === "outlet") return <OutletField field={field} value={value} onChange={onChange} />;
  if (field.type === "bool") {
    return (
      <div className="flex items-center justify-between glass-input rounded-lg px-3 h-9">
        <FieldLabel field={field} htmlFor={id} className="font-normal" />
        <Switch id={id} checked={!!value} onCheckedChange={onChange} data-testid={id} />
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <FieldLabel field={field} htmlFor={id} />
        <Textarea id={id} value={value || ""} onChange={e => onChange(e.target.value)}
                  className="glass-input min-h-[72px]" data-testid={id} />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <FieldLabel field={field} />
        <SimpleSelect
          value={value || ""}
          onValueChange={onChange}
          options={[{ value: "", label: "— pilih —" }, ...field.options.map(o => ({ value: o.v, label: o.l }))]}
          placeholder="— pilih —"
          className="glass-input w-full"
          ariaLabel={field.label}
          testId={id}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <FieldLabel field={field} htmlFor={id} />
      <Input
        id={id}
        type={field.type === "number" ? "number" : (field.type === "date" ? "date" : (field.type === "email" ? "email" : "text"))}
        value={value ?? ""}
        disabled={disabled}
        required={field.required}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
        className="glass-input"
        data-testid={id}
      />
      {disabled && <p className="text-[11px] text-muted-foreground">Kode tidak bisa diubah setelah dibuat.</p>}
    </div>
  );
}
