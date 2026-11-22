import type { MouseEvent, ReactNode } from "react";
import { pagePaths, type Page } from "../utils/routes";

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
  const navigateToClock = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onPageChange("clock");
  };

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
      <nav className="page-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            {page === "clock" ? (
              <span aria-current="page">ClockWall</span>
            ) : (
              <a href={pagePaths.clock} onClick={navigateToClock}>
                ClockWall
              </a>
            )}
          </li>
          {page !== "clock" && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <span aria-current="page">
                  {page === "planets" ? "Planetary positions" : "Earth view"}
                </span>
              </li>
            </>
          )}
        </ol>
      </nav>
    </header>
  );
}
