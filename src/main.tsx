import React from "react";
import ReactDOM from "react-dom/client";
import {
  MapPin, Menu, UserRound, ArrowRight, ArrowLeft, Car, Train, Plane,
  UsersRound, Sparkles, Plus, Minus, CalendarDays, Clock3,
  Route, ShieldCheck, Baby, UserRoundCheck, WalletCards,
  Gauge, HeartHandshake, MapPinned, Check, Save, FolderOpen, LogOut,
  X, Trash2, Copy, Share2, Printer, LoaderCircle, RotateCcw, Hotel,
  UtensilsCrossed, CircleAlert,
  Coffee

} from "lucide-react";
import "./styles.css";
import { AuthModal } from "./components/AuthModal";
import { LegalPageModal, SiteFooter, type LegalPage } from "./components/LegalPages";
import { supabase } from "./lib/supabase";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

type NearbyKind = "hotel" | "restaurant" | "pilgrimage" | "attraction";

type NearbyPlace = {
  id: string | null;
  name: string;
  address: string;
  rating: number | null;
  ratingCount: number | null;
  primaryType: string;
  openNow: boolean | null;
  mapsUri: string | null;
  location: {
    lat: number;
    lng: number;
  } | null;
};

// Nearby searches are deliberately cached only for this browser session.
// We do not persist these search results to the trip database.
const nearbySuggestionCache =
  new Map<string, NearbyPlace[]>();

type PlaceSuggestion = {
  placeId: string;
  place: string;
  text: string;
  mainText: string;
  secondaryText: string;
};

type Step = 1 | 2 | 3 | 4;

// Session-level cache prevents repeated Places API calls for the same text.
// This is deliberately lightweight and resets when the page reloads.
const placeSuggestionCache = new Map<string, PlaceSuggestion[]>();

type Mode = "car" | "train" | "flight" | "mixed";
type Style = "fastest" | "comfortable" | "family" | "senior" | "budget";
type Purpose = "leisure" | "pilgrimage" | "business" | "family_visit" | "mixed";

type TripState = {
  origin: string;
  destinations: string[];
  visitMinutes: number[];
  startDate: string;
  endDate: string;
  startTime: string;
  mode: Mode;
  adults: number;
  children0to5: number;
  children6to12: number;
  seniors: number;
  purpose: Purpose;
  style: Style;
  facilities: {
    stay: boolean;
    meals: boolean;
    restStops: boolean;
    visitBuffer: boolean;
    cost: boolean;
  };
};

type SavedTrip = {
  id: string;
  title: string | null;
  origin: string | null;
  destinations: string[];
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  travel_mode: Mode | null;
  traveller_config: {
    adults?: number;
    children?: number;
    children0to5?: number;
    children6to12?: number;
    seniors?: number;
  } | null;
  comfort_mode: Style | null;
  trip_input: TripState | null;
  itinerary: any;
  estimated_cost: any;
  created_at: string;
  is_shared?: boolean;
  share_token?: string | null;
  copied_from?: string | null;
};

type SharedTripPayload = {
  id: string;
  is_owner: boolean;
  title: string | null;
  origin: string | null;
  destinations: string[];
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  travel_mode: Mode | null;
  traveller_config: SavedTrip["traveller_config"];
  comfort_mode: Style | null;
  trip_input: TripState | null;
  itinerary: any;
  estimated_cost: any;
  created_at: string;
  updated_at: string;
};

// Temporary auth-resume state.
// sessionStorage is used so unfinished trip data survives OAuth redirect
// without creating a database record or permanent browser storage.
const PENDING_TRIP_KEY = "mtp.pendingTrip";
const PENDING_STEP_KEY = "mtp.pendingStep";
const PENDING_GENERATE_KEY = "mtp.pendingGenerate";
const PENDING_SHARED_COPY_KEY = "mtp.pendingSharedCopy";

const initialTrip: TripState = {
  origin: "",
  destinations: [""],
  visitMinutes: [120],
  startDate: "",
  endDate: "",
  startTime: "",
  mode: "car",
  adults: 2,
  children0to5: 0,
  children6to12: 0,
  seniors: 0,
  purpose: "leisure",
  style: "comfortable",
  facilities: {
    stay: false,
    meals: false,
    restStops: false,
    visitBuffer: false,
    cost: true,
  },
};

function App() {
  const [legalPage, setLegalPage] = React.useState<LegalPage | null>(null);
  const [step, setStep] = React.useState<Step>(1);
  const [trip, setTrip] = React.useState<TripState>(initialTrip);
  const [generated, setGenerated] = React.useState(false);
  const [plan, setPlan] = React.useState<any>(null);
  const [routeData, setRouteData] = React.useState<any[]>([]);
  const [rules, setRules] = React.useState<any>(null);
  const [recommendation, setRecommendation] = React.useState<any>(null);
  const [costEstimate, setCostEstimate] = React.useState<any>(null);
  const [generationSource, setGenerationSource] = React.useState<"local" | "rules" | "ai">("local");
  const [generationWarning, setGenerationWarning] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const [authOpen, setAuthOpen] = React.useState(false);
  const [tripsOpen, setTripsOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState("");
  const [activeSavedTripId, setActiveSavedTripId] = React.useState<string | null>(null);
  const [sharedToken, setSharedToken] = React.useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get("share");
  });
  const [sharedTripData, setSharedTripData] = React.useState<SharedTripPayload | null>(null);
  const [sharedLoading, setSharedLoading] = React.useState(false);
  const [sharedError, setSharedError] = React.useState("");

  // Restore an unfinished trip after an OAuth redirect.
  React.useEffect(()=>{
    try {
      const savedTrip=sessionStorage.getItem(PENDING_TRIP_KEY);
      const savedStep=sessionStorage.getItem(PENDING_STEP_KEY);

      if(savedTrip){
        setTrip(JSON.parse(savedTrip) as TripState);
      }

      if(savedStep){
        const parsed=Number(savedStep);
        if(parsed>=1 && parsed<=4){
          setStep(parsed as Step);
        }
      }
    } catch (error) {
      console.warn("Could not restore pending trip",error);
      sessionStorage.removeItem(PENDING_TRIP_KEY);
      sessionStorage.removeItem(PENDING_STEP_KEY);
      sessionStorage.removeItem(PENDING_GENERATE_KEY);
    }
  },[]);

  const pendingGenerateHandled = React.useRef(false);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!sharedToken) {
      setSharedTripData(null);
      setSharedError("");
      return;
    }

    let cancelled = false;

    const loadSharedTrip = async () => {
      setSharedLoading(true);
      setSharedError("");

      const { data, error } = await supabase.rpc("get_shared_trip", {
        p_token: sharedToken,
      });

      if (cancelled) return;

      if (error) {
        setSharedTripData(null);
        setSharedError("This shared trip is unavailable or has been unshared.");
        setSharedLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;

      if (!row) {
        setSharedTripData(null);
        setSharedError("This shared trip is unavailable or has been unshared.");
        setSharedLoading(false);
        return;
      }

      setSharedTripData(row as SharedTripPayload);
      setSharedLoading(false);
    };

    loadSharedTrip();

    return () => {
      cancelled = true;
    };
  }, [sharedToken]);
  // Resume the user's original Generate action after successful login.
  // The handled ref ensures auth callbacks cannot trigger generation twice.
  React.useEffect(()=>{
    if(!userId || pendingGenerateHandled.current) return;
    if(sessionStorage.getItem(PENDING_GENERATE_KEY)!=="1") return;

    pendingGenerateHandled.current=true;

    const timer=window.setTimeout(()=>{
      sessionStorage.removeItem(PENDING_TRIP_KEY);
      sessionStorage.removeItem(PENDING_STEP_KEY);
      sessionStorage.removeItem(PENDING_GENERATE_KEY);

      generate();
    },0);

    return ()=>window.clearTimeout(timer);
  },[userId]);

  const updateTrip = <K extends keyof TripState>(key: K, value: TripState[K]) => {
    setTrip((t) => ({ ...t, [key]: value }));
  };

  const next = () => setStep((s) => Math.min(4, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const reset = () => {
    setTrip(initialTrip);
    setStep(1);
    setGenerated(false);
    setPlan(null);
    setRouteData([]);
    setRules(null);
    setRecommendation(null);
    setCostEstimate(null);
    setGenerationWarning("");
    setActiveSavedTripId(null);
  };

  const localPlan = () => {
    const totalPeople =
      trip.adults +
      trip.children0to5 +
      trip.children6to12 +
      trip.seniors;

    const hasKids = trip.children0to5 + trip.children6to12 > 0;
    const hasSenior = trip.seniors > 0;

    const readyMinutes = hasKids || hasSenior ? 75 : 50;
    const mealMinutes = 45;

    const days = trip.destinations
      .filter(Boolean)
      .map((destination,index)=>{
        const from = index===0 ? trip.origin : trip.destinations[index-1];
        const visitMinutes = trip.visitMinutes?.[index] || 120;

        const items:any[] = [
          {
            time: index===0 ? (trip.startTime || "Start") : "Morning",
            type: "travel",
            title: `Travel: ${from} → ${destination}`,
            durationMinutes: null,
            note: `${titleCase(trip.mode)} travel duration will be filled from route/schedule data when available.`
          }
        ];

        if (trip.facilities?.visitBuffer !== false) {
          items.push({
            time: "On arrival",
            type: "ready",
            title: "Freshen up / get ready",
            durationMinutes: readyMinutes,
            note: "Arrival, washroom and getting-ready buffer."
          });
        }

        if (trip.facilities?.meals !== false) {
          items.push({
            time: "Before visit",
            type: "meal",
            title: "Meal / hydration break",
            durationMinutes: mealMinutes,
            note: "Flexible meal buffer based on actual arrival."
          });
        }

        items.push({
          time: "After ready/meal",
          type: "visit",
          title: `Visit / darshan: ${destination}`,
          durationMinutes: visitMinutes,
          note: "Confirm official opening/darshan timing before travel."
        });

        return {
          day:index+1,
          date:index===0 ? trip.startDate || null : null,
          title:`${from} to ${destination}`,
          load:"balanced",
          items,
          stay:trip.facilities?.stay !== false ? destination : null,
          warnings:[]
        };
      });

    return {
      title:`${trip.origin} to ${trip.destinations.filter(Boolean).join(" to ")}`,
      summary:{
        days:Math.max(1,days.length),
        comfort:trip.style,
        travellerNote:`${totalPeople} travellers`,
        notes:[
          "Practical family travel draft.",
          "Live operator schedules and official venue timings are not invented."
        ]
      },
      days,
      warnings:[
        "Confirm official venue timings before departure.",
        "Check final train/flight/operator seat rules before booking."
      ]
    };
  };
  const generate = async () => {
    if (generating) return;
    // Generation can consume paid route/AI services.
    // Require an authenticated user before creating any plan or server call.
    if (!userId) {
      // Preserve the complete in-progress trip before authentication.
      // This prevents OAuth redirect from clearing the user's selections.
      try {
        sessionStorage.setItem(PENDING_TRIP_KEY,JSON.stringify(trip));
        sessionStorage.setItem(PENDING_STEP_KEY,String(step));
        sessionStorage.setItem(PENDING_GENERATE_KEY,"1");
      } catch (error) {
        console.warn("Could not preserve pending trip",error);
      }

      setAuthOpen(true);
      return;
    }

    setGenerating(true);
    setGenerationWarning("");
    setSaveState("");

    // Keep a safe local fallback only for authenticated generation failures.
    const fallback = localPlan();
    setPlan(fallback);
    setGenerationSource("local");
    setGenerated(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-trip", {
        body: {
          origin: trip.origin,
          destinations: trip.destinations.filter(Boolean),
          visitMinutes: trip.visitMinutes,
          startDate: trip.startDate || null,
          endDate: trip.endDate || null,
          startTime: trip.startTime || null,
          travelMode: trip.mode,
          travellers: {
            adults: trip.adults,
            children0to5: trip.children0to5,
            children6to12: trip.children6to12,
            seniors: trip.seniors,
          },
          tripPurpose: trip.purpose,
          comfortMode: trip.style,
          facilities: trip.facilities,
          forceAi: true,
        },
      });

      if (error) throw error;

      const routes = Array.isArray(data?.routeData) ? data.routeData : [];

      setRouteData(routes);
      setRules(data?.rules || null);
      setRecommendation(data?.recommendation || null);
      setCostEstimate(data?.costEstimate || null);

      if (data?.plan) {
        setPlan(data.plan);
      }

      setGenerationSource(data?.source === "ai" ? "ai" : "rules");
      setGenerationWarning(data?.warning || "");
    } catch (err) {
      setGenerationWarning(err instanceof Error ? err.message : "AI service unavailable. Showing safe draft plan.");
    } finally {
      setGenerating(false);
    }
  };

  const saveTrip = async (): Promise<string | null> => {
    if (!userId) {
      setAuthOpen(true);
      return null;
    }

    setSaveState("Saving...");

    const tripRecord = {
      user_id: userId,
      title: `${trip.origin} to ${trip.destinations.join(" to ")}`,
      origin: trip.origin,
      destinations: trip.destinations,
      start_date: trip.startDate || null,
      end_date: trip.endDate || null,
      start_time: trip.startTime || null,
      travel_mode: trip.mode,
      traveller_config: {
        adults: trip.adults,
        children0to5: trip.children0to5,
        children6to12: trip.children6to12,
        seniors: trip.seniors
      },
      comfort_mode: trip.style,
      trip_input: trip,
      itinerary: plan,
      estimated_cost: costEstimate ?? plan?.costEstimate ?? null,
    };

    let saveError = null;
    let savedId = activeSavedTripId;
    const wasUpdate = Boolean(activeSavedTripId);

    if (activeSavedTripId) {
      const { error } = await supabase
        .from("trips")
        .update(tripRecord)
        .eq("id", activeSavedTripId);

      saveError = error;
    } else {
      const { data, error } = await supabase
        .from("trips")
        .insert(tripRecord)
        .select("id")
        .single();

      saveError = error;

      if (!error && data?.id) {
        savedId = data.id;
        setActiveSavedTripId(data.id);
      }
    }

    if (saveError) {
      setSaveState(saveError.message);
      return null;
    }

    setSaveState(wasUpdate ? "Updated" : "Saved");
    setTimeout(() => setSaveState(""), 2000);
    return savedId;
  };

  const savedTripToState = (saved: SavedTrip | SharedTripPayload): TripState => ({
    origin: saved.origin || "",
    destinations: saved.trip_input?.destinations?.length
      ? saved.trip_input.destinations
      : (saved.destinations?.length ? saved.destinations : [""]),
    visitMinutes: saved.trip_input?.visitMinutes?.length
      ? saved.trip_input.visitMinutes
      : (saved.destinations?.length ? saved.destinations.map(() => 120) : [120]),
    startDate: saved.start_date || "",
    endDate: saved.end_date || "",
    startTime: saved.start_time || "",
    mode: saved.travel_mode || "mixed",
    adults: saved.traveller_config?.adults ?? 1,
    children0to5: saved.traveller_config?.children0to5 ?? 0,
    children6to12:
      saved.traveller_config?.children6to12 ??
      saved.traveller_config?.children ??
      0,
    seniors: saved.traveller_config?.seniors ?? 0,
    purpose: saved.trip_input?.purpose || "leisure",
    style: saved.trip_input?.style || saved.comfort_mode || "comfortable",
    facilities: saved.trip_input?.facilities || {
      stay: false,
      meals: false,
      restStops: false,
      visitBuffer: false,
      cost: true,
    },
  });

  const openSavedTrip = (saved: SavedTrip) => {
    setTrip(savedTripToState(saved));
    setPlan(saved.itinerary || null);
    setCostEstimate(saved.estimated_cost || null);
    setGenerated(Boolean(saved.itinerary));
    setStep(saved.itinerary ? 4 : 1);
    setActiveSavedTripId(saved.id);
    setTripsOpen(false);
  };

  const ensureShareUrl = async (): Promise<string | null> => {
    if (!userId) {
      setAuthOpen(true);
      return null;
    }

    const tripId = activeSavedTripId || await saveTrip();
    if (!tripId) return null;

    const { data, error } = await supabase
      .from("trips")
      .update({ is_shared: true })
      .eq("id", tripId)
      .select("share_token")
      .single();

    if (error || !data?.share_token) {
      setSaveState(error?.message || "Could not create share link");
      return null;
    }

    const configuredSiteUrl =
      import.meta.env.VITE_PUBLIC_SITE_URL?.trim();

    const url = new URL(
      configuredSiteUrl || window.location.origin
    );

    url.pathname = "/";
    url.search = "";
    url.hash = "";
    url.searchParams.set("share", data.share_token);

    return url.toString();
  };

  const saveSharedAsOwn = async () => {
    if (!sharedTripData || !sharedToken) return;

    if (!userId) {
      sessionStorage.setItem(PENDING_SHARED_COPY_KEY, sharedToken);
      setAuthOpen(true);
      return;
    }

    setSaveState("Saving copy...");

    const sourceState = savedTripToState(sharedTripData);

    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        title: sharedTripData.title || `${sourceState.origin} to ${sourceState.destinations.join(" to ")}`,
        origin: sourceState.origin,
        destinations: sourceState.destinations,
        start_date: sourceState.startDate || null,
        end_date: sourceState.endDate || null,
        start_time: sourceState.startTime || null,
        travel_mode: sourceState.mode,
        traveller_config: {
          adults: sourceState.adults,
          children0to5: sourceState.children0to5,
          children6to12: sourceState.children6to12,
          seniors: sourceState.seniors,
        },
        comfort_mode: sourceState.style,
        trip_input: sourceState,
        itinerary: sharedTripData.itinerary,
        estimated_cost: sharedTripData.estimated_cost,
        copied_from: sharedTripData.id,
        is_shared: false,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setSaveState(error?.message || "Could not save trip copy");
      return;
    }

    sessionStorage.removeItem(PENDING_SHARED_COPY_KEY);

    setTrip(sourceState);
    setPlan(sharedTripData.itinerary || null);
    setCostEstimate(sharedTripData.estimated_cost || null);
    setGenerated(Boolean(sharedTripData.itinerary));
    setStep(sharedTripData.itinerary ? 4 : 1);
    setActiveSavedTripId(data.id);
    setSharedToken(null);
    setSharedTripData(null);
    setSaveState("Saved as your trip");
    setTimeout(() => setSaveState(""), 2000);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("share");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  };

  React.useEffect(() => {
    if (!userId || !sharedTripData || !sharedToken) return;

    if (sharedTripData.is_owner) {
      const sourceState = savedTripToState(sharedTripData);
      setTrip(sourceState);
      setPlan(sharedTripData.itinerary || null);
      setCostEstimate(sharedTripData.estimated_cost || null);
      setGenerated(Boolean(sharedTripData.itinerary));
      setStep(sharedTripData.itinerary ? 4 : 1);
      setActiveSavedTripId(sharedTripData.id);
      setSharedToken(null);
      setSharedTripData(null);

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("share");
      window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      return;
    }

    if (sessionStorage.getItem(PENDING_SHARED_COPY_KEY) === sharedToken) {
      saveSharedAsOwn();
    }
  }, [userId, sharedTripData, sharedToken]);
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="page-width header-inner">
          <a
            className="brand brand-button"
            href="/"
            onClick={(event)=>{
              event.preventDefault();
              reset();
              window.history.replaceState(null,"","/");
            }}
            aria-label="MyTravelPlanner home"
          >
            <span className="brand-icon"><MapPin size={20}/></span>
            <span>MyTravelPlanner</span>
          </a>

          <div className="header-actions">
            {userEmail && (
              <button className="header-btn" onClick={()=>setTripsOpen(true)}>
                <FolderOpen size={17}/><span>My Trips</span>
              </button>
            )}

            <button className="header-btn" onClick={()=> userEmail ? undefined : setAuthOpen(true)}>
              <UserRound size={17}/>
              <span>{userEmail ? userEmail.split("@")[0] : "Login"}</span>
            </button>

            {userEmail ? (
              <button className="header-icon-btn" onClick={signOut} title="Logout"><LogOut size={18}/></button>
            ) : (
              <button className="header-icon-btn" title="Menu"><Menu size={20}/></button>
            )}
          </div>
        </div>
      </header>

      <main className="page-width main">
        {sharedToken ? (
          sharedLoading ? (
            <div className="planner-card">
              <LoaderCircle className="spin" size={22}/>
              <span>Loading shared trip...</span>
            </div>
          ) : sharedError ? (
            <div className="planner-card">
              <CircleAlert size={22}/>
              <strong>{sharedError}</strong>
            </div>
          ) : sharedTripData ? (
            <Result
              trip={savedTripToState(sharedTripData)}
              plan={sharedTripData.itinerary}
              routeData={[]}
              rules={null}
              costEstimate={sharedTripData.estimated_cost}
              source="shared"
              warning=""
              generating={false}
              saveState={saveState}
              onSave={()=>{}}
              onEdit={()=>{}}
              onRegenerate={()=>{}}
              readOnly
              onSaveCopy={saveSharedAsOwn}
              onGetShareUrl={async()=>window.location.href}
            />
          ) : null
        ) : !generated ? (
          <>
            <section className="hero-strip">
              <div className="hero-icon"><MapPinned size={27}/></div>
              <div className="hero-copy">
                <span className="eyebrow">FAMILY TRIP PLANNER</span>
                <h1>Plan the journey, not just the route.</h1>
                <p>Where you are going + who is travelling + the comfort you need.</p>
              </div>
              <div className="hero-badges">
                <span><ShieldCheck size={16}/> Practical timing</span>
                <span><HeartHandshake size={16}/> Family friendly</span>
              </div>
            </section>

            <StepBar step={step}/>

            <section className={`planner-card theme-${["route","travellers","comfort","review"][step-1]}`}>
              <div className="step-heading">
                <span className="step-bubble">{step}</span>
                <div>
                  <h2>{["Plan your route","Who is travelling?","Trip purpose & style","Review your trip"][step-1]}</h2>
                  <p>{[
                    "Add your route, dates and travel mode.",
                    "No names needed. Just tell us the group.",
                    "Tell us why you are travelling and how you want the journey planned.",
                    "Check the basics, then build the itinerary."
                  ][step-1]}</p>
                </div>
              </div>

              {step === 1 && <RouteStep trip={trip} updateTrip={updateTrip} onNext={next}/>}
              {step === 2 && <TravellersStep trip={trip} updateTrip={updateTrip} onBack={back} onNext={next}/>}
              {step === 3 && <ComfortStep trip={trip} updateTrip={updateTrip} onBack={back} onNext={next}/>}
              {step === 4 && <ReviewStep trip={trip} onBack={back} onGenerate={generate} generating={generating}/>}
            </section>

            <p className="helper">Build your trip details freely. Login is required when you generate, optimise or save a travel plan.</p>
          </>
        ) : (
          <Result
            trip={trip}
            plan={plan}
            routeData={routeData}
            rules={rules}
            costEstimate={costEstimate}
            source={generationSource}
            warning={generationWarning}
            generating={generating}
            saveState={saveState}
            onSave={saveTrip}
            onEdit={()=>{setGenerated(false);setStep(1)}}
            onRegenerate={generate}
            readOnly={false}
            onSaveCopy={()=>{}}
            onGetShareUrl={ensureShareUrl}
          />
        )}
      </main>

      <SiteFooter onOpen={setLegalPage}/>
      <LegalPageModal page={legalPage} onClose={()=>setLegalPage(null)}/>
      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)}/>
      <MyTripsModal open={tripsOpen} onClose={()=>setTripsOpen(false)} onOpenTrip={openSavedTrip}/>
    </div>
  );
}

function StepBar({step}:{step:Step}) {
  const items = [["Route",Route],["Travellers",UsersRound],["Trip Style",HeartHandshake],["Review",Sparkles]] as const;
  return (
    <div className="step-bar">
      {items.map(([label,Icon],i)=>{
        const n=i+1;
        return (
          <div key={label} className={`step-item step-${n} ${n===step?"active":""} ${n<step?"done":""}`}>
            <span className="step-icon">{n<step?<Check size={16}/>:<Icon size={16}/>}</span>
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function RouteStep({trip,updateTrip,onNext}:{trip:TripState;updateTrip:any;onNext:()=>void}) {

  // Local calendar date used to block dates before today.
  const today = React.useMemo(()=>{
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  },[]);
  const setDestination = (index:number,value:string)=>{
    const next=[...trip.destinations];
    next[index]=value;
    updateTrip("destinations",next);
  };

  const addDestination=()=>updateTrip("destinations",[...trip.destinations,""]);
  const removeDestination=(index:number)=>{
    if(trip.destinations.length===1)return;
    updateTrip("destinations",trip.destinations.filter((_,i)=>i!==index));
  };

  // Route-step validation is explicit so the UI can explain
  // why Continue is disabled.
  const hasOrigin = Boolean(trip.origin?.trim());
  const hasDestination = trip.destinations.some(x=>Boolean(x?.trim()));
  const hasValidStartDate = Boolean(trip.startDate && trip.startDate >= today);

  const valid = hasOrigin && hasDestination && hasValidStartDate;

  return (
    <div className="step-content">
      <div className="route-stack">
        <FieldBox color="blue" icon={<MapPin size={20}/>} label="STARTING FROM">
          <PlaceAutocomplete
            value={trip.origin}
            onChange={(value)=>updateTrip("origin",value)}
            placeholder="Enter starting city"
          />
        </FieldBox>

        {trip.destinations.map((destination,index)=>(
          <div className="destination-row" key={index}>
            <FieldBox color={index%2===0?"orange":"purple"} icon={<MapPinned size={20}/>} label={index===0?"GOING TO":`STOP ${index+1}`}>
              <PlaceAutocomplete
                value={destination}
                onChange={(value)=>setDestination(index,value)}
                placeholder="Enter destination"
              />
            </FieldBox>
            {trip.destinations.length>1 && (
              <button className="remove-stop" onClick={()=>removeDestination(index)} aria-label="Remove destination"><X size={17}/></button>
            )}
          </div>
        ))}
      </div>

      <button className="add-stop" onClick={addDestination}><Plus size={17}/> Add another stop</button>

      <div className="group-label">How will you travel?</div>
      <div className="travel-grid">
        <ModeButton active={trip.mode==="car"} onClick={()=>updateTrip("mode","car")} color="blue" icon={<Car size={20}/>} title="Car" subtitle="Drive"/>
        <ModeButton active={trip.mode==="train"} onClick={()=>updateTrip("mode","train")} color="purple" icon={<Train size={20}/>} title="Train" subtitle="Rail"/>
        <ModeButton active={trip.mode==="flight"} onClick={()=>updateTrip("mode","flight")} color="rose" icon={<Plane size={20}/>} title="Flight" subtitle="Fly"/>
        <ModeButton active={trip.mode==="mixed"} onClick={()=>updateTrip("mode","mixed")} color="green" icon={<Route size={20}/>} title="Mixed" subtitle="Combine"/>
      </div>

      <div className="group-label">When are you travelling?</div>
      <div className="date-grid">
        <FieldBox color="rose" icon={<CalendarDays size={19}/>} label="START DATE">
          <input type="date" min={today} value={trip.startDate} onChange={e=>updateTrip("startDate",e.target.value)}/>
        </FieldBox>
        <FieldBox color="amber" icon={<Clock3 size={19}/>} label="START TIME">
          <input type="time" value={trip.startTime} onChange={e=>updateTrip("startTime",e.target.value)}/>
        </FieldBox>
        <FieldBox color="purple" icon={<CalendarDays size={19}/>} label="END DATE (OPTIONAL)">
          <input type="date" min={trip.startDate || today} value={trip.endDate} onChange={e=>updateTrip("endDate",e.target.value)}/>
        </FieldBox>
        <div className="date-help">
          <span className="date-help-icon"><Sparkles size={18}/></span>
          <span>Leave End Date empty and the planner will decide a practical trip duration.</span>
        </div>
      </div>

      {!valid && (
        <div className="route-validation-hint">
          {!hasOrigin && <span>Choose a starting place.</span>}
          {!hasDestination && <span>Choose where you are going.</span>}
          {!hasValidStartDate && <span>Select today or a future start date.</span>}
        </div>
      )}

      <Footer nextText="Continue to Travellers" onNext={onNext} disabled={!valid}/>
    </div>
  )
}

function TravellersStep({trip,updateTrip,onBack,onNext}:{trip:TripState;updateTrip:any;onBack:()=>void;onNext:()=>void}) {
  const total=trip.adults+trip.children0to5+trip.children6to12+trip.seniors;
  const seats=trip.adults+trip.children6to12+trip.seniors;
  return (
    <div className="step-content">
      <div className="traveller-grid">
        <Counter title="Adults" note="Age 13 to 59" value={trip.adults} setValue={(v)=>updateTrip("adults",v)} color="blue" icon={<UserRoundCheck size={20}/>}/>
        <Counter title="Children 0–5" note="No separate seat assumed" value={trip.children0to5} setValue={(v)=>updateTrip("children0to5",v)} color="green" icon={<Baby size={20}/>}/>
        <Counter title="Children 6–12" note="Separate seat assumed" value={trip.children6to12} setValue={(v)=>updateTrip("children6to12",v)} color="orange" icon={<Baby size={20}/>}/>
        <Counter title="Seniors" note="Age 60+" value={trip.seniors} setValue={(v)=>updateTrip("seniors",v)} color="purple" icon={<HeartHandshake size={20}/>}/>
      </div>

      <div className="notice">
        <UsersRound size={18}/>
        <span><b>{total} traveller{total===1?"":"s"}</b> · <b>{seats} seat{seats===1?"":"s"} assumed</b>. Age 0–5: no separate seat assumed. Age 6–12: separate seat assumed. Check final operator rules before booking.</span>
      </div>

      <Footer back onBack={onBack} nextText="Continue to Comfort" onNext={onNext} disabled={total<1}/>
    </div>
  )
}

function ComfortStep({trip,updateTrip,onBack,onNext}:{trip:TripState;updateTrip:any;onBack:()=>void;onNext:()=>void}) {
  const options=[
    {key:"fastest" as Style,title:"Fastest",note:"Reach sooner, fewer breaks",icon:<Gauge size={20}/>,color:"blue"},
    {key:"comfortable" as Style,title:"Comfortable",note:"Balanced travel and rest",icon:<HeartHandshake size={20}/>,color:"green"},
    {key:"family" as Style,title:"Family",note:"Meal and child-friendly breaks",icon:<UsersRound size={20}/>,color:"orange"},
    {key:"senior" as Style,title:"Senior friendly",note:"Shorter travel blocks, more rest",icon:<ShieldCheck size={20}/>,color:"purple"},
    {key:"budget" as Style,title:"Budget",note:"Spend less where practical",icon:<WalletCards size={20}/>,color:"rose"},
  ];

  const purposes=[
    {
      key:"leisure" as Purpose,
      title:"Leisure",
      note:"Holiday, relaxation or sightseeing",
      icon:<MapPinned size={20}/>
    },
    {
      key:"pilgrimage" as Purpose,
      title:"Pilgrimage",
      note:"Darshan, temple or religious visit",
      icon:<Sparkles size={20}/>
    },
    {
      key:"business" as Purpose,
      title:"Business",
      note:"Meetings, work or official travel",
      icon:<WalletCards size={20}/>
    },
    {
      key:"family_visit" as Purpose,
      title:"Family / Personal",
      note:"Visit family, friends or personal work",
      icon:<UsersRound size={20}/>
    },
    {
      key:"mixed" as Purpose,
      title:"Mixed",
      note:"More than one purpose",
      icon:<Route size={20}/>
    }
  ];

  return (
    <div className="step-content">

      <div className="group-label purpose-label">What is the purpose of this trip?</div>

      <div className="purpose-grid">
        {purposes.map(p=>(
          <button
            key={p.key}
            type="button"
            className={`purpose-option ${trip.purpose===p.key?"active":""}`}
            onClick={()=>updateTrip("purpose",p.key)}
          >
            <span className="purpose-icon">{p.icon}</span>

            <span className="purpose-copy">
              <strong>{p.title}</strong>
              <small>{p.note}</small>
            </span>

            <span className="select-mark">
              {trip.purpose===p.key ? <Check size={14}/> : null}
            </span>
          </button>
        ))}
      </div>

      <div className="group-label">How should we plan the journey?</div>

      <div className="comfort-grid">
        {options.map(o=>(
          <button key={o.key} className={`comfort-option ${trip.style===o.key?"active":""}`} onClick={()=>updateTrip("style",o.key)}>
            <span className={`color-icon ${o.color}`}>{o.icon}</span>
            <span className="comfort-copy"><span>{o.title}</span><small>{o.note}</small></span>
            <span className="select-mark">{trip.style===o.key?<Check size={14}/>:null}</span>
          </button>
        ))}
      </div>
      <div className="group-label">Include in my plan</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"8px"}}>
        {([
          ["stay","Stay",<Hotel size={18}/>],
          ["meals","Meals",<UtensilsCrossed size={18}/>],
          ["restStops","Rest stops",<Coffee size={18}/>],
          ["visitBuffer","Ready / visit buffer",<Clock3 size={18}/>]
        ] as Array<[keyof TripState["facilities"], string, React.ReactNode]>).map(([key,label,icon])=>(
          <button
            key={key}
            className={`comfort-option facility-compact ${trip.facilities[key as keyof typeof trip.facilities]?"active":""}`}
            onClick={()=>updateTrip("facilities",{
              ...trip.facilities,
              [key]:!trip.facilities[key as keyof typeof trip.facilities]
            })}
          >
            <span className="facility-main">
              <span className="facility-icon-inline">{icon}</span>
              <strong>{label}</strong>
            </span>

            <span className="facility-status-inline">
              {trip.facilities[key as keyof typeof trip.facilities] ? (
                <>Included <Check size={13}/></>
              ) : (
                <>Not included</>
              )}
            </span>
          </button>
        ))}
      </div>

      <Footer back onBack={onBack} nextText="Review trip" onNext={onNext}/>
    </div>
  )
}

function ReviewStep({trip,onBack,onGenerate,generating}:{trip:TripState;onBack:()=>void;onGenerate:()=>void;generating:boolean}) {
  return (
    <div className="step-content">
      <div className="review-grid">
        <ReviewCard color="blue" icon={<Route size={20}/>} label="ROUTE" value={`${trip.origin} -> ${trip.destinations.join(" -> ")}`}/>
        <ReviewCard color="green" icon={<Car size={20}/>} label="TRAVEL" value={titleCase(trip.mode)}/>
        <ReviewCard color="orange" icon={<UsersRound size={20}/>} label="TRAVELLERS" value={`${trip.adults+trip.children0to5+trip.children6to12+trip.seniors} people | ${trip.adults+trip.children6to12+trip.seniors} seats`}/>
        <ReviewCard
          color="green"
          icon={<MapPinned size={20}/>}
          label="PURPOSE"
          value={
            trip.purpose==="family_visit"
              ? "Family / Personal"
              : titleCase(trip.purpose)
          }
        />

        <ReviewCard color="purple" icon={<HeartHandshake size={20}/>} label="STYLE" value={trip.style==="senior"?"Senior friendly":titleCase(trip.style)}/>
        <ReviewCard color="rose" icon={<CalendarDays size={20}/>} label="START" value={trip.startDate || "Not set"}/>
        <ReviewCard color="amber" icon={<CalendarDays size={20}/>} label="END" value={trip.endDate || "Planner decides"}/>
      </div>

      <div className="notice">
        <Sparkles size={18}/>
        <span>We will build a practical day-wise plan. Logged-in users also get AI optimisation and secure route calculations.</span>
      </div>

      <div className="footer-actions">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={17}/> Back</button>
        <button className="generate-btn" onClick={onGenerate} disabled={generating}>
          {generating?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}
          {generating?"Building plan...":"Generate my plan"}
        </button>
      </div>
    </div>
  )
}

function Result({
  trip,
  plan,
  routeData,
  recommendation,
  rules,
  costEstimate,
  source,
  warning,
  generating,
  saveState,
  onSave,
  onEdit,
  onRegenerate,
  readOnly,
  onSaveCopy,
  onGetShareUrl
}:{
  trip:TripState;
  plan:any;
  routeData:any[];
  recommendation?:any;
  rules:any;
  costEstimate:any;
  source:string;
  warning:string;
  generating:boolean;
  saveState:string;
  onSave:()=>void | Promise<unknown>;
  onEdit:()=>void;
  onRegenerate:()=>void;
  readOnly:boolean;
  onSaveCopy:()=>void | Promise<unknown>;
  onGetShareUrl:()=>Promise<string | null>;
}) {
  const [reportStep,setReportStep]=React.useState(0);
  const [copyState,setCopyState]=React.useState<"idle"|"copying"|"copied">("idle");
  const [whatsappState,setWhatsappState]=React.useState<"idle"|"opening">("idle");

  const planningMessages = [
    {
      title:"Reading your trip",
      detail:"Understanding your route, travellers, purpose and comfort."
    },
    {
      title:"Route and distance ready",
      detail:"Using the available route facts to understand the journey."
    },
    {
      title:"Considering your travellers",
      detail:"Adjusting the plan for group size, children, seniors and luggage."
    },
    {
      title:"Comparing practical options",
      detail:"Checking which travel arrangement makes the most sense."
    },
    {
      title:"Planning comfort",
      detail:"Adding sensible breaks, meals, arrival buffer and stay needs."
    },
    {
      title:"Curating the best journey",
      detail:"Combining route facts and traveller needs into your trip strategy."
    },
    {
      title:"Preparing your full plan",
      detail:"Building the detailed day-by-day itinerary now."
    }
  ];

  const [planningMessageIndex,setPlanningMessageIndex] =
    React.useState(0);

  React.useEffect(()=>{
    if(!generating){
      setPlanningMessageIndex(0);
      return;
    }

    const timer=window.setInterval(()=>{
      setPlanningMessageIndex(current=>
        Math.min(
          current+1,
          planningMessages.length-1
        )
      );
    },1800);

    return ()=>window.clearInterval(timer);
  },[generating]);

  const totalPeople =
    trip.adults +
    trip.children0to5 +
    trip.children6to12 +
    trip.seniors;

  const finalDestination =
    trip.destinations.filter(Boolean).at(-1) || "Destination";

  const purposeLabel =
    trip.purpose === "family_visit"
      ? "Family / Personal"
      : titleCase(trip.purpose || "leisure");

  const styleLabel =
    trip.style === "senior"
      ? "Senior friendly"
      : titleCase(trip.style);

  const totalKm =
    routeData.reduce(
      (sum,leg)=>sum+(Number(leg?.distanceKm)||0),
      0
    );

  const totalTravelMin =
    routeData.reduce(
      (sum,leg)=>sum+(Number(leg?.durationMinutes)||0),
      0
    );

  const snapshot =
    plan?.snapshot || null;

  const itineraryDays =
    Array.isArray(plan?.itinerary?.days)
      ? plan.itinerary.days
      : Array.isArray(plan?.days)
        ? plan.days
        : [];

  const modeComparison =
    Array.isArray(plan?.modeComparison)
      ? plan.modeComparison
      : [];

  const confirmations =
    Array.isArray(plan?.confirmations)
      ? plan.confirmations
      : [];

  const planWarnings =
    Array.isArray(plan?.warnings)
      ? plan.warnings
      : [];

  const discoveryContext =
    plan?.discoveryContext || null;

  const recommendedMode =
    snapshot?.recommendedMode ||
    recommendation?.modeLabel ||
    (
      recommendation?.recommendedMode
        ? titleCase(recommendation.recommendedMode)
        : titleCase(trip.mode)
    );

  const headline =
    snapshot?.headline ||
    recommendation?.headline ||
    (
      trip.purpose === "pilgrimage"
        ? `Travel comfortably to ${finalDestination} and protect energy for the visit`
        : `A practical ${styleLabel.toLowerCase()} plan for this journey`
    );

  const roadDistance =
    snapshot?.routeSummary?.distance ||
    (
      totalKm > 0
        ? `${Math.round(totalKm)} km`
        : null
    );

  const rawTravelTime =
    snapshot?.routeSummary?.rawTravelTime ||
    (
      totalTravelMin > 0
        ? formatMinutes(totalTravelMin)
        : null
    );

  const practicalTravelTime =
    snapshot?.routeSummary?.practicalTravelTime ||
    recommendation?.roadComparator?.practicalLabel ||
    rawTravelTime ||
    "Plan estimate";

  const stayAdvice =
    snapshot?.overnightStay || null;

  const visitStrategy =
    snapshot?.visitStrategy || null;

  const shortReason =
    snapshot?.shortReason ||
    (
      Array.isArray(recommendation?.reasons)
        ? recommendation.reasons[0]
        : null
    );

  const aiMoments =
    Array.isArray(snapshot?.keyMoments)
      ? snapshot.keyMoments
      : [];

  const fallbackMoments = [
    {
      time:trip.startTime || "Start",
      type:"travel",
      label:`Leave ${trip.origin}`,
      note:null
    },
    {
      time:"Journey",
      type:"travel",
      label:recommendedMode,
      note:practicalTravelTime
        ? `Allow about ${practicalTravelTime}`
        : null
    },
    {
      time:"Arrival",
      type:"arrival",
      label:`Reach ${finalDestination}`,
      note:trip.facilities?.visitBuffer
        ? "Freshen up before the next activity"
        : null
    },
    ...(trip.purpose==="pilgrimage"
      ? [{
          time:stayAdvice?.recommended
            ? "Next morning"
            : "After arrival",
          type:"visit",
          label:"Darshan / visit",
          note:visitStrategy
        }]
      : [])
  ];

  const keyMoments =
    aiMoments.length
      ? aiMoments.slice(0,6)
      : fallbackMoments;

  const departureMoment =
    keyMoments.find(
      (item:any)=>
        item?.type==="travel" ||
        item?.type==="ready"
    ) || null;

  const arrivalMoment =
    keyMoments.find(
      (item:any)=>item?.type==="arrival"
    ) || null;

  const broadDeparture =
    departureMoment?.time ||
    trip.startTime ||
    "Early start";

  const broadArrival =
    arrivalMoment?.time ||
    "Same day";

  const broadStayText =
    stayAdvice?.recommended
      ? `Stay near ${stayAdvice?.location || finalDestination}`
      : "No overnight halt needed";

  const broadVisitText =
    visitStrategy ||
    (
      trip.purpose==="pilgrimage"
        ? "Protect enough time and energy for the visit"
        : "Keep arrival light and flexible"
    );

  const reportSteps = [
    {
      label:"Best Journey",
      caption:"Trip snapshot",
      icon:<MapPinned size={18}/>,
      tone:"green"
    },
    {
      label:"Full Plan",
      caption:"Day-by-day itinerary",
      icon:<CalendarDays size={18}/>,
      tone:"blue"
    },
    {
      label:"Around Your Trip",
      caption:"Stay, eat and visit",
      icon:<Sparkles size={18}/>,
      tone:"orange"
    }
  ];

  const itemIcon=(type:string)=>{
    switch(type){
      case "ready":
        return <UserRoundCheck size={18}/>;
      case "travel":
        return trip.mode==="flight"
          ? <Plane size={18}/>
          : trip.mode==="train"
            ? <Train size={18}/>
            : <Car size={18}/>;
      case "meal":
        return <UtensilsCrossed size={18}/>;
      case "rest":
        return <Coffee size={18}/>;
      case "arrival":
        return <MapPin size={18}/>;
      case "stay":
        return <Hotel size={18}/>;
      case "visit":
        return <MapPinned size={18}/>;
      case "return":
        return <Route size={18}/>;
      default:
        return <Clock3 size={18}/>;
    }
  };

  const itemTone=(type:string)=>{
    switch(type){
      case "travel": return "blue";
      case "meal": return "orange";
      case "rest": return "amber";
      case "arrival": return "green";
      case "stay": return "purple";
      case "visit": return "teal";
      case "ready": return "rose";
      case "return": return "blue";
      default: return "slate";
    }
  };

  const textPlan = [
    `${trip.origin} to ${finalDestination}`,
    `${purposeLabel} | ${styleLabel} | ${totalPeople} travellers`,
    "",
    `Best journey: ${recommendedMode}`,
    headline,
    practicalTravelTime
      ? `Practical travel: ${practicalTravelTime}`
      : "",
    visitStrategy
      ? `Visit strategy: ${visitStrategy}`
      : "",
    "",
    ...itineraryDays.flatMap((day:any,index:number)=>[
      `Day ${day?.day || index+1}: ${day?.title || ""}`,
      ...(Array.isArray(day?.items)
        ? day.items.map(
            (item:any)=>
              `${item?.time || ""} - ${item?.title || item?.type || ""}`
          )
        : [])
    ])
  ]
  .filter(Boolean)
  .join("\n");

  const buildShareText = async () => {
    const shareUrl = await onGetShareUrl();

    if (!shareUrl) {
      return textPlan;
    }

    return [
      `${trip.origin} to ${finalDestination}`,
      `${purposeLabel} | ${styleLabel} | ${totalPeople} travellers`,
      `Recommended: ${recommendedMode}`,
      practicalTravelTime ? `Practical travel: ${practicalTravelTime}` : "",
      "",
      `View full trip plan: ${shareUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const copy=async()=>{
    if(copyState!=="idle")return;

    setCopyState("copying");

    try{
      const shareText = await buildShareText();
      await navigator.clipboard.writeText(shareText);
      setCopyState("copied");
      window.setTimeout(()=>setCopyState("idle"),1800);
    }catch(error){
      console.warn("Could not copy plan",error);
      setCopyState("idle");
    }
  };

  const whatsapp=async()=>{
    if(whatsappState!=="idle")return;

    setWhatsappState("opening");

    try{
      const shareText = await buildShareText();
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }catch(error){
      console.warn("Could not open WhatsApp share",error);
    }finally{
      window.setTimeout(()=>setWhatsappState("idle"),900);
    }
  };

  return (
    <section className="mtp-report-shell">

      {generating && (
        <div className="mtp-planning-overlay">

          <div className="mtp-planning-box">

            <span className="mtp-planning-icon">
              <LoaderCircle
                className="spin"
                size={30}
              />
            </span>

            <div>
              <span className="mtp-planning-label">
                MYTRAVELPLANNER
              </span>

              <h2>Planning your trip</h2>

              <div
                className="mtp-planning-live-copy"
                key={planningMessageIndex}
              >
                <strong>
                  {planningMessages[planningMessageIndex]?.title}
                </strong>

                <p>
                  {planningMessages[planningMessageIndex]?.detail}
                </p>
              </div>

              <div className="mtp-planning-checks">

                {planningMessages.map((item,index)=>(
                  <span
                    key={item.title}
                    className={
                      index < planningMessageIndex
                        ? "done"
                        : index === planningMessageIndex
                          ? "active"
                          : ""
                    }
                  >
                    {index < planningMessageIndex
                      ? <Check size={13}/>
                      : index === planningMessageIndex
                        ? <LoaderCircle className="spin" size={13}/>
                        : <span className="mtp-planning-empty-dot"/>
                    }
                  </span>
                ))}

              </div>

              <div className="mtp-planning-progress">
                <span
                  style={{
                    width:
                      `${Math.max(
                        10,
                        ((planningMessageIndex+1) /
                          planningMessages.length) * 100
                      )}%`
                  }}
                />
              </div>

              <small className="mtp-planning-patience">
                A good travel plan takes a few seconds.
              </small>
            </div>

          </div>

        </div>
      )}

      <header className="mtp-trip-context">

        <div className="mtp-context-route">
          <span className="mtp-route-pin">
            <MapPin size={18}/>
          </span>

          <strong>{trip.origin}</strong>

          <ArrowRight size={18}/>

          <strong>{finalDestination}</strong>
        </div>

        <div className="mtp-context-chips">
          <span>{purposeLabel}</span>
          <span>{styleLabel}</span>
          <span>{totalPeople} travellers</span>

          {trip.startDate && (
            <span>
              {new Date(
                `${trip.startDate}T00:00:00`
              ).toLocaleDateString(
                "en-IN",
                {
                  day:"numeric",
                  month:"short",
                  year:"numeric"
                }
              )}
            </span>
          )}
        </div>

      </header>


            <nav className="mtp-report-tabs mtp-v10-steps">

        <button
          type="button"
          className={`mtp-v10-step green ${reportStep===0 ? "active" : ""}`}
          onClick={()=>setReportStep(0)}
        >
          <span className="mtp-v10-step-number">1</span>

          <span className="mtp-v10-step-icon">
            <MapPinned size={20}/>
          </span>

          <span className="mtp-v10-step-copy">
            <strong>Best Journey</strong>
            <small>Trip snapshot</small>
          </span>

          <ArrowRight
            size={18}
            className="mtp-v10-step-arrow"
          />
        </button>


        <button
          type="button"
          className={`mtp-v10-step blue ${reportStep===1 ? "active" : ""}`}
          onClick={()=>setReportStep(1)}
        >
          <span className="mtp-v10-step-number">2</span>

          <span className="mtp-v10-step-icon">
            <CalendarDays size={20}/>
          </span>

          <span className="mtp-v10-step-copy">
            <strong>Full Plan</strong>
            <small>Day-by-day itinerary</small>
          </span>

          <ArrowRight
            size={18}
            className="mtp-v10-step-arrow"
          />
        </button>


        <button
          type="button"
          className={`mtp-v10-step orange ${reportStep===2 ? "active" : ""}`}
          onClick={()=>setReportStep(2)}
        >
          <span className="mtp-v10-step-number">3</span>

          <span className="mtp-v10-step-icon">
            <Sparkles size={20}/>
          </span>

          <span className="mtp-v10-step-copy">
            <strong>Around Your Trip</strong>
            <small>Stay, eat and visit</small>
          </span>

          <ArrowRight
            size={18}
            className="mtp-v10-step-arrow"
          />
        </button>

      </nav>


      {warning && (
        <div className="mtp-warning">
          <CircleAlert size={18}/>
          <span>{warning}</span>
        </div>
      )}


                  {reportStep===0 && (
        <section className="mtp-page mtp-snapshot-page mtp-v10-page">

          <section className="mtp-v10-hero">

            <div className="mtp-v10-hero-main">

              <span className="mtp-v10-eyebrow">
                RECOMMENDED JOURNEY
              </span>

              <h1>{headline}</h1>

              <p className="mtp-v10-hero-sub">
                {shortReason ||
                  "A practical journey shaped around your travellers, comfort and route."}
              </p>

              <div className="mtp-v10-hero-actions">

                <span className="mtp-v10-mode-pill">
                  {trip.mode==="flight"
                    ? <Plane size={16}/>
                    : trip.mode==="train"
                      ? <Train size={16}/>
                      : <Car size={16}/>}

                  {recommendedMode}
                </span>

                {source==="ai" && (
                  <span className="mtp-v10-smart-pill">
                    <Sparkles size={15}/>
                    Smart plan
                  </span>
                )}

                <button
                  type="button"
                  className="mtp-v10-view-plan"
                  onClick={()=>setReportStep(1)}
                >
                  View full plan
                  <ArrowRight size={16}/>
                </button>

              </div>

            </div>


            <div className="mtp-v10-hero-mark">
              {trip.mode==="flight"
                ? <Plane size={34}/>
                : trip.mode==="train"
                  ? <Train size={34}/>
                  : <MapPinned size={34}/>}
            </div>

          </section>


          <section className="mtp-v10-facts">

            <article>
              <span className="blue">
                <Route size={18}/>
              </span>

              <div>
                <small>Distance</small>
                <strong>{roadDistance || "Route based"}</strong>
              </div>
            </article>


            <article>
              <span className="teal">
                <Clock3 size={18}/>
              </span>

              <div>
                <small>Travel reference</small>
                <strong>{rawTravelTime || "Plan based"}</strong>
              </div>
            </article>


            <article>
              <span className="green">
                <HeartHandshake size={18}/>
              </span>

              <div>
                <small>Practical journey</small>
                <strong>{practicalTravelTime}</strong>
              </div>
            </article>


            <article>
              <span className="purple">
                <Hotel size={18}/>
              </span>

              <div>
                <small>Stay</small>
                <strong>
                  {stayAdvice?.recommended
                    ? "Recommended"
                    : "Not needed"}
                </strong>
              </div>
            </article>

          </section>


          <section className="mtp-v10-story">

            <header>
              <div>
                <span className="mtp-v10-eyebrow">
                  THE BIG PICTURE
                </span>

                <h2>How this trip should work</h2>
              </div>

              <button
                type="button"
                onClick={()=>setReportStep(1)}
              >
                Detailed timings on Full Plan
                <ArrowRight size={15}/>
              </button>
            </header>


            <div className="mtp-v10-story-track">

              <article className="mint">
                <span>
                  <Clock3 size={19}/>
                </span>

                <small>START</small>

                <strong>{broadDeparture}</strong>

                <p>
                  {departureMoment?.label ||
                    `Start from ${trip.origin}`}
                </p>
              </article>


              <div className="mtp-v10-connector"/>


              <article className="blue">
                <span>
                  <MapPin size={19}/>
                </span>

                <small>ARRIVAL</small>

                <strong>{broadArrival}</strong>

                <p>
                  {arrivalMoment?.label ||
                    `Reach ${finalDestination}`}
                </p>
              </article>


              <div className="mtp-v10-connector"/>


              <article className="lavender">
                <span>
                  <Hotel size={19}/>
                </span>

                <small>STAY PLAN</small>

                <strong>{broadStayText}</strong>

                <p>
                  {stayAdvice?.reason ||
                    "Keep the arrival comfortable and unhurried."}
                </p>
              </article>


              <div className="mtp-v10-connector"/>


              <article className="peach">
                <span>
                  <Sparkles size={19}/>
                </span>

                <small>ARRIVAL / VISIT</small>

                <strong>{broadVisitText}</strong>
              </article>

            </div>

          </section>


          <section className="mtp-v10-support">

            <article className="mtp-v10-why">

              <span className="mtp-v10-support-icon">
                <Check size={19}/>
              </span>

              <div>
                <small>WHY THIS PLAN FITS</small>

                <strong>
                  {shortReason ||
                    "Designed around the route, traveller count and comfort selected for this trip."}
                </strong>
              </div>

            </article>


            <article className="mtp-v10-arrangement">

              <span className="mtp-v10-support-icon">
                {trip.mode==="flight"
                  ? <Plane size={19}/>
                  : trip.mode==="train"
                    ? <Train size={19}/>
                    : <Car size={19}/>}
              </span>

              <div>
                <small>TRAVEL ARRANGEMENT</small>
                <strong>{recommendedMode}</strong>
              </div>

            </article>

          </section>


          {modeComparison.length>0 && (

            <section className="mtp-v10-options">

              <header>
                <span className="mtp-v10-eyebrow">
                  OTHER OPTIONS
                </span>

                <h2>Quick comparison</h2>
              </header>


              <div className="mtp-v10-option-grid">

                {modeComparison
                  .slice(0,3)
                  .map((mode:any,index:number)=>(

                    <article
                      key={index}
                      className={`mtp-v10-option ${mode?.verdict || ""}`}
                    >

                      <div className="mtp-v10-option-top">

                        <span className="mtp-v10-option-icon">
                          {String(mode?.mode || "")
                            .toLowerCase()
                            .includes("flight")
                              ? <Plane size={20}/>
                              : String(mode?.mode || "")
                                  .toLowerCase()
                                  .includes("train")
                                ? <Train size={20}/>
                                : <Car size={20}/>}
                        </span>

                        <div>
                          <strong>{mode?.mode}</strong>

                          <small>
                            {mode?.verdict
                              ? titleCase(
                                  String(mode.verdict)
                                    .replace("_"," ")
                                )
                              : ""}
                          </small>
                        </div>

                      </div>

                      <p>{mode?.reason}</p>

                    </article>

                  ))}

              </div>

            </section>

          )}

        </section>
      )}
{reportStep===1 && (
        <section className="mtp-page mtp-itinerary-page">

          <div className="mtp-section-heading">
            <div>
              <span className="mtp-kicker">
                FULL PLAN
              </span>
              <h2>Your practical itinerary</h2>
              <p>
                Times, travel, food, rest, stay and visit
                in the order you need them.
              </p>
            </div>
          </div>


          {itineraryDays.length===0 && (
            <div className="mtp-empty-state">
              <CalendarDays size={24}/>
              <strong>Detailed itinerary is being prepared</strong>
            </div>
          )}


          <div className="mtp-day-list">

            {itineraryDays.map(
              (day:any,index:number)=>{

                const dayStay =
                  typeof day?.stay==="string"
                    ? day.stay
                    : day?.stay?.needed
                      ? day?.stay?.location
                      : null;

                return (
                  <article
                    className="mtp-day-card"
                    key={index}
                  >

                    <header className="mtp-day-header">
                      <span className="mtp-day-number">
                        DAY {day?.day || index+1}
                      </span>

                      <div>
                        <h3>
                          {day?.title || `Day ${index+1}`}
                        </h3>

                        {day?.date && (
                          <small>{day.date}</small>
                        )}
                      </div>
                    </header>


                    <div className="mtp-timeline">

                      {(Array.isArray(day?.items)
                        ? day.items
                        : []
                      ).map(
                        (item:any,itemIndex:number)=>(
                          <div
                            className="mtp-timeline-row"
                            key={itemIndex}
                          >

                            <div className="mtp-timeline-time">
                              {item?.time || ""}
                            </div>

                            <span
                              className={
                                `mtp-timeline-icon ${itemTone(item?.type)}`
                              }
                            >
                              {itemIcon(item?.type)}
                            </span>

                            <div className="mtp-timeline-copy">

                              <strong>
                                {item?.title ||
                                 item?.type ||
                                 "Plan item"}
                              </strong>

                              <div className="mtp-timeline-meta">

                                {item?.durationMinutes ? (
                                  <span>
                                    <Clock3 size={13}/>
                                    {formatMinutes(
                                      item.durationMinutes
                                    )}
                                  </span>
                                ) : null}

                                {item?.endTime ? (
                                  <span>
                                    until {item.endTime}
                                  </span>
                                ) : null}

                              </div>

                              {item?.note && (
                                <p>{item.note}</p>
                              )}

                            </div>

                          </div>
                        )
                      )}

                    </div>


                    {dayStay && (
                      <div className="mtp-stay-strip">
                        <span>
                          <Hotel size={18}/>
                        </span>

                        <div>
                          <small>STAY</small>
                          <strong>{dayStay}</strong>
                        </div>
                      </div>
                    )}

                  </article>
                );
              }
            )}

          </div>

        </section>
      )}


      {reportStep===2 && (
        <section className="mtp-page mtp-around-page">

          <div className="mtp-around-hero">

            <div>
              <span className="mtp-kicker">
                AROUND YOUR TRIP
              </span>

              <h2>
                Useful places around {finalDestination}
              </h2>

              <p>
                Find stay, food, pilgrimage places and
                attractions only when you need them.
              </p>
            </div>

            <span className="mtp-around-icon">
              <MapPinned size={25}/>
            </span>

          </div>


          {Array.isArray(
            discoveryContext?.usefulCategories
          ) &&
          discoveryContext.usefulCategories.length>0 && (
            <div className="mtp-discovery-hints">

              {discoveryContext.usefulCategories.map(
                (category:string,index:number)=>(
                  <span key={index}>
                    {titleCase(
                      category.replace("_"," ")
                    )}
                  </span>
                )
              )}

            </div>
          )}


          <div className="mtp-places-panel">
            {readOnly ? (
              <div className="mtp-empty-state">
                <MapPinned size={24}/>
                <strong>Save this trip to your account to explore nearby places.</strong>
              </div>
            ) : (
              <NearbySuggestions
                initialLocation={
                  discoveryContext?.referenceLocation ||
                  finalDestination
                }
                purpose={trip.purpose}
              />
            )}
          </div>


          {(confirmations.length>0 ||
            planWarnings.length>0) && (
            <section className="mtp-confirm-panel">

              <div className="mtp-section-heading compact">
                <div>
                  <span className="mtp-kicker">
                    BEFORE YOU GO
                  </span>
                  <h3>Only the things worth confirming</h3>
                </div>
              </div>

              <div className="mtp-confirm-list">

                {confirmations.map(
                  (item:string,index:number)=>(
                    <div
                      className="mtp-confirm-item"
                      key={`c-${index}`}
                    >
                      <span className="info">
                        <Check size={15}/>
                      </span>
                      <p>{item}</p>
                    </div>
                  )
                )}

                {planWarnings.map(
                  (item:string,index:number)=>(
                    <div
                      className="mtp-confirm-item warning"
                      key={`w-${index}`}
                    >
                      <span>
                        <CircleAlert size={15}/>
                      </span>
                      <p>{item}</p>
                    </div>
                  )
                )}

              </div>

            </section>
          )}

        </section>
      )}


      <div className="mtp-page-navigation">

        <button
          type="button"
          className="mtp-page-nav-btn"
          disabled={reportStep===0}
          onClick={()=>
            setReportStep(current=>
              Math.max(0,current-1)
            )
          }
        >
          <ArrowLeft size={17}/>
          Previous
        </button>

        <div className="mtp-page-position">
          <strong>{reportStep+1}</strong>
          <span>of 3</span>
        </div>

        <button
          type="button"
          className="mtp-page-nav-btn primary"
          disabled={reportStep===2}
          onClick={()=>
            setReportStep(current=>
              Math.min(2,current+1)
            )
          }
        >
          Next
          <ArrowRight size={17}/>
        </button>

      </div>

      <footer className="mtp-report-actions">

        {!readOnly && (
          <>
            <button
              className="mtp-action secondary"
              onClick={onEdit}
            >
              <ArrowLeft size={17}/>
              Edit
            </button>

            <button
              className="mtp-action secondary"
              onClick={onRegenerate}
              disabled={generating}
            >
              {generating
                ? <LoaderCircle
                    className="spin"
                    size={17}
                  />
                : <RotateCcw size={17}/>}
              Replan
            </button>
          </>
        )}

        <button
          className="mtp-action secondary"
          onClick={copy}
          disabled={copyState==="copying"}
        >
          {copyState==="copied" ? <Check size={17}/> : <Copy size={17}/>}
          {copyState==="copying"
            ? "Copying..."
            : copyState==="copied"
              ? "Copied"
              : "Copy"}
        </button>

        <button
          className="mtp-action whatsapp"
          onClick={whatsapp}
          disabled={whatsappState==="opening"}
        >
          <Share2 size={17}/>
          {whatsappState==="opening" ? "Opening..." : "WhatsApp"}
        </button>

        <button
          className="mtp-action secondary"
          onClick={()=>window.print()}
        >
          <Printer size={17}/>
          PDF
        </button>

        {readOnly ? (
          <button
            className="mtp-action primary"
            onClick={onSaveCopy}
          >
            <Save size={17}/>
            {saveState || "Save as my trip"}
          </button>
        ) : (
          <button
            className="mtp-action primary"
            onClick={onSave}
          >
            <Save size={17}/>
            {saveState || "Save trip"}
          </button>
        )}

      </footer>

    </section>
  );
}
function NearbySuggestions({
  initialLocation,
  purpose
}:{
  initialLocation:string;
  purpose:Purpose;
}) {
  const [context,setContext]=React.useState(initialLocation);
  const [kind,setKind]=React.useState<NearbyKind|null>(null);
  const [places,setPlaces]=React.useState<NearbyPlace[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [message,setMessage]=React.useState("");

  React.useEffect(()=>{
    setContext(initialLocation);
    setKind(null);
    setPlaces([]);
    setMessage("");
  },[initialLocation]);

  /**
   * Fetch only when the traveller explicitly asks for a category.
   * Identical searches are reused from session memory.
   */
  const loadNearby=async(nextKind:NearbyKind)=>{
    if(loading)return;
    const cleanContext=context.trim();
    if(!cleanContext)return;

    setKind(nextKind);
    setMessage("");

    const cacheKey=
      `${cleanContext.toLowerCase()}::${nextKind}`;

    const cached=nearbySuggestionCache.get(cacheKey);

    if(cached){
      setPlaces(cached);
      return;
    }

    setLoading(true);
    setPlaces([]);

    try{
      const {data,error}=await supabase.functions.invoke(
        "nearby-places",
        {
          body:{
            location:cleanContext,
            kind:nextKind,
            limit:5
          }
        }
      );

      if(error)throw error;

      const nextPlaces=
        Array.isArray(data?.places)
          ? data.places as NearbyPlace[]
          : [];

      nearbySuggestionCache.set(cacheKey,nextPlaces);
      setPlaces(nextPlaces);

      if(nextPlaces.length===0){
        setMessage("No useful places found for this search.");
      }
    }catch(error){
      console.error("Nearby places search failed",error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load nearby suggestions."
      );
    }finally{
      setLoading(false);
    }
  };

  /**
   * A selected place becomes the reference point for the next search.
   * Example: select temple -> search hotels near that temple.
   */
  const useAsContext=(place:NearbyPlace)=>{
    setContext(place.name);
    setPlaces([]);
    setKind(null);
    setMessage("");
  };

  const categoryLabel=(value:NearbyKind|null)=>{
    if(value==="hotel")return "Stay nearby";
    if(value==="restaurant")return "Eat nearby";
    if(value==="pilgrimage")return "Pilgrimage places";
    if(value==="attraction")return "Places to visit";
    return "";
  };

  return (
    <section className="nearby-section">

      <div className="nearby-head">
        <div>
          <span className="nearby-kicker">NEARBY & USEFUL</span>
          <h3>What may help when you reach there?</h3>
          <p>
            Search only when you need it. Results are based around
            <span className="nearby-context"> {context}</span>.
          </p>
        </div>
      </div>

      <div className="nearby-actions">

        {(purpose==="pilgrimage" || purpose==="mixed") && (
          <button
            type="button"
            className={kind==="pilgrimage"?"active":""}
            onClick={()=>loadNearby("pilgrimage")}
          >
            <Sparkles size={18}/>
            <span>
              <span>Pilgrimage places</span>
              <small>Temples & religious places</small>
            </span>
          </button>
        )}

        <button
          type="button"
          className={kind==="attraction"?"active":""}
          onClick={()=>loadNearby("attraction")}
        >
          <MapPinned size={18}/>
          <span>
            <span>Places to visit</span>
            <small>Useful nearby attractions</small>
          </span>
        </button>

        <button
          type="button"
          className={kind==="hotel"?"active":""}
          onClick={()=>loadNearby("hotel")}
        >
          <Hotel size={18}/>
          <span>
            <span>Stay nearby</span>
            <small>If you arrive late or need rest</small>
          </span>
        </button>

        <button
          type="button"
          className={kind==="restaurant"?"active":""}
          onClick={()=>loadNearby("restaurant")}
        >
          <UtensilsCrossed size={18}/>
          <span>
            <span>Eat nearby</span>
            <small>Restaurants around this location</small>
          </span>
        </button>

      </div>

      {loading && (
        <div className="nearby-loading">
          <LoaderCircle className="spin" size={18}/>
          <span>Finding useful places near {context}...</span>
        </div>
      )}

      {message && !loading && (
        <div className="nearby-message">
          {message}
        </div>
      )}

      {!loading && places.length>0 && (
        <div className="nearby-results">

          <div className="nearby-results-head">
            <span>{categoryLabel(kind)}</span>
            <small>near {context}</small>
          </div>

          <div className="nearby-result-list">
            {places.map((place,index)=>(
              <article
                className="nearby-place"
                key={place.id || `${place.name}-${index}`}
              >
                <div className="nearby-place-main">
                  <span className="nearby-place-number">
                    {index+1}
                  </span>

                  <div className="nearby-place-copy">
                    <span className="nearby-place-name">
                      {place.name}
                    </span>

                    {place.address && (
                      <span className="nearby-place-address">
                        {place.address}
                      </span>
                    )}

                    <div className="nearby-place-meta">
                      {place.rating!=null && (
                        <span>
                          ★ {place.rating}
                          {place.ratingCount
                            ? ` (${place.ratingCount})`
                            : ""}
                        </span>
                      )}

                      {place.openNow===true && (
                        <span className="open">Open now</span>
                      )}

                      {place.openNow===false && (
                        <span className="closed">Closed now</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="nearby-place-actions">
                  <button
                    type="button"
                    onClick={()=>useAsContext(place)}
                  >
                    Search around here
                  </button>

                  {place.mapsUri && (
                    <button
                      type="button"
                      onClick={()=>
                        window.open(
                          place.mapsUri!,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      View location
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="nearby-context-tip">
            Select <span>Search around here</span> on a temple,
            hotel or attraction, then choose another category.
          </div>

        </div>
      )}

    </section>
  );
}

function SummaryMetric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) {
  return (
    <div className="summary-metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  )
}
function MyTripsModal({open,onClose,onOpenTrip}:{open:boolean;onClose:()=>void;onOpenTrip:(trip:SavedTrip)=>void}) {
  const [trips,setTrips]=React.useState<SavedTrip[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [message,setMessage]=React.useState("");
  const [busyTripId,setBusyTripId]=React.useState<string|null>(null);
  const [copiedTripId,setCopiedTripId]=React.useState<string|null>(null);

  const load=React.useCallback(async()=>{
    setLoading(true);
    setMessage("");

    const {data,error}=await supabase
      .from("trips")
      .select("*")
      .order("created_at",{ascending:false});

    if(error){
      setMessage(error.message);
      setTrips([]);
    }else{
      setTrips((data||[]) as SavedTrip[]);
    }

    setLoading(false);
  },[]);

  React.useEffect(()=>{
    if(open) load();
  },[open,load]);

  const remove=async(id:string)=>{
    const {error}=await supabase.from("trips").delete().eq("id",id);

    if(error){
      setMessage(error.message);
      return;
    }

    setTrips(current=>current.filter(item=>item.id!==id));
  };

  const unshare=async(id:string)=>{
    setBusyTripId(id);
    setMessage("");

    const {error}=await supabase
      .from("trips")
      .update({is_shared:false})
      .eq("id",id);

    if(error){
      setMessage(error.message);
      setBusyTripId(null);
      return;
    }

    setTrips(current=>
      current.map(item=>
        item.id===id
          ? {...item,is_shared:false}
          : item
      )
    );

    setBusyTripId(null);
  };

  const regenerateShareLink=async(id:string)=>{
    setBusyTripId(id);
    setMessage("");

    try{
      const nextToken=crypto.randomUUID();

      const {data,error}=await supabase
        .from("trips")
        .update({
          is_shared:true,
          share_token:nextToken
        })
        .eq("id",id)
        .select("share_token")
        .single();

      if(error) throw error;

      const configuredSiteUrl=
        import.meta.env.VITE_PUBLIC_SITE_URL?.trim();

      const url=new URL(
        configuredSiteUrl || window.location.origin
      );

      url.pathname="/";
      url.search="";
      url.hash="";
      url.searchParams.set("share",String(data.share_token));

      await navigator.clipboard.writeText(url.toString());

      setTrips(current=>
        current.map(item=>
          item.id===id
            ? {
                ...item,
                is_shared:true,
                share_token:String(data.share_token)
              }
            : item
        )
      );

      setCopiedTripId(id);

      window.setTimeout(()=>{
        setCopiedTripId(current=>
          current===id ? null : current
        );
      },1800);
    }catch(error){
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not regenerate the share link."
      );
    }finally{
      setBusyTripId(null);
    }
  };

  if(!open)return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="trips-card" onMouseDown={e=>e.stopPropagation()}>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close saved trips"
        >
          <X size={19}/>
        </button>

        <span className="auth-kicker">MY TRIPS</span>
        <h2>Saved travel plans</h2>

        {loading && <p className="trips-empty">Loading...</p>}
        {message && <div className="auth-message">{message}</div>}
        {!loading && trips.length===0 && (
          <p className="trips-empty">No saved trips yet.</p>
        )}

        <div className="trips-list">
          {trips.map(t=>(
            <div className="trip-row" key={t.id}>
              <button
                className="trip-open"
                onClick={()=>onOpenTrip(t)}
              >
                <span className="trip-title-line">
                  {t.title || t.origin || "Saved trip"}
                  {t.is_shared && (
                    <em className="trip-shared-badge">Shared</em>
                  )}
                </span>

                <small>
                  {t.start_date || "No date"} | {t.travel_mode || "Travel"}
                </small>
              </button>

              <div className="trip-row-actions">
                {t.is_shared && (
                  <>
                    <button
                      type="button"
                      className="trip-share-control"
                      disabled={busyTripId===t.id}
                      onClick={()=>unshare(t.id)}
                      title="Disable this public share link"
                    >
                      Unshare
                    </button>

                    <button
                      type="button"
                      className="trip-share-control"
                      disabled={busyTripId===t.id}
                      onClick={()=>regenerateShareLink(t.id)}
                      title="Replace the old public link and copy a new one"
                    >
                      {copiedTripId===t.id ? "Copied" : "New link"}
                    </button>
                  </>
                )}

                <button
                  className="trip-delete"
                  onClick={()=>remove(t.id)}
                  aria-label="Delete trip"
                  title="Delete trip"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function PlaceAutocomplete({
  value,
  onChange,
  placeholder
}:{
  value:string;
  onChange:(value:string)=>void;
  placeholder:string;
}) {
  const [suggestions,setSuggestions]=React.useState<PlaceSuggestion[]>([]);
  const [open,setOpen]=React.useState(false);
  const [loading,setLoading]=React.useState(false);

  // A selected suggestion updates the input value too.
  // Skip exactly one lookup so that selection does not trigger
  // another Places API request and reopen the suggestion list.
  const skipNextLookup=React.useRef(false);

  // One session token per autocomplete field instance.
  const sessionToken=React.useRef(
    typeof crypto!=="undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );

  React.useEffect(()=>{
    const query=value.trim();

    // The value changed because the user selected a suggestion,
    // not because they typed more text. Do not call Places again.
    if(skipNextLookup.current){
      skipNextLookup.current=false;
      setSuggestions([]);
      setOpen(false);
      return;
    }

    if(query.length<2){
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const cacheKey=query.toLowerCase();

    // Reuse an identical query without another server call.
    const cached=placeSuggestionCache.get(cacheKey);
    if(cached){
      setSuggestions(cached);
      setOpen(cached.length>0);
      return;
    }

    let cancelled=false;

    // Debounce prevents one server call for every keystroke.
    const timer=window.setTimeout(async()=>{
      setLoading(true);

      try{
        const {data,error}=await supabase.functions.invoke("place-autocomplete",{
          body:{
            input:query,
            sessionToken:sessionToken.current
          }
        });

        if(error) throw error;

        const next:Array<PlaceSuggestion>=Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];

        placeSuggestionCache.set(cacheKey,next);

        if(!cancelled){
          setSuggestions(next);
          setOpen(next.length>0);
        }
      }catch(error){
        // Autocomplete failure must never block manual place entry.
        console.warn("Place autocomplete unavailable",error);

        if(!cancelled){
          setSuggestions([]);
          setOpen(false);
        }
      }finally{
        if(!cancelled)setLoading(false);
      }
    },300);

    return ()=>{
      cancelled=true;
      window.clearTimeout(timer);
    };
  },[value]);

  // Selecting a suggestion updates the field locally.
  const chooseSuggestion=(suggestion:PlaceSuggestion)=>{
    // Mark this value change as a selection so useEffect does not
    // generate a duplicate Places API request.
    skipNextLookup.current=true;

    onChange(suggestion.text || suggestion.place || suggestion.mainText);
    setSuggestions([]);
    setOpen(false);

    // Start a fresh Places session after a completed selection.
    sessionToken.current=
      typeof crypto!=="undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
  };

  return (
    <div className="place-autocomplete">
      <div className="place-input-wrap">
        <input
          value={value}
          onChange={e=>onChange(e.target.value)}
          onFocus={()=>suggestions.length>0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />

        {loading && (
          <LoaderCircle className="spin place-loading" size={15}/>
        )}
      </div>

      {open && suggestions.length>0 && (
        <div className="place-suggestions">
          {suggestions.map((suggestion,index)=>(
            <button
              type="button"
              className="place-suggestion"
              key={suggestion.placeId || `${suggestion.text}-${index}`}
              onMouseDown={e=>e.preventDefault()}
              onClick={()=>chooseSuggestion(suggestion)}
            >
              <MapPin size={15}/>

              <span>
                <strong>
                  {suggestion.mainText || suggestion.text}
                </strong>

                {suggestion.secondaryText && (
                  <small>{suggestion.secondaryText}</small>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldBox({color,icon,label,children}:{color:string;icon:React.ReactNode;label:string;children:React.ReactNode}) {
  return <div className="field-box"><span className={`color-icon ${color}`}>{icon}</span><span className="field-body"><span>{label}</span>{children}</span></div>
}

function ModeButton({active,onClick,color,icon,title,subtitle}:{active:boolean;onClick:()=>void;color:string;icon:React.ReactNode;title:string;subtitle:string}) {
  return <button className={`mode-card ${active?"active":""}`} onClick={onClick}><span className={`color-icon ${color}`}>{icon}</span><span className="mode-copy"><span>{title}</span><small>{subtitle}</small></span><span className="select-mark">{active?<Check size={14}/>:null}</span></button>
}

function Counter({title,note,value,setValue,color,icon}:{title:string;note:string;value:number;setValue:(n:number)=>void;color:string;icon:React.ReactNode}) {
  return <div className="traveller-card"><span className={`color-icon ${color}`}>{icon}</span><div className="traveller-copy"><span>{title}</span><small>{note}</small></div><div className="counter"><button onClick={()=>setValue(Math.max(0,value-1))}><Minus size={15}/></button><span>{value}</span><button onClick={()=>setValue(value+1)}><Plus size={15}/></button></div></div>
}

function ReviewCard({color,icon,label,value}:{color:string;icon:React.ReactNode;label:string;value:string}) {
  return <div className="review-card"><span className={`color-icon ${color}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>
}

function Footer({back,onBack,nextText,onNext,disabled}:{back?:boolean;onBack?:()=>void;nextText:string;onNext:()=>void;disabled?:boolean}) {
  return <div className="footer-actions">{back?<button className="back-btn" onClick={onBack}><ArrowLeft size={17}/> Back</button>:<span/>}<button className="next-btn" disabled={disabled} onClick={onNext}>{nextText}<ArrowRight size={17}/></button></div>
}

function Cost({label,value}:{label:string;value:any}) {
  return <div className="cost-item"><span>{label}</span><strong>{value || "—"}</strong></div>
}

function titleCase(value:string){return value.charAt(0).toUpperCase()+value.slice(1)}
function formatMinutes(minutes:number){const h=Math.floor(minutes/60);const m=minutes%60;return h?`${h}h ${m?`${m}m`:""}`:`${m}m`}

function buildShareText(trip:TripState,plan:any,routeData:any[]){
  const lines=[
    "MyTravelPlanner",
    `${trip.origin} → ${trip.destinations.join(" → ")}`,
    `${titleCase(trip.style)} · ${trip.adults+trip.children0to5+trip.children6to12+trip.seniors} travellers · ${titleCase(trip.mode)}`,
    "",
  ];

  if(routeData.length){
    for(const leg of routeData){
      lines.push(`${leg.from} → ${leg.to}: ${leg.distanceKm!=null?`${leg.distanceKm} km`:""} ${leg.durationMinutes!=null?formatMinutes(leg.durationMinutes):""}`.trim());
    }
    lines.push("");
  }

  for(const day of Array.isArray(plan?.days)?plan.days:[]){
    lines.push(`Day ${day.day || ""}: ${day.title || ""}`.trim());
    for(const item of Array.isArray(day.items)?day.items:[]){
      lines.push(`${item.time || ""} - ${item.title || ""}${item.note?` (${item.note})`:""}`.trim());
    }
    if(day.stay)lines.push(`Stay: ${day.stay}`);
    lines.push("");
  }

  if(plan?.costEstimate?.total)lines.push(`Estimated cost: ${plan.costEstimate.total}`);
  return lines.join("\n");
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App/>);








































