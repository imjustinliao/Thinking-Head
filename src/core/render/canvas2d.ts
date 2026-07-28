import { DONE_ACCENT_COLOR, ERROR_ACCENT_COLOR } from "../accent.js";
import { deformExpressionPoint, expressionRigOf } from "../expression.js";
import {
  normalDisplacement,
  type SwayOffsets,
  shimmerMultiplier,
  swayOffsetsInto,
} from "../motion.js";
import { drawScaleOf, intensityOf, isFeatureRegion } from "../regions.js";
import { cameraBasis, fitScale } from "./camera.js";
import {
  AMBIENT,
  depthFadeOf,
  deriveShading,
  FILL_LIGHT,
  FILL_STRENGTH,
  KEY_LIGHT,
  OCCLUSION_FLOOR,
  sculptShade,
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
  const context = ctx;

  let cssSize = 0;
  let ratio = 1;

  // Scratch buffers, grown on demand and then reused. The draw path must not allocate.
  let capacity = 0;
  let sx = new Float32Array(0);
  let sy = new Float32Array(0);
  let sr = new Float32Array(0);
  let sa = new Float32Array(0);
  let sb = new Uint8Array(0);
  let depth = new Float32Array(0);
  let order = new Int32Array(0);
  const expressionPoint = new Float32Array(6);
  const sway: SwayOffsets = { yaw: 0, pitch: 0, roll: 0 };
  const colorPalette = new Array<string>(256);
  let paletteSource = "";

  function rebuildColorPalette(color: string): void {
    if (color === paletteSource) return;
    paletteSource = color;

    // Let Canvas normalise any valid CSS colour, then parse its canonical hex/rgb form. Palette
    // strings are allocated only when the style changes, never inside the animation loop.
    context.fillStyle = "#ffffff";
    context.fillStyle = color;
    const normalized = String(context.fillStyle);
    let red = 255;
    let green = 255;
    let blue = 255;

    if (normalized[0] === "#") {
      if (normalized.length === 4) {
        red = Number.parseInt(normalized[1] + normalized[1], 16);
        green = Number.parseInt(normalized[2] + normalized[2], 16);
        blue = Number.parseInt(normalized[3] + normalized[3], 16);
      } else if (normalized.length >= 7) {
        red = Number.parseInt(normalized.slice(1, 3), 16);
        green = Number.parseInt(normalized.slice(3, 5), 16);
        blue = Number.parseInt(normalized.slice(5, 7), 16);
      }
    } else {
      const channels = normalized.match(/\d+(?:\.\d+)?/g);
      if (channels && channels.length >= 3) {
        red = Number(channels[0]);
        green = Number(channels[1]);
        blue = Number(channels[2]);
      }
    }

    for (let i = 0; i < colorPalette.length; i++) {
      const light = i / 255;
      colorPalette[i] =
        `rgb(${Math.round(red * light)} ${Math.round(green * light)} ${Math.round(blue * light)})`;
    }
  }

  function ensureCapacity(n: number): void {
    if (n <= capacity) return;
    capacity = Math.max(n, 64);
    sx = new Float32Array(capacity);
    sy = new Float32Array(capacity);
    sr = new Float32Array(capacity);
    sa = new Float32Array(capacity);
    sb = new Uint8Array(capacity);
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

      const { positions, normals, center, occlusion, weight } = pointSet;
      const expressionRig = expressionRigOf(pointSet);
      // Amplitudes are in cell units, so the same motion reads identically at every LOD level.
      const cell = pointSet.cellSize;
      const radius = pointSet.radius || 1;
      const half = device / 2;

      const {
        tier,
        baseRadius,
        featureEmphasis,
        framingScale,
        expressionScale,
        glyphMode,
        faceOnly,
        skinRadius,
        particleCoreContrast,
        lightSide,
        lighting,
        albedoFlatten,
        featureAlbedoScale,
      } = deriveShading(cssSize, device, pointSet.cellSize, style, radius);
      swayOffsetsInto(sway, frame.time, frame.motion, frame.phase);
      const b = cameraBasis(
        frame.camera,
        sway.yaw * tier.poseScale,
        sway.pitch * tier.poseScale,
        sway.roll * tier.poseScale,
      );
      const scale = fitScale(radius, frame.camera) * framingScale * (device / 2);
      const keyX = KEY_LIGHT.x * lightSide;
      const keyLength = Math.hypot(keyX, KEY_LIGHT.y, KEY_LIGHT.z) || 1;
      const fillX = FILL_LIGHT.x * lightSide;
      const fillLength = Math.hypot(fillX, FILL_LIGHT.y, FILL_LIGHT.z) || 1;

      let visible = 0;
      for (let i = 0; i < count; i++) {
        // Centred on the measured geometry centre, so asymmetric tuning does not shift the head
        // off the canvas.
        const rx0 = positions[i * 3] - center.x;
        const ry0 = positions[i * 3 + 1] - center.y;
        const rz0 = positions[i * 3 + 2] - center.z;

        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        const region = pointSet.regionId[i];

        // Expression is evaluated from the immutable rest point before continuous motion. Motion
        // keeps its rest-position phase seed, so changing expression cannot make a ripple jump.
        deformExpressionPoint(
          expressionPoint,
          rx0,
          ry0,
          rz0,
          nx,
          ny,
          nz,
          region,
          weight[i],
          radius,
          expressionRig,
          frame.expression,
          expressionScale,
        );
        const ex = expressionPoint[0];
        const ey = expressionPoint[1];
        const ez = expressionPoint[2];
        const enx = expressionPoint[3];
        const eny = expressionPoint[4];
        const enz = expressionPoint[5];

        // Continuous motion: displace along the normal so the surface swells and ripples
        // without particles leaving it.
        const disp =
          normalDisplacement(rx0, ry0, rz0, frame.time, frame.motion, frame.phase) * cell;
        const px = ex + enx * disp;
        const py = ey + eny * disp;
        const pz = ez + enz * disp;

        // Yaw about y, pitch about x, then roll about the view axis.
        const rxYaw = px * b.cosYaw + pz * b.sinYaw;
        const rzYaw = -px * b.sinYaw + pz * b.cosYaw;
        const ryPitch = py * b.cosPitch - rzYaw * b.sinPitch;
        const rz = py * b.sinPitch + rzYaw * b.cosPitch;
        const rx = rxYaw * b.cosRoll - ryPitch * b.sinRoll;
        const ry = rxYaw * b.sinRoll + ryPitch * b.cosRoll;

        const viewZ = b.distance - rz;
        if (viewZ <= 0.05) continue;

        // Facing: the rotated normal's z against the view direction.
        const nzYaw = -enx * b.sinYaw + enz * b.cosYaw;
        const facing = eny * b.sinPitch + nzYaw * b.cosPitch;

        const feature = isFeatureRegion(region);

        // Far-side features are culled outright, not dimmed. A dimmed eye showing through the
        // skull still reads as a smudge stuck to the silhouette; skin dots keep drawing dimmed
        // because they carry the head's sense of volume.
        if (feature && facing < 0.03) continue;
        if (faceOnly && ey < -0.62 * radius) continue;
        if (glyphMode && facing < -0.05) continue;

        const persp = b.distance / viewZ;
        sx[visible] = half + rx * scale * persp;
        sy[visible] = half - ry * scale * persp;
        sr[visible] =
          baseRadius * persp * drawScaleOf(region) * (feature ? featureEmphasis : skinRadius);
        depth[visible] = rz;

        // Lambertian shade against the key light plus baked occlusion. Lambert models which way
        // the surface faces; occlusion models what it sits inside — sockets and creases go dark
        // even where their floor still catches the light. Both scale off the one lighting knob.
        const nxV = enx * b.cosYaw + enz * b.sinYaw;
        const nyPitch = eny * b.cosPitch - nzYaw * b.sinPitch;
        const nxRoll = nxV * b.cosRoll - nyPitch * b.sinRoll;
        const nyV = nxV * b.sinRoll + nyPitch * b.cosRoll;
        const keyDiffuse = Math.max(
          0,
          (nxRoll * keyX + nyV * KEY_LIGHT.y + facing * KEY_LIGHT.z) / keyLength,
        );
        const fillDiffuse = Math.max(
          0,
          (nxRoll * fillX + nyV * FILL_LIGHT.y + facing * FILL_LIGHT.z) / fillLength,
        );
        const diffuse = Math.min(1, keyDiffuse + fillDiffuse * FILL_STRENGTH);
        const ao = occlusion[i];
        const lit =
          (AMBIENT + (1 - AMBIENT) * diffuse) * (OCCLUSION_FLOOR + (1 - OCCLUSION_FLOOR) * ao);
        const linearShade = 1 - lighting * (1 - lit);
        const shade = sculptShade(linearShade);

        // Material albedo for the region; lighting and occlusion do the modelling.
        const regionAlpha = intensityOf(region);
        let baseAlpha = regionAlpha + (1 - regionAlpha) * albedoFlatten;
        if (feature) baseAlpha *= featureAlbedoScale;

        // Brightness ripple: the primary carrier of "alive" perception at inline sizes, where
        // positional displacement is sub-pixel by construction (see shimmerAmplitude's doc).
        const shimmer = shimmerMultiplier(rx0, ry0, rz0, frame.time, frame.motion, frame.phase);

        const backness = facing < 0 ? Math.min(1, -facing) : 0;
        // Darkness belongs in particle colour, not opacity. Keeping shadowed particles opaque
        // prevents sockets, the nose sidewall and the jaw from opening into holes.
        const radiance = Math.max(0, Math.min(1, baseAlpha * shade * shimmer));
        const opacity =
          (1 - backness * style.backfaceDim) * depthFadeOf(rz, radius, style.depthDim);
        sa[visible] = Math.max(0, Math.min(1, opacity));
        sb[visible] = Math.round(radiance * 255);
        order[visible] = visible;
        visible++;
      }

      if (visible === 0) return;

      const slice = order.subarray(0, visible);
      slice.sort(byDepthDescending);

      rebuildColorPalette(style.color);
      const square = style.shape === "square";
      let lastAlpha = -1;
      let lastBrightness = -1;
      for (let k = 0; k < visible; k++) {
        const i = slice[k];
        const a = sa[i];
        // Grouping identical alphas avoids a state change per particle on dense heads.
        if (a !== lastAlpha) {
          ctx.globalAlpha = a;
          lastAlpha = a;
        }
        const brightness = sb[i];
        const supportBrightness = Math.round(brightness * (1 - particleCoreContrast));
        if (supportBrightness !== lastBrightness) {
          ctx.fillStyle = colorPalette[supportBrightness];
          lastBrightness = supportBrightness;
        }
        if (square) {
          // fillRect avoids path construction for the optional square style.
          const s2 = sr[i] * 2;
          ctx.fillRect(sx[i] - sr[i], sy[i] - sr[i], s2, s2);
        } else {
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], sr[i], 0, Math.PI * 2);
          ctx.fill();
        }

        if (particleCoreContrast <= 0) continue;
        if (brightness !== lastBrightness) {
          ctx.fillStyle = colorPalette[brightness];
          lastBrightness = brightness;
        }
        const coreRadius = sr[i] * 0.43;
        if (square) {
          const coreSize = coreRadius * 2;
          ctx.fillRect(sx[i] - coreRadius, sy[i] - coreRadius, coreSize, coreSize);
        } else {
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], coreRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      const errorAccent = Math.max(0, Math.min(1, frame.accent?.error ?? 0));
      const doneAccent = Math.max(0, Math.min(1, frame.accent?.done ?? 0));
      if (errorAccent > 0 || doneAccent > 0) {
        ctx.globalCompositeOperation = "source-atop";
        if (errorAccent > 0) {
          ctx.globalAlpha = errorAccent;
          ctx.fillStyle = ERROR_ACCENT_COLOR;
          ctx.fillRect(0, 0, device, device);
        }
        if (doneAccent > 0) {
          ctx.globalAlpha = doneAccent;
          ctx.fillStyle = DONE_ACCENT_COLOR;
          ctx.fillRect(0, 0, device, device);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    },

    dispose(): void {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
