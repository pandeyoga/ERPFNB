/** Procurement → All Vendors (procurement-specific view).
 * Read-only summary for procurement team: vendor list with last PO, terms, last price, contact.
 * Master CRUD remains at /admin/master/vendors.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Search, Mail, Phone, ChevronRight, ExternalLink, Scale, Award, Sparkles, BookOpen } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const QUICK_LINKS = [
  { to: "/procurement/vendor-comparison", label: "Vendor Comparison", icon: Scale, testId: "vendor-link-comparison" },
  { to: "/procurement/vendor-scorecard", label: "Vendor Scorecard", icon: Award, testId: "vendor-link-scorecard" },
  { to: "/procurement/vendor-recommend", label: "Vendor Recommendation (AI)", icon: Sparkles, testId: "vendor-link-recommend" },
  { to: "/procurement/vendor-catalog", label: "Vendor Item Catalog", icon: BookOpen, testId: "vendor-link-catalog" },
];

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
      toast.error("Gagal memuat vendor");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="procurement-vendors-page">
      <PageHeader
        icon={Store}
        title="Vendors"
        subtitle="Direktori vendor aktif untuk tim procurement. Klik vendor untuk melihat katalog & riwayat harganya."
        actions={
          can("admin.master_data.manage") && (
            <Button asChild variant="outline" data-testid="vendor-add-btn">
              <Link to="/admin/master/vendors">
                <ExternalLink /> Kelola di Master Data
              </Link>
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="glass-card p-3 flex items-center gap-2" data-testid="vendor-search-bar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Cari vendor (nama / kode)…"
            aria-label="Cari vendor"
            className="glass-input pl-9"
            data-testid="vendor-search"
          />
        </div>
        <Button onClick={load} variant="outline" data-testid="vendor-search-btn">Cari</Button>
      </div>

      {/* Quick links — halaman analitik vendor (tidak ada di sidebar) */}
      <div className="flex flex-wrap gap-2" data-testid="vendor-quicklinks">
        {QUICK_LINKS.map(({ to, label, icon: Icon, testId }) => (
          <Button key={to} asChild variant="outline" size="sm" data-testid={testId}>
            <Link to={to}><Icon /> {label}</Link>
          </Button>
        ))}
      </div>

      {/* Vendor grid */}
      {loading ? (
        <div data-testid="vendor-grid-loading"><LoadingState rows={6} /></div>
      ) : vendors.length === 0 ? (
        <div className="glass-card" data-testid="vendor-grid-empty"><EmptyState icon={Store} title="Tidak ada vendor" description="Coba kata kunci lain atau tambahkan vendor baru di Master Data." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="vendor-grid">
          {vendors.map((v) => (
            <Link
              key={v.id}
              to={`/procurement/vendor-catalog?vendor=${v.id}`}
              className="glass-card p-4 hover:shadow-md hover:border-primary/30 transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Lihat katalog harga ${v.name}`}
              data-testid={`vendor-card-${v.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center text-sm font-semibold text-foreground/80 shrink-0">
                  {(v.name || "V").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.code}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
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
                  <div className="text-muted-foreground">Termin: <span className="font-medium">{v.payment_term_days} hari</span></div>
                )}
                {v.npwp && (
                  <div className="text-muted-foreground">NPWP: <span className="tabular-nums">{v.npwp}</span></div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
