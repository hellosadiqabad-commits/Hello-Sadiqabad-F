import { createClient } from "npm:@supabase/supabase-js@2";
import { hashRateKey, isValidUuid, readJsonObject } from "../_shared/validation.ts";

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

function validString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply(req, { ok: true });
  if (req.method !== "POST") return reply(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await readJsonObject(req, 8_192);
    if (!body) return reply(req, { ok: false, error: "Invalid or oversized request body" }, 400);
    if (body.website_hp) return reply(req, { ok: true });

    if (!isValidUuid(body.business_id) ||
      !validString(body.author_name, 2, 60) ||
      !Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5 ||
      !validString(body.comment, 1, 500)) {
      return reply(req, { ok: false, error: "Invalid review details" }, 400);
    }

    const businessId = body.business_id;
    const sessionId = validString(body.session_id, 8, 128) ? body.session_id : "anonymous";
    const authorIdentity = await hashRateKey(body.author_name.trim().toLocaleLowerCase());
    const [sessionAllowed, authorAllowed] = await Promise.all([
      limited(`review:session:${sessionId}:${businessId}`, 3, 3600),
      limited(`review:author:${authorIdentity}:${businessId}`, 2, 86_400),
    ]);
    if (!sessionAllowed || !authorAllowed) {
      return reply(req, { ok: false, error: "Please try again later" }, 429);
    }

    const { data: business, error: businessError } = await db.from("businesses")
      .select("id,status").eq("id", businessId).maybeSingle();
    if (businessError) return reply(req, { ok: false, error: "Could not verify this listing" }, 503);
    if (!business || business.status !== "published") {
      return reply(req, { ok: false, error: "Business not found" }, 404);
    }

    const { error: insertError } = await db.from("reviews").insert({
      business_id: business.id,
      author_name: body.author_name.trim(),
      rating: Number(body.rating),
      comment: body.comment.trim(),
      status: "pending",
    });
    if (insertError) return reply(req, { ok: false, error: "Could not submit review" }, 400);
    return reply(req, { ok: true });
  } catch {
    return reply(req, { ok: false, error: "Could not process review" }, 500);
  }
});
