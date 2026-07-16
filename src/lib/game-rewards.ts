import { supabase } from "@/integrations/supabase/client";

export interface RewardTier {
  threshold: number;
  label: string;
  emoji: string;
}

export const REWARD_TIERS: RewardTier[] = [
  { threshold: 100, label: "Free Dessert", emoji: "🍰" },
  { threshold: 250, label: "Free Garlic Bread", emoji: "🥖" },
  { threshold: 500, label: "Free Virgin Mojito", emoji: "🍹" },
  { threshold: 1000, label: "10% Off Your Bill", emoji: "🎟️" },
];

export function tiersUnlockedFor(score: number): RewardTier[] {
  return REWARD_TIERS.filter((t) => score >= t.threshold);
}

export function nextTierFor(score: number): RewardTier | null {
  return REWARD_TIERS.find((t) => score < t.threshold) ?? null;
}

export async function submitScore(displayName: string, score: number, customerId?: string | null) {
  await supabase.from("game_scores").insert({
    display_name: displayName.trim().slice(0, 24) || "Guest",
    score: Math.max(0, Math.floor(score)),
    customer_id: customerId ?? null,
  });
}

export async function unlockRewardsForCustomer(customerId: string, score: number) {
  const tiers = tiersUnlockedFor(score);
  if (!tiers.length) return [];
  const rows = tiers.map((t) => ({
    customer_id: customerId,
    threshold: t.threshold,
    reward_label: t.label,
  }));
  // Best-effort upsert-like insert; conflicts on (customer_id, threshold) are ignored via onConflict ignore behavior.
  for (const row of rows) {
    await supabase.from("game_rewards").insert(row).select().maybeSingle().then(() => {}).catch(() => {});
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

const HIGH_SCORE_KEY = "orange_bbq_high_score";
const DISPLAY_NAME_KEY = "orange_bbq_player_name";

export function getStoredHighScore(): number {
  const v = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  return Number.isFinite(v) ? v : 0;
}
export function setStoredHighScore(score: number) {
  const cur = getStoredHighScore();
  if (score > cur) localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
}
export function getStoredName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) || "";
}
export function setStoredName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 24));
}
