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
    if (!res) throw new Error("Gemini: no response");
    const err = await res.text();
    console.error("Gemini error:", res.status, err);
    if (res.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`Gemini error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiImage(prompt: string) {
  // Open-source image generation via Pollinations.ai (free, no API key, Flux model)
  const seed = Math.floor(Math.random() * 1000000);
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&model=flux&nologo=true&enhance=true`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Pollinations error:", res.status);
    throw new Error(`Image gen failed: ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error("Image too small, generation likely failed");

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
      const fileName = `items/${item_id}.jpg`;

      await fetch(`${SUPABASE_URL}/storage/v1/object/gallery/${fileName}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/jpeg", "x-upsert": "true" },
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
        `- [id=${item.id}] ${item.name} (₹${item.base_price}, ${item.is_veg ? 'Veg' : 'Non-Veg'}): ${item.description || 'No description'}`
      ).join('\n');

      const sys = `You are INARA's food recommendation AI. Suggest 1-3 best matching items from the menu based on the customer's craving. Be warm and enthusiastic.

MENU:
${menuContext}

Respond with JSON: { "message": "your friendly recommendation text", "suggestions": [{"id": "EXACT_UUID_FROM_MENU", "name": "item name", "description": "why this is perfect", "price": number, "is_veg": boolean}] }
IMPORTANT: The "id" MUST be the exact UUID from [id=...] in the menu above. Never invent IDs or use slugs.`;

      const content = await callAI(query, sys, true);
      let parsed; try { parsed = JSON.parse(content); } catch { parsed = { message: content, suggestions: [] }; }
      // Validate that returned IDs exist in the actual menu; if not, fall back
      const validIds = new Set((menuItems || []).map((m: any) => m.id));
      const cleanedSuggestions = (parsed.suggestions || []).filter((s: any) => validIds.has(s.id));
      if (!cleanedSuggestions.length && (parsed.suggestions || []).length) {
        // AI hallucinated IDs — use smart fallback instead
        return jsonRes(smartFallback(query, menuItems));
      }
      return jsonRes({ ...parsed, suggestions: cleanedSuggestions });
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

function smartFallback(query: string, menuItems: any[]) {
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(w => w.length > 2);

  // Extract budget
  const budgetMatch = q.match(/(?:under|below|within|max|upto|<)\s*₹?\s*(\d+)/);
  const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;

  // Veg/non-veg preference
  const wantsVeg = /\bveg\b|vegetarian|paneer|dal|sabzi/.test(q);
  const wantsNonVeg = /\bnon.?veg|chicken|mutton|fish|egg|meat|prawn/.test(q);

  // Score each item
  const scored = menuItems.map((item: any) => {
    let score = 0;
    const name = item.name.toLowerCase();
    const desc = (item.description || '').toLowerCase();

    // Keyword matching
    for (const kw of keywords) {
      if (name.includes(kw)) score += 3;
      if (desc.includes(kw)) score += 1;
    }

    // Budget filter
    if (budget && item.base_price > budget) score -= 5;
    if (budget && item.base_price <= budget) score += 1;

    // Veg preference
    if (wantsVeg && item.is_veg) score += 2;
    if (wantsNonVeg && !item.is_veg) score += 2;
    if (wantsVeg && !item.is_veg) score -= 3;
    if (wantsNonVeg && item.is_veg) score -= 3;

    // Boost bestsellers and chef specials
    if (item.is_bestseller) score += 1;
    if (item.is_chef_special) score += 1;

    return { ...item, score };
  });

  scored.sort((a: any, b: any) => b.score - a.score);
  const top = scored.slice(0, 3).filter((s: any) => s.score > 0);

  if (top.length === 0) {
    // Random popular picks
    const popular = menuItems.filter((i: any) => i.is_bestseller || i.is_chef_special).slice(0, 3);
    const fallbackItems = popular.length ? popular : menuItems.slice(0, 3);
    return {
      message: "I couldn't find an exact match, but here are some popular picks you might enjoy! 🍽️",
      suggestions: fallbackItems.map((i: any) => ({
        id: i.id, name: i.name, description: i.description || "A delightful dish from our menu",
        price: i.base_price, is_veg: i.is_veg,
      })),
    };
  }

  return {
    message: `Here's what I found for "${query}" — hope you love it! 😋`,
    suggestions: top.map((i: any) => ({
      id: i.id, name: i.name, description: i.description || "A delightful dish from our menu",
      price: i.base_price, is_veg: i.is_veg,
    })),
  };
}

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
