import { PlanetaryPositionsPanel } from "../components/PlanetaryPositionsPanel";

export function PlanetaryPage({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}) {
  return (
    <div className="mx-auto max-w-7xl py-16">
      <section className="planets-page">
        <p className="kicker">LIVE EPHEMERIS / SOLAR SYSTEM</p>
        <h1>
          Planetary
          <br />
          <em>positions.</em>
        </h1>
        <p className="planets-intro">
          Track the eight planets around the Sun. Use the shared time and place
          controls to inspect their positions, distances, and ecliptic
          longitudes.
        </p>
        <PlanetaryPositionsPanel now={now} timeZone={timeZone} />
      </section>
    </div>
  );
}
