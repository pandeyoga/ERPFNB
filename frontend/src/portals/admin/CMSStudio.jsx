/** CMSStudio — Phase D4 UX consolidation 2026-05-26.
 *
 * Single hub for all CMS content management. Previously these were 9 separate
 * sidebar items, making content workflow scattered.
 *
 * Implementation: PageHeader (satu-satunya <h1>) + Tabs terpadu (teks saja agar 9 tab muat
 * tanpa scroll horizontal di 1280px),
 * renders existing CMS components inline (deep linkable per tab via URL).
 * Sub-halaman tidak merender judul besar sendiri — label tab sudah menamai seksi.
 *
 * URL: /admin/cms-studio (default Brands)
 *      /admin/cms/<entity>  (existing routes still work)
 */
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { FileText } from "lucide-react";
import HubTabs, { groupTabs } from "@/components/shared/HubTabs";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import CMSBrands from "./cms/CMSBrands";
import CMSOutlets from "./cms/CMSOutlets";
import CMSNews from "./cms/CMSNews";
import CMSMenu from "./cms/CMSMenu";
import CMSCareers from "./cms/CMSCareers";
import MediaLibrary from "./cms/MediaLibrary";
import PageBuilder from "./cms/PageBuilder";
import CMSPendingReviews from "./cms/CMSPendingReviews";
import CMSAnalytics from "./cms/CMSAnalytics";

const TABS = [
  { entity: "brands",    name: "Brands",          render: () => <CMSBrands /> },
  { entity: "outlets",   name: "Outlets",         render: () => <CMSOutlets /> },
  { entity: "news",      name: "News & events",   render: () => <CMSNews /> },
  { entity: "menu",      name: "Menu items",      render: () => <CMSMenu /> },
  { entity: "careers",   name: "Careers",         render: () => <CMSCareers /> },
  { entity: "media",     name: "Media library",   render: () => <MediaLibrary /> },
  { entity: "pages",     name: "Page builder",    render: () => <PageBuilder /> },
  { entity: "reviews",   name: "Review Menunggu", render: () => <CMSPendingReviews /> },
  { entity: "analytics", name: "Analytics",       render: () => <CMSAnalytics /> },
];

const GROUPS = [
  { id: "content", label: "Konten", ids: ["brands", "outlets", "news", "menu", "careers"] },
  { id: "media", label: "Media & halaman", ids: ["media", "pages"] },
  { id: "reviews", label: "Review", ids: ["reviews"] },
  { id: "analytics", label: "Analytics", ids: ["analytics"] },
];

export default function CMSStudio() {
  const location = useLocation();
  const navigate = useNavigate();
  const m = location.pathname.match(/^\/admin\/cms\/([^/?]+)/);
  const activeEntity = m ? m[1] : null;
  const activeItem = TABS.find(it => it.entity === activeEntity);

  if (!activeItem) return <Navigate to="/admin/cms/brands" replace />;

  return (
    <HubHeaderProvider>
      <div data-testid="cms-studio">
        <PageHeader hub
          icon={FileText}
          title="CMS Studio"
          subtitle="Semua konten website publik dalam satu tempat — brand, outlet, berita, menu, karier, dan halaman."
        />

        {/* 9 halaman → 4 kelompok + sub-tab (DESIGN_SYSTEM §10.8) */}
        <HubTabs
          groups={groupTabs(TABS.map(t => ({ id: t.entity, label: t.name })), GROUPS)}
          value={activeItem.entity}
          onChange={(v) => navigate(`/admin/cms/${v}`)}
          testId="cms-tabs"
          itemTestId={(id) => `cms-tab-${id}`}
          groupTestId={(id) => `cms-group-${id}`}
        />

        <div className="mt-3" data-testid={`cms-content-${activeItem.entity}`}>
          {activeItem.render()}
        </div>
      </div>
    </HubHeaderProvider>
  );
}
