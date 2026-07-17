import type Matter from "matter-js";

/** Match PotOfGlory pot/gravity so force budgets stay climbable. */
export const POT_DENSITY = 0.0036;
export const POT_RADIUS = 24;
export const GRAVITY_Y = 1.05;
export const GRAVITY_SCALE = 0.001;
export const BODY_MAX_SPEED = 14;
export const HAMMER_MAX_SPEED = 28;
export const MAX_RANGE = 132;

export const estimatedPotMass = () => POT_DENSITY * Math.PI * POT_RADIUS * POT_RADIUS;
export const potGravityForce = () => estimatedPotMass() * GRAVITY_Y * GRAVITY_SCALE;

/**
 * Planted yank must beat gravity with headroom so casual swipes still lift.
 * F_max ≈ 3.2 × weight → readable climbs without rocket launches.
 */
export const MAX_ANCHOR_FORCE = potGravityForce() * 3.2;
export const MAX_POGO_FORCE = potGravityForce() * 2.8;
export const MAX_SWING_FORCE = potGravityForce() * 1.6;

/** Spring-damper gains (per fixed 60 Hz step). */
const SPRING_GAIN = 0.00048;
const DAMPING_GAIN = 0.00014;
const LIP_GAIN = 0.00062;
/** Action-reaction from swinging the hammer mass (air + planted). */
const SWING_GAIN = 0.000055;
const SWING_PLANTED_MULT = 1.85;
/** Closing-speed → bounce impulse along outward normal. */
const POGO_GAIN = 0.00095;

export const clampAimOffset = (
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  maxRange: number,
) => {
  let x = screenX - width / 2;
  let y = screenY - height / 2;
  const distance = Math.hypot(x, y);
  if (distance > maxRange && distance > 0) {
    x = (x / distance) * maxRange;
    y = (y / distance) * maxRange;
  }
  return { x, y, distance: Math.min(distance, maxRange) };
};

const clampForce = (x: number, y: number, max: number) => {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= max || magnitude === 0) return { x, y };
  return { x: (x / magnitude) * max, y: (y / magnitude) * max };
};

/**
 * Bounded spring-damper reaction around a planted hammer head.
 * F = k(target − position) − c(velocity), magnitude-capped.
 * target = hammer − aim  ⇒  dragging the stick opposite the plant yanks the pot.
 */
export const plantedAnchorForce = (
  pot: Pick<Matter.Body, "position" | "velocity">,
  hammerPosition: Matter.Vector,
  aim: Matter.Vector,
) => {
  const targetX = hammerPosition.x - aim.x;
  const targetY = hammerPosition.y - aim.y;
  const x = (targetX - pot.position.x) * SPRING_GAIN - pot.velocity.x * DAMPING_GAIN;
  const y = (targetY - pot.position.y) * SPRING_GAIN - pot.velocity.y * DAMPING_GAIN;
  return clampForce(x, y, MAX_ANCHOR_FORCE);
};

/**
 * Lip climb: drag into / down a wall while planted → push along outward normal.
 * Composes spring + lip before a single clamp so vertical scrapes keep upward lift.
 */
export const lipClimbForce = (
  pot: Pick<Matter.Body, "position" | "velocity">,
  hammerPosition: Matter.Vector,
  aim: Matter.Vector,
  outwardNormal: Matter.Vector | null,
) => {
  const targetX = hammerPosition.x - aim.x;
  const targetY = hammerPosition.y - aim.y;
  let x = (targetX - pot.position.x) * SPRING_GAIN - pot.velocity.x * DAMPING_GAIN;
  let y = (targetY - pot.position.y) * SPRING_GAIN - pot.velocity.y * DAMPING_GAIN;

  if (!outwardNormal) return clampForce(x, y, MAX_ANCHOR_FORCE);

  const nx = outwardNormal.x;
  const ny = outwardNormal.y;
  const intoSurface = -(aim.x * nx + aim.y * ny);
  const downward = Math.max(0, aim.y);
  const engage = Math.max(intoSurface, downward * 0.7);
  if (engage <= 6) return clampForce(x, y, MAX_ANCHOR_FORCE);

  x += nx * engage * LIP_GAIN;
  y += ny * engage * LIP_GAIN;
  const verticalLip = Math.abs(nx) > Math.abs(ny) * 0.55 && downward > 6;
  if (verticalLip) {
    y -= engage * LIP_GAIN * 1.15;
  }

  const magnitude = Math.hypot(x, y);
  if (magnitude <= MAX_ANCHOR_FORCE || magnitude === 0) return { x, y };

  // When scraping a vertical lip, prioritize upward force inside the budget.
  if (verticalLip && y < 0) {
    const up = Math.min(-y, MAX_ANCHOR_FORCE);
    const remainder = Math.sqrt(Math.max(0, MAX_ANCHOR_FORCE * MAX_ANCHOR_FORCE - up * up));
    const sx = x === 0 ? 0 : Math.sign(x) * Math.min(Math.abs(x), remainder);
    return { x: sx, y: -up };
  }
  return clampForce(x, y, MAX_ANCHOR_FORCE);
};

/**
 * Swipe → torque proxy: F ∝ −Δaim.
 * Quick flicks generate a “pogo pounce”; planted swings hit harder.
 */
export const swingReactionForce = (
  aimDelta: Matter.Vector,
  planted: boolean,
) => {
  const mult = planted ? SWING_PLANTED_MULT : 1;
  return clampForce(
    -aimDelta.x * SWING_GAIN * mult,
    -aimDelta.y * SWING_GAIN * mult,
    MAX_SWING_FORCE,
  );
};

/**
 * Impact bounce: hammer slammed into rock with closing speed along −normal.
 * Launches the pot outward / slightly up so hits feel punchy, not sticky.
 */
export const pogoBounceForce = (
  closingSpeed: number,
  outwardNormal: Matter.Vector,
) => {
  if (closingSpeed < 1.2) return { x: 0, y: 0 };
  const strength = Math.min(closingSpeed, 22) * POGO_GAIN;
  return clampForce(
    outwardNormal.x * strength,
    outwardNormal.y * strength - strength * 0.35,
    MAX_POGO_FORCE,
  );
};

/** Closing speed of hammer toward rock (positive = hitting into surface). */
export const hammerClosingSpeed = (
  hammerVelocity: Matter.Vector,
  outwardNormal: Matter.Vector,
) => {
  // Velocity into the rock = −v · n_outward
  return Math.max(0, -(hammerVelocity.x * outwardNormal.x + hammerVelocity.y * outwardNormal.y));
};

export const clampBodyVelocity = (velocity: Matter.Vector, maxSpeed = BODY_MAX_SPEED) => {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= maxSpeed) return velocity;
  return {
    x: (velocity.x / speed) * maxSpeed,
    y: (velocity.y / speed) * maxSpeed,
  };
};

/** Idle hammer offset: clear of the spawn basin instead of buried in rock. */
export const idleHammerOffset = (maxRange: number) => ({
  x: maxRange * 0.58,
  y: -maxRange * 0.28,
});

/** Outward normal from hammer into free space (opposite rock). */
export const outwardNormalFromCollision = (
  collision: Matter.Collision,
  hammer: Matter.Body,
): Matter.Vector | null => {
  const n = collision.normal;
  if (!n) return null;
  if (collision.bodyA === hammer) return { x: -n.x, y: -n.y };
  if (collision.bodyB === hammer) return { x: n.x, y: n.y };
  return null;
};

/** Hammer lerp: snappy in air, slightly stickier when planted for grip feel. */
export const hammerFollowLerp = (planted: boolean) => (planted ? 0.28 : 0.42);
