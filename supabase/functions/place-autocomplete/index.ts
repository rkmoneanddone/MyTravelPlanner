import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { input, sessionToken } = await req.json();
    const query = typeof input === "string" ? input.trim() : "";

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

    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
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
