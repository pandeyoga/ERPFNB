/**
 * PageSEO — Reusable per-page SEO component
 * 
 * Features:
 * - Basic meta tags (title, description, canonical, robots)
 * - Open Graph tags (title, description, image, type, locale)
 * - Twitter Card tags
 * - JSON-LD Structured Data (Organization, WebSite, LocalBusiness/Restaurant)
 * - DB override support: fetches /api/seo/public?path=... and merges
 *
 * Usage:
 *   <PageSEO
 *     title="The Coffeeshop Coffee"
 *     description="Specialty coffee & all-day dining..."
 *     path="/brands/the-coffeeshop"
 *     image="https://..."
 *     type="website"
 *     keywords="the-coffeeshop, coffee bandung"
 *     schemaType="Restaurant"
 *     schemaData={{ name: "The Coffeeshop", address: "..." }}
 *   />
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import api from "@/lib/api";

const DEFAULT_OG_IMAGE = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=630&fit=crop&q=80";
const SITE_NAME = "FnB Group";
const BASE_URL = "https://fnbgroup.id";
const TWITTER_HANDLE = "@fnbgroup";

// ─── JSON-LD Generators ────────────────────────────────────────────────────────

function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FnB Group",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: "FnB Group adalah perusahaan multi-brand F&B asal Bandung, Indonesia, dengan 5 brand restoran dari fine dining hingga coffee shop.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bandung",
      addressRegion: "Jawa Barat",
      addressCountry: "ID",
    },
    sameAs: [
      "https://www.instagram.com/fnbgroup",
      "https://www.tiktok.com/@fnbgroup",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["Indonesian", "English"],
    },
  };
}

function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: BASE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/menu?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

const BRAND_SCHEMA_DATA = {
  "the-coffeeshop": {
    name: "The Coffeeshop",
    description: "Specialty Coffee & All-Day Dining",
    servesCuisine: ["Coffee", "Brunch", "Indonesian"],
    priceRange: "Rp40.000 - Rp150.000",
    telephone: "+62-22-THE COFFEESHOP",
  },
  "the-restaurant": {
    name: "The Restaurant",
    description: "Modern Latin & Mediterranean Fine Dining Bandung",
    servesCuisine: ["Latin American", "Mediterranean"],
    priceRange: "Rp100.000 - Rp400.000",
    telephone: "+62-22-DELASOL",
  },
  "the-bistro": {
    name: "The Bistro",
    description: "European Bistro & Wine Bar Bandung",
    servesCuisine: ["European", "French", "Wine Bar"],
    priceRange: "Rp80.000 - Rp300.000",
    telephone: "+62-22-THE BISTRO",
  },
  "the-lounge": {
    name: "The Lounge",
    description: "American Smokehouse & Sports Bar Bandung",
    servesCuisine: ["American", "BBQ", "Sports Bar"],
    priceRange: "Rp60.000 - Rp250.000",
    telephone: "+62-22-LOUNGE",
  },
  "the-bakery": {
    name: "The Bakery",
    description: "Artisan Bakery & Café Bandung",
    servesCuisine: ["Bakery", "Coffee", "Café"],
    priceRange: "Rp25.000 - Rp120.000",
    telephone: "+62-22-THE BAKERY",
  },
};

function buildRestaurantSchema(brandSlug, extraData = {}) {
  const brandData = BRAND_SCHEMA_DATA[brandSlug] || {};
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: brandData.name || extraData.name || SITE_NAME,
    description: brandData.description || extraData.description || "",
    url: `${BASE_URL}/brands/${brandSlug}`,
    image: extraData.image || DEFAULT_OG_IMAGE,
    servesCuisine: brandData.servesCuisine || [],
    priceRange: brandData.priceRange || "Rp40.000 - Rp300.000",
    telephone: brandData.telephone || "+62-22-0000000",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bandung",
      addressRegion: "Jawa Barat",
      addressCountry: "ID",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -6.9175,
      longitude: 107.6191,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "22:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday"],
        opens: "09:00",
        closes: "23:00",
      },
    ],
    parentOrganization: {
      "@type": "Organization",
      name: "FnB Group",
      url: BASE_URL,
    },
    ...extraData,
  };
}

function buildBreadcrumbSchema(path, pageName) {
  const crumbs = [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
  ];
  if (path !== "/") {
    crumbs.push({ "@type": "ListItem", position: 2, name: pageName, item: `${BASE_URL}${path}` });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PageSEO({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  keywords,
  schemaType,   // "Restaurant" | "LocalBusiness" | "Organization" | null
  schemaData,   // extra data for schema
  brandSlug,    // for brand-specific Restaurant schema
  noSchemaLD,   // true → skip JSON-LD
}) {
  const [override, setOverride] = useState(null);

  // Fetch DB override (non-blocking — fails silently)
  useEffect(() => {
    let cancelled = false;
    api.get(`/seo/public?path=${encodeURIComponent(path)}`)
      .then(r => {
        if (!cancelled && r.data?.data) setOverride(r.data.data);
      })
      .catch(() => {}); // silently ignore — defaults are used
    return () => { cancelled = true; };
  }, [path]);

  // Merge: DB override > props > defaults
  const finalTitle = override?.title || title;
  const finalDescription = override?.description || description;
  const finalOgTitle = override?.og_title || override?.title || title;
  const finalOgDescription = override?.og_description || override?.description || description;
  const finalOgImage = override?.og_image || image;
  const finalKeywords = override?.keywords || keywords;
  const finalNoindex = override?.noindex ?? false;
  const finalCanonical = override?.canonical_path || path;

  const fullTitle = finalTitle
    ? `${finalTitle} | ${SITE_NAME}`
    : `${SITE_NAME} — Crafted F&B Experiences Bandung`;
  const canonicalUrl = `${BASE_URL}${finalCanonical}`;

  // Build JSON-LD schemas
  const schemas = [];
  if (!noSchemaLD) {
    if (path === "/") {
      schemas.push(buildOrganizationSchema());
      schemas.push(buildWebsiteSchema());
    }
    if (brandSlug) {
      schemas.push(buildRestaurantSchema(brandSlug, { image: finalOgImage, ...schemaData }));
    } else if (schemaType === "Restaurant" && schemaData) {
      schemas.push(buildRestaurantSchema("", { image: finalOgImage, ...schemaData }));
    } else if (schemaType === "Organization") {
      schemas.push(buildOrganizationSchema());
    }
    if (path !== "/") {
      schemas.push(buildBreadcrumbSchema(path, finalTitle || ""));
    }
  }

  return (
    <Helmet>
      {/* ── Basic ── */}
      <title>{fullTitle}</title>
      {finalDescription && <meta name="description" content={finalDescription} />}
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={finalNoindex ? "noindex, nofollow" : "index, follow"} />
      <meta name="language" content="id" />
      <meta name="geo.region" content="ID-JB" />
      <meta name="geo.placename" content="Bandung, Jawa Barat, Indonesia" />

      {/* ── Open Graph ── */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={finalOgTitle ? `${finalOgTitle} | ${SITE_NAME}` : fullTitle} />
      {finalOgDescription && <meta property="og:description" content={finalOgDescription} />}
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="id_ID" />
      <meta property="og:locale:alternate" content="en_US" />

      {/* ── Twitter Card ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={finalOgTitle ? `${finalOgTitle} | ${SITE_NAME}` : fullTitle} />
      {finalOgDescription && <meta name="twitter:description" content={finalOgDescription} />}
      <meta name="twitter:image" content={finalOgImage} />

      {/* ── JSON-LD Structured Data ── */}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </Helmet>
  );
}
