import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Handle bulk description generation
    if (body.action === 'generate-descriptions') {
      const items = body.items || [];
      if (items.length === 0) {
        return new Response(JSON.stringify({ descriptions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const itemsList = items.map((i: any) => `- ID: ${i.id} | Name: ${i.name} | ${i.is_veg ? 'Veg' : 'Non-Veg'} | Category: ${i.category}`).join('\n');

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a food menu description writer. Write short, appetizing descriptions (15-25 words) for each dish.
Use simple, easy-to-understand English. Be accurate to the dish name and cuisine style.
Respond with JSON: { "descriptions": [{"id": "item_id", "description": "your description"}] }`
            },
            { role: "user", content: `Write descriptions for these menu items:\n${itemsList}` }
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("AI gateway error");

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
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

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Image gen error:", response.status, errText);
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const aiData = await response.json();
      const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageUrl) throw new Error("No image generated");

      // Extract base64 data and upload to storage
      const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const fileName = `items/${item_id}.png`;
      
      // Upload to gallery storage bucket
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

      // Save to gallery_images table
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

    // Handle batch illustration generation (returns item IDs that need images)
    if (body.action === 'list-items-without-images') {
      // Get all menu items
      const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=id,name,is_veg`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const items = await itemsRes.json();

      // Get existing gallery images
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are INARA's food recommendation AI. You help customers find the perfect dish from the menu.
Given the customer's craving description and optional budget, suggest 1-3 best matching items.
Always be warm, enthusiastic, and use food-loving language.

MENU:
${menuContext}

Respond with JSON: { "message": "your friendly recommendation text", "suggestions": [{"id": "item_id", "name": "item name", "description": "why this is perfect", "price": number, "is_veg": boolean}] }
If no good match, suggest the closest items and explain why.`
          },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { message: content, suggestions: [] }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-craving error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
