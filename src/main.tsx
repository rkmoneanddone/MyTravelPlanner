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
import { supabase } from "./lib/supabase";

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
  traveller_config: { adults?: number; children?: number; seniors?: number } | null;
  comfort_mode: Style | null;
  itinerary: any;
  estimated_cost: any;
  created_at: string;
};

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
  style: "comfortable",
  facilities: {
    stay: true,
    meals: true,
    restStops: true,
    visitBuffer: true,
    cost: true,
  },
};

function App() {
  const [step, setStep] = React.useState<Step>(1);
  const [trip, setTrip] = React.useState<TripState>(initialTrip);
  const [generated, setGenerated] = React.useState(false);
  const [plan, setPlan] = React.useState<any>(null);
  const [routeData, setRouteData] = React.useState<any[]>([]);
  const [rules, setRules] = React.useState<any>(null);
  const [costEstimate, setCostEstimate] = React.useState<any>(null);
  const [generationSource, setGenerationSource] = React.useState<"local" | "rules" | "ai">("local");
  const [generationWarning, setGenerationWarning] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const [authOpen, setAuthOpen] = React.useState(false);
  const [tripsOpen, setTripsOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState("");

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
    setCostEstimate(null);
    setGenerationWarning("");
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
    // Generation can consume paid route/AI services.
    // Require an authenticated user before creating any plan or server call.
    if (!userId) {
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
          comfortMode: trip.style,
          facilities: trip.facilities,
        },
      });

      if (error) throw error;

      const routes = Array.isArray(data?.routeData) ? data.routeData : [];

      setRouteData(routes);
      setRules(data?.rules || null);
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

  const saveTrip = async () => {
    if (!userId) {
      setAuthOpen(true);
      return;
    }

    setSaveState("Saving...");

    const { error } = await supabase.from("trips").insert({
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
    });

    if (error) {
      setSaveState(error.message);
      return;
    }

    setSaveState("Saved");
    setTimeout(() => setSaveState(""), 2000);
  };

  const openSavedTrip = (saved: SavedTrip) => {
    setTrip({
      origin: saved.origin || "",
      destinations: saved.trip_input?.destinations?.length ? saved.trip_input.destinations : (saved.destinations?.length ? saved.destinations : [""]),
      visitMinutes: saved.trip_input?.visitMinutes?.length ? saved.trip_input.visitMinutes : (saved.destinations?.length ? saved.destinations.map(() => 120) : [120]),
      startDate: saved.start_date || "",
      endDate: saved.end_date || "",
      startTime: saved.start_time || "",
      mode: saved.travel_mode || "mixed",
      adults: saved.traveller_config?.adults ?? 1,
      children0to5: saved.traveller_config?.children0to5 ?? 0,
      children6to12: saved.traveller_config?.children6to12 ?? saved.traveller_config?.children ?? 0,
      seniors: saved.traveller_config?.seniors ?? 0,
      style: saved.trip_input?.style || saved.comfort_mode || "comfortable",
      facilities: saved.trip_input?.facilities || {
        stay: true,
        meals: true,
        restStops: true,
        visitBuffer: true,
        cost: true
      },
    });
    setPlan(saved.itinerary || null);
    setGenerated(Boolean(saved.itinerary));
    setStep(saved.itinerary ? 4 : 1);
    setTripsOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="page-width header-inner">
          <button className="brand brand-button" onClick={reset}>
            <span className="brand-icon"><MapPin size={20}/></span>
            <span>MyTravelPlanner</span>
          </button>

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
        {!generated ? (
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
                  <h2>{["Plan your route","Who is travelling?","Choose comfort","Review your trip"][step-1]}</h2>
                  <p>{[
                    "Add your route, dates and travel mode.",
                    "No names needed. Just tell us the group.",
                    "Choose how fast or relaxed the journey should feel.",
                    "Check the basics, then build the itinerary."
                  ][step-1]}</p>
                </div>
              </div>

              {step === 1 && <RouteStep trip={trip} updateTrip={updateTrip} onNext={next}/>}
              {step === 2 && <TravellersStep trip={trip} updateTrip={updateTrip} onBack={back} onNext={next}/>}
              {step === 3 && <ComfortStep trip={trip} updateTrip={updateTrip} onBack={back} onNext={next}/>}
              {step === 4 && <ReviewStep trip={trip} onBack={back} onGenerate={generate} generating={generating}/>}
            </section>

            <p className="helper">Planning works without login. Login enables AI optimisation, route data and saved trips.</p>
          </>
        ) : (
          <Result
            trip={trip}
            plan={plan}
            routeData={routeData}
            source={generationSource}
            warning={generationWarning}
            generating={generating}
            saveState={saveState}
            onSave={saveTrip}
            onEdit={()=>{setGenerated(false);setStep(1)}}
            onRegenerate={generate}
          />
        )}
      </main>

      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)}/>
      <MyTripsModal open={tripsOpen} onClose={()=>setTripsOpen(false)} onOpenTrip={openSavedTrip}/>
    </div>
  );
}

function StepBar({step}:{step:Step}) {
  const items = [["Route",Route],["Travellers",UsersRound],["Comfort",HeartHandshake],["Review",Sparkles]] as const;
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

  const valid = trip.origin.trim() && trip.destinations.some(x=>x.trim()) && trip.startDate;

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
          <input type="date" value={trip.startDate} onChange={e=>updateTrip("startDate",e.target.value)}/>
        </FieldBox>
        <FieldBox color="amber" icon={<Clock3 size={19}/>} label="START TIME">
          <input type="time" value={trip.startTime} onChange={e=>updateTrip("startTime",e.target.value)}/>
        </FieldBox>
        <FieldBox color="purple" icon={<CalendarDays size={19}/>} label="END DATE (OPTIONAL)">
          <input type="date" min={trip.startDate} value={trip.endDate} onChange={e=>updateTrip("endDate",e.target.value)}/>
        </FieldBox>
        <div className="date-help">
          <span className="date-help-icon"><Sparkles size={18}/></span>
          <span>Leave End Date empty and the planner will decide a practical trip duration.</span>
        </div>
      </div>

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

  return (
    <div className="step-content">
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
        {[
          ["stay","Stay",<Hotel size={18}/>],
          ["meals","Meals",<UtensilsCrossed size={18}/>],
          ["restStops","Rest stops",<Coffee size={18}/>],
          ["visitBuffer","Ready / visit buffer",<Clock3 size={18}/>]
        ].map(([key,label,icon])=>(
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
        <ReviewCard color="blue" icon={<Route size={20}/>} label="ROUTE" value={`${trip.origin} â†’ ${trip.destinations.join(" â†’ ")}`}/>
        <ReviewCard color="green" icon={<Car size={20}/>} label="TRAVEL" value={titleCase(trip.mode)}/>
        <ReviewCard color="orange" icon={<UsersRound size={20}/>} label="TRAVELLERS" value={`${trip.adults+trip.children0to5+trip.children6to12+trip.seniors} people · ${trip.adults+trip.children6to12+trip.seniors} seats`}/>
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

function Result({trip,plan,routeData,rules,costEstimate,source,warning,generating,saveState,onSave,onEdit,onRegenerate}:{
  trip:TripState;plan:any;routeData:any[];rules:any;costEstimate:any;source:string;warning:string;generating:boolean;saveState:string;
  onSave:()=>void;onEdit:()=>void;onRegenerate:()=>void;
}) {
  const days=Array.isArray(plan?.days)?plan.days:[];
  const totalKm=routeData.reduce((sum,leg)=>sum+(leg.distanceKm||0),0);
  const totalTravelMin=routeData.reduce((sum,leg)=>sum+(leg.durationMinutes||0),0);

  // Client-side report navigation only.
  // Changing report sections must never trigger server/API calls.
  const [reportStep,setReportStep]=React.useState(0);

  // Report sections are modular so more sections can be plugged in later.
  // Keep the report simple: understand the trip, see the plan, then review essentials.
  const reportSteps=[
    {label:"Overview",icon:<MapPinned size={16}/>},
    {label:"Plan",icon:<CalendarDays size={16}/>},
    {label:"Essentials",icon:<ShieldCheck size={16}/>}
  ];

  // Move backward safely without leaving the valid report range.
  const previousReportStep=()=>{
    setReportStep(current=>Math.max(0,current-1));
  };

  // Move forward safely without leaving the valid report range.
  const nextReportStep=()=>{
    setReportStep(current=>Math.min(reportSteps.length-1,current+1));
  };
  const totalPeople=trip.adults+trip.children0to5+trip.children6to12+trip.seniors;
  const seats=trip.adults+trip.children6to12+trip.seniors;
  const summaryNotes=Array.isArray(plan?.summary?.notes)?plan.summary.notes:[];

  const textPlan=buildShareText(trip,plan,routeData);

  const copy=async()=>{
    await navigator.clipboard.writeText(textPlan);
  };

  const whatsapp=()=>{
    window.open(`https://wa.me/?text=${encodeURIComponent(textPlan)}`,"_blank","noopener,noreferrer");
  };

  return (
    <section className="result-shell">
      <div className="result-top">
        <div>
          <span className="eyebrow">YOUR TRAVEL PLAN</span>
          <h1>{plan?.title || `${trip.origin} â†’ ${trip.destinations.join(" â†’ ")}`}</h1>
          <p>{trip.style==="senior"?"Senior friendly":titleCase(trip.style)} Â· {trip.adults+trip.children0to5+trip.children6to12+trip.seniors} travellers Â· {titleCase(trip.mode)}</p>
        </div>
        <span className={`source-chip ${source}`}>{source==="ai"?"AI optimised":source==="rules"?"Route + rules":"Draft"}</span>
      </div>

      {warning && (
        <div className="warning-banner"><CircleAlert size={18}/><span>{warning}</span></div>
      )}

      {reportStep===0 && (
        <section className="report-panel">
          <div className="report-section-head">
            <span className="eyebrow result-eyebrow">TRIP CRUX</span>
            <h2>Everything important at a glance</h2>
          </div>

          <div className="plan-summary-grid">
            <SummaryMetric
              icon={<MapPinned size={18}/>}
              label="Route"
              value={`${trip.origin} → ${trip.destinations.filter(Boolean).join(" → ")}`}
            />

            <SummaryMetric
              icon={<Car size={18}/>}
              label="Mode"
              value={titleCase(trip.mode)}
            />

            <SummaryMetric
              icon={<CalendarDays size={18}/>}
              label="Start"
              value={`${trip.startDate || "Date pending"}${trip.startTime ? ` · ${trip.startTime}` : ""}`}
            />

            <SummaryMetric
              icon={<Clock3 size={18}/>}
              label="Travel time"
              value={totalTravelMin ? formatMinutes(totalTravelMin) : "To be confirmed"}
            />

            <SummaryMetric
              icon={<Route size={18}/>}
              label="Distance"
              value={totalKm ? `${Math.round(totalKm)} km` : "To be confirmed"}
            />

            <SummaryMetric
              icon={<UsersRound size={18}/>}
              label="Travellers"
              value={`${totalPeople} people · ${seats} seats`}
            />
          </div>

          <div className="report-crux-note">
            <ShieldCheck size={16}/>
            <span>
              This is the short version. Tap Next for journey flow and then the detailed day-wise itinerary.
            </span>
          </div>
        </section>
      )}
      {reportStep===1 && (
        <section className="report-panel">
          <div className="report-section-head">
            <span className="eyebrow result-eyebrow">JOURNEY AT A GLANCE</span>
            <h2>Your route and practical travel details</h2>
          </div>
      {routeData.length>0 && (
        <div className="route-summary">
          {routeData.map((leg,i)=>(
            <div className="route-leg" key={i}>
              <span>{leg.from} â†’ {leg.to}</span>
              <strong>{leg.distanceKm!=null?`${leg.distanceKm} km`:"Distance pending"}</strong>
              <small>{leg.durationMinutes!=null?`${formatMinutes(leg.durationMinutes)} driving`:"Time pending"}</small>
            </div>
          ))}
        </div>
      )}

      {summaryNotes.length>0 && (
        <div className="summary-notes">
          {summaryNotes.map((n:string,i:number)=><span key={i}><Check size={14}/>{n}</span>)}
        </div>
      )}

        </section>
      )}
      <div className="days-list">
        {days.map((day:any,index:number)=>(
          <article className="day-card" key={index}>
            <div className="day-head">
              <span className="day-chip">DAY {day.day || index+1}</span>
              <div>
                <h2>{day.title || `Day ${index+1}`}</h2>
                {day.date && <small>{day.date}</small>}
              </div>
            </div>

            <div className="timeline">
              {(Array.isArray(day.items)?day.items:[]).map((item:any,itemIndex:number)=>(
                <div className="timeline-row" key={itemIndex}>
                  <span className="timeline-time">{item.time || "â€”"}</span>
                  <span className="timeline-dot"/>
                  <div>
                    <span>{item.title || item.type || "Plan item"}</span>
                    <small>
                      {item.durationMinutes ? `${formatMinutes(item.durationMinutes)} Â· ` : ""}
                      {item.note || ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            {day.stay && (
              <div className="stay-strip"><Hotel size={17}/><span><b>Stay:</b> {day.stay}</span></div>
            )}

            {Array.isArray(day.warnings) && day.warnings.length>0 && (
              <div className="day-warnings">
                {day.warnings.map((w:string,i:number)=><span key={i}><CircleAlert size={14}/>{w}</span>)}
              </div>
            )}
          </article>
        ))}
      </div>

      {reportStep===3 && (
        <section className="report-panel">
          <div className="report-section-head">
            <span className="eyebrow result-eyebrow">TRAVELLER NOTES</span>
            <h2>Only what you should remember</h2>
          </div>

          <div className="traveller-rule-strip">
            <Baby size={17}/>
            <span>
              <b>Age 0–5:</b> no separate seat assumed by default ·
              <b> Age 6–12:</b> separate seat assumed.
              Final airline/rail/operator rules should be checked before booking.
            </span>
          </div>

          {rules && (
            <div className="practical-rules">
              <span>
                <Coffee size={15}/>
                Break every ~{rules.breakEveryMinutes || "—"} min
              </span>

              <span>
                <Clock3 size={15}/>
                Break ~{rules.breakDurationMinutes || "—"} min
              </span>

              <span>
                <UserRoundCheck size={15}/>
                Getting ready ~{rules.gettingReadyMinutes || "—"} min
              </span>

              <span>
                <UtensilsCrossed size={15}/>
                Meal buffer ~{rules.mealMinutes || "—"} min
              </span>
            </div>
          )}

          {Array.isArray(plan?.warnings) && plan.warnings.length>0 && (
            <section className="important-card">
              <h3>Before you travel</h3>

              {plan.warnings.map((w:string,i:number)=>(
                <p key={i}>
                  <CircleAlert size={15}/>
                  {w}
                </p>
              ))}
            </section>
          )}
        </section>
      )}
      {reportStep===4 && (
        <section className="report-panel">
          <div className="report-section-head">
            <span className="eyebrow result-eyebrow">SAVE & SHARE</span>
            <h2>Take the complete plan with you</h2>
          </div>

          <p className="share-intro">
            Save the plan or share the complete itinerary when you are ready.
          </p>
        </section>
      )}

      <div className="result-actions persistent-result-actions">

        <button className="back-btn" onClick={onEdit}><ArrowLeft size={17}/> Edit</button>
        <button className="action-btn" onClick={onRegenerate} disabled={generating}>
          {generating?<LoaderCircle className="spin" size={17}/>:<RotateCcw size={17}/>} Replan
        </button>
        <button className="action-btn" onClick={copy}><Copy size={17}/> Copy</button>
        <button className="action-btn whatsapp" onClick={whatsapp}><Share2 size={17}/> WhatsApp</button>
        <button className="action-btn" onClick={()=>window.print()}><Printer size={17}/> PDF</button>
        <button className="save-btn" onClick={onSave}><Save size={17}/> {saveState || "Save trip"}</button>
          
      </div>
      <div className="report-pager">
        <button
          type="button"
          className="report-pager-btn secondary"
          onClick={previousReportStep}
          disabled={reportStep===0}
        >
          <ArrowLeft size={16}/>
          Previous
        </button>

        <div className="report-position">
          <strong>{reportStep+1}</strong>
          <span>of {reportSteps.length}</span>
        </div>

        {reportStep < reportSteps.length-1 ? (
          <button
            type="button"
            className="report-pager-btn primary"
            onClick={nextReportStep}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            className="report-pager-btn primary"
            onClick={()=>setReportStep(0)}
          >
            <RotateCcw size={16}/>
            Summary
          </button>
        )}
      </div>
    </section>
  )
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

  const load=React.useCallback(async()=>{
    setLoading(true);setMessage("");
    const {data,error}=await supabase.from("trips").select("*").order("created_at",{ascending:false});
    if(error){setMessage(error.message);setTrips([])}
    else setTrips((data||[]) as SavedTrip[]);
    setLoading(false);
  },[]);

  React.useEffect(()=>{if(open)load()},[open,load]);

  const remove=async(id:string)=>{
    const {error}=await supabase.from("trips").delete().eq("id",id);
    if(error){setMessage(error.message);return}
    setTrips(t=>t.filter(x=>x.id!==id));
  };

  if(!open)return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="trips-card" onMouseDown={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={19}/></button>
        <span className="auth-kicker">MY TRIPS</span>
        <h2>Saved travel plans</h2>

        {loading && <p className="trips-empty">Loading...</p>}
        {message && <div className="auth-message">{message}</div>}
        {!loading && trips.length===0 && <p className="trips-empty">No saved trips yet.</p>}

        <div className="trips-list">
          {trips.map(t=>(
            <div className="trip-row" key={t.id}>
              <button className="trip-open" onClick={()=>onOpenTrip(t)}>
                <span>{t.title || t.origin || "Saved trip"}</span>
                <small>{t.start_date || "No date"} Â· {t.travel_mode || "Travel"}</small>
              </button>
              <button className="trip-delete" onClick={()=>remove(t.id)}><Trash2 size={16}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Lightweight reusable place autocomplete.
 *
 * Cost controls:
 * - waits for at least 2 characters
 * - debounces requests by 300 ms
 * - caches identical searches for the current browser session
 * - never calls OpenAI
 *
 * The provider is isolated here so Google Places can be replaced later
 * without changing RouteStep.
 */
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
  return <div className="cost-item"><span>{label}</span><strong>{value || "â€”"}</strong></div>
}

function titleCase(value:string){return value.charAt(0).toUpperCase()+value.slice(1)}
function formatMinutes(minutes:number){const h=Math.floor(minutes/60);const m=minutes%60;return h?`${h}h ${m?`${m}m`:""}`:`${m}m`}

function buildShareText(trip:TripState,plan:any,routeData:any[]){
  const lines=[
    "MyTravelPlanner",
    `${trip.origin} â†’ ${trip.destinations.join(" â†’ ")}`,
    `${titleCase(trip.style)} Â· ${trip.adults+trip.children0to5+trip.children6to12+trip.seniors} travellers Â· ${titleCase(trip.mode)}`,
    "",
  ];

  if(routeData.length){
    for(const leg of routeData){
      lines.push(`${leg.from} â†’ ${leg.to}: ${leg.distanceKm!=null?`${leg.distanceKm} km`:""} ${leg.durationMinutes!=null?formatMinutes(leg.durationMinutes):""}`.trim());
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



























