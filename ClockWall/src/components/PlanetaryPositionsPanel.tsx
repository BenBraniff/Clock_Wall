import { useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";
import type { Vector } from "astronomy-engine";
import { formatDate } from "../utils/time";

const planets = [
  { name: "Mercury", body: Astronomy.Body.Mercury, color: "#e0c3a5" },
  { name: "Venus", body: Astronomy.Body.Venus, color: "#ffe08f" },
  { name: "Earth", body: Astronomy.Body.Earth, color: "#72c5ff" },
  { name: "Mars", body: Astronomy.Body.Mars, color: "#ff8068" },
  { name: "Jupiter", body: Astronomy.Body.Jupiter, color: "#ffc08b" },
  { name: "Saturn", body: Astronomy.Body.Saturn, color: "#ffe07d" },
  { name: "Uranus", body: Astronomy.Body.Uranus, color: "#7fe6e2" },
  { name: "Neptune", body: Astronomy.Body.Neptune, color: "#8eaaff" },
] as const;

const eclipticRotation = Astronomy.Rotation_EQJ_ECL();
const orbitSampleCount = 96;

const getPlanetVector = (body: Astronomy.Body, date: Date) =>
  Astronomy.RotateVector(eclipticRotation, Astronomy.HelioVector(body, date));

const getOrbitRadius = (distance: number) =>
  24 + Math.pow(distance / 30.05, 0.62) * 142;

const projectPlanetVector = (
  vector: Vector,
  view: "top-down" | "isometric",
) => {
  const distance = vector.Length();
  const radius = getOrbitRadius(distance);
  if (view === "isometric") {
    return {
      x: 360 + ((vector.x - vector.y) / distance) * Math.sqrt(3 / 2) * radius,
      y:
        190 -
        (((vector.x + vector.y) / distance) * 0.5 -
          vector.z / distance) *
          radius,
    };
  }
  const horizontalDistance = Math.hypot(vector.x, vector.y);
  return {
    x: 360 + (vector.x / horizontalDistance) * radius,
    y: 190 - (vector.y / horizontalDistance) * radius,
  };
};

export function PlanetaryPositionsPanel({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}) {
  const [view, setView] = useState<"top-down" | "isometric">("top-down");
  const positions = useMemo(
    () =>
      planets.map((planet) => {
        const vector = getPlanetVector(planet.body, now);
        const longitude =
          (Math.atan2(vector.y, vector.x) * (180 / Math.PI) + 360) % 360;
        return {
          ...planet,
          vector,
          distance: vector.Length(),
          longitude,
        };
      }),
    [now],
  );
  const trajectories = useMemo(
    () =>
      planets.map((planet, planetIndex) => {
        const periodDays = Astronomy.PlanetOrbitalPeriod(planet.body);
        const path = Array.from({ length: orbitSampleCount + 1 }, (_, index) => {
          const midpoint = orbitSampleCount / 2;
          if (index === midpoint) return positions[planetIndex].vector;
          const dayOffset = ((index - midpoint) / orbitSampleCount) * periodDays;
          const sampleDate = new Date(now.getTime() + dayOffset * 86400000);
          return getPlanetVector(planet.body, sampleDate);
        });
        return {
          name: planet.name,
          path: path
            .map((vector, index) => {
              const point = projectPlanetVector(vector, view);
              return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
            })
            .join(" "),
        };
      }),
    [now, positions, view],
  );
  const center = { x: 360, y: 190 };
  const formattedSimulationTime = formatDate(now, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });

  return (
    <article className="chart-card planetary-chart">
      <div className="planetary-chart-heading">
        <div className="planetary-chart-title">
          <p className="diagram-title">
            HELIOCENTRIC POSITIONS <span>ECLIPTIC PLANE</span>
          </p>
          <button
            className="planet-view-button"
            aria-label={`Show ${view === "top-down" ? "isometric" : "top-down"} view`}
            onClick={() =>
              setView((current) =>
                current === "top-down" ? "isometric" : "top-down",
              )
            }
            type="button"
          >
            {view === "top-down" ? "ISOMETRIC VIEW" : "TOP-DOWN VIEW"}
          </button>
        </div>
      </div>
      <svg
        className="planetary-orbit-chart"
        viewBox="0 0 720 380"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Heliocentric positions of the eight planets at ${formattedSimulationTime}`}
      >
        <path
          className="planetary-crosshair"
          d={
            view === "isometric"
              ? "M204 280L516 100M204 100L516 280"
              : "M194 190H526M360 24V356"
          }
        />
        {trajectories.map((trajectory) => (
          <path
            key={trajectory.name}
            className="planetary-orbit"
            d={trajectory.path}
          />
        ))}
        <circle className="planetary-sun-glow" cx={center.x} cy={center.y} r="14" />
        <circle className="planetary-sun" cx={center.x} cy={center.y} r="5" />
        {positions.map((planet) => {
          const point = projectPlanetVector(planet.vector, view);
          return (
            <circle
              key={planet.name}
              className="planetary-marker"
              cx={point.x}
              cy={point.y}
              r={planet.name === "Jupiter" ? 6 : planet.name === "Saturn" ? 5.5 : 5}
              fill={planet.color}
            >
              <title>
                {planet.name} · {planet.distance.toFixed(3)} AU ·{" "}
                {planet.longitude.toFixed(1)}°
              </title>
            </circle>
          );
        })}
        <text className="planetary-axis-label" x="360" y="370" textAnchor="middle">
          {view === "isometric" ? "ISOMETRIC" : "TOP-DOWN"} VIEW · RADIAL
          SPACING COMPRESSED FOR LEGIBILITY
        </text>
      </svg>
      <div className="planet-position-list">
        <table className="planet-position-table">
          <thead>
            <tr>
              <th scope="col">PLANET</th>
              <th scope="col">DISTANCE (AU)</th>
              <th scope="col">ECLIPTIC LONGITUDE</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((planet) => (
              <tr key={planet.name}>
                <th scope="row">
                  <span className="planet-position-name">
                    <i style={{ backgroundColor: planet.color }} />
                    {planet.name}
                  </span>
                </th>
                <td>{planet.distance.toFixed(3)}</td>
                <td>{planet.longitude.toFixed(1)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="planetary-caption">
        Positions calculated with Astronomy Engine · Sun-centered vectors in
        astronomical units · {formattedSimulationTime}
      </div>
    </article>
  );
}
