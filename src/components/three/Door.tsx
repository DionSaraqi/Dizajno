import React, { forwardRef } from "react";
import { Group } from "three";

type DoorProps = {
  onClick?: () => void;
};

const Door = forwardRef<Group, DoorProps>(({ onClick }, ref) => {
  return (
    <group ref={ref as any} position={[0.5, -0.13, 8]} onClick={onClick}>
      <mesh position={[-0.5, 0, 0]}>
        <boxGeometry args={[1, 1.75, 0.1]} />
        <meshStandardMaterial color="#4F46E5" />
      </mesh>
    </group>
  );
});

Door.displayName = "Door";

export default Door;
