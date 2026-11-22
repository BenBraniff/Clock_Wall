import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import starCatalogData from "../data/hyg_bright_stars.json";

type StarCatalog = {
  stars: number[][];
};

const starCatalog = starCatalogData as StarCatalog;

function createStarGeometry(radius: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCatalog.stars.length * 3);
  const colors = new Float32Array(starCatalog.stars.length * 3);

  starCatalog.stars.forEach((star, index) => {
    const [rightAscensionHours, declinationDegrees, magnitude, colorIndex] =
      star;
    if (
      rightAscensionHours === undefined ||
      declinationDegrees === undefined ||
      magnitude === undefined ||
      colorIndex === undefined
    ) {
      return;
    }

    const rightAscension = THREE.MathUtils.degToRad(rightAscensionHours * 15);
    const declination = THREE.MathUtils.degToRad(declinationDegrees);
    const cosDeclination = Math.cos(declination);
    const warmth = THREE.MathUtils.clamp((colorIndex + 0.3) / 1.8, 0, 1);
    const flux = Math.pow(10, -0.4 * (magnitude - 1));
    const brightness = THREE.MathUtils.clamp(
      0.06 + Math.sqrt(flux) * 0.38,
      0.07,
      1,
    );
    positions[index * 3] =
      radius * cosDeclination * Math.cos(rightAscension);
    positions[index * 3 + 1] =
      radius * cosDeclination * Math.sin(rightAscension);
    positions[index * 3 + 2] = radius * Math.sin(declination);
    colors[index * 3] = (0.64 + warmth * 0.36) * brightness;
    colors[index * 3 + 1] = (0.77 - warmth * 0.03) * brightness;
    colors[index * 3 + 2] = (1 - warmth * 0.48) * brightness;
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function StarField({
  orientation,
  radius = 1000,
}: {
  orientation: THREE.Quaternion;
  radius?: number;
}) {
  const geometry = useMemo(() => createStarGeometry(radius), [radius]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });

  return (
    <group ref={groupRef} quaternion={orientation}>
      <points geometry={geometry} frustumCulled={false} renderOrder={-1}>
        <pointsMaterial
          size={1.6}
          sizeAttenuation={false}
          vertexColors
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
