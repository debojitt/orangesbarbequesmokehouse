import { supabase } from "@/integrations/supabase/client";

const FN = "loyalty";

export const loyaltyApi = {
  createCard: async (name: string, phone: string) => {
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { action: "create_card", name, phone },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
    return data as { customer: { id: string; name: string; phone: string }; card: any };
  },

  recordVisit: async (pin: string, card_id: string) => {
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { action: "record_visit", pin, card_id },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
    return data;
  },

  claimReward: async (card_id: string, visit_number: number) => {
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { action: "claim_reward", card_id, visit_number },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
    return data;
  },

  restartCard: async (pin: string, card_id: string) => {
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { action: "restart_card", pin, card_id },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
    return data;
  },

  verifyPin: async (pin: string) => {
    const { data } = await supabase.functions.invoke(FN, {
      body: { action: "verify_pin", pin },
    });
    return !!data?.valid;
  },

  setRouletteOverride: async (pin: string, card_id: string, prize_id: string | null) => {
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { action: "set_roulette_override", pin, card_id, prize_id },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Failed");
    return data;
  },

  getNextRoulette: async (card_id: string) => {
    const { data } = await supabase.functions.invoke(FN, {
      body: { action: "get_next_roulette", card_id },
    });
    return (data?.prize_id as string | null) ?? null;
  },
};
