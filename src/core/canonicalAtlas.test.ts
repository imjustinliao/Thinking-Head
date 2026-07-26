import { describe, expect, test } from "vitest";
import { sampleCanonicalRelief } from "./canonicalAtlas.js";

describe("canonical head atlas", () => {
  test("the neutral identity is bilaterally symmetric", () => {
    for (let latitude = -1.3; latitude <= 1.3; latitude += 0.13) {
      for (let longitude = 0; longitude <= Math.PI; longitude += 0.17) {
        expect(sampleCanonicalRelief(longitude, latitude)).toBeCloseTo(
          sampleCanonicalRelief(-longitude, latitude),
          10,
        );
      }
    }
  });

  test("the nose projects beyond its neighbouring facial planes", () => {
    const noseTip = sampleCanonicalRelief(0, -0.15);
    const nasalSide = sampleCanonicalRelief(0.32, -0.15);
    const cheekPlane = sampleCanonicalRelief(0.58, -0.15);
    expect(noseTip).toBeGreaterThan(nasalSide + 0.12);
    expect(noseTip).toBeGreaterThan(cheekPlane + 0.18);
  });

  test("longitude converges smoothly at the crown and chin", () => {
    for (const latitude of [-Math.PI / 2, Math.PI / 2]) {
      const pole = sampleCanonicalRelief(0, latitude);
      for (let longitude = -Math.PI; longitude <= Math.PI; longitude += 0.2) {
        expect(sampleCanonicalRelief(longitude, latitude)).toBeCloseTo(pole, 10);
      }
    }
  });
});
