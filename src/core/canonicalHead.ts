import {
  CANONICAL_HEAD_COUNT,
  NORMAL_DATA,
  NORMAL_QUANTISATION,
  OCCLUSION_DATA,
  POSITION_DATA,
  POSITION_QUANTISATION,
} from "./canonicalHeadData.js";

export interface CanonicalHead {
  positions: Float32Array;
  normals: Float32Array;
  occlusion: Float32Array;
  count: number;
}

function decodeBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodePositions(encoded: string): Float32Array {
  const bytes = decodeBytes(encoded);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const positions = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < positions.length; i++) {
    positions[i] = view.getInt16(i * 2, true) / POSITION_QUANTISATION;
  }
  return positions;
}

function decodeNormals(encoded: string): Float32Array {
  const bytes = decodeBytes(encoded);
  const quantised = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const normals = new Float32Array(quantised.length);
  for (let i = 0; i < normals.length; i++) normals[i] = quantised[i] / NORMAL_QUANTISATION;
  return normals;
}

function decodeOcclusion(encoded: string): Float32Array {
  const bytes = decodeBytes(encoded);
  const occlusion = new Float32Array(bytes.length);
  for (let i = 0; i < occlusion.length; i++) occlusion[i] = bytes[i] / 255;
  return occlusion;
}

/**
 * Progressive, topology-free neutral human surface consumed by every runtime LOD.
 *
 * The first points preserve the crown, chin, nose, eyes, mouth, brows, ears, jaw and neck.
 * Farthest-point ordering then adds globally even detail, with extra density on the face. A level
 * is therefore a prefix rather than a separately generated shape.
 */
export const CANONICAL_HEAD: Readonly<CanonicalHead> = Object.freeze({
  positions: decodePositions(POSITION_DATA),
  normals: decodeNormals(NORMAL_DATA),
  occlusion: decodeOcclusion(OCCLUSION_DATA),
  count: CANONICAL_HEAD_COUNT,
});
