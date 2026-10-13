// Loyalty edge function — handles all writes (create card, record visit, claim, restart).
// PIN-protected via ADMIN_PIN secret. Public read of cards/visits stays through RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PIN = Deno.env.get("ADMIN_PIN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const assertPin = (pin?: string) => {
  if (!ADMIN_PIN) throw new Error("ADMIN_PIN not configured");
  if (!pin || pin !== ADMIN_PIN) throw new Error("Invalid PIN");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === "create_card") {
      const { name, phone } = body as { name: string; phone: string };
      if (!name?.trim() || !phone?.trim()) return json({ error: "Name & phone required" }, 400);

      // Find or create customer
      let { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", phone.trim())
        .maybeSingle();

      if (!customer) {
        const { data: created, error } = await supabase
          .from("customers")
          .insert({ name: name.trim(), phone: phone.trim() })
          .select()
          .single();
        if (error) throw error;
        customer = created;
      } else if (customer.name !== name.trim()) {
        await supabase.from("customers").update({ name: name.trim() }).eq("id", customer.id);
        customer.name = name.trim();
      }

      // Check active card
      let { data: card } = await supabase
        .from("loyalty_cards")
        .select("*")
        .eq("customer_id", customer.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!card) {
        const expires = new Date(Date.now() + 60 * 86400000).toISOString();
        const { data: created, error } = await supabase
          .from("loyalty_cards")
          .insert({
            customer_id: customer.id,
            visit_count: 1,
            expires_at: expires,
            qr_code: customer.id,
            is_active: true,
            is_redeemed: false,
          })
          .select()
          .single();
        if (error) throw error;
        card = created;
        await supabase.from("loyalty_visits").insert({
          loyalty_card_id: card.id,
          visit_number: 1,
          reward_type: "guaranteed",
          reward_result: "welcome",
        });
        await supabase.from("customers").update({ last_visit: new Date().toISOString() }).eq("id", customer.id);
      }

      return json({ customer, card });
    }

    if (action === "record_visit") {
      const { pin, card_id } = body as { pin: string; card_id: string };
      if (pin !== (Deno.env.get("VISIT_PIN") ?? "0000")) assertPin(pin);
      if (!card_id) return json({ error: "card_id required" }, 400);

      const { data: card } = await supabase
        .from("loyalty_cards")
        .select("*")
        .eq("id", card_id)
        .maybeSingle();
      if (!card) return json({ error: "Card not found" }, 404);
      if (card.visit_count >= 7) return json({ error: "Card already complete — restart it" }, 400);

      const newCount = card.visit_count + 1;
      await supabase.from("loyalty_cards").update({
        visit_count: newCount,
        is_redeemed: false,
      }).eq("id", card.id);
      await supabase.from("customers").update({ last_visit: new Date().toISOString() }).eq("id", card.customer_id);

      // For guaranteed visits, create the visit row immediately. For roulette, let the customer trigger it.
      const { data: cfg } = await supabase
        .from("loyalty_rewards_config")
        .select("*")
        .eq("visit_number", newCount)
        .maybeSingle();

      if (cfg && cfg.reward_type === "guaranteed") {
        await supabase.from("loyalty_visits").insert({
          loyalty_card_id: card.id,
          visit_number: newCount,
          reward_type: "guaranteed",
          reward_result: cfg.rigged_result,
        });
      }

      return json({ success: true, visit_count: newCount });
    }

    if (action === "claim_reward") {
      const { card_id, visit_number } = body as { card_id: string; visit_number: number };
      if (!card_id) return json({ error: "card_id required" }, 400);

      // Mark redeemed for the current milestone
      await supabase.from("loyalty_cards").update({ is_redeemed: true }).eq("id", card_id);

      // If no visit row exists for this milestone yet (e.g., roulette), create one
      if (visit_number) {
        const { data: existing } = await supabase
          .from("loyalty_visits")
          .select("id")
          .eq("loyalty_card_id", card_id)
          .eq("visit_number", visit_number)
          .maybeSingle();
        if (!existing) {
          const { data: cfg } = await supabase
            .from("loyalty_rewards_config")
            .select("*")
            .eq("visit_number", visit_number)
            .maybeSingle();
          if (cfg) {
            // Check for per-card override (roulette only)
            let resultLabel = cfg.rigged_result;
            if (cfg.reward_type === "roulette") {
              const { data: cardRow } = await supabase
                .from("loyalty_cards")
                .select("next_roulette_prize_id")
                .eq("id", card_id)
                .maybeSingle();
              if (cardRow?.next_roulette_prize_id) {
                const { data: prize } = await supabase
                  .from("roulette_prizes")
                  .select("winning_label")
                  .eq("id", cardRow.next_roulette_prize_id)
                  .maybeSingle();
                if (prize?.winning_label) resultLabel = prize.winning_label;
                // Consume the override after use
                await supabase
                  .from("loyalty_cards")
                  .update({ next_roulette_prize_id: null })
                  .eq("id", card_id);
              }
            }
            await supabase.from("loyalty_visits").insert({
              loyalty_card_id: card_id,
              visit_number,
              reward_type: cfg.reward_type,
              reward_result: resultLabel,
            });
          }
        }
      }
      return json({ success: true });
    }

    if (action === "set_roulette_override") {
      const { pin, card_id, prize_id } = body as { pin: string; card_id: string; prize_id: string | null };
      assertPin(pin);
      if (!card_id) return json({ error: "card_id required" }, 400);
      await supabase
        .from("loyalty_cards")
        .update({ next_roulette_prize_id: prize_id || null })
        .eq("id", card_id);
      return json({ success: true });
    }

    if (action === "get_next_roulette") {
      // Public read: returns only the prize_id (used by customer wheel to rig the spin)
      const { card_id } = body as { card_id: string };
      if (!card_id) return json({ error: "card_id required" }, 400);
      const { data: cardRow } = await supabase
        .from("loyalty_cards")
        .select("next_roulette_prize_id")
        .eq("id", card_id)
        .maybeSingle();
      return json({ prize_id: cardRow?.next_roulette_prize_id || null });
    }

    if (action === "restart_card") {
      const { pin, card_id } = body as { pin: string; card_id: string };
      assertPin(pin);
      if (!card_id) return json({ error: "card_id required" }, 400);
      const expires = new Date(Date.now() + 60 * 86400000).toISOString();
      await supabase.from("loyalty_cards").update({
        visit_count: 0,
        is_active: true,
        is_redeemed: false,
        expires_at: expires,
      }).eq("id", card_id);
      await supabase.from("loyalty_visits").delete().eq("loyalty_card_id", card_id);
      return json({ success: true });
    }

    if (action === "verify_pin") {
      const { pin } = body as { pin: string };
      try { assertPin(pin); return json({ valid: true }); }
      catch { return json({ valid: false }, 401); }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.toLowerCase().includes("pin") ? 401 : 500;
    return json({ error: msg }, status);
  }
});
