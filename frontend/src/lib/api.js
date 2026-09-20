import axios from "axios";
import { requestQueue } from "./requestQueue";
import { perfMonitor } from "./perfMonitor";
import { logger } from "./logger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach token from localStorage + track request start time
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aurora_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Track request start time for performance monitoring
  config.metadata = { startTime: Date.now() };
  return config;
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

    if (status === 401 && code === "TOKEN_EXPIRED" && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const rt = localStorage.getItem("aurora_refresh_token");
            if (!rt) throw new Error("no refresh");
            const res = await axios.post(`${API_BASE}/auth/refresh`, {
              refresh_token: rt,
            });
            const newToken = res.data.data.access_token;
            localStorage.setItem("aurora_access_token", newToken);
            return newToken;
          })();
        }
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        localStorage.removeItem("aurora_access_token");
        localStorage.removeItem("aurora_refresh_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw e;
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
