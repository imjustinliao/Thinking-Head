import { BrandMark } from "./BrandMark.js";
import { GlassRegion, GlassSurface } from "./GlassSurface.js";

/**
 * Three circular controls centred at the top. Hovering or focusing the middle
 * control expands it from the centre to reveal the name, which pushes the two
 * outer circles outward by the same distance because the row is centred.
 *
 * GitHub and X point at placeholder destinations until real URLs are supplied,
 * and use typographic marks rather than third-party logo artwork.
 */
export function SiteNav() {
  return (
    <header className="nav">
      <GlassRegion className="nav__region">
        <nav aria-label="Primary" className="nav__row">
          <GlassSurface cornerRadius={999} settleMs={16}>
            <a className="nav__control" href="https://github.com/" rel="noreferrer" target="_blank">
              <span aria-hidden="true" className="nav__glyph">
                GH
              </span>
              <span className="visually-hidden">GitHub</span>
            </a>
          </GlassSurface>

          <GlassSurface cornerRadius={999} settleMs={16}>
            <a className="nav__control nav__control--brand" href="#top">
              <BrandMark className="nav__mark" />
              <span className="nav__wordmark">Thinking TF</span>
            </a>
          </GlassSurface>

          <GlassSurface cornerRadius={999} settleMs={16}>
            <a className="nav__control" href="https://x.com/" rel="noreferrer" target="_blank">
              <span aria-hidden="true" className="nav__glyph">
                X
              </span>
              <span className="visually-hidden">X</span>
            </a>
          </GlassSurface>
        </nav>
      </GlassRegion>
    </header>
  );
}
