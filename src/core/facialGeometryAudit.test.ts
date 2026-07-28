import { beforeAll, describe, expect, test } from "vitest";
import { auditAllFacialEndpointGeometry } from "./facialGeometryAudit.js";
import { generateHeadLevel } from "./geometry.js";
import type { HeadPointSet } from "./pointset.js";

let compactHead: HeadPointSet;
let displayHead: HeadPointSet;

beforeAll(() => {
  compactHead = generateHeadLevel({ resolution: 48 });
  displayHead = generateHeadLevel({ resolution: 96 });
});

describe("projected facial endpoint geometry", () => {
  test("all 45 endpoint pairs move two facial families at 48px", () => {
    const results = auditAllFacialEndpointGeometry(compactHead, 48);
    expect(results).toHaveLength(45);
    expect(
      results
        .filter((result) => !result.passed)
        .map((result) => ({
          pair: `${result.from}-${result.to}`,
          primary: result.primaryDiameterRatio,
          secondary: result.secondaryDiameterRatio,
        })),
    ).toEqual([]);
  });

  test("all 45 endpoint pairs move two facial families at 96px", () => {
    const results = auditAllFacialEndpointGeometry(displayHead, 96);
    expect(results).toHaveLength(45);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  });
});
