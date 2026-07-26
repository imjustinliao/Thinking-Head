import { clamp, mix, smoothstep } from "./math.js";

const ATLAS_WIDTH = 96;
const ATLAS_HEIGHT = 72;
const QUANTIZATION_SCALE = 400;

function angularDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(distance, Math.PI * 2 - distance);
}

function gaussian(value: number, centre: number, spread: number): number {
  const distance = (value - centre) / spread;
  return Math.exp(-0.5 * distance * distance);
}

function angularGaussian(theta: number, centre: number, spread: number): number {
  const distance = angularDistance(theta, centre) / spread;
  return Math.exp(-0.5 * distance * distance);
}

function patch(
  theta: number,
  phi: number,
  centreTheta: number,
  centrePhi: number,
  thetaSpread: number,
  phiSpread: number,
): number {
  return angularGaussian(theta, centreTheta, thetaSpread) * gaussian(phi, centrePhi, phiSpread);
}

function bilateralPatch(
  theta: number,
  phi: number,
  centreTheta: number,
  centrePhi: number,
  thetaSpread: number,
  phiSpread: number,
): number {
  return (
    patch(theta, phi, centreTheta, centrePhi, thetaSpread, phiSpread) +
    patch(theta, phi, -centreTheta, centrePhi, thetaSpread, phiSpread)
  );
}

/**
 * Original neutral adult-head sculpt in canonical spherical coordinates.
 *
 * Broad terms establish skull and jaw planes first. Smaller landmark terms then model the
 * orbital rims, nasal chain, cheekbones, mouth and chin as relief on that coherent surface.
 * Values are quantised into the atlas below; consumers sample data, not independent primitives.
 */
function authoredRelief(theta: number, phi: number): number {
  const side = Math.abs(Math.sin(theta));
  let relief = 0;

  // Adult silhouette: high zygomatic width, a visible jaw angle and a rounded rather than
  // needle-like chin. The rear cranium is handled independently by the asymmetric base ellipsoid.
  relief -= 0.035 * gaussian(phi, -0.72, 0.3) * smoothstep(0.3, 0.95, side);
  relief += 0.04 * gaussian(phi, -0.48, 0.2) * gaussian(side, 0.78, 0.18);
  relief -= 0.032 * bilateralPatch(theta, phi, 0.92, 0.14, 0.24, 0.33);
  relief -= 0.02 * gaussian(phi, 1.25, 0.23);
  relief -= 0.035 * patch(theta, phi, 0, 0.65, 0.38, 0.42);
  relief += 0.018 * patch(theta, phi, 0, -0.12, 0.58, 0.58);

  // Supraorbital structure and temples. A raised rim wrapped around a recessed socket catches
  // light like bone around an eye instead of painting a dark circle onto a flat face.
  const socketTheta = 0.39;
  const socketPhi = 0.06;
  const socketX = angularDistance(Math.abs(theta), socketTheta) / 0.13;
  const socketY = (phi - socketPhi) / 0.09;
  const socketRadius = Math.hypot(socketX, socketY);
  relief -= 0.052 * Math.exp(-0.5 * socketRadius * socketRadius);
  relief += 0.02 * Math.exp(-0.5 * ((socketRadius - 1.25) / 0.2) ** 2);
  relief += 0.032 * bilateralPatch(theta, phi, 0.38, 0.225, 0.18, 0.07);
  relief += 0.026 * patch(theta, phi, 0, 0.22, 0.13, 0.13);
  relief -= 0.025 * bilateralPatch(theta, phi, 0.79, 0.05, 0.24, 0.3);

  // Zygomatic and mid-face planes.
  relief += 0.052 * bilateralPatch(theta, phi, 0.55, -0.14, 0.2, 0.2);
  relief -= 0.018 * bilateralPatch(theta, phi, 0.35, -0.075, 0.18, 0.11);
  relief -= 0.017 * bilateralPatch(theta, phi, 0.3, -0.32, 0.1, 0.18);

  // Nasal bone, bridge, tip and alar wings. The bridge is a vertical chain with increasing
  // projection, while separate wings prevent the lower nose reading as one spherical bulb.
  relief += 0.035 * patch(theta, phi, 0, 0.18, 0.1, 0.16);
  relief += 0.06 * patch(theta, phi, 0, 0.04, 0.07, 0.2);
  relief += 0.11 * patch(theta, phi, 0, -0.1, 0.075, 0.16);
  relief += 0.28 * patch(theta, phi, 0, -0.22, 0.09, 0.085);
  relief += 0.075 * bilateralPatch(theta, phi, 0.145, -0.255, 0.065, 0.065);
  relief -= 0.028 * bilateralPatch(theta, phi, 0.115, -0.325, 0.045, 0.04);
  relief -= 0.02 * patch(theta, phi, 0, -0.36, 0.05, 0.08);

  // Perioral anatomy: philtrum, upper lip, mouth seam, lower lip and mentolabial sulcus.
  relief -= 0.018 * patch(theta, phi, 0, -0.39, 0.055, 0.07);
  relief += 0.055 * bilateralPatch(theta, phi, 0.075, -0.435, 0.09, 0.045);
  relief -= 0.025 * patch(theta, phi, 0, -0.475, 0.26, 0.025);
  relief += 0.075 * patch(theta, phi, 0, -0.515, 0.24, 0.05);
  relief -= 0.018 * bilateralPatch(theta, phi, 0.25, -0.475, 0.055, 0.06);
  relief -= 0.032 * patch(theta, phi, 0, -0.615, 0.24, 0.05);

  // Chin boss and the front mandibular plane.
  relief += 0.11 * patch(theta, phi, 0, -0.73, 0.33, 0.17);
  relief += 0.03 * bilateralPatch(theta, phi, 0.46, -0.55, 0.23, 0.21);

  return clamp(relief, -0.14, 0.31);
}

function buildAtlas(): Uint8Array {
  const result = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT);
  for (let y = 0; y < ATLAS_HEIGHT; y++) {
    const phi = (y / (ATLAS_HEIGHT - 1) - 0.5) * Math.PI;
    for (let x = 0; x < ATLAS_WIDTH; x++) {
      const theta = (x / ATLAS_WIDTH - 0.5) * Math.PI * 2;
      const value = Math.round(authoredRelief(theta, phi) * QUANTIZATION_SCALE + 128);
      result[y * ATLAS_WIDTH + x] = clamp(value, 0, 255);
    }
  }
  return result;
}

const atlas = buildAtlas();

function texel(x: number, y: number): number {
  const wrappedX = ((x % ATLAS_WIDTH) + ATLAS_WIDTH) % ATLAS_WIDTH;
  const clampedY = clamp(y, 0, ATLAS_HEIGHT - 1);
  return (atlas[clampedY * ATLAS_WIDTH + wrappedX] - 128) / QUANTIZATION_SCALE;
}

function sampleRaw(theta: number, phi: number): number {
  const u = (((theta / (Math.PI * 2) + 0.5) % 1) + 1) % 1;
  const v = clamp(phi / Math.PI + 0.5, 0, 1);
  const x = u * ATLAS_WIDTH;
  const y = v * (ATLAS_HEIGHT - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const lower = mix(texel(x0, y0), texel(x0 + 1, y0), tx);
  const upper = mix(texel(x0, y0 + 1), texel(x0 + 1, y0 + 1), tx);
  return mix(lower, upper, ty);
}

/**
 * Samples the neutral human-head relief in spherical coordinates.
 *
 * The authored atlas is mirrored at sample time so quantisation can never introduce visible
 * left/right drift in the neutral identity. Detail fades into one pole value near crown and
 * chin; without that convergence a rectangular map develops a pinched seam where longitude is
 * undefined.
 */
export function sampleCanonicalRelief(theta: number, phi: number): number {
  const mirrored = (sampleRaw(theta, phi) + sampleRaw(-theta, phi)) * 0.5;
  const pole = texel(0, phi >= 0 ? ATLAS_HEIGHT - 1 : 0);
  const detail = smoothstep(0.04, 0.18, Math.cos(phi));
  return mix(pole, mirrored, detail);
}
