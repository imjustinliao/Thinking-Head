import {
  deformExpressionPoint,
  expressionAlbedo,
  expressionRigOf,
  STATE_EXPRESSION,
} from "./expression.js";
import type { HeadPointSet } from "./pointset.js";
import { REGION } from "./regions.js";
import { fitScale } from "./render/camera.js";
import { deriveShading } from "./render/shading.js";
import { DEFAULT_CAMERA, DEFAULT_STYLE } from "./render/types.js";
import { THINKING_HEAD_STATES, type ThinkingHeadState } from "./states.js";

const FAMILY_COUNT = 5;

export interface FacialEndpointGeometryResult {
  from: ThinkingHeadState;
  to: ThinkingHeadState;
  size: number;
  particleDiameter: number;
  primaryFamilyTravel: number;
  secondaryFamilyTravel: number;
  primaryDiameterRatio: number;
  secondaryDiameterRatio: number;
  finite: boolean;
  passed: boolean;
}

function familyOf(region: number): number {
  if (region === REGION.browL || region === REGION.browR) return 0;
  if (region === REGION.eyeL || region === REGION.eyeR) return 1;
  if (region === REGION.cheek || region === REGION.nose) return 2;
  if (region === REGION.mouth) return 3;
  if (region === REGION.jaw) return 4;
  return -1;
}

function percentile90(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * 0.9))] ?? 0;
}

/**
 * Fixed-camera, neutral-material endpoint comparison using the production deformation, optical
 * gain, perspective, and eye material. This catches visually identical faces that scalar-vector
 * distance alone cannot.
 */
export function auditFacialEndpointGeometry(
  pointSet: HeadPointSet,
  from: ThinkingHeadState,
  to: ThinkingHeadState,
  size: number,
): FacialEndpointGeometryResult {
  const safeSize = Math.max(16, Math.min(320, size));
  const rig = expressionRigOf(pointSet);
  const shading = deriveShading(
    safeSize,
    safeSize,
    pointSet.cellSize,
    DEFAULT_STYLE,
    pointSet.radius,
  );
  const screenScale =
    fitScale(pointSet.radius, { ...DEFAULT_CAMERA, yaw: 0, pitch: 0 }) *
    shading.framingScale *
    (safeSize / 2);
  const particleDiameter = shading.baseRadius * 2;
  const fromPoint = new Float32Array(6);
  const toPoint = new Float32Array(6);
  const familyTravel = Array.from({ length: FAMILY_COUNT }, () => [] as number[]);
  const fromExpression = STATE_EXPRESSION[from];
  const toExpression = STATE_EXPRESSION[to];
  let finite = true;

  for (let index = 0; index < pointSet.count; index++) {
    const region = pointSet.regionId[index];
    const family = familyOf(region);
    if (family < 0) continue;
    const offset = index * 3;
    const nx = pointSet.normals[offset];
    const ny = pointSet.normals[offset + 1];
    const nz = pointSet.normals[offset + 2];
    if (nz < 0.03) continue;
    const px = pointSet.positions[offset] - pointSet.center.x;
    const py = pointSet.positions[offset + 1] - pointSet.center.y;
    const pz = pointSet.positions[offset + 2] - pointSet.center.z;

    deformExpressionPoint(
      fromPoint,
      px,
      py,
      pz,
      nx,
      ny,
      nz,
      region,
      pointSet.weight[index],
      pointSet.radius,
      rig,
      fromExpression,
      shading.expressionScale,
    );
    deformExpressionPoint(
      toPoint,
      px,
      py,
      pz,
      nx,
      ny,
      nz,
      region,
      pointSet.weight[index],
      pointSet.radius,
      rig,
      toExpression,
      shading.expressionScale,
    );

    const fromPerspective = DEFAULT_CAMERA.distance / (DEFAULT_CAMERA.distance - fromPoint[2]);
    const toPerspective = DEFAULT_CAMERA.distance / (DEFAULT_CAMERA.distance - toPoint[2]);
    const positionTravel = Math.hypot(
      (toPoint[0] * toPerspective - fromPoint[0] * fromPerspective) * screenScale,
      (toPoint[1] * toPerspective - fromPoint[1] * fromPerspective) * screenScale,
    );
    const fromAlbedo = expressionAlbedo(0.5, px, py, nz, region, rig, fromExpression);
    const toAlbedo = expressionAlbedo(0.5, px, py, nz, region, rig, toExpression);
    const materialTravel = Math.abs(toAlbedo - fromAlbedo) * particleDiameter;
    const travel = Math.max(positionTravel, materialTravel);
    finite &&= Number.isFinite(travel);
    familyTravel[family].push(travel);
  }

  const ranked = familyTravel.map(percentile90).sort((a, b) => b - a);
  const primaryFamilyTravel = ranked[0] ?? 0;
  const secondaryFamilyTravel = ranked[1] ?? 0;
  const primaryDiameterRatio = primaryFamilyTravel / Math.max(particleDiameter, 1e-6);
  const secondaryDiameterRatio = secondaryFamilyTravel / Math.max(particleDiameter, 1e-6);
  const minimumPrimary = safeSize <= 32 ? 0.2 : safeSize <= 64 ? 0.25 : 0.45;
  const minimumSecondary = safeSize <= 32 ? 0.12 : safeSize <= 64 ? 0.15 : 0.2;

  return {
    from,
    to,
    size: safeSize,
    particleDiameter,
    primaryFamilyTravel,
    secondaryFamilyTravel,
    primaryDiameterRatio,
    secondaryDiameterRatio,
    finite,
    passed:
      finite &&
      primaryDiameterRatio >= minimumPrimary &&
      secondaryDiameterRatio >= minimumSecondary,
  };
}

export function auditAllFacialEndpointGeometry(
  pointSet: HeadPointSet,
  size: number,
): FacialEndpointGeometryResult[] {
  const results: FacialEndpointGeometryResult[] = [];
  for (let sourceIndex = 0; sourceIndex < THINKING_HEAD_STATES.length; sourceIndex++) {
    for (
      let targetIndex = sourceIndex + 1;
      targetIndex < THINKING_HEAD_STATES.length;
      targetIndex++
    ) {
      results.push(
        auditFacialEndpointGeometry(
          pointSet,
          THINKING_HEAD_STATES[sourceIndex],
          THINKING_HEAD_STATES[targetIndex],
          size,
        ),
      );
    }
  }
  return results;
}
