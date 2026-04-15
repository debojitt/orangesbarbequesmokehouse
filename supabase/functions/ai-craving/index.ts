import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callGemini(prompt: string, systemPrompt?: string, jsonMode = false) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };
  if (jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    if (response.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiImage(prompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini image error:", response.status, errText);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return part.inlineData.data; // base64 image data
    }
  }
  throw new Error("No image generated");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Handle bulk description generation
    if (body.action === 'generate-descriptions') {
      const items = body.items || [];
      if (items.length === 0) {
        return new Response(JSON.stringify({ descriptions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const itemsList = items.map((i: any) => `- ID: ${i.id} | Name: ${i.name} | ${i.is_veg ? 'Veg' : 'Non-Veg'} | Category: ${i.category}`).join('\n');

      const systemPrompt = `You are a food menu description writer. Write short, appetizing descriptions (15-25 words) for each dish.
Use simple, easy-to-understand English. Be accurate to the dish name and cuisine style.
Respond with JSON: { "descriptions": [{"id": "item_id", "description": "your description"}] }`;

      const content = await callGemini(`Write descriptions for these menu items:\n${itemsList}`, systemPrompt, true);
      let parsed;
      try { parsed = JSON.parse(content); } catch { parsed = { descriptions: [] }; }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle food illustration generation
    if (body.action === 'generate-illustration') {
      const { item_id, item_name, is_veg } = body;
      if (!item_id || !item_name) throw new Error("item_id and item_name required");

      const prompt = `A beautiful, appetizing food illustration of "${item_name}", ${is_veg ? 'vegetarian' : 'non-vegetarian'} Indian dish, top-down view on a clean plate, professional food photography style, warm lighting, garnished beautifully, on a solid white background`;

      const base64Data = await callGeminiImage(prompt);
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const fileName = `items/${item_id}.png`;
      
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/gallery/${fileName}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "image/png",
          "x-upsert": "true",
        },
        body: imageBytes,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        console.error("Upload error:", uploadErr);
        throw new Error("Failed to upload image");
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/gallery/${fileName}`;

      await fetch(`${SUPABASE_URL}/rest/v1/gallery_images`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          menu_item_id: item_id,
          image_url: publicUrl,
          caption: `AI illustration of ${item_name}`,
        }),
      });

      return new Response(JSON.stringify({ success: true, image_url: publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle listing items without images
    if (body.action === 'list-items-without-images') {
      const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=id,name,is_veg`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const items = await itemsRes.json();

      const imagesRes = await fetch(`${SUPABASE_URL}/rest/v1/gallery_images?select=menu_item_id`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const images = await imagesRes.json();
      const existingIds = new Set((images || []).map((i: any) => i.menu_item_id));

      const missing = (items || []).filter((i: any) => !existingIds.has(i.id));

      return new Response(JSON.stringify({ items: missing, total: items?.length || 0, missing: missing.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: craving recommendation
    const { query } = body;

    const menuRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?is_available=eq.true&select=id,name,description,base_price,is_veg,category_id,serving_info`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const menuItems = await menuRes.json();

    const menuContext = menuItems.map((item: any) =>
      `- ${item.name} (₹${item.base_price}, ${item.is_veg ? 'Veg' : 'Non-Veg'}): ${item.description || 'No description'}`
    ).join('\n');

    const systemPrompt = `You are INARA's food recommendation AI. You help customers find the perfect dish from the menu.
Given the customer's craving description and optional budget, suggest 1-3 best matching items.
Always be warm, enthusiastic, and use food-loving language.

MENU:
${menuContext}

Respond with JSON: { "message": "your friendly recommendation text", "suggestions": [{"id": "item_id", "name": "item name", "description": "why this is perfect", "price": number, "is_veg": boolean}] }
If no good match, suggest the closest items and explain why.`;

    const content = await callGemini(query, systemPrompt, true);
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { message: content, suggestions: [] }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-craving error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "RATE_LIMITED") {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
