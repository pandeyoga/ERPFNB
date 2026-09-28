/**
 * AdminPortal shell — Navigation Restructuring (V2):
 * - Custom SubNav removed; AppShell Sidebar (level-1) + Subnav (level-2)
 *   handles navigation, identik dengan portal lain.
 * - Routes lengkap untuk semua menu yang diakses dari sidebar global.
 * - Item yang sebelumnya hanya hidup di SubNav (Operations, Report
 *   Schedules, CMS Reviews/Analytics/Pages, Loyalty Analytics) sekarang
 *   ditambahkan ke `navigationSchema.js` agar konsisten.
 */
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";

import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/shared/PageHeader";
import ComingSoonPage from "@/components/shared/ComingSoonPage";

import AdminHome from "./AdminHome";
import Users from "./Users";
import Roles from "./Roles";
import UserManagementHub from "./UserManagementHub";
import AdminSetupHub from "./AdminSetupHub";
import MasterData from "./MasterData";
import MasterDataHub from "./MasterDataHub";
import BulkImport from "./BulkImport";
import AuditLog from "./AuditLog";
import NumberSeries from "./NumberSeries";
import ApprovalWorkflows from "./ApprovalWorkflows";
import ApprovalMatrixBuilder from "./ApprovalMatrixBuilder";
import Operations from "./Operations";
import Integrations from "./Integrations";
import TaxConfig from "./TaxConfig";
import SmartSEO from "./SmartSEO";
import SystemSettings from "./SystemSettings";
import ConfigurationLayout from "./configuration/ConfigurationLayout";
import SalesSchemasPage from "./configuration/SalesSchemasPage";
import PettyCashPoliciesPage from "./configuration/PettyCashPoliciesPage";
import ServiceChargePoliciesPage from "./configuration/ServiceChargePoliciesPage";
import IncentiveSchemesPage from "./configuration/IncentiveSchemesPage";
import AnomalyThresholdsPage from "./configuration/AnomalyThresholdsPage";
import EffectiveDatingTimelinePage from "./configuration/EffectiveDatingTimelinePage";
import LoyaltyAdminHome from "./loyalty/LoyaltyAdminHome";
import LoyaltyHub from "./loyalty/LoyaltyHub";
import LoyaltyAdminCustomers from "./loyalty/LoyaltyAdminCustomers";
import LoyaltyAdminCustomerDetail from "./loyalty/LoyaltyAdminCustomerDetail";
import LoyaltyAdminRewards from "./loyalty/LoyaltyAdminRewards";
import LoyaltyAdminRedemptions from "./loyalty/LoyaltyAdminRedemptions";
import CRMAnalytics from "./loyalty/CRMAnalytics";
import CMSBrands from "./cms/CMSBrands";
import CMSCareers from "./cms/CMSCareers";
import CMSOutlets from "./cms/CMSOutlets";
import CMSNews from "./cms/CMSNews";
import CMSMenu from "./cms/CMSMenu";
import MediaLibrary from "./cms/MediaLibrary";
import CMSPendingReviews from "./cms/CMSPendingReviews";
import CMSAnalytics from "./cms/CMSAnalytics";
import PageBuilder from "./cms/PageBuilder";
import CMSStudio from "./CMSStudio";
import ReportSchedules from "./ReportSchedules";
import DataManagement from "./DataManagement";
import TourAnalytics from "./TourAnalytics";

/**
 * Defense-in-depth per-route guard. The /admin/* portal guard (App.js) only checks
 * for ANY `admin.*` perm, so a role with a feature perm like `admin.loyalty.*`
 * (e.g. OUTLET_MANAGER) can enter the admin shell. This guards each sensitive
 * sub-route by its specific permission namespace (aligned with navigationSchema
 * reqPerm), redirecting unauthorized direct-URL access to /no-access.
 * SUPER_ADMIN ("*") always passes.
 */
function permitted(user, needPrefix) {
  const perms = (user && user.permissions) || [];
  if (perms.includes("*")) return true;
  return perms.some((p) => p === needPrefix || p.startsWith(needPrefix + "."));
}

function Gate({ user, need, children }) {
  if (!permitted(user, need)) return <Navigate to="/no-access" replace />;
  return children;
}

export default function AdminPortal() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const g = (need, el) => <Gate user={user} need={need}>{el}</Gate>;

  // Phase 2: the "Admin Platform" hero is shown ONLY on the Admin home (/admin).
  // Sub-pages have their own headers, so the repeated hero is removed for density.
  const isAdminHome = location.pathname === "/admin" || location.pathname === "/admin/";

  return (
    <div className="max-w-7xl mx-auto" data-testid="admin-portal">
      {isAdminHome && (
        <PageHeader
          icon={SettingsIcon}
          title="Admin Platform"
          subtitle="Master data, users, roles, dan konfigurasi sistem"
        />
      )}
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="users" element={g("admin.user", <Users />)} />
        <Route path="roles" element={g("admin.user", <Roles />)} />
        {/* Unified hubs (IA consolidation) */}
        <Route path="user-management" element={g("admin.user", <UserManagementHub />)} />
        <Route path="setup" element={g("admin.business_rules", <AdminSetupHub />)} />
        <Route path="master" element={<Navigate to="/admin/master/items" replace />} />
        <Route path="master-data" element={<Navigate to="/admin/master/items" replace />} />
        <Route path="master/:entity" element={g("admin.master_data", <MasterDataHub />)} />
        <Route path="configuration" element={g("admin.business_rules", <ConfigurationLayout />)}>
          <Route index element={<Navigate to="/admin/configuration/sales-schemas" replace />} />
          <Route path="sales-schemas" element={<SalesSchemasPage />} />
          <Route path="petty-cash-policies" element={<PettyCashPoliciesPage />} />
          <Route path="service-charge-policies" element={<ServiceChargePoliciesPage />} />
          <Route path="incentive-schemes" element={<IncentiveSchemesPage />} />
          <Route path="anomaly-thresholds" element={<AnomalyThresholdsPage />} />
          <Route path="effective-dating" element={<EffectiveDatingTimelinePage />} />
        </Route>
        <Route path="workflows" element={g("admin.business_rules", <ApprovalWorkflows />)} />
        {/* Phase 15 — global visual workflow builder */}
        <Route path="approvals" element={g("admin.business_rules", <ApprovalMatrixBuilder />)} />
        {/* Sprint D — Bulk Excel Import */}
        <Route path="bulk-import" element={g("admin.business_rules", <BulkImport />)} />
        <Route path="number-series" element={g("admin.business_rules", <NumberSeries />)} />
        <Route path="audit-log" element={g("admin.audit_log", <AuditLog />)} />
        <Route path="integrations" element={g("admin.business_rules", <Integrations />)} />
        <Route path="integrations/:tab" element={g("admin.business_rules", <Integrations />)} />
        <Route path="tax" element={g("admin.business_rules", <TaxConfig />)} />
        <Route path="operations/*" element={g("admin.audit_log", <Operations />)} />

        {/* System Settings (real page, not Coming Soon) */}
        <Route path="settings" element={g("admin.system_settings", <SystemSettings />)} />

        {/* Loyalty admin — unified hub (Overview/Customers/Rewards/Redemptions/Analytics tabs) */}
        <Route path="loyalty" element={g("admin.loyalty", <LoyaltyHub />)} />
        <Route path="loyalty/customers" element={g("admin.loyalty", <LoyaltyAdminCustomers />)} />
        <Route path="loyalty/customers/:customerId" element={g("admin.loyalty", <LoyaltyAdminCustomerDetail />)} />
        <Route path="loyalty/rewards" element={g("admin.loyalty", <LoyaltyAdminRewards />)} />
        <Route path="loyalty/redemptions" element={g("admin.loyalty", <LoyaltyAdminRedemptions />)} />
        <Route path="loyalty/analytics" element={g("admin.loyalty", <CRMAnalytics />)} />

        {/* Sprint D: CMS routes - all use CMSStudio wrapper for unified tabs */}
        <Route path="cms-studio" element={<Navigate to="/admin/cms/brands" replace />} />
        <Route path="cms/brands" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/outlets" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/news" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/menu" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/careers" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/media" element={g("admin.cms", <CMSStudio />)} />
        {/* Sprint I-L: Reviews + Analytics + Page Builder */}
        <Route path="cms/reviews" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/analytics" element={g("admin.cms", <CMSStudio />)} />
        <Route path="cms/pages" element={g("admin.cms", <CMSStudio />)} />
        {/* Sprint E: Scheduled Reports */}
        <Route path="report-schedules" element={g("admin.audit_log", <ReportSchedules />)} />
        {/* Phase 2: Smart SEO Optimization */}
        <Route path="smart-seo" element={g("admin.cms", <SmartSEO />)} />
        {/* Data Management: Import / Export / Delete */}
        <Route path="data-management" element={g("admin.audit_log", <DataManagement />)} />
        {/* Tour Analytics — Help & Tour usage statistics */}
        <Route path="tour-analytics" element={g("admin.audit_log", <TourAnalytics />)} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
