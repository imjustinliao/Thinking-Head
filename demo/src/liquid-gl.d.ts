declare module "liquid-gl" {
  interface LiquidGlOptions {
    target: string;
    snapshot: string;
    resolution?: number;
    refraction?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    frost?: number;
    shadow?: boolean;
    specular?: boolean;
    reveal?: "fade" | "none";
    tilt?: boolean;
  }

  export default function liquidGL(options: LiquidGlOptions): unknown;
}
