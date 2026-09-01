import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


const MAX_REQUEST_BYTES = 32 * 1024;

function requestTooLarge(req: Request) {
  const raw = req.headers.get("content-length");
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > MAX_REQUEST_BYTES;
}

async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
function fetchPlacesAutocomplete(input: string | URL | Request, init: RequestInit = {}) {
  return fetchWithTimeout(input, init, 10000);
}

type RateLimitResult = {
  allowed: boolean;
  hits: number;
  remaining: number;
  reset_at: string;
};

function decodeJwtSub(authHeader: string | null) {
  try {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

    const payload = JSON.parse(atob(base64));
    return typeof payload?.sub === "string" && payload.sub
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildRateLimitIdentifier(req: Request) {
  const sub = decodeJwtSub(req.headers.get("authorization"));

  if (sub) {
    return sha256Hex(`user:${sub}`);
  }

  const forwarded =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";

  const agent = req.headers.get("user-agent") || "unknown-agent";
  return sha256Hex(`ip:${forwarded}|ua:${agent.slice(0, 120)}`);
}

async function consumeRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Rate limiter unavailable: Supabase service credentials missing.");
    return null;
  }

  try {
    const identifierHash = await buildRateLimitIdentifier(req);

    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/rpc/consume_api_rate_limit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          p_bucket: bucket,
          p_identifier_hash: identifierHash,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        }),
      },
      5000,
    );

    if (!response.ok) {
      console.error("Rate limiter RPC failed", response.status);
      return null;
    }

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;

    if (!row || typeof row.allowed !== "boolean") {
      console.error("Rate limiter returned an unexpected payload.");
      return null;
    }

    return row as RateLimitResult;
  } catch (error) {
    console.error(
      "Rate limiter failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

function rateLimitResponse(result: RateLimitResult) {
  const resetAt = new Date(result.reset_at).getTime();
  const retryAfter = Math.max(
    1,
    Math.ceil((resetAt - Date.now()) / 1000),
  );

  return new Response(
    JSON.stringify({
      error: "Too many requests. Please wait and try again.",
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
Deno.serve(async (req: Request) => {
  const burstLimit = await consumeRateLimit(req, "place_autocomplete_10m", 120, 600);
  if (burstLimit && !burstLimit.allowed) return rateLimitResponse(burstLimit);

  const dailyLimit = await consumeRateLimit(req, "place_autocomplete_day", 500, 86400);
  if (dailyLimit && !dailyLimit.allowed) return rateLimitResponse(dailyLimit);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (requestTooLarge(req)) {
    return new Response(JSON.stringify({ error: "Request payload is too large." }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { input, sessionToken } = await req.json();
    const query = typeof input === "string" ? input.trim() : "";

    if (query.length > 120) {
      return new Response(JSON.stringify({ error: "Search text is too long." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof sessionToken === "string" && sessionToken.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid session token." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (query.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetchPlacesAutocomplete("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["in"],
        languageCode: "en",
        regionCode: "IN",
        ...(sessionToken ? { sessionToken } : {}),
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return new Response(JSON.stringify({
        error: "Google Places autocomplete failed.",
        details,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const suggestions = (data?.suggestions ?? [])
      .map((item: any) => item?.placePrediction)
      .filter(Boolean)
      .slice(0, 6)
      .map((p: any) => ({
        placeId: p.placeId ?? "",
        place: p.place ?? "",
        text: p.text?.text ?? "",
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
