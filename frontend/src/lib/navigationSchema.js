/**
 * navigationSchema.js — Thin facade (Phase B refactor).
 * Portal navigation definitions split into sub-files under navigationSchema/ folder.
 *
 * Sub-files:
 *   navigationSchema/admin.js       — Admin portal
 *   navigationSchema/executive.js  — Executive portal
 *   navigationSchema/finance.js    — Finance + Reports portals
 *   navigationSchema/hr.js         — HR portal
 *   navigationSchema/procurement.js — Procurement portal
 *   navigationSchema/inventory.js  — Inventory portal
 *   navigationSchema/outlet.js     — Outlet portal
 *   navigationSchema/owner.js      — Owner portal
 *
 * Backward-compatible: NAVIGATION_SCHEMA, getNavigationSchema, getPortalSections unchanged.
 */
import { adminNav }       from './navigationSchema/admin';
import { executiveNav }   from './navigationSchema/executive';
import { financeNav }     from './navigationSchema/finance';
import { hrNav }          from './navigationSchema/hr';
import { procurementNav } from './navigationSchema/procurement';
import { inventoryNav }   from './navigationSchema/inventory';
import { outletNav }      from './navigationSchema/outlet';
import { ownerNav }       from './navigationSchema/owner';

export const NAVIGATION_SCHEMA = {
  admin:        adminNav,
  executive:    executiveNav,
  finance:      financeNav,
  hr:           hrNav,
  procurement:  procurementNav,
  inventory:    inventoryNav,
  outlet:       outletNav,
  owner:        ownerNav,
};

/**
 * Get navigation schema for a specific portal
 */
export function getNavigationSchema(portalId) {
  return NAVIGATION_SCHEMA[portalId] || null;
}

/**
 * Get all sections for a portal
 */
export function getPortalSections(portalId) {
  const schema = getNavigationSchema(portalId);
  return schema?.sections || [];
}

/**
 * Get all known portal IDs (for cross-portal nav indexing).
 */
export function getAllPortalIds() {
  return Object.keys(NAVIGATION_SCHEMA);
}
