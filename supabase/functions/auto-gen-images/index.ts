// Cron-driven background image generation.
// Each call processes ONE missing menu_item image via Pollinations.ai (free).
// Designed to be triggered every minute by pg_cron — persistent across sandbox restarts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function generateOne(item: { id: string; name: string; is_veg: boolean }) {
  const prompt = `A beautiful, appetizing food illustration of "${item.name}", ${item.is_veg ? "vegetarian" : "non-vegetarian"} Indian dish, top-down view on a clean plate, professional food photography style, warm lighting, on a solid white background`;
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${seed}&model=flux&nologo=true&enhance=true`;

  // Up to 3 attempts with backoff
  let buf: Uint8Array | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = new Uint8Array(await res.arrayBuffer());
      if (arr.length < 1000) throw new Error("Image too small");
      buf = arr;
      break;
    } catch (e) {
      console.error(`Attempt ${attempt} failed for ${item.name}:`, e);
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  if (!buf) throw new Error("All attempts failed");

  const fileName = `items/${item.id}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(fileName, buf, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/gallery/${fileName}`;
  const { error: insErr } = await supabase
    .from("gallery_images")
    .insert({ menu_item_id: item.id, image_url: publicUrl, caption: `AI illustration of ${item.name}` });
  if (insErr) throw insErr;
  return publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Find items without gallery_images
    const { data: items } = await supabase.from("menu_items").select("id, name, is_veg");
    const { data: existing } = await supabase.from("gallery_images").select("menu_item_id");
    const existingIds = new Set((existing || []).map((g: any) => g.menu_item_id));
    const missing = (items || []).filter((i: any) => !existingIds.has(i.id));

    if (missing.length === 0) {
      return json({ done: true, message: "All items have images", remaining: 0 });
    }

    // Process up to 2 items per invocation (within a minute window)
    const batch = missing.slice(0, 2);
    const results: any[] = [];
    for (const item of batch) {
      try {
        const url = await generateOne(item);
        results.push({ id: item.id, name: item.name, ok: true, url });
      } catch (e) {
        results.push({ id: item.id, name: item.name, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ done: false, remaining: missing.length - results.filter(r => r.ok).length, results });
  } catch (e) {
    console.error("auto-gen-images error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
