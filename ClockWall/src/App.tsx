import { useEffect, useMemo, useState } from "react";
import "./App.css";

const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, options).format(date);

const getMinutesInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const second = Number(
    parts.find((part) => part.type === "second")?.value ?? 0,
  );
  return hour * 60 + minute + second / 60;
};

const getDayOfYearInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Math.floor(
    (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000,
  );
};

const getAnalemmaPoint = (dayOfYear: number) => {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    (0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma)) *
    (180 / Math.PI);
  return { equationOfTime, declination };
};

const mapAnalemmaPoint = (point: ReturnType<typeof getAnalemmaPoint>) => ({
  x: 170 + (point.equationOfTime / 18) * 145,
  y: 80 - (point.declination / 25) * 62,
});

const getAnalemmaPath = () =>
  Array.from({ length: 365 }, (_, index) =>
    mapAnalemmaPoint(getAnalemmaPoint(index + 1)),
  )
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

const getMoonPhase = (date: Date) => {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const lunarMonth = 29.530588853 * 86400000;
  const age =
    (((date.getTime() - knownNewMoon) % lunarMonth) + lunarMonth) % lunarMonth;
  const phase = age / lunarMonth;
  if (phase < 0.03 || phase > 0.97) return { name: "New moon", icon: "●", age };
  if (phase < 0.24) return { name: "Waxing crescent", icon: "◐", age };
  if (phase < 0.27) return { name: "First quarter", icon: "◑", age };
  if (phase < 0.49) return { name: "Waxing gibbous", icon: "◕", age };
  if (phase < 0.53) return { name: "Full moon", icon: "○", age };
  if (phase < 0.74) return { name: "Waning gibbous", icon: "◖", age };
  if (phase < 0.77) return { name: "Last quarter", icon: "◒", age };
  return { name: "Waning crescent", icon: "◓", age };
};

const getYearProgress = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1).getTime();
  const end = new Date(date.getFullYear() + 1, 0, 1).getTime();
  return Math.round(((date.getTime() - start) / (end - start)) * 100);
};

const locations = [
  {
    name: "New York, NY",
    latitude: "40° 42′ 46″ N",
    longitude: "74° 00′ 21″ W",
    sunrise: "06:24",
    sunset: "19:18",
    solarNoon: "13:04",
    daylight: "12h 54m",
    timeZone: "America/New_York",
  },
  {
    name: "London, UK",
    latitude: "51° 30′ 26″ N",
    longitude: "00° 07′ 39″ W",
    sunrise: "06:17",
    sunset: "19:32",
    solarNoon: "12:54",
    daylight: "13h 15m",
    timeZone: "Europe/London",
  },
  {
    name: "Tokyo, Japan",
    latitude: "35° 41′ 23″ N",
    longitude: "139° 41′ 30″ E",
    sunrise: "05:18",
    sunset: "18:01",
    solarNoon: "11:40",
    daylight: "12h 43m",
    timeZone: "Asia/Tokyo",
  },
  {
    name: "Sydney, Australia",
    latitude: "33° 52′ 04″ S",
    longitude: "151° 12′ 26″ E",
    sunrise: "05:59",
    sunset: "17:37",
    solarNoon: "11:48",
    daylight: "11h 38m",
    timeZone: "Australia/Sydney",
  },
];

function MetricCard({
  eyebrow,
  value,
  detail,
  className = "",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <article className={`metric-card ${className}`}>
      <p className="card-label">{eyebrow}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

function LocationPanel({
  location,
  onSelectLocation,
  onUseCurrentLocation,
}: {
  location: (typeof locations)[number];
  onSelectLocation: (name: string) => void;
  onUseCurrentLocation: () => void;
}) {
  return (
    <article className="location-card">
      <div className="map-heading">
        <div>
          <p className="card-label">CURRENT LOCATION</p>
          <h2>{location.name}</h2>
          <p className="coordinates">
            {location.latitude} · {location.longitude}
          </p>
        </div>
        <div className="location-actions">
          <button type="button" onClick={onUseCurrentLocation}>
            Current Location
          </button>
          <select
            aria-label="Choose location"
            value={
              locations.some((item) => item.name === location.name)
                ? location.name
                : ""
            }
            onChange={(event) => onSelectLocation(event.target.value)}
          >
            {locations.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="location-readout">
        <div>
          <strong>{location.latitude}</strong>
          <small>LATITUDE</small>
        </div>
        <div>
          <strong>{location.longitude}</strong>
          <small>LONGITUDE</small>
        </div>
      </div>
      <div className="location-rule" />
      <p className="metric-detail">
        Coordinates anchor the local sky calculations for sunrise, sunset, moon
        phase, and the analemma.
      </p>
    </article>
  );
}

function SolarPath({
  now,
  location,
}: {
  now: Date;
  location: (typeof locations)[number];
}) {
  const [sunriseHour, sunriseMinute] = location.sunrise.split(":").map(Number);
  const [sunsetHour, sunsetMinute] = location.sunset.split(":").map(Number);
  const minutes = getMinutesInTimeZone(now, location.timeZone);
  const sunrise = sunriseHour * 60 + sunriseMinute;
  const sunset = sunsetHour * 60 + sunsetMinute;
  const progress = Math.max(
    0,
    Math.min(1, (minutes - sunrise) / (sunset - sunrise)),
  );
  const sunX = 26 + progress * 288;
  const sunY = 118 - Math.sin(progress * Math.PI) * 79;
  const analemmaPath = getAnalemmaPath();
  const currentAnalemmaPoint = mapAnalemmaPoint(
    getAnalemmaPoint(getDayOfYearInTimeZone(now, location.timeZone)),
  );
  return (
    <>
      <div className="solar-path" aria-label="Sun position across today's sky">
        <p className="diagram-title">
          TODAY'S SUN PATH{" "}
          <span>
            {location.sunrise} — {location.sunset}
          </span>
        </p>
        <svg viewBox="0 0 340 150" role="img">
          <path className="horizon" d="M20 118H320" />
          <path className="sun-curve" d="M26 118C87 8 253 8 314 118" />
          <circle className="sun-marker" cx={sunX} cy={sunY} r="7" />
          <text x="20" y="137">
            SUNRISE
          </text>
          <text x="280" y="137">
            SUNSET
          </text>
          <text x="154" y="28">
            SOLAR NOON
          </text>
        </svg>
        <div className="path-caption">
          <span>Altitude now</span>
          <strong>
            {Math.round(Math.max(0, Math.sin(progress * Math.PI) * 54))}°
          </strong>
          <small>sinusoidal solar elevation</small>
        </div>
      </div>
      <div
        className="solar-path lemniscate-panel"
        aria-label="Sun position on the seasonal lemniscate path"
      >
        <p className="diagram-title">
          SEASONAL LEMNISCATE <span>7° 14′ VIRGO</span>
        </p>
        <svg className="analemma-chart" viewBox="0 0 340 150" role="img">
          <path
            className="analemma-grid"
            d="M25 18H315M25 80H315M25 142H315M25 18V142M170 18V142M315 18V142"
          />
          <path className="analemma-axis" d="M25 80H315" />
          <path className="analemma-path" d={analemmaPath} />
          <circle
            className="sun-marker analemma-marker"
            cx={currentAnalemmaPoint.x}
            cy={currentAnalemmaPoint.y}
            r="5"
          />
          <text className="analemma-label" x="25" y="148">
            −18 min
          </text>
          <text className="analemma-label" x="158" y="148">
            0
          </text>
          <text className="analemma-label" x="287" y="148">
            +18 min
          </text>
          <text className="analemma-label" x="7" y="21">
            +25°
          </text>
          <text className="analemma-label" x="10" y="84">
            0°
          </text>
          <text className="analemma-label" x="7" y="140">
            −25°
          </text>
          <text className="analemma-label" x="111" y="12">
            DECLINATION / EOT
          </text>
          <text
            className="analemma-label"
            x={currentAnalemmaPoint.x + 7}
            y={currentAnalemmaPoint.y - 7}
          >
            DAY {getDayOfYearInTimeZone(now, location.timeZone)}
          </text>
        </svg>
        <div className="path-caption">
          <span>Current point</span>
          <strong>
            {getAnalemmaPoint(
              getDayOfYearInTimeZone(now, location.timeZone),
            ).equationOfTime.toFixed(1)}{" "}
            min EoT
          </strong>
          <small>Equation of Time vs solar declination</small>
        </div>
      </div>
    </>
  );
}

function MoonDiagram({ phase }: { phase: number }) {
  const litStart = phase < 0.5 ? 0 : 1;
  return (
    <div className="moon-diagram" aria-label="Upright moon phase diagram">
      <svg viewBox="0 0 90 90" role="img">
        <circle className="moon-disc" cx="45" cy="45" r="31" />
        <path
          className="moon-shadow"
          d={
            litStart
              ? "M45 14a31 31 0 0 0 0 62c-17-8-17-54 0-62Z"
              : "M45 14a31 31 0 0 1 0 62c17-8 17-54 0-62Z"
          }
        />
      </svg>
    </div>
  );
}

function App() {
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<"clock" | "planets">("clock");
  const [location, setLocation] = useState(locations[0]);

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) =>
        setLocation({
          ...locations[0],
          name: "Current position",
          latitude: `${Math.abs(coords.latitude).toFixed(2)}° ${coords.latitude >= 0 ? "N" : "S"}`,
          longitude: `${Math.abs(coords.longitude).toFixed(2)}° ${coords.longitude >= 0 ? "E" : "W"}`,
        }),
      () => undefined,
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          setLocation({
            ...locations[0],
            name: "Current position",
            latitude: `${Math.abs(coords.latitude).toFixed(2)}° ${coords.latitude >= 0 ? "N" : "S"}`,
            longitude: `${Math.abs(coords.longitude).toFixed(2)}° ${coords.longitude >= 0 ? "E" : "W"}`,
          }),
        () => undefined,
      );
    }
    return () => window.clearInterval(timer);
  }, []);

  const moon = useMemo(() => getMoonPhase(now), [now]);
  const progress = getYearProgress(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dateLabel = formatDate(now, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: location.timeZone,
  });
  const localTime = formatDate(now, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: location.timeZone,
  });
  const locationZone = formatDate(now, {
    timeZone: location.timeZone,
    timeZoneName: "short",
  })
    .split(" ")
    .pop();

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-5 text-white sm:px-8 lg:px-12">
      <header className="site-header mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
        <button
          className="brand"
          onClick={() => {
            setPage("clock");
            setMenuOpen(false);
          }}
          type="button"
        >
          <span className="brand-mark">◒</span> ClockWall
        </button>
        <div className="header-meta">
          <span className="status-dot" /> NIGHT MODE{" "}
          <span className="hidden sm:inline">/ {location.name}</span>
        </div>
        <button
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
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
              onClick={() => {
                setPage("clock");
                setMenuOpen(false);
              }}
              type="button"
            >
              ClockWall
            </button>
            <button
              className={page === "planets" ? "active" : ""}
              onClick={() => {
                setPage("planets");
                setMenuOpen(false);
              }}
              type="button"
            >
              Planetary positions <span>SOON</span>
            </button>
          </nav>
        )}
      </header>

      {page === "clock" ? (
        <div className="mx-auto max-w-7xl py-8 sm:py-12">
          <section className="hero-grid">
            <div className="hero-copy">
              <p className="kicker">CLOCKWALL / NIGHT MODE</p>
              <div className="title-time-row">
                <h1>
                  The Universe,
                  <br />
                  <em>in motion.</em>
                </h1>
                <div className="hero-time-panel">
                  <p className="clock-time">{localTime}</p>
                  <p className="hero-date">{dateLabel}</p>
                  <p className="hero-zone">
                    LOCAL TIME <span>{locationZone}</span>
                  </p>
                </div>
              </div>
            </div>
            <LocationPanel
              location={location}
              onUseCurrentLocation={useCurrentLocation}
              onSelectLocation={(name) => {
                const selected = locations.find((item) => item.name === name);
                if (selected) setLocation(selected);
              }}
            />
          </section>
          <section className="dashboard-grid">
            <SolarPath now={now} location={location} />
            <article className="metric-card solar-times-card">
              <p className="card-label">DAYLIGHT WINDOW</p>
              <div className="solar-times">
                <div>
                  <span>SUNRISE</span>
                  <strong className="sunrise-time">{location.sunrise}</strong>
                </div>
                <div>
                  <span>SUNSET</span>
                  <strong className="sunset-time">{location.sunset}</strong>
                </div>
              </div>
              <p className="metric-detail">
                {formatDate(tomorrow, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: location.timeZone,
                })}{" "}
                · {location.daylight} of daylight
              </p>
            </article>
            <article className="metric-card moon-card">
              <p className="card-label">MOON PHASE</p>
              <MoonDiagram phase={moon.age / (29.530588853 * 86400000)} />
              <p className="metric-detail">
                {moon.name} · {Math.floor(moon.age / 86400000)} days old
              </p>
            </article>
            <MetricCard
              eyebrow="SEASONAL POSITION"
              value="Virgo"
              detail="Sun is 7° 14′ along the ecliptic"
            />
            <MetricCard
              eyebrow="YEAR IN PROGRESS"
              value={`${progress}%`}
              detail={`${365 - Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000)} days remain`}
              className="progress-card"
            />
            <MetricCard
              eyebrow="SOLAR NOON"
              value={location.solarNoon}
              detail={`Altitude 54° 18′ · ${locationZone}`}
            />
            <MetricCard
              eyebrow="DAYLIGHT"
              value={location.daylight}
              detail="2m 16s shorter than yesterday"
            />
          </section>
          <footer className="dashboard-footer">
            <span>
              OBSERVATORY /{" "}
              {formatDate(now, {
                month: "numeric",
                day: "numeric",
                year: "numeric",
                timeZoneName: "short",
                timeZone: location.timeZone,
              })}
            </span>
            <span>UPDATED EVERY SECOND</span>
            <span>{location.name.toUpperCase()}</span>
          </footer>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl py-16">
          <section className="planets-page">
            <p className="kicker">FUTURE MODULE / EPHEMERIS</p>
            <h1>
              Planetary
              <br />
              <em>positions.</em>
            </h1>
            <p className="planets-intro">
              A live sky map for the bodies that shape our calendar. This view
              is being prepared for solar system and planetary tracking.
            </p>
            <div className="planet-orbit">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <span className="planet sun" />
              <span className="planet earth" />
              <span className="planet mars" />
            </div>
            <div className="coming-soon">
              <span>COMING SOON</span>
              <strong>Solar system scope</strong>
              <small>
                Planet coordinates · retrograde motion · conjunctions
              </small>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
