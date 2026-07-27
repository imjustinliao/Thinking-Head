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
uniform vec2 u_viewportPx;

// Shading, all derived on the CPU by deriveShading() so both backends agree exactly.
uniform float u_baseRadius;
uniform float u_featureEmphasis;
uniform float u_glyphMode;
uniform float u_skinRadius;
uniform float u_lighting;
uniform float u_albedoFlatten;
uniform float u_backfaceDim;
uniform float u_depthDim;
uniform vec3 u_light;
uniform vec3 u_fillLight;
uniform float u_fillStrength;
uniform float u_ambient;
uniform float u_occlusionFloor;

// Continuous motion. Amplitudes are in nominal particle-spacing units.
uniform float u_time;
uniform float u_cellSize;
uniform float u_breathAmplitude;
uniform float u_breathSpeed;
uniform float u_outwardAmplitude;
uniform float u_waveAmplitude;
uniform float u_waveScale;
uniform float u_waveSpeed;
uniform float u_jitterAmplitude;
uniform float u_jitterSpeed;
uniform float u_brightnessBias;
uniform float u_shimmerAmplitude;
uniform float u_shimmerScale;
uniform float u_shimmerSpeed;
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
out float v_brightness;
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
void deformExpression(inout vec3 p, inout vec3 n, int region, float rawWeight) {
  if (region == ${REGION.cranium}) return;

  vec3 center = u_regionCenter[region];
  vec3 extent = max(u_regionHalfExtent[region], vec3(1e-6));
  vec3 regionLocal = clamp((p - center) / extent, vec3(-1.0), vec3(1.0));
  float influence = clampUnit(rawWeight);
  float scale = max(u_boundRadius, 0.0);

  if (region == ${REGION.browL} || region == ${REGION.browR}) {
    bool left = region == ${REGION.browL};
    float side = left ? 1.0 : -1.0;
    float raise = clampSigned(
      left
        ? u_expression[${expressionIndex("brow_raiseL")}]
        : u_expression[${expressionIndex("brow_raiseR")}]
    );
    float inner = clampUnit((1.0 - side * regionLocal.x) * 0.5);
    float innerUp = clampSigned(u_expression[${expressionIndex("brow_innerUp")}]);
    float furrow = clampUnit(u_expression[${expressionIndex("brow_furrow")}]);
    p.x -= side * scale * 0.018 * furrow * inner * influence;
    p.y +=
      scale * (0.036 * raise + 0.028 * innerUp * inner - 0.02 * furrow * inner) * influence;
    return;
  }

  if (region == ${REGION.eyeL} || region == ${REGION.eyeR}) {
    // Preserve front-facing ocular-globe points; only the surrounding lid surface opens.
    if (n.z > 0.35) return;
    float open = clampSigned(
      region == ${REGION.eyeL}
        ? u_expression[${expressionIndex("eye_openL")}]
        : u_expression[${expressionIndex("eye_openR")}]
    );
    float upperLid = clampUnit(regionLocal.y * 0.5 + 0.5);
    float gazeY = clampSigned(u_expression[${expressionIndex("eye_gazeY")}]);
    p.x += scale * 0.025 * clampSigned(u_expression[${expressionIndex("eye_gazeX")}]) * influence;
    p.y +=
      scale *
      (0.028 * open * regionLocal.y +
       (0.016 + 0.01 * upperLid) * gazeY) *
      influence;
    return;
  }

  if (region == ${REGION.cheek}) {
    float support =
      clampUnit(1.0 - abs(regionLocal.y)) * clampUnit(1.0 - abs(regionLocal.z));
    float raise = clampUnit(u_expression[${expressionIndex("cheek_raise")}]);
    p.y += scale * 0.024 * raise * support;
    p.z += scale * 0.012 * raise * support;
    return;
  }

  if (region == ${REGION.nose}) {
    float lower = clampUnit((1.0 - regionLocal.y) * 0.5);
    float support = lower * (0.35 + 0.65 * clampUnit(1.0 - abs(regionLocal.x)));
    float scrunch = clampUnit(u_expression[${expressionIndex("nose_scrunch")}]);
    p.y += scale * 0.018 * scrunch * support;
    p.z -= scale * 0.014 * scrunch * support;
    return;
  }

  if (region == ${REGION.mouth}) {
    float leftMix = clampUnit(regionLocal.x * 0.5 + 0.5);
    float cornerControl = mix(
      clampSigned(u_expression[${expressionIndex("mouth_cornerUpR")}]),
      clampSigned(u_expression[${expressionIndex("mouth_cornerUpL")}]),
      leftMix
    );
    float corner = clampUnit(1.0 - influence);
    float open = clampUnit(u_expression[${expressionIndex("mouth_open")}]);
    float split = regionLocal.y == 0.0 ? -1.0 : sign(regionLocal.y);
    float openingSupport = 0.3 + 0.7 * influence;
    float pucker = clampUnit(u_expression[${expressionIndex("mouth_pucker")}]);
    float press = clampUnit(u_expression[${expressionIndex("mouth_press")}]);

    p.x -= regionLocal.x * scale * 0.02 * pucker * influence;
    p.y +=
      scale *
      (0.032 * cornerControl * corner +
       0.022 * open * split * openingSupport -
       0.016 * press * regionLocal.y * influence);
    p.z +=
      scale *
      (0.025 * pucker * influence - 0.008 * open * influence - 0.012 * press * influence);
    return;
  }

  if (region == ${REGION.jaw}) {
    float hingeY = center.y + extent.y;
    float hinge = clampUnit((hingeY - p.y) / (2.0 * extent.y));
    float angle = 0.22 * clampUnit(u_expression[${expressionIndex("jaw_open")}]) * hinge;
    float cosine = cos(angle);
    float sine = sin(angle);
    float relativeY = p.y - hingeY;
    float relativeZ = p.z - center.z;

    p.x += scale * 0.035 * clampSigned(u_expression[${expressionIndex("jaw_shiftX")}]) * hinge;
    p.y = hingeY + relativeY * cosine - relativeZ * sine;
    p.z =
      center.z +
      relativeY * sine +
      relativeZ * cosine +
      scale * 0.04 * clampSigned(u_expression[${expressionIndex("jaw_forward")}]) * hinge;
    n.yz = vec2(n.y * cosine - n.z * sine, n.y * sine + n.z * cosine);
  }
}

/**
 * Normal displacement in cell units. This is a verbatim reimplementation of
 * normalDisplacement() in motion.ts — the two backends must agree exactly, so any change to
 * one needs the same change to the other.
 */
float normalDisplacement(vec3 p, float t) {
  float breath = sin(t * u_breathSpeed);
  float outward = 0.5 + breath * 0.5;
  float waveA = sin((p.x + p.y * 0.6) * u_waveScale + t * u_waveSpeed);
  float waveB = sin((p.z * PHI - p.y) * u_waveScale * 0.83 + t * u_waveSpeed * SQRT2);
  float jitter = sin((p.x * 31.7 + p.y * 47.3 + p.z * 23.1) * 2.0 + t * u_jitterSpeed);
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
float shimmerMultiplier(vec3 p, float t) {
  float directional = dot(p, u_shimmerDir);
  float radial = length(p.xy);
  float radialAlong = mix(directional, radial, clamp(u_shimmerRadial, 0.0, 1.0));
  float along = mix(radialAlong, abs(radialAlong), clamp(u_shimmerMirror, 0.0, 1.0));
  float phase = along * u_shimmerScale + t * u_shimmerSpeed;
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
  float disp = normalDisplacement(rest, u_time) * u_cellSize;
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
    (u_glyphMode > 0.5 && facing < -0.05);

  if (culled) {
    // No discard in a vertex shader; push the vertex outside the clip volume instead.
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    v_brightness = 0.0;
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

  float backness = facing < 0.0 ? min(1.0, -facing) : 0.0;
  float depthT = clamp((u_boundRadius - p.z) / (2.0 * u_boundRadius), 0.0, 1.0);

  float shimmer = shimmerMultiplier(rest, u_time);

  v_brightness =
    baseAlpha * shade * shimmer *
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
in float v_brightness;
in float v_radiusPx;

uniform vec3 u_color;
uniform float u_square;

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

  // Brightness rides on alpha so a shadowed particle recedes into the background exactly as it
  // does in the Canvas 2D path.
  float alpha = v_brightness * edge;
  if (alpha < 0.004) discard;

  // Premultiplied: the drawing buffer and blend equation both expect it.
  fragColor = vec4(u_color * alpha, alpha);
}
`;
