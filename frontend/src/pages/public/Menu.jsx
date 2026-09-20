import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, SlidersHorizontal, X, FileText, Download, Star, ChevronDown, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import PageSEO from "@/components/shared/PageSEO";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const DIETARY_LABELS = {
  vegetarian: { label: "Vegetarian", color: "#4CAF50" },
  vegan: { label: "Vegan", color: "#2E7D32" },
  "gluten-free": { label: "GF", color: "#FF9800" },
  halal: { label: "Halal", color: "#00BCD4" },
  spicy: { label: "🌶 Spicy", color: "#F44336" },
  signature: { label: "★ Signature", color: "#9C27B0" },
  bestseller: { label: "♥ Bestseller", color: "#FF5722" },
};

function formatPrice(p) { return `Rp ${(p || 0).toLocaleString("id-ID")}`; }

function MenuImage({ src, alt, className = "" }) {
  const [err, setErr] = useState(false);
  const fullUrl = src && src.startsWith("/") ? `${BACKEND_URL}${src}` : src;
  if (!src || err) {
    return (
      <div className={`bg-muted/40 flex items-center justify-center ${className}`}
        style={{ background: "linear-gradient(135deg, hsl(36 20% 93%), hsl(30 14% 86%))" }}>
        <span className="text-2xl opacity-20">🍽</span>
      </div>
    );
  }
  return (
    <img src={fullUrl} alt={alt} className={`object-cover ${className}`}
      onError={() => setErr(true)} loading="lazy" />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-[#1C1510]/6">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function MenuItemCard({ item, brandColor, index }) {
  const isFeatured = item.is_featured;
  const isSoldOut = !item.is_available;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl overflow-hidden bg-white border border-[#1C1510]/8 group cursor-default
        ${ isFeatured ? "md:col-span-2" : ""}
        ${ isSoldOut ? "opacity-60 grayscale" : "hover:shadow-md"}
      `}
      style={{ boxShadow: isFeatured ? `0 0 0 1.5px ${brandColor}22` : undefined }}
      data-testid={`menu-item-card-${item.id}`}
    >
      <div className="relative">
        <AspectRatio ratio={isFeatured ? 16 / 7 : 4 / 3}>
          <MenuImage src={item.image_url} alt={item.name} className="w-full h-full transition-transform duration-500 group-hover:scale-[1.03]" />
        </AspectRatio>
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs font-semibold px-3 py-1" data-testid={`menu-item-sold-out-badge-${item.id}`}>Sold Out</Badge>
          </div>
        )}
        {item.is_featured && !isSoldOut && (
          <div className="absolute top-2 left-2">
            <Badge className="text-xs font-medium gap-1" style={{ backgroundColor: brandColor, color: "#fff", borderColor: "transparent" }}>
              <Star className="h-2.5 w-2.5 fill-white" /> Signature
            </Badge>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h4 className="font-semibold text-[#1C1510]/85 leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem" }}>{item.name}</h4>
          <span className="font-semibold text-sm tabular-nums whitespace-nowrap flex-shrink-0" style={{ color: brandColor }}>{formatPrice(item.price)}</span>
        </div>
        {item.description && (
          <p className="text-[#1C1510]/50 text-xs leading-relaxed line-clamp-2 mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.description}</p>
        )}
        {item.dietary_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.dietary_tags.filter(t => DIETARY_LABELS[t]).map(tag => {
              const def = DIETARY_LABELS[tag];
              return (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium border" style={{ borderColor: def.color + "44", color: def.color, backgroundColor: def.color + "11" }}>
                  {def.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Menu() {
  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pdf, setPdf] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dietaryFilter, setDietaryFilter] = useState([]);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Load brands on mount
  useEffect(() => {
    async function loadBrands() {
      try {
        const r = await api.get("/public/brands");
        const data = r.data?.data || [];
        setBrands(data);
        if (data.length > 0) setActiveBrandId(data[0].id);
      } catch (e) { logger.error("Menu data load failed", { error: e.message }); }
      finally { setLoadingBrands(false); }
    }
    loadBrands();
  }, []);

  // Load menu items + categories + PDF when brand changes
  useEffect(() => {
    if (!activeBrandId) return;
    setLoadingItems(true);
    setMenuItems([]);
    setCategories([]);
    setPdf(null);
    setCatFilter("all");
    setDietaryFilter([]);
    setQ("");

    async function loadMenuData() {
      try {
        const [itemsRes, catsRes, pdfRes] = await Promise.all([
          api.get(`/public/menu/brands/${activeBrandId}/items`),
          api.get(`/public/menu/brands/${activeBrandId}/categories`),
          api.get(`/public/menu/brands/${activeBrandId}/pdf`),
        ]);
        setMenuItems(itemsRes.data?.data || []);
        setCategories(catsRes.data?.data || []);
        setPdf(pdfRes.data?.data || null);
      } catch (e) { logger.error("Menu data load failed", { error: e.message }); }
      finally { setLoadingItems(false); }
    }
    loadMenuData();
  }, [activeBrandId]);

  const activeBrand = brands.find(b => b.id === activeBrandId);
  const brandColor = activeBrand?.color || "#1C1510";

  // Filter items
  const filteredItems = menuItems.filter(item => {
    const matchQ = !q || item.name.toLowerCase().includes(q.toLowerCase()) || (item.description || "").toLowerCase().includes(q.toLowerCase());
    const matchCat = catFilter === "all" || item.category === catFilter;
    const matchDietary = dietaryFilter.length === 0 || dietaryFilter.every(d => item.dietary_tags?.includes(d));
    return matchQ && matchCat && matchDietary;
  });

  // Group by category
  const categoryNames = categories.length > 0
    ? categories.map(c => c.name)
    : [...new Set(filteredItems.map(i => i.category))].filter(Boolean);

  const grouped = categoryNames.reduce((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  // Items not in any category
  const uncategorized = filteredItems.filter(i => !categoryNames.includes(i.category));
  if (uncategorized.length > 0) grouped["Other"] = uncategorized;

  const noResults = filteredItems.length === 0 && !loadingItems;
  const hasFilters = q || catFilter !== "all" || dietaryFilter.length > 0;

  const pdfFullUrl = pdf?.pdf_url && pdf.pdf_url.startsWith("/") ? `${BACKEND_URL}${pdf.pdf_url}` : pdf?.pdf_url;

  const DIETARY_FILTER_OPTIONS = ["vegetarian", "vegan", "gluten-free", "halal", "spicy", "signature", "bestseller"];

  return (
    <div className="min-h-screen bg-[#F8F5EF]" data-testid="menu-page">
      <PageSEO
        title="Menu"
        description="Jelajahi menu dari brand FnB Group. Dari specialty coffee The Coffeeshop, artisan bakery The Bakery, European bistro The Bistro, hingga Latin kitchen The Restaurant dan sports bar The Lounge."
        path="/menu"
        keywords="menu The Coffeeshop, menu The Restaurant, menu The Bistro, menu The Bakery, menu The Lounge, menu restoran Bandung"
      />

      {/* Hero Header */}
      <div className="pt-28 pb-8 px-6 lg:px-12 border-b border-[#1C1510]/10 bg-[#F8F5EF]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-2" style={{ fontFamily: "'Azeret Mono', monospace" }}>Menu Catalog</p>
          <h1 className="text-[#1C1510] leading-[0.88] tracking-[-0.03em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(44px, 6vw, 80px)", fontWeight: 600 }}>Our Menus</h1>
        </motion.div>
      </div>

      {/* Brand Tabs */}
      <div className="px-6 lg:px-12 py-5 bg-[#F8F5EF] border-b border-[#1C1510]/8 sticky top-0 z-20" style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(248,245,239,0.95)" }}>
        {loadingBrands ? (
          <div className="flex gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}</div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="brand-tabs">
            {brands.map(brand => (
              <button
                key={brand.id}
                onClick={() => setActiveBrandId(brand.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeBrandId === brand.id ? "text-white" : "text-[#1C1510]/60 border border-[#1C1510]/15 hover:border-[#1C1510]/25 bg-white/60"
                }`}
                style={activeBrandId === brand.id ? { backgroundColor: brand.color || "#1C1510", borderColor: "transparent" } : {}}
                data-testid={`brand-tab-${brand.code}`}
              >
                {brand.color && <div className="h-2 w-2 rounded-full bg-current opacity-80" style={{ backgroundColor: activeBrandId === brand.id ? "#fff" : brand.color }} />}
                {brand.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10">
        {/* Sticky Filter Bar */}
        <div className="sticky top-[88px] z-10 py-4 bg-[#F8F5EF]/95" style={{ backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1C1510]/40" />
              <Input
                className="pl-9 bg-white/80 border-[#1C1510]/15 focus:border-[#1C1510]/30 rounded-full h-9"
                placeholder="Cari menu..."
                value={q}
                onChange={e => setQ(e.target.value)}
                data-testid="menu-search-input"
              />
              {q && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQ("")}>
                  <X className="h-3.5 w-3.5 text-[#1C1510]/40" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-40 bg-white/80 border-[#1C1510]/15 rounded-full h-9" data-testid="menu-category-select">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Dietary Filter — desktop */}
            <div className="hidden lg:flex gap-1.5" data-testid="dietary-filters">
              {DIETARY_FILTER_OPTIONS.map(tag => {
                const def = DIETARY_LABELS[tag];
                const active = dietaryFilter.includes(tag);
                return (
                  <button key={tag} onClick={() => setDietaryFilter(f => active ? f.filter(t => t !== tag) : [...f, tag])}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active ? "text-white border-transparent" : "text-[#1C1510]/55 border-[#1C1510]/15 bg-white/70 hover:border-[#1C1510]/25"
                    }`}
                    style={active ? { backgroundColor: def?.color, borderColor: def?.color } : {}}
                    data-testid={`menu-dietary-toggle-${tag}`}
                  >
                    {def?.label || tag}
                  </button>
                );
              })}
            </div>

            {/* Mobile filter sheet */}
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden rounded-full h-9 border-[#1C1510]/15 bg-white/80" data-testid="mobile-filter-btn">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                  Filter
                  {dietaryFilter.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center" style={{ backgroundColor: brandColor }}>{dietaryFilter.length}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-8">
                <SheetHeader className="mb-4">
                  <SheetTitle>Filter Menu</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Dietary</Label>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_FILTER_OPTIONS.map(tag => {
                        const def = DIETARY_LABELS[tag];
                        const active = dietaryFilter.includes(tag);
                        return (
                          <button key={tag} onClick={() => setDietaryFilter(f => active ? f.filter(t => t !== tag) : [...f, tag])}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              active ? "text-white border-transparent" : "text-[#1C1510]/55 border-[#1C1510]/15 bg-white hover:border-[#1C1510]/25"
                            }`}
                            style={active ? { backgroundColor: def?.color, borderColor: def?.color } : {}}
                          >
                            {def?.label || tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setFilterSheetOpen(false)} style={{ backgroundColor: brandColor }}>Apply Filters</Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* PDF Button */}
            {pdf && (
              <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}
                className="ml-auto rounded-full h-9 border-[#1C1510]/20 bg-white/80 text-[#1C1510]/70 gap-1.5"
                data-testid="menu-pdf-preview-button">
                <FileText className="h-3.5 w-3.5" /> Download Menu PDF
              </Button>
            )}

            {/* Clear filters */}
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-[#1C1510]/50" onClick={() => { setQ(""); setCatFilter("all"); setDietaryFilter([]); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Hapus Filter
              </Button>
            )}
          </div>
        </div>

        {/* Brand name + active filters indicator */}
        {activeBrand && (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[#1C1510] leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 600 }}>{activeBrand.name}</h2>
              {activeBrand.tagline && <p className="text-[#1C1510]/45 text-sm italic mt-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{activeBrand.tagline}</p>}
            </div>
            {hasFilters && (
              <p className="text-xs text-[#1C1510]/40">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} ditemukan</p>
            )}
          </div>
        )}

        {/* Menu Content */}
        {loadingItems ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : noResults ? (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <div className="text-4xl mb-3 opacity-30">🍽</div>
              <p className="text-[#1C1510]/50 text-base">Tidak ada menu yang sesuai filter.</p>
              {hasFilters && (
                <Button variant="outline" className="mt-4" onClick={() => { setQ(""); setCatFilter("all"); setDietaryFilter([]); }}>Reset Filter</Button>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="pb-20">
            {Object.entries(grouped).map(([catName, catItems], ci) => (
              <div key={catName} className="mb-12">
                {/* Category Header */}
                <div className="flex items-center gap-4 mb-6">
                  <h3 className="font-semibold text-[#1C1510]/70 whitespace-nowrap" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem" }}>{catName}</h3>
                  <div className="flex-1 h-px bg-[#1C1510]/10" />
                  <span className="text-xs text-[#1C1510]/35 whitespace-nowrap">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {catItems.map((item, idx) => (
                    <MenuItemCard key={item.id} item={item} brandColor={brandColor} index={ci * 10 + idx} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[#1C1510]/25 text-xs pb-12 text-center">Harga adalah estimasi. Konfirmasi langsung ke outlet kami.</p>
      </div>

      {/* PDF Preview Modal */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0" aria-label="PDF Menu Preview">
          <DialogHeader className="px-6 pt-5 pb-4 flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {activeBrand?.name} — Menu PDF {pdf?.version ? `(${pdf.version})` : ""}
            </DialogTitle>
            <div className="flex gap-2">
              {pdfFullUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={pdfFullUrl} download target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4 mr-1.5" /> Download
                  </a>
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {pdfFullUrl ? (
              <iframe
                src={pdfFullUrl}
                title={`${activeBrand?.name} Menu PDF`}
                className="w-full h-full border rounded-xl"
                frameBorder="0"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>PDF tidak tersedia.</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
