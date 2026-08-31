import React from "react";
import ReactDOM from "react-dom/client";
import {
  MapPin, Menu, UserRound, ArrowRight, ArrowLeft, Car, Train,
  UsersRound, Sparkles, Plus, Minus, CalendarDays, Clock3,
  Route, ShieldCheck, Baby, UserRoundCheck, WalletCards,
  Gauge, HeartHandshake, MapPinned, Check, Plane
} from "lucide-react";
import "./styles.css";

type Step = 1 | 2 | 3 | 4;
type Mode = "car" | "train" | "flight" | "mixed";
type Style = "fastest" | "comfortable" | "family" | "senior" | "budget";

function App() {
  const [step, setStep] = React.useState<Step>(1);
  const [mode, setMode] = React.useState<Mode>("mixed");
  const [style, setStyle] = React.useState<Style>("comfortable");
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(2);
  const [seniors, setSeniors] = React.useState(1);
  const [generated, setGenerated] = React.useState(false);

  const next = () => setStep((s) => Math.min(4, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const themeClass =
    step === 1 ? "theme-route" :
    step === 2 ? "theme-travellers" :
    step === 3 ? "theme-comfort" : "theme-review";

  return (
    <div className="app">
      <header className="topbar">
        <div className="page-width header-inner">
          <div className="brand">
            <span className="brand-icon"><MapPin size={20}/></span>
            <span>MyTravelPlanner</span>
          </div>
          <div className="header-actions">
            <button className="login-btn"><UserRound size={17}/><span>Login</span></button>
            <button className="menu-btn" aria-label="Menu"><Menu size={20}/></button>
          </div>
        </div>
      </header>

      <main className="page-width main">
        {!generated ? (
          <>
            <section className="hero-strip">
              <div className="hero-icon"><MapPinned size={28}/></div>
              <div className="hero-copy">
                <span className="eyebrow">FAMILY TRIP PLANNER</span>
                <h1>Plan the journey, not just the route.</h1>
                <p>Tell us where, who is travelling, and how comfortable you want it.</p>
              </div>
              <div className="hero-badges">
                <span><ShieldCheck size={17}/> Realistic timing</span>
                <span><HeartHandshake size={17}/> Family friendly</span>
              </div>
            </section>

            <StepBar step={step}/>

            <section className={`planner-card ${themeClass}`}>
              <div className="step-heading">
                <span className="step-bubble">{step}</span>
                <div>
                  <h2>{["Plan your route","Who is travelling?","Choose comfort","Review your trip"][step-1]}</h2>
                  <p>{[
                    "Add your start, destination, dates and travel mode.",
                    "Tell us the group. No names or login needed.",
                    "Pick the kind of journey you want.",
                    "Check the basics before we generate the plan."
                  ][step-1]}</p>
                </div>
              </div>

              {step === 1 && <StepOne mode={mode} setMode={setMode} onNext={next}/>}
              {step === 2 && <StepTwo adults={adults} children={children} seniors={seniors}
                setAdults={setAdults} setChildren={setChildren} setSeniors={setSeniors}
                onBack={back} onNext={next}/>}
              {step === 3 && <StepThree style={style} setStyle={setStyle} onBack={back} onNext={next}/>}
              {step === 4 && <StepFour mode={mode} style={style} adults={adults} children={children}
                seniors={seniors} onBack={back} onGenerate={()=>setGenerated(true)}/>}
            </section>

            <p className="helper">No login required to create a plan.</p>
          </>
        ) : <Result onEdit={()=>{setGenerated(false);setStep(1)}}/>}
      </main>
    </div>
  );
}

function StepBar({step}:{step:Step}) {
  const items = [
    ["Route", Route],
    ["Travellers", UsersRound],
    ["Comfort", HeartHandshake],
    ["Review", Sparkles],
  ] as const;

  return (
    <div className="step-bar">
      {items.map(([label,Icon],index)=>{
        const num = index+1;
        const active = num === step;
        const done = num < step;
        return (
          <div className={`step-item step-${num} ${active?"active":""} ${done?"done":""}`} key={label}>
            <span className="step-icon">{done ? <Check size={17}/> : <Icon size={17}/>}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  )
}

function StepOne({mode,setMode,onNext}:{mode:Mode;setMode:(m:Mode)=>void;onNext:()=>void}) {
  return (
    <div className="step-content">
      <div className="route-row">
        <FieldBox color="blue" icon={<MapPin size={21}/>} label="STARTING FROM">
          <input defaultValue="Pune" placeholder="Enter city"/>
        </FieldBox>

        <div className="arrow">â†’</div>

        <FieldBox color="orange" icon={<MapPinned size={21}/>} label="GOING TO">
          <input defaultValue="Trimbakeshwar" placeholder="Enter destination"/>
        </FieldBox>
      </div>

      <button className="add-stop"><Plus size={17}/> Add another destination</button>

      <div className="group-label">How will you travel?</div>
      <div className="travel-grid">
        <ModeButton active={mode==="car"} onClick={()=>setMode("car")} color="blue" icon={<Car size={21}/>} title="Car" subtitle="Drive"/>
        <ModeButton active={mode==="train"} onClick={()=>setMode("train")} color="purple" icon={<Train size={21}/>} title="Train" subtitle="Rail"/>
        <ModeButton active={mode==="flight"} onClick={()=>setMode("flight")} color="rose" icon={<Plane size={21}/>} title="Flight" subtitle="Fly"/>
        <ModeButton active={mode==="mixed"} onClick={()=>setMode("mixed")} color="green" icon={<Route size={21}/>} title="Mixed" subtitle="Combine"/>
      </div>

      <div className="group-label">When are you travelling?</div>
      <div className="date-grid">
        <FieldBox color="rose" icon={<CalendarDays size={20}/>} label="START DATE">
          <input type="date" defaultValue="2026-09-20"/>
        </FieldBox>

        <FieldBox color="amber" icon={<Clock3 size={20}/>} label="START TIME">
          <input type="time" defaultValue="21:00"/>
        </FieldBox>

        <FieldBox color="purple" icon={<CalendarDays size={20}/>} label="END DATE (OPTIONAL)">
          <input type="date"/>
        </FieldBox>

        <div className="date-help">
          <span className="date-help-icon"><Sparkles size={18}/></span>
          <span>
            Leave End Date empty if you want MyTravelPlanner to decide how many days the trip should take.
          </span>
        </div>
      </div>

      <Footer nextText="Continue to Travellers" onNext={onNext}/>
    </div>
  )
}

function StepTwo({
  adults,children,seniors,setAdults,setChildren,setSeniors,onBack,onNext
}:{
  adults:number;children:number;seniors:number;
  setAdults:(n:number)=>void;setChildren:(n:number)=>void;setSeniors:(n:number)=>void;
  onBack:()=>void;onNext:()=>void;
}) {
  return (
    <div className="step-content">
      <div className="traveller-grid">
        <Counter title="Adults" note="Age 13 to 59" value={adults} setValue={setAdults} color="blue" icon={<UserRoundCheck size={21}/>}/>
        <Counter title="Children" note="Age 0 to 12" value={children} setValue={setChildren} color="orange" icon={<Baby size={21}/>}/>
        <Counter title="Seniors" note="Age 60+" value={seniors} setValue={setSeniors} color="purple" icon={<HeartHandshake size={21}/>}/>
      </div>

      <div className="notice">
        <UsersRound size={19}/>
        <span><b>{adults+children+seniors} travellers</b>. We will automatically allow more breaks when children or seniors are included.</span>
      </div>

      <Footer back onBack={onBack} nextText="Continue to Comfort" onNext={onNext}/>
    </div>
  )
}

function StepThree({style,setStyle,onBack,onNext}:{style:Style;setStyle:(s:Style)=>void;onBack:()=>void;onNext:()=>void}) {
  const options = [
    {key:"fastest" as Style,title:"Fastest",note:"Reach sooner, fewer breaks",icon:<Gauge size={21}/>,color:"blue"},
    {key:"comfortable" as Style,title:"Comfortable",note:"Balanced travel and rest",icon:<HeartHandshake size={21}/>,color:"green"},
    {key:"family" as Style,title:"Family",note:"More meal and kid breaks",icon:<UsersRound size={21}/>,color:"orange"},
    {key:"senior" as Style,title:"Senior friendly",note:"Shorter travel blocks",icon:<ShieldCheck size={21}/>,color:"purple"},
    {key:"budget" as Style,title:"Budget",note:"Spend less where possible",icon:<WalletCards size={21}/>,color:"rose"},
  ];

  return (
    <div className="step-content">
      <div className="comfort-grid">
        {options.map(o=>(
          <button key={o.key} className={`comfort-option ${style===o.key?"active":""}`} onClick={()=>setStyle(o.key)}>
            <span className={`color-icon ${o.color}`}>{o.icon}</span>
            <span className="comfort-copy">
              <span>{o.title}</span>
              <small>{o.note}</small>
            </span>
            <span className="select-mark">{style===o.key ? <Check size={15}/> : ""}</span>
          </button>
        ))}
      </div>

      <Footer back onBack={onBack} nextText="Review trip" onNext={onNext}/>
    </div>
  )
}

function StepFour({
  mode,style,adults,children,seniors,onBack,onGenerate
}:{
  mode:Mode;style:Style;adults:number;children:number;seniors:number;
  onBack:()=>void;onGenerate:()=>void;
}) {
  return (
    <div className="step-content">
      <div className="review-grid">
        <ReviewCard color="blue" icon={<Route size={21}/>} label="ROUTE" value="Pune â†’ Trimbakeshwar"/>
        <ReviewCard color="green" icon={<Car size={21}/>} label="TRAVEL" value={mode==="mixed"?"Mixed":mode==="car"?"Car":mode==="train"?"Train":"Flight"}/>
        <ReviewCard color="orange" icon={<UsersRound size={21}/>} label="TRAVELLERS" value={`${adults+children+seniors} people`}/>
        <ReviewCard color="purple" icon={<HeartHandshake size={21}/>} label="STYLE" value={style==="senior"?"Senior friendly":style[0].toUpperCase()+style.slice(1)}/>
      </div>

      <div className="notice">
        <Sparkles size={19}/>
        <span>Your plan will include travel time, breaks, meals, rest, stay suggestion and a basic cost estimate.</span>
      </div>

      <div className="footer-actions">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18}/> Back</button>
        <button className="generate-btn" onClick={onGenerate}><Sparkles size={18}/> Generate my plan</button>
      </div>
    </div>
  )
}

function FieldBox({color,icon,label,children}:{color:string;icon:React.ReactNode;label:string;children:React.ReactNode}) {
  return (
    <label className="field-box">
      <span className={`color-icon ${color}`}>{icon}</span>
      <span className="field-body">
        <span>{label}</span>
        {children}
      </span>
    </label>
  )
}

function ModeButton({active,onClick,color,icon,title,subtitle}:{active:boolean;onClick:()=>void;color:string;icon:React.ReactNode;title:string;subtitle:string}) {
  return (
    <button className={`mode-card ${active?"active":""}`} onClick={onClick}>
      <span className={`color-icon ${color}`}>{icon}</span>
      <span className="mode-copy">
        <span>{title}</span>
        <small>{subtitle}</small>
      </span>
      <span className="select-mark">{active ? <Check size={15}/> : ""}</span>
    </button>
  )
}

function Counter({title,note,value,setValue,color,icon}:{title:string;note:string;value:number;setValue:(n:number)=>void;color:string;icon:React.ReactNode}) {
  return (
    <div className="traveller-card">
      <span className={`color-icon ${color}`}>{icon}</span>
      <div className="traveller-copy">
        <span>{title}</span>
        <small>{note}</small>
      </div>
      <div className="counter">
        <button onClick={()=>setValue(Math.max(0,value-1))}><Minus size={16}/></button>
        <span>{value}</span>
        <button onClick={()=>setValue(value+1)}><Plus size={16}/></button>
      </div>
    </div>
  )
}

function ReviewCard({color,icon,label,value}:{color:string;icon:React.ReactNode;label:string;value:string}) {
  return (
    <div className="review-card">
      <span className={`color-icon ${color}`}>{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function Footer({back,onBack,nextText,onNext}:{back?:boolean;onBack?:()=>void;nextText:string;onNext:()=>void}) {
  return (
    <div className="footer-actions">
      {back ? <button className="back-btn" onClick={onBack}><ArrowLeft size={18}/> Back</button> : <span/>}
      <button className="next-btn" onClick={onNext}>{nextText}<ArrowRight size={18}/></button>
    </div>
  )
}

function Result({onEdit}:{onEdit:()=>void}) {
  return (
    <section className="result-shell">
      <div className="result-title">
        <span className="eyebrow">YOUR TRAVEL PLAN</span>
        <h1>Pune â†’ Trimbakeshwar</h1>
        <p>Comfortable plan for 5 travellers with children and a senior.</p>
      </div>

      <div className="review-grid">
        <ReviewCard color="green" icon={<HeartHandshake size={21}/>} label="PLAN" value="Comfortable"/>
        <ReviewCard color="blue" icon={<Car size={21}/>} label="TRAVEL" value="Car"/>
        <ReviewCard color="orange" icon={<Clock3 size={21}/>} label="ROAD TIME" value="About 6 hrs"/>
        <ReviewCard color="purple" icon={<WalletCards size={21}/>} label="EST. COST" value="â‚¹9K to â‚¹12K"/>
      </div>

      <div className="result-card">
        <span className="day-chip">DAY 1</span>
        <h2>Pune â†’ Trimbakeshwar</h2>
        <p className="result-note">Late start. Keep this as a travel-only night.</p>

        <div className="timeline">
          <Timeline time="9:00 PM" title="Leave Pune" note="Start after dinner or a light meal."/>
          <Timeline time="11:15 PM" title="Comfort break" note="Washroom + tea, about 20 min"/>
          <Timeline time="2:00 AM" title="Reach Trimbakeshwar" note="Check in and take proper rest."/>
        </div>

        <div className="notice">
          <ShieldCheck size={19}/>
          <span><b>Recommended:</b> Stay near the temple and keep darshan for the next morning.</span>
        </div>
      </div>

      <button className="back-btn edit-btn" onClick={onEdit}><ArrowLeft size={18}/> Edit trip</button>
    </section>
  )
}

function Timeline({time,title,note}:{time:string;title:string;note:string}) {
  return (
    <div className="timeline-row">
      <span className="timeline-time">{time}</span>
      <span className="timeline-dot"/>
      <div>
        <span>{title}</span>
        <small>{note}</small>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App/>);

