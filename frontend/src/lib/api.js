import axios from "axios";
import { requestQueue } from "./requestQueue";
import { perfMonitor } from "./perfMonitor";
import { logger } from "./logger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// FE-06: session rides on httpOnly cookies (aurora_at / aurora_rt) — no token in JS storage
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true,
});

// ── Konteks kerja global (contexts/ScopeContext, DESIGN_SYSTEM §10.7) ─────────────────────────────
// Setiap GET otomatis membawa konteks TopNav ({ brand_id } | { outlet_id }) kecuali:
//  - request sudah memilih toko/brand sendiri (filter Toko lokal, lookup toko lain di form transfer, …);
//  - `config.scope === false` (opt-out eksplisit, mis. matriks yang memang butuh semua toko);
//  - endpoint tingkat Group / identitas / konfigurasi (daftar di bawah).
// Server tetap menegakkan akses user; parameter yang tidak dikenal endpoint diabaikan FastAPI.
let requestScope = {};
export function setRequestScope(params) {
  requestScope = params || {};
}
const SCOPE_KEYS = ["outlet_id", "outlet_ids", "dim_outlet", "brand_id", "brand_ids"];
const GROUP_LEVEL_PREFIXES = [
  "/auth", "/preferences", "/admin", "/master", "/notifications", "/search", "/files", "/uploads",
  "/public", "/system-settings", "/approval-matrix", "/tour", "/seo",
  "/finance/periods", "/finance/chart-of-accounts", "/tax", "/efaktur", "/ebupot",
];
function withScope(config) {
  if (!requestScope || !Object.keys(requestScope).length || config.scope === false) return config;
  if ((config.method || "get").toLowerCase() !== "get") return config;
  const url = config.url || "";
  if (/^https?:/.test(url) || GROUP_LEVEL_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`))) return config;
  const params = config.params instanceof URLSearchParams ? Object.fromEntries(config.params) : { ...(config.params || {}) };
  const has = (k) => (params[k] !== undefined && params[k] !== null && params[k] !== "") || new RegExp(`[?&]${k}=`).test(url);
  if (SCOPE_KEYS.some(has)) return config;
  for (const k of SCOPE_KEYS) if (k in params) delete params[k]; // "" = semua → ganti dengan konteks
  // Endpoint lama memakai bentuk jamak (outlet_ids / brand_ids, mis. Executive & Reports): kirim keduanya.
  const extra = { ...requestScope };
  if (extra.outlet_id) extra.outlet_ids = extra.outlet_id;
  if (extra.brand_id) extra.brand_ids = extra.brand_id;
  config.params = { ...params, ...extra };
  return config;
}

api.interceptors.request.use((config) => {
  // Track request start time for performance monitoring
  config.metadata = { startTime: Date.now() };
  return withScope(config);
});

// Auto-refresh on 401 + 403 no-access redirect + 429 rate limit handling
let refreshPromise = null;
api.interceptors.response.use(
  (response) => {
    // Track successful API call duration
    if (response.config.metadata?.startTime) {
      const duration = Date.now() - response.config.metadata.startTime;
      const endpoint = `${response.config.method.toUpperCase()} ${response.config.url}`;
      perfMonitor.trackAPI(endpoint, duration, 'success');
    }
    return response;
  },
  async (error) => {
    // Track failed API call duration
    if (error.config?.metadata?.startTime) {
      const duration = Date.now() - error.config.metadata.startTime;
      const endpoint = `${error.config.method?.toUpperCase()} ${error.config.url}`;
      perfMonitor.trackAPI(endpoint, duration, 'error');
    }
    
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.errors?.[0]?.code;

    // 429 Too Many Requests — Rate limit exceeded
    if (status === 429 && !original._retryCount) {
      original._retryCount = 0;
    }

    if (status === 429 && original._retryCount < 3) {
      original._retryCount++;
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, original._retryCount), 8000);
      
      logger.warn(`Rate limited (429). Retrying in ${delay}ms...`, { 
        attempt: original._retryCount, 
        maxAttempts: 3,
        endpoint: original.url 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(original);
    }

    // 403 Forbidden — user doesn't have permission for this resource
    if (status === 403) {
      // Only redirect for full-page requests, not background data fetches
      // (background fetches will show toast errors from the component)
      const isNavigationRequest = !original._isBackground;
      if (isNavigationRequest && window.location.pathname !== "/no-access") {
        // Let the portal-level RequirePortal handle redirects;
        // just throw so the component can show a toast
      }
      throw error;
    }

    const isAuthCall = /\/auth\/(login|refresh)$/.test(original?.url || "");
    if (status === 401 && !isAuthCall && !original._retry) {
      original._retry = true;
      try {
        // expired/missing access cookie → rotate via refresh cookie (single-flight)
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE}/auth/refresh`, null, { withCredentials: true });
        }
        await refreshPromise;
        refreshPromise = null;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        if (!original._skipAuthRedirect && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw error;
      }
    }
    throw error;
  },
);

export default api;

// Throttled wrappers for high-frequency endpoints
export const throttledGet = (url, config) => 
  requestQueue.add(() => api.get(url, config));

export const throttledPost = (url, data, config) => 
  requestQueue.add(() => api.post(url, data, config));

export const throttledPut = (url, data, config) => 
  requestQueue.add(() => api.put(url, data, config));

export const throttledDelete = (url, config) => 
  requestQueue.add(() => api.delete(url, config));

// CTL-15: dropdown sources must never be silently truncated — page through meta.total
export async function fetchAll(url, params = {}, pageSize = 500) {
  const get = (page) => api.get(url, { params: { ...params, page, per_page: pageSize } });
  const first = await get(1);
  const items = [...(first.data?.data || [])];
  const total = first.data?.meta?.total ?? items.length;
  for (let page = 2; items.length < total && page <= 40; page++) {
    const chunk = (await get(page)).data?.data || [];
    if (!chunk.length) break;
    items.push(...chunk);
  }
  return { ...first, data: { ...first.data, data: items, meta: { ...(first.data?.meta || {}), total: items.length } } };
}

// Helper: extract data envelope
export const unwrap = (response) => response.data?.data ?? null;
export const unwrapWithMeta = (response) => ({
  data: response.data?.data ?? null,
  meta: response.data?.meta ?? null,
});
export const unwrapError = (e) => {
  const errs = e.response?.data?.errors;
  if (errs?.length) return errs[0].message;
  return e.message || "Network error";
};
