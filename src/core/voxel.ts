import { type HeadParams, headBounds, sdHead } from "./sdf.js";

/**
 * Surface voxelisation of the head field onto a regular lattice.
 *
 * This replaces stochastic blue-noise surface sampling, and the reason is what the reference
 * imagery actually shows: particles sitting on a **regular grid**, tiling the surface like
 * cubes. Scattered points can never produce that, however carefully they are spaced — the
 * legibility of a voxel head comes from neighbouring cells lining up in rows and columns, which
 * is exactly what a lattice guarantees and what blue noise deliberately destroys.
 *
 * It also settles the "every particle is the same size" rule structurally rather than by
 * convention: lattice cells *are* uniform, so identical spacing is a property of the data.
 *
 * The scan is hierarchical and narrow-band. A dense N³ scan at the resolutions we need would be
 * millions of field evaluations; refining only cells the surface can actually pass through makes
 * the cost proportional to surface area (N²) instead of volume (N³). Because the field is a true
 * signed distance function it is 1-Lipschitz, so a cell of size h can only contain surface if
 * |sdf(centre)| <= h·sqrt(3)/2 — a conservative test that cannot miss geometry.
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

/** Coarsest lattice the refinement starts from. Small enough to be trivial, large enough to prune. */
const SEED_RESOLUTION = 8;

/**
 * Voxelises the head surface at the given resolution.
 *
 * Positions stay snapped to cell centres. Projecting them onto the exact isosurface would smooth
 * the staircase away and with it the voxel character — the stepping *is* the aesthetic.
 */
export function voxelizeSurface(p: HeadParams, resolution: number): VoxelLattice {
  const b = headBounds(p);
  // Cubic domain so cells are isotropic; anisotropic cells would render as stretched particles.
  const half = Math.max(b.x, b.y, b.z);
  const extent = half * 2;

  const cellSize = extent / resolution;

  // Refinement works in power-of-two *blocks* of the target lattice, halving until a block is a
  // single cell. Coordinates therefore always mean the same thing — target-lattice indices — at
  // every stage. Refining through a chain of intermediate resolutions instead only works when
  // each step is an exact integer factor; with an arbitrary target (48 after 8→16→32) the factor
  // rounds, children are addressed on the wrong lattice, and the surface test rejects everything.
  let block = 1;
  while (Math.ceil(resolution / (block * 2)) >= SEED_RESOLUTION) block *= 2;

  const blocksAcross = Math.ceil(resolution / block);
  let cells = new Int32Array(blocksAcross * blocksAcross * blocksAcross * 3);
  let cellCount = 0;
  for (let i = 0; i < blocksAcross; i++) {
    for (let j = 0; j < blocksAcross; j++) {
      for (let k = 0; k < blocksAcross; k++) {
        cells[cellCount * 3] = i * block;
        cells[cellCount * 3 + 1] = j * block;
        cells[cellCount * 3 + 2] = k * block;
        cellCount++;
      }
    }
  }
  cellCount = keepSurfaceCells(cells, cellCount, block, cellSize, half, p);

  while (block > 1) {
    const child = block / 2;
    const next = new Int32Array(cellCount * 8 * 3);
    let nextCount = 0;
    for (let c = 0; c < cellCount; c++) {
      const bi = cells[c * 3];
      const bj = cells[c * 3 + 1];
      const bk = cells[c * 3 + 2];
      for (let di = 0; di < 2; di++) {
        for (let dj = 0; dj < 2; dj++) {
          for (let dk = 0; dk < 2; dk++) {
            const i = bi + di * child;
            const j = bj + dj * child;
            const k = bk + dk * child;
            // Blocks on the far edge can overhang the lattice; drop those children outright.
            if (i >= resolution || j >= resolution || k >= resolution) continue;
            next[nextCount * 3] = i;
            next[nextCount * 3 + 1] = j;
            next[nextCount * 3 + 2] = k;
            nextCount++;
          }
        }
      }
    }
    cells = next;
    cellCount = nextCount;
    block = child;
    cellCount = keepSurfaceCells(cells, cellCount, block, cellSize, half, p);
  }

  // Final pass tightens the band. The sqrt(3)/2 test has to stay conservative while refining or
  // it could prune a block the surface really crosses, but keeping it at the leaf level admits
  // cells nearly a full cell away from the surface — a shell two cells thick, which doubles the
  // particle count and stacks particles at slightly different depths. Half a cell leaves a clean
  // single-cell skin.
  cellCount = keepSurfaceCells(cells, cellCount, 1, cellSize, half, p, 0.58);

  const centreOf = (coord: number): number => -half + (coord + 0.5) * cellSize;
  const positions = new Float32Array(cellCount * 3);
  const normals = new Float32Array(cellCount * 3);
  const eps = cellSize * 0.35;

  for (let c = 0; c < cellCount; c++) {
    const x = centreOf(cells[c * 3]);
    const y = centreOf(cells[c * 3 + 1]);
    const z = centreOf(cells[c * 3 + 2]);
    positions[c * 3] = x;
    positions[c * 3 + 1] = y;
    positions[c * 3 + 2] = z;

    // Gradient sampled at cell scale rather than at machine epsilon: the normal should describe
    // the form the cell represents, not the micro-slope at its exact centre, or lighting picks
    // up noise the lattice cannot show.
    const nx = sdHead(x + eps, y, z, p) - sdHead(x - eps, y, z, p);
    const ny = sdHead(x, y + eps, z, p) - sdHead(x, y - eps, z, p);
    const nz = sdHead(x, y, z + eps, p) - sdHead(x, y, z - eps, p);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[c * 3] = nx / len;
    normals[c * 3 + 1] = ny / len;
    normals[c * 3 + 2] = nz / len;
  }

  return { positions, normals, count: cellCount, cellSize, resolution };
}

/**
 * Compacts `cells` in place to those blocks the surface can pass through, returning the new
 * count. Coordinates are the block's minimum corner in target-lattice indices; `block` is its
 * edge length in those same units.
 *
 * The 1-Lipschitz property of the field makes the half-diagonal test conservative: a block of
 * side s can only contain surface if the field at its centre is within s·sqrt(3)/2 of zero.
 */
function keepSurfaceCells(
  cells: Int32Array,
  count: number,
  block: number,
  cellSize: number,
  half: number,
  p: HeadParams,
  thresholdFactor = 0.8660254, // sqrt(3)/2 — the conservative half-diagonal
): number {
  const side = block * cellSize;
  const threshold = side * thresholdFactor;
  const offset = block * 0.5;
  let kept = 0;
  for (let c = 0; c < count; c++) {
    const i = cells[c * 3];
    const j = cells[c * 3 + 1];
    const k = cells[c * 3 + 2];
    const x = -half + (i + offset) * cellSize;
    const y = -half + (j + offset) * cellSize;
    const z = -half + (k + offset) * cellSize;
    if (Math.abs(sdHead(x, y, z, p)) > threshold) continue;
    cells[kept * 3] = i;
    cells[kept * 3 + 1] = j;
    cells[kept * 3 + 2] = k;
    kept++;
  }
  return kept;
}
