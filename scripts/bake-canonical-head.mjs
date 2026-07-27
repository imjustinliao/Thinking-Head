import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_POINTS = 4096;
const HEAD_CROP_Y = 5.24;
const SOURCE_CENTRE_Y = 6.55;
const SOURCE_CENTRE_Z = 0.45;
const SOURCE_SCALE = 0.64;
const AO_RADIUS = 0.16;

const LANDMARK_TARGETS = [
  [0, 0.82, 0],
  [0, -0.5, 0.48],
  [0, 0.02, 0.72],
  [-0.19, 0.17, 0.52],
  [0.19, 0.17, 0.52],
  [0, -0.18, 0.58],
  [-0.17, -0.17, 0.52],
  [0.17, -0.17, 0.52],
  [-0.19, 0.28, 0.48],
  [0.19, 0.28, 0.48],
  [-0.55, 0.08, 0],
  [0.55, 0.08, 0],
  [-0.36, -0.38, 0.12],
  [0.36, -0.38, 0.12],
  [-0.18, -0.8, 0],
  [0.18, -0.8, 0],
];

function parseObj(source) {
  const vertices = [];
  const faces = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      const values = line.trim().split(/\s+/).slice(1).map(Number);
      if (values.length >= 3) vertices.push(values.slice(0, 3));
      continue;
    }
    if (line.startsWith("f ")) {
      const indices = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((token) => Number(token.split("/")[0]) - 1);
      if (indices.length >= 3) faces.push(indices);
    }
  }
  return { vertices, faces };
}

function normalisePosition([x, y, z]) {
  return [
    x * SOURCE_SCALE,
    (y - SOURCE_CENTRE_Y) * SOURCE_SCALE,
    (z - SOURCE_CENTRE_Z) * SOURCE_SCALE,
  ];
}

function normaliseVector(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function buildCandidates(vertices, faces) {
  const headFaces = faces.filter((face) =>
    face.every((index) => vertices[index][1] >= HEAD_CROP_Y),
  );
  const used = new Set(headFaces.flat());
  const accumulated = Array.from({ length: vertices.length }, () => [0, 0, 0]);

  for (const face of headFaces) {
    const a = vertices[face[0]];
    for (let i = 1; i < face.length - 1; i++) {
      const b = vertices[face[i]];
      const c = vertices[face[i + 1]];
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const abz = b[2] - a[2];
      const acx = c[0] - a[0];
      const acy = c[1] - a[1];
      const acz = c[2] - a[2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      for (const index of [face[0], face[i], face[i + 1]]) {
        accumulated[index][0] += nx;
        accumulated[index][1] += ny;
        accumulated[index][2] += nz;
      }
    }
  }

  const candidates = [];
  for (const index of used) {
    const position = normalisePosition(vertices[index]);
    const normal = normaliseVector(...accumulated[index]);
    candidates.push([...position, ...normal]);
  }

  for (const face of headFaces) {
    let x = 0;
    let y = 0;
    let z = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (const index of face) {
      const position = normalisePosition(vertices[index]);
      const normal = normaliseVector(...accumulated[index]);
      x += position[0];
      y += position[1];
      z += position[2];
      nx += normal[0];
      ny += normal[1];
      nz += normal[2];
    }
    const inverse = 1 / face.length;
    const normal = normaliseVector(nx, ny, nz);
    candidates.push([x * inverse, y * inverse, z * inverse, ...normal]);
  }

  return { candidates, headFaceCount: headFaces.length, headVertexCount: used.size };
}

function progressiveSample(candidates, count) {
  const selected = [];
  const chosen = new Uint8Array(candidates.length);
  const nearestDistance = new Float64Array(candidates.length);
  nearestDistance.fill(Number.POSITIVE_INFINITY);

  const add = (index) => {
    if (chosen[index]) return;
    chosen[index] = 1;
    selected.push(candidates[index]);
    const [x, y, z] = candidates[index];
    for (let i = 0; i < candidates.length; i++) {
      if (chosen[i]) continue;
      const point = candidates[i];
      const dx = point[0] - x;
      const dy = point[1] - y;
      const dz = point[2] - z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance[i]) nearestDistance[i] = distance;
    }
  };

  for (const [tx, ty, tz] of LANDMARK_TARGETS) {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      if (chosen[i]) continue;
      const point = candidates[i];
      const dx = point[0] - tx;
      const dy = point[1] - ty;
      const dz = point[2] - tz;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    add(best);
  }

  while (selected.length < count) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < candidates.length; i++) {
      if (chosen[i]) continue;
      const front = Math.max(0, Math.min(1, (candidates[i][2] + 0.05) / 0.7));
      const score = nearestDistance[i] * (1 + front * 0.7);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    add(best);
  }

  return selected;
}

function bakeOcclusion(points) {
  const occlusion = new Uint8Array(points.length);
  const radiusSquared = AO_RADIUS * AO_RADIUS;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let blocked = 0;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const other = points[j];
      const dx = other[0] - point[0];
      const dy = other[1] - point[1];
      const dz = other[2] - point[2];
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared <= 1e-8 || distanceSquared >= radiusSquared) continue;
      const distance = Math.sqrt(distanceSquared);
      const forward = (dx * point[3] + dy * point[4] + dz * point[5]) / distance;
      if (forward <= 0) continue;
      const falloff = 1 - distance / AO_RADIUS;
      blocked += forward * falloff * falloff;
    }
    const openness = Math.max(0.45, Math.min(1, 1 - blocked * 0.5));
    occlusion[i] = Math.round(openness * 255);
  }
  return occlusion;
}

function encodeInt16(values) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setInt16(i * 2, values[i], true);
  return Buffer.from(bytes).toString("base64");
}

function encodeInt8(values) {
  return Buffer.from(new Int8Array(values).buffer).toString("base64");
}

function chunkString(value, length = 100) {
  const chunks = [];
  for (let i = 0; i < value.length; i += length)
    chunks.push(JSON.stringify(value.slice(i, i + length)));
  return chunks.map((chunk) => `  ${chunk},`).join("\n");
}

function generatedModule(points, occlusion) {
  const positions = [];
  const normals = [];
  for (const point of points) {
    positions.push(
      Math.round(point[0] * 32767),
      Math.round(point[1] * 32767),
      Math.round(point[2] * 32767),
    );
    normals.push(
      Math.round(Math.max(-1, Math.min(1, point[3])) * 127),
      Math.round(Math.max(-1, Math.min(1, point[4])) * 127),
      Math.round(Math.max(-1, Math.min(1, point[5])) * 127),
    );
  }

  return `/**
 * Generated by scripts/bake-canonical-head.mjs.
 *
 * Quantised coordinates and normals derived from a CC0 neutral human surface. The source mesh,
 * its topology and its toolchain are deliberately absent from the runtime package.
 */
export const CANONICAL_HEAD_COUNT = ${points.length};
export const POSITION_QUANTISATION = 32767;
export const NORMAL_QUANTISATION = 127;

export const POSITION_DATA = [
${chunkString(encodeInt16(positions))}
].join("");

export const NORMAL_DATA = [
${chunkString(encodeInt8(normals))}
].join("");

export const OCCLUSION_DATA = [
${chunkString(Buffer.from(occlusion).toString("base64"))}
].join("");
`;
}

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) {
  throw new Error("Usage: node scripts/bake-canonical-head.mjs <cc0-head.obj> [output.ts]");
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg ?? `${projectRoot}/src/core/canonicalHeadData.ts`);
const source = await readFile(inputPath, "utf8");
if (!source.slice(0, 4096).toUpperCase().includes("CC0")) {
  throw new Error("Input must explicitly identify itself as CC0 in its header");
}

const { vertices, faces } = parseObj(source);
const { candidates, headFaceCount, headVertexCount } = buildCandidates(vertices, faces);
if (candidates.length < MAX_POINTS) {
  throw new Error(`Head crop produced ${candidates.length} candidates; ${MAX_POINTS} required`);
}

const points = progressiveSample(candidates, MAX_POINTS);
const occlusion = bakeOcclusion(points);
await writeFile(outputPath, generatedModule(points, occlusion));
console.log(
  `Baked ${points.length} progressive points from ${headVertexCount} vertices / ${headFaceCount} faces to ${outputPath}`,
);
