/**
 * HelpTourButton — Smart tour trigger with search + completion + version awareness.
 *
 * Features:
 * - Auto-detect active path → suggest relevant tours
 * - Popover with sections: page-specific + general
 * - **Search bar** with keyboard nav (arrows + enter + esc)
 * - **"Updated" badge** for tours newer than user's completed version
 * - **Green check** for completed (current version)
 * - First-visit pulse hint (10s)
 * - Badge counter for # available tours
 * - Hide on public pages
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  HelpCircle,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Search,
  X,
  Inbox,
  RotateCw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTour } from "@/contexts/tour";
import { getToursForPath, getTourMetadata } from "@/contexts/tour/tourMap";
import { tourRegistry } from "@/contexts/tour/tours";

const HINT_KEY = "fnb_tour_hint_dismissed";

export default function HelpTourButton() {
  const location = useLocation();
  const { startTour, isCompleted, isOutdated } = useTour();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef(null);

  const currentPath = location.pathname;
  const availableTourIds = getToursForPath(currentPath);

  // Determine if this is a public page (hide tour button)
  const isPublicPage =
    currentPath === "/login" ||
    currentPath.startsWith("/loyalty") ||
    currentPath === "/" ||
    currentPath.startsWith("/menu") ||
    currentPath.startsWith("/reservation/") ||
    currentPath.startsWith("/news") ||
    currentPath.startsWith("/about") ||
    currentPath.startsWith("/brand/");

  // ============================================================
  // Search + grouping
  // ============================================================
  const pageSpecificIds = availableTourIds.filter(
    (id) => id !== "general-navigation"
  );
  const hasGeneral = availableTourIds.includes("general-navigation");

  // Get all tour IDs available system-wide for search-across-all
  const allTourIds = useMemo(() => Object.keys(tourRegistry), []);

  // Filter logic:
  // - If searching, search across ALL tours (page-aware sorting: page-specific first)
  // - If not searching, show only relevant + general
  const { filteredPageIds, filteredGeneralId, searchResults, isSearching } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        filteredPageIds: pageSpecificIds,
        filteredGeneralId: hasGeneral ? "general-navigation" : null,
        searchResults: [],
        isSearching: false,
      };
    }
    // Search across all
    const matches = allTourIds.filter((id) => {
      const meta = getTourMetadata(id);
      if (!meta) return false;
      const hay = `${meta.title} ${meta.description}`.toLowerCase();
      return hay.includes(q);
    });
    // Sort: page-specific first
    const pageSet = new Set(pageSpecificIds);
    matches.sort((a, b) => {
      const aOnPage = pageSet.has(a) ? 0 : 1;
      const bOnPage = pageSet.has(b) ? 0 : 1;
      if (aOnPage !== bOnPage) return aOnPage - bOnPage;
      return a.localeCompare(b);
    });
    return {
      filteredPageIds: [],
      filteredGeneralId: null,
      searchResults: matches,
      isSearching: true,
    };
  }, [searchQuery, pageSpecificIds, hasGeneral, allTourIds]);

  // Flat list for keyboard nav
  const flatList = isSearching
    ? searchResults
    : [...filteredPageIds, ...(filteredGeneralId ? [filteredGeneralId] : [])];

  // First-visit hint
  useEffect(() => {
    if (isPublicPage) return;
    try {
      const dismissed = localStorage.getItem(HINT_KEY);
      if (!dismissed) {
        setShowHint(true);
        const t = setTimeout(() => {
          setShowHint(false);
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            /* noop */
          }
        }, 10000);
        return () => clearTimeout(t);
      }
    } catch {
      /* noop */
    }
  }, [isPublicPage]);

  // Reset focus when list changes
  useEffect(() => {
    setFocusedIndex(flatList.length > 0 ? 0 : -1);
  }, [searchQuery, open, flatList.length]);

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Hide on public pages — after all hooks
  if (isPublicPage) {
    return null;
  }

  // ============================================================
  // Handlers
  // ============================================================
  const handleStartTour = (tourId) => {
    startTour(tourId);
    setOpen(false);
    if (showHint) {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* noop */
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) =>
        flatList.length === 0 ? -1 : (i + 1) % flatList.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) =>
        flatList.length === 0 ? -1 : (i - 1 + flatList.length) % flatList.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < flatList.length) {
        handleStartTour(flatList[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (searchQuery) {
        setSearchQuery("");
      } else {
        setOpen(false);
      }
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && showHint) {
          setShowHint(false);
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            /* noop */
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={`help-tour-btn-trigger ${
            showHint ? "help-tour-btn-trigger--hint" : ""
          }`}
          aria-label="Bantuan & Tour"
          data-testid="help-tour-button"
        >
          <HelpCircle className="h-5 w-5" />
          {pageSpecificIds.length > 0 && (
            <span className="help-tour-btn-badge" data-testid="help-tour-badge">
              {pageSpecificIds.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 overflow-hidden"
        align="end"
        sideOffset={10}
        data-testid="help-tour-popover"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="help-tour-popover-header">
          <div className="help-tour-popover-title-row">
            <span className="help-tour-popover-icon">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="help-tour-popover-title">Bantuan & Tour</span>
          </div>
          <p className="help-tour-popover-subtitle">
            Cari atau pilih panduan untuk mempelajari fitur dengan cepat.
          </p>
        </div>

        {/* Search input */}
        <div className="help-tour-search-wrap">
          <Search className="help-tour-search-icon h-4 w-4" />
          <input
            ref={searchInputRef}
            type="text"
            className="help-tour-search-input"
            placeholder="Cari tour..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="help-tour-search"
          />
          {searchQuery && (
            <button
              type="button"
              className="help-tour-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Bersihkan pencarian"
              data-testid="help-tour-search-clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Empty search result */}
        {isSearching && searchResults.length === 0 && (
          <div className="help-tour-empty-state" data-testid="help-tour-empty">
            <div className="help-tour-empty-state-icon">
              <Inbox className="h-5 w-5" />
            </div>
            Tidak ada tour yang cocok dengan <strong>"{searchQuery}"</strong>
          </div>
        )}

        {/* Search results (flat list, no sections) */}
        {isSearching && searchResults.length > 0 && (
          <div>
            <div className="help-tour-section-label">
              {searchResults.length} hasil pencarian
            </div>
            {searchResults.map((tourId, idx) => (
              <TourOption
                key={tourId}
                tourId={tourId}
                isCompleted={isCompleted(tourId)}
                isOutdated={isOutdated(tourId)}
                isFocused={idx === focusedIndex}
                onStart={() => handleStartTour(tourId)}
              />
            ))}
          </div>
        )}

        {/* Page-specific tours (no search) */}
        {!isSearching && pageSpecificIds.length > 0 && (
          <>
            <div className="help-tour-section-label">Untuk halaman ini</div>
            <div>
              {pageSpecificIds.map((tourId, idx) => (
                <TourOption
                  key={tourId}
                  tourId={tourId}
                  isCompleted={isCompleted(tourId)}
                  isOutdated={isOutdated(tourId)}
                  isFocused={idx === focusedIndex}
                  onStart={() => handleStartTour(tourId)}
                />
              ))}
            </div>
          </>
        )}

        {/* General navigation (no search) */}
        {!isSearching && filteredGeneralId && (
          <>
            <div className="help-tour-section-label">Umum</div>
            <div>
              <TourOption
                tourId={filteredGeneralId}
                isCompleted={isCompleted(filteredGeneralId)}
                isOutdated={isOutdated(filteredGeneralId)}
                isFocused={focusedIndex === pageSpecificIds.length}
                onStart={() => handleStartTour(filteredGeneralId)}
              />
            </div>
          </>
        )}

        {/* Empty state when no tours at all */}
        {!isSearching &&
          pageSpecificIds.length === 0 &&
          !filteredGeneralId && (
            <div className="help-tour-empty-state">
              <div className="help-tour-empty-state-icon">
                <Inbox className="h-5 w-5" />
              </div>
              Belum ada tour untuk halaman ini.
            </div>
          )}

        {/* Footer */}
        <div className="help-tour-popover-footer">
          💡 <strong>Tips:</strong> Gunakan <kbd>↑</kbd> <kbd>↓</kbd>{" "}
          <kbd>Enter</kbd> untuk navigasi cepat.
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TourOption({ tourId, isCompleted, isOutdated, isFocused, onStart }) {
  const meta = getTourMetadata(tourId);
  const ref = useRef(null);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [isFocused]);

  if (!meta) return null;

  // Status icon priority: outdated > completed > play
  let statusIcon;
  let statusLabel;
  if (isOutdated) {
    statusIcon = <RotateCw className="h-4 w-4 text-amber-600" />;
    statusLabel = "Tour diperbarui — coba lagi";
  } else if (isCompleted) {
    statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    statusLabel = "Pernah selesai";
  } else {
    statusIcon = <PlayCircle className="h-4 w-4" />;
    statusLabel = "Belum dimulai";
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`help-tour-option ${
        isFocused ? "help-tour-option--focused" : ""
      }`}
      onClick={onStart}
      data-testid={`tour-option-${tourId}`}
      aria-label={`${meta.title} — ${statusLabel}`}
    >
      <span className="help-tour-option-icon">{meta.icon}</span>
      <div className="help-tour-option-text">
        <p className="help-tour-option-title">{meta.title}</p>
        <p className="help-tour-option-desc">{meta.description}</p>
        {isOutdated && (
          <span
            className="help-tour-option-updated-badge"
            data-testid={`tour-option-updated-${tourId}`}
          >
            🆕 Diperbarui
          </span>
        )}
      </div>
      <span className="help-tour-option-play" title={statusLabel}>
        {statusIcon}
      </span>
    </button>
  );
}
