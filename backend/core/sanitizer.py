"""HTML sanitizer untuk backend — A15 fix: SEC-010.

Defense-in-depth: sanitasi HTML di backend sebelum disimpan ke DB,
meskipun frontend sudah pakai DOMPurify. Menggunakan bleach library.

Digunakan oleh: CMS endpoints (admin_cms.py, cms_advanced.py)
"""
import bleach

# Tag HTML yang diizinkan untuk konten publik
ALLOWED_TAGS = [
    "p", "br", "strong", "em", "b", "i", "u", "s",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "img", "figure", "figcaption",
    "div", "span", "section",
    "hr",
]

# Atribut yang diizinkan per tag
ALLOWED_ATTRS = {
    "a":   ["href", "title", "target", "rel"],
    "img": ["src", "alt", "width", "height", "loading"],
    "th":  ["colspan", "rowspan"],
    "td":  ["colspan", "rowspan"],
    "*":   ["class", "id"],
}

# Protokol URL yang diizinkan
ALLOWED_PROTOCOLS = ["http", "https", "mailto", "data"]


def sanitize_html(html: str) -> str:
    """Sanitasi HTML — hapus tag/atribut berbahaya.
    
    Returns HTML yang sudah dibersihkan (aman untuk disimpan ke DB).
    Input kosong atau None dikembalikan sebagai string kosong.
    """
    if not html:
        return ""
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,          # hapus tag yang tidak ada di whitelist (bukan encode)
        strip_comments=True, # hapus <!-- comments -->
    )
    return cleaned


def sanitize_plain(text: str) -> str:
    """Escape semua HTML ke plain text (untuk field yang tidak boleh ada HTML sama sekali)."""
    if not text:
        return ""
    return bleach.clean(text, tags=[], attributes={}, strip=True)
