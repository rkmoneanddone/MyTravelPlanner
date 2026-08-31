import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildTravelPlannerPrompt,
  PLANNER_PROMPT_VERSION,
  SYSTEM_INSTRUCTION,
} from "./planner-prompt.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TravelMode = "car" | "train" | "flight" | "mixed";
type ComfortMode = "fastest" | "comfortable" | "family" | "senior" | "budget";
type TripPurpose = "leisure" | "pilgrimage" | "business" | "family_visit" | "mixed";

type TripRequest = {
  origin: string;
  destinations: string[];
  visitMinutes?: number[];
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  travelMode: TravelMode;
  tripPurpose?: TripPurpose;
  travellers: { adults: number; children0to5?: number; children6to12?: number; children?: number; seniors: number };
  comfortMode: ComfortMode;
  facilities?: { stay?: boolean; meals?: boolean; restStops?: boolean; visitBuffer?: boolean; cost?: boolean };
  forceAi?: boolean;
};

type RouteLeg = { from: string; to: string; distanceKm: number | null; durationMinutes: number | null; basis: "road" | "not_applicable" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parseDuration(value?: string) {
  if (!value) return null;
  const match = value.match(/^([0-9.]+)s$/);
  return match ? Math.round(Number(match[1]) / 60) : null;
}

async function routeLeg(from: string, to: string, apiKey: string): Promise<RouteLeg> {
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      body: JSON.stringify({ origin: { address: from }, destination: { address: to }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", computeAlternativeRoutes: false, languageCode: "en-US", units: "METRIC" }),
    });
    if (!response.ok) {
      console.error("Google Routes failed", response.status, await response.text());
      return { from, to, distanceKm: null, durationMinutes: null, basis: "road" };
    }
    const data = await response.json();
    const route = data?.routes?.[0];
    return {
      from,
      to,
      distanceKm: typeof route?.distanceMeters === "number" ? Math.round(route.distanceMeters / 100) / 10 : null,
      durationMinutes: parseDuration(route?.duration),
      basis: "road",
    };
  } catch (error) {
    console.error("routeLeg failed", error);
    return { from, to, distanceKm: null, durationMinutes: null, basis: "road" };
  }
}

function diffDays(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.floor((b - a) / 86400000) + 1;
}

function formatMinutes(total: number | null) {
  if (!total || total <= 0) return null;
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function inr(n: number) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

function travellerFacts(input: TripRequest) {
  const c05 = input.travellers.children0to5 ?? 0;
  const c612 = input.travellers.children6to12 ?? input.travellers.children ?? 0;
  const adults = input.travellers.adults ?? 0;
  const seniors = input.travellers.seniors ?? 0;
  const totalPeople = adults + seniors + c05 + c612;
  const seatsRequired = adults + seniors + c612;
  return { c05, c612, adults, seniors, totalPeople, seatsRequired };
}

function vehicleAdvice(input: TripRequest) {
  const { totalPeople, seatsRequired } = travellerFacts(input);
  if (totalPeople <= 4) return { level: "comfortable", headline: "One regular car is practical", note: "A normal 5-seat car is generally practical if luggage is moderate." };
  if (totalPeople <= 6) return { level: "check_luggage", headline: "Use a larger 6/7-seat vehicle", note: "A compact car will be cramped. Prefer a 6/7-seat MPV/SUV and confirm luggage space." };
  if (totalPeople <= 8) return { level: "large_vehicle", headline: "One ordinary car is not suitable", note: `For ${totalPeople} travellers (${seatsRequired} seats assumed) plus luggage, prefer a large people-mover/tempo traveller or two vehicles.` };
  return { level: "group_vehicle", headline: "Plan group transport", note: `For ${totalPeople} travellers, use a tempo traveller/minibus or multiple vehicles rather than a normal private car.` };
}

function deterministicRules(input: TripRequest, legs: RouteLeg[]) {
  const { c05, c612, seniors } = travellerFacts(input);
  const hasKids = c05 + c612 > 0;
  const hasSenior = seniors > 0;
  const breakEvery = input.comfortMode === "fastest" ? 210 : input.comfortMode === "senior" ? 105 : hasSenior ? 120 : hasKids ? 135 : 165;
  const breakMinutes = input.comfortMode === "fastest" ? 15 : hasSenior ? 30 : hasKids ? 25 : 20;
  const maxTravelPerDay = input.comfortMode === "senior" ? 360 : input.comfortMode === "family" ? 420 : input.comfortMode === "fastest" ? 600 : 480;
  return {
    hasKids, hasSenior, children0to5: c05, children6to12: c612,
    seatRule: "Age 0–5: no separate seat assumed by default. Age 6–12: separate seat assumed.",
    breakEveryMinutes: breakEvery, breakDurationMinutes: breakMinutes,
    gettingReadyMinutes: hasSenior || hasKids ? 75 : 50, mealMinutes: 45, maxTravelPerDay,
    vehicleAdvice: vehicleAdvice(input),
    routeLegs: legs.map((leg) => {
      const drive = leg.durationMinutes ?? 0;
      const breaks = drive > 0 && input.facilities?.restStops !== false ? Math.floor(drive / breakEvery) : 0;
      return { ...leg, recommendedBreaks: breaks, practicalMinutes: drive > 0 ? drive + breaks * breakMinutes : null };
    }),
  };
}

function buildDeterministicRecommendation(input: TripRequest, legs: RouteLeg[], rules: any) {
  const { totalPeople, seatsRequired, c05, c612, seniors } = travellerFacts(input);
  const roadMinutes = legs.reduce((sum, leg) => sum + (leg.durationMinutes ?? 0), 0);
  const roadKm = legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0);
  const practicalRoadMinutes = (rules.routeLegs ?? []).reduce((sum: number, leg: any) => sum + (leg.practicalMinutes ?? 0), 0);
  const purpose = input.tripPurpose ?? "leisure";
  const reasons: string[] = [];
  if (totalPeople >= 7) reasons.push(rules.vehicleAdvice.note);
  if (seniors > 0) reasons.push("Senior travellers benefit from shorter continuous travel blocks and longer rest/freshen-up buffers.");
  if (c05 + c612 > 0) reasons.push("Children make meal, toilet and stretch buffers important; raw map time should not be treated as door-to-door time.");
  if (purpose === "pilgrimage") reasons.push("Protect arrival energy for freshening up, darshan and possible queues instead of planning only around transport time.");
  if (roadMinutes > 600) reasons.push("This is a long road journey; practical family travel will be materially longer than pure driving time and may need an overnight halt.");
  let headline = "Use the selected travel mode with practical buffers";
  if (input.travelMode === "car") headline = totalPeople >= 7 ? "Road trip is practical only with group-sized transport" : "Car is workable with planned breaks";
  if (input.travelMode === "mixed") headline = "Use road travel only for the parts where it adds convenience";
  if (input.travelMode === "train") headline = "Train is the selected long-distance mode; use local road transfer at each end";
  if (input.travelMode === "flight") headline = "Flight is the selected long-distance mode; allow airport and local-transfer buffers";
  return {
    recommendedMode: input.travelMode,
    headline,
    confidence: input.travelMode === "car" && roadMinutes > 0 ? "high" : "planning",
    travellerFit: { totalPeople, seatsRequired, infantsWithoutSeatAssumed: c05, vehicleAdvice: rules.vehicleAdvice },
    roadComparator: roadMinutes > 0 ? {
      distanceKm: Math.round(roadKm), rawDrivingMinutes: roadMinutes, rawDrivingLabel: formatMinutes(roadMinutes),
      practicalMinutes: practicalRoadMinutes || roadMinutes, practicalLabel: formatMinutes(practicalRoadMinutes || roadMinutes),
      note: "Google road time is a driving reference. Practical time adds planned rest breaks; sleep/overnight halt may still be needed on long trips.",
    } : null,
    reasons,
    purpose,
    dataNotes: [
      "Road distance/time is based on Google Routes when available.",
      "Exact train/flight schedules, fares and seat availability are not treated as verified live facts in V1.",
    ],
  };
}

function costEstimate(input: TripRequest, legs: RouteLeg[]) {
  const { c05, c612, adults, seniors, totalPeople, seatsRequired } = travellerFacts(input);
  const days = diffDays(input.startDate, input.endDate) ?? Math.max(2, input.destinations.length + 1);
  const nights = Math.max(0, days - 1);
  const roomUnits = adults + seniors + c612 + c05 * 0.35;
  const rooms = totalPeople > 0 ? Math.max(1, Math.ceil(roomUnits / 3)) : 0;
  const styleStay: Record<string, [number, number]> = { fastest: [2200, 3200], comfortable: [2800, 4200], family: [3000, 4500], senior: [3200, 4800], budget: [1400, 2300] };
  const [roomLow, roomHigh] = styleStay[input.comfortMode] ?? styleStay.comfortable;
  const foodLowPerDay = adults * 550 + seniors * 500 + c612 * 400 + c05 * 220;
  const foodHighPerDay = adults * 850 + seniors * 800 + c612 * 600 + c05 * 350;
  const stayLow = input.facilities?.stay === false ? 0 : rooms * nights * roomLow;
  const stayHigh = input.facilities?.stay === false ? 0 : rooms * nights * roomHigh;
  const foodLow = input.facilities?.meals === false ? 0 : foodLowPerDay * days;
  const foodHigh = input.facilities?.meals === false ? 0 : foodHighPerDay * days;
  const localLow = 350 * days, localHigh = 800 * days;
  const roadKm = legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0);
  let transportLow = 0, transportHigh = 0, transportNote = "";
  if (input.travelMode === "car") {
    const vehicleMultiplier = totalPeople >= 7 ? 1.55 : totalPeople >= 5 ? 1.2 : 1;
    transportLow = roadKm * 8.5 * vehicleMultiplier;
    transportHigh = roadKm * 12 * vehicleMultiplier;
    transportNote = totalPeople >= 7 ? "Road estimate is adjusted upward because a normal car is not suitable for this group size." : "Car estimate uses an all-in planning range per road km for fuel/tolls; not a live quote.";
  } else if (input.travelMode === "mixed") {
    transportLow = roadKm * 5; transportHigh = roadKm * 9;
    transportNote = "Mixed-mode estimate covers only known road components; train/flight fares remain excluded until live fare integration.";
  } else {
    transportNote = `${input.travelMode === "train" ? "Train" : "Flight"} fares are excluded until live schedule/fare integration.`;
  }
  const low = transportLow + stayLow + foodLow + localLow;
  const high = transportHigh + stayHigh + foodHigh + localHigh;
  return {
    currency: "INR", seatsRequired, infantsWithoutSeat: c05, rooms, days, nights,
    transport: { low: Math.round(transportLow), high: Math.round(transportHigh), label: `${inr(transportLow)}–${inr(transportHigh)}`, note: transportNote },
    stay: { low: Math.round(stayLow), high: Math.round(stayHigh), label: `${inr(stayLow)}–${inr(stayHigh)}` },
    food: { low: Math.round(foodLow), high: Math.round(foodHigh), label: `${inr(foodLow)}–${inr(foodHigh)}` },
    local: { low: Math.round(localLow), high: Math.round(localHigh), label: `${inr(localLow)}–${inr(localHigh)}` },
    total: { low: Math.round(low), high: Math.round(high), label: `${inr(low)}–${inr(high)}` },
    note: "Planning estimate only. Live booking prices are intentionally not fetched in V1.",
  };
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") chunks.push(content.text);
  return chunks.join("\n");
}


function parseAiJson(text: string) {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Try object extraction.
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1),
      );
    } catch (error) {
      console.error(
        "AI JSON extraction failed",
        error,
      );
    }
  }

  return null;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const input = (await req.json()) as TripRequest;
    if (!input.origin || !Array.isArray(input.destinations) || input.destinations.filter(Boolean).length === 0) return jsonResponse({ error: "Origin and at least one destination are required." }, 400);
    input.destinations = input.destinations.filter(Boolean);
    input.tripPurpose = input.tripPurpose ?? "leisure";
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const points = [input.origin, ...input.destinations];
    const legs: RouteLeg[] = [];
    const shouldUseRoadRoutes = input.travelMode === "car" || input.travelMode === "mixed";
    for (let i = 0; i < points.length - 1; i++) {
      if (mapsKey && shouldUseRoadRoutes) legs.push(await routeLeg(points[i], points[i + 1], mapsKey));
      else legs.push({ from: points[i], to: points[i + 1], distanceKm: null, durationMinutes: null, basis: "not_applicable" });
    }
    const rules = deterministicRules(input, legs);
    const recommendation = buildDeterministicRecommendation(input, legs, rules);
    const costs = costEstimate(input, legs);
    const facts = travellerFacts(input);
    const roadMinutes = legs.reduce((sum, leg) => sum + (leg.durationMinutes ?? 0), 0);
    const complexity = input.destinations.length + (input.travelMode !== "car" ? 2 : 0) + (facts.seniors > 0 ? 1 : 0) + (facts.c05 + facts.c612 > 0 ? 1 : 0) + (facts.totalPeople >= 7 ? 1 : 0) + (input.tripPurpose === "pilgrimage" ? 1 : 0) + (roadMinutes > 480 ? 1 : 0) + (input.endDate ? 1 : 0);
    const useAi = Boolean(openAiKey) && (input.forceAi === true || complexity >= 3);
    if (!useAi) return jsonResponse({ source: "rules", aiUsed: false, routeData: legs, rules, recommendation, costEstimate: costs, plan: null });
    const visitMinutes = input.visitMinutes?.length ? input.visitMinutes : input.destinations.map(() => 120);
    const prompt = buildTravelPlannerPrompt({
      input,
      visitMinutes,
      legs,
      facts,
      rules,
      recommendation,
    });

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.6-luna", reasoning: { effort: "low" }, input: [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: JSON.stringify(prompt) }], max_output_tokens: 2600 })
    });
    if (!aiResponse.ok) {
      console.error("AI optimiser failed", aiResponse.status, await aiResponse.text());
      return jsonResponse({ source: "rules", aiUsed: false, warning: "AI optimiser unavailable; deterministic recommendation and verified route facts are still available.", routeData: legs, rules, recommendation, costEstimate: costs, plan: null });
    }
    const aiData = await aiResponse.json();

    const text = extractResponseText(aiData);
    const plan = parseAiJson(text);

    const aiDebug = {
      promptVersion: PLANNER_PROMPT_VERSION,
      httpStatus: aiResponse.status,
      parsed: Boolean(plan),
      responseTextLength: text.length,
      outputStatus: aiData?.status ?? null,
      incompleteReason:
        aiData?.incomplete_details?.reason ?? null,
      apiError:
        aiData?.error?.message ?? null,
    };

    console.log(
      "MyTravelPlanner AI",
      JSON.stringify(aiDebug),
    );
    return jsonResponse({
      source: plan ? "ai" : "rules",
      aiUsed: Boolean(plan),
      routeData: legs,
      rules,
      recommendation,
      costEstimate: costs,
      plan,
      aiDebug,
    });
  } catch (error) {
    console.error("generate-trip error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
