import { REGION_COUNT } from "../../regions.js";

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

export const VERTEX_SHADER = glsl`#version 300 es
precision highp float;

// Non-instanced: the four corners of the billboard quad, in -1..1.
in vec2 a_corner;

// Per-instance particle attributes.
in vec3 a_position;
in vec3 a_normal;
in float a_region;
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
uniform float u_glyphSkinRadius;
uniform float u_glyphSkinAlpha;
uniform float u_lighting;
uniform float u_backfaceDim;
uniform float u_depthDim;
uniform vec3 u_light;
uniform float u_ambient;
uniform float u_occlusionFloor;

// Per-region tables, indexed by the particle's region tag.
uniform float u_regionIntensity[${REGION_COUNT}];
uniform float u_regionDrawScale[${REGION_COUNT}];
uniform float u_regionFeature[${REGION_COUNT}];

out vec2 v_corner;
out float v_brightness;
out float v_radiusPx;

void main() {
  v_corner = a_corner;

  vec3 p = u_rot * (a_position - u_center);
  float viewZ = u_distance - p.z;

  vec3 n = u_rot * a_normal;
  float facing = n.z;

  int region = int(a_region + 0.5);
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
    mix(u_glyphSkinRadius, u_featureEmphasis, isFeature);
  v_radiusPx = radiusPx;

  // Lambert against the key light, then baked occlusion. Lambert models which way the surface
  // faces; occlusion models what it sits inside, which is what darkens sockets and creases whose
  // floors still catch the light.
  float diffuse = max(0.0, dot(n, u_light));
  float lit =
    (u_ambient + (1.0 - u_ambient) * diffuse) *
    (u_occlusionFloor + (1.0 - u_occlusionFloor) * a_occlusion);
  float shade = 1.0 - u_lighting * (1.0 - lit);

  // Material albedo for the region; lighting and occlusion do the modelling.
  float baseAlpha = u_regionIntensity[region];

  float backness = facing < 0.0 ? min(1.0, -facing) : 0.0;
  float depthT = (u_distance - p.z) / (u_distance + u_boundRadius);

  v_brightness =
    baseAlpha * shade *
    mix(u_glyphSkinAlpha, 1.0, isFeature) *
    (1.0 - backness * u_backfaceDim) *
    (1.0 - min(1.0, depthT) * u_depthDim);

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
