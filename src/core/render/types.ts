import type { HeadPointSet } from "../pointset.js";

/**
 * Camera for the head. Orbit-style rather than free: the head is always the subject, so yaw,
 * pitch and distance are the only meaningful controls, and the WebGL backend will drive the
 * interactive 360° view from exactly these fields.
 */
export interface Camera {
  /** Radians. A small non-zero yaw is the default — a dead-on view reads flat and mugshot-like. */
  yaw: number;
  /** Radians. Slightly negative looks down on the head, which reads as approachable. */
  pitch: number;
  /** Distance from the head centre, in head radii. */
  distance: number;
  /** Vertical field of view in radians. */
  fov: number;
}

export const DEFAULT_CAMERA: Camera = {
  yaw: 0.26,
  pitch: -0.09,
  distance: 3.4,
  fov: 0.62,
};

/**
 * Square reads as a voxel surface — neighbouring cells meet edge to edge and the lattice becomes
 * visible as structure. Round particles always read as scattered dots however densely packed.
 */
export type ParticleShape = "square" | "disc";

export interface RenderStyle {
  /** Particle fill, as CSS colour for the 2D backend. */
  color: string;
  shape: ParticleShape;
  /** Particle radius in pixels at the reference size, scaled with rendered size. */
  particleScale: number;
  /**
   * How much back-facing particles are dimmed. Back-facing particles are dimmed rather than
   * culled — culling costs the density that makes the head read as a volume, but leaving them
   * at full strength mushes front and back together into a flat blob.
   */
  backfaceDim: number;
  /** How much depth darkens a particle, 0 for none. */
  depthDim: number;
  /**
   * Extra draw-size emphasis for feature regions as the rendered size shrinks. 0 keeps features
   * at their base scale everywhere; higher values make eyes/brows/mouth proportionally chunkier
   * on tiny heads — the favicon principle. Applied on top of the per-region draw scale.
   */
  featureBoost: number;
  /**
   * Strength of the directional key light, 0..1. At 0 particles are flat; at 1 brightness is
   * fully Lambertian against a fixed upper-front key. Lighting is what turns the point cloud
   * into a sculpted head: sockets fall dark, the nose bridge and cheekbones catch light.
   */
  lighting: number;
}

export const DEFAULT_STYLE: RenderStyle = {
  color: "#ffffff",
  shape: "square",
  particleScale: 1,
  // High: particles on the far side of the head must not paint over the face.
  backfaceDim: 0.88,
  depthDim: 0.35,
  featureBoost: 0,
  lighting: 0.95,
};

export interface RenderFrame {
  pointSet: HeadPointSet;
  /** How many particles of the progressive ordering to draw. */
  count: number;
  camera: Camera;
  style: RenderStyle;
}

/**
 * Backend-agnostic renderer contract. The Canvas 2D implementation satisfies it now; the WebGL2
 * instanced-quad renderer will satisfy the same interface, so swapping backends is a factory
 * change and nothing else.
 */
export interface HeadRenderer {
  /** Sets the CSS pixel size and device pixel ratio. Safe to call repeatedly. */
  resize(pixelSize: number, dpr: number): void;
  draw(frame: RenderFrame): void;
  dispose(): void;
}
