/**
 * NewsDetail — Public news article detail page.
 * Route: /news/:id
 */
import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Tag, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PageSEO from "@/components/shared/PageSEO";
import DOMPurify from "dompurify";
import api from "@/lib/api";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const resolveUrl = (u) => u?.startsWith("/") ? `${BACKEND_URL}${u}` : (u || "");

function trackView(contentType, contentId) {
  axios.post(`${BACKEND_URL}/api/public/analytics/track`, { content_type: contentType, content_id: contentId }).catch(() => {});
}

function SafeHTML({ html }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const isPlain = !/<[a-z][\s\S]*>/i.test(clean);
  if (isPlain) return <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{html}</p>;
  return (
    <div
      className="prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function NewsDetail() {
  const { id } = useParams();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedNews, setRelatedNews] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r, allR] = await Promise.all([
          api.get(`/public/news/${id}`),
          api.get("/public/news?limit=4"),
        ]);
        const newsData = r.data?.data || null;
        setNews(newsData);
        const all = allR.data?.data || [];
        setRelatedNews(all.filter(n => n.id !== id).slice(0, 3));
        // Track analytics
        if (newsData?.id) trackView("news", newsData.id);
      } catch {
        setNews(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingState />;
  if (!news) return <Navigate to="/news" replace />;

  const coverImg = resolveUrl(news.image);

  return (
    <div className="min-h-screen bg-background" data-testid="news-detail-page">
      <PageSEO
        title={news.seo_title || news.title}
        description={news.seo_description || news.excerpt || ""}
        image={news.seo_og_image || news.image}
        path={`/news/${id}`}
      />

      {/* Back button */}
      <div className="max-w-3xl mx-auto px-4 pt-8">
        <Link
          to="/news"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Berita
        </Link>
      </div>

      {/* Cover image */}
      {coverImg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto px-4 mb-8"
        >
          <img
            src={coverImg}
            alt={news.title}
            className="w-full h-56 md:h-80 object-cover rounded-2xl shadow-md"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
      )}

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-3xl mx-auto px-4 pb-16"
      >
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-muted-foreground">
          {news.category && <Badge variant="secondary">{news.category}</Badge>}
          {news.brand_name && <Badge variant="outline">{news.brand_name}</Badge>}
          {news.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(news.date).toLocaleDateString("id-ID", {
                day: "numeric", month: "long", year: "numeric"
              })}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-snug mb-4">
          {news.title}
        </h1>

        {/* Excerpt */}
        {news.excerpt && (
          <p className="text-base md:text-lg text-muted-foreground border-l-4 border-primary/40 pl-4 italic leading-relaxed mb-8">
            {news.excerpt}
          </p>
        )}

        {/* Content */}
        <SafeHTML html={news.content} />

        {/* Related */}
        {relatedNews.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-lg font-semibold mb-4">Berita Lainnya</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedNews.map(n => (
                <Link
                  key={n.id}
                  to={`/news/${n.id}`}
                  className="group block rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-colors"
                >
                  {n.image && (
                    <img src={resolveUrl(n.image)} alt={n.title} className="w-full h-28 object-cover" loading="lazy" decoding="async" />
                  )}
                  <div className="p-3">
                    <Badge variant="secondary" className="text-xs mb-1">{n.category}</Badge>
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{n.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.article>
    </div>
  );
}
