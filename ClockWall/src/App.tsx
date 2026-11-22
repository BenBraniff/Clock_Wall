import { useState } from "react";
import { AppHeader, type Page } from "./components/AppHeader";
import { EarthView } from "./components/EarthView";
import { TimePlaceBar } from "./components/TimePlaceBar";
import { ClockPage } from "./pages/ClockPage";
import { PlanetaryPage } from "./pages/PlanetaryPage";
import { useClockData } from "./hooks/useClockData";
import "./App.css";

function App() {
  const [page, setPage] = useState<Page>("clock");
  const [menuOpen, setMenuOpen] = useState(false);
  const clock = useClockData();

  const changePage = (nextPage: Page) => {
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
        <div className="mx-auto max-w-7xl py-16">
          <EarthView now={clock.now} />
        </div>
      )}
    </main>
  );
}

export default App;
