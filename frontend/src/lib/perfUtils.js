/**
 * Performance Optimization Utilities
 * 
 * Tier 1.7: Memoization helpers for expensive computations
 * 
 * Usage in components:
 * import { useMemoizedData, useDebouncedValue } from '@/lib/perfUtils';
 */

import { useMemo, useState, useEffect, useRef } from 'react';

/**
 * Memoize expensive data transformations
 * 
 * @example
 * const chartData = useMemoizedData(
 *   () => rawData.map(d => ({ x: d.date, y: d.value })),
 *   [rawData]
 * );
 */
export function useMemoizedData(factory, deps) {
  return useMemo(factory, deps);
}

/**
 * Memoize sorted/filtered data
 * 
 * @example
 * const sortedItems = useMemoizedSort(items, 'created_at', 'desc');
 */
export function useMemoizedSort(data, sortKey, direction = 'asc') {
  return useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal > bVal ? 1 : -1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, direction]);
}

/**
 * Memoize filtered data
 * 
 * @example
 * const activeUsers = useMemoizedFilter(users, (u) => u.status === 'active');
 */
export function useMemoizedFilter(data, predicate) {
  return useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter(predicate);
  }, [data, predicate]);
}

/**
 * Memoize grouped/aggregated data
 * 
 * @example
 * const byOutlet = useMemoizedGroupBy(sales, 'outlet_id');
 */
export function useMemoizedGroupBy(data, key) {
  return useMemo(() => {
    if (!Array.isArray(data)) return {};
    
    return data.reduce((acc, item) => {
      const groupKey = item[key];
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {});
  }, [data, key]);
}

/**
 * Memoize computed totals
 * 
 * @example
 * const totalSales = useMemoizedSum(sales, 'amount');
 */
export function useMemoizedSum(data, key) {
  return useMemo(() => {
    if (!Array.isArray(data)) return 0;
    return data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
  }, [data, key]);
}

/**
 * Debounce a value (useful for search inputs)
 * 
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebouncedValue(search, 500);
 * 
 * useEffect(() => {
 *   // API call with debouncedSearch
 * }, [debouncedSearch]);
 */
export function useDebouncedValue(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle a function (useful for scroll/resize handlers)
 * 
 * @example
 * const handleScroll = useThrottledCallback(() => {
 *   // Expensive operation
 * }, 100);
 */
export function useThrottledCallback(callback, delay = 100) {
  const lastRun = useRef(Date.now());

  return useMemo(
    () => (...args) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      }
    },
    [callback, delay]
  );
}

/**
 * Memoize expensive calculations with custom equality check
 * Useful when deep comparison is needed
 * 
 * @example
 * const processedData = useMemoizedWithEqual(
 *   () => expensiveTransform(data),
 *   [data],
 *   (a, b) => JSON.stringify(a) === JSON.stringify(b)
 * );
 */
export function useMemoizedWithEqual(factory, deps, isEqual) {
  const ref = useRef({ deps: undefined, result: undefined });

  const depsMatch = ref.current.deps && 
    deps.length === ref.current.deps.length &&
    deps.every((dep, i) => isEqual(dep, ref.current.deps[i]));

  if (!depsMatch) {
    ref.current.result = factory();
    ref.current.deps = deps;
  }

  return ref.current.result;
}

/**
 * Auto-memoize all properties of an object
 * 
 * @example
 * const stats = useAutoMemo({
 *   total: () => data.reduce((s, d) => s + d.value, 0),
 *   average: () => total / data.length,
 *   max: () => Math.max(...data.map(d => d.value)),
 * }, [data]);
 */
export function useAutoMemo(factories, deps) {
  return useMemo(() => {
    const result = {};
    for (const [key, factory] of Object.entries(factories)) {
      result[key] = factory();
    }
    return result;
  }, deps);
}

export default {
  useMemoizedData,
  useMemoizedSort,
  useMemoizedFilter,
  useMemoizedGroupBy,
  useMemoizedSum,
  useDebouncedValue,
  useThrottledCallback,
  useMemoizedWithEqual,
  useAutoMemo,
};
