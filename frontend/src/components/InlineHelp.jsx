/**
 * InlineHelp — Contextual help tooltip component
 * 
 * Provides lightweight contextual help via a ? icon button + popover.
 * - Keyboard accessible (Enter/Space open, Esc close)
 * - Auto-disables while tour is running (via TourProvider context)
 * - z-index compatible with Joyride overlay
 * - Supports markdown-lite content
 */
import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTour } from "@/contexts/tour/TourProvider";
import { cn } from "@/lib/utils";

export function InlineHelp({ 
  helpId, 
  title, 
  content, 
  placement = "top",
  size = "sm",
  className 
}) {
  const [open, setOpen] = useState(false);
  const { run: tourIsRunning } = useTour();

  // Auto-close if tour starts
  React.useEffect(() => {
    if (tourIsRunning && open) {
      setOpen(false);
    }
  }, [tourIsRunning, open]);

  // Don't render if tour is running to avoid overlay conflicts
  if (tourIsRunning) {
    return null;
  }

  const iconSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "text-muted-foreground hover:text-foreground",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            className
          )}
          aria-label={title || "Bantuan"}
          data-testid={`inline-help-${helpId}`}
        >
          <HelpCircle className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={placement}
        align="start"
        className="inline-help-popover z-[10100] w-80 p-4"
        data-testid={`inline-help-content-${helpId}`}
      >
        {title && (
          <div className="mb-2 font-semibold text-sm text-foreground">
            {title}
          </div>
        )}
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          {typeof content === "string" ? (
            <ContentRenderer content={content} />
          ) : (
            content
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * ContentRenderer — Simple markdown-lite parser
 * Supports: **bold**, *italic*, • bullets, line breaks
 */
function ContentRenderer({ content }) {
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, idx) => {
        // Empty line = spacer
        if (!line.trim()) {
          return <div key={idx} className="h-2" />;
        }

        // Bullet list
        if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
          const text = line.trim().replace(/^[•-]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span className="flex-1">
                <MarkdownText text={text} />
              </span>
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={idx}>
            <MarkdownText text={line} />
          </p>
        );
      })}
    </>
  );
}

/**
 * MarkdownText — Parse inline markdown (**bold**, *italic*)
 */
function MarkdownText({ text }) {
  const parts = [];
  let current = "";
  let i = 0;

  while (i < text.length) {
    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      if (current) parts.push(current);
      current = "";
      i += 2;
      let boldText = "";
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "*")) {
        boldText += text[i];
        i++;
      }
      parts.push(<strong key={parts.length} className="font-semibold text-foreground">{boldText}</strong>);
      i += 2;
      continue;
    }

    // *italic*
    if (text[i] === "*") {
      if (current) parts.push(current);
      current = "";
      i += 1;
      let italicText = "";
      while (i < text.length && text[i] !== "*") {
        italicText += text[i];
        i++;
      }
      parts.push(<em key={parts.length} className="italic">{italicText}</em>);
      i += 1;
      continue;
    }

    current += text[i];
    i++;
  }

  if (current) parts.push(current);

  return <>{parts}</>;
}

export default InlineHelp;
