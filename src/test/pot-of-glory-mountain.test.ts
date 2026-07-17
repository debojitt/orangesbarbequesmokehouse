import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import {
  GLORY_ROUTE,
  MAX_RANGE,
  POT_R,
  buildGloryPile,
  polygonGap,
  rock,
  validateRouteReach,
} from "@/components/game/potOfGloryMountain";

describe("Pot of Glory mountain route", () => {
  it("keeps every consecutive grip within hammer reach", () => {
    expect(() => validateRouteReach()).not.toThrow();
  });

  it("builds a dense occupied mountain with a summit and recovery shelves", () => {
    const terrain = buildGloryPile(200, 2500);
    expect(terrain.length).toBeGreaterThan(GLORY_ROUTE.length);

    const summit = terrain.filter((body) => (body as Matter.Body & { rockMeta?: { summit?: boolean } }).rockMeta?.summit);
    const recovery = terrain.filter((body) => (body as Matter.Body & { rockMeta?: { recovery?: boolean } }).rockMeta?.recovery);
    const support = terrain.filter((body) => (body as Matter.Body & { rockMeta?: { support?: boolean } }).rockMeta?.support);

    expect(summit).toHaveLength(1);
    expect(recovery.length).toBeGreaterThan(8);
    expect(support.length).toBeGreaterThan(20);
  });

  it("never leaves a gap wider than the hammer can bridge", () => {
    for (let index = 1; index < GLORY_ROUTE.length; index += 1) {
      const previous = GLORY_ROUTE[index - 1];
      const current = GLORY_ROUTE[index];
      const previousBody = rock(
        previous[0], previous[1], previous[2], previous[3], previous[4], index - 1,
      );
      const currentBody = rock(
        current[0], current[1], current[2], current[3], current[4], index,
      );
      const openGap = polygonGap(previousBody, currentBody);
      expect(openGap).toBeLessThanOrEqual(MAX_RANGE - POT_R);
    }
  });

  it("forms a continuous slope with no open gaps between neighboring rocks", () => {
    for (let index = 1; index < GLORY_ROUTE.length; index += 1) {
      const previous = GLORY_ROUTE[index - 1];
      const current = GLORY_ROUTE[index];
      const previousBody = rock(
        previous[0], previous[1], previous[2], previous[3], previous[4], index - 1,
      );
      const currentBody = rock(
        current[0], current[1], current[2], current[3], current[4], index,
      );
      expect(polygonGap(previousBody, currentBody)).toBe(0);
    }
  });
});
