import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false, autoRefreshToken: false } });
const now = new Date().toISOString();

function tier(count: number) {
  if (count <= 1) return "Super Rare";
  if (count <= 5) return "Rare";
  if (count <= 20) return "Uncommon";
  return "Common";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: { "content-type": "application/json" } });
  const expected = Deno.env.get("MAINTENANCE_TOKEN");
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { "content-type": "application/json" } });
  const expired = await supabase.from("sightings").update({ validation_reason: "expired" }).eq("validation_status", "accepted").lte("expires_at", now).select("id");
  const recent = await supabase.from("sightings").select("public_geohash,cat_type").eq("validation_status", "accepted").gte("captured_at", new Date(Date.now() - 30 * 86400000).toISOString());
  const grouped = new Map<string, { scope_key: string; cat_type: string; sample_count: number }>();
  for (const item of recent.data || []) { const key = `${item.public_geohash || "country"}:${item.cat_type || "Unclassified cat"}`; const previous = grouped.get(key); grouped.set(key, { scope_key: item.public_geohash || "country", cat_type: item.cat_type || "Unclassified cat", sample_count: (previous?.sample_count || 0) + 1 }); }
  await supabase.from("regional_rarity").delete().neq("scope_key", "__never__");
  if (grouped.size) await supabase.from("regional_rarity").insert([...grouped.values()].map((item) => ({ ...item, tier: tier(item.sample_count), calculated_at: now })));
  return new Response(JSON.stringify({ expiredCount: expired.data?.length || 0, updatedCount: grouped.size, calculatedAt: now }), { headers: { "content-type": "application/json" } });
});
