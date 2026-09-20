/**
 * tours.js — Thin facade (Phase 5 refactor).
 * All tour definitions split into sub-files under tours/ folder.
 *
 * Sub-files:
 *   tours/outlet.js       — Outlet portal tours (11 tours, incl. DailyOrdersHub + EndOfDay)
 *   tours/admin.js        — Admin portal tours (7 tours, incl. MasterDataHub + CMSStudio)
 *   tours/procurement.js  — Procurement portal tours (6 tours, specific per page)
 *   tours/finance.js      — Finance portal tours (7 tours, incl. PeriodClosingHub)
 *   tours/inventory.js    — Inventory portal tours (7 tours, incl. MovementsHub)
 *   tours/executive.js    — Executive portal tours (1 tour)
 *   tours/owner.js        — Owner portal tours (1 tour)
 *   tours/hr.js           — HR portal tours (6 tours, incl. CompensationHub)
 *   tours/shared.js       — General navigation tour (1 tour)
 *   tours/registry.js     — tourRegistry + TOUR_VERSIONS + getTourVersion (65+ tours total)
 *
 * Backward-compatible: existing imports unchanged.
 */
export { tourRegistry, TOUR_VERSIONS, getTourVersion } from './tours/registry';
