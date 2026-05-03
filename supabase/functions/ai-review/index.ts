import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// v2 — uses Lovable AI Gateway with Gemini fallback
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, rating } = await req.json();
    const systemPrompt = `You are INARA restaurant's customer care AI. A customer gave a ${rating}-star rating and shared feedback.
Your job: Respond empathetically, acknowledge their issue, and assure them it will be addressed.
Be warm, professional, and concise (2-3 sentences max). Don't be defensive.
If they mention specific food issues, acknowledge that specifically.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    let aiResponse = "";

    // Try Lovable AI Gateway first
    if (LOVABLE_API_KEY) {
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        });
        if (r.ok) {
          const d = await r.json();
          aiResponse = d.choices?.[0]?.message?.content || "";
        } else {
          console.error("Lovable AI failed:", r.status, await r.text());
        }
      } catch (e) {
        console.error("Lovable AI error:", e);
      }
    }

    // Fallback to direct Gemini
    if (!aiResponse && GEMINI_API_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "model", parts: [{ text: "Understood." }] },
              { role: "user", parts: [{ text: message }] },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        console.error("Gemini fallback error:", response.status);
      }
    }

    if (!aiResponse) {
      aiResponse = "Thank you for sharing this with us — we're truly sorry your experience fell short. Your feedback has been passed to our team and we'll work to make it right on your next visit.";
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-review error:", e);
    return new Response(JSON.stringify({ response: "Thank you for your feedback. We value your opinion and will work to improve." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
