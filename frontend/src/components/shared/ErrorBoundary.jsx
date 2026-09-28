/**
 * Sprint D Phase 5 — Global Error Boundary
 * Prevents blank screens when a React component crashes.
 * Usage:
 *   <ErrorBoundary scope="Finance Portal">
 *     <FinancePortal />
 *   </ErrorBoundary>
 */
import React from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

function generateErrorRef() {
  return "ERR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorRef: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorRef: generateErrorRef(),
    };
  }

  componentDidCatch(error, errorInfo) {
    const errorRef = this.state.errorRef || generateErrorRef();
    this.setState({ error, errorInfo, errorRef });

    // Log error with reference ID for debugging
    logger.error(
      `Error caught in ${this.props.scope || "unknown"}`,
      { 
        errorRef, 
        error: error.toString(),
        componentStack: errorInfo?.componentStack,
        scope: this.props.scope
      }
    );

    // Optional: send to backend error log endpoint
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
      const token = localStorage.getItem("aurora_token");
      if (backendUrl && token) {
        fetch(`${backendUrl}/api/errors/client`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            error_ref: errorRef,
            scope: this.props.scope || "unknown",
            message: error?.message || "Unknown error",
            stack: error?.stack,
            component_stack: errorInfo?.componentStack,
            url: window.location.href,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {}); // fire-and-forget, never throws
      }
    } catch (_) {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorRef: null });
  };

  handleGoHome = () => {
    this.handleReset();
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { scope = "Halaman ini", compact = false } = this.props;
    const { errorRef } = this.state;

    // Compact variant — used inside smaller widget containers
    if (compact) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-foreground">Komponen gagal dimuat</p>
            <p className="mt-1 text-xs text-muted-foreground">Ref: {errorRef}</p>
          </div>
          <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </Button>
        </div>
      );
    }

    // Full-page variant
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-12 text-center"
        data-testid="error-boundary-fallback"
      >
        {/* Icon + decorative ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full bg-red-500/10 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15 ring-2 ring-red-500/20">
            <AlertTriangle className="h-9 w-9 text-red-500" />
          </div>
        </div>

        {/* Message */}
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Ups, ada yang tidak beres
          </h2>
          <p className="text-sm text-muted-foreground">
            <strong>{scope}</strong> mengalami error yang tidak terduga. Anda bisa mencoba reload
            halaman atau kembali ke beranda.
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
            <Bug className="h-3.5 w-3.5" />
            Kode referensi untuk pelaporan:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
              {errorRef}
            </code>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={this.handleReset}
            className="gap-2"
            data-testid="error-boundary-retry-btn"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
          <Button
            variant="outline"
            onClick={this.handleGoHome}
            className="gap-2"
            data-testid="error-boundary-home-btn"
          >
            <Home className="h-4 w-4" />
            Kembali ke Beranda
          </Button>
        </div>

        {/* Collapsible error detail for developers */}
        {process.env.NODE_ENV === "development" && this.state.error && (
          <details className="mt-4 w-full max-w-2xl rounded-lg border border-border bg-muted/30 p-4 text-left">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Detail error (hanya tampil di development)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-red-600 dark:text-red-400">
              {this.state.error.toString()}
              {"\n\n"}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
