import { clamp, mix, smoothstep } from "./math.js";

const ATLAS_WIDTH = 128;
const ATLAS_HEIGHT = 96;
const QUANTIZATION_SCALE = 480;

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

  // Establish the adult silhouette before facial detail: a broad upper cranium, zygomatic shelf,
  // distinct mandibular angle and a chin that narrows without ending in a point.
  relief -= 0.055 * gaussian(phi, -0.72, 0.26) * smoothstep(0.22, 0.9, side);
  relief += 0.032 * gaussian(phi, -0.48, 0.16) * gaussian(side, 0.8, 0.15);
  relief -= 0.025 * bilateralPatch(theta, phi, 0.92, -0.45, 0.24, 0.27);
  relief -= 0.035 * bilateralPatch(theta, phi, 0.86, 0.16, 0.26, 0.33);
  relief -= 0.026 * gaussian(phi, 1.23, 0.2);
  relief -= 0.042 * patch(theta, phi, 0, 0.62, 0.68, 0.38);
  relief += 0.012 * patch(theta, phi, 0, -0.1, 0.7, 0.62);

  // Human eyes read as shallow horizontal openings held by lids, not circular skull cavities.
  // The narrow vertical radius is the critical distinction from the rejected atlas.
  const socketTheta = 0.36;
  const socketPhi = 0.055;
  const socketX = angularDistance(Math.abs(theta), socketTheta) / 0.155;
  const socketY = (phi - socketPhi) / 0.052;
  const socketRadius = Math.hypot(socketX, socketY);
  relief -= 0.024 * Math.exp(-0.5 * socketRadius * socketRadius);
  relief += 0.012 * Math.exp(-0.5 * ((socketRadius - 1.18) / 0.22) ** 2);
  relief += 0.013 * bilateralPatch(theta, phi, 0.36, 0.115, 0.17, 0.032);
  relief += 0.007 * bilateralPatch(theta, phi, 0.36, 0.005, 0.16, 0.027);
  relief += 0.017 * bilateralPatch(theta, phi, 0.37, 0.19, 0.19, 0.06);
  relief += 0.015 * patch(theta, phi, 0, 0.2, 0.14, 0.13);
  relief -= 0.02 * bilateralPatch(theta, phi, 0.78, 0.07, 0.25, 0.28);

  // Zygomatic and mid-face planes.
  relief += 0.034 * bilateralPatch(theta, phi, 0.55, -0.13, 0.22, 0.18);
  relief -= 0.012 * bilateralPatch(theta, phi, 0.35, -0.04, 0.18, 0.08);
  relief -= 0.018 * bilateralPatch(theta, phi, 0.31, -0.31, 0.1, 0.17);

  // Nasal bone, bridge, tip and alar wings. The bridge is a vertical chain with increasing
  // projection, while separate wings prevent the lower nose reading as one spherical bulb.
  relief += 0.024 * patch(theta, phi, 0, 0.17, 0.09, 0.17);
  relief += 0.045 * patch(theta, phi, 0, 0.035, 0.065, 0.2);
  relief += 0.075 * patch(theta, phi, 0, -0.105, 0.07, 0.15);
  relief += 0.155 * patch(theta, phi, 0, -0.22, 0.085, 0.075);
  relief += 0.042 * bilateralPatch(theta, phi, 0.14, -0.255, 0.06, 0.06);
  relief -= 0.019 * bilateralPatch(theta, phi, 0.115, -0.315, 0.043, 0.038);
  relief -= 0.014 * patch(theta, phi, 0, -0.345, 0.05, 0.07);

  // Perioral anatomy: philtrum, upper lip, mouth seam, lower lip and mentolabial sulcus.
  relief -= 0.012 * patch(theta, phi, 0, -0.385, 0.05, 0.065);
  relief += 0.026 * bilateralPatch(theta, phi, 0.07, -0.43, 0.09, 0.037);
  relief -= 0.015 * patch(theta, phi, 0, -0.468, 0.27, 0.021);
  relief += 0.034 * patch(theta, phi, 0, -0.505, 0.235, 0.04);
  relief -= 0.013 * bilateralPatch(theta, phi, 0.25, -0.47, 0.052, 0.052);
  relief -= 0.024 * patch(theta, phi, 0, -0.59, 0.23, 0.045);

  // Chin boss and the front mandibular plane.
  relief += 0.058 * patch(theta, phi, 0, -0.72, 0.3, 0.15);
  relief += 0.022 * bilateralPatch(theta, phi, 0.44, -0.56, 0.22, 0.2);

  return clamp(relief, -0.12, 0.2);
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
