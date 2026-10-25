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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
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
  { entity: "reviews",   name: "Pending reviews", render: () => <CMSPendingReviews /> },
  { entity: "analytics", name: "Analytics",       render: () => <CMSAnalytics /> },
];

export default function CMSStudio() {
  const location = useLocation();
  const navigate = useNavigate();
  const m = location.pathname.match(/^\/admin\/cms\/([^/?]+)/);
  const activeEntity = m ? m[1] : null;
  const activeItem = TABS.find(it => it.entity === activeEntity);

  if (!activeItem) return <Navigate to="/admin/cms/brands" replace />;

  return (
    <div data-testid="cms-studio">
      <PageHeader
        icon={FileText}
        title="CMS Studio"
        subtitle="Semua konten website publik dalam satu tempat — brand, outlet, berita, menu, karier, dan halaman."
      />

      <Tabs value={activeItem.entity} onValueChange={(v) => navigate(`/admin/cms/${v}`)}>
        <TabsList data-testid="cms-tabs">
          {TABS.map(t => (
            <TabsTrigger key={t.entity} value={t.entity} data-testid={`cms-tab-${t.entity}`}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-3" data-testid={`cms-content-${activeItem.entity}`}>
        {activeItem.render()}
      </div>
    </div>
  );
}
