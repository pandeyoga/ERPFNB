import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { MapPin, Clock, Phone, Mail, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import PageSEO from "@/components/shared/PageSEO";
import InteractiveMap from "../../components/InteractiveMap";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export default function Locations() {
  const [activeOutlet, setActiveOutlet] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [outletsRes, brandsRes] = await Promise.all([
          api.get("/public/outlets"),
          api.get("/public/brands"),
        ]);
        const outletsData = outletsRes.data?.data || [];
        const brandsData = brandsRes.data?.data || [];
        
        setOutlets(outletsData);
        setBrands(brandsData);
        
        if (outletsData.length > 0) {
          setActiveOutlet(outletsData[0].id);
        }
      } catch (error) {
        logger.error("Failed to fetch locations data", { error: error.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1C1510]/40" />
      </div>
    );
  }

  const selected = outlets.find((o) => o.id === activeOutlet) || outlets[0];
  const selectedBrand = selected ? brands.find((b) => b.id === selected.brand_id) : null;

  if (!loading && !selected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF]">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-[#1C1510]/30 mx-auto mb-3" />
          <p className="text-[#1C1510]/50 text-sm">Sedang memuat lokasi outlet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="locations-page">
      <PageSEO
        title="Lokasi Outlet FnB Group Bandung"
        description="Temukan semua outlet FnB Group di Bandung. Kunjungi The Coffeeshop, The Restaurant, The Bistro, The Lounge, dan The Bakery untuk pengalaman kuliner terbaik di Bandung."
        path="/locations"
        keywords="lokasi FnB Group, outlet Bandung, restoran di Bandung, cafe Bandung, The Coffeeshop lokasi, The Restaurant Bandung"
      />
      {/* Header */}
      <div className="pt-32 pb-12 px-6 lg:px-12 border-b border-[#1C1510]/10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Find Us</p>
          <h1 className="text-[#1C1510] leading-[0.88] tracking-[-0.03em] mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(52px, 7vw, 96px)", fontWeight: 600 }}>Our Locations</h1>
          <p className="text-[#1C1510]/50 text-sm max-w-sm">{outlets.length} outlet di Bandung dan sekitarnya.</p>
        </motion.div>
      </div>

      {/* Sprint C — Interactive Map Section */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-12">
        <Reveal>
          <h2 className="text-2xl font-serif font-bold text-[#1C1510] mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Temukan Lokasi Kami
          </h2>
          <p className="text-sm text-[#1C1510]/60 mb-6 max-w-2xl" style={{ fontFamily: "'Azeret Mono', monospace" }}>
            Jelajahi semua outlet FnB Group di peta interaktif. Klik marker untuk melihat detail lokasi, jam operasional, dan navigasi.
          </p>
          <InteractiveMap 
            outlets={outlets.filter(o => o.lat && o.lng).map(o => {
              const brand = brands.find(b => b.id === o.brand_id);
              return {
                ...o,
                brandId: brand?.code || 'the-coffeeshop', // Use brand code, not UUID
                brandName: o.brand_name,
                hours: { weekday: o.hours_weekday, weekend: o.hours_weekend }
              };
            })}
            className="w-full"
            data-testid="locations-interactive-map"
          />
        </Reveal>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-2" data-testid="locations-outlet-list">
            {outlets.map((outlet, i) => {
              const brand = brands.find((b) => b.id === outlet.brand_id);
              const isActive = activeOutlet === outlet.id;
              return (
                <Reveal key={outlet.id} delay={i * 0.04}>
                  <button
                    onClick={() => setActiveOutlet(outlet.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isActive ? "border-[#1C1510]/25 bg-white" : "border-[#1C1510]/10 bg-transparent hover:bg-white/60 hover:border-[#1C1510]/15"
                    }`}
                    data-testid={`outlet-list-item-${outlet.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brand?.color || "#C8A96E" }} />
                        <div>
                          <p className={`text-sm font-medium ${isActive ? "text-[#1C1510]" : "text-[#1C1510]/65"}`}>{outlet.name}</p>
                          <p className="text-[#1C1510]/35 text-[10px] mt-0.5" style={{ fontFamily: "'Azeret Mono', monospace" }}>{outlet.area}</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-colors ${isActive ? "text-[#1C1510]/40" : "text-[#1C1510]/15"}`} />
                    </div>
                  </button>
                </Reveal>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeOutlet}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-[#1C1510]/15 overflow-hidden bg-white"
            >
              {/* Image placeholder */}
              <div
                className="relative h-52 border-b border-[#1C1510]/10"
                style={{ background: `linear-gradient(135deg, ${selectedBrand?.accentColor || "rgba(200,169,110,0.12)"}, #F0EAE0)` }}
                data-testid="locations-map-placeholder"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 text-[#1C1510]/20 mx-auto mb-2" />
                    <p className="text-[#1C1510]/30 text-xs">Map coming soon</p>
                  </div>
                </div>
                <a href={selected?.mapUrl} target="_blank" rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#1C1510]/15 text-[#1C1510]/60 text-xs hover:text-[#1C1510] transition-colors"
                  data-testid="outlet-open-maps-link">
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: selectedBrand?.color || "#C8A96E", color: "white" }}>
                    {selectedBrand?.name?.[0] || "T"}
                  </div>
                  <div>
                    <h2 className="text-[#1C1510]/90 font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem" }}>{selected?.name}</h2>
                    <p className="text-[#1C1510]/40 text-xs">{selected?.brand_name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selected && [
                    { icon: MapPin, text: selected.address || "Bandung, Jawa Barat" },
                    { icon: Clock, text: `Mon–Fri: ${selected.hours_weekday || '10:00–22:00'} · Sat–Sun: ${selected.hours_weekend || '09:00–23:00'}` },
                    selected.phone ? { icon: Phone, text: selected.phone, href: `tel:${selected.phone}` } : null,
                    selected.email ? { icon: Mail, text: selected.email, href: `mailto:${selected.email}` } : null,
                  ].filter(Boolean).map(({ icon: Icon, text, href }, i) => (
                    <div key={i} className="flex gap-3">
                      <Icon className="h-4 w-4 text-[#C8A96E] mt-0.5 flex-shrink-0" />
                      {href ? (
                        <a href={href} className="text-[#1C1510]/60 text-sm hover:text-[#1C1510] transition-colors">{text}</a>
                      ) : (
                        <p className="text-[#1C1510]/60 text-sm">{text}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-[#1C1510]/10">
                  {(selected?.features || []).map((f) => (
                    <span key={f} className="px-3 py-1 rounded-full text-[10px] border border-[#1C1510]/15 text-[#1C1510]/45">{f}</span>
                  ))}
                  {(!selected?.features || selected.features.length === 0) && (
                    <span className="px-3 py-1 rounded-full text-[10px] border border-[#1C1510]/15 text-[#1C1510]/45">Dine In</span>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
