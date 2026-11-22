import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as Astronomy from "astronomy-engine";
import * as THREE from "three";
import nightLightsUrl from "../assets/black-marble-2016-3km.jpg";
import landGeoJson from "../data/ne_50m_land.geojson?raw";
import lakeGeoJson from "../data/ne_50m_lakes.geojson?raw";
import type { Location } from "../types";
import { StarField } from "./StarField";
import { toDateTimeLocalValue } from "../utils/time";

type LandFeature = {
  geometry:
    | { coordinates: number[][][]; type: "Polygon" }
    | { coordinates: number[][][][]; type: "MultiPolygon" };
};

type EarthOrientation = "shadow" | "north-pole";

const landFeatures = (
  JSON.parse(landGeoJson) as { features: LandFeature[] }
).features;
const lakeFeatures = (
  JSON.parse(lakeGeoJson) as { features: LandFeature[] }
).features;
const EARTH_RADIUS = 1.45;
const EARTH_OBLIQUITY = THREE.MathUtils.degToRad(23.43928);
const STARFIELD_RADIUS = 1000;
const SUN_DISTANCE = STARFIELD_RADIUS;
const ORBIT_SEGMENT_COUNT = 256;
const SUN_RADIUS =
  SUN_DISTANCE * Math.tan(THREE.MathUtils.degToRad(0.2666));

function getSunDirection(date: Date) {
  const sun = Astronomy.Equator(
    Astronomy.Body.Sun,
    date,
    new Astronomy.Observer(0, 0, 0),
    true,
    true,
  );
  const longitude = THREE.MathUtils.degToRad(
    (((sun.ra - Astronomy.SiderealTime(date)) * 15 + 540) % 360) - 180,
  );
  const latitude = THREE.MathUtils.degToRad(sun.dec);
  return new THREE.Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  );
}

function getEarthViewRotation(
  sunDirection: THREE.Vector3,
  date: Date,
  orientation: EarthOrientation,
) {
  const sunAxis = sunDirection.clone().normalize();
  if (orientation === "north-pole") {
    const upAxis = new THREE.Vector3(0, 1, 0);
    const rightAxis = sunAxis
      .clone()
      .addScaledVector(upAxis, -sunAxis.dot(upAxis))
      .normalize();
    const depthAxis = rightAxis.clone().cross(upAxis).normalize();
    const rotation = new THREE.Matrix4()
      .makeBasis(rightAxis, upAxis, depthAxis)
      .transpose();
    return new THREE.Quaternion().setFromRotationMatrix(rotation);
  }

  const { eclipticNorth, radialFromSun, orbitalTangent } = getEarthOrbitAxes(
    sunAxis,
    date,
  );
  const depthAxis = radialFromSun
    .addScaledVector(orbitalTangent, -1)
    .normalize();
  const rightAxis = eclipticNorth.clone().cross(depthAxis).normalize();
  const rotation = new THREE.Matrix4()
    .makeBasis(rightAxis, eclipticNorth, depthAxis)
    .transpose();
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
}

function EarthCameraPreset({
  orientation,
  axisLocked,
}: {
  orientation: EarthOrientation;
  axisLocked: boolean;
}) {
  const { camera } = useThree();

  useLayoutEffect(() => {
    camera.position.set(0, 0, 4.8);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }, [axisLocked, camera, orientation]);

  return null;
}

function getStarFieldRotation(date: Date) {
  const eqjToEqd = Astronomy.Rotation_EQJ_EQD(date).rot;
  const precessionRotation = new THREE.Matrix4().set(
    eqjToEqd[0][0],
    eqjToEqd[0][1],
    eqjToEqd[0][2],
    0,
    eqjToEqd[1][0],
    eqjToEqd[1][1],
    eqjToEqd[1][2],
    0,
    eqjToEqd[2][0],
    eqjToEqd[2][1],
    eqjToEqd[2][2],
    0,
    0,
    0,
    0,
    1,
  );
  const siderealAngle = THREE.MathUtils.degToRad(
    Astronomy.SiderealTime(date) * 15,
  );
  const siderealRotation = new THREE.Matrix4().set(
    Math.cos(siderealAngle),
    Math.sin(siderealAngle),
    0,
    0,
    0,
    0,
    1,
    0,
    Math.sin(siderealAngle),
    -Math.cos(siderealAngle),
    0,
    0,
    0,
    0,
    0,
    1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(
    siderealRotation.multiply(precessionRotation),
  );
}

function getEclipticNorth(date: Date) {
  return new THREE.Vector3(
    Math.cos(Math.PI / 2 - EARTH_OBLIQUITY) * Math.cos(1.5 * Math.PI),
    Math.cos(Math.PI / 2 - EARTH_OBLIQUITY) * Math.sin(1.5 * Math.PI),
    Math.sin(Math.PI / 2 - EARTH_OBLIQUITY),
  )
    .applyQuaternion(getStarFieldRotation(date))
    .normalize();
}

function getEarthOrbitAxes(sunDirection: THREE.Vector3, date: Date) {
  const sunAxis = sunDirection.clone().normalize();
  const eclipticNorth = getEclipticNorth(date);
  eclipticNorth.addScaledVector(sunAxis, -eclipticNorth.dot(sunAxis)).normalize();
  const radialFromSun = sunAxis.negate();
  const orbitalTangent = eclipticNorth
    .clone()
    .cross(radialFromSun)
    .normalize();
  return { eclipticNorth, radialFromSun, orbitalTangent };
}

function getLocationPosition(latitude: number, longitude: number) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ).multiplyScalar(EARTH_RADIUS + 0.025);
}

function createTubeGeometry(
  points: THREE.Vector3[],
  closed: boolean,
  radius: number,
) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  return new THREE.TubeGeometry(
    curve,
    points.length * 2,
    radius,
    6,
    closed,
  );
}

function createLatitudeGeometry(latitude: number) {
  const radius = EARTH_RADIUS + 0.018;
  const parallelRadius = radius * Math.cos(latitude);
  const vertical = radius * Math.sin(latitude);
  const points = Array.from({ length: 160 }, (_, index) => {
    const longitude = (index / 160) * Math.PI * 2;
    return new THREE.Vector3(
      parallelRadius * Math.cos(longitude),
      vertical,
      -parallelRadius * Math.sin(longitude),
    );
  });
  return createTubeGeometry(points, true, 0.007);
}

function createLocationLatitudeGeometries(latitude: number) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const radius = EARTH_RADIUS + 0.021;
  const parallelRadius = radius * Math.cos(latitudeRadians);
  const vertical = radius * Math.sin(latitudeRadians);
  const segmentCount = 80;
  const segmentAngle = (Math.PI * 2) / segmentCount;
  const dotAngle = segmentAngle * 0.38;

  return Array.from({ length: segmentCount }, (_, index) => {
    const longitude =
      index * segmentAngle + (segmentAngle - dotAngle) / 2;
    const points = Array.from({ length: 8 }, (_, pointIndex) => {
      const angle = longitude + (pointIndex / 7) * dotAngle;
      return new THREE.Vector3(
        parallelRadius * Math.cos(angle),
        vertical,
        -parallelRadius * Math.sin(angle),
      );
    });
    return createTubeGeometry(points, false, 0.006);
  });
}

function createTerminatorGeometry(sunDirection: THREE.Vector3) {
  const northOnTerminator = new THREE.Vector3(0, 1, 0)
    .addScaledVector(sunDirection, -sunDirection.y)
    .normalize();
  const acrossTerminator = sunDirection
    .clone()
    .cross(northOnTerminator)
    .normalize();
  const radius = EARTH_RADIUS + 0.022;
  const points = Array.from({ length: 192 }, (_, index) => {
    const angle = (index / 192) * Math.PI * 2;
    return northOnTerminator
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(acrossTerminator, Math.sin(angle))
      .multiplyScalar(radius);
  });
  return createTubeGeometry(points, true, 0.012);
}

function createSolarMeridianGeometry(
  sunDirection: THREE.Vector3,
  midnight: boolean,
) {
  const north = new THREE.Vector3(0, 1, 0);
  const sunOnEquator = sunDirection
    .clone()
    .addScaledVector(north, -sunDirection.y)
    .normalize()
    .multiplyScalar(midnight ? -1 : 1);
  const radius = EARTH_RADIUS + 0.02;
  const points = Array.from({ length: 129 }, (_, index) => {
    const latitude = (index / 128 - 0.5) * Math.PI;
    return north
      .clone()
      .multiplyScalar(Math.sin(latitude))
      .addScaledVector(sunOnEquator, Math.cos(latitude))
      .multiplyScalar(radius);
  });
  return createTubeGeometry(points, false, 0.008);
}

function createSubsolarEquatorCircleGeometry(sunDirection: THREE.Vector3) {
  const sunAxis = sunDirection.clone().normalize();
  const equatorTerminator = sunAxis
    .clone()
    .cross(new THREE.Vector3(0, 1, 0))
    .normalize();
  const radius = EARTH_RADIUS + 0.025;
  const points = Array.from({ length: 192 }, (_, index) => {
    const angle = (index / 192) * Math.PI * 2;
    return sunAxis
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(equatorTerminator, Math.sin(angle))
      .multiplyScalar(radius);
  });
  return createTubeGeometry(points, true, 0.008);
}

function createEarthOrbitGeometry(
  sunDirection: THREE.Vector3,
  date: Date,
) {
  const { radialFromSun, orbitalTangent } = getEarthOrbitAxes(
    sunDirection,
    date,
  );
  const sunPosition = sunDirection
    .clone()
    .normalize()
    .multiplyScalar(SUN_DISTANCE);
  const points = Array.from({ length: ORBIT_SEGMENT_COUNT }, (_, index) => {
    const angle = (index / ORBIT_SEGMENT_COUNT) * Math.PI * 2;
    return sunPosition
      .clone()
      .addScaledVector(radialFromSun, SUN_DISTANCE * Math.cos(angle))
      .addScaledVector(orbitalTangent, SUN_DISTANCE * Math.sin(angle));
  });
  return createTubeGeometry(points, true, 0.01);
}

function TubeGuide({
  geometry,
  color,
}: {
  geometry: THREE.TubeGeometry;
  color: string;
}) {
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function SubsolarPoint({ sunDirection }: { sunDirection: THREE.Vector3 }) {
  const { position, orientation } = useMemo(() => {
    const outward = sunDirection.clone().normalize();
    return {
      position: outward.clone().multiplyScalar(EARTH_RADIUS + 0.025),
      orientation: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        outward,
      ),
    };
  }, [sunDirection]);

  return (
    <mesh position={position} quaternion={orientation} renderOrder={2}>
      <torusGeometry args={[0.04, 0.007, 8, 32]} />
      <meshBasicMaterial color="#c4a1ff" toneMapped={false} />
    </mesh>
  );
}

function SunVisual({ sunDirection }: { sunDirection: THREE.Vector3 }) {
  const position = useMemo(
    () => sunDirection.clone().normalize().multiplyScalar(SUN_DISTANCE),
    [sunDirection],
  );

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 32, 24]} />
        <meshBasicMaterial color="#fff2b0" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 2.7, 32, 24]} />
        <meshBasicMaterial
          color="#ff9d32"
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function LatitudeGuides() {
  const guides = useMemo(
    () => [
      { color: "#31f03b", geometry: createLatitudeGeometry(0) },
      {
        color: "#00f1f1",
        geometry: createLatitudeGeometry(EARTH_OBLIQUITY),
      },
      {
        color: "#00f1f1",
        geometry: createLatitudeGeometry(-EARTH_OBLIQUITY),
      },
      {
        color: "#00f1f1",
        geometry: createLatitudeGeometry(Math.PI / 2 - EARTH_OBLIQUITY),
      },
      {
        color: "#00f1f1",
        geometry: createLatitudeGeometry(-Math.PI / 2 + EARTH_OBLIQUITY),
      },
    ],
    [],
  );

  return (
    <>
      {guides.map(({ color, geometry }, index) => (
        <TubeGuide key={index} geometry={geometry} color={color} />
      ))}
    </>
  );
}

function LocationLatitudeGuide({ latitude }: { latitude: number }) {
  const geometries = useMemo(
    () => createLocationLatitudeGeometries(latitude),
    [latitude],
  );

  return (
    <>
      {geometries.map((geometry, index) => (
        <TubeGuide key={index} geometry={geometry} color="#ffffff" />
      ))}
    </>
  );
}

function SolarGuides({ sunDirection }: { sunDirection: THREE.Vector3 }) {
  const guides = useMemo(
    () => [
      { color: "#fff000", geometry: createTerminatorGeometry(sunDirection) },
      {
        color: "#ff332c",
        geometry: createSolarMeridianGeometry(sunDirection, false),
      },
      {
        color: "#385dff",
        geometry: createSolarMeridianGeometry(sunDirection, true),
      },
      {
        color: "#c4a1ff",
        geometry: createSubsolarEquatorCircleGeometry(sunDirection),
      },
    ],
    [sunDirection],
  );

  return (
    <>
      {guides.map(({ color, geometry }, index) => (
        <TubeGuide key={index} geometry={geometry} color={color} />
      ))}
      <SubsolarPoint sunDirection={sunDirection} />
    </>
  );
}

function EarthOrbitGuide({
  sunDirection,
  date,
}: {
  sunDirection: THREE.Vector3;
  date: Date;
}) {
  const geometry = useMemo(
    () => createEarthOrbitGeometry(sunDirection, date),
    [date, sunDirection],
  );
  return <TubeGuide geometry={geometry} color="#ffad4b" />;
}

function LocationMarker({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const position = useMemo(
    () => getLocationPosition(latitude, longitude),
    [latitude, longitude],
  );
  const coreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const haloMesh = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * Math.PI) + 1) / 2;
    if (coreMaterial.current) coreMaterial.current.opacity = 0.45 + pulse * 0.55;
    if (haloMaterial.current) haloMaterial.current.opacity = 0.08 + pulse * 0.3;
    haloMesh.current?.scale.setScalar(0.85 + pulse * 0.3);
  });

  return (
    <group position={position} renderOrder={2}>
      <mesh>
        <sphereGeometry args={[0.024, 16, 16]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color="#fff4b0"
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haloMesh}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial
          ref={haloMaterial}
          color="#ffca42"
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function EarthSurface({
  texture,
  sunDirection,
  showGrid,
}: {
  texture: THREE.Texture;
  sunDirection: THREE.Vector3;
  showGrid: boolean;
}) {
  const nightLightsTexture = useLoader(THREE.TextureLoader, nightLightsUrl);
  const material = useMemo(
    () => {
      const gridShader = showGrid
        ? `
          float longitudeGridDistance = abs(fract(vUv.x * 12.0 + 0.5) - 0.5);
          float latitudeGridDistance = abs(fract(vUv.y * 6.0 + 0.5) - 0.5);
          float longitudeGrid = 1.0 - smoothstep(0.001, 0.004, longitudeGridDistance);
          float latitudeGrid = 1.0 - smoothstep(0.001, 0.004, latitudeGridDistance);
          float majorGrid = max(
            1.0 - smoothstep(0.0003, 0.0008, abs(vUv.x - 0.5)),
            1.0 - smoothstep(0.0003, 0.0008, abs(vUv.y - 0.5))
          );
          float gridOpacity = max(longitudeGrid, latitudeGrid) * 0.23;
          gridOpacity = max(gridOpacity, majorGrid * 0.52);
          surfaceColor = mix(surfaceColor, vec3(0.7, 0.78, 0.72), gridOpacity);
        `
        : "";

      return new THREE.ShaderMaterial({
        uniforms: {
          earthTexture: { value: texture },
          nightLightsTexture: { value: nightLightsTexture },
          sunDirection: { value: new THREE.Vector3() },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform sampler2D earthTexture;
          uniform sampler2D nightLightsTexture;
          uniform vec3 sunDirection;
          void main() {
            float latitude = vUv.y * 3.14159265359 - 1.57079632679;
            float longitude = (vUv.x - 0.5) * 6.28318530718;
            vec3 surfaceNormal = vec3(
              cos(latitude) * cos(longitude),
              sin(latitude),
              -cos(latitude) * sin(longitude)
            );
            float sunlight = dot(surfaceNormal, normalize(sunDirection));
            float daylight = smoothstep(-0.0145, 0.00465, sunlight);
            float irradiance = max(sunlight + 0.0145, 0.0);
            vec3 surfaceColor = texture2D(earthTexture, vUv).rgb;
            vec3 nightLightSample = pow(
              texture2D(nightLightsTexture, vUv).rgb,
              vec3(2.2)
            );
            float nightLightLuminance = dot(
              nightLightSample,
              vec3(0.2126, 0.7152, 0.0722)
            );
            float cityLightMask = smoothstep(0.02, 0.12, nightLightLuminance);
            vec3 cityLightEmission =
              nightLightSample * cityLightMask * (1.0 - daylight) * 2.2;
            ${gridShader}
            vec3 daylightSurface = surfaceColor * daylight * irradiance * 1.6;
            gl_FragColor = vec4(daylightSurface + cityLightEmission, 1.0);
            #include <colorspace_fragment>
          }
        `,
        toneMapped: false,
      });
    },
    [texture, nightLightsTexture, showGrid],
  );

  useEffect(() => {
    material.uniforms.sunDirection.value.copy(sunDirection);
  }, [material, sunDirection]);
  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the Earth texture");

  const oceanGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, "#1b4960");
  oceanGradient.addColorStop(0.5, "#102e45");
  oceanGradient.addColorStop(1, "#173b50");
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const drawFeatures = (
    features: LandFeature[],
    fillStyle: string | CanvasGradient,
  ) => {
    features.forEach(({ geometry }) => {
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.coordinates;
      context.beginPath();
      polygons.forEach((rings) => {
        rings.forEach((ring) => {
          ring.forEach(([longitude, latitude], pointIndex) => {
            const x = ((longitude + 180) / 360) * canvas.width;
            const y = ((90 - latitude) / 180) * canvas.height;
            if (pointIndex === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        });
      });
      context.fillStyle = fillStyle;
      context.fill("evenodd");
      context.strokeStyle = "#a3ad78";
      context.lineWidth = 2.5;
      context.stroke();
    });
  };

  drawFeatures(landFeatures, "#718b56");
  drawFeatures(lakeFeatures, oceanGradient);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function EarthView({
  now,
  location,
  timeInput,
  timeError,
  timeZone,
  onTimeInput,
  onNow,
}: {
  now: Date;
  location: Location;
  timeInput: string;
  timeError: string | null;
  timeZone: string;
  onTimeInput: (value: string) => void;
  onNow: () => void;
}) {
  const [showLines, setShowLines] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<EarthOrientation>("shadow");
  const [axisLocked, setAxisLocked] = useState(false);
  const texture = useMemo(() => createEarthTexture(), []);
  const sunDirection = useMemo(() => getSunDirection(now), [now]);
  const earthRotation = useMemo(
    () => getEarthViewRotation(sunDirection, now, orientation),
    [now, orientation, sunDirection],
  );
  const starFieldOrientation = useMemo(
    () => earthRotation.clone().multiply(getStarFieldRotation(now)),
    [earthRotation, now],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const selectSeasonalPreset = (longitude: number) => {
    const event = Astronomy.SearchSunLongitude(
      longitude,
      new Date(now.getTime() + 1000),
      370,
    );
    if (!event) {
      setPresetError("Unable to find the next seasonal event.");
      return;
    }

    const nearestMinute = new Date(
      Math.round(event.date.getTime() / 60000) * 60000,
    );
    setPresetError(null);
    onTimeInput(toDateTimeLocalValue(nearestMinute, timeZone));
  };

  return (
    <section className="earth-page">
      <div className="earth-canvas-frame">
        <Canvas
          camera={{ position: [0, 0, 4.8], fov: 42, near: 0.1, far: 2500 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          role="img"
          aria-label="Interactive three-dimensional Earth globe"
        >
          <color attach="background" args={["#000000"]} />
          <EarthCameraPreset
            orientation={orientation}
            axisLocked={axisLocked}
          />
          <StarField
            orientation={starFieldOrientation}
            radius={STARFIELD_RADIUS}
          />
          <group quaternion={earthRotation}>
            <SunVisual sunDirection={sunDirection} />
            <mesh>
              <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
              <EarthSurface
                texture={texture}
                sunDirection={sunDirection}
                showGrid={showLines}
              />
            </mesh>
            {showLines && (
              <>
                <LatitudeGuides />
                <LocationLatitudeGuide latitude={location.latitudeValue} />
                <SolarGuides sunDirection={sunDirection} />
                <EarthOrbitGuide sunDirection={sunDirection} date={now} />
                <mesh position={[0, 1.68, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
                  <meshBasicMaterial color="#d8c88f" toneMapped={false} />
                </mesh>
                <mesh position={[0, -1.68, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
                  <meshBasicMaterial color="#d8c88f" toneMapped={false} />
                </mesh>
              </>
            )}
            <LocationMarker
              latitude={location.latitudeValue}
              longitude={location.longitudeValue}
            />
          </group>
          <OrbitControls
            key={`${orientation}-${axisLocked ? "axis-locked" : "free"}`}
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            enableRotate
            minPolarAngle={axisLocked ? Math.PI / 2 : 0}
            maxPolarAngle={axisLocked ? Math.PI / 2 : Math.PI}
            minDistance={2.1}
            maxDistance={15}
          />
        </Canvas>
        <div className="earth-view-controls">
          <button
            className="earth-overlay-toggle"
            type="button"
            aria-expanded={showTimeSelector}
            aria-controls="earth-date-time-panel"
            onClick={() => setShowTimeSelector((visible) => !visible)}
          >
            Time / date
          </button>
          <div
            className="earth-date-panel"
            id="earth-date-time-panel"
            hidden={!showTimeSelector}
          >
            <label>
              <span>TIME / {timeZone}</span>
              <input
                type="datetime-local"
                value={timeInput}
                aria-label="Custom date and time"
                aria-invalid={Boolean(timeError || presetError)}
                aria-describedby={
                  timeError || presetError ? "earth-time-error" : undefined
                }
                onChange={(event) => {
                  setPresetError(null);
                  onTimeInput(event.target.value);
                }}
              />
            </label>
            {(timeError || presetError) && (
              <p className="earth-time-error" id="earth-time-error" role="alert">
                {timeError || presetError}
              </p>
            )}
            <div
              className="earth-date-presets"
              role="group"
              aria-label="Seasonal presets"
            >
              <button
                type="button"
                onClick={() => selectSeasonalPreset(0)}
              >
                Next spring equinox
              </button>
              <button
                type="button"
                onClick={() => selectSeasonalPreset(90)}
              >
                Next summer solstice
              </button>
              <button
                type="button"
                onClick={() => selectSeasonalPreset(180)}
              >
                Next fall equinox
              </button>
              <button
                type="button"
                onClick={() => selectSeasonalPreset(270)}
              >
                Next winter solstice
              </button>
            </div>
            <button
              className="earth-date-now"
              type="button"
              onClick={() => {
                setPresetError(null);
                onNow();
              }}
            >
              Return to live time
            </button>
          </div>
          <button
            className="earth-overlay-toggle"
            type="button"
            aria-expanded={showSettings}
            aria-controls="earth-view-settings"
            onClick={() => setShowSettings((visible) => !visible)}
          >
            Settings
          </button>
          <div
            className="earth-view-settings"
            id="earth-view-settings"
            hidden={!showSettings}
          >
            <div
              className="earth-orientation-controls"
              role="group"
              aria-label="Camera orientation"
            >
              <button
                type="button"
                aria-pressed={orientation === "shadow"}
                onClick={() => {
                  setOrientation("shadow");
                  setAxisLocked(false);
                }}
              >
                Shadow vertical
              </button>
              <button
                type="button"
                aria-pressed={orientation === "north-pole"}
                onClick={() => setOrientation("north-pole")}
              >
                North pole vertical
              </button>
            </div>
            <button
              className="earth-axis-lock-toggle"
              type="button"
              aria-label="Lock camera rotation to Earth's axis"
              aria-pressed={axisLocked}
              onClick={() => {
                if (!axisLocked) {
                  setOrientation("north-pole");
                }
                setAxisLocked((locked) => !locked);
              }}
            >
              Earth axis / {axisLocked ? "Locked" : "Free"}
            </button>
            <button
              className="earth-lines-toggle"
              type="button"
              aria-label={showLines ? "Hide Earth lines" : "Show Earth lines"}
              aria-pressed={showLines}
              onClick={() => setShowLines((visible) => !visible)}
            >
              Lines / {showLines ? "On" : "Off"}
            </button>
          </div>
        </div>
        <div className="earth-guide-legend">
          <button
            className="earth-overlay-toggle"
            type="button"
            aria-expanded={showLegend}
            aria-controls="earth-guide-legend-content"
            onClick={() => setShowLegend((visible) => !visible)}
          >
            Map key
          </button>
          <div
            className="earth-guide-legend-content"
            id="earth-guide-legend-content"
            aria-label="Globe guide legend"
            hidden={!showLegend}
          >
            {showLines && (
              <>
                <span>
                  <i className="earth-guide-swatch terminator" />
                  Day/night boundary
                </span>
                <span>
                  <i className="earth-guide-swatch high-noon" />
                  Sun-facing meridian
                </span>
                <span>
                  <i className="earth-guide-swatch subsolar-equator-circle" />
                  Subsolar equator circle
                </span>
                <span>
                  <i className="earth-guide-swatch midnight" />
                  Midnight
                </span>
                <span>
                  <i className="earth-guide-swatch equator" />
                  Equator
                </span>
                <span>
                  <i className="earth-guide-swatch tropics" />
                  Tropics / polar circles
                </span>
                <span>
                  <i className="earth-guide-swatch earth-orbit" />
                  Earth orbital path
                </span>
              </>
            )}
            <span>
              <i className="earth-guide-swatch city-lights" />
              City lights (NASA 2016)
            </span>
            <span>
              <i className="earth-guide-swatch star-field" />
              Stars (HYG catalog)
            </span>
            <span>
              <i className="earth-guide-swatch sun" />
              Sun
            </span>
            <span>
              <i className="earth-guide-swatch location" />
              Selected location
            </span>
          </div>
        </div>
      </div>
      <p className="earth-caption">
        NATURAL EARTH 1:50M / NASA BLACK MARBLE 2016 /{" "}
        <a
          href="https://github.com/astronexus/HYG-Database"
          target="_blank"
          rel="noreferrer"
        >
          HYG DATABASE V4.1 (CC BY-SA 4.0)
        </a>{" "}
        / 30 DEG LAT-LON GRID / SOLAR GUIDES FOLLOW SELECTED TIME
      </p>
    </section>
  );
}
