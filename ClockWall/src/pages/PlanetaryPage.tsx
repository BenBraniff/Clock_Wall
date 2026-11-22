import { PlanetaryPositionsPanel } from "../components/PlanetaryPositionsPanel";

export function PlanetaryPage({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}) {
  return (
    <div className="mx-auto max-w-7xl py-8 sm:py-12">
      <section className="planets-page">
        <p className="kicker">LIVE EPHEMERIS / SOLAR SYSTEM</p>
        <PlanetaryPositionsPanel now={now} timeZone={timeZone} />
      </section>
    </div>
  );
}
