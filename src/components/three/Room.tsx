import React from "react";
import { DoubleSide } from "three";

export default function Room() {
  return (
    <group position={[0, 0, 5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.01, 0]}>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.99, 0]}>
          <planeGeometry args={[6, 6]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
      </group>

      <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 0, 0]}>
        <planeGeometry args={[6, 2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      <group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[3, 0, 0]}>
          <planeGeometry args={[6, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[3, 0, 0]}>
          <planeGeometry args={[6, 2]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      </group>

      <group position={[0, 0, 3]}>
        <mesh rotation={[0, -Math.PI, 0]} position={[-1.75, 0, 0]}>
          <planeGeometry args={[2.5, 2]} />
          <meshStandardMaterial color="#ffffff" side={DoubleSide} />
        </mesh>

        <mesh rotation={[0, -Math.PI, 0]} position={[1.75, 0, 0]}>
          <planeGeometry args={[2.5, 2]} />
          <meshStandardMaterial color="#ffffff" side={DoubleSide} />
        </mesh>

        <mesh rotation={[0, -Math.PI, 0]} position={[0, 0.875, 0]}>
          <planeGeometry args={[1, 0.25]} />
          <meshStandardMaterial color="#ffffff" side={DoubleSide} />
        </mesh>
      </group>

      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -3]}>
        <planeGeometry args={[6, 2]} />
        <meshStandardMaterial color="#252525" side={DoubleSide} />
      </mesh>
    </group>
  );
}
