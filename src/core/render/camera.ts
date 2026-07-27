import type { Camera } from "./types.js";

/**
 * The camera basis for one frame, computed once and then applied per particle.
 *
 * Deliberately not a 4x4 matrix pipeline. Rotating by yaw, pitch and state-driven roll before
 * dividing by depth is the entire transform a point cloud needs. The WebGL backend builds its
 * compact mat3 from the same scalar basis.
 */
export interface CameraBasis {
  cosYaw: number;
  sinYaw: number;
  cosPitch: number;
  sinPitch: number;
  cosRoll: number;
  sinRoll: number;
  distance: number;
  /** Focal length in normalised units, from the vertical field of view. */
  focal: number;
}

const basis: CameraBasis = {
  cosYaw: 1,
  sinYaw: 0,
  cosPitch: 1,
  sinPitch: 0,
  cosRoll: 1,
  sinRoll: 0,
  distance: 1,
  focal: 1,
};

/**
 * Fills and returns a shared basis. Reused every frame — never allocates.
 *
 * Sway is folded in here rather than displacing particles: rotating the head as a rigid body
 * evaluates each axis once for the whole frame, where a per-particle equivalent would repeat
 * that work thousands of times and still not look like a head turning.
 */
export function cameraBasis(camera: Camera, swayYaw = 0, swayPitch = 0, swayRoll = 0): CameraBasis {
  basis.cosYaw = Math.cos(camera.yaw + swayYaw);
  basis.sinYaw = Math.sin(camera.yaw + swayYaw);
  basis.cosPitch = Math.cos(camera.pitch + swayPitch);
  basis.sinPitch = Math.sin(camera.pitch + swayPitch);
  basis.cosRoll = Math.cos(swayRoll);
  basis.sinRoll = Math.sin(swayRoll);
  basis.distance = camera.distance;
  basis.focal = 1 / Math.tan(camera.fov / 2);
  return basis;
}

/**
 * Scale that fits a head of the given bounding radius into the viewport at this camera, with a
 * little breathing room. Keeps the head the same visual size regardless of tuning changes to its
 * proportions, so adjusting the cranium does not also appear to zoom.
 */
export function fitScale(boundingRadius: number, camera: Camera, margin = 1.12): number {
  const focal = 1 / Math.tan(camera.fov / 2);
  return focal / (boundingRadius * margin * camera.distance);
}
