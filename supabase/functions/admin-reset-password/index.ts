import { createClient } from "npm:@supabase/supabase-js@2";
import { extractBearerToken, isValidUuid } from "../_shared/validation.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceRoleKey) throw new Error("Missing Supabase service configuration");
const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://hello-sadiqabad-2bs.pages.dev,https://hellosadiqabad.com,https://www.hellosadiqabad.com,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map((value) => value.trim()).filter(Boolean);

function response(req: Request, data: unknown, status = 200) {
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

async function caller(req: Request) {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const actor = await caller(req);
    if (!actor) return response(req, { ok: false, error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role,is_active").eq("id", actor.id).maybeSingle();
    if (profileError || profile?.role !== "super_admin" || profile.is_active !== true) {
      return response(req, { ok: false, error: "Permission denied" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return response(req, { ok: false, error: "Invalid request body" }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return response(req, { ok: false, error: "Invalid JSON body" }, 400);
    }

    const userId = body.user_id;
    const password = typeof body.new_password === "string" ? body.new_password : "";
    if (!isValidUuid(userId) || password.length < 12 || password.length > 128) {
      return response(req, { ok: false, error: "A valid user ID and password of 12–128 characters are required." }, 400);
    }

    const { data: target, error: targetError } = await db.from("profiles")
      .select("id").eq("id", userId).maybeSingle();
    if (targetError || !target) return response(req, { ok: false, error: "User not found" }, 404);

    const { error: updateError } = await db.auth.admin.updateUserById(userId, { password });
    if (updateError) return response(req, { ok: false, error: "Password could not be updated." }, 400);

    const { error: flagError } = await db.from("profiles").update({
      must_change_password: true,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (flagError) {
      return response(req, { ok: false, error: "Password was updated, but the first-login change flag could not be saved. Please retry the reset." }, 500);
    }
    return response(req, { ok: true });
  } catch {
    return response(req, { ok: false, error: "Password reset failed unexpectedly." }, 500);
  }
});
