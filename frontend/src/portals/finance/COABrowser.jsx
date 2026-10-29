/** Chart of Accounts browser — read-only viewer (write via Admin Master Data). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, Wallet, BookOpen } from "lucide-react";
import { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/shared/PageHeader";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { fetchAll } from "@/lib/api";
import ListToolbar from "@/components/shared/ListToolbar";
const TYPES = [
  { v: "",          l: "Semua tipe" },
  { v: "asset",     l: "Asset" },
  { v: "liability", l: "Liability" },
  { v: "equity",    l: "Equity" },
  { v: "revenue",   l: "Revenue" },
  { v: "cogs",      l: "COGS" },
  { v: "expense",   l: "Expense" },
];

export default function COABrowser() {
  const { can } = useAuth();
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [postableOnly, setPostableOnly] = useState(false);

  useEffect(() => {
    fetchAll("/master/chart-of-accounts")
      .then(r => setCoas(unwrap(r) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = coas;
    if (type) rows = rows.filter(r => r.type === type);
    if (postableOnly) rows = rows.filter(r => r.is_postable);
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter(r =>
        (r.code || "").toLowerCase().includes(s) ||
        (r.name || "").toLowerCase().includes(s) ||
        (r.name_id || "").toLowerCase().includes(s),
      );
    }
    return rows.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [coas, type, q, postableOnly]);

  return (
    <div data-testid="coa-browser-page">
      <PageHeader
        icon={BookOpen}
        title="Chart of Accounts"
        subtitle={`Daftar akun (read-only) — ${filtered.length} dari ${coas.length} akun`}
        actions={can("admin.master_data.manage") && (
          <Button variant="outline" asChild>
            <Link to="/admin/master-data?tab=chart-of-accounts" data-testid="coa-edit-link">
              Kelola di Admin <ExternalLink />
            </Link>
          </Button>
        )}
      />
      <div className="space-y-3 lg:space-y-4">
      <div data-testid="coa-table-card" className="glass-card overflow-hidden">
        {/* Filter menempel pada tabel yang difilternya (DESIGN_SYSTEM §10.3). */}
        <ListToolbar testId="coa-filter-card" className="items-end">
          <div className="min-w-[160px]">
            <Label className="text-xs font-medium text-muted-foreground">Tipe</Label>
            <SimpleSelect value={type} onValueChange={setType} ariaLabel="Tipe akun"
              options={TYPES.map(t => ({ value: t.v, label: t.l }))}
              className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="coa-type" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="coa-search" className="text-xs font-medium text-muted-foreground">Cari COA</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="coa-search" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Kode / nama akun…" className="glass-input pl-9 h-9" data-testid="coa-search" />
            </div>
          </div>
          <div className="flex items-center gap-2 h-9" data-testid="coa-postable-toggle">
            <Checkbox id="coa-postable-only" checked={postableOnly} onCheckedChange={v => setPostableOnly(!!v)} />
            <Label htmlFor="coa-postable-only" className="text-xs md:text-sm font-medium cursor-pointer select-none">Postable saja</Label>
          </div>
        </ListToolbar>
        <DataTable
          rows={filtered}
          keyField="code"
          loading={loading}
          rowTestIdPrefix="coa-row"
          empty={<EmptyState icon={Wallet} title="COA tidak ditemukan" description="Ubah tipe atau kata kunci pencarian." />}
          columns={[
            { key: "code", label: "Kode", sortable: true, primary: true,
              render: (c) => <span className={cn("text-xs font-medium tabular-nums", !c.is_postable && "text-muted-foreground")}>{c.code}</span> },
            { key: "name", label: "Nama", sortable: true,
              render: (c) => (
                <div className={cn(!c.is_postable && "text-muted-foreground")}>
                  <div className="font-medium">{c.name}</div>
                  {c.name_id && <div className="text-xs text-muted-foreground">{c.name_id}</div>}
                </div>
              ) },
            { key: "type", label: "Tipe", sortable: true,
              render: (c) => <span className="capitalize">{c.type}</span> },
            { key: "normal_balance", label: "Normal" },
            { key: "is_postable", label: "Postable",
              render: (c) => c.is_postable
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 font-medium">Yes</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 text-muted-foreground">Header</span> },
            { key: "active", label: "Aktif",
              render: (c) => c.active
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 font-medium">Aktif</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-800 dark:text-red-400 font-medium">Nonaktif</span> },
          ]}
        />
      </div>
      </div>
    </div>
  );
}
