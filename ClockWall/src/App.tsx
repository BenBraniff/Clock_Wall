import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { EarthView } from "./components/EarthView";
import { TimePlaceBar } from "./components/TimePlaceBar";
import { ClockPage } from "./pages/ClockPage";
import { PlanetaryPage } from "./pages/PlanetaryPage";
import { useClockData } from "./hooks/useClockData";
import { getPageFromPath, pagePaths, type Page } from "./utils/routes";
import "./App.css";

function App() {
  const [page, setPage] = useState<Page>(() =>
    getPageFromPath(window.location.pathname),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const clock = useClockData();

  useEffect(() => {
    const handlePopState = () => {
      setPage(getPageFromPath(window.location.pathname));
      setMenuOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const changePage = (nextPage: Page) => {
    if (window.location.pathname !== pagePaths[nextPage]) {
      window.history.pushState(null, "", pagePaths[nextPage]);
    }
    setPage(nextPage);
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-5 text-white sm:px-8 lg:px-12">
      <AppHeader
        locationName={clock.location.name}
        page={page}
        menuOpen={menuOpen}
        onPageChange={changePage}
        onMenuToggle={() => setMenuOpen((open) => !open)}
      >
        <TimePlaceBar
          timeInput={clock.timeInput}
          timeError={clock.timeError}
          timeIsLive={clock.timeIsLive}
          placeInput={clock.placeInput}
          isCurrentLocation={clock.isCurrentLocation}
          localTime={clock.localTime}
          locationZone={clock.locationZone}
          timeZone={clock.location.timeZone}
          onNow={clock.setNowToLive}
          onStartTimeEdit={clock.startTimeEditing}
          onTimeInput={clock.setTimeFromInput}
          onPlaceInput={clock.selectPlace}
          onActivateCurrentLocation={clock.activateCurrentLocation}
        />
      </AppHeader>

      {page === "clock" ? (
        <ClockPage
          now={clock.now}
          location={clock.location}
          solarDateKey={clock.solarDateKey}
          moon={clock.moon}
          yearProgress={clock.yearProgress}
          zodiac={clock.zodiac}
          solarAltitude={clock.solarAltitude}
          locationZone={clock.locationZone}
        />
      ) : page === "planets" ? (
        <PlanetaryPage now={clock.now} timeZone={clock.location.timeZone} />
      ) : (
        <div className="mx-auto max-w-7xl py-8 sm:py-12">
          <EarthView
            now={clock.now}
            location={clock.location}
            timeInput={clock.timeInput}
            timeError={clock.timeError}
            timeZone={clock.location.timeZone}
            onTimeInput={clock.setTimeFromInput}
            onNow={clock.setNowToLive}
          />
        </div>
      )}
    </main>
  );
}

export default App;
