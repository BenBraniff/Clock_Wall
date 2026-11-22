import type { ReactNode } from "react";

export type Page = "clock" | "planets" | "earth";

export function AppHeader({
  children,
  locationName,
  page,
  menuOpen,
  onPageChange,
  onMenuToggle,
}: {
  children: ReactNode;
  locationName: string;
  page: Page;
  menuOpen: boolean;
  onPageChange: (page: Page) => void;
  onMenuToggle: () => void;
}) {
  return (
    <header className="site-header mx-auto max-w-7xl border-b border-white/10 pb-5">
      <div className="site-header-top-row">
        <button
          className="brand"
          onClick={() => onPageChange("clock")}
          type="button"
        >
          <span className="brand-mark">◒</span> ClockWall
        </button>
        <div className="header-meta">
          <span className="status-dot" /> NIGHT MODE{" "}
          <span className="hidden sm:inline">/ {locationName}</span>
        </div>
        <button
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={onMenuToggle}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        {menuOpen && (
          <nav className="menu-panel">
            <button
              className={page === "clock" ? "active" : ""}
              onClick={() => onPageChange("clock")}
              type="button"
            >
              ClockWall
            </button>
            <button
              className={page === "planets" ? "active" : ""}
              onClick={() => onPageChange("planets")}
              type="button"
            >
              Planetary positions
            </button>
            <button
              className={page === "earth" ? "active" : ""}
              onClick={() => onPageChange("earth")}
              type="button"
            >
              Earth view
            </button>
          </nav>
        )}
      </div>
      {children}
    </header>
  );
}
