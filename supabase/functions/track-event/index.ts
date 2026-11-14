import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidUuid, readJsonObject } from "../_shared/validation.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceRoleKey) throw new Error("Missing Supabase service configuration");
const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://hello-sadiqabad-2bs.pages.dev,https://hellosadiqabad.com,https://www.hellosadiqabad.com,http://localhost:3000")
  .split(",").map((value) => value.trim()).filter(Boolean);

function reply(req: Request, data: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.includes(origin)) {
    return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
  }
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin || allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    },
  });
}

async function limited(key: string, limit: number, seconds: number) {
  const { data, error } = await db.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  return !error && data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply(req, { ok: true });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await readJsonObject(req, 4_096);
    if (!body) return reply(req, { ok: false, error: "Invalid or oversized request body" }, 400);

    const sessionId = typeof body.session_id === "string" &&
      body.session_id.length >= 8 && body.session_id.length <= 128
      ? body.session_id
      : "anonymous";
    const { data: rateAllowed, error: rateError } = await db.rpc("check_rate_limit", {
      p_key: `track:${sessionId}`,
      p_limit: 300,
      p_window_seconds: 3600,
    });
    if (rateError || rateAllowed !== true) {
      return reply(req, { ok: false, error: "Rate limit exceeded" }, 429);
    }

    if (body.event_type === "search") {
      const query = typeof body.query === "string" ? body.query.trim() : "";
      const count = body.results_count;
      const filters = body.filters ?? {};
      if (query.length < 1 || query.length > 120 ||
        !Number.isInteger(count) || Number(count) < 0 || Number(count) > 100_000 ||
        !filters || typeof filters !== "object" || Array.isArray(filters) ||
        new TextEncoder().encode(JSON.stringify(filters)).byteLength > 2_048) {
        return reply(req, { ok: false, error: "Invalid search event" }, 400);
      }
      const { error } = await db.from("search_logs").insert({
        query,
        filters,
        results_count: Number(count),
      });
      if (error) return reply(req, { ok: false, error: "Could not log search" }, 400);
      return reply(req, { ok: true });
    }

    if (body.event_type === "ad_impression") {
      if (!isValidUuid(body.ad_id)) return reply(req, { ok: false, error: "Invalid ad reference" }, 400);
      const { error } = await db.rpc("increment_ad_stat", {
        p_ad_id: body.ad_id,
        p_stat: "impression",
      });
      if (error) return reply(req, { ok: false, error: "Could not record ad impression" }, 500);
      return reply(req, { ok: true });
    }

    const eventTypes = ["view", "call", "whatsapp", "directions", "share", "search_appearance"];
    if (typeof body.event_type !== "string" || !eventTypes.includes(body.event_type) ||
      !isValidUuid(body.business_id) ||
      (body.ad_id !== undefined && body.ad_id !== null && !isValidUuid(body.ad_id))) {
      return reply(req, { ok: false, error: "Invalid event" }, 400);
    }

    const { data: business, error: businessError } = await db.from("businesses")
      .select("id").eq("id", body.business_id).eq("status", "published").maybeSingle();
    if (businessError) return reply(req, { ok: false, error: "Could not verify listing" }, 503);
    if (!business) return reply(req, { ok: true });

    const eventSessionId = sessionId === "anonymous" ? crypto.randomUUID() : sessionId;
    const { error: eventError } = await db.from("business_events").insert({
      business_id: body.business_id,
      event_type: body.event_type,
      ad_id: body.ad_id ?? null,
      session_id: eventSessionId,
    });
    if (eventError) return reply(req, { ok: false, error: "Could not track event" }, 400);

    const { error: statError } = await db.rpc("increment_business_stat", {
      b_id: body.business_id,
      stat: body.event_type,
    });
    if (statError) return reply(req, { ok: false, error: "Could not update business stats" }, 500);

    if (body.ad_id) {
      const { error: adStatError } = await db.rpc("increment_ad_stat", {
        p_ad_id: body.ad_id,
        p_stat: "click",
      });
      if (adStatError) return reply(req, { ok: false, error: "Could not update ad stats" }, 500);
    }

    return reply(req, { ok: true });
  } catch {
    return reply(req, { ok: false, error: "Could not process tracking event" }, 500);
  }
});
