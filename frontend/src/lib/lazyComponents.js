/**
 * Lazy Loading Wrapper for Heavy Components
 * 
 * Provides code splitting for expensive libraries like:
 * - Recharts (chart library)
 * - Tiptap (rich text editor)
 * - Other heavy components
 * 
 * Benefits:
 * - Reduces initial bundle size
 * - Faster initial page load
 * - Components loaded on-demand
 * 
 * Usage:
 *   import { LazyChart } from '@/lib/lazyComponents';
 *   <LazyChart type="LineChart" data={data} />
 */

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Loading fallback component
export function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-64 bg-muted/20 rounded-lg border border-dashed">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading chart...</p>
      </div>
    </div>
  );
}

export function EditorLoader() {
  return (
    <div className="flex items-center justify-center h-32 bg-muted/20 rounded-lg border">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
        <p className="text-xs text-muted-foreground">Loading editor...</p>
      </div>
    </div>
  );
}

// Lazy load Recharts components
export const LazyLineChart = lazy(() =>
  import('recharts').then(mod => ({ default: mod.LineChart }))
);

export const LazyBarChart = lazy(() =>
  import('recharts').then(mod => ({ default: mod.BarChart }))
);

export const LazyPieChart = lazy(() =>
  import('recharts').then(mod => ({ default: mod.PieChart }))
);

export const LazyAreaChart = lazy(() =>
  import('recharts').then(mod => ({ default: mod.AreaChart }))
);

// Wrapper component for easier usage
export function LazyChart({ type = 'LineChart', fallback = <ChartLoader />, children, ...props }) {
  let ChartComponent;
  
  switch (type) {
    case 'LineChart':
      ChartComponent = LazyLineChart;
      break;
    case 'BarChart':
      ChartComponent = LazyBarChart;
      break;
    case 'PieChart':
      ChartComponent = LazyPieChart;
      break;
    case 'AreaChart':
      ChartComponent = LazyAreaChart;
      break;
    default:
      ChartComponent = LazyLineChart;
  }
  
  return (
    <Suspense fallback={fallback}>
      <ChartComponent {...props}>
        {children}
      </ChartComponent>
    </Suspense>
  );
}

// Lazy load Tiptap editor (if using)
export const LazyRichTextEditor = lazy(() =>
  import('@/components/shared/RichTextEditor').catch(() => ({
    default: () => <div>Editor not available</div>
  }))
);

// Wrapper for rich text editor
export function LazyEditor({ fallback = <EditorLoader />, ...props }) {
  return (
    <Suspense fallback={fallback}>
      <LazyRichTextEditor {...props} />
    </Suspense>
  );
}

export default {
  Chart: LazyChart,
  Editor: LazyEditor,
  ChartLoader,
  EditorLoader,
};
