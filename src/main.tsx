import React from "react";
import ReactDOM from "react-dom/client";
import {
  MapPin, Menu, UserRound, ArrowRight, ArrowLeft, Car, Train, Plane,
  UsersRound, Sparkles, Plus, Minus, CalendarDays, Clock3,
  Route, ShieldCheck, Baby, UserRoundCheck, WalletCards,
  Gauge, HeartHandshake, MapPinned, Check, Save, FolderOpen, LogOut,
  X, Trash2, Copy, Share2, Printer, LoaderCircle, RotateCcw, Hotel,
  UtensilsCrossed, CircleAlert
} from "lucide-react";
import "./styles.css";
import { AuthModal } from "./components/AuthModal";
import { supabase } from "./lib/supabase";

type Step = 1 | 2 | 3 | 4;
type Mode = "car" | "train" | "flight" | "mixed";
type Style = "fastest" | "comfortable" | "family" | "senior" | "budget";

type TripState = {
  origin: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  mode: Mode;
  adults: number;
  children: number;
  seniors: number;
  style: Style;
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
  origin: "Pune",
  destinations: ["Trimbakeshwar"],
  startDate: "2026-09-20",
  endDate: "",
  startTime: "21:00",
  mode: "mixed",
  adults: 2,
  children: 2,
  seniors: 1,
  style: "comfortable",
};

function App() {
  const [step, setStep] = React.useState<Step>(1);
  const [trip, setTrip] = React.useState<TripState>(initialTrip);
  const [generated, setGenerated] = React.useState(false);
  const [plan, setPlan] = React.useState<any>(null);
  const [routeData, setRouteData] = React.useState<any[]>([]);
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
    setGenerationWarning("");
  };

  const localPlan = () => {
    const totalPeople = trip.adults + trip.children + trip.seniors;
    const moreRest = trip.seniors > 0 || trip.style === "senior";
    const notes = [
      trip.children > 0 ? "Child-friendly meal and washroom breaks included." : null,
      trip.seniors > 0 ? "Senior-friendly rest buffers included." : null,
      !trip.endDate ? "Trip duration will be decided from route practicality." : `Plan must fit by ${trip.endDate}.`,
    ].filter(Boolean);

    return {
      title: `${trip.origin} to ${trip.destinations.join(" to ")}`,
      summary: {
        days: Math.max(1, trip.destinations.length),
        comfort: trip.style,
        notes,
      },
      days: trip.destinations.map((destination, index) => ({
        day: index + 1,
        date: index === 0 ? trip.startDate : null,
        title: `${index === 0 ? trip.origin : trip.destinations[index - 1]} to ${destination}`,
        items: [
          {
            time: index === 0 ? trip.startTime : "Morning",
            type: "travel",
            title: `Travel towards ${destination}`,
            durationMinutes: null,
            note: moreRest ? "Keep generous breaks and avoid an exhausting continuous stretch." : "Keep normal meal and rest breaks.",
          },
        ],
        stay: destination,
        warnings: [],
      })),
      costEstimate: {
        currency: "INR",
        fuelOrTransport: "Route data required",
        stay: "Depends on hotel choice",
        food: `${totalPeople} travellers`,
        local: "Depends on parking/local travel",
        total: "Calculated after route/API data",
        note: "This draft does not invent live prices.",
      },
    };
  };

  const generate = async () => {
    setGenerating(true);
    setGenerationWarning("");
    setSaveState("");

    const fallback = localPlan();
    setPlan(fallback);
    setGenerationSource("local");
    setGenerated(true);

    if (!userId) {
      setGenerationWarning("Draft plan created. Login for AI optimisation and live route calculations.");
      setGenerating(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-trip", {
        body: {
          origin: trip.origin,
          destinations: trip.destinations.filter(Boolean),
          startDate: trip.startDate || null,
          endDate: trip.endDate || null,
          startTime: trip.startTime || null,
          travelMode: trip.mode,
          travellers: {
            adults: trip.adults,
            children: trip.children,
            seniors: trip.seniors,
          },
          comfortMode: trip.style,
        },
      });

      if (error) throw error;

      if (data?.plan) setPlan(data.plan);
      setRouteData(Array.isArray(data?.routeData) ? data.routeData : []);
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
      traveller_config: { adults: trip.adults, children: trip.children, seniors: trip.seniors },
      comfort_mode: trip.style,
      itinerary: plan,
      estimated_cost: plan?.costEstimate ?? null,
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
      destinations: saved.destinations?.length ? saved.destinations : [""],
      startDate: saved.start_date || "",
      endDate: saved.end_date || "",
      startTime: saved.start_time || "",
      mode: saved.travel_mode || "mixed",
      adults: saved.traveller_config?.adults ?? 1,
      children: saved.traveller_config?.children ?? 0,
      seniors: saved.traveller_config?.seniors ?? 0,
      style: saved.comfort_mode || "comfortable",
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
          <input value={trip.origin} onChange={e=>updateTrip("origin",e.target.value)} placeholder="Enter starting city"/>
        </FieldBox>

        {trip.destinations.map((destination,index)=>(
          <div className="destination-row" key={index}>
            <FieldBox color={index%2===0?"orange":"purple"} icon={<MapPinned size={20}/>} label={index===0?"GOING TO":`STOP ${index+1}`}>
              <input value={destination} onChange={e=>setDestination(index,e.target.value)} placeholder="Enter destination"/>
            </FieldBox>
            {trip.destinations.length>1 && (
              <button className="remove-stop" onClick={()=>removeDestination(index)} aria-label="Remove destination"><X size={17}/></button>
            )}
          </div>
        ))}
      </div>

      <button className="add-stop" onClick={addDestination}><Plus size={17}/> Add another destination</button>

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
  const total=trip.adults+trip.children+trip.seniors;
  return (
    <div className="step-content">
      <div className="traveller-grid">
        <Counter title="Adults" note="Age 13 to 59" value={trip.adults} setValue={(v)=>updateTrip("adults",v)} color="blue" icon={<UserRoundCheck size={20}/>}/>
        <Counter title="Children" note="Age 0 to 12" value={trip.children} setValue={(v)=>updateTrip("children",v)} color="orange" icon={<Baby size={20}/>}/>
        <Counter title="Seniors" note="Age 60+" value={trip.seniors} setValue={(v)=>updateTrip("seniors",v)} color="purple" icon={<HeartHandshake size={20}/>}/>
      </div>

      <div className="notice">
        <UsersRound size={18}/>
        <span><b>{total} traveller{total===1?"":"s"}</b>. Kids and seniors automatically increase practical rest and meal buffers.</span>
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
        <ReviewCard color="orange" icon={<UsersRound size={20}/>} label="TRAVELLERS" value={`${trip.adults+trip.children+trip.seniors} people`}/>
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

function Result({trip,plan,routeData,source,warning,generating,saveState,onSave,onEdit,onRegenerate}:{
  trip:TripState;plan:any;routeData:any[];source:string;warning:string;generating:boolean;saveState:string;
  onSave:()=>void;onEdit:()=>void;onRegenerate:()=>void;
}) {
  const days=Array.isArray(plan?.days)?plan.days:[];
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
          <p>{trip.style==="senior"?"Senior friendly":titleCase(trip.style)} Â· {trip.adults+trip.children+trip.seniors} travellers Â· {titleCase(trip.mode)}</p>
        </div>
        <span className={`source-chip ${source}`}>{source==="ai"?"AI optimised":source==="rules"?"Route + rules":"Draft"}</span>
      </div>

      {warning && (
        <div className="warning-banner"><CircleAlert size={18}/><span>{warning}</span></div>
      )}

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

      {plan?.costEstimate && (
        <section className="cost-card">
          <div className="cost-title"><WalletCards size={19}/><span>Rough trip cost</span></div>
          <div className="cost-grid">
            <Cost label="Travel" value={plan.costEstimate.fuelOrTransport}/>
            <Cost label="Stay" value={plan.costEstimate.stay}/>
            <Cost label="Food" value={plan.costEstimate.food}/>
            <Cost label="Local" value={plan.costEstimate.local}/>
          </div>
          <div className="cost-total"><span>Estimated total</span><strong>{plan.costEstimate.total || "To be calculated"}</strong></div>
          {plan.costEstimate.note && <p>{plan.costEstimate.note}</p>}
        </section>
      )}

      <div className="result-actions">
        <button className="back-btn" onClick={onEdit}><ArrowLeft size={17}/> Edit</button>
        <button className="action-btn" onClick={onRegenerate} disabled={generating}>
          {generating?<LoaderCircle className="spin" size={17}/>:<RotateCcw size={17}/>} Replan
        </button>
        <button className="action-btn" onClick={copy}><Copy size={17}/> Copy</button>
        <button className="action-btn whatsapp" onClick={whatsapp}><Share2 size={17}/> WhatsApp</button>
        <button className="action-btn" onClick={()=>window.print()}><Printer size={17}/> PDF</button>
        <button className="save-btn" onClick={onSave}><Save size={17}/> {saveState || "Save trip"}</button>
      </div>
    </section>
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

function FieldBox({color,icon,label,children}:{color:string;icon:React.ReactNode;label:string;children:React.ReactNode}) {
  return <label className="field-box"><span className={`color-icon ${color}`}>{icon}</span><span className="field-body"><span>{label}</span>{children}</span></label>
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
    `${titleCase(trip.style)} Â· ${trip.adults+trip.children+trip.seniors} travellers Â· ${titleCase(trip.mode)}`,
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
