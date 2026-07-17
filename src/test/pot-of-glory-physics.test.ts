import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import {
  BODY_MAX_SPEED,
  GRAVITY_SCALE,
  GRAVITY_Y,
  MAX_ANCHOR_FORCE,
  MAX_POGO_FORCE,
  MAX_SWING_FORCE,
  POT_DENSITY,
  POT_RADIUS,
  clampAimOffset,
  clampBodyVelocity,
  hammerClosingSpeed,
  lipClimbForce,
  plantedAnchorForce,
  pogoBounceForce,
  potGravityForce,
  swingReactionForce,
} from "@/components/game/potOfGloryPhysics";

describe("Pot of Glory control mathematics", () => {
  it("keeps plant force above pot gravity so climbs are physically possible", () => {
    expect(MAX_ANCHOR_FORCE).toBeGreaterThan(potGravityForce());
    expect(MAX_ANCHOR_FORCE).toBeGreaterThan(
      POT_DENSITY * Math.PI * POT_RADIUS * POT_RADIUS * GRAVITY_Y * GRAVITY_SCALE,
    );
  });

  it.each([
    [360, 740],
    [412, 915],
    [768, 1024],
    [1440, 900],
  ])("keeps pointer aim within reach on a %ix%i screen", (width, height) => {
    const aim = clampAimOffset(width, 0, width, height, 132);
    expect(Math.hypot(aim.x, aim.y)).toBeCloseTo(132, 8);
  });

  it("preserves precise movement close to screen center", () => {
    const aim = clampAimOffset(205, 290, 400, 600, 132);
    expect(aim.x).toBe(5);
    expect(aim.y).toBe(-10);
  });

  it("pulls the pot toward the position opposite a planted hammer", () => {
    const force = plantedAnchorForce(
      { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    );
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeLessThan(0);
    expect(Math.hypot(force.x, force.y)).toBeLessThanOrEqual(MAX_ANCHOR_FORCE);
  });

  it("damps velocity and caps unstable anchor forces", () => {
    const force = plantedAnchorForce(
      { position: { x: -1000, y: 1000 }, velocity: { x: 40, y: -40 } },
      { x: 1000, y: -1000 },
      { x: -118, y: 0 },
    );
    expect(Math.hypot(force.x, force.y)).toBeCloseTo(MAX_ANCHOR_FORCE, 8);
  });

  it("adds lip climb boost along an outward wall normal when dragging down", () => {
    const base = plantedAnchorForce(
      { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { x: 80, y: 0 },
      { x: 40, y: 90 },
    );
    const lip = lipClimbForce(
      { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { x: 80, y: 0 },
      { x: 40, y: 90 },
      { x: -1, y: 0 },
    );
    expect(lip.y).toBeLessThan(base.y);
    expect(Math.hypot(lip.x, lip.y)).toBeLessThanOrEqual(MAX_ANCHOR_FORCE + 1e-9);
  });

  it("turns a quick swipe into an opposite reaction force", () => {
    const force = swingReactionForce({ x: 40, y: -60 }, false);
    expect(force.x).toBeLessThan(0);
    expect(force.y).toBeGreaterThan(0);
    expect(Math.hypot(force.x, force.y)).toBeLessThanOrEqual(MAX_SWING_FORCE);
  });

  it("amplifies swing reaction when the hammer is planted", () => {
    const air = swingReactionForce({ x: 0, y: 50 }, false);
    const planted = swingReactionForce({ x: 0, y: 50 }, true);
    expect(Math.abs(planted.y)).toBeGreaterThan(Math.abs(air.y));
  });

  it("bounces the pot outward on a hard hammer plant", () => {
    const normal = { x: -1, y: 0 };
    const closing = hammerClosingSpeed({ x: 12, y: 0 }, normal);
    expect(closing).toBeGreaterThan(10);
    const pogo = pogoBounceForce(closing, normal);
    expect(pogo.x).toBeLessThan(0);
    expect(pogo.y).toBeLessThan(0);
    expect(Math.hypot(pogo.x, pogo.y)).toBeLessThanOrEqual(MAX_POGO_FORCE + 1e-9);
  });

  it("caps body speed without changing direction", () => {
    const velocity = clampBodyVelocity({ x: 30, y: 40 });
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(BODY_MAX_SPEED, 8);
    expect(velocity.x / velocity.y).toBeCloseTo(30 / 40, 8);
  });

  it("can lift a free pot against gravity when fully planted upward", () => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: GRAVITY_Y, scale: GRAVITY_SCALE },
    });
    const pot = Matter.Bodies.circle(0, 0, POT_RADIUS, {
      density: POT_DENSITY,
      frictionAir: 0,
      restitution: 0,
      inertia: Infinity,
    });
    Matter.Composite.add(engine.world, pot);
    const startY = pot.position.y;

    for (let step = 0; step < 90; step += 1) {
      const force = plantedAnchorForce(
        pot,
        { x: 0, y: -100 },
        { x: 0, y: 118 },
      );
      Matter.Body.applyForce(pot, pot.position, force);
      Matter.Engine.update(engine, 1000 / 60);
    }

    expect(pot.position.y).toBeLessThan(startY - 20);
    Matter.Engine.clear(engine);
  });
});
