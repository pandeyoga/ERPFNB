/**
 * AdminPortal shell — Navigation Restructuring (V2):
 * - Custom SubNav removed; AppShell Sidebar (level-1) + Subnav (level-2)
 *   handles navigation, identik dengan portal lain.
 * - Routes lengkap untuk semua menu yang diakses dari sidebar global.
 * - Item yang sebelumnya hanya hidup di SubNav (Operations, Report
 *   Schedules, CMS Reviews/Analytics/Pages, Loyalty Analytics) sekarang
 *   ditambahkan ke `navigationSchema.js` agar konsisten.
 */
import { Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import LegacyRedirect from "@/components/shared/LegacyRedirect";

import AdminHome from "./AdminHome";
import UserManagementHub from "./UserManagementHub";
import AdminSetupHub from "./AdminSetupHub";
import MasterDataHub from "./MasterDataHub";
import ApprovalMatrixBuilder from "./ApprovalMatrixBuilder";
import Operations from "./Operations";
import Integrations from "./Integrations";
import SmartSEO from "./SmartSEO";
import SystemSettings from "./SystemSettings";
import ConfigurationLayout from "./configuration/ConfigurationLayout";
import SalesSchemasPage from "./configuration/SalesSchemasPage";
import PettyCashPoliciesPage from "./configuration/PettyCashPoliciesPage";
import ServiceChargePoliciesPage from "./configuration/ServiceChargePoliciesPage";
import IncentiveSchemesPage from "./configuration/IncentiveSchemesPage";
import AnomalyThresholdsPage from "./configuration/AnomalyThresholdsPage";
import EffectiveDatingTimelinePage from "./configuration/EffectiveDatingTimelinePage";
import LoyaltyHub from "./loyalty/LoyaltyHub";
import LoyaltyAdminCustomerDetail from "./loyalty/LoyaltyAdminCustomerDetail";
import CMSStudio from "./CMSStudio";

/**
 * Defense-in-depth per-route guard. The /admin/* portal guard (App.js) only checks
 * for ANY `admin.*` perm, so a role with a feature perm like `admin.loyalty.*`
 * (e.g. OUTLET_MANAGER) can enter the admin shell. Each sensitive sub-route is
 * guarded by its permission namespace (shared makeGate: prefix match, array = any-of),
 * redirecting unauthorized direct-URL access to /no-access. SUPER_ADMIN ("*") passes.
 */
export default function AdminPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);

  // Setiap halaman admin merender PageHeader-nya sendiri (satu <h1> per halaman);
  // judul halaman Overview ada di AdminHome agar status/aksi bisa ikut di header.
  return (
    <div className="max-w-7xl mx-auto" data-testid="admin-portal">
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="users" element={<LegacyRedirect to="/admin/user-management?tab=users" />} />
        <Route path="roles" element={<LegacyRedirect to="/admin/user-management?tab=roles" />} />
        {/* Unified hubs (IA consolidation) */}
        <Route path="user-management" element={g(["admin.user", "admin.audit_log"], <UserManagementHub />)} />
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
        <Route path="workflows" element={<LegacyRedirect to="/admin/approvals" />} />
        {/* Phase 15 — global visual workflow builder */}
        <Route path="approvals" element={g("admin.business_rules", <ApprovalMatrixBuilder />)} />
        {/* Sprint D — Bulk Excel Import */}
        <Route path="bulk-import" element={<LegacyRedirect to="/admin/setup?tab=bulk-import" />} />
        <Route path="number-series" element={<LegacyRedirect to="/admin/setup?tab=number-series" />} />
        <Route path="audit-log" element={<LegacyRedirect to="/admin/user-management?tab=audit-log" />} />
        <Route path="integrations" element={g("admin.business_rules", <Integrations />)} />
        <Route path="integrations/:tab" element={g("admin.business_rules", <Integrations />)} />
        <Route path="tax" element={<LegacyRedirect to="/admin/setup?tab=tax-config" />} />
        <Route path="operations/*" element={g("admin.audit_log", <Operations />)} />

        {/* System Settings (real page, not Coming Soon) */}
        <Route path="settings" element={g("admin.system_settings", <SystemSettings />)} />

        {/* Loyalty admin — unified hub (Overview/Customers/Rewards/Redemptions/Analytics tabs) */}
        <Route path="loyalty" element={g("admin.loyalty", <LoyaltyHub />)} />
        <Route path="loyalty/customers" element={<LegacyRedirect to="/admin/loyalty?tab=customers" />} />
        <Route path="loyalty/customers/:customerId" element={g("admin.loyalty", <LoyaltyAdminCustomerDetail />)} />
        <Route path="loyalty/rewards" element={<LegacyRedirect to="/admin/loyalty?tab=rewards" />} />
        <Route path="loyalty/redemptions" element={<LegacyRedirect to="/admin/loyalty?tab=redemptions" />} />
        <Route path="loyalty/analytics" element={<LegacyRedirect to="/admin/loyalty?tab=analytics" />} />

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
        <Route path="report-schedules" element={<LegacyRedirect to="/admin/operations/report-schedules" />} />
        {/* Phase 2: Smart SEO Optimization */}
        <Route path="smart-seo" element={g("admin.cms", <SmartSEO />)} />
        {/* Data Management: Import / Export / Delete */}
        <Route path="data-management" element={<LegacyRedirect to="/admin/operations/data-management" />} />
        {/* Tour Analytics — Help & Tour usage statistics */}
        <Route path="tour-analytics" element={<LegacyRedirect to="/admin/operations/tour-analytics" />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
