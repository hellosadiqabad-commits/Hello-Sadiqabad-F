import { createClient } from "npm:@supabase/supabase-js@2";
import { extractBearerToken, isValidUuid } from "../_shared/validation.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceRoleKey) throw new Error("Missing Supabase service configuration");

const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, { ok: true });
  if (req.method !== "POST") return response(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const token = extractBearerToken(req.headers.get("authorization"));
    if (!token) return response(req, { ok: false, error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return response(req, { ok: false, error: "Unauthorized" }, 401);

    const { data: actor, error: actorError } = await db.from("profiles")
      .select("role,is_active").eq("id", authData.user.id).maybeSingle();
    if (actorError || actor?.role !== "super_admin" || actor.is_active !== true) {
      return response(req, { ok: false, error: "Super admin only" }, 403);
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
    const isActive = body.is_active;
    if (!isValidUuid(userId) || typeof isActive !== "boolean") {
      return response(req, { ok: false, error: "A valid user ID and account status are required." }, 400);
    }
    if (userId === authData.user.id) {
      return response(req, { ok: false, error: "You cannot deactivate your own administrator account" }, 400);
    }

    const { data: target, error: targetError } = await db.from("profiles")
      .select("role,is_active").eq("id", userId).maybeSingle();
    if (targetError || !target) return response(req, { ok: false, error: "User not found" }, 404);
    if (target.role === "super_admin") {
      return response(req, { ok: false, error: "Another super admin cannot be disabled here" }, 403);
    }

    const previousActive = target.is_active === true;
    const { error: authUpdateError } = await db.auth.admin.updateUserById(userId, {
      ban_duration: isActive ? "none" : "876000h",
    });
    if (authUpdateError) return response(req, { ok: false, error: "Authentication status could not be updated." }, 400);

    const { error: profileUpdateError } = await db.from("profiles").update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (profileUpdateError) {
      await db.auth.admin.updateUserById(userId, {
        ban_duration: previousActive ? "none" : "876000h",
      });
      return response(req, { ok: false, error: "Account profile could not be updated; authentication status rollback was attempted." }, 500);
    }

    const { error: staffUpdateError } = await db.from("staff_members").update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (staffUpdateError) {
      await db.from("profiles").update({
        is_active: previousActive,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      await db.auth.admin.updateUserById(userId, {
        ban_duration: previousActive ? "none" : "876000h",
      });
      return response(req, { ok: false, error: "Staff access could not be synchronized; account rollback was attempted." }, 500);
    }

    return response(req, { ok: true });
  } catch {
    return response(req, { ok: false, error: "Account status update failed unexpectedly." }, 500);
  }
});
