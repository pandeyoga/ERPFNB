/**
 * InlineHelp — Lightweight contextual help tooltip.
 * Shows a small ? icon that opens a popover with explanatory text.
 * No tour overlay. Works independently of react-joyride.
 *
 * Usage:
 *   <InlineHelp id="ap-aging" />
 *   <InlineHelp title="AP Aging" content="Pengelompokan hutang..." placement="top" />
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { HelpCircle, X } from "lucide-react";
import { inlineHelpRegistry } from "@/contexts/tour/inlineHelpRegistry";
import { useTour } from "@/contexts/tour";

const PLACEMENT_CLASSES = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
  "top-start": "bottom-full mb-2 left-0",
  "top-end": "bottom-full mb-2 right-0",
  "bottom-start": "top-full mt-2 left-0",
  "bottom-end": "top-full mt-2 right-0",
};

function renderContent(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // bold **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : p
    );
    // bullet list
    if (line.startsWith("• ")) {
      return <li key={i} className="ml-3 list-none flex gap-1"><span className="text-foreground/40">•</span><span>{rendered}</span></li>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i}>{rendered}</p>;
  });
}

export function InlineHelp({
  id,
  title: titleProp,
  content: contentProp,
  placement = "top",
  size = "sm",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { run: tourRunning } = useTour();

  // Resolve from registry if id given
  const entry = id ? inlineHelpRegistry[id] : null;
  const title = titleProp || entry?.title || "";
  const content = contentProp || entry?.content || "";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Hide when tour is running
  if (tourRunning) return null;
  if (!content) return null;

  const sizeClass = size === "xs" ? "h-3.5 w-3.5" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const placementClass = PLACEMENT_CLASSES[placement] || PLACEMENT_CLASSES.top;

  return (
    <span ref={ref} className={`relative inline-flex ${className}`} data-testid={id ? `inline-help-${id}` : undefined}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        aria-label={`Bantuan: ${title || "info"}`}
        className={`
          inline-flex items-center justify-center rounded-full
          text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${sizeClass}
        `}
      >
        <HelpCircle className={sizeClass} />
      </button>

      {open && (
        <div
          role="tooltip"
          className={`
            absolute z-[9999] w-64 max-w-[calc(100vw-2rem)]
            ${placementClass}
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="
            rounded-xl border border-border/60 bg-background/95 shadow-xl
            backdrop-blur-xl px-4 py-3 text-sm
          ">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              {title && (
                <p className="font-semibold text-foreground leading-tight text-xs uppercase tracking-wide">
                  {title}
                </p>
              )}
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 h-4 w-4 rounded-full text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10 transition-colors"
                aria-label="Tutup bantuan"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {/* Content */}
            <div className="text-foreground/80 leading-relaxed space-y-0.5 text-[13px]">
              {renderContent(content)}
            </div>
          </div>
          {/* Arrow */}
          <div className={`absolute ${getArrowStyle(placement)} h-2 w-2 rotate-45 border border-border/60 bg-background/95`} />
        </div>
      )}
    </span>
  );
}

function getArrowStyle(placement) {
  const map = {
    top: "top-full -translate-y-1/2 left-1/2 -translate-x-1/2 border-t-0 border-l-0",
    bottom: "bottom-full translate-y-1/2 left-1/2 -translate-x-1/2 border-b-0 border-r-0",
    left: "left-full -translate-x-1/2 top-1/2 -translate-y-1/2 border-l-0 border-b-0",
    right: "right-full translate-x-1/2 top-1/2 -translate-y-1/2 border-r-0 border-t-0",
    "top-start": "top-full -translate-y-1/2 left-4 border-t-0 border-l-0",
    "top-end": "top-full -translate-y-1/2 right-4 border-t-0 border-l-0",
    "bottom-start": "bottom-full translate-y-1/2 left-4 border-b-0 border-r-0",
    "bottom-end": "bottom-full translate-y-1/2 right-4 border-b-0 border-r-0",
  };
  return map[placement] || map.top;
}

export default InlineHelp;
