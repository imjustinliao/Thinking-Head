import { drawScaleOf, intensityOf, isFeatureRegion } from "../regions.js";
import { cameraBasis, fitScale } from "./camera.js";
import {
  AMBIENT,
  deriveShading,
  FEATURE_FLATTEN_RATIO,
  KEY_LIGHT,
  OCCLUSION_FLOOR,
  SCULPT_UNIFORM_ALPHA,
} from "./shading.js";
import type { HeadRenderer, RenderFrame } from "./types.js";

/**
 * Canvas 2D particle renderer.
 *
 * This is the mandated fallback for environments without WebGL, and it doubles as the
 * reduced-motion path. It is also the renderer the head's proportions are tuned against, since
 * shape is a design problem that needs no GPU.
 *
 * Depth is handled properly rather than flattened: particles are painted far-to-near, sized by
 * perspective, and dimmed both by depth and by facing away from the camera. Without that the
 * front and back of the head overlap into an even disc with no volume.
 */
export function createCanvas2DRenderer(canvas: HTMLCanvasElement): HeadRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  let cssSize = 0;
  let ratio = 1;

  // Scratch buffers, grown on demand and then reused. The draw path must not allocate.
  let capacity = 0;
  let sx = new Float32Array(0);
  let sy = new Float32Array(0);
  let sr = new Float32Array(0);
  let sa = new Float32Array(0);
  let depth = new Float32Array(0);
  let order = new Int32Array(0);

  function ensureCapacity(n: number): void {
    if (n <= capacity) return;
    capacity = Math.max(n, 64);
    sx = new Float32Array(capacity);
    sy = new Float32Array(capacity);
    sr = new Float32Array(capacity);
    sa = new Float32Array(capacity);
    depth = new Float32Array(capacity);
    order = new Int32Array(capacity);
  }

  // Painter's algorithm: far particles first. Hoisted so sorting allocates no closure per frame.
  const byDepthDescending = (a: number, b: number): number => depth[b] - depth[a];

  return {
    resize(pixelSize: number, dpr: number): void {
      // DPR capped at 2: rendering at 3 costs 9x the fill of 1 for no perceptible gain at 24px.
      const cappedDpr = Math.min(dpr, 2);
      const backing = Math.max(1, Math.round(pixelSize * cappedDpr));
      if (cssSize === pixelSize && ratio === cappedDpr && canvas.width === backing) return;
      cssSize = pixelSize;
      ratio = cappedDpr;
      canvas.width = backing;
      canvas.height = backing;
      canvas.style.width = `${pixelSize}px`;
      canvas.style.height = `${pixelSize}px`;
    },

    draw(frame: RenderFrame): void {
      const { pointSet, style } = frame;
      const count = Math.min(frame.count, pointSet.count);
      const device = Math.max(1, Math.round(cssSize * ratio));

      ctx.clearRect(0, 0, device, device);
      if (count === 0 || device === 0) return;

      ensureCapacity(count);

      const b = cameraBasis(frame.camera);
      const { positions, normals, center, occlusion } = pointSet;
      const radius = pointSet.radius || 1;
      const scale = fitScale(radius, frame.camera) * (device / 2);
      const half = device / 2;

      const { baseRadius, featureEmphasis, glyphMode, glyphSkinRadius, glyphSkinAlpha, sculptT } =
        deriveShading(cssSize, device, count, style);

      const lighting = Math.max(0, Math.min(1, style.lighting));

      let visible = 0;
      for (let i = 0; i < count; i++) {
        // Centred on the measured geometry centre, so asymmetric tuning does not shift the head
        // off the canvas.
        const px = positions[i * 3] - center.x;
        const py = positions[i * 3 + 1] - center.y;
        const pz = positions[i * 3 + 2] - center.z;

        // Yaw about y, then pitch about x.
        const rx = px * b.cosYaw + pz * b.sinYaw;
        const rzYaw = -px * b.sinYaw + pz * b.cosYaw;
        const ry = py * b.cosPitch - rzYaw * b.sinPitch;
        const rz = py * b.sinPitch + rzYaw * b.cosPitch;

        const viewZ = b.distance - rz;
        if (viewZ <= 0.05) continue;

        // Facing: the rotated normal's z against the view direction.
        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        const nzYaw = -nx * b.sinYaw + nz * b.cosYaw;
        const facing = ny * b.sinPitch + nzYaw * b.cosPitch;

        const region = pointSet.regionId[i];
        const feature = isFeatureRegion(region);

        // Far-side features are culled outright, not dimmed. A dimmed eye showing through the
        // skull still reads as a smudge stuck to the silhouette; skin dots keep drawing dimmed
        // because they carry the head's sense of volume.
        if (feature && facing < 0.03) continue;
        if (glyphMode && facing < -0.05) continue;

        const persp = b.distance / viewZ;
        sx[visible] = half + rx * scale * persp;
        sy[visible] = half - ry * scale * persp;
        sr[visible] =
          baseRadius * persp * drawScaleOf(region) * (feature ? featureEmphasis : glyphSkinRadius);
        depth[visible] = rz;

        // Lambertian shade against the key light plus baked occlusion. Lambert models which way
        // the surface faces; occlusion models what it sits inside — sockets and creases go dark
        // even where their floor still catches the light. Both scale off the one lighting knob.
        const nxV = nx * b.cosYaw + nz * b.sinYaw;
        const nyV = ny * b.cosPitch - nzYaw * b.sinPitch;
        const diffuse = Math.max(0, nxV * KEY_LIGHT.x + nyV * KEY_LIGHT.y + facing * KEY_LIGHT.z);
        const ao = occlusion[i];
        const lit =
          (AMBIENT + (1 - AMBIENT) * diffuse) * (OCCLUSION_FLOOR + (1 - OCCLUSION_FLOOR) * ao);
        const shade = 1 - lighting * (1 - lit);

        // Region brightness coding fades toward uniform as sculpted mode takes over — features
        // only partway, so the eyes never vanish entirely into the sculpt.
        const regionAlpha = intensityOf(region);
        const flatten = feature ? sculptT * FEATURE_FLATTEN_RATIO : sculptT;
        const baseAlpha = regionAlpha + (SCULPT_UNIFORM_ALPHA - regionAlpha) * flatten;

        const backness = facing < 0 ? Math.min(1, -facing) : 0;
        const depthT = (b.distance - rz) / (b.distance + radius);
        const alpha =
          baseAlpha *
          shade *
          (feature ? 1 : glyphSkinAlpha) *
          (1 - backness * style.backfaceDim) *
          (1 - Math.min(1, depthT) * style.depthDim);
        sa[visible] = Math.max(0, Math.min(1, alpha));
        order[visible] = visible;
        visible++;
      }

      if (visible === 0) return;

      const slice = order.subarray(0, visible);
      slice.sort(byDepthDescending);

      ctx.fillStyle = style.color;
      let lastAlpha = -1;
      for (let k = 0; k < visible; k++) {
        const i = slice[k];
        const a = sa[i];
        // Grouping identical alphas avoids a state change per particle on dense heads.
        if (a !== lastAlpha) {
          ctx.globalAlpha = a;
          lastAlpha = a;
        }
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], sr[i], 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    dispose(): void {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
