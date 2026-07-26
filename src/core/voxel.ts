import { type HeadParams, headBounds, headSurfaceRadius, sdHead } from "./sdf.js";

/**
 * Surface voxelisation of the canonical head onto a regular lattice.
 *
 * The head is a star-shaped radial surface, so its spherical atlas can be rasterised directly
 * into lattice cells. This visits surface area rather than searching a volume, avoids relying on
 * signed-distance gradient bounds, and makes high-gradient nose and orbital detail impossible to
 * prune accidentally.
 */

export interface VoxelLattice {
  /** Cell-centre positions, xyz interleaved. Grid-aligned — never projected onto the surface. */
  positions: Float32Array;
  /** Surface normal at each cell centre, from the field gradient. */
  normals: Float32Array;
  count: number;
  /** Object-space edge length of one cell. Drives the rendered particle size. */
  cellSize: number;
  /** Cells across the full domain. */
  resolution: number;
}

/**
 * Voxelises the canonical surface at the given resolution.
 *
 * Samples are denser than the target lattice in both angular directions. Multiple samples that
 * land in one cell collapse through the occupancy bitset, leaving one particle per isotropic
 * cell and a deterministic one-cell skin.
 */
export function voxelizeSurface(p: HeadParams, resolution: number): VoxelLattice {
  const bounds = headBounds(p);
  const half = Math.max(bounds.x, bounds.y, bounds.z);
  const cellSize = (half * 2) / resolution;
  const occupied = new Uint8Array(resolution ** 3);
  const latitudeSteps = Math.max(24, resolution * 3);

  const cellOf = (coordinate: number): number =>
    Math.max(0, Math.min(resolution - 1, Math.floor((coordinate + half) / cellSize)));
  const indexOf = (i: number, j: number, k: number): number =>
    (i * resolution + j) * resolution + k;

  for (let latitude = 0; latitude <= latitudeSteps; latitude++) {
    const phi = (latitude / latitudeSteps - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const longitudeSteps = Math.max(1, Math.ceil(resolution * 6 * Math.abs(cosPhi)));

    for (let longitude = 0; longitude < longitudeSteps; longitude++) {
      const theta = (longitude / longitudeSteps - 0.5) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const radius = headSurfaceRadius(theta, phi, p);
      const qx = sinTheta * cosPhi * radius;
      const qy = sinPhi * radius;
      const qz = cosTheta * cosPhi * radius;
      const x = qx * p.width;
      const y = qy * p.height;
      const z = qz * (qz >= 0 ? p.frontDepth : p.backDepth);
      occupied[indexOf(cellOf(x), cellOf(y), cellOf(z))] = 1;
    }
  }

  let count = 0;
  for (let index = 0; index < occupied.length; index++) count += occupied[index];

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const eps = cellSize * 0.35;
  let point = 0;

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      for (let k = 0; k < resolution; k++) {
        if (occupied[indexOf(i, j, k)] === 0) continue;
        const x = -half + (i + 0.5) * cellSize;
        const y = -half + (j + 0.5) * cellSize;
        const z = -half + (k + 0.5) * cellSize;
        positions[point * 3] = x;
        positions[point * 3 + 1] = y;
        positions[point * 3 + 2] = z;

        // Cell-scale differences describe the form this voxel represents without amplifying
        // atlas quantisation that is finer than the lattice can display.
        const nx = sdHead(x + eps, y, z, p) - sdHead(x - eps, y, z, p);
        const ny = sdHead(x, y + eps, z, p) - sdHead(x, y - eps, z, p);
        const nz = sdHead(x, y, z + eps, p) - sdHead(x, y, z - eps, p);
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[point * 3] = nx / length;
        normals[point * 3 + 1] = ny / length;
        normals[point * 3 + 2] = nz / length;
        point++;
      }
    }
  }

  return { positions, normals, count, cellSize, resolution };
}
