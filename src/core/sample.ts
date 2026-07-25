import { priorityOf } from "./regions.js";
import { classifyRegion, type HeadParams, headBounds, sdHead } from "./sdf.js";

/**
 * Surface sampling for the head field, in two stages:
 *
 *  1. Shell rejection then Newton projection, giving a dense unbiased-ish surface cloud.
 *  2. Weighted progressive sample elimination, thinning that cloud to a blue-noise set whose
 *     *ordering* is meaningful.
 *
 * Stage 2 is the load-bearing one. Elimination produces a progressive ordering — any prefix of
 * the result is itself a valid Poisson-disk set — so the runtime picks a particle count from
 * rendered pixel size and simply draws the first N. There is no re-sampling per size and no
 * allocation at draw time.
 *
 * Weighting that elimination by region priority additionally pushes eyes, brows and mouth to
 * the front of the ordering, which is what makes a 56-particle head at 20px still read as a
 * face rather than an even grey fog.
 */

export interface SurfaceCloud {
  positions: Float32Array;
  normals: Float32Array;
  regionId: Uint8Array;
  count: number;
}

/**
 * Pulls a point onto the isosurface by stepping along the field gradient, writing the converged
 * position into `out[0..2]` and its unit normal into `out[3..5]`.
 *
 * The normal comes back from here rather than from a separate `sdHeadNormal` call because the
 * gradient is already computed on the final iteration — and the gradient *is* the normal. Asking
 * for it again costs six more field evaluations per particle for an answer we just discarded, which
 * measured as a significant share of generation time.
 */
function project(
  x: number,
  y: number,
  z: number,
  p: HeadParams,
  out: Float32Array,
  iterations = 4,
): boolean {
  let px = x;
  let py = y;
  let pz = z;
  const eps = 1e-3;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < iterations; i++) {
    const d = sdHead(px, py, pz, p);
    const gx = sdHead(px + eps, py, pz, p) - sdHead(px - eps, py, pz, p);
    const gy = sdHead(px, py + eps, pz, p) - sdHead(px, py - eps, pz, p);
    const gz = sdHead(px, py, pz + eps, p) - sdHead(px, py, pz - eps, p);
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (len < 1e-12) return false;
    nx = gx / len;
    ny = gy / len;
    nz = gz / len;
    if (Math.abs(d) < 1e-5) break;
    px -= d * nx;
    py -= d * ny;
    pz -= d * nz;
  }

  if (Math.abs(sdHead(px, py, pz, p)) > 5e-3) return false;
  out[0] = px;
  out[1] = py;
  out[2] = pz;
  out[3] = nx;
  out[4] = ny;
  out[5] = nz;
  return true;
}

/**
 * Builds a dense surface cloud by rejecting bounding-box samples that are not already close to
 * the surface, then projecting the survivors.
 *
 * Rejecting first matters: projecting an arbitrary interior point would slide it a long way
 * along the gradient and pile many candidates onto the same few surface features.
 */
export function sampleSurface(p: HeadParams, candidates: number, rng: () => number): SurfaceCloud {
  const b = headBounds(p);
  const shell = Math.max(b.x, b.y, b.z) * 0.12;

  const accepted: number[] = [];
  const regions: number[] = [];
  const out = new Float32Array(6);

  for (let i = 0; i < candidates; i++) {
    const x = (rng() * 2 - 1) * b.x;
    const y = (rng() * 2 - 1) * b.y;
    const z = (rng() * 2 - 1) * b.z;
    if (Math.abs(sdHead(x, y, z, p)) > shell) continue;
    if (!project(x, y, z, p, out)) continue;
    accepted.push(out[0], out[1], out[2], out[3], out[4], out[5]);
    regions.push(classifyRegion(out[0], out[1], out[2], p));
  }

  const count = regions.length;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regionId = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = accepted[i * 6];
    positions[i * 3 + 1] = accepted[i * 6 + 1];
    positions[i * 3 + 2] = accepted[i * 6 + 2];
    normals[i * 3] = accepted[i * 6 + 3];
    normals[i * 3 + 1] = accepted[i * 6 + 4];
    normals[i * 3 + 2] = accepted[i * 6 + 5];
    regionId[i] = regions[i];
  }
  return { positions, normals, regionId, count };
}

/**
 * A uniform grid over the bounding box, used to answer "which samples are within r of this
 * one" during elimination. Without it the algorithm is O(n^2) and regeneration stops feeling
 * live under the tuning sliders.
 */
class NeighbourGrid {
  private readonly cells: number[][];
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;
  private readonly inv: number;
  private readonly minX: number;
  private readonly minY: number;
  private readonly minZ: number;

  /** Buckets hold cloud indices, so the grid can cover an arbitrary subset of the cloud. */
  constructor(positions: Float32Array, indices: Int32Array, cell: number) {
    this.inv = 1 / cell;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const i of indices) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.nx = Math.max(1, Math.ceil((maxX - minX) * this.inv) + 1);
    this.ny = Math.max(1, Math.ceil((maxY - minY) * this.inv) + 1);
    this.nz = Math.max(1, Math.ceil((maxZ - minZ) * this.inv) + 1);
    this.cells = new Array(this.nx * this.ny * this.nz);

    for (const i of indices) {
      const key = this.keyOf(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const bucket = this.cells[key];
      if (bucket) bucket.push(i);
      else this.cells[key] = [i];
    }
  }

  private keyOf(x: number, y: number, z: number): number {
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) * this.inv)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.minY) * this.inv)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.minZ) * this.inv)));
    return (iz * this.ny + iy) * this.nx + ix;
  }

  forEachNear(x: number, y: number, z: number, visit: (index: number) => void): void {
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) * this.inv)));
    const iy = Math.min(this.ny - 1, Math.max(0, Math.floor((y - this.minY) * this.inv)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.minZ) * this.inv)));
    for (let dz = -1; dz <= 1; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= this.nz) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = iy + dy;
        if (cy < 0 || cy >= this.ny) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx;
          if (cx < 0 || cx >= this.nx) continue;
          const bucket = this.cells[(cz * this.ny + cy) * this.nx + cx];
          if (!bucket) continue;
          for (const index of bucket) visit(index);
        }
      }
    }
  }
}

/** Max-heap over sample weights with lazy invalidation. */
class MaxHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];
  private readonly stamps: number[] = [];

  push(index: number, key: number, stamp: number): void {
    this.items.push(index);
    this.keys.push(key);
    this.stamps.push(stamp);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] >= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): { index: number; stamp: number } | null {
    if (this.items.length === 0) return null;
    const index = this.items[0];
    const stamp = this.stamps[0];
    const last = this.items.length - 1;
    this.swap(0, last);
    this.items.pop();
    this.keys.pop();
    this.stamps.pop();

    let i = 0;
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.keys[l] > this.keys[best]) best = l;
      if (r < n && this.keys[r] > this.keys[best]) best = r;
      if (best === i) break;
      this.swap(best, i);
      i = best;
    }
    return { index, stamp };
  }

  private swap(a: number, b: number): void {
    const ti = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = ti;
    const tk = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = tk;
    const ts = this.stamps[a];
    this.stamps[a] = this.stamps[b];
    this.stamps[b] = ts;
  }
}

export interface EliminationOptions {
  /** Size of the returned ordering — the maximum particle count the runtime can draw. */
  target: number;
  /** Neighbour influence radius for the selection pass. Derived from the target count. */
  radius: number;
  /** Surface area estimate, used to size the radius at each ordering octave. */
  surfaceArea: number;
  /**
   * Extra priority for silhouette particles — those whose normal is near-perpendicular to the
   * view axis. The rim is what carries the head's recognisable outline at small sizes.
   */
  rimBoost: number;
}

interface EliminationRun {
  /** Indices still alive when the run stopped. */
  survivors: Int32Array;
  /** Indices in the order they were removed — earliest removal first. */
  removalOrder: Int32Array;
}

/**
 * Greedy weighted sample elimination (Yuksel 2015) over an arbitrary subset of a cloud.
 *
 * Each sample accumulates weight from close neighbours; the heaviest is repeatedly removed and
 * its neighbours re-weighted, until `stopAt` remain. Dividing a sample's weight by its region
 * priority makes high-priority regions resist removal, so they survive longest.
 */
function eliminate(
  cloud: SurfaceCloud,
  indices: Int32Array,
  radius: number,
  priority: Float64Array,
  stopAt: number,
): EliminationRun {
  const { positions } = cloud;
  const grid = new NeighbourGrid(positions, indices, radius);
  const r2 = radius * radius;

  // Indexed by cloud index rather than by position in `indices`, so the same buffers work for
  // any subset without a translation table.
  const weights = new Float64Array(cloud.count);
  const alive = new Uint8Array(cloud.count);
  const stamps = new Int32Array(cloud.count);
  for (const i of indices) alive[i] = 1;

  // w(d) = (1 - d / 2r)^8, the falloff from the paper.
  const contribution = (d2: number): number => {
    const t = 1 - Math.sqrt(d2) / (2 * radius);
    if (t <= 0) return 0;
    const t2 = t * t;
    const t4 = t2 * t2;
    return t4 * t4;
  };

  for (const i of indices) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    let w = 0;
    grid.forEachNear(x, y, z, (j) => {
      if (j === i) return;
      const dx = positions[j * 3] - x;
      const dy = positions[j * 3 + 1] - y;
      const dz = positions[j * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 4 * r2) return;
      w += contribution(d2);
    });
    weights[i] = w / priority[i];
  }

  const heap = new MaxHeap();
  for (const i of indices) heap.push(i, weights[i], 0);

  const removalOrder = new Int32Array(indices.length);
  let removed = 0;
  let living = indices.length;

  while (living > stopAt) {
    const top = heap.pop();
    if (!top) break;
    const { index, stamp } = top;
    if (!alive[index] || stamp !== stamps[index]) continue; // stale entry

    alive[index] = 0;
    living--;
    removalOrder[removed++] = index;

    const x = positions[index * 3];
    const y = positions[index * 3 + 1];
    const z = positions[index * 3 + 2];
    grid.forEachNear(x, y, z, (j) => {
      if (!alive[j] || j === index) return;
      const dx = positions[j * 3] - x;
      const dy = positions[j * 3 + 1] - y;
      const dz = positions[j * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 4 * r2) return;
      weights[j] -= contribution(d2) / priority[j];
      stamps[j]++;
      heap.push(j, weights[j], stamps[j]);
    });
  }

  const survivors = new Int32Array(living);
  let cursor = 0;
  for (const i of indices) {
    if (alive[i]) survivors[cursor++] = i;
  }
  return { survivors, removalOrder: removalOrder.subarray(0, removed) };
}

/**
 * Produces a progressive blue-noise ordering of `target` particles drawn from the cloud.
 *
 * Two passes, because selection and ordering are genuinely different problems and one pass
 * cannot do both. A single elimination down to `target` decides *which* particles survive but
 * leaves them in arbitrary index order — which, since the feature clusters are appended to the
 * cloud last, put every eye and brow at the *end* of the output and broke small-size
 * legibility outright.
 *
 *  1. **Select** — eliminate the full cloud down to `target`, at a radius sized for `target`.
 *  2. **Order** — eliminate that survivor set almost to nothing, at a much larger radius, and
 *     reverse the removal order. Whatever resisted removal longest is sparsest and most
 *     important, so it comes first.
 *
 * The result is that every prefix is itself a valid Poisson-disk set, and region priority
 * applied in both passes pulls eyes, brows and mouth to the very front.
 */
export function eliminateProgressive(cloud: SurfaceCloud, options: EliminationOptions): Int32Array {
  const { normals, regionId, count } = cloud;
  const { radius, rimBoost, surfaceArea } = options;
  const target = Math.min(options.target, count);

  const priority = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const nz = Math.abs(normals[i * 3 + 2]);
    priority[i] = priorityOf(regionId[i]) * (1 + rimBoost * (1 - nz));
  }

  const all = new Int32Array(count);
  for (let i = 0; i < count; i++) all[i] = i;

  const selected = eliminate(cloud, all, radius, priority, target).survivors;

  // Ordering pass, run in octaves: halve the set, then halve again, growing the radius each time
  // to match the thinning set.
  //
  // A single pass at one radius cannot do this. Sized for the dense end, the sparse end finds no
  // neighbours, every weight is zero and the ordering that matters most — the first few dozen
  // particles — is arbitrary. Sized for the sparse end, every point neighbours every other and the
  // pass degenerates to all-pairs, which measured at 81ms and blew the live-tuning budget outright.
  // Halving keeps the neighbour count per point roughly constant, so the whole ordering costs about
  // as much as one dense pass.
  const stages: Int32Array[] = [];
  let current = selected;
  while (current.length > 1) {
    const next = Math.max(1, current.length >> 1);
    const run = eliminate(cloud, current, radiusForTarget(surfaceArea, next), priority, next);
    stages.push(run.removalOrder);
    current = run.survivors;
  }

  // Whatever survived every octave is the sparsest and most important, so it leads. Then each
  // octave's casualties in reverse, latest octave first — later removal means it held on longer.
  const order = new Int32Array(selected.length);
  let cursor = 0;
  for (const i of current) order[cursor++] = i;
  for (let s = stages.length - 1; s >= 0; s--) {
    const removed = stages[s];
    for (let i = removed.length - 1; i >= 0; i--) order[cursor++] = removed[i];
  }
  return order;
}

/**
 * Neighbour radius for a target sample count over a surface of the given area, from the 2D
 * Poisson-disk relation — the head surface is a 2-manifold, so the 2D form is the right one.
 */
export function radiusForTarget(surfaceArea: number, target: number): number {
  return Math.sqrt(surfaceArea / (2 * Math.sqrt(3) * Math.max(1, target)));
}

/** Knud Thomsen approximation for ellipsoid surface area, used to size the radius. */
export function approximateSurfaceArea(p: HeadParams): number {
  const b = headBounds(p);
  const e = 1.6075;
  const ap = (b.x * b.y) ** e + (b.x * b.z) ** e + (b.y * b.z) ** e;
  return 4 * Math.PI * (ap / 3) ** (1 / e);
}
