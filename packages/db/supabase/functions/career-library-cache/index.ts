import { withSupabase } from "npm:@supabase/server@^1";

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const cors = { "Content-Type": "application/json" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: cors });
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

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const canonicalName = String(body.careerName || "").trim();
    const careerId = body.careerId ? String(body.careerId).trim() : null;
    const country = String(body.country || "India").trim();
    const language = String(body.language || "English").trim();

    if (!canonicalName || canonicalName.length > 200) {
      return json({ error: "A canonical career name is required." }, 400);
    }

    const source = await ctx.supabaseAdmin
      .from("career_library_source")
      .select("id,provider_key,integration_version")
      .eq("provider_key", "edumilestones-career-library")
      .maybeSingle();

    if (source.error || !source.data) {
      return json({ error: "Career Library source is not configured." }, 500);
    }

    const variant = await ctx.supabaseAdmin
      .from("career_library_variant")
      .select("*")
      .eq("source_id", source.data.id)
      .eq("canonical_name", canonicalName)
      .eq("country", country)
      .eq("language", language)
      .maybeSingle();

    const cached = variant.data
      ? await ctx.supabaseAdmin.from("career_library_profile")
          .select("*")
          .eq("variant_id", variant.data.id)
          .maybeSingle()
      : { data: null, error: null };

    const fresh = cached.data && variant.data?.last_success_at &&
      Date.now() - new Date(variant.data.last_success_at).getTime() < CACHE_MAX_AGE_MS;

    if (fresh) {
      return json({
        isValid: true,
        careerData: cached.data.data,
        cache: {
          source: "careerdiya",
          cached: true,
          lastCheckedAt: variant.data.last_checked_at,
          lastChangedAt: variant.data.last_changed_at,
          nextRefreshAt: variant.data.next_refresh_at
        }
      });
    }

    // The existing career-library function remains the single upstream adapter.
    // This cache layer deliberately does not duplicate provider parsing/validation.
    const upstream = await ctx.supabaseAdmin.functions.invoke("career-library", {
      body: { careerName: canonicalName, country, language }
    });

    if (upstream.error || !upstream.data?.careerData) {
      if (cached.data) {
        return json({
          isValid: true,
          careerData: cached.data.data,
          cache: { source: "careerdiya", cached: true, stale: true }
        });
      }
      return json({ error: upstream.error?.message || "Career Library service is unavailable." }, 502);
    }

    const payload = upstream.data.careerData;
    const hash = await sha256(payload);
    const now = new Date().toISOString();

    let variantId = variant.data?.id;
    if (!variantId) {
      const inserted = await ctx.supabaseAdmin.from("career_library_variant").insert({
        source_id: source.data.id,
        career_id: careerId,
        canonical_name: canonicalName,
        country,
        language,
        next_refresh_at: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString(),
        last_checked_at: now,
        last_success_at: now,
        last_changed_at: now,
        content_hash: hash,
        refresh_status: "changed"
      }).select("id").single();
      if (inserted.error) return json({ error: inserted.error.message }, 500);
      variantId = inserted.data.id;
    }

    const changed = variant.data?.content_hash !== hash;

    if (changed || !cached.data) {
      await ctx.supabaseAdmin
        .from("career_library_snapshot")
        .update({ is_current: false })
        .eq("variant_id", variantId);

      const snapshot = await ctx.supabaseAdmin.from("career_library_snapshot").insert({
        variant_id: variantId,
        source_id: source.data.id,
        content_hash: hash,
        response_valid: upstream.data?.isValid !== false,
        adapter_version: upstream.data?.adapterVersion || source.data.integration_version,
        raw_payload: payload,
        is_current: true
      }).select("id").single();

      if (snapshot.error) return json({ error: snapshot.error.message }, 500);

      await ctx.supabaseAdmin.from("career_library_profile").upsert({
        variant_id: variantId,
        career_id: careerId || variant.data?.career_id || null,
        canonical_name: canonicalName,
        country,
        language,
        data: payload,
        snapshot_id: snapshot.data.id,
        updated_at: now
      }, { onConflict: "variant_id" });

      await ctx.supabaseAdmin.from("career_library_variant").update({
        career_id: careerId || variant.data?.career_id || null,
        last_checked_at: now,
        last_success_at: now,
        last_changed_at: now,
        next_refresh_at: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString(),
        content_hash: hash,
        refresh_status: changed ? "changed" : "fresh",
        refresh_lock_until: null,
        failure_count: 0,
        last_error: null,
        updated_at: now
      }).eq("id", variantId);
    } else {
      await ctx.supabaseAdmin.from("career_library_variant").update({
        last_checked_at: now,
        last_success_at: now,
        next_refresh_at: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString(),
        refresh_status: "unchanged",
        refresh_lock_until: null,
        failure_count: 0,
        last_error: null,
        updated_at: now
      }).eq("id", variantId);
    }

    return json({
      isValid: true,
      careerData: payload,
      cache: {
        source: "careerdiya",
        cached: false,
        refreshed: changed,
        nextRefreshAt: new Date(Date.now() + CACHE_MAX_AGE_MS).toISOString()
      }
    });
  })
};
