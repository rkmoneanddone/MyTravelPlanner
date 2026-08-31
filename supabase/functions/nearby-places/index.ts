const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
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

    const googleResponse = await fetch(
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
