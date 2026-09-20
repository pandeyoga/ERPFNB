/**
 * lazyWithRetry — robust replacement for React.lazy.
 *
 * Solves two real problems behind the "intermittent blank page" UX:
 *
 *  RC-2 (Unhandled lazy-chunk failures): If a webpack chunk fails to load
 *       (network blip, CDN cache miss, slow preview proxy), the import()
 *       promise rejects. React Suspense catches that — but the rejected
 *       promise is *cached* by webpack's chunk loader, so every subsequent
 *       navigation that touches that portal hits the same rejected promise
 *       and stays in fallback (= "blank") forever, until a hard refresh.
 *
 *  RC-2b (Stale chunk after redeploy): When the server has a new bundle
 *       but the user's HTML still references the old chunk URL → the
 *       chunk 404s. Same poisoned-promise cascade.
 *
 * Strategy:
 *  1. Wrap the importFn so we can **retry** with exponential backoff (3 tries).
 *  2. If all retries fail, return a **synthetic React component** that
 *     renders a friendly fallback UI with a "Reload" button — instead of
 *     letting the promise reject (which would freeze Suspense forever).
 *  3. We never return a rejected promise from this lazy() so Suspense
 *     always resolves, even on permanent failure.
 *
 * @param {() => Promise<{default: React.ComponentType}>} importFn
 * @param {string} [chunkName] - for error messages
 * @returns {React.LazyExoticComponent}
 */
import { lazy } from "react";
import { logger } from "@/lib/logger";

function ChunkErrorFallback({ chunkName, lastError }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             className="text-amber-600 dark:text-amber-400">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
          <line x1="12" x2="12" y1="9" y2="13"></line>
          <line x1="12" x2="12.01" y1="17" y2="17"></line>
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-1">Gagal Memuat Halaman</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Browser tidak bisa mengunduh modul {chunkName ? <code className="text-xs">{chunkName}</code> : "ini"}.
          Hal ini biasanya karena koneksi internet sedang tidak stabil atau aplikasi baru saja di-update.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        data-testid="chunk-error-reload"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
          <path d="M21 3v5h-5"></path>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
          <path d="M3 21v-5h5"></path>
        </svg>
        Muat Ulang Halaman
      </button>
      {lastError ? (
        <details className="text-xs text-muted-foreground/70 mt-2">
          <summary className="cursor-pointer">Detail teknis</summary>
          <pre className="mt-2 text-left whitespace-pre-wrap break-all max-w-md">{String(lastError)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function lazyWithRetry(importFn, chunkName = "module") {
  return lazy(async () => {
    const maxAttempts = 3;
    let lastErr = null;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const mod = await importFn();
        // Sanity check: ensure shape is { default: Component }
        if (mod && typeof mod === "object" && mod.default) return mod;
        // Unexpected shape — treat as error & retry
        throw new Error(`Module ${chunkName} did not export a default React component`);
      } catch (err) {
        lastErr = err;
        logger.warn(`Chunk load attempt ${i + 1}/${maxAttempts} failed for ${chunkName}`, {
          error: err?.message || String(err),
        });
        if (i < maxAttempts - 1) {
          // Backoff: 300ms, 900ms (exponential-ish, fast enough to not annoy)
          await sleep(300 * Math.pow(3, i));
        }
      }
    }
    // All retries failed. Return a synthetic module so Suspense resolves.
    logger.error(`Chunk failed permanently after ${maxAttempts} attempts: ${chunkName}`, {
      error: lastErr?.message || String(lastErr),
    });
    return {
      default: () => <ChunkErrorFallback chunkName={chunkName} lastError={lastErr} />,
    };
  });
}

export default lazyWithRetry;
