import { EXPRESSION_KEYS, expressionRigOf } from "../../expression.js";
import { swayOffsets } from "../../motion.js";
import { drawScaleOf, intensityOf, isFeatureRegion, REGION_COUNT } from "../../regions.js";
import { cameraBasis, fitScale } from "../camera.js";
import {
  AMBIENT,
  deriveShading,
  FILL_LIGHT,
  FILL_STRENGTH,
  KEY_LIGHT,
  OCCLUSION_FLOOR,
} from "../shading.js";
import type { RenderFrame } from "../types.js";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js";

/**
 * One WebGL2 context for the entire page, shared by every head instance.
 *
 * This is not an optimisation. Browsers hard-limit live WebGL contexts — commonly 16 on desktop
 * and as few as 8 on mobile Chrome — and evict the oldest when exceeded. A chat transcript can
 * easily mount a dozen indicators, so a context per instance would start blanking earlier heads.
 *
 * The mechanism: render each instance into a single offscreen GL canvas, then blit that region
 * onto the instance's own 2D canvas with `drawImage`. Instances therefore hold cheap 2D contexts
 * and the page holds exactly one GL context, refcounted so it is released when the last head
 * unmounts.
 */

interface GLResources {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  cornerBuffer: WebGLBuffer;
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  regionBuffer: WebGLBuffer;
  weightBuffer: WebGLBuffer;
  occlusionBuffer: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export interface SharedGLRenderer {
  /** True while the context is alive and usable. False after loss, until restored. */
  readonly usable: boolean;
  /** Renders one frame at the given backing size and blits it onto the target 2D context. */
  render(
    target: CanvasRenderingContext2D,
    devicePixels: number,
    cssSize: number,
    frame: RenderFrame,
  ): void;
  /** Drops one reference. GL resources are freed when the last holder releases. */
  release(): void;
}

const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function buildResources(gl: WebGL2RenderingContext): GLResources {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }

  const vao = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const positionBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const regionBuffer = gl.createBuffer();
  const weightBuffer = gl.createBuffer();
  const occlusionBuffer = gl.createBuffer();
  if (
    !vao ||
    !cornerBuffer ||
    !positionBuffer ||
    !normalBuffer ||
    !regionBuffer ||
    !weightBuffer ||
    !occlusionBuffer
  ) {
    throw new Error("Failed to allocate GL buffers");
  }

  gl.bindVertexArray(vao);

  const bindAttrib = (
    buffer: WebGLBuffer,
    name: string,
    size: number,
    instanced: boolean,
  ): void => {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    if (instanced) gl.vertexAttribDivisor(loc, 1);
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
  bindAttrib(cornerBuffer, "a_corner", 2, false);
  bindAttrib(positionBuffer, "a_position", 3, true);
  bindAttrib(normalBuffer, "a_normal", 3, true);
  bindAttrib(regionBuffer, "a_region", 1, true);
  bindAttrib(weightBuffer, "a_weight", 1, true);
  bindAttrib(occlusionBuffer, "a_occlusion", 1, true);

  gl.bindVertexArray(null);

  const uniformNames = [
    "u_rot",
    "u_center",
    "u_distance",
    "u_fitScale",
    "u_boundRadius",
    "u_viewportPx",
    "u_baseRadius",
    "u_featureEmphasis",
    "u_glyphMode",
    "u_skinRadius",
    "u_lighting",
    "u_albedoFlatten",
    "u_backfaceDim",
    "u_depthDim",
    "u_light",
    "u_fillLight",
    "u_fillStrength",
    "u_ambient",
    "u_occlusionFloor",
    "u_color",
    "u_square",
    "u_time",
    "u_cellSize",
    "u_breathAmplitude",
    "u_breathSpeed",
    "u_outwardAmplitude",
    "u_waveAmplitude",
    "u_waveScale",
    "u_waveSpeed",
    "u_jitterAmplitude",
    "u_jitterSpeed",
    "u_brightnessBias",
    "u_shimmerAmplitude",
    "u_shimmerScale",
    "u_shimmerSpeed",
    "u_shimmerHarmonic",
    "u_shimmerDir",
    "u_shimmerRadial",
    "u_shimmerMirror",
    "u_expression[0]",
    "u_regionCenter[0]",
    "u_regionHalfExtent[0]",
    "u_regionIntensity[0]",
    "u_regionDrawScale[0]",
    "u_regionFeature[0]",
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);

  return {
    gl,
    program,
    vao,
    cornerBuffer,
    positionBuffer,
    normalBuffer,
    regionBuffer,
    weightBuffer,
    occlusionBuffer,
    uniforms,
  };
}

/** Region tables are constant for the life of the page, so they are built once. */
const REGION_INTENSITY = new Float32Array(REGION_COUNT);
const REGION_DRAW_SCALE = new Float32Array(REGION_COUNT);
const REGION_FEATURE = new Float32Array(REGION_COUNT);
for (let r = 0; r < REGION_COUNT; r++) {
  REGION_INTENSITY[r] = intensityOf(r);
  REGION_DRAW_SCALE[r] = drawScaleOf(r);
  REGION_FEATURE[r] = isFeatureRegion(r) ? 1 : 0;
}

class SharedGL implements SharedGLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private resources: GLResources | null = null;
  private refCount = 0;
  private lost = false;
  private size = 0;

  // Reused across frames — the draw path must not allocate.
  private readonly rot = new Float32Array(9);
  private readonly center = new Float32Array(3);
  private readonly light = new Float32Array(3);
  private readonly fillLight = new Float32Array(3);
  private readonly color = new Float32Array(3);
  private readonly expressionValues = new Float32Array(EXPRESSION_KEYS.length);
  /** Grown on demand for the Uint8 -> float region conversion; never reallocated per frame. */
  private regionScratch = new Float32Array(0);

  /** Identity of the currently uploaded point set, so buffers upload once per geometry. */
  private uploaded: object | null = null;
  private uploadedCount = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1;
    this.canvas.height = 1;

    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.canvas.addEventListener("webglcontextrestored", this.onRestored);

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: true,
      premultipliedAlpha: true,
      // Required: we blit with drawImage right after drawing. Without this the browser is free
      // to have cleared the drawing buffer by then, and instances blit blank frames.
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    if (!gl) {
      this.lost = true;
      return;
    }
    this.resources = buildResources(gl);
    this.configure(gl);
  }

  private configure(gl: WebGL2RenderingContext): void {
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    // Premultiplied blending, matching the premultiplied colour the fragment shader emits and
    // the `premultipliedAlpha: true` drawing buffer. Using straight-alpha blending into an
    // unpremultiplied buffer makes the compositor apply alpha a second time, which rendered the
    // whole head measurably darker than the Canvas 2D path.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Depth testing replaces the CPU depth sort the Canvas 2D path needs every frame.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.SCISSOR_TEST);
  }

  private readonly onLost = (event: Event): void => {
    // Without preventDefault the context is never eligible for restoration.
    event.preventDefault();
    this.lost = true;
    this.resources = null;
    this.uploaded = null;
  };

  private readonly onRestored = (): void => {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    if (!gl) return;
    try {
      this.resources = buildResources(gl);
      this.configure(gl);
      this.uploaded = null;
      this.lost = false;
    } catch {
      this.lost = true;
    }
  };

  get usable(): boolean {
    return !this.lost && this.resources !== null;
  }

  retain(): void {
    this.refCount++;
  }

  release(): void {
    this.refCount--;
    if (this.refCount > 0) return;
    this.dispose();
  }

  private dispose(): void {
    const res = this.resources;
    if (res) {
      const { gl } = res;
      gl.deleteProgram(res.program);
      gl.deleteVertexArray(res.vao);
      gl.deleteBuffer(res.cornerBuffer);
      gl.deleteBuffer(res.positionBuffer);
      gl.deleteBuffer(res.normalBuffer);
      gl.deleteBuffer(res.regionBuffer);
      gl.deleteBuffer(res.weightBuffer);
      gl.deleteBuffer(res.occlusionBuffer);
      // Explicit teardown rather than waiting for GC — the whole point of sharing one context is
      // to stay well clear of the browser's context limit.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.resources = null;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    shared = null;
  }

  private ensureSize(devicePixels: number): void {
    if (devicePixels <= this.size) return;
    this.size = devicePixels;
    this.canvas.width = devicePixels;
    this.canvas.height = devicePixels;
  }

  private upload(frame: RenderFrame, res: GLResources): void {
    const { gl } = res;
    const set = frame.pointSet;
    if (this.uploaded === set && this.uploadedCount === set.count) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, res.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, set.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, set.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.occlusionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, set.occlusion, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.weightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, set.weight, gl.STATIC_DRAW);

    // regionId is a Uint8Array but the attribute is a float; convert once per upload into a
    // reused buffer.
    if (this.regionScratch.length < set.count) this.regionScratch = new Float32Array(set.count);
    const regions = this.regionScratch;
    for (let i = 0; i < set.count; i++) regions[i] = set.regionId[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, res.regionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, regions.subarray(0, set.count), gl.STATIC_DRAW);

    this.uploaded = set;
    this.uploadedCount = set.count;
  }

  render(
    target: CanvasRenderingContext2D,
    devicePixels: number,
    cssSize: number,
    frame: RenderFrame,
  ): void {
    const res = this.resources;
    if (!res || this.lost) return;
    const { gl, uniforms: u } = res;

    const count = Math.min(frame.count, frame.pointSet.count);
    target.clearRect(0, 0, devicePixels, devicePixels);
    if (count === 0 || devicePixels === 0) return;

    this.ensureSize(devicePixels);
    this.upload(frame, res);

    // Viewport parked at the top of the shared canvas in image space, so the blit source rect is
    // simply (0, 0, size, size) regardless of how large the shared canvas has grown.
    const yOffset = this.canvas.height - devicePixels;
    gl.viewport(0, yOffset, devicePixels, devicePixels);
    gl.scissor(0, yOffset, devicePixels, devicePixels);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const { pointSet, style, camera, motion, expression } = frame;
    const expressionRig = expressionRigOf(pointSet);
    const sway = swayOffsets(frame.time, motion);
    const b = cameraBasis(camera, sway.yaw, sway.pitch, sway.roll);
    const boundRadius = pointSet.radius || 1;
    const shading = deriveShading(cssSize, devicePixels, pointSet.cellSize, style, boundRadius);

    const cy = b.cosYaw;
    const sy = b.sinYaw;
    const cp = b.cosPitch;
    const sp = b.sinPitch;
    const cr = b.cosRoll;
    const sr = b.sinRoll;
    // Column-major mat3 for yaw, pitch, then view-axis roll, matching Canvas 2D exactly.
    this.rot[0] = cr * cy - sr * sp * sy;
    this.rot[1] = sr * cy + cr * sp * sy;
    this.rot[2] = -cp * sy;
    this.rot[3] = -sr * cp;
    this.rot[4] = cr * cp;
    this.rot[5] = sp;
    this.rot[6] = cr * sy + sr * sp * cy;
    this.rot[7] = sr * sy - cr * sp * cy;
    this.rot[8] = cp * cy;

    this.center[0] = pointSet.center.x;
    this.center[1] = pointSet.center.y;
    this.center[2] = pointSet.center.z;

    const lightLen = Math.hypot(KEY_LIGHT.x, KEY_LIGHT.y, KEY_LIGHT.z);
    this.light[0] = KEY_LIGHT.x / lightLen;
    this.light[1] = KEY_LIGHT.y / lightLen;
    this.light[2] = KEY_LIGHT.z / lightLen;
    const fillLightLen = Math.hypot(FILL_LIGHT.x, FILL_LIGHT.y, FILL_LIGHT.z);
    this.fillLight[0] = FILL_LIGHT.x / fillLightLen;
    this.fillLight[1] = FILL_LIGHT.y / fillLightLen;
    this.fillLight[2] = FILL_LIGHT.z / fillLightLen;

    parseColor(style.color, this.color);
    for (let i = 0; i < EXPRESSION_KEYS.length; i++) {
      this.expressionValues[i] = expression[EXPRESSION_KEYS[i]];
    }

    gl.useProgram(res.program);
    gl.bindVertexArray(res.vao);

    gl.uniformMatrix3fv(u.u_rot, false, this.rot);
    gl.uniform3fv(u.u_center, this.center);
    gl.uniform1f(u.u_distance, camera.distance);
    gl.uniform1f(u.u_fitScale, fitScale(boundRadius, camera));
    gl.uniform1f(u.u_boundRadius, boundRadius);
    gl.uniform2f(u.u_viewportPx, devicePixels, devicePixels);
    gl.uniform1f(u.u_baseRadius, shading.baseRadius);
    gl.uniform1f(u.u_featureEmphasis, shading.featureEmphasis);
    gl.uniform1f(u.u_glyphMode, shading.glyphMode ? 1 : 0);
    gl.uniform1f(u.u_skinRadius, shading.skinRadius);
    gl.uniform1f(u.u_lighting, shading.lighting);
    gl.uniform1f(u.u_albedoFlatten, shading.albedoFlatten);
    gl.uniform1f(u.u_backfaceDim, style.backfaceDim);
    gl.uniform1f(u.u_depthDim, style.depthDim);
    gl.uniform3fv(u.u_light, this.light);
    gl.uniform3fv(u.u_fillLight, this.fillLight);
    gl.uniform1f(u.u_fillStrength, FILL_STRENGTH);
    gl.uniform1f(u.u_ambient, AMBIENT);
    gl.uniform1f(u.u_occlusionFloor, OCCLUSION_FLOOR);
    gl.uniform3fv(u.u_color, this.color);
    gl.uniform1f(u.u_square, style.shape === "square" ? 1 : 0);
    gl.uniform1f(u.u_time, frame.time);
    gl.uniform1f(u.u_cellSize, pointSet.cellSize);
    gl.uniform1f(u.u_breathAmplitude, motion.breathAmplitude);
    gl.uniform1f(u.u_breathSpeed, motion.breathSpeed);
    gl.uniform1f(u.u_outwardAmplitude, motion.outwardAmplitude);
    gl.uniform1f(u.u_waveAmplitude, motion.waveAmplitude);
    gl.uniform1f(u.u_waveScale, motion.waveScale);
    gl.uniform1f(u.u_waveSpeed, motion.waveSpeed);
    gl.uniform1f(u.u_jitterAmplitude, motion.jitterAmplitude);
    gl.uniform1f(u.u_jitterSpeed, motion.jitterSpeed);
    gl.uniform1f(u.u_brightnessBias, motion.brightnessBias);
    gl.uniform1f(u.u_shimmerAmplitude, motion.shimmerAmplitude);
    gl.uniform1f(u.u_shimmerScale, motion.shimmerScale);
    gl.uniform1f(u.u_shimmerSpeed, motion.shimmerSpeed);
    gl.uniform1f(u.u_shimmerHarmonic, motion.shimmerHarmonic);
    gl.uniform3f(u.u_shimmerDir, motion.shimmerDirX, motion.shimmerDirY, motion.shimmerDirZ);
    gl.uniform1f(u.u_shimmerRadial, motion.shimmerRadial);
    gl.uniform1f(u.u_shimmerMirror, motion.shimmerMirror);
    gl.uniform1fv(u["u_expression[0]"], this.expressionValues);
    gl.uniform3fv(u["u_regionCenter[0]"], expressionRig.regionCenter);
    gl.uniform3fv(u["u_regionHalfExtent[0]"], expressionRig.regionHalfExtent);
    gl.uniform1fv(u["u_regionIntensity[0]"], REGION_INTENSITY);
    gl.uniform1fv(u["u_regionDrawScale[0]"], REGION_DRAW_SCALE);
    gl.uniform1fv(u["u_regionFeature[0]"], REGION_FEATURE);

    // The progressive ordering means the first `count` instances *are* the correct lower-density
    // head — one instanced draw call, no index buffer, no per-size geometry.
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    gl.bindVertexArray(null);

    target.drawImage(
      this.canvas,
      0,
      0,
      devicePixels,
      devicePixels,
      0,
      0,
      devicePixels,
      devicePixels,
    );
  }
}

/** Parses `#rgb`/`#rrggbb` into normalised RGB. Falls back to white. */
function parseColor(css: string, out: Float32Array): void {
  let hex = css.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const value = Number.parseInt(hex, 16);
  if (hex.length !== 6 || Number.isNaN(value)) {
    out[0] = 1;
    out[1] = 1;
    out[2] = 1;
    return;
  }
  out[0] = ((value >> 16) & 255) / 255;
  out[1] = ((value >> 8) & 255) / 255;
  out[2] = (value & 255) / 255;
}

let shared: SharedGL | null = null;

/**
 * Returns the page's shared GL renderer, creating it on first use. Null when WebGL2 is
 * unavailable, so callers fall back to Canvas 2D.
 */
export function acquireSharedGL(): SharedGLRenderer | null {
  if (typeof document === "undefined") return null;
  if (!shared) {
    try {
      const instance = new SharedGL();
      if (!instance.usable) return null;
      shared = instance;
    } catch {
      return null;
    }
  }
  shared.retain();
  return shared;
}
