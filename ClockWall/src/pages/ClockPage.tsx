import type { Location } from "../types";
import { formatDate, formatSignedDuration } from "../utils/time";
import { MetricCard, MoonDiagram, SeasonalAnalemmaPanel, SolarAnglesPanel } from "../components/SolarPanels";
import { TemperatureHistoryPanel } from "../components/TemperatureHistoryPanel";

export function ClockPage({
  now,
  location,
  solarDateKey,
  moon,
  yearProgress,
  zodiac,
  solarAltitude,
  locationZone,
}: {
  now: Date;
  location: Location;
  solarDateKey: string;
  moon: { name: string; age: number };
  yearProgress: { progress: number; daysRemain: number };
  zodiac: { sign: string; position: string };
  solarAltitude: string;
  locationZone: string | undefined;
}) {
  return (
    <div className="mx-auto max-w-7xl py-8 sm:py-12">
      <section className="dashboard-grid">
        <section className="charts-grid" aria-label="Solar and climate charts">
          <SeasonalAnalemmaPanel now={now} location={location} />
          <TemperatureHistoryPanel location={location} dateKey={solarDateKey} />
          <SolarAnglesPanel now={now} location={location} />
        </section>
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
          value={zodiac.sign}
          detail={`Sun is ${zodiac.position} along the ecliptic`}
        />
        <MetricCard
          eyebrow="YEAR IN PROGRESS"
          value={`${yearProgress.progress}%`}
          detail={`${yearProgress.daysRemain} days remain`}
          className="progress-card"
        />
        <MetricCard
          eyebrow="SOLAR NOON"
          value={location.solarNoon}
          detail={`Altitude ${solarAltitude} · ${locationZone}`}
        />
        <MetricCard
          eyebrow="DAYLIGHT"
          value={location.daylight}
          detail={`${formatSignedDuration(location.daylightChange ?? 0)} from yesterday`}
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
  );
}
