export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 15]}
        intensity={0.4}
        // keep original intent - aim toward door/outside area
        // target-position is not a valid react-three-fiber prop; if needed
        // the light target should be created explicitly later.
      />
    </>
  );
}
