import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit || 20), 100));

    const claimed = await ctx.supabaseAdmin.rpc("claim_due_career_library_variants", { p_limit: limit });
    if (claimed.error) {
      return Response.json({ error: claimed.error.message }, { status: 500 });
    }

    const results = [];
    for (const variant of claimed.data || []) {
      const now = new Date().toISOString();
      try {
        const upstream = await ctx.supabaseAdmin.functions.invoke("career-library", {
          body: {
            careerName: variant.canonical_name,
            country: variant.country,
            language: variant.language
          }
        });

        if (upstream.error || !upstream.data?.careerData) {
          throw new Error(upstream.error?.message || "Upstream Career Library returned no careerData.");
        }

        const payload = upstream.data.careerData;
        const bytes = new TextEncoder().encode(stable(payload));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        const changed = variant.content_hash !== hash;

        if (changed || !(await ctx.supabaseAdmin.from("career_library_profile").select("id").eq("variant_id", variant.id).maybeSingle()).data) {
          await ctx.supabaseAdmin.from("career_library_snapshot").update({ is_current: false }).eq("variant_id", variant.id);
          const snapshot = await ctx.supabaseAdmin.from("career_library_snapshot").insert({
            variant_id: variant.id,
            source_id: variant.source_id,
            content_hash: hash,
            response_valid: upstream.data?.isValid !== false,
            adapter_version: upstream.data?.adapterVersion || null,
            raw_payload: payload,
            is_current: true
          }).select("id").single();
          if (snapshot.error) throw snapshot.error;

          const profile = await ctx.supabaseAdmin.from("career_library_profile").upsert({
            variant_id: variant.id,
            career_id: variant.career_id,
            canonical_name: variant.canonical_name,
            country: variant.country,
            language: variant.language,
            data: payload,
            snapshot_id: snapshot.data.id,
            updated_at: now
          }, { onConflict: "variant_id" });
          if (profile.error) throw profile.error;
        }

        await ctx.supabaseAdmin.from("career_library_variant").update({
          last_checked_at: now,
          last_success_at: now,
          last_changed_at: changed ? now : variant.last_changed_at,
          next_refresh_at: new Date(Date.now() + (variant.refresh_interval_days || 30) * 86400000).toISOString(),
          content_hash: hash,
          refresh_status: changed ? "changed" : "unchanged",
          refresh_lock_until: null,
          failure_count: 0,
          last_error: null,
          updated_at: now
        }).eq("id", variant.id);

        results.push({ id: variant.id, career: variant.canonical_name, changed, ok: true });
      } catch (error) {
        await ctx.supabaseAdmin.from("career_library_variant").update({
          last_checked_at: now,
          next_refresh_at: new Date(Date.now() + 6 * 3600000).toISOString(),
          refresh_status: "failed",
          refresh_lock_until: null,
          failure_count: (variant.failure_count || 0) + 1,
          last_error: String(error?.message || error).slice(0, 1000),
          updated_at: now
        }).eq("id", variant.id);
        results.push({ id: variant.id, career: variant.canonical_name, changed: false, ok: false });
      }
    }

    return Response.json({ processed: results.length, results });
  })
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value as Record<string, unknown>).sort()
      .map((k) => JSON.stringify(k) + ":" + stable((value as Record<string, unknown>)[k]))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}
