import { EXPRESSION_KEYS, type ExpressionKey } from "../../expression.js";
import { REGION, REGION_COUNT } from "../../regions.js";

/**
 * Shaders as tagged template literals — no bundler plugin, so consumer build config stays at
 * zero.
 *
 * The vertex shader carries the whole per-particle pipeline: rotate, project, cull, size and
 * shade. That is the point of the GPU path — the Canvas 2D fallback does this work per particle
 * on the CPU and additionally has to depth-sort every frame, whereas here the depth buffer sorts
 * for free and the CPU writes only a handful of uniforms.
 *
 * `#version` must be the very first characters of the source, hence the leading `.trimStart()`
 * at the call sites' expense being avoided by building the string without indentation.
 */

const glsl = (strings: TemplateStringsArray, ...values: unknown[]): string =>
  strings.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), "");

const expressionIndex = (key: ExpressionKey): number => EXPRESSION_KEYS.indexOf(key);

export const VERTEX_SHADER = glsl`#version 300 es
precision highp float;

// Non-instanced: the four corners of the billboard quad, in -1..1.
in vec2 a_corner;

// Per-instance particle attributes.
in vec3 a_position;
in vec3 a_normal;
in float a_region;
in float a_weight;
in float a_occlusion;

// Camera.
uniform mat3 u_rot;
uniform vec3 u_center;
uniform float u_distance;
uniform float u_fitScale;
uniform float u_boundRadius;
uniform float u_expressionScale;
uniform vec2 u_viewportPx;

// Shading, all derived on the CPU by deriveShading() so both backends agree exactly.
uniform float u_baseRadius;
uniform float u_featureEmphasis;
uniform float u_glyphMode;
uniform float u_faceOnly;
uniform float u_skinRadius;
uniform float u_particleCoreContrast;
uniform float u_lighting;
uniform float u_albedoFlatten;
uniform float u_featureAlbedoScale;
uniform float u_backfaceDim;
uniform float u_depthDim;
uniform vec3 u_light;
uniform vec3 u_fillLight;
uniform float u_fillStrength;
uniform float u_ambient;
uniform float u_occlusionFloor;

// Continuous motion. Amplitudes are in nominal particle-spacing units. Phase is integrated on
// the CPU so blending a speed cannot multiply the page's entire elapsed time and jump.
uniform float u_breathPhase;
uniform float u_wavePhase;
uniform float u_jitterPhase;
uniform float u_shimmerPhase;
uniform float u_cellSize;
uniform float u_breathAmplitude;
uniform float u_outwardAmplitude;
uniform float u_waveAmplitude;
uniform float u_waveScale;
uniform float u_jitterAmplitude;
uniform float u_brightnessBias;
uniform float u_shimmerAmplitude;
uniform float u_shimmerScale;
uniform float u_shimmerHarmonic;
// Direction the shimmer band travels along, in object space. Raised to a uniform so states
// can point the sweep deliberately — reading uses (1, 0, 0) for a horizontal scan.
uniform vec3 u_shimmerDir;
uniform float u_shimmerRadial;
uniform float u_shimmerMirror;

// Packed in EXPRESSION_KEYS order. One array upload carries the complete facial control vector.
uniform float u_expression[${EXPRESSION_KEYS.length}];
uniform vec3 u_regionCenter[${REGION_COUNT}];
uniform vec3 u_regionHalfExtent[${REGION_COUNT}];

// Per-region tables, indexed by the particle's region tag.
uniform float u_regionIntensity[${REGION_COUNT}];
uniform float u_regionDrawScale[${REGION_COUNT}];
uniform float u_regionFeature[${REGION_COUNT}];

out vec2 v_corner;
out float v_radiance;
out float v_opacity;
out float v_radiusPx;

const float PHI = 1.6180339887;
const float SQRT2 = 1.4142135624;

float clampUnit(float value) {
  return clamp(value, 0.0, 1.0);
}

float clampSigned(float value) {
  return clamp(value, -1.0, 1.0);
}

/**
 * Analytic facial deformation. This mirrors deformExpressionPoint() in expression.ts; motion is
 * applied afterwards from the immutable rest-space phase seed.
 */
float regionInfluence(
  vec3 rest,
  int region,
  float rawWeight,
  int target,
  float expansion,
  float haloStrength
) {
  vec3 extent = max(u_regionHalfExtent[target] * expansion, vec3(1e-6));
  float distance = length((rest - u_regionCenter[target]) / extent);
  float halo = clampUnit((1.65 - distance) / 0.8);
  float core = region == target ? clampUnit(rawWeight) : 0.0;
  return max(core, halo * halo * haloStrength);
}

void deformExpression(inout vec3 p, inout vec3 n, int region, float rawWeight) {
  vec3 rest = p;
  float scale = max(u_boundRadius, 0.0) * u_expressionScale;
  if (scale == 0.0) return;

  for (int brow = 0; brow < 2; brow++) {
    int target = brow == 0 ? ${REGION.browL} : ${REGION.browR};
    bool left = target == ${REGION.browL};
    float side = left ? 1.0 : -1.0;
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    float localX = clampSigned((rest.x - u_regionCenter[target].x) / extent.x);
    float influence = regionInfluence(rest, region, rawWeight, target, 1.45, 0.52);
    float raise = clampSigned(
      left
        ? u_expression[${expressionIndex("brow_raiseL")}]
        : u_expression[${expressionIndex("brow_raiseR")}]
    );
    float inner = clampUnit((1.0 - side * localX) * 0.5);
    float innerUp = clampSigned(u_expression[${expressionIndex("brow_innerUp")}]);
    float furrow = clampUnit(u_expression[${expressionIndex("brow_furrow")}]);
    p.x -= side * scale * 0.038 * furrow * inner * influence;
    p.y +=
      scale * (0.058 * raise + 0.05 * innerUp * inner - 0.034 * furrow * inner) * influence;
    n.x -= side * 0.12 * furrow * inner * influence;
    n.y += 0.16 * (raise + innerUp * inner) * influence;
  }

  for (int eye = 0; eye < 2; eye++) {
    int target = eye == 0 ? ${REGION.eyeL} : ${REGION.eyeR};
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    vec3 local = clamp((rest - u_regionCenter[target]) / extent, vec3(-1.0), vec3(1.0));
    float upperLid = clampUnit(local.y * 0.5 + 0.5);
    float influence = regionInfluence(rest, region, rawWeight, target, 1.38, 0.46);
    float open = clampSigned(
      target == ${REGION.eyeL}
        ? u_expression[${expressionIndex("eye_openL")}]
        : u_expression[${expressionIndex("eye_openR")}]
    );
    bool globe = region == target && n.z > 0.35;
    float lidInfluence = globe ? 0.0 : influence;
    float gazeInfluence = globe ? max(0.72, clampUnit(rawWeight)) : influence * 0.24;
    float gazeX = clampSigned(u_expression[${expressionIndex("eye_gazeX")}]);
    float gazeY = clampSigned(u_expression[${expressionIndex("eye_gazeY")}]);
    p.x += scale * 0.042 * gazeX * gazeInfluence;
    p.y +=
      scale *
      (0.056 * open * local.y * lidInfluence +
       (0.03 + 0.016 * upperLid) * gazeY * gazeInfluence);
    p.z -= scale * 0.016 * max(0.0, -open) * lidInfluence;
    n.x += 0.08 * gazeX * gazeInfluence - 0.05 * local.x * open * lidInfluence;
    n.y += 0.12 * open * local.y * lidInfluence + 0.07 * gazeY * gazeInfluence;
  }

  {
    int target = ${REGION.cheek};
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    vec3 local = clamp((rest - u_regionCenter[target]) / extent, vec3(-1.0), vec3(1.0));
    float influence = regionInfluence(rest, region, rawWeight, target, 1.18, 0.34);
    float support = influence * clampUnit(1.0 - abs(local.y)) * clampUnit(1.0 - abs(local.z));
    float smile =
      max(
        0.0,
        (clampSigned(u_expression[${expressionIndex("mouth_cornerUpL")}]) +
         clampSigned(u_expression[${expressionIndex("mouth_cornerUpR")}])) *
          0.5
      ) *
      0.38;
    float raise = clampUnit(u_expression[${expressionIndex("cheek_raise")}]) + smile;
    p.y += scale * 0.052 * raise * support;
    p.z += scale * 0.028 * raise * support;
    n.y += 0.12 * raise * support;
    n.z += 0.08 * raise * support;
  }

  {
    int target = ${REGION.nose};
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    vec3 local = clamp((rest - u_regionCenter[target]) / extent, vec3(-1.0), vec3(1.0));
    float influence = regionInfluence(rest, region, rawWeight, target, 1.3, 0.38);
    float lower = clampUnit((1.0 - local.y) * 0.5);
    float support = influence * lower * (0.35 + 0.65 * clampUnit(1.0 - abs(local.x)));
    float scrunch = clampUnit(u_expression[${expressionIndex("nose_scrunch")}]);
    p.x += sign(local.x == 0.0 ? 1.0 : local.x) * scale * 0.018 * scrunch * support;
    p.y += scale * 0.036 * scrunch * support;
    p.z -= scale * 0.03 * scrunch * support;
    n.y += 0.1 * scrunch * support;
    n.z -= 0.08 * scrunch * support;
  }

  {
    int target = ${REGION.mouth};
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    vec3 local = clamp((rest - u_regionCenter[target]) / extent, vec3(-1.0), vec3(1.0));
    float influence = regionInfluence(rest, region, rawWeight, target, 1.42, 0.42);
    float leftMix = clampUnit(local.x * 0.5 + 0.5);
    float cornerControl = mix(
      clampSigned(u_expression[${expressionIndex("mouth_cornerUpR")}]),
      clampSigned(u_expression[${expressionIndex("mouth_cornerUpL")}]),
      leftMix
    );
    float corner = clampUnit((abs(local.x) - 0.2) / 0.8);
    float open = clampUnit(u_expression[${expressionIndex("mouth_open")}]);
    float split = local.y == 0.0 ? -1.0 : sign(local.y);
    float pucker = clampUnit(u_expression[${expressionIndex("mouth_pucker")}]);
    float press = clampUnit(u_expression[${expressionIndex("mouth_press")}]);
    p.x +=
      scale * (-0.046 * local.x * pucker + 0.024 * local.x * abs(cornerControl) * corner) *
      influence;
    p.y +=
      scale *
      (0.068 * cornerControl * corner + 0.052 * open * split - 0.032 * press * local.y) *
      influence;
    p.z += scale * (0.042 * pucker - 0.014 * open - 0.024 * press) * influence;
    n.y +=
      (0.18 * cornerControl * corner + 0.12 * open * split - 0.1 * press * local.y) *
      influence;
    n.z += (0.1 * pucker - 0.08 * press) * influence;
  }

  {
    int target = ${REGION.jaw};
    vec3 center = u_regionCenter[target];
    vec3 extent = max(u_regionHalfExtent[target], vec3(1e-6));
    float influence = regionInfluence(rest, region, rawWeight, target, 1.24, 0.48);
    float hingeY = center.y + extent.y;
    float attachment = influence * clampUnit((hingeY - rest.y) / (1.65 * extent.y));
    float angle =
      0.28 * u_expressionScale * clampUnit(u_expression[${expressionIndex("jaw_open")}]);
    float cosine = cos(angle);
    float sine = sin(angle);
    vec2 relative = vec2(p.y - hingeY, p.z - center.z);
    vec2 rotated =
      vec2(
        hingeY + relative.x * cosine - relative.y * sine,
        center.z + relative.x * sine + relative.y * cosine
      );
    p.x +=
      attachment * scale * 0.052 * clampSigned(u_expression[${expressionIndex("jaw_shiftX")}]);
    p.y = mix(p.y, rotated.x, attachment);
    p.z =
      mix(p.z, rotated.y, attachment) +
      attachment * scale * 0.058 * clampSigned(u_expression[${expressionIndex("jaw_forward")}]);
    vec2 rotatedNormal =
      vec2(n.y * cosine - n.z * sine, n.y * sine + n.z * cosine);
    n.yz = mix(n.yz, rotatedNormal, attachment);
  }

  n = normalize(n);
}

/**
 * Normal displacement in cell units. This is a verbatim reimplementation of
 * normalDisplacement() in motion.ts — the two backends must agree exactly, so any change to
 * one needs the same change to the other.
 */
float normalDisplacement(vec3 p) {
  float breath = sin(u_breathPhase);
  float outward = 0.5 + breath * 0.5;
  float waveA = sin((p.x + p.y * 0.6) * u_waveScale + u_wavePhase);
  float waveB = sin((p.z * PHI - p.y) * u_waveScale * 0.83 + u_wavePhase * SQRT2);
  float jitter = sin((p.x * 31.7 + p.y * 47.3 + p.z * 23.1) * 2.0 + u_jitterPhase);
  return u_breathAmplitude * breath +
         u_outwardAmplitude * outward +
         u_waveAmplitude * (waveA + waveB * 0.6) +
         u_jitterAmplitude * jitter;
}

/**
 * Brightness multiplier, centred on 1. Verbatim reimplementation of shimmerMultiplier() in
 * motion.ts — the primary carrier of "alive" perception at inline sizes, where positional
 * displacement is sub-pixel by construction (amplitudes are in cell units, and the LOD system
 * holds a cell to a near-constant on-screen size).
 */
float shimmerMultiplier(vec3 p) {
  float directional = dot(p, u_shimmerDir);
  float radial = length(p.xy);
  float radialAlong = mix(directional, radial, clamp(u_shimmerRadial, 0.0, 1.0));
  float along = mix(radialAlong, abs(radialAlong), clamp(u_shimmerMirror, 0.0, 1.0));
  float phase = along * u_shimmerScale + u_shimmerPhase;
  float band =
    (sin(phase) + u_shimmerHarmonic * sin(phase * 3.0)) /
    (1.0 + abs(u_shimmerHarmonic));
  return 1.0 + u_brightnessBias + u_shimmerAmplitude * band;
}

void main() {
  v_corner = a_corner;

  vec3 rest = a_position - u_center;
  int region = int(a_region + 0.5);
  vec3 expressed = rest;
  vec3 expressedNormal = a_normal;
  deformExpression(expressed, expressedNormal, region, a_weight);

  // Displace along the normal so the surface swells and ripples without particles leaving it.
  float disp = normalDisplacement(rest) * u_cellSize;
  vec3 p = u_rot * (expressed + expressedNormal * disp);
  float viewZ = u_distance - p.z;

  vec3 n = u_rot * expressedNormal;
  float facing = n.z;

  float isFeature = u_regionFeature[region];

  // Far-side features are culled outright rather than dimmed: a dimmed eye showing through the
  // skull reads as a smudge stuck to the silhouette. Glyph mode culls the whole far hemisphere.
  bool culled =
    viewZ <= 0.05 ||
    (isFeature > 0.5 && facing < 0.03) ||
    (u_faceOnly > 0.5 && expressed.y < -0.62 * u_boundRadius) ||
    (u_glyphMode > 0.5 && facing < -0.05);

  if (culled) {
    // No discard in a vertex shader; push the vertex outside the clip volume instead.
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    v_radiance = 0.0;
    v_opacity = 0.0;
    v_radiusPx = 1.0;
    return;
  }

  float persp = u_distance / viewZ;
  vec2 ndc = p.xy * u_fitScale * persp;

  float radiusPx =
    u_baseRadius * persp * u_regionDrawScale[region] *
    mix(u_skinRadius, u_featureEmphasis, isFeature);
  v_radiusPx = radiusPx;

  // Lambert against the key light, then baked occlusion. Lambert models which way the surface
  // faces; occlusion models what it sits inside, which is what darkens sockets and creases whose
  // floors still catch the light.
  float keyDiffuse = max(0.0, dot(n, u_light));
  float fillDiffuse = max(0.0, dot(n, u_fillLight));
  float diffuse = min(1.0, keyDiffuse + fillDiffuse * u_fillStrength);
  float lit =
    (u_ambient + (1.0 - u_ambient) * diffuse) *
    (u_occlusionFloor + (1.0 - u_occlusionFloor) * a_occlusion);
  float linearShade = 1.0 - u_lighting * (1.0 - lit);
  float shade = linearShade * (0.5 + 0.5 * linearShade);

  // Material albedo for the region; lighting and occlusion do the modelling.
  float regionAlpha = u_regionIntensity[region];
  float baseAlpha = mix(regionAlpha, 1.0, u_albedoFlatten);
  // At glyph scale broad dark landmarks carry the face configuration after thousands of surface
  // samples resolve into only a few pixels. The complete 3D surface still defines their shape.
  baseAlpha *= mix(1.0, u_featureAlbedoScale, isFeature);

  float backness = facing < 0.0 ? min(1.0, -facing) : 0.0;
  float depthT = clamp((u_boundRadius - p.z) / (2.0 * u_boundRadius), 0.0, 1.0);

  float shimmer = shimmerMultiplier(rest);

  // Light and material control radiance, never coverage. Folding them into alpha made the dark
  // eye sockets, nasal planes and jaw physically disappear, leaving a perforated face.
  v_radiance = clamp(baseAlpha * shade * shimmer, 0.0, 1.0);
  v_opacity =
    (1.0 - backness * u_backfaceDim) *
    (1.0 - depthT * clamp(u_depthDim, 0.0, 1.0));

  // Linear depth into NDC so the depth buffer resolves occlusion without any CPU sorting.
  float near = 0.05;
  float far = u_distance + u_boundRadius * 2.0;
  float ndcZ = ((viewZ - near) / (far - near)) * 2.0 - 1.0;

  // The quad is padded one pixel beyond the disc radius. Sized exactly to the radius, the
  // fragment shader can never see the outer ring of partially covered pixels that Canvas 2D
  // still paints, and the head comes out ~20% short on ink at every size.
  float quadPx = radiusPx + 1.0;
  gl_Position = vec4(ndc + a_corner * quadPx / (u_viewportPx * 0.5), ndcZ, 1.0);
}
`;

export const FRAGMENT_SHADER = glsl`#version 300 es
precision highp float;

in vec2 v_corner;
in float v_radiance;
in float v_opacity;
in float v_radiusPx;

uniform vec3 u_color;
uniform float u_square;
uniform float u_particleCoreContrast;

out vec4 fragColor;

void main() {
  // Analytic pixel coverage in real pixel units, matching how Canvas 2D antialiases a fill.
  // Expressing the falloff as a *fraction* of the radius does not work: cells are only a couple
  // of pixels across, so a fractional band eats the entire particle.
  float quadPx = v_radiusPx + 1.0;
  // Chebyshev distance gives a square, Euclidean a disc — the same coverage maths either way.
  float norm = mix(length(v_corner), max(abs(v_corner.x), abs(v_corner.y)), u_square);
  float distPx = norm * quadPx;
  float edge = clamp(v_radiusPx - distPx + 0.5, 0.0, 1.0);

  float alpha = v_opacity * edge;
  if (alpha < 0.004) discard;

  // At tiny sizes, overlapping support discs reconstruct a continuous shaded facial surface.
  // A brighter centre keeps every support disc visibly rooted in a circular particle rather than
  // collapsing into an ordinary raster silhouette. The contrast reaches zero at 64px, leaving
  // the approved larger rendering unchanged.
  float particleDistance = distPx / max(v_radiusPx, 0.001);
  float core = 1.0 - smoothstep(0.24, 0.62, particleDistance);
  float particleRadiance = v_radiance * mix(1.0 - u_particleCoreContrast, 1.0, core);

  // Premultiplied output. Shadowed particles remain opaque but dark, preserving the skin surface.
  fragColor = vec4(u_color * particleRadiance * alpha, alpha);
}
`;
