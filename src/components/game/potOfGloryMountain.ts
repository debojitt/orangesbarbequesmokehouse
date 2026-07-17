import Matter from "matter-js";
import { MAX_RANGE as HAMMER_REACH } from "@/components/game/potOfGloryPhysics";

export const MAX_RANGE = HAMMER_REACH;
export const POT_R = 24;

export interface RockMeta {
  variant: number;
  summit?: boolean;
  recovery?: boolean;
  support?: boolean;
  lip?: boolean;
}

const rockOpts = (): Matter.IBodyDefinition => ({
  isStatic: true,
  friction: 1.35,
  frictionStatic: 1.7,
  restitution: 0,
  label: "terrain",
});

/** Angular tan/grey cliff chunks — continuous mountain mass, not platforms. */
export const rock = (
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  sprite: number,
  summit = false,
  recovery = false,
  support = false,
  lip = false,
) => {
  // Jagged low-poly silhouettes with climbable top lips (shallow upper edge).
  const silhouettes = [
    [
      { x: -0.5, y: 0.45 }, { x: -0.48, y: -0.05 }, { x: -0.28, y: -0.42 },
      { x: -0.05, y: -0.5 }, { x: 0.22, y: -0.48 }, { x: 0.45, y: -0.22 },
      { x: 0.5, y: 0.18 }, { x: 0.28, y: 0.5 }, { x: -0.2, y: 0.5 },
    ],
    [
      { x: -0.5, y: 0.35 }, { x: -0.42, y: -0.28 }, { x: -0.15, y: -0.5 },
      { x: 0.18, y: -0.45 }, { x: 0.42, y: -0.15 }, { x: 0.5, y: 0.3 },
      { x: 0.2, y: 0.5 }, { x: -0.25, y: 0.48 },
    ],
    [
      { x: -0.48, y: 0.4 }, { x: -0.5, y: -0.1 }, { x: -0.2, y: -0.48 },
      { x: 0.1, y: -0.5 }, { x: 0.38, y: -0.35 }, { x: 0.5, y: 0.05 },
      { x: 0.4, y: 0.45 }, { x: -0.1, y: 0.5 },
    ],
  ];
  const vertices = silhouettes[sprite % silhouettes.length].map((point) => ({
    x: point.x * w,
    y: point.y * h,
  }));
  const body = Matter.Bodies.fromVertices(x, y, [vertices], {
    ...rockOpts(),
    angle,
  }, true);
  if (!body) {
    throw new Error(`Failed to build rock collider at (${x}, ${y})`);
  }
  (body as Matter.Body & { rockMeta?: RockMeta }).rockMeta = {
    variant: sprite,
    summit,
    recovery,
    support,
    lip,
  };
  return body;
};

/**
 * One continuous mountain cliff: start on a wide bowl, then climb a
 * right-side rock wall with overlapping boulders and latchable lips.
 * Neighboring rocks always overlap (gap = 0). Rise ≤ 78px (< hammer reach).
 */
export const GLORY_ROUTE = [
  // x, dy, w, h, angle, recovery, lip
  [40, 160, 920, 200, 0, true, false],
  [160, 70, 320, 200, -0.06, true, true],
  [230, -5, 300, 190, -0.04, false, true],
  [280, -80, 290, 185, 0.05, false, true],
  [300, -155, 285, 180, -0.08, true, true],
  [270, -230, 295, 185, 0.06, false, true],
  [230, -305, 280, 175, -0.05, false, true],
  [260, -380, 300, 185, 0.07, true, true],
  [300, -455, 275, 170, -0.06, false, true],
  [270, -530, 290, 175, 0.05, false, true],
  [230, -605, 285, 170, -0.07, true, true],
  [265, -680, 295, 175, 0.04, false, true],
  [295, -755, 270, 165, -0.05, false, true],
  [260, -830, 285, 170, 0.06, true, true],
  [225, -905, 275, 165, -0.04, false, true],
  [255, -980, 290, 170, 0.05, false, true],
  [290, -1055, 265, 160, -0.06, true, true],
  [255, -1130, 280, 165, 0.04, false, true],
  [220, -1205, 275, 160, -0.05, false, true],
  [250, -1280, 290, 170, 0.05, true, true],
  [285, -1355, 260, 155, -0.04, false, true],
  [250, -1430, 275, 160, 0.06, false, true],
  [215, -1505, 270, 155, -0.05, true, true],
  [245, -1580, 285, 160, 0.04, false, true],
  [280, -1655, 255, 150, -0.05, false, true],
  [245, -1730, 270, 155, 0.05, true, true],
  [210, -1805, 265, 150, -0.04, false, true],
  [240, -1880, 280, 155, 0.05, false, true],
  [275, -1955, 250, 145, -0.05, true, true],
  [240, -2030, 265, 150, 0.04, false, true],
  [205, -2105, 260, 145, -0.04, false, true],
  [235, -2180, 275, 150, 0.05, true, true],
  [270, -2255, 245, 140, -0.04, false, true],
  [235, -2330, 260, 145, 0.04, false, true],
  [200, -2405, 255, 140, -0.03, true, true],
  [230, -2480, 300, 165, 0, true, true],
] as const;

const pointToSegmentDistance = (
  point: Matter.Vector,
  start: Matter.Vector,
  end: Matter.Vector,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
};

export const polygonGap = (a: Matter.Body, b: Matter.Body) => {
  if (Matter.Query.collides(a, [b]).length > 0) return 0;
  let minimum = Infinity;
  const compare = (points: Matter.Vector[], edges: Matter.Vector[]) => {
    for (const point of points) {
      for (let edge = 0; edge < edges.length; edge += 1) {
        minimum = Math.min(
          minimum,
          pointToSegmentDistance(point, edges[edge], edges[(edge + 1) % edges.length]),
        );
      }
    }
  };
  compare(a.vertices, b.vertices);
  compare(b.vertices, a.vertices);
  return minimum;
};

export const validateRouteReach = () => {
  const bodies = GLORY_ROUTE.map(([x, y, width, height, angle], index) =>
    rock(x, y, width, height, angle, index),
  );
  for (let index = 1; index < bodies.length; index += 1) {
    const openGap = polygonGap(bodies[index - 1], bodies[index]);
    if (openGap > MAX_RANGE - POT_R) {
      throw new Error(`Unclimbable rock gap at route feature ${index}: ${openGap.toFixed(1)}px`);
    }
  }
};

export const buildGloryPile = (sx: number, sy: number) => {
  validateRouteReach();

  const mainRoute = GLORY_ROUTE.map(([dx, dy, width, height, angle, recovery, lip], index) =>
    rock(
      sx + dx,
      sy + dy,
      width,
      height,
      angle,
      index,
      index === GLORY_ROUTE.length - 1,
      recovery,
      false,
      lip,
    ),
  );

  // Fill the mountain mass under the climb face so it reads as one cliff.
  const support: Matter.Body[] = [];
  GLORY_ROUTE.slice(1).forEach(([dx, dy, width, height], index) => {
    support.push(rock(
      sx + dx + width * 0.35,
      sy + dy + height * 0.55,
      width * 1.15,
      height * 1.2,
      0.05,
      index + 40,
      false,
      false,
      true,
      false,
    ));
    if (index % 2 === 0) {
      support.push(rock(
        sx + dx + width * 0.55,
        sy + dy + height * 1.05,
        width * 1.35,
        height * 1.4,
        -0.04,
        index + 80,
        false,
        false,
        true,
        false,
      ));
    }
  });

  return [...support, ...mainRoute];
};
