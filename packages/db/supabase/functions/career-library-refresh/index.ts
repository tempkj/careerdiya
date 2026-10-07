import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value as Record<string, unknown>).sort().map((k) => JSON.stringify(k) + ":" + stable((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value);
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function fetchUpstream(careerName: string, country: string, language: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url.replace(/\/$/, "") + "/functions/v1/career-library", {
    method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ careerName, country, language })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.careerData) throw new Error(payload?.error || "Career Library service unavailable.");
  return payload;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const limit = Math.max(1, Math.min(Number((await req.json().catch(() => ({}))).limit || 20), 100));
  const claimed = await admin.rpc("claim_due_career_library_variants", { p_limit: limit });
  if (claimed.error) return Response.json({ error: claimed.error.message }, { status: 500 });

  const results = [];
  for (const variant of claimed.data || []) {
    const now = new Date().toISOString();
    try {
      const upstream = await fetchUpstream(variant.canonical_name, variant.country, variant.language);
      const payload = upstream.careerData;
      const hash = await sha256(payload);
      const changed = variant.content_hash !== hash;
      const existing = await admin.from("career_library_profile").select("id").eq("variant_id", variant.id).maybeSingle();

      if (changed || !existing.data) {
        await admin.from("career_library_snapshot").update({ is_current: false }).eq("variant_id", variant.id);
        const snapshot = await admin.from("career_library_snapshot").insert({
          variant_id: variant.id, source_id: variant.source_id, content_hash: hash,
          response_valid: upstream.isValid !== false, adapter_version: upstream.adapterVersion || null,
          raw_payload: payload, is_current: true
        }).select("id").single();
        if (snapshot.error) throw snapshot.error;
        const profile = await admin.from("career_library_profile").upsert({
          variant_id: variant.id, career_id: variant.career_id, canonical_name: variant.canonical_name,
          country: variant.country, language: variant.language, data: payload, snapshot_id: snapshot.data.id, updated_at: now
        }, { onConflict: "variant_id" });
        if (profile.error) throw profile.error;
      }

      const next = new Date(Date.now() + (variant.refresh_interval_days || 30) * 86400000).toISOString();
      await admin.from("career_library_variant").update({
        last_checked_at: now, last_success_at: now, last_changed_at: changed ? now : variant.last_changed_at,
        next_refresh_at: next, content_hash: hash, refresh_status: changed ? "changed" : "unchanged",
        refresh_lock_until: null, failure_count: 0, last_error: null, updated_at: now
      }).eq("id", variant.id);
      results.push({ career: variant.canonical_name, country: variant.country, language: variant.language, changed, ok: true });
    } catch (error) {
      await admin.from("career_library_variant").update({
        last_checked_at: now, next_refresh_at: new Date(Date.now() + 6 * 3600000).toISOString(),
        refresh_status: "failed", refresh_lock_until: null, failure_count: (variant.failure_count || 0) + 1,
        last_error: String(error?.message || error).slice(0, 1000), updated_at: now
      }).eq("id", variant.id);
      results.push({ career: variant.canonical_name, country: variant.country, language: variant.language, changed: false, ok: false });
    }
  }
  return Response.json({ processed: results.length, results });
});
