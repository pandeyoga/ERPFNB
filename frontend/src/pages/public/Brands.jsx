import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, Loader2 } from "lucide-react";
import PageSEO from "@/components/shared/PageSEO";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

const DEFAULT_BRAND_IMAGE = "https://images.unsplash.com/photo-1663152350760-8a660b378614?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600";

// Fallback images by brand code (slug) — used when CMS image is not set
const BRAND_IMAGES = {
  "the-coffeeshop": "https://images.unsplash.com/photo-1768675142660-949249bcd484?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
  "the-restaurant": "https://images.unsplash.com/photo-1557079604-d28080618be0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
  "the-bistro": "https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
  "the-bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
};

/** Resolve brand image: CMS hero → CMS card → fallback by code → generic */
function getBrandImage(brand) {
  return brand.hero_image || brand.card_image || BRAND_IMAGES[brand.code] || DEFAULT_BRAND_IMAGE;
}

const BRAND_MOODS = {
  "the-coffeeshop": "Warm. Familiar. Vibrant.",
  "the-restaurant": "Bold. Celebratory. Soulful.",
  "the-bistro": "Refined. Intimate. Timeless.",
  "the-bakery": "Artisan. Fresh. Comforting.",
};

function BrandRow({ brand, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isEven = index % 2 === 0;

  return (
    <article
      ref={ref}
      className="grid grid-cols-1 lg:grid-cols-2 border-b border-[#1C1510]/10 last:border-0"
      data-testid="brands-grid-brand-card"
    >
      {/* Image */}
      <motion.div
        className={`relative overflow-hidden h-[55vw] max-h-[560px] min-h-[320px] ${
          isEven ? "lg:order-1" : "lg:order-2"
        } compro-img-hover`}
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to={`/brands/${brand.id}`} data-testid="brand-card-link">
          <motion.div
            className="absolute inset-0 bg-cover bg-center compro-img-inner"
            style={{ backgroundImage: `url(${getBrandImage(brand)})` }}
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Subtle bottom gradient */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(28,21,16,0.3) 0%, transparent 60%)" }} />
          {/* Brand color accent */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: brand.color }} />
        </Link>
      </motion.div>

      {/* Text */}
      <div
        className={`flex items-center justify-center px-10 sm:px-16 lg:px-20 py-20 lg:py-0 bg-[#F8F5EF] ${
          isEven ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <div className="max-w-sm w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.color }} />
              <span className="text-[#1C1510]/40 text-[9px] tracking-[0.3em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                Est. {brand.established}
              </span>
            </div>

            <h2
              className="text-[#1C1510] leading-[0.9] tracking-[-0.025em] mb-4"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(48px, 6vw, 80px)",
                fontWeight: 600,
              }}
            >
              {brand.name}
            </h2>

            <p
              className="text-[#1C1510]/45 italic mb-2"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem" }}
            >
              {BRAND_MOODS[brand.id]}
            </p>

            <span className="compro-divider" />

            <p className="text-[#1C1510]/50 text-sm leading-relaxed mb-6">{brand.shortDesc}</p>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-8">
              {brand.tags.map((tag, ti) => (
                <span
                  key={tag}
                  className="text-[9px] text-[#1C1510]/40 tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Azeret Mono', monospace" }}
                >
                  {ti > 0 && <span className="mr-3 text-[#C8A96E]">·</span>}{tag}
                </span>
              ))}
            </div>

            <Link
              to={`/brands/${brand.id}`}
              className="compro-link text-sm font-medium text-[#1C1510] hover:text-[#1C1510]/70 transition-colors"
            >
              Discover {brand.name}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </article>
  );
}

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await api.get("/public/brands");
        setBrands(response.data?.data || []);
      } catch (error) {
        logger.error("Failed to fetch brands", { error: error.message });
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1C1510]/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="brands-page">
      <PageSEO
        title="Our Brands — 5 Konsep F&B Terbaik Bandung"
        description="Kenali 5 brand ikonik FnB Group Bandung: The Coffeeshop (specialty coffee), The Restaurant (fine dining), The Bistro (bistro), The Lounge (sports bar), dan The Bakery (artisan bakery)."
        path="/brands"
        keywords="brand restoran bandung, cafe bandung, fine dining bandung, fnbgroup group brands"
        path="/brands"
        keywords="The Coffeeshop, The Restaurant Jakarta, The Bistro café, The Bakery Bandung, brand FnB Group"
      />
      {/* Page Header */}
      <div className="pt-32 pb-16 px-6 lg:px-12 border-b border-[#1C1510]/10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p
            className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-4"
            style={{ fontFamily: "'Azeret Mono', monospace" }}
          >
            Our Portfolio
          </p>
          <h1
            className="text-[#1C1510] leading-[0.88] tracking-[-0.03em] mb-5"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(56px, 8vw, 110px)",
              fontWeight: 600,
            }}
          >
            Our Brands,
            <br />
            <em className="italic text-[#1C1510]/45">One Vision</em>
          </h1>
          <p className="text-[#1C1510]/50 text-sm max-w-md leading-relaxed">
            Setiap brand kami memiliki identitas unik — filosofi tersendiri dan pengalaman yang tak terlupakan.
          </p>
        </motion.div>
      </div>

      {/* Alternating brand rows */}
      <div data-testid="brands-grid">
        {brands.map((brand, i) => (
          <BrandRow key={brand.id} brand={brand} index={i} />
        ))}
      </div>
    </div>
  );
}
