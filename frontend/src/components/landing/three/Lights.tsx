"use client";

export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 15]} intensity={0.5} color="#e0e0e0" />
      <directionalLight position={[-4, 5, 2]} intensity={0.2} color="#c0c0d0" />
    </>
  );
}
