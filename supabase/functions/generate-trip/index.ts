import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TripRequest = {
  origin: string;
  destinations: string[];
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  travelMode: "car" | "train" | "flight" | "mixed";
  travellers: { adults: number; children: number; seniors: number };
  comfortMode: "fastest" | "comfortable" | "family" | "senior" | "budget";
};

type RouteLeg = {
  from: string;
  to: string;
  distanceKm: number | null;
  durationMinutes: number | null;
};

function parseDuration(value?: string) {
  if (!value) return null;
  const match = value.match(/^([0-9.]+)s$/);
  return match ? Math.round(Number(match[1]) / 60) : null;
}

async function routeLeg(from: string, to: string, apiKey: string): Promise<RouteLeg> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: from },
      destination: { address: to },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "METRIC",
    }),
  });

  if (!response.ok) return { from, to, distanceKm: null, durationMinutes: null };

  const data = await response.json();
  const route = data?.routes?.[0];

  return {
    from,
    to,
    distanceKm: typeof route?.distanceMeters === "number" ? Math.round(route.distanceMeters / 100) / 10 : null,
    durationMinutes: parseDuration(route?.duration),
  };
}

function deterministicPlan(input: TripRequest, legs: RouteLeg[]) {
  const hasSenior = input.travellers.seniors > 0;
  const hasKids = input.travellers.children > 0;
  const baseBreakEvery = input.comfortMode === "fastest" ? 210 : input.comfortMode === "senior" ? 120 : 150;
  const breakMinutes = input.comfortMode === "fastest" ? 15 : hasSenior ? 30 : hasKids ? 25 : 20;

  return {
    assumptions: {
      hasSenior,
      hasKids,
      breakEveryMinutes: baseBreakEvery,
      breakDurationMinutes: breakMinutes,
    },
    legs: legs.map((leg) => {
      const drive = leg.durationMinutes ?? 0;
      const breaks = drive > 0 ? Math.max(0, Math.floor(drive / baseBreakEvery)) : 0;
      return {
        ...leg,
        recommendedBreaks: breaks,
        practicalMinutes: drive > 0 ? drive + breaks * breakMinutes : null,
      };
    }),
  };
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const input = (await req.json()) as TripRequest;

    if (!input.origin || !Array.isArray(input.destinations) || input.destinations.length === 0) {
      return new Response(JSON.stringify({ error: "Origin and at least one destination are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const points = [input.origin, ...input.destinations];
    const legs: RouteLeg[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      legs.push(
        mapsKey
          ? await routeLeg(points[i], points[i + 1], mapsKey)
          : { from: points[i], to: points[i + 1], distanceKm: null, durationMinutes: null }
      );
    }

    const rulePlan = deterministicPlan(input, legs);

    if (!openAiKey) {
      return new Response(JSON.stringify({
        source: "rules",
        warning: "OPENAI_API_KEY is not configured yet.",
        routeData: legs,
        plan: rulePlan,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = {
      task: "Create a realistic family travel itinerary for India. Return JSON only.",
      requirements: [
        "Respect supplied dates; if endDate is null decide a realistic trip length.",
        "Account for children and seniors with practical breaks, meals, getting-ready time and sleep.",
        "Avoid unsafe or exhausting schedules and explain any necessary overnight stay.",
        "Do not invent live train, flight, hotel availability, prices, temple timings or road facts not supplied.",
        "Use routeData as factual driving data when present.",
        "Return concise day-wise itinerary, practical timings, stay city/area, meal/rest buffers, warnings, and rough cost categories without pretending live pricing."
      ],
      input,
      routeData: legs,
      deterministicRules: rulePlan,
    };

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: "You are the itinerary reasoning layer for MyTravelPlanner. Be conservative, practical, family-safe, and output strict JSON with no markdown."
          },
          { role: "user", content: JSON.stringify(prompt) },
        ],
        max_output_tokens: 3500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({
        source: "rules",
        warning: "AI generation failed",
        aiError: errText,
        routeData: legs,
        plan: rulePlan,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const text = extractResponseText(aiData).trim();

    let plan: unknown = text;
    try { plan = JSON.parse(text); } catch {}

    return new Response(JSON.stringify({ source: "ai", routeData: legs, plan }), {
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
