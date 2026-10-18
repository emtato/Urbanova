/**
 * The GLB's nose is +Z. Mapbox swaps glTF Y/Z, mapping that nose to south
 * (+map Y). Its positive model yaw turns south toward west, so a geographic
 * bearing (clockwise from north) needs bearing - 180, not 180 - bearing.
 */
export function streetcarModelYaw(bearing: number): number {
  return ((bearing - 180) % 360 + 360) % 360
}
