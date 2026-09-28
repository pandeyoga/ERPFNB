/**
 * PublicPage — Sprint L: Custom page renderer
 * Renders a custom page by slug from the /api/public/pages/:slug endpoint.
 * Tracks page view analytics via /api/public/analytics/track.
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Globe } from "lucide-react";
import axios from "axios";
import DOMPurify from "dompurify";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

async function trackView(contentType, contentId) {
  try {
    await axios.post(`${BACKEND_URL}/api/public/analytics/track`, { content_type: contentType, content_id: contentId });
  } catch { /* fire and forget */ }
}

// ── Block renderers ──────────────────────────────────────────────────────────

function HeroBlock({ block }) {
  const style = {
    backgroundImage: block.bg_image ? `url(${block.bg_image})` : undefined,
    backgroundColor: block.bg_image ? undefined : "#1a1a2e",
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: block.text_color || "#ffffff",
  };
  const overlay = { backgroundColor: `rgba(0,0,0,${(block.overlay_opacity || 0) / 100})` };
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center" style={style}>
      <div className="absolute inset-0" style={overlay} />
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: block.text_color || "#fff" }}>
          {block.title}
        </h1>
        <p className="text-xl md:text-2xl opacity-90 mb-8" style={{ color: block.text_color || "#fff" }}>
          {block.subtitle}
        </p>
        {block.cta_text && block.cta_link && (
          <Link to={block.cta_link}
                className="inline-block px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-colors">
            {block.cta_text}
          </Link>
        )}
      </div>
    </section>
  );
}

function RichTextBlock({ block }) {
  // A6 fix: SEC-004 — sanitasi HTML dengan DOMPurify sebelum render
  const clean = DOMPurify.sanitize(block.content || "", { USE_PROFILES: { html: true } });
  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto prose prose-gray max-w-none"
           dangerouslySetInnerHTML={{ __html: clean }} />
    </section>
  );
}

function ImageBlock({ block }) {
  const sizeClass = block.size === "small" ? "max-w-lg" : block.size === "medium" ? "max-w-3xl" : "max-w-full";
  return (
    <section className="py-8 px-6">
      <figure className={`${sizeClass} mx-auto`}>
        {block.url && (
          <img src={block.url} alt={block.alt || ""}
               className="w-full h-auto rounded-xl shadow-md object-cover"
               loading="lazy" decoding="async" />
        )}
        {block.caption && (
          <figcaption className="text-center text-sm text-gray-500 mt-3">{block.caption}</figcaption>
        )}
      </figure>
    </section>
  );
}

function CTABlock({ block }) {
  return (
    <section className="py-16 px-6" style={{ backgroundColor: block.bg_color || "#1a1a2e", color: block.text_color || "#fff" }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4" style={{ color: block.text_color || "#fff" }}>{block.title}</h2>
        {block.description && (
          <p className="text-lg mb-8 opacity-80" style={{ color: block.text_color || "#fff" }}>{block.description}</p>
        )}
        {block.btn_text && block.btn_link && (
          <Link to={block.btn_link}
                className="inline-block px-8 py-3 bg-white rounded-full font-semibold hover:opacity-90 transition-opacity"
                style={{ color: block.bg_color || "#1a1a2e" }}>
            {block.btn_text}
          </Link>
        )}
      </div>
    </section>
  );
}

function DividerBlock({ block }) {
  if (block.style === "spacer") return <div className="py-8" />;
  if (block.style === "dots") return (
    <div className="py-8 flex justify-center gap-2">
      {[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-gray-300" />)}
    </div>
  );
  return <hr className="my-8 border-gray-200 max-w-4xl mx-auto" />;
}

function GalleryBlock({ block }) {
  const images = block.images || [];
  if (images.length === 0) return null;
  
  const columns = block.columns || 3;
  const gridClass = columns === 2 ? "grid-cols-1 sm:grid-cols-2" 
                  : columns === 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"; // default 3
  
  return (
    <section className="py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className={`grid ${gridClass} gap-4`}>
          {images.map((img, idx) => (
            <figure key={img.id || idx} className="group relative overflow-hidden rounded-xl bg-gray-100">
              {img.url && (
                <img 
                  src={img.url} 
                  alt={img.alt || `Gallery image ${idx + 1}`}
                  className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {img.caption && (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white text-sm">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuShowcaseBlock({ block }) {
  const items = block.items || [];
  if (items.length === 0) return null;
  
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {block.title && (
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            {block.title}
          </h2>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, idx) => (
            <div key={item.id || idx} 
                 className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {item.image && (
                <div className="h-48 overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.name || `Menu item ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {item.name}
                  </h3>
                  {item.price && (
                    <span className="text-lg font-bold text-gray-900 ml-3 whitespace-nowrap">
                      {item.price}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {block.cta_text && block.cta_link && (
          <div className="text-center mt-10">
            <Link 
              to={block.cta_link}
              className="inline-block px-8 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors"
            >
              {block.cta_text}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const BLOCK_RENDERERS = {
  hero: HeroBlock,
  rich_text: RichTextBlock,
  image: ImageBlock,
  gallery: GalleryBlock,
  menu_showcase: MenuShowcaseBlock,
  cta_banner: CTABlock,
  divider: DividerBlock,
};

export default function PublicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${BACKEND_URL}/api/public/pages/${slug}`);
        const data = r.data?.data;
        setPage(data);
        if (data) {
          // Track analytics
          trackView("custom_page", data.id);
          // Update page title
          document.title = data.seo_title || data.title || "Halaman";
          if (data.seo_description) {
            let meta = document.querySelector('meta[name="description"]');
            if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
            meta.content = data.seo_description;
          }
        }
      } catch (err) {
        setError(err.response?.status === 404 ? "Halaman tidak ditemukan" : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetch();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );

  if (error || !page) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Globe className="h-16 w-16 text-gray-300" />
      <h1 className="text-2xl font-bold text-gray-700">{error || "Halaman tidak ditemukan"}</h1>
      <p className="text-gray-500">Halaman yang Anda cari tidak tersedia.</p>
      <Link to="/" className="text-blue-600 hover:underline flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* SEO og image */}
      {page.seo_og_image && (
        <link rel="preload" as="image" href={page.seo_og_image} />
      )}

      {/* Render blocks */}
      {(page.blocks || []).map((block, idx) => {
        const Renderer = BLOCK_RENDERERS[block.type];
        if (!Renderer) return null;
        return <Renderer key={block.id || idx} block={block} />;
      })}

      {/* Footer link */}
      <div className="border-t py-6 px-6 text-center">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
