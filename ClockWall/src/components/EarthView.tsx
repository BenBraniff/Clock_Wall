import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as Astronomy from "astronomy-engine";
import * as THREE from "three";
import landGeoJson from "../data/ne_110m_land.geojson?raw";

type LandFeature = {
  geometry: {
    coordinates: number[][][];
    type: "Polygon";
  };
};

const landFeatures = (
  JSON.parse(landGeoJson) as { features: LandFeature[] }
).features;
const EARTH_RADIUS = 1.45;
const EARTH_OBLIQUITY = THREE.MathUtils.degToRad(23.43928);

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

function getEarthViewRotation(sunDirection: THREE.Vector3) {
  const sunAxis = sunDirection.clone().normalize();
  const upAxis = new THREE.Vector3(0, 1, 0)
    .addScaledVector(sunAxis, -sunAxis.y)
    .normalize();
  const depthAxis = sunAxis.clone().cross(upAxis).normalize();
  const rotation = new THREE.Matrix4()
    .makeBasis(sunAxis, upAxis, depthAxis)
    .transpose();
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
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
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
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
    ],
    [sunDirection],
  );

  return (
    <>
      {guides.map(({ color, geometry }, index) => (
        <TubeGuide key={index} geometry={geometry} color={color} />
      ))}
    </>
  );
}

function EarthSurface({
  texture,
  sunDirection,
}: {
  texture: THREE.Texture;
  sunDirection: THREE.Vector3;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          earthTexture: { value: texture },
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
            gl_FragColor = vec4(surfaceColor * daylight * irradiance * 1.6, 1.0);
            #include <colorspace_fragment>
          }
        `,
        toneMapped: false,
      }),
    [texture],
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

  landFeatures.forEach(({ geometry }) => {
    context.beginPath();
    geometry.coordinates.forEach((ring) => {
      ring.forEach(([longitude, latitude], pointIndex) => {
        const x = ((longitude + 180) / 360) * canvas.width;
        const y = ((90 - latitude) / 180) * canvas.height;
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    });
    context.fillStyle = "#718b56";
    context.fill("evenodd");
    context.strokeStyle = "#a3ad78";
    context.lineWidth = 2.5;
    context.stroke();
  });

  context.save();
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    const x = ((longitude + 180) / 360) * canvas.width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.strokeStyle =
      longitude === 0 ? "rgba(209, 224, 194, 0.62)" : "rgba(173, 202, 194, 0.3)";
    context.lineWidth = longitude === 0 ? 5 : 2.5;
    context.stroke();
  }
  for (let latitude = -90; latitude <= 90; latitude += 30) {
    const y = ((90 - latitude) / 180) * canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.strokeStyle =
      latitude === 0 ? "rgba(209, 224, 194, 0.62)" : "rgba(173, 202, 194, 0.3)";
    context.lineWidth = latitude === 0 ? 5 : 2.5;
    context.stroke();
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function EarthView({ now }: { now: Date }) {
  const texture = useMemo(() => createEarthTexture(), []);
  const sunDirection = useMemo(() => getSunDirection(now), [now]);
  const earthRotation = useMemo(
    () => getEarthViewRotation(sunDirection),
    [sunDirection],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <section className="earth-page">
      <div className="earth-page-heading">
        <div>
          <p className="kicker">INTERACTIVE GLOBE / EARTH</p>
          <h1>
            Earth
            <br />
            <em>view.</em>
          </h1>
        </div>
        <p className="earth-intro">
          Sun-only lighting follows the selected time. The orbital-plane view
          keeps the day/night boundary vertical and shows Earth&apos;s seasonal
          axial tilt. Drag to rotate, right-drag to move, and scroll to zoom.
        </p>
      </div>
      <div className="earth-canvas-frame">
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          role="img"
          aria-label="Interactive three-dimensional Earth globe"
        >
          <color attach="background" args={["#000000"]} />
          <group quaternion={earthRotation}>
            <mesh>
              <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
              <EarthSurface texture={texture} sunDirection={sunDirection} />
            </mesh>
            <LatitudeGuides />
            <SolarGuides sunDirection={sunDirection} />
            <mesh position={[0, 1.68, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
              <meshBasicMaterial color="#d8c88f" toneMapped={false} />
            </mesh>
            <mesh position={[0, -1.68, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
              <meshBasicMaterial color="#d8c88f" toneMapped={false} />
            </mesh>
          </group>
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            enablePan
            minDistance={2.1}
            maxDistance={7}
          />
        </Canvas>
        <div className="earth-guide-legend" aria-label="Globe guide legend">
          <span>
            <i className="earth-guide-swatch terminator" />
            Day/night boundary
          </span>
          <span>
            <i className="earth-guide-swatch high-noon" />
            High noon
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
        </div>
      </div>
      <p className="earth-caption">
        NATURAL EARTH 1:110M / 30 DEG LAT-LON GRID / SOLAR GUIDES FOLLOW SELECTED TIME
      </p>
    </section>
  );
}
