import { supabase } from "@/integrations/supabase/client";

export interface RewardTier {
  threshold: number;
  label: string;
  emoji: string;
}

export type GameId = "climb" | "bounce";

export const REWARD_TIERS: RewardTier[] = [
  { threshold: 50, label: "Free Dessert", emoji: "🍰" },
  { threshold: 120, label: "Free Garlic Bread", emoji: "🥖" },
  { threshold: 220, label: "Free Virgin Mojito", emoji: "🍹" },
  { threshold: 400, label: "10% Off Your Bill", emoji: "🎟️" },
];

export const BOUNCE_REWARD_TIERS: RewardTier[] = [
  { threshold: 80, label: "Free Dessert", emoji: "🍰" },
  { threshold: 200, label: "Free Garlic Bread", emoji: "🥖" },
  { threshold: 400, label: "Free Virgin Mojito", emoji: "🍹" },
  { threshold: 700, label: "10% Off Your Bill", emoji: "🎟️" },
];

export function tiersForGame(game: GameId): RewardTier[] {
  return game === "bounce" ? BOUNCE_REWARD_TIERS : REWARD_TIERS;
}

export function tiersUnlockedFor(score: number, game: GameId = "climb"): RewardTier[] {
  return tiersForGame(game).filter((t) => score >= t.threshold);
}

export function nextTierFor(score: number, game: GameId = "climb"): RewardTier | null {
  return tiersForGame(game).find((t) => score < t.threshold) ?? null;
}

export async function submitScore(displayName: string, score: number, customerId?: string | null) {
  await supabase.from("game_scores").insert({
    display_name: displayName.trim().slice(0, 24) || "Guest",
    score: Math.max(0, Math.floor(score)),
    customer_id: customerId ?? null,
  });
}

export async function unlockRewardsForCustomer(
  customerId: string,
  score: number,
  game: GameId = "climb",
) {
  const tiers = tiersUnlockedFor(score, game);
  if (!tiers.length) return [];
  for (const t of tiers) {
    try {
      await supabase.from("game_rewards").insert({
        customer_id: customerId,
        threshold: t.threshold,
        reward_label: t.label,
      });
    } catch { /* ignore duplicate */ }
  }
  return tiers;
}

export async function fetchLeaderboard(scope: "all" | "week" = "all") {
  let q = supabase
    .from("game_scores")
    .select("display_name, score, created_at")
    .order("score", { ascending: false })
    .limit(10);
  if (scope === "week") {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    q = q.gte("created_at", since);
  }
  const { data } = await q;
  return data ?? [];
}

export async function fetchCustomerRewards(customerId: string) {
  const { data } = await supabase
    .from("game_rewards")
    .select("*")
    .eq("customer_id", customerId)
    .order("threshold", { ascending: true });
  return data ?? [];
}

const HIGH_SCORE_KEYS: Record<GameId, string> = {
  climb: "orange_bbq_climb_high_score",
  bounce: "orange_bbq_bounce_high_score",
};
const DISPLAY_NAME_KEY = "orange_bbq_player_name";
export const TUTORIAL_KEY = "orange_bbq_climb_tutorial_v1";

export function getStoredHighScore(game: GameId = "climb"): number {
  const v = Number(localStorage.getItem(HIGH_SCORE_KEYS[game]) || 0);
  return Number.isFinite(v) ? v : 0;
}
export function setStoredHighScore(score: number, game: GameId = "climb") {
  const cur = getStoredHighScore(game);
  if (score > cur) localStorage.setItem(HIGH_SCORE_KEYS[game], String(Math.floor(score)));
}
export function getStoredName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) || "";
}
export function setStoredName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 24));
}

export function hasSeenClimbTutorial(): boolean {
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}
export function markClimbTutorialSeen() {
  localStorage.setItem(TUTORIAL_KEY, "1");
}
