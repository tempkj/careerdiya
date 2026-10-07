import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value as Record<string, unknown>).sort()
      .map((k) => JSON.stringify(k) + ":" + stable((value as Record<string, unknown>)[k]))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stable(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function upstreamCareerProfile(careerName: string, country: string, language: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(url.replace(/\/$/, "") + "/functions/v1/career-library", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ careerName, country, language })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.careerData) {
    throw new Error(payload?.error || "Career Library service is unavailable.");
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const canonicalName = String(body.careerName || "").trim();
    const careerId = body.careerId ? String(body.careerId).trim() : null;
    const country = String(body.country || "India").trim();
    const language = String(body.language || "English").trim();

    if (!canonicalName || canonicalName.length > 200) {
      return json({ error: "A canonical career name is required." }, 400);
    }

    const admin = adminClient();
    const source = await admin.from("career_library_source")
      .select("id,provider_key,integration_version")
      .eq("provider_key", "edumilestones-career-library")
      .maybeSingle();

    if (source.error || !source.data) {
      return json({ error: "Career Library source is not configured." }, 500);
    }

    let variant = await admin.from("career_library_variant")
      .select("*")
      .eq("source_id", source.data.id)
      .eq("canonical_name", canonicalName)
      .eq("country", country)
      .eq("language", language)
      .maybeSingle();

    const cached = variant.data
      ? await admin.from("career_library_profile").select("*").eq("variant_id", variant.data.id).maybeSingle()
      : { data: null, error: null };

    const fresh = cached.data && variant.data?.last_success_at &&
      Date.now() - new Date(variant.data.last_success_at).getTime() < CACHE_MAX_AGE_MS;

    if (fresh) {
      return json({
        isValid: true,
        careerData: cached.data.data,
        cache: { source: "careerdiya", cached: true, lastCheckedAt: variant.data.last_checked_at, lastChangedAt: variant.data.last_changed_at, nextRefreshAt: variant.data.next_refresh_at }
      });
    }

    try {
      const upstream = await upstreamCareerProfile(canonicalName, country, language);
      const payload = upstream.careerData;
      const hash = await sha256(payload);
      const now = new Date().toISOString();

      if (!variant.data) {
        const inserted = await admin.from("career_library_variant").insert({
          source_id: source.data.id, career_id: careerId, canonical_name: canonicalName, country, language,
          next_refresh_at: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString(),
          last_checked_at: now, last_success_at: now, last_changed_at: now, content_hash: hash, refresh_status: "changed"
        }).select("*").single();
        if (inserted.error) throw inserted.error;
        variant = inserted;
      }

      const changed = variant.data.content_hash !== hash;
      let snapshotId = cached.data?.snapshot_id || null;

      if (changed || !cached.data) {
        await admin.from("career_library_snapshot").update({ is_current: false }).eq("variant_id", variant.data.id);
        const snapshot = await admin.from("career_library_snapshot").insert({
          variant_id: variant.data.id, source_id: source.data.id, content_hash: hash,
          response_valid: upstream.isValid !== false, adapter_version: upstream.adapterVersion || source.data.integration_version,
          raw_payload: payload, is_current: true
        }).select("id").single();
        if (snapshot.error) throw snapshot.error;
        snapshotId = snapshot.data.id;

        const profile = await admin.from("career_library_profile").upsert({
          variant_id: variant.data.id, career_id: careerId || variant.data.career_id || null,
          canonical_name: canonicalName, country, language, data: payload, snapshot_id: snapshotId, updated_at: now
        }, { onConflict: "variant_id" });
        if (profile.error) throw profile.error;
      }

      await admin.from("career_library_variant").update({
        career_id: careerId || variant.data.career_id || null, last_checked_at: now, last_success_at: now,
        last_changed_at: changed ? now : variant.data.last_changed_at,
        next_refresh_at: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString(),
        content_hash: hash, refresh_status: changed ? "changed" : "unchanged",
        refresh_lock_until: null, failure_count: 0, last_error: null, updated_at: now
      }).eq("id", variant.data.id);

      return json({ isValid: true, careerData: payload, cache: { source: "careerdiya", cached: false, refreshed: changed, nextRefreshAt: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString() } });
    } catch (upstreamError) {
      if (cached.data) {
        await admin.from("career_library_variant").update({
          refresh_status: "failed", last_checked_at: new Date().toISOString(), last_error: String(upstreamError?.message || upstreamError).slice(0, 1000),
          refresh_lock_until: null, failure_count: (variant.data.failure_count || 0) + 1, updated_at: new Date().toISOString()
        }).eq("id", variant.data.id);
        return json({ isValid: true, careerData: cached.data.data, cache: { source: "careerdiya", cached: true, stale: true } });
      }
      throw upstreamError;
    }
  } catch (error) {
    return json({ error: String(error?.message || error) }, 502);
  }
});
