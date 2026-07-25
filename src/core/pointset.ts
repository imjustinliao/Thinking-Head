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
  count: number;
  /** Half-extents of the generated geometry, for camera framing. */
  bounds: { x: number; y: number; z: number };
}

export function emptyPointSet(): HeadPointSet {
  return {
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    regionId: new Uint8Array(0),
    weight: new Float32Array(0),
    count: 0,
    bounds: { x: 0, y: 0, z: 0 },
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
}
