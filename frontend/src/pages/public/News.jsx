import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import PageSEO from "@/components/shared/PageSEO";
import { ArrowUpRight, Loader2 } from "lucide-react";
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

export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const response = await api.get("/public/news", { params: { limit: 20 } });
        setNews(response.data?.data || []);
      } catch (error) {
        logger.error("Failed to fetch news", { error: error.message });
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5EF]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1C1510]/40" />
      </div>
    );
  }

  const filtered = activeCategory === "All" ? news : news.filter((n) => n.category === activeCategory);
  const featuredNews = news[0];

  return (
    <div className="min-h-screen" data-testid="news-page">
      <PageSEO
        title="News & Stories — FnB Group Bandung"
        description="Berita terbaru, cerita di balik dapur, event eksklusif, dan update terkini dari semua brand FnB Group Bandung."
        path="/news"
        keywords="berita FnB Group, event F&B Bandung, update kuliner Bandung, news FnB Group"
      />
      {/* Header */}
      <div className="pt-32 pb-12 px-6 lg:px-12 border-b border-[#1C1510]/10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-[#1C1510]/40 text-[10px] tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Azeret Mono', monospace" }}>Latest</p>
          <h1 className="text-[#1C1510] leading-[0.88] tracking-[-0.03em]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(52px, 7vw, 96px)", fontWeight: 600 }}>News & Events</h1>
        </motion.div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12">
        {/* Featured */}
        {featuredNews && (
          <Reveal>
            <Link to={`/news/${featuredNews.id}`}>
              <motion.div className="relative overflow-hidden rounded-2xl mb-12 group" whileHover={{ y: -2 }}>
                <div className="relative" style={{ aspectRatio: "21/9" }}>
                  <motion.div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${featuredNews.image})` }}
                    whileHover={{ scale: 1.03 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(28,21,16,0.8) 0%, transparent 60%)" }} />
              </div>
              <div className="absolute bottom-0 left-0 p-8 sm:p-12">
                <p className="text-[#C8A96E] text-[9px] tracking-[0.25em] uppercase mb-2" style={{ fontFamily: "'Azeret Mono', monospace" }}>{featuredNews.category}</p>
                <h2 className="text-white leading-tight tracking-[-0.02em] mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(24px, 3.5vw, 48px)", fontWeight: 600 }}>{featuredNews.title}</h2>
                <p className="text-white/50 text-sm">{new Date(featuredNews.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </motion.div>
          </Link>
        </Reveal>
        )}

        {/* Filter - Dynamic categories */}
        <Reveal>
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === "All" ? "text-white bg-[#1C1510]" : "text-[#1C1510]/55 border border-[#1C1510]/15 hover:border-[#1C1510]/30 hover:text-[#1C1510]"
              }`}
            >
              All
            </button>
            {[...new Set(news.map(n => n.category))].sort().map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat ? "text-white bg-[#1C1510]" : "text-[#1C1510]/55 border border-[#1C1510]/15 hover:border-[#1C1510]/30 hover:text-[#1C1510]"
                }`}
                data-testid={`news-filter-${cat.toLowerCase()}`}
              >{cat}</button>
            ))}
          </div>
        </Reveal>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="news-post-list">
          {filtered.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.06}>
              <motion.article className="group" whileHover={{ y: -2 }}>
                <Link to={`/news/${post.id}`} data-testid="news-card-link">
                  <div className="overflow-hidden rounded-xl mb-4 compro-img-hover" style={{ aspectRatio: "4/3" }}>
                    <motion.div
                      className="w-full h-full bg-cover bg-center compro-img-inner"
                      style={{ backgroundImage: `url(${post.image})` }}
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#C8A96E] text-[9px] tracking-[0.25em] uppercase" style={{ fontFamily: "'Azeret Mono', monospace" }}>{post.category}</span>
                    <span className="text-[#1C1510]/25 text-[10px]">·</span>
                    <span className="text-[#1C1510]/35 text-[10px]" style={{ fontFamily: "'Azeret Mono', monospace" }}>{new Date(post.date).toLocaleDateString("id-ID", { day:"numeric",month:"short",year:"numeric" })}</span>
                  </div>
                  <h3 className="text-[#1C1510]/80 font-semibold leading-snug group-hover:text-[#1C1510] transition-colors line-clamp-2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem" }}>{post.title}</h3>
                  <div className="flex items-center gap-1 text-[#1C1510]/35 text-xs mt-2 group-hover:text-[#1C1510]/60 transition-colors">
                    <span>Read more</span><ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
