/**
 * The runtime's only geometry input: a **tagged point set**, never a mesh.
 *
 * Topology, UVs and edge flow are meaningless to a particle head, and dropping them is what
 * makes Phase 2 tractable — every single-image head reconstruction method in the literature
 * targets a fixed-topology parametric model, so region tags and rig weights can be assigned
 * once against that topology, server-side and offline, and reused for every user. This format
 * therefore does not need to change to support personalised heads.
 *
 * Particle order is significant: it is a progressive blue-noise ordering, so the first N
 * entries are a valid lower-density head for any N. Never reorder these arrays.
 */
export interface HeadPointSet {
  /** Rest position per particle, xyz interleaved. Length `3 * count`. */
  positions: Float32Array;
  /** Surface normal per particle, xyz interleaved. Length `3 * count`. */
  normals: Float32Array;
  /** Facial region tag per particle. Length `count`. See REGION in regions.ts. */
  regionId: Uint8Array;
  /**
   * Rig influence per particle, as a scalar falloff toward its region's core (1 at the core,
   * approaching 0 at the region edge). Length `count`.
   *
   * Deliberately scalar rather than multi-channel skinning weights: Phase 1 evaluates
   * deformation analytically in the vertex shader from uniforms, so per-particle multi-influence
   * buys nothing. If Phase 2 reconstruction needs it, adding channels is an additive change.
   */
  weight: Float32Array;
  /**
   * Baked ambient occlusion per particle, 0..1 where 1 is fully open surface. Directional
   * lighting alone cannot darken a concavity whose floor still faces the light; occlusion is
   * what makes eye sockets, the nose creases and the underside of the jaw read dark, which is
   * most of what separates a sculpted head from a lit egg. Computed from the field at
   * generation time — for Phase 2 it is equally derivable from reconstructed geometry.
   */
  occlusion: Float32Array;
  count: number;
  /** Axis-aligned half-extents of the actual generated points. */
  bounds: { x: number; y: number; z: number };
  /**
   * Centre of the generated points. The renderer translates by this so the head stays framed
   * regardless of how asymmetric the tuning parameters are — raising the cranium should not also
   * shove the head up the canvas.
   */
  center: { x: number; y: number; z: number };
  /**
   * Largest distance from `center` to any point: the true framing radius.
   *
   * Measured from the geometry rather than derived from the bounding box, because a box corner is
   * much further out than the head ever reaches and framing to it renders the head far too small.
   */
  radius: number;
}

export function emptyPointSet(): HeadPointSet {
  return {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    regionId: new Uint8Array(0),
    weight: new Float32Array(0),
    occlusion: new Float32Array(0),
    count: 0,
    bounds: { x: 0, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    radius: 0,
  };
}

/** Measures the extents, centre and framing radius of a finished position buffer. */
export function measureExtents(
  positions: Float32Array,
  count: number,
): Pick<HeadPointSet, "bounds" | "center" | "radius"> {
  if (count === 0) return { bounds: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, radius: 0 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
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

  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  let radius = 0;
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3] - center.x;
    const dy = positions[i * 3 + 1] - center.y;
    const dz = positions[i * 3 + 2] - center.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > radius) radius = d;
  }

  return {
    bounds: { x: (maxX - minX) / 2, y: (maxY - minY) / 2, z: (maxZ - minZ) / 2 },
    center,
    radius,
  };
}

/** Asserts the array-length invariants. Used by tests and by the future bake script. */
export function validatePointSet(set: HeadPointSet): void {
  const { count } = set;
  if (set.positions.length !== count * 3) {
    throw new Error(`positions length ${set.positions.length}, expected ${count * 3}`);
  }
  if (set.normals.length !== count * 3) {
    throw new Error(`normals length ${set.normals.length}, expected ${count * 3}`);
  }
  if (set.regionId.length !== count) {
    throw new Error(`regionId length ${set.regionId.length}, expected ${count}`);
  }
  if (set.weight.length !== count) {
    throw new Error(`weight length ${set.weight.length}, expected ${count}`);
  }
  if (set.occlusion.length !== count) {
    throw new Error(`occlusion length ${set.occlusion.length}, expected ${count}`);
  }
}
