import LiquidGlass from "liquid-glass-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * liquid-glass-react is built for absolutely-positioned floating panels: it
 * renders three siblings and centres itself with top/left 50% plus a -50%
 * translate. Dropping it straight into an in-flow flex row breaks the layout,
 * so it is used here as a material layer sized to the control behind the real,
 * semantic markup. Interaction stays on our own elements, which is also what
 * lets focus, press, and touch work — the library only tracks the mouse.
 */

interface Pointer {
  readonly x: number;
  readonly y: number;
}

interface GlassContext {
  readonly supported: boolean;
  readonly pointer: Pointer | null;
  readonly offset: Pointer;
}

const GlassRegionContext = createContext<GlassContext>({
  supported: false,
  pointer: null,
  offset: { x: 0, y: 0 },
});

/**
 * The library documents partial displacement support in Safari and Firefox: it
 * drops the SVG filter on Firefox and keeps only the backdrop blur, which reads
 * as a broken smear rather than glass. Those engines and anyone asking for
 * reduced transparency get an honest opaque surface instead.
 */
function useGlassSupported() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isFirefox = ua.includes("Firefox");
    const isSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
    const reduced = window.matchMedia("(prefers-reduced-transparency: reduce)");

    const update = () => setSupported(!isFirefox && !isSafari && !reduced.matches);
    update();
    reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, []);

  return supported;
}

/**
 * One shared mouse container per interactive region. Every surface inside reads
 * the same pointer, so a group of controls refracts coherently instead of each
 * one tracking the cursor on its own listener.
 */
export function GlassRegion({ children, className }: { children: ReactNode; className?: string }) {
  const region = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const [offset, setOffset] = useState<Pointer>({ x: 0, y: 0 });
  const supported = useGlassSupported();

  useEffect(() => {
    const element = region.current;
    if (!element || !supported) return;

    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      setPointer({ x: event.clientX, y: event.clientY });
      setOffset({
        x: ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 100,
        y: ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 100,
      });
    };
    const leave = () => {
      setPointer(null);
      setOffset({ x: 0, y: 0 });
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
    };
  }, [supported]);

  const value = useMemo(() => ({ supported, pointer, offset }), [supported, pointer, offset]);

  return (
    <GlassRegionContext.Provider value={value}>
      <div className={className} ref={region}>
        {children}
      </div>
    </GlassRegionContext.Provider>
  );
}

export interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  /** Matches the radius of the content it sits behind. */
  cornerRadius: number;
  mode?: "standard" | "polar" | "prominent" | "shader";
  /**
   * How long to wait for the size to settle before resizing the material. Keep
   * it short for a control that animates its own width so the glass tracks the
   * motion; keep it long where resizes only come from the viewport and the
   * mode is expensive to rebuild.
   */
  settleMs?: number;
}

export function GlassSurface({
  children,
  className,
  cornerRadius,
  mode = "standard",
  settleMs = 140,
}: GlassSurfaceProps) {
  const { supported, pointer, offset } = useContext(GlassRegionContext);
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  /*
   * The library measures itself only on mount and on window resize, so when a
   * control reflows its SVG filter region goes stale and clips the frosted
   * layer to the old box — visible as seams across the surface. Committing the
   * settled size and remounting on it keeps the filter region honest. The
   * commit is debounced so an animating control resizes the glass once when it
   * lands, rather than on every frame of the transition.
   */
  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    let settle: number;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setSize({ width, height }), settleMs);
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
    };
  }, [settleMs]);

  const showGlass = supported && size.width > 0 && size.height > 0;

  return (
    <div
      className={className ? `surface ${className}` : "surface"}
      data-surface={showGlass ? "on" : "off"}
      ref={surface}
    >
      {showGlass ? (
        <div aria-hidden="true" className="surface__material">
          <LiquidGlass
            aberrationIntensity={1.1}
            /* blurAmount is multiplied by 32 inside the library, so this is a
               ~7px frost: enough to soften the backdrop, not to hide it. */
            blurAmount={0.09}
            cornerRadius={cornerRadius}
            displacementScale={36}
            elasticity={0}
            globalMousePos={pointer ?? { x: 0, y: 0 }}
            key={`${Math.round(size.width)}x${Math.round(size.height)}`}
            mode={mode}
            mouseOffset={offset}
            padding="0"
            saturation={125}
            style={{ position: "absolute" }}
          >
            <div style={{ height: size.height, width: size.width }} />
          </LiquidGlass>
        </div>
      ) : null}

      <div className="surface__content">{children}</div>
    </div>
  );
}
