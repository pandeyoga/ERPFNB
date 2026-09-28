/** CMSStudio — Phase D4 UX consolidation 2026-05-26.
 *
 * Single hub for all CMS content management. Previously these were 9 separate
 * sidebar items, making content workflow scattered.
 *
 * Implementation: horizontal tabs at top + left sub-nav for nested entities,
 * renders existing CMS components inline (no navigation, deep linkable).
 *
 * URL: /admin/cms-studio (default Brands)
 *      /admin/cms/<entity>  (existing routes still work)
 */
import { useLocation, Link, Navigate } from "react-router-dom";
import {
  Tag, Store, Newspaper, Coffee, Briefcase, Image, FileText, MessageSquare, BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import CMSBrands from "./cms/CMSBrands";
import CMSOutlets from "./cms/CMSOutlets";
import CMSNews from "./cms/CMSNews";
import CMSMenu from "./cms/CMSMenu";
import CMSCareers from "./cms/CMSCareers";
import MediaLibrary from "./cms/MediaLibrary";
import PageBuilder from "./cms/PageBuilder";
import CMSPendingReviews from "./cms/CMSPendingReviews";
import CMSAnalytics from "./cms/CMSAnalytics";

const SECTIONS = [
  {
    group: "Konten",
    items: [
      { entity: "brands",   name: "Brands",         icon: Tag,       render: () => <CMSBrands /> },
      { entity: "outlets",  name: "Outlets",        icon: Store,     render: () => <CMSOutlets /> },
      { entity: "news",     name: "News & Events",  icon: Newspaper, render: () => <CMSNews /> },
      { entity: "menu",     name: "Menu Items",     icon: Coffee,    render: () => <CMSMenu /> },
      { entity: "careers",  name: "Careers / Jobs", icon: Briefcase, render: () => <CMSCareers /> },
    ],
  },
  {
    group: "Aset & Halaman",
    items: [
      { entity: "media",    name: "Media Library",  icon: Image,     render: () => <MediaLibrary /> },
      { entity: "pages",    name: "Page Builder",   icon: FileText,  render: () => <PageBuilder /> },
    ],
  },
  {
    group: "Moderasi & Insight",
    items: [
      { entity: "reviews",   name: "Pending Reviews", icon: MessageSquare, render: () => <CMSPendingReviews /> },
      { entity: "analytics", name: "CMS Analytics",   icon: BarChart3,     render: () => <CMSAnalytics /> },
    ],
  },
];

const ALL = SECTIONS.flatMap(s => s.items);

export default function CMSStudio() {
  const location = useLocation();
  const m = location.pathname.match(/^\/admin\/cms\/([^\/?]+)/);
  const activeEntity = m ? m[1] : null;
  const activeItem = ALL.find(it => it.entity === activeEntity);

  if (!activeItem) return <Navigate to="/admin/cms/brands" replace />;

  return (
    <div className="space-y-4" data-testid="cms-studio">
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-0 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grad-aurora-soft flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">CMS Studio</h2>
            <p className="text-[11px] text-muted-foreground">
              Semua konten public website dalam satu tempat — Brands, Outlets, News, Menu, dst.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-3 pt-3 -mb-px overflow-x-auto border-b border-border/40"
          role="tablist" data-testid="cms-tabs">
          {ALL.map(t => {
            const isActive = activeEntity === t.entity;
            const Icon = t.icon;
            return (
              <Link
                key={t.entity}
                to={`/admin/cms/${t.entity}`}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`cms-tab-${t.entity}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="cms-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div data-testid={`cms-content-${activeItem.entity}`}>
        {activeItem.render()}
      </div>
    </div>
  );
}
