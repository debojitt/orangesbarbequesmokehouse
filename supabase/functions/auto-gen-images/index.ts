// Cron-driven background image generation.
// Uses Lovable AI for faster, more reliable food illustrations.
// Designed to be triggered every minute by pg_cron — persistent across sandbox restarts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function dataUrlToBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("AI did not return a valid image");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1] };
}

async function generateOne(item: { id: string; name: string; is_veg: boolean }) {
  const prompt = `Create a clean, appetizing square menu illustration of ${item.name}. ${item.is_veg ? "Vegetarian Indian restaurant dish" : "Non-vegetarian Indian restaurant dish"}. Top-down plated food, bright natural light, crisp detail, solid warm white background, no logo, no text, no hands, no watermark.`;
  let bytes: Uint8Array;
  let contentType: string;

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`AI image request failed: HTTP ${res.status}`);
    const data = await res.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("AI did not return an image");
    ({ bytes, contentType } = dataUrlToBytes(imageUrl));
  } catch (aiError) {
    console.error(`Lovable AI unavailable for ${item.name}, falling back:`, aiError);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&model=turbo&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    const fallback = await fetch(fallbackUrl, { signal: AbortSignal.timeout(30000) });
    if (!fallback.ok) throw new Error(`Fallback image request failed: HTTP ${fallback.status}`);
    bytes = new Uint8Array(await fallback.arrayBuffer());
    contentType = fallback.headers.get("content-type") || "image/jpeg";
  }
  if (bytes.length < 1000) throw new Error("Generated image is too small");

  const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const fileName = `items/${item.id}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(fileName, bytes, { contentType, upsert: true });
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
    const requestBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.max(1, Math.min(Number(requestBody.batchSize) || 3, 6));

    // Find items without gallery_images
    const { data: items } = await supabase.from("menu_items").select("id, name, is_veg");
    const { data: existing } = await supabase.from("gallery_images").select("menu_item_id");
    const existingIds = new Set((existing || []).map((g: any) => g.menu_item_id));
    const missing = (items || []).filter((i: any) => !existingIds.has(i.id));

    if (missing.length === 0) {
      return json({ done: true, message: "All items have images", remaining: 0 });
    }

    // Process several items per invocation, but cap it to avoid serverless timeouts.
    const batch = missing.slice(0, batchSize);
    const results = await Promise.all(batch.map(async (item: any) => {
      try {
        const url = await generateOne(item);
        return { id: item.id, name: item.name, ok: true, url };
      } catch (e) {
        console.error(`Image generation failed for ${item.name}:`, e);
        return { id: item.id, name: item.name, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }));

    return json({ done: false, remaining: missing.length - results.filter(r => r.ok).length, results });
  } catch (e) {
    console.error("auto-gen-images error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
