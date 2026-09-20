import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import PageSEO from "@/components/shared/PageSEO";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Phone, Loader2, Instagram, Heart, MessageCircle, ExternalLink, X, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { logger } from "@/lib/logger";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DOMPurify from "dompurify";
import api from "@/lib/api";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

function trackView(contentType, contentId) {
  axios.post(`${BACKEND_URL}/api/public/analytics/track`, { content_type: contentType, content_id: contentId }).catch(() => {});
}

const BRAND_IMAGES = {
  "the-coffeeshop": "https://images.unsplash.com/photo-1768675142660-949249bcd484?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800",
  "the-restaurant": "https://images.unsplash.com/photo-1557079604-d28080618be0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800",
  "the-bistro": "https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800",
  "the-bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800",
  "the-lounge": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1800",
};

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SafeHTML({ html, className = "" }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const isPlain = !/<[a-z][\s\S]*>/i.test(clean);
  if (isPlain) return <p className={className || "text-[#1C1510]/55 text-sm leading-relaxed mb-6"}>{html}</p>;
  return (
    <div
      className={className || "prose prose-sm prose-neutral max-w-none text-[#1C1510]/70 leading-relaxed mb-6"}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ── Instagram Feed Section ────────────────────────────────────────────────────
function InstagramFeed({ brand, posts }) {
  const [lightbox, setLightbox] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  if (!posts || posts.length === 0) return null;

  const activePosts = posts.filter(p => p.active !== false);
  if (activePosts.length === 0) return null;

  const openLightbox = (post, idx) => {
    setLightbox(post);
    setLightboxIdx(idx);
  };

  const prev = () => {
    const newIdx = (lightboxIdx - 1 + activePosts.length) % activePosts.length;
    setLightboxIdx(newIdx);
    setLightbox(activePosts[newIdx]);
  };

  const next = () => {
    const newIdx = (lightboxIdx + 1) % activePosts.length;
    setLightboxIdx(newIdx);
    setLightbox(activePosts[newIdx]);
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (diff === 0) return "Hari ini";
      if (diff === 1) return "Kemarin";
      if (diff < 7) return `${diff} hari lalu`;
      if (diff < 30) return `${Math.floor(diff / 7)} minggu lalu`;
      if (diff < 365) return `${Math.floor(diff / 30)} bulan lalu`;
      return `${Math.floor(diff / 365)} tahun lalu`;
    } catch { return ""; }
  };

  return (
    <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-16 border-t border-[#1C1510]/10" data-testid="brand-instagram-section">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <Reveal>
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Social</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>
                @{brand.instagram_username || brand.instagram?.replace("@", "") || brand.code}
              </h2>
            </div>
            {brand.instagram && (
              <a
                href={`https://instagram.com/${brand.instagram_username || brand.instagram?.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#1C1510]/20 text-[#1C1510]/70 text-sm hover:border-[#1C1510]/50 hover:text-[#1C1510] transition-all group"
              >
                <Instagram className="w-4 h-4" />
                <span>Ikuti Kami</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </Reveal>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-1 sm:gap-2">
          {activePosts.slice(0, 9).map((post, idx) => (
            <Reveal key={post.id} delay={idx * 0.05}>
              <motion.button
                onClick={() => openLightbox(post, idx)}
                className="relative w-full aspect-square overflow-hidden rounded-sm group bg-[#F0EAE0] focus:outline-none"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.3 }}
                aria-label={`View Instagram post`}
              >
                {/* Image */}
                <motion.img
                  src={post.thumbnail_url || post.image_url}
                  alt={post.caption?.slice(0, 60)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => { e.target.src = BRAND_IMAGES[brand.code] || ""; }}
                />

                {/* Pinned badge */}
                {post.is_pinned && (
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full">
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-4 text-white">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Heart className="w-4 h-4" />
                      {post.likes?.toLocaleString("id-ID")}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <MessageCircle className="w-4 h-4" />
                      {post.comments?.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </motion.button>
            </Reveal>
          ))}
        </div>

        {/* Mobile follow button */}
        {brand.instagram && (
          <Reveal>
            <div className="mt-8 flex justify-center sm:hidden">
              <a
                href={`https://instagram.com/${brand.instagram_username || brand.instagram?.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#1C1510]/20 text-[#1C1510]/70 text-sm hover:border-[#1C1510]/50 transition-all"
              >
                <Instagram className="w-4 h-4" />
                Ikuti @{brand.instagram_username || brand.instagram?.replace("@", "")}
              </a>
            </div>
          </Reveal>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image side */}
              <div className="relative md:w-[55%] bg-black flex items-center justify-center min-h-[300px]">
                <img
                  src={lightbox.image_url}
                  alt={lightbox.caption?.slice(0, 60)}
                  className="w-full h-full object-cover max-h-[60vh] md:max-h-none"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.target.src = BRAND_IMAGES[brand.code] || ""; }}
                />
                {/* Nav arrows */}
                {activePosts.length > 1 && (
                  <>
                    <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Content side */}
              <div className="md:w-[45%] flex flex-col overflow-y-auto">
                {/* Brand header */}
                <div className="flex items-center gap-3 p-4 border-b">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: brand.color }}>
                    {brand.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{brand.instagram || `@${brand.code}`}</p>
                    <p className="text-xs text-gray-500">{brand.name}</p>
                  </div>
                  {lightbox.post_url && (
                    <a href={lightbox.post_url} target="_blank" rel="noopener noreferrer"
                       className="text-gray-400 hover:text-gray-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Caption */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                    {lightbox.caption}
                  </p>
                </div>

                {/* Stats */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-4 mb-2">
                    <button className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-500 transition-colors">
                      <Heart className="w-5 h-5" />
                      <span className="font-medium">{lightbox.likes?.toLocaleString("id-ID")}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">
                      <MessageCircle className="w-5 h-5" />
                      <span>{lightbox.comments?.toLocaleString("id-ID")}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">{fmtDate(lightbox.posted_at)}</p>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BrandDetail() {
  const { brandId } = useParams();
  const [brand, setBrand] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [igPosts, setIgPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [brandRes, outletsRes] = await Promise.all([
          api.get(`/public/brands/${brandId}`),
          api.get("/public/outlets", { params: { brand_id: brandId } }),
        ]);
        const brandData = brandRes.data?.data;
        setBrand(brandData);
        setOutlets(outletsRes.data?.data || []);
        if (brandData?.id) trackView("brand", brandData.id);

        // Fetch Instagram posts (non-blocking)
        try {
          const igRes = await api.get(`/public/brands/${brandId}/instagram?limit=9`);
          setIgPosts(igRes.data?.data || []);
        } catch { /* IG posts are optional */ }
      } catch (error) {
        logger.error("Failed to fetch brand data", { error: error.message });
        if (error.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [brandId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1C1510]/40" />
      </div>
    );
  }

  if (notFound || !brand) return <Navigate to="/brands" replace />;

  return (
    <div className="min-h-screen" data-testid="brand-detail-page">
      <PageSEO
        title={brand.seo_title || brand.name}
        description={brand.seo_description || brand.short_desc || brand.tagline || ""}
        image={brand.seo_og_image || brand.hero_image}
        path={`/brands/${brand.seo_slug || brand.code}`}
        type="website"
        brandSlug={brand.seo_slug || brand.code}
        keywords={`${brand.name} bandung, ${brand.tagline || ""}, restoran bandung, fnbgroup group`}
      />

      {/* ── Hero ── */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden" data-testid="brand-detail-hero">
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${brand.hero_image || BRAND_IMAGES[brand.code]})` }}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(28,21,16,0.8) 0%, rgba(28,21,16,0.3) 50%, rgba(28,21,16,0.4) 100%)" }} />
        <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-10 lg:px-16 pb-14 max-w-screen-xl mx-auto">
          <Link to="/brands" className="inline-flex items-center gap-2 text-white/55 text-sm hover:text-white transition-colors mb-8" data-testid="brand-detail-back-link">
            <ArrowLeft className="h-4 w-4" /> All Brands
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brand.color }} />
            <span className="text-white/45 text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>Est. {brand.established}</span>
            {brand.instagram && (
              <a
                href={`https://instagram.com/${brand.instagram_username || brand.instagram?.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 flex items-center gap-1.5 text-white/50 text-[10px] tracking-wide hover:text-white transition-colors"
              >
                <Instagram className="w-3 h-3" />
                {brand.instagram}
              </a>
            )}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-white leading-[0.88] tracking-[-0.03em] mb-3"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(56px, 8vw, 110px)", fontWeight: 600 }}
          >
            {brand.name}
          </motion.h1>
          <p className="text-white/55 text-base">{brand.tagline}</p>
        </div>
      </section>

      {/* ── Awards & Quick Info ── */}
      {(brand.awards?.length > 0 || brand.price_range || brand.atmosphere) && (
        <section className="bg-[#1C1510] py-8 px-6 sm:px-10 lg:px-16">
          <div className="max-w-screen-xl mx-auto flex flex-wrap gap-6 items-center justify-between">
            {brand.price_range && (
              <div>
                <p className="text-white/30 text-[8px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>Price Range</p>
                <p className="text-white/80 text-sm">{brand.price_range}</p>
              </div>
            )}
            {brand.atmosphere && (
              <div>
                <p className="text-white/30 text-[8px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>Atmosphere</p>
                <p className="text-white/80 text-sm">{brand.atmosphere}</p>
              </div>
            )}
            {brand.seating_capacity && (
              <div>
                <p className="text-white/30 text-[8px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>Capacity</p>
                <p className="text-white/80 text-sm">{brand.seating_capacity} pax</p>
              </div>
            )}
            {brand.awards && brand.awards[0] && (
              <div className="flex-1 min-w-0">
                <p className="text-white/30 text-[8px] tracking-[0.3em] uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>Award</p>
                <p className="text-[#C8A96E] text-sm truncate">{brand.awards[0]}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Story ── */}
      <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-16">
        <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-4" style={{ fontFamily: "'Azeret Mono', monospace" }}>Our Story</p>
            <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-6" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>The {brand.name} Story</h2>
            <span className="block h-0.5 w-10 bg-[#C8A96E] mb-6" />
            {brand.story && brand.story.split("\n\n").map((para, i) => (
              <p key={i} className="text-[#1C1510]/55 text-sm leading-relaxed mb-4 last:mb-0">{para}</p>
            ))}
            {brand.tags && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-6">
                {brand.tags.map((tag, ti) => (
                  <span key={tag} className="text-[9px] text-[#1C1510]/40 tracking-[0.2em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                    {ti > 0 && <span className="mr-3 text-[#C8A96E]">·</span>}{tag}
                  </span>
                ))}
              </div>
            )}
          </Reveal>
          <Reveal delay={0.12}>
            <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "4/3" }}>
              <motion.div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${brand.card_image || BRAND_IMAGES[brand.code]})` }}
                whileHover={{ scale: 1.04 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Signature Dishes ── */}
      {brand.signature_dishes && brand.signature_dishes.length > 0 && (
        <section className="py-20 lg:py-24 px-6 sm:px-10 lg:px-16 border-t border-[#1C1510]/10" data-testid="brand-detail-signature-section">
          <div className="max-w-screen-xl mx-auto">
            <Reveal>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Featured</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>Signature Dishes</h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1C1510]/10">
              {brand.signature_dishes.map((dish, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <motion.div
                    className="p-8 bg-[#F8F5EF] hover:bg-[#F0EAE0] transition-colors"
                    whileHover={{ y: -1 }}
                  >
                    <span className="block h-0.5 w-8 mb-5" style={{ backgroundColor: brand.color }} />
                    <h3 className="text-[#1C1510]/90 font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem" }}>{dish.name}</h3>
                    <p className="text-[#1C1510]/45 text-xs leading-relaxed mb-4">{dish.desc}</p>
                    <p className="font-semibold text-sm" style={{ color: brand.color }}>{dish.price}</p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Outlets ── */}
      {outlets.length > 0 && (
        <section className="py-20 lg:py-24 px-6 sm:px-10 lg:px-16 border-t border-[#1C1510]/10" data-testid="brand-detail-outlets-accordion">
          <div className="max-w-screen-xl mx-auto">
            <Reveal>
              <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Where to Find Us</p>
              <h2 className="text-[#1C1510] leading-tight tracking-[-0.025em] mb-10" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600 }}>Our Outlets</h2>
            </Reveal>
            <Accordion type="single" collapsible className="space-y-2">
              {outlets.map((outlet) => (
                <AccordionItem key={outlet.id} value={outlet.id} className="border border-[#1C1510]/15 rounded-xl px-6 data-[state=open]:border-[#1C1510]/30 bg-white hover:bg-[#F0EAE0] transition-colors">
                  <AccordionTrigger className="text-[#1C1510]/85 text-sm font-medium hover:no-underline hover:text-[#1C1510] py-5">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4" style={{ color: brand.color }} />
                      {outlet.name}
                      <span className="text-[#1C1510]/40 text-xs font-normal">{outlet.area}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <p className="text-[#1C1510]/40 text-[9px] tracking-wider uppercase mb-2" style={{ fontFamily: "'Azeret Mono', monospace" }}>Address</p>
                        <p className="text-[#1C1510]/65 text-sm leading-relaxed">{outlet.address}</p>
                        {outlet.maps_url && (
                          <a href={outlet.maps_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 mt-2 text-xs text-[#C8A96E] hover:underline">
                            <ExternalLink className="w-3 h-3" /> Google Maps
                          </a>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[#1C1510]/40 text-[9px] tracking-wider uppercase mb-1" style={{ fontFamily: "'Azeret Mono', monospace" }}>Hours</p>
                          <p className="text-[#1C1510]/60 text-xs">Weekday: {outlet.hours_weekday}</p>
                          <p className="text-[#1C1510]/60 text-xs mt-0.5">Weekend: {outlet.hours_weekend}</p>
                        </div>
                        {outlet.phone && (
                          <a href={`tel:${outlet.phone}`} className="flex items-center gap-1.5 text-[#1C1510]/50 text-xs hover:text-[#1C1510] transition-colors">
                            <Phone className="h-3 w-3" />{outlet.phone}
                          </a>
                        )}
                        {outlet.whatsapp && (
                          <a href={`https://wa.me/${outlet.whatsapp}`} target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1.5 text-green-600 text-xs hover:underline">
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                    {outlet.features && outlet.features.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {outlet.features.map((f) => (
                          <span key={f} className="px-3 py-1 rounded-full text-[10px] border border-[#1C1510]/15 text-[#1C1510]/45">{f}</span>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <Reveal delay={0.1}>
              <div className="flex flex-wrap gap-3 mt-10">
                <Link to="/menu" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-[#1C1510] rounded-full hover:bg-[#1C1510]/85 transition-colors">See Menu</Link>
                <Link to="/locations" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#1C1510] border border-[#1C1510]/25 rounded-full hover:bg-[#1C1510]/5 transition-colors">All Locations</Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Instagram Feed ── */}
      <InstagramFeed brand={brand} posts={igPosts} />

      {/* ── CTA ── */}
      <section className="py-20 lg:py-24 px-6 sm:px-10 lg:px-16 border-t border-[#1C1510]/10 bg-[#1C1510]">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-white leading-tight tracking-[-0.02em] mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(28px, 3vw, 42px)", fontWeight: 600 }}>
              Reservasi Meja di {brand.name}
            </h2>
            <p className="text-white/45 text-sm">{brand.reservation_required ? "Reservasi sangat disarankan" : "Walk-in welcome, reservasi tersedia"}</p>
          </div>
          <Link
            to="/reservation"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#C8A96E] text-[#1C1510] text-sm font-semibold rounded-full hover:bg-[#D4AF37] transition-colors flex-shrink-0"
          >
            Reservasi Sekarang
          </Link>
        </div>
      </section>
    </div>
  );
}
