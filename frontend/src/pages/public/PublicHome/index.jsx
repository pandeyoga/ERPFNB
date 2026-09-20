import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ArrowRight, Loader2 } from "lucide-react";
import PageSEO from "@/components/shared/PageSEO";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

// ---- Scroll Reveal Component ----
function Reveal({ children, delay = 0, y = 40, className = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---- Marquee ----
function Marquee() {
  const items = ["THE COFFEESHOP", "THE RESTAURANT", "THE BISTRO", "THE BAKERY", "THE COFFEESHOP", "THE RESTAURANT", "THE BISTRO", "THE BAKERY"];
  return (
    <div className="overflow-hidden border-y border-[#1C1510]/10 py-4 bg-[#F0EAE0]">
      <div className="compro-marquee flex gap-12 whitespace-nowrap">
        {items.map((item, i) => (
          <span
            key={i}
            className="text-xs tracking-[0.35em] font-medium text-[#1C1510]/40 flex items-center gap-12 flex-shrink-0"
            style={{ fontFamily: "'Azeret Mono', monospace" }}
          >
            {item}
            <span className="inline-block h-1 w-1 rounded-full bg-[#C8A96E]"></span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Hero ----
function Hero() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={heroRef}
      className="relative h-[100svh] min-h-[600px] overflow-hidden"
      data-testid="hero-section"
    >
      {/* Background image with parallax */}
      <motion.div className="absolute inset-0" style={{ y: imgY }}>
        <div
          className="absolute inset-[-10%] bg-cover bg-center"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1663530761401-15eefb544889?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400)`,
          }}
        />
        {/* Warm overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(28,21,16,0.45) 0%, rgba(28,21,16,0.2) 50%, rgba(28,21,16,0.7) 100%)" }} />
      </motion.div>

      {/* Hero content */}
      <motion.div
        style={{ y: textY, opacity }}
        className="relative z-10 h-full flex flex-col items-center justify-end pb-24 px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="text-white/60 text-[11px] tracking-[0.3em] uppercase mb-5"
          style={{ fontFamily: "'Azeret Mono', monospace" }}
        >
          FnB Group · Bandung · Est. 2018
        </motion.p>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1.2 }}
          className="text-white text-[56px] sm:text-[80px] lg:text-[108px] leading-[0.88] font-semibold tracking-[-0.03em] mb-8"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Creating
          <br />
          <em className="italic">the Good</em>
          <br />
          Food
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="text-white/65 text-base sm:text-lg max-w-sm leading-relaxed mb-10"
        >
          Empat brand F&B premium yang merayakan setiap momen kehidupan.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link
            to="/brands"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-[#1C1510] bg-[#F8F5EF] rounded-full hover:bg-white transition-colors"
            data-testid="hero-primary-cta-button"
          >
            Explore Brands
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            to="/reservation"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white border border-amber-400/60 bg-amber-500/10 rounded-full hover:bg-amber-500/20 transition-colors"
            data-testid="hero-reservation-cta-button"
          >
            Reservasi Meja
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            to="/locations"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors"
            data-testid="hero-secondary-cta-button"
          >
            Find a Location
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-8 right-8 flex flex-col items-center gap-2"
      >
        <span className="text-white/40 text-[9px] tracking-[0.3em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace", writingMode: "vertical-lr" }}>Scroll</span>
        <motion.div
          className="w-px h-12 bg-white/30"
          animate={{ scaleY: [0, 1, 0], y: [0, 0, 12] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "top" }}
        />
      </motion.div>
    </section>
  );
}

// ---- Brand Split Sections (ISMAYA-style) ----
const BRAND_EXTRAS = {
  "the-coffeeshop": {
    bgImage: "https://images.unsplash.com/photo-1768675142660-949249bcd484?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
    concept: "Specialty Coffee & All-Day Dining",
    mood: "Warm. Familiar. Vibrant.",
  },
  "the-restaurant": {
    bgImage: "https://images.unsplash.com/photo-1557079604-d28080618be0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
    concept: "Modern Latin & Mediterranean",
    mood: "Bold. Vibrant. Celebratory.",
  },
  "the-bistro": {
    bgImage: "https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
    concept: "European Bistro & Wine",
    mood: "Refined. Intimate. Timeless.",
  },
  "the-bakery": {
    bgImage: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1600",
    concept: "Artisan Bakery & Patisserie",
    mood: "Warm. Crafted. Comforting.",
  },
};

function BrandSplitSection({ brand, index }) {
  const isEven = index % 2 === 0;
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  // Normalize brand ID: try direct match, then lowercase, then slug
  const brandKey = brand.code || brand.id || "";
  const extra = BRAND_EXTRAS[brandKey] ||
    BRAND_EXTRAS[brandKey.toLowerCase()] ||
    BRAND_EXTRAS[brandKey.toLowerCase().replace(/\s+/g, "-")] ||
    Object.values(BRAND_EXTRAS)[index % Object.keys(BRAND_EXTRAS).length] || {};

  return (
    <section
      ref={sectionRef}
      className="grid grid-cols-1 lg:grid-cols-2 min-h-[75vh]"
      data-testid={`brand-split-section-${brand.id}`}
    >
      {/* Image */}
      <motion.div
        className={`relative overflow-hidden h-[50vh] lg:h-auto ${isEven ? "lg:order-1" : "lg:order-2"}`}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        data-cursor-hover
      >
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${extra.bgImage})` }}
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: isEven
              ? "linear-gradient(to right, transparent, rgba(248,245,240,0.1))"
              : "linear-gradient(to left, transparent, rgba(248,245,240,0.1))",
          }}
        />
        {/* Brand color accent strip */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: brand.color }}
        />
      </motion.div>

      {/* Text */}
      <div
        className={`flex items-center px-8 sm:px-12 lg:px-16 py-16 lg:py-0 bg-[#F8F5EF] ${
          isEven ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <div className="max-w-md">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-5"
            style={{ fontFamily: "'Azeret Mono', monospace" }}
          >
            {extra.concept}
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#1C1510] leading-[0.9] tracking-[-0.025em] mb-5"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(44px, 5vw, 72px)",
              fontWeight: 600,
            }}
          >
            {brand.name}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="text-[#1C1510]/55 text-sm leading-relaxed mb-3 italic"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem" }}
          >
            {extra.mood}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-[#1C1510]/50 text-sm leading-relaxed mb-8"
          >
            {brand.short_desc}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            {brand.tags.map((t) => (
              <span key={t} className="text-[10px] text-[#1C1510]/50 tracking-[0.15em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                {t}
              </span>
            ))}
            {brand.tags.length > 1 && brand.tags.map((_, i) => i < brand.tags.length - 1 && (
              <span key={`dot-${i}`} className="text-[#C8A96E] text-[10px]">·</span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7, duration: 0.7 }}
          >
            <Link
              to={`/brands/${brand.id}`}
              className="group inline-flex items-center gap-2 text-sm font-medium text-[#1C1510] border-b border-[#1C1510]/30 pb-0.5 hover:border-[#1C1510] transition-colors"
            >
              Explore {brand.name}
              <motion.span
                className="inline-block"
                initial={{ x: 0 }}
                whileHover={{ x: 3 }}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ---- Immersive Food Gallery ----
const FOOD_GALLERY = [
  { src: "https://images.unsplash.com/photo-1663530761401-15eefb544889?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Signature Plate", brand: "The Bistro" },
  { src: "https://images.unsplash.com/photo-1557079604-d28080618be0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Chef's Tasting", brand: "The Bistro" },
  { src: "https://images.unsplash.com/photo-1768675142660-949249bcd484?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Morning Ritual", brand: "The Coffeeshop" },
  { src: "https://images.unsplash.com/photo-1766491764801-bc6e409b60e4?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Sweet Moments", brand: "The Restaurant" },
  { src: "https://images.unsplash.com/photo-1763683944352-1ac92bf9d723?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Sunday Brunch", brand: "The Coffeeshop" },
  { src: "https://images.unsplash.com/photo-1557079790-51bc14db8421?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800", label: "Garden Plate", brand: "The Bistro" },
];

function FoodGallery() {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e) => {
    setDragging(true);
    setStartX(e.pageX - trackRef.current.offsetLeft);
    setScrollLeft(trackRef.current.scrollLeft);
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    trackRef.current.scrollLeft = scrollLeft - walk;
  };
  const onMouseUp = () => setDragging(false);

  return (
    <section className="py-20 sm:py-28" data-testid="food-gallery-section">
      <div className="px-6 lg:px-12 mb-10">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Gallery</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 600 }}>
                Every Plate,
                <em className="italic"> a Story</em>
              </h2>
            </div>
            <p className="text-[#1C1510]/35 text-xs hidden sm:block" style={{ fontFamily: "'Azeret Mono', monospace" }}>← drag to explore →</p>
          </div>
        </Reveal>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-4 px-6 lg:px-12"
        style={{ scrollbarWidth: "none", cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {FOOD_GALLERY.map((item, i) => (
          <motion.div
            key={i}
            className="flex-shrink-0 relative overflow-hidden rounded-2xl group"
            style={{ width: "clamp(260px, 30vw, 380px)", height: "clamp(340px, 40vw, 480px)" }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.7 }}
            whileHover={{ y: -4 }}
            data-testid="gallery-item"
          >
            <motion.div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${item.src})` }}
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(28,21,16,0.7) 0%, transparent 50%)" }} />
            <div className="absolute bottom-0 left-0 p-6">
              <p className="text-white/50 text-[9px] tracking-[0.25em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>{item.brand}</p>
              <p className="text-white text-base font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ---- In The News ----
function InTheNews({ news }) {
  const featured = news.slice(0, 4);
  return (
    <section className="py-20 sm:py-28 border-t border-[#1C1510]/10" data-testid="news-teaser-section">
      <div className="px-6 lg:px-12">
        <Reveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>In the News</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 56px)", fontWeight: 600 }}>
                Each moment the
                <br />
                <em className="italic">world recognizes us</em>
              </h2>
            </div>
            <Link to="/news" className="hidden sm:flex items-center gap-1.5 text-[13px] text-[#1C1510]/50 hover:text-[#1C1510] transition-colors border-b border-[#1C1510]/20 pb-0.5" data-testid="news-see-all-link">
              See all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="news-post-list">
          {featured.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.07}>
              <Link to="/news" className="group block">
                <motion.div
                  className="overflow-hidden rounded-xl mb-4"
                  style={{ aspectRatio: "3/2" }}
                  whileHover={{ y: -2 }}
                >
                  <motion.div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${post.image})` }}
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </motion.div>
                <p className="text-[#C8A96E] text-[9px] tracking-[0.25em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>{post.category}</p>
                <h3 className="text-[#1C1510]/85 text-sm font-semibold leading-snug group-hover:text-[#1C1510] transition-colors line-clamp-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem" }}>
                  {post.title}
                </h3>
                <p className="text-[#1C1510]/40 text-xs mt-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                  {new Date(post.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Reservation CTA ----
function ReservationCTA() {
  return (
    <section className="py-20 sm:py-28 border-t border-[#1C1510]/10" data-testid="reservation-cta-section">
      <div className="px-6 lg:px-12 max-w-screen-lg mx-auto">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-8 sm:p-12 text-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #C8A96E 0%, transparent 60%)" }} />
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-8">
              <div>
                <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-3">Online Reservasi</p>
                <h2 className="text-3xl sm:text-4xl font-bold mb-3">Pesan Meja Anda<br />Sekarang</h2>
                <p className="text-stone-300 max-w-md">
                  Nikmati pengalaman kuliner tak terlupakan. Reservasi mudah dan cepat — pilih outlet, waktu, dan jumlah tamu favorit Anda.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <Link
                  to="/reservation"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition-colors"
                  data-testid="reservation-cta-button"
                >
                  Reservasi Meja <ArrowUpRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://wa.me/6281234567890?text=Halo%2C%20saya%20ingin%20reservasi%20meja"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-stone-600 text-white rounded-full hover:bg-stone-700 transition-colors"
                >
                  Via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Loyalty CTA ----
function LoyaltyCTA() {
  return (
    <section className="py-20 sm:py-28 border-t border-[#1C1510]/10" data-testid="loyalty-cta-section">
      <div className="px-6 lg:px-12 max-w-screen-lg mx-auto">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C8A96E] via-[#B8983E] to-[#8B7355] p-8 sm:p-12 text-white">
            {/* Decorative elements */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-[#1C1510]/10 rounded-full blur-3xl" />
            
            <div className="relative z-10 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="inline-block mb-4"
              >
                <div className="h-16 w-16 mx-auto rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-4">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </motion.div>
              
              <p className="text-white/70 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                FnB Rewards
              </p>
              
              <h2 className="text-white leading-tight tracking-[-0.025em] mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600 }}>
                Setiap Kunjungan
                <br />
                <em className="italic">Lebih Berarti</em>
              </h2>
              
              <p className="text-white/80 text-sm leading-relaxed max-w-md mx-auto mb-8">
                Bergabung dengan FnB Group Loyalty Program. Kumpulkan poin di setiap transaksi, tukar reward eksklusif, dan nikmati benefit istimewa sebagai member setia kami.
              </p>
              
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <span className="text-2xl">🎁</span>
                  <span className="text-xs font-medium">Exclusive Rewards</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <span className="text-2xl">⭐</span>
                  <span className="text-xs font-medium">Earn Points</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <span className="text-2xl">🎂</span>
                  <span className="text-xs font-medium">Birthday Bonus</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  to="/loyalty/register"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-[#1C1510] bg-white rounded-full hover:bg-white/90 transition-colors"
                  data-testid="loyalty-register-cta"
                >
                  Daftar Sekarang
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/loyalty/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white border-2 border-white/30 rounded-full hover:bg-white/10 transition-colors"
                  data-testid="loyalty-login-cta"
                >
                  Login Member
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Careers CTA ----
function CareersCTA({ outlets }) {
  return (
    <section className="py-24 border-t border-[#1C1510]/10" data-testid="careers-cta-section">
      <div className="px-6 lg:px-12">
        <Reveal>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>Join Us</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-5" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(40px, 5vw, 68px)", fontWeight: 600 }}>
                Be Part of
                <br />
                <em className="italic text-[#1C1510]/50">Something Great</em>
              </h2>
              <p className="text-[#1C1510]/50 text-sm leading-relaxed mb-8 max-w-sm">
                Bergabunglah dengan tim kami yang passionate — 250+ individu yang mendedikasikan diri pada keunggulan kuliner.
              </p>
              <Link
                to="/careers"
                className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium text-white bg-[#1C1510] rounded-full hover:bg-[#1C1510]/85 transition-colors"
                data-testid="careers-cta-button"
              >
                View Open Positions
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {outlets.slice(0, 4).map((outlet, i) => (
                <motion.div
                  key={outlet.id}
                  className="p-5 rounded-xl border border-[#1C1510]/10 bg-[#F0EAE0] hover:border-[#1C1510]/20 transition-colors"
                  whileHover={{ y: -2 }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.6 }}
                >
                  <p className="text-[#1C1510]/80 text-sm font-medium">{outlet.name}</p>
                  <p className="text-[#1C1510]/40 text-xs mt-1">{outlet.area}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function PublicHome() {
  const [brands, setBrands] = useState([]);
  const [news, setNews] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [brandsRes, newsRes, outletsRes] = await Promise.all([
          api.get("/public/brands"),
          api.get("/public/news", { params: { limit: 6 } }),
          api.get("/public/outlets"),
        ]);
        setBrands(brandsRes.data?.data || []);
        setNews(newsRes.data?.data || []);
        setOutlets(outletsRes.data?.data || []);
      } catch (error) {
        logger.error("Failed to fetch home page data", { error: error.message });
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

  return (
    <div data-testid="public-home-page">
      <PageSEO
        title="Crafted F&B Experiences in Bandung"
        description="FnB Group menghadirkan pengalaman kuliner autentik melalui 5 brand ikonik di Bandung: The Coffeeshop, The Restaurant, The Bistro, The Lounge, dan The Bakery. Temukan cita rasa terbaik Bandung."
        path="/"
        keywords="restoran bandung, cafe bandung premium, fine dining bandung, fnbgroup group bandung, kuliner bandung terbaik"
      />
      <Hero />
      <Marquee />
      {brands.map((brand, i) => (
        <BrandSplitSection key={brand.id} brand={brand} index={i} />
      ))}
      <FoodGallery />
      {news.length > 0 && <InTheNews news={news} />}
      <ReservationCTA />
      <LoyaltyCTA />
      {outlets.length > 0 && <CareersCTA outlets={outlets} />}
    </div>
  );
}
