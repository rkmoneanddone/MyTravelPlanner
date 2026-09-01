const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
function fetchNearbyPlaces(input: string | URL | Request, init: RequestInit = {}) {
  return fetchWithTimeout(input, init, 12000);
}
type SuggestionKind =
  | "hotel"
  | "restaurant"
  | "pilgrimage"
  | "attraction";

type RequestBody = {
  location?: string;
  kind?: SuggestionKind;
  limit?: number;
};

const queryByKind: Record<SuggestionKind, string> = {
  hotel: "hotels",
  restaurant: "restaurants",
  pilgrimage: "temples religious places pilgrimage places",
  attraction: "tourist attractions places to visit",
};

/**
 * Returns a JSON response with common CORS headers.
 */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Converts the Google Places response into a deliberately small
 * client-safe shape. We do not send the complete Google payload.
 */
function normalisePlace(place: any) {
  return {
    id: place.id || null,
    name:
      place.displayName?.text ||
      place.displayName ||
      "Unnamed place",
    address: place.formattedAddress || "",
    rating:
      typeof place.rating === "number"
        ? place.rating
        : null,
    ratingCount:
      typeof place.userRatingCount === "number"
        ? place.userRatingCount
        : null,
    primaryType:
      place.primaryTypeDisplayName?.text ||
      place.primaryType ||
      "",
    openNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    mapsUri: place.googleMapsUri || null,
    location:
      place.location?.latitude != null &&
      place.location?.longitude != null
        ? {
            lat: place.location.latitude,
            lng: place.location.longitude,
          }
        : null,
  };
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
Deno.serve(async (req) => {
  const burstLimit = await consumeRateLimit(req, "nearby_places_10m", 30, 600);
  if (burstLimit && !burstLimit.allowed) return rateLimitResponse(burstLimit);

  const dailyLimit = await consumeRateLimit(req, "nearby_places_day", 120, 86400);
  if (dailyLimit && !dailyLimit.allowed) return rateLimitResponse(dailyLimit);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
    );
  }
  if (requestTooLarge(req)) {
    return jsonResponse(
      { error: "Request payload is too large." },
      413,
    );
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        { error: "Google Maps API key is not configured." },
        500,
      );
    }

    const body = (await req.json()) as RequestBody;

    const location = body.location?.trim();
    const kind = body.kind || "attraction";

    if (!location) {
      return jsonResponse(
        { error: "location is required." },
        400,
      );
    }
    if (location.length > 180) {
      return jsonResponse(
        { error: "location is too long." },
        400,
      );
    }

    if (!(kind in queryByKind)) {
      return jsonResponse(
        { error: "Unsupported suggestion kind." },
        400,
      );
    }

    const limit = Math.min(
      Math.max(Number(body.limit) || 5, 1),
      8,
    );

    const textQuery =
      `${queryByKind[kind]} near ${location}, India`;

    const googleResponse = await fetchNearbyPlaces(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.rating",
            "places.userRatingCount",
            "places.primaryType",
            "places.primaryTypeDisplayName",
            "places.currentOpeningHours.openNow",
            "places.googleMapsUri",
            "places.location",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "en",
          regionCode: "IN",
          maxResultCount: limit,
        }),
      },
    );

    if (!googleResponse.ok) {
      const detail = await googleResponse.text();

      console.error(
        "Google Places search failed",
        googleResponse.status,
        detail,
      );

      return jsonResponse(
        {
          error: "Nearby places search failed.",
          status: googleResponse.status,
        },
        502,
      );
    }

    const googleData = await googleResponse.json();

    const places = Array.isArray(googleData?.places)
      ? googleData.places
          .slice(0, limit)
          .map(normalisePlace)
      : [];

    return jsonResponse({
      location,
      kind,
      query: textQuery,
      places,
    });
  } catch (error) {
    console.error("nearby-places error", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected nearby places error.",
      },
      500,
    );
  }
});
