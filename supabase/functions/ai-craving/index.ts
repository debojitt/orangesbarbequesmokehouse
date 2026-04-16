import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(prompt: string, systemPrompt?: string, jsonMode = false): Promise<string> {
  // Try Lovable AI Gateway first
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    try {
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });

      const body: any = {
        model: "google/gemini-2.5-flash",
        messages,
      };
      if (jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
      }
      
      const status = res.status;
      console.error("Lovable AI error:", status, await res.text());
      if (status !== 429 && status !== 402) throw new Error(`Lovable AI error: ${status}`);
      // Fall through to Gemini on rate limit / payment
    } catch (e) {
      console.error("Lovable AI failed, trying Gemini fallback:", e);
    }
  }

  // Fallback: direct Gemini
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("No AI API key configured");

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const gBody: any = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };
  if (jsonMode) gBody.generationConfig.responseMimeType = "application/json";

  // Try multiple models in case one has exhausted its free tier
  const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
  let res: Response | null = null;
  for (const model of models) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gBody) }
    );
    if (res.ok || res.status !== 429) break;
    console.error(`Model ${model} rate limited, trying next...`);
  }

  if (!res || !res.ok) {
    const err = await res.text();
    console.error("Gemini error:", res.status, err);
    if (res.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`Gemini error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiImage(prompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );

  if (!res.ok) throw new Error(`Image generation failed: ${res.status}`);
  const data = await res.json();
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data;
  }
  throw new Error("No image generated");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

    // Bulk description generation
    if (body.action === 'generate-descriptions') {
      const items = body.items || [];
      if (!items.length) return jsonRes({ descriptions: [] });

      const itemsList = items.map((i: any) => `- ID: ${i.id} | Name: ${i.name} | ${i.is_veg ? 'Veg' : 'Non-Veg'} | Category: ${i.category}`).join('\n');
      const sys = `You are a food menu description writer. Write short, appetizing descriptions (15-25 words) for each dish. Respond with JSON: { "descriptions": [{"id": "item_id", "description": "your description"}] }`;
      const content = await callAI(`Write descriptions for:\n${itemsList}`, sys, true);
      let parsed; try { parsed = JSON.parse(content); } catch { parsed = { descriptions: [] }; }
      return jsonRes(parsed);
    }

    // Image generation
    if (body.action === 'generate-illustration') {
      const { item_id, item_name, is_veg } = body;
      if (!item_id || !item_name) throw new Error("item_id and item_name required");

      const prompt = `A beautiful, appetizing food illustration of "${item_name}", ${is_veg ? 'vegetarian' : 'non-vegetarian'} Indian dish, top-down view on a clean plate, professional food photography style, warm lighting, on a solid white background`;
      const base64Data = await callGeminiImage(prompt);
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `items/${item_id}.png`;

      await fetch(`${SUPABASE_URL}/storage/v1/object/gallery/${fileName}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/png", "x-upsert": "true" },
        body: imageBytes,
      });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/gallery/${fileName}`;
      await fetch(`${SUPABASE_URL}/rest/v1/gallery_images`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ menu_item_id: item_id, image_url: publicUrl, caption: `AI illustration of ${item_name}` }),
      });

      return jsonRes({ success: true, image_url: publicUrl });
    }

    // List items without images
    if (body.action === 'list-items-without-images') {
      const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=id,name,is_veg`, { headers });
      const items = await itemsRes.json();
      const imagesRes = await fetch(`${SUPABASE_URL}/rest/v1/gallery_images?select=menu_item_id`, { headers });
      const images = await imagesRes.json();
      const existingIds = new Set((images || []).map((i: any) => i.menu_item_id));
      const missing = (items || []).filter((i: any) => !existingIds.has(i.id));
      return jsonRes({ items: missing, total: items?.length || 0, missing: missing.length });
    }

    // Default: craving recommendation
    const { query } = body;
    const menuRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?is_available=eq.true&select=id,name,description,base_price,is_veg,category_id`, { headers });
    const menuItems = await menuRes.json();

    // Try AI first, fall back to smart keyword matching
    try {
      const menuContext = menuItems.map((item: any) =>
        `- ${item.name} (₹${item.base_price}, ${item.is_veg ? 'Veg' : 'Non-Veg'}): ${item.description || 'No description'}`
      ).join('\n');

      const sys = `You are INARA's food recommendation AI. Suggest 1-3 best matching items from the menu based on the customer's craving. Be warm and enthusiastic.

MENU:
${menuContext}

Respond with JSON: { "message": "your friendly recommendation text", "suggestions": [{"id": "item_id", "name": "item name", "description": "why this is perfect", "price": number, "is_veg": boolean}] }`;

      const content = await callAI(query, sys, true);
      let parsed; try { parsed = JSON.parse(content); } catch { parsed = { message: content, suggestions: [] }; }
      return jsonRes(parsed);
    } catch (aiError) {
      console.error("AI unavailable, using smart fallback:", aiError);
      // Smart keyword-based fallback
      return jsonRes(smartFallback(query, menuItems));
    }

  } catch (e) {
    console.error("ai-craving error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
