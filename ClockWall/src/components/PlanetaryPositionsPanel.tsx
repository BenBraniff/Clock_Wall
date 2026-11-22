import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as Astronomy from "astronomy-engine";
import type { Vector } from "astronomy-engine";
import { Vector3 } from "three";
import { formatDate } from "../utils/time";

const planets = [
  {
    name: "Mercury",
    body: Astronomy.Body.Mercury,
    color: "#e0c3a5",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Mercury),
  },
  {
    name: "Venus",
    body: Astronomy.Body.Venus,
    color: "#ffe08f",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Venus),
  },
  {
    name: "Earth",
    body: Astronomy.Body.Earth,
    color: "#72c5ff",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Earth),
  },
  {
    name: "Mars",
    body: Astronomy.Body.Mars,
    color: "#ff8068",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Mars),
  },
  {
    name: "Jupiter",
    body: Astronomy.Body.Jupiter,
    color: "#ffc08b",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Jupiter),
  },
  {
    name: "Saturn",
    body: Astronomy.Body.Saturn,
    color: "#ffe07d",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Saturn),
  },
  {
    name: "Uranus",
    body: Astronomy.Body.Uranus,
    color: "#7fe6e2",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Uranus),
  },
  {
    name: "Neptune",
    body: Astronomy.Body.Neptune,
    color: "#8eaaff",
    orbitalPeriodDays: Astronomy.PlanetOrbitalPeriod(Astronomy.Body.Neptune),
  },
] as const;

const eclipticRotation = Astronomy.Rotation_EQJ_ECL();
const orbitSampleCount = 192;
const topDownPolarAngle = 0.02;
const earthYearDays = 365.256;
const seasonalAxisExtent = 12;
const earthMinimumDistanceColor = "#56d9c4";
const earthMaximumDistanceColor = "#ffb65c";

const getPlanetVector = (body: Astronomy.Body, date: Date) =>
  Astronomy.RotateVector(eclipticRotation, Astronomy.HelioVector(body, date));

const toScenePosition = (vector: Vector): [number, number, number] => [
  vector.x,
  vector.z,
  -vector.y,
];

const formatOrbitalPeriod = (days: number) =>
  days < earthYearDays * 2
    ? `${Math.round(days)} days`
    : `${Math.round(days / earthYearDays)} years`;

const seasons = [
  { name: "SPRING EQUINOX", longitude: 180 },
  { name: "SUMMER SOLSTICE", longitude: 270 },
  { name: "FALL EQUINOX", longitude: 0 },
  { name: "WINTER SOLSTICE", longitude: 90 },
] as const;

type PlanetPosition = (typeof planets)[number] & {
  vector: Vector;
  scenePosition: [number, number, number];
  distance: number;
  longitude: number;
};

function PlanetMarkerProjection({
  positions,
  markerElements,
}: {
  positions: PlanetPosition[];
  markerElements: { current: Map<string, HTMLDivElement> };
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const projectedPosition = new Vector3();
    let frameId: number;
    const updatePositions = () => {
      camera.updateMatrixWorld();
      for (const planet of positions) {
        const element = markerElements.current.get(planet.name);
        if (!element) continue;

        projectedPosition
          .set(...planet.scenePosition)
          .project(camera);
        const isVisible =
          projectedPosition.z >= -1 &&
          projectedPosition.z <= 1 &&
          Math.abs(projectedPosition.x) <= 1 &&
          Math.abs(projectedPosition.y) <= 1;
        element.style.display = isVisible ? "block" : "none";
        element.style.transform = `translate3d(${((projectedPosition.x + 1) / 2) * size.width}px, ${((1 - projectedPosition.y) / 2) * size.height}px, 0) translate(-50%, -50%)`;
      }
      frameId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
    return () => cancelAnimationFrame(frameId);
  }, [camera, markerElements, positions, size]);

  return null;
}

function PlanetaryCameraPreset({
  viewRange,
  topDown,
}: {
  viewRange: "inner" | "full";
  topDown: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (topDown) {
      const distance = viewRange === "inner" ? 6.2 : 110;
      camera.up.set(0, 1, 0);
      camera.position.set(
        0,
        distance * Math.cos(topDownPolarAngle),
        distance * Math.sin(topDownPolarAngle),
      );
    } else {
      camera.up.set(0, 1, 0);
      if (viewRange === "inner") {
        camera.position.set(0, 2.5, 5.5);
      } else {
        camera.position.set(0, 38, 100);
      }
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, topDown, viewRange]);

  return null;
}

function SeasonalAxis({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group>
      <Line
        points={[
          [-seasonalAxisExtent, 0, 0],
          [seasonalAxisExtent, 0, 0],
        ]}
        color="#d8c88f"
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      <Line
        points={[
          [0, 0, -seasonalAxisExtent],
          [0, 0, seasonalAxisExtent],
        ]}
        color="#d8c88f"
        lineWidth={1}
        transparent
        opacity={0.4}
      />
    </group>
  );
}

function SeasonalAxisLabelProjection({
  labelElements,
}: {
  labelElements: { current: Map<string, HTMLDivElement> };
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const screenDirection = new Vector3();
    let frameId: number;
    const updateLabelPositions = () => {
      camera.updateMatrixWorld();
      for (const season of seasons) {
        const element = labelElements.current.get(season.name);
        if (!element) continue;

        const angle = season.longitude * (Math.PI / 180);
        screenDirection
          .set(Math.cos(angle), 0, -Math.sin(angle))
          .transformDirection(camera.matrixWorldInverse);
        let directionX = screenDirection.x;
        let directionY = -screenDirection.y;
        if (Math.hypot(directionX, directionY) < 0.001) {
          directionX = Math.cos(angle);
          directionY = -Math.sin(angle);
        }
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const minX = width / 2 + 8;
        const minY = height / 2 + 8;
        const edgeScale = Math.min(
          Math.abs(directionX) > 0
            ? (size.width / 2 - minX) / Math.abs(directionX)
            : Number.POSITIVE_INFINITY,
          Math.abs(directionY) > 0
            ? (size.height / 2 - minY) / Math.abs(directionY)
            : Number.POSITIVE_INFINITY,
        );
        const labelX =
          size.width / 2 + directionX * edgeScale;
        const labelY =
          size.height / 2 + directionY * edgeScale;
        element.style.transform = `translate3d(${labelX}px, ${labelY}px, 0) translate(-50%, -50%)`;
      }
      frameId = requestAnimationFrame(updateLabelPositions);
    };

    updateLabelPositions();
    return () => cancelAnimationFrame(frameId);
  }, [camera, labelElements, size]);

  return null;
}

export function PlanetaryPositionsPanel({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}) {
  const [viewRange, setViewRange] = useState<"inner" | "full">("full");
  const [topDown, setTopDown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanetList, setShowPlanetList] = useState(false);
  const [showSeasonalAxes, setShowSeasonalAxes] = useState(true);
  const [showEarthOrbitOnly, setShowEarthOrbitOnly] = useState(false);
  const markerElements = useRef(new Map<string, HTMLDivElement>());
  const seasonalLabelElements = useRef(new Map<string, HTMLDivElement>());
  const orbitEpochYear = now.getUTCFullYear();
  const positions = useMemo(
    () =>
      planets.map((planet) => {
        const vector = getPlanetVector(planet.body, now);
        const longitude =
          (Math.atan2(vector.y, vector.x) * (180 / Math.PI) + 360) % 360;
        return {
          ...planet,
          vector,
          scenePosition: toScenePosition(vector),
          distance: vector.Length(),
          longitude,
        };
      }),
    [now],
  );
  const visiblePositions = showEarthOrbitOnly
    ? positions.filter((planet) => planet.name === "Earth")
    : positions;
  const orbits = useMemo(
    () =>
      planets.map((planet) => {
        const periodDays = planet.orbitalPeriodDays;
        const epoch = new Date(Date.UTC(orbitEpochYear, 0, 1));
        const samples = Array.from(
          { length: orbitSampleCount + 1 },
          (_, index) => {
            const vector = getPlanetVector(
              planet.body,
              new Date(
                epoch.getTime() +
                  (index / orbitSampleCount) * periodDays * 86400000,
              ),
            );
            return {
              scenePosition: toScenePosition(vector),
              distance: vector.Length(),
            };
          },
        );
        const minimum = samples.reduce((closest, sample) =>
          sample.distance < closest.distance ? sample : closest,
        );
        const maximum = samples.reduce((farthest, sample) =>
          sample.distance > farthest.distance ? sample : farthest,
        );
        return {
          name: planet.name,
          points: samples.map((sample) => sample.scenePosition),
          minimum,
          maximum,
        };
      }),
    [orbitEpochYear],
  );
  const earthOrbit = orbits.find((orbit) => orbit.name === "Earth");
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
        </div>
      </div>
      <div
        className="planetary-orbit-chart"
        role="img"
        aria-label={`Interactive three-dimensional heliocentric positions of the eight planets at ${formattedSimulationTime}`}
      >
        <div className="earth-view-controls planetary-chart-settings">
          <button
            className="earth-overlay-toggle"
            type="button"
            aria-expanded={showSettings}
            aria-controls="planetary-chart-settings"
            onClick={() => setShowSettings((visible) => !visible)}
          >
            Settings
          </button>
          <div
            className="earth-view-settings"
            id="planetary-chart-settings"
            hidden={!showSettings}
          >
            <div
              className="earth-orientation-controls"
              role="group"
              aria-label="Planetary view range"
            >
              <button
                type="button"
                aria-pressed={viewRange === "inner"}
                onClick={() => setViewRange("inner")}
              >
                Inner system
              </button>
              <button
                type="button"
                aria-pressed={viewRange === "full"}
                onClick={() => setViewRange("full")}
              >
                Full system
              </button>
            </div>
            <button
              type="button"
              aria-pressed={topDown}
              onClick={() => setTopDown((current) => !current)}
            >
              Top-down view / {topDown ? "On" : "Off"}
            </button>
            <button
              type="button"
              aria-pressed={showEarthOrbitOnly}
              onClick={() => setShowEarthOrbitOnly((visible) => !visible)}
            >
              Earth orbit only / {showEarthOrbitOnly ? "On" : "Off"}
            </button>
            <button
              className="planetary-axis-toggle"
              type="button"
              aria-pressed={showSeasonalAxes}
              disabled={viewRange !== "inner"}
              title={
                viewRange === "inner"
                  ? undefined
                  : "Seasonal axes are available in Inner System view."
              }
              onClick={() => setShowSeasonalAxes((visible) => !visible)}
            >
              Axes & labels / {showSeasonalAxes ? "On" : "Off"}
            </button>
            {viewRange === "full" && (
              <span className="planetary-settings-note">
                Available in Inner System view
              </span>
            )}
          </div>
        </div>
        <Canvas
          camera={{ position: [0, 38, 100], fov: 45, near: 0.01, far: 250 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#050606"]} />
          <ambientLight intensity={0.8} />
          <PlanetaryCameraPreset viewRange={viewRange} topDown={topDown} />
          <PlanetMarkerProjection
            positions={visiblePositions}
            markerElements={markerElements}
          />
          {viewRange === "inner" && showSeasonalAxes && (
            <SeasonalAxisLabelProjection
              labelElements={seasonalLabelElements}
            />
          )}
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minPolarAngle={topDown ? topDownPolarAngle : 0}
            maxPolarAngle={topDown ? topDownPolarAngle : Math.PI}
            minDistance={2}
            maxDistance={110}
          />
          {orbits
            .filter((orbit) => !showEarthOrbitOnly || orbit.name === "Earth")
            .map((orbit) => (
              <Line
                key={orbit.name}
                points={orbit.points}
                color="#56636a"
                lineWidth={1}
                transparent
                opacity={0.7}
              />
            ))}
          {showEarthOrbitOnly && earthOrbit && (
            <>
              <mesh position={earthOrbit.minimum.scenePosition}>
                <sphereGeometry args={[0.012, 20, 20]} />
                <meshBasicMaterial
                  color={earthMinimumDistanceColor}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={earthOrbit.maximum.scenePosition}>
                <sphereGeometry args={[0.012, 20, 20]} />
                <meshBasicMaterial
                  color={earthMaximumDistanceColor}
                  toneMapped={false}
                />
              </mesh>
            </>
          )}
          <SeasonalAxis
            visible={viewRange === "inner" && showSeasonalAxes}
          />
        </Canvas>
        {showEarthOrbitOnly && earthOrbit && (
          <div
            className="planetary-orbit-extrema-legend"
            aria-label="Earth orbital distance extremes"
          >
            <span>
              <i
                className="planetary-orbit-extrema-minimum"
                aria-hidden="true"
              />
              Closest · MIN {earthOrbit.minimum.distance.toFixed(3)} AU
            </span>
            <span>
              <i
                className="planetary-orbit-extrema-maximum"
                aria-hidden="true"
              />
              Farthest · MAX {earthOrbit.maximum.distance.toFixed(3)} AU
            </span>
          </div>
        )}
        {viewRange === "inner" && showSeasonalAxes && (
          <div className="planetary-seasonal-label-layer">
            {seasons.map((season) => (
              <div
                key={season.name}
                className="planetary-seasonal-label"
                ref={(element) => {
                  if (element) {
                    seasonalLabelElements.current.set(season.name, element);
                  } else {
                    seasonalLabelElements.current.delete(season.name);
                  }
                }}
              >
                {season.name}
              </div>
            ))}
          </div>
        )}
        <div className="planetary-marker-layer">
          {visiblePositions.map((planet) => (
            <div
              key={planet.name}
              className="planetary-marker-dot"
              aria-label={`${planet.name}, ${planet.distance.toFixed(3)} AU`}
              ref={(element) => {
                if (element) markerElements.current.set(planet.name, element);
                else markerElements.current.delete(planet.name);
              }}
            >
              <span
                className="planetary-marker-dot-core"
                style={{ backgroundColor: planet.color, color: planet.color }}
                title={planet.name}
              />
              <span className="planetary-planet-label">{planet.name}</span>
            </div>
          ))}
        </div>
        <div className="planetary-sun-overlay" aria-label="Sun">
          <span className="planetary-sun-core" />
          <span className="planetary-sun-label">Sun</span>
        </div>
        <div className="planetary-position-overlay">
          <button
            className="earth-overlay-toggle"
            type="button"
            aria-expanded={showPlanetList}
            aria-controls="planetary-position-list"
            onClick={() => setShowPlanetList((visible) => !visible)}
          >
            Planet list
          </button>
          <div
            className="planet-position-list planetary-position-overlay-content"
            id="planetary-position-list"
            hidden={!showPlanetList}
          >
            <table className="planet-position-table">
              <thead>
                <tr>
                  <th scope="col">PLANET</th>
                  <th scope="col">DISTANCE (AU)</th>
                  <th scope="col">ORBITAL PERIOD</th>
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
                    <td>{formatOrbitalPeriod(planet.orbitalPeriodDays)}</td>
                    <td>{planet.longitude.toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="planetary-caption">
        Positions and orbit paths calculated with Astronomy Engine · True AU
        scale · Drag to orbit, scroll to zoom · {formattedSimulationTime}
      </div>
    </article>
  );
}
