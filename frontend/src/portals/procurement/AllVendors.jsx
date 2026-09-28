/** Procurement → All Vendors (procurement-specific view).
 * Read-only summary for procurement team: vendor list with last PO, terms, last price, contact.
 * Master CRUD remains at /admin/master/vendors.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Search, Plus, Mail, Phone, Award, ChevronRight, ExternalLink } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function AllVendors() {
  const { can } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = { per_page: 200, active: true };
      if (search) params.q = search;
      const res = await api.get("/master/vendors", { params });
      setVendors(unwrap(res) || []);
    } catch (e) {
      toast.error("Gagal load vendors");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-4" data-testid="procurement-vendors-page">
      <PageHeader
        icon={Store}
        title="All Vendors"
        subtitle="Direktori vendor untuk procurement team"
        action={
          can("admin.master_data.manage") && (
            <Button asChild className="rounded-full pill-active gap-2 h-10" data-testid="vendor-add-btn">
              <Link to="/admin/master/vendors">
                <Plus className="h-4 w-4" /> Kelola di Master
              </Link>
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="glass-card p-3 flex items-center gap-2" data-testid="vendor-search-bar">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Cari vendor (nama / kode)..."
          className="glass-input flex-1"
          data-testid="vendor-search"
        />
        <Button onClick={load} variant="outline" className="rounded-full" data-testid="vendor-search-btn">Cari</Button>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2" data-testid="vendor-quicklinks">
        <Link to="/procurement/vendor-comparison" className="text-xs glass-input rounded-full px-3 py-1.5 hover:shadow-md" data-testid="vendor-link-comparison">Vendor Comparison</Link>
        <Link to="/procurement/vendor-scorecard" className="text-xs glass-input rounded-full px-3 py-1.5 hover:shadow-md" data-testid="vendor-link-scorecard">Vendor Scorecard</Link>
        <Link to="/procurement/vendor-recommend" className="text-xs glass-input rounded-full px-3 py-1.5 hover:shadow-md" data-testid="vendor-link-recommend">AI Vendor Recommend</Link>
        <Link to="/procurement/vendor-catalog" className="text-xs glass-input rounded-full px-3 py-1.5 hover:shadow-md" data-testid="vendor-link-catalog">Vendor Item Catalog</Link>
      </div>

      {/* Vendor grid */}
      {loading ? (
        <span data-testid="vendor-grid-loading"><LoadingState rows={6} /></span>
      ) : vendors.length === 0 ? (
        <div className="glass-card" data-testid="vendor-grid-empty"><EmptyState icon={Store} title="Tidak ada vendor" description="Coba kata kunci lain atau tambahkan vendor baru di Master Data." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="vendor-grid">
          {vendors.map((v) => (
            <Link
              key={v.id}
              to={`/admin/master/vendors`}
              state={{ id: v.id }}
              className="glass-card p-4 hover:shadow-lg transition group"
              data-testid={`vendor-card-${v.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center text-sm font-bold text-foreground/80 shrink-0">
                  {(v.name || "V").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.code}</div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition shrink-0" />
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                {v.contact_name && <div>{v.contact_name}</div>}
                {v.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3 w-3" /> {v.phone}
                  </div>
                )}
                {v.email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{v.email}</span>
                  </div>
                )}
                {v.payment_term_days != null && (
                  <div className="text-muted-foreground">Term: <span className="font-medium">{v.payment_term_days} hari</span></div>
                )}
                {v.npwp && (
                  <div className="text-muted-foreground">NPWP: <span className="font-mono">{v.npwp}</span></div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
