import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as Astronomy from "astronomy-engine";
import type { Vector } from "astronomy-engine";
import { Matrix4, Quaternion, Vector3 } from "three";
import { StarField } from "./StarField";
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
const planetaryStarFieldRadius = 120;
const eclipticSceneRotation = eclipticRotation.rot;
const planetaryStarFieldOrientation = new Quaternion().setFromRotationMatrix(
  new Matrix4().set(
    eclipticSceneRotation[0][0],
    eclipticSceneRotation[0][1],
    eclipticSceneRotation[0][2],
    0,
    eclipticSceneRotation[2][0],
    eclipticSceneRotation[2][1],
    eclipticSceneRotation[2][2],
    0,
    -eclipticSceneRotation[1][0],
    -eclipticSceneRotation[1][1],
    -eclipticSceneRotation[1][2],
    0,
    0,
    0,
    0,
    1,
  ),
);
const galacticPoleRightAscension = (192.85948 * Math.PI) / 180;
const galacticPoleDeclination = (27.12825 * Math.PI) / 180;
const cosGalacticPoleRightAscension = Math.cos(galacticPoleRightAscension);
const sinGalacticPoleRightAscension = Math.sin(galacticPoleRightAscension);
const cosGalacticPoleDeclination = Math.cos(galacticPoleDeclination);
const sinGalacticPoleDeclination = Math.sin(galacticPoleDeclination);
const galacticPlanePoints = Array.from(
  { length: 361 },
  (_, index): [number, number, number] => {
    const angle = (index / 360) * Math.PI * 2;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    return [
      planetaryStarFieldRadius *
        (-sinGalacticPoleRightAscension * cosAngle -
          sinGalacticPoleDeclination *
            cosGalacticPoleRightAscension *
            sinAngle),
      planetaryStarFieldRadius *
        (cosGalacticPoleRightAscension * cosAngle -
          sinGalacticPoleDeclination *
            sinGalacticPoleRightAscension *
            sinAngle),
      planetaryStarFieldRadius * cosGalacticPoleDeclination * sinAngle,
    ];
  },
);
const orbitSampleCount = 192;
const topDownPolarAngle = 0.02;
const topDownViewDistance = 6.2;
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
const galacticPlaneLabel = "GALACTIC PLANE";
const galacticPlaneNormal = new Vector3(
  cosGalacticPoleDeclination * cosGalacticPoleRightAscension,
  cosGalacticPoleDeclination * sinGalacticPoleRightAscension,
  sinGalacticPoleDeclination,
).applyQuaternion(planetaryStarFieldOrientation);
const chartLabelDirections = [
  ...seasons.map((season) => {
    const angle = season.longitude * (Math.PI / 180);
    return {
      name: season.name,
      direction: new Vector3(Math.cos(angle), 0, -Math.sin(angle)),
      fallbackDirection: [Math.cos(angle), -Math.sin(angle)] as [
        number,
        number,
      ],
    };
  }),
];

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

function PlanetaryCameraPreset({ topDown }: { topDown: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    if (topDown) {
      camera.up.set(0, 1, 0);
      camera.position.set(
        0,
        topDownViewDistance * Math.cos(topDownPolarAngle),
        topDownViewDistance * Math.sin(topDownPolarAngle),
      );
    } else {
      camera.up.set(0, 1, 0);
      camera.position.set(0, 2.5, 5.5);
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, topDown]);

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

function GalacticPlane({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <>
      <Line
        points={galacticPlanePoints}
        color="#79d7ff"
        lineWidth={5}
        transparent
        opacity={0.08}
        renderOrder={1}
      />
      <Line
        points={galacticPlanePoints}
        color="#a8e7ff"
        lineWidth={1.25}
        transparent
        opacity={0.6}
        renderOrder={2}
      />
    </>
  );
}

function ChartLabelProjection({
  labelElements,
}: {
  labelElements: { current: Map<string, HTMLDivElement> };
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const screenDirection = new Vector3();
    const planeNormalInCamera = new Vector3();
    const linePointInCamera = new Vector3();
    const lineTangentInCamera = new Vector3();
    const projectedLinePoint = new Vector3();
    const worldLinePoint = new Vector3();
    const cameraForward = new Vector3(0, 0, -1);
    let frameId: number;
    const updateLabelPositions = () => {
      camera.updateMatrixWorld();
      for (const label of chartLabelDirections) {
        const element = labelElements.current.get(label.name);
        if (!element) continue;

        screenDirection
          .copy(label.direction)
          .transformDirection(camera.matrixWorldInverse);
        let directionX = screenDirection.x;
        let directionY = -screenDirection.y;
        if (Math.hypot(directionX, directionY) < 0.001) {
          [directionX, directionY] = label.fallbackDirection;
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

      const galacticLabel = labelElements.current.get(galacticPlaneLabel);
      if (galacticLabel) {
        planeNormalInCamera
          .copy(galacticPlaneNormal)
          .transformDirection(camera.matrixWorldInverse);
        linePointInCamera
          .copy(cameraForward)
          .addScaledVector(
            planeNormalInCamera,
            -cameraForward.dot(planeNormalInCamera),
          );
        if (linePointInCamera.lengthSq() < 0.000001) {
          galacticLabel.style.display = "none";
        } else {
          linePointInCamera.normalize();
          lineTangentInCamera
            .crossVectors(planeNormalInCamera, linePointInCamera)
            .normalize();
          worldLinePoint
            .copy(linePointInCamera)
            .transformDirection(camera.matrixWorld)
            .multiplyScalar(planetaryStarFieldRadius)
            .add(camera.position);
          projectedLinePoint.copy(worldLinePoint).project(camera);

          const pointX = ((projectedLinePoint.x + 1) / 2) * size.width;
          const pointY = ((1 - projectedLinePoint.y) / 2) * size.height;
          const directionX = lineTangentInCamera.x;
          const directionY = -lineTangentInCamera.y;
          const minX = galacticLabel.offsetWidth / 2 + 8;
          const maxX = size.width - minX;
          const minY = galacticLabel.offsetHeight / 2 + 8;
          const maxY = size.height - minY;
          const intersections: [number, number][] = [];

          if (Math.abs(directionX) > 0.001) {
            for (const x of [minX, maxX]) {
              const distance = (x - pointX) / directionX;
              const y = pointY + distance * directionY;
              if (y >= minY && y <= maxY) intersections.push([x, y]);
            }
          }
          if (Math.abs(directionY) > 0.001) {
            for (const y of [minY, maxY]) {
              const distance = (y - pointY) / directionY;
              const x = pointX + distance * directionX;
              if (x >= minX && x <= maxX) intersections.push([x, y]);
            }
          }

          const labelPosition = intersections.reduce<
            [number, number] | undefined
          >((farthest, point) => {
            if (!farthest) return point;
            const pointDistance =
              (point[0] - pointX) ** 2 + (point[1] - pointY) ** 2;
            const farthestDistance =
              (farthest[0] - pointX) ** 2 +
              (farthest[1] - pointY) ** 2;
            return pointDistance > farthestDistance ? point : farthest;
          }, undefined);

          galacticLabel.style.display = labelPosition ? "block" : "none";
          if (labelPosition) {
            galacticLabel.style.transform = `translate3d(${labelPosition[0]}px, ${labelPosition[1]}px, 0) translate(-50%, -50%)`;
          }
        }
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
  const [topDown, setTopDown] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanetList, setShowPlanetList] = useState(false);
  const [showSeasonalAxes, setShowSeasonalAxes] = useState(true);
  const [showEarthOrbitOnly, setShowEarthOrbitOnly] = useState(true);
  const markerElements = useRef(new Map<string, HTMLDivElement>());
  const chartLabelElements = useRef(new Map<string, HTMLDivElement>());
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
        aria-label={`Interactive three-dimensional heliocentric positions of the eight planets, with a toggleable Milky Way galactic-plane guide, at ${formattedSimulationTime}`}
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
              onClick={() => setShowSeasonalAxes((visible) => !visible)}
            >
              Axes & labels / {showSeasonalAxes ? "On" : "Off"}
            </button>
          </div>
        </div>
        <Canvas
          camera={{ position: [0, 6.2, 0.12], fov: 45, near: 0.01, far: 250 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#050606"]} />
          <ambientLight intensity={0.8} />
          <StarField
            orientation={planetaryStarFieldOrientation}
            radius={planetaryStarFieldRadius}
          >
            <GalacticPlane visible={showSeasonalAxes} />
          </StarField>
          <PlanetaryCameraPreset topDown={topDown} />
          <PlanetMarkerProjection
            positions={visiblePositions}
            markerElements={markerElements}
          />
          {showSeasonalAxes && (
            <ChartLabelProjection
              labelElements={chartLabelElements}
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
          <SeasonalAxis visible={showSeasonalAxes} />
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
        {showSeasonalAxes && (
          <div className="planetary-seasonal-label-layer">
            {seasons.map((season) => (
              <div
                key={season.name}
                className="planetary-seasonal-label"
                ref={(element) => {
                  if (element) chartLabelElements.current.set(season.name, element);
                  else chartLabelElements.current.delete(season.name);
                }}
              >
                {season.name}
              </div>
            ))}
            <div
              className="planetary-seasonal-label planetary-galactic-plane-label"
              ref={(element) => {
                if (element) {
                  chartLabelElements.current.set(galacticPlaneLabel, element);
                } else {
                  chartLabelElements.current.delete(galacticPlaneLabel);
                }
              }}
            >
              {galacticPlaneLabel}
            </div>
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
        scale · Blue line: Milky Way galactic plane · Drag to orbit, scroll
        to zoom · {formattedSimulationTime}
      </div>
    </article>
  );
}
