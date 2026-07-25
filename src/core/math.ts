/**
 * Small numeric kernel shared by the geometry generator and the renderers. Everything here
 * is scalar-in/scalar-out rather than vector-object based, because these run in tight loops
 * over thousands of points and the architecture forbids per-frame allocation.
 */

/**
 * mulberry32 — 32-bit seeded PRNG. Chosen over a longer-period generator because geometry
 * generation draws on the order of 10^5 numbers, far inside mulberry32's period, and the
 * whole implementation is four lines with no state to carry.
 *
 * Seeding matters: geometry must be reproducible so a committed baked point set and a live
 * regeneration from the same params agree exactly.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Polynomial smooth minimum. This is the single most important shaping control in the head:
 * it is what turns a pile of separate quadrics into one continuous face, and `k` is the
 * difference between a crisp jaw and a melted blob.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Signed distance to a sphere. Exact. */
export function sdSphere(px: number, py: number, pz: number, r: number): number {
  return Math.sqrt(px * px + py * py + pz * pz) - r;
}

/**
 * Signed distance to an axis-aligned ellipsoid. An exact closed form does not exist, so this
 * is the standard bounded approximation — accurate near the surface, which is the only place
 * we sample, and always correctly signed.
 */
export function sdEllipsoid(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
): number {
  const kx = px / rx;
  const ky = py / ry;
  const kz = pz / rz;
  const k0 = Math.sqrt(kx * kx + ky * ky + kz * kz);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const jx = px / (rx * rx);
  const jy = py / (ry * ry);
  const jz = pz / (rz * rz);
  const k1 = Math.sqrt(jx * jx + jy * jy + jz * jz);
  return (k0 * (k0 - 1)) / k1;
}

/**
 * Golden-angle spiral over the unit disc. Deterministic and near-blue-noise without needing
 * elimination, which is why the facial feature clusters use it directly — a nine-particle eye
 * has no room for a stochastic process to get unlucky.
 */
export function sunflowerDisc(index: number, count: number): { x: number; y: number } {
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const r = Math.sqrt((index + 0.5) / count);
  const theta = index * GOLDEN_ANGLE;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}
