export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(
  x: number,
  z: number,
  gridSize: number
): [number, number] {
  return [snapToGrid(x, gridSize), snapToGrid(z, gridSize)];
}
