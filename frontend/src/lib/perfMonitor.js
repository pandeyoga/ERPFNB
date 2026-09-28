/**
 * Performance Monitoring Utility
 * 
 * Provides lightweight client-side performance tracking for:
 * - API call durations
 * - Component render times
 * - Page load metrics
 * - Cache hit rates (React Query)
 * 
 * Usage:
 *   import { perfMonitor } from '@/lib/perfMonitor';
 *   perfMonitor.trackAPI('GET /api/approvals/queue', 150); // 150ms
 *   perfMonitor.getStats(); // View aggregated stats
 */

class PerformanceMonitor {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'development' || window.localStorage.getItem('perf_monitor') === 'true';
    this.metrics = {
      apiCalls: [],
      pageLoads: [],
      renders: [],
    };
    this.maxEntries = 100; // Keep last 100 entries per metric type
  }

  /**
   * Track API call performance
   */
  trackAPI(endpoint, duration, status = 'success') {
    if (!this.enabled) return;
    
    const entry = {
      endpoint,
      duration,
      status,
      timestamp: Date.now(),
    };
    
    this.metrics.apiCalls.push(entry);
    if (this.metrics.apiCalls.length > this.maxEntries) {
      this.metrics.apiCalls.shift();
    }
    
    // Log slow requests in console
    if (duration > 1000) {
      console.warn(`[PerfMonitor] Slow API call: ${endpoint} took ${duration}ms`);
    }
  }

  /**
   * Track page load time
   */
  trackPageLoad(pageName, duration) {
    if (!this.enabled) return;
    
    const entry = {
      page: pageName,
      duration,
      timestamp: Date.now(),
    };
    
    this.metrics.pageLoads.push(entry);
    if (this.metrics.pageLoads.length > this.maxEntries) {
      this.metrics.pageLoads.shift();
    }
  }

  /**
   * Track component render time
   */
  trackRender(componentName, duration) {
    if (!this.enabled) return;
    
    const entry = {
      component: componentName,
      duration,
      timestamp: Date.now(),
    };
    
    this.metrics.renders.push(entry);
    if (this.metrics.renders.length > this.maxEntries) {
      this.metrics.renders.shift();
    }
  }

  /**
   * Get aggregated statistics
   */
  getStats() {
    if (!this.enabled) return null;
    
    const now = Date.now();
    const last5Min = now - 5 * 60 * 1000;
    
    // Filter recent entries
    const recentAPICalls = this.metrics.apiCalls.filter(e => e.timestamp > last5Min);
    const recentPageLoads = this.metrics.pageLoads.filter(e => e.timestamp > last5Min);
    
    // Calculate API stats
    const apiStats = this._calculateStats(recentAPICalls.map(e => e.duration));
    const apiByEndpoint = this._groupBy(recentAPICalls, 'endpoint');
    
    // Calculate page load stats
    const pageStats = this._calculateStats(recentPageLoads.map(e => e.duration));
    
    // Cache hit rate (React Query)
    const cacheStats = this._getCacheStats();
    
    return {
      timeWindow: '5 minutes',
      api: {
        totalCalls: recentAPICalls.length,
        avgDuration: apiStats.avg,
        p95Duration: apiStats.p95,
        slowCalls: recentAPICalls.filter(e => e.duration > 1000).length,
        errors: recentAPICalls.filter(e => e.status === 'error').length,
        byEndpoint: Object.entries(apiByEndpoint).map(([endpoint, calls]) => ({
          endpoint,
          count: calls.length,
          avgDuration: this._calculateStats(calls.map(c => c.duration)).avg,
        })).sort((a, b) => b.count - a.count).slice(0, 10),
      },
      pageLoads: {
        totalLoads: recentPageLoads.length,
        avgDuration: pageStats.avg,
        p95Duration: pageStats.p95,
      },
      cache: cacheStats,
    };
  }

  /**
   * Print stats to console
   */
  printStats() {
    if (!this.enabled) {
      console.log('[PerfMonitor] Disabled. Enable with: localStorage.setItem("perf_monitor", "true")');
      return;
    }
    
    const stats = this.getStats();
    if (!stats) return;
    
    console.group('📊 Performance Stats (Last 5 Minutes)');
    
    console.group('🌐 API Calls');
    console.log(`Total: ${stats.api.totalCalls}`);
    console.log(`Avg Duration: ${stats.api.avgDuration}ms`);
    console.log(`P95 Duration: ${stats.api.p95Duration}ms`);
    console.log(`Slow (>1s): ${stats.api.slowCalls}`);
    console.log(`Errors: ${stats.api.errors}`);
    console.log('\nTop Endpoints:');
    console.table(stats.api.byEndpoint);
    console.groupEnd();
    
    console.group('📄 Page Loads');
    console.log(`Total: ${stats.pageLoads.totalLoads}`);
    console.log(`Avg Duration: ${stats.pageLoads.avgDuration}ms`);
    console.log(`P95 Duration: ${stats.pageLoads.p95Duration}ms`);
    console.groupEnd();
    
    if (stats.cache) {
      console.group('💾 React Query Cache');
      console.log(`Hit Rate: ${stats.cache.hitRate}%`);
      console.log(`Queries: ${stats.cache.queryCount}`);
      console.log(`Mutations: ${stats.cache.mutationCount}`);
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      apiCalls: [],
      pageLoads: [],
      renders: [],
    };
    console.log('[PerfMonitor] Metrics reset');
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    window.localStorage.setItem('perf_monitor', enabled ? 'true' : 'false');
    console.log(`[PerfMonitor] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  // Helper methods
  _calculateStats(values) {
    if (values.length === 0) return { avg: 0, p95: 0, min: 0, max: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const p95Index = Math.floor(sorted.length * 0.95);
    
    return {
      avg: Math.round(sum / sorted.length),
      p95: sorted[p95Index] || 0,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  _groupBy(array, key) {
    return array.reduce((acc, item) => {
      const group = item[key];
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {});
  }

  _getCacheStats() {
    try {
      // Try to access React Query cache
      const cache = window.__REACT_QUERY_CACHE__;
      if (!cache) return null;
      
      return {
        queryCount: cache.queries?.length || 0,
        mutationCount: cache.mutations?.length || 0,
        hitRate: 0, // Would need to track hits/misses separately
      };
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.__perfMonitor = perfMonitor;
  
  // Only log initialization in development or when explicitly enabled
  if (process.env.NODE_ENV === 'development' || window.localStorage.getItem('perf_monitor') === 'true') {
    console.log('[PerfMonitor] Available globally as window.__perfMonitor');
    console.log('Usage: __perfMonitor.printStats()');
  }
}

export default perfMonitor;
