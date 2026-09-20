/**
 * TourTooltip — Custom tooltip component for react-joyride
 * Mengganti default tooltip dengan UI premium glassmorphism + animation
 */
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function TourTooltip({
  index,
  step,
  size,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
}) {
  const [mounted, setMounted] = useState(false);
  const progress = ((index + 1) / size) * 100;

  useEffect(() => {
    // animate-in on mount
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, [index]);

  const title = step.title || (index === 0 ? "Selamat datang!" : null);
  const variant = step.variant || "default"; // default | hero | tip

  return (
    <div
      {...tooltipProps}
      className={`tour-tooltip ${mounted ? "tour-tooltip--mounted" : ""}`}
      style={{ minWidth: 360, maxWidth: 420 }}
      data-testid="tour-tooltip"
    >
      {/* Decorative gradient blob */}
      <div className="tour-tooltip__blob" aria-hidden="true" />

      {/* Header */}
      <div className="tour-tooltip__header">
        <div className="tour-tooltip__header-left">
          <div className="tour-tooltip__icon">
            {variant === "hero" ? (
              <Sparkles className="h-4 w-4" />
            ) : isLastStep ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="tour-tooltip__step">
              Langkah {index + 1} dari {size}
            </p>
            {title && <h3 className="tour-tooltip__title">{title}</h3>}
          </div>
        </div>
        <button
          {...closeProps}
          className="tour-tooltip__close"
          aria-label="Tutup tour"
          data-testid="tour-close-button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="tour-tooltip__progress">
        <div
          className="tour-tooltip__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="tour-tooltip__content">
        <TourContent content={step.content} />
      </div>

      {/* Footer */}
      <div className="tour-tooltip__footer">
        <div className="tour-tooltip__dots">
          {Array.from({ length: size }).map((_, i) => (
            <span
              key={i}
              className={`tour-tooltip__dot ${
                i === index
                  ? "tour-tooltip__dot--active"
                  : i < index
                  ? "tour-tooltip__dot--done"
                  : ""
              }`}
            />
          ))}
        </div>

        <div className="tour-tooltip__buttons">
          {index > 0 && (
            <button
              {...backProps}
              className="tour-tooltip__btn-back"
              data-testid="tour-back-button"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Kembali</span>
            </button>
          )}
          {!isLastStep && skipProps && (
            <button
              {...skipProps}
              className="tour-tooltip__btn-skip"
              data-testid="tour-skip-button"
            >
              Lewati
            </button>
          )}
          <button
            {...primaryProps}
            className="tour-tooltip__btn-primary"
            data-testid="tour-next-button"
          >
            <span>{isLastStep ? "Selesai" : "Lanjut"}</span>
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
            {isLastStep && <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * TourContent — Renders rich content (string with markdown-lite or JSX)
 */
function TourContent({ content }) {
  if (typeof content !== "string") {
    return <div className="tour-tooltip__text">{content}</div>;
  }

  // Convert simple markdown-lite to JSX
  // - **text** → <strong>text</strong>
  // - lines starting with • or ✅ or other emojis → list-like display
  // - \n\n → paragraph break
  // - \n → line break

  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="tour-tooltip__text">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        const isList = lines.every((l) =>
          /^\s*[•✅✓→📊📋✏️🍽️🧭💡🎂🥗🎵🕯️📅👤✨💰📞📍📱📦🔍⭐❌🎉⚠️🟢🟡🔴🔵🟣🟤⚪⚫🆕🆗🆔🆖]/.test(
            l.trim()
          )
        );

        if (isList && lines.length > 1) {
          return (
            <ul key={pi} className="tour-tooltip__list">
              {lines.map((line, li) => (
                <li key={li} className="tour-tooltip__list-item">
                  {parseInlineMarkdown(line.trim())}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={pi} className="tour-tooltip__para">
            {lines.map((line, li) => (
              <span key={li}>
                {parseInlineMarkdown(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineMarkdown(text) {
  // Parse **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="tour-tooltip__bold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
