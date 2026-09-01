import React from "react";
import { createPortal } from "react-dom";
import { X, MapPin, ShieldCheck, FileText, Info, Mail, TriangleAlert, Compass, Sparkles, Route, Clock3, Users, Plane, Train, Car, Hotel, Utensils, Share2, Save, BrainCircuit, Layers3, CheckCircle2, ArrowRight, Briefcase, Landmark, Baby, UserRound, Globe2, Database, MapPinned, Zap, Copy, FileDown } from "lucide-react";

export type LegalPage =
  | "about"
  | "privacy"
  | "terms"
  | "disclaimer"
  | "contact";

const LAST_UPDATED = "1 September 2026";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "rohitmallick85@gmail.com";

type Section = {
  heading: string;
  paragraphs?: React.ReactNode[];
  bullets?: React.ReactNode[];
};

const pages: Record<LegalPage, {
  title: string;
  intro: string;
  icon: React.ReactNode;
  sections: Section[];
}> = {
  about: {
    title: "About MyTravelPlanner",
    intro:
      "A colourful, practical, no-nonsense AI travel planner built for quick reference, real-world guidance and better journey decisions.",
    icon: <Info size={22}/>,
    sections: [
      {
        heading: "AI travel planning that gets to the point",
        paragraphs: [
          <>MyTravelPlanner is designed for travellers who want clarity without opening ten tabs. It turns your route, dates, traveller mix, trip purpose and comfort needs into a practical journey picture you can understand quickly.</>,
          <>Instead of stopping at distance and map time, it helps answer the questions people actually have: how should we travel, how long should we realistically allow, where may a break or stay help, and what nearby support matters around the trip.</>
        ]
      },
      {
        heading: "Why it feels different",
        bullets: [
          <>quick reference first, with deeper detail only when useful</>,
          <>practical guidance instead of generic itinerary filler</>,
          <>Car, Train, Flight and Mixed travel logic in one planner</>,
          <>family, senior, business, leisure and pilgrimage context</>,
          <>realistic travel buffers for food, rest, freshen-up and arrival</>,
          <>saved trips, secure sharing, copy-to-own-account and replanning</>
        ]
      },
      {
        heading: "Three views, one practical answer",
        paragraphs: [
          <><strong>Best Journey</strong> gives the fast decision view: recommended arrangement, broad timing, realistic duration and the main reasons behind the plan.</>,
          <><strong>Full Plan</strong> turns that strategy into an executable timeline with travel, breaks, meals, stay and visit or darshan flow.</>,
          <><strong>Around Your Trip</strong> adds useful nearby context such as stay, food, pilgrimage and visit options without cluttering the main journey plan.</>
        ]
      },
      {
        heading: "Built around real travellers",
        bullets: [
          <>families travelling with children</>,
          <>seniors who need a more comfortable schedule</>,
          <>pilgrimage groups balancing travel and darshan time</>,
          <>business travellers who want efficient movement</>,
          <>road travellers who need realistic breaks and stop planning</>,
          <>larger groups where a normal car is no longer the practical answer</>
        ]
      },
      {
        heading: "No-nonsense by design",
        paragraphs: [
          <>A 10-hour map route is not automatically a 10-hour real journey. A family with children and seniors does not travel like a solo traveller. Mixed should resolve into something useful such as Flight + Cab or Train + Cab, not remain a vague label.</>,
          <>That is the product philosophy: fewer assumptions, clearer decisions and guidance that feels usable in the real world.</>
        ]
      },
      {
        heading: "AI where it adds value",
        paragraphs: [
          <>MyTravelPlanner uses AI to interpret context and improve recommendations, while lightweight rules and route data handle work that does not need expensive AI. The goal is not to generate more text. The goal is to make better travel decisions faster.</>,
          <>Critical schedules, fares, availability and venue timings still need verification from official providers before booking or travel.</>
        ]
      },
      {
        heading: "What the platform brings together",
        bullets: [
          <>origin, multiple destinations, dates and start time</>,
          <>traveller counts across adults, children and seniors</>,
          <>trip purpose and planning style</>,
          <>route comparison and practical mode selection</>,
          <>stay, food, rest, washroom and ready-time planning</>,
          <>nearby stay, eat, pilgrimage and visit discovery</>,
          <>rough cost guidance where enabled</>,
          <>save, reopen, edit, replan, copy, WhatsApp, PDF and secure sharing</>
        ]
      },
      {
        heading: "Built for quick reference",
        paragraphs: [
          <>MyTravelPlanner is being shaped as a fast decision layer between raw travel data and the traveller. It is meant to answer “what makes sense for this trip?” before the user gets lost in booking screens, maps, blogs and scattered search results.</>,
          <>Our ambition is simple: build one of the most useful AI travel planning experiences for people who prefer practical guidance over noise.</>
        ]
      },
      {
        heading: "Other products and projects",
        paragraphs: [
          <>
            <a href="https://quickstories.in/" target="_blank" rel="noreferrer">QuickStories</a>
            {" — short-form digital storytelling."}
          </>,
          <>
            <a href="https://parentsboard.in/" target="_blank" rel="noreferrer">ParentsBoard</a>
            {" — school and parent information platform."}
          </>,
          <>
            <a href="https://apps.microsoft.com/detail/9n11m525d0m9?hl=en-US&gl=IN" target="_blank" rel="noreferrer">Lucky Dangle for Windows</a>
            {" — lightweight Windows desktop charm application."}
          </>
        ]
      },
      {
        heading: "Contact",
        paragraphs: [
          <>Questions, feedback or collaboration: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></>
        ]
      }
    ]
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains the information MyTravelPlanner may process, why it is used, and the choices available to you.",
    icon: <ShieldCheck size={22}/>,
    sections: [
      {
        heading: "Information you provide",
        bullets: [
          <>account information such as your email address when you sign in</>,
          <>trip information such as origin, destinations, dates, traveller counts, age groups, purpose, comfort preferences and selected facilities</>,
          <>saved itineraries and related trip settings</>,
          <>messages you choose to send to support</>
        ]
      },
      {
        heading: "Information used to operate the service",
        paragraphs: [
          <>The service may process technical information needed for security, diagnostics, abuse prevention and reliable operation. Browser storage may be used to preserve an unfinished trip, authentication state and limited session-level caches.</>
        ]
      },
      {
        heading: "How information is used",
        bullets: [
          <>to generate and save travel plans</>,
          <>to provide route and nearby-place features</>,
          <>to authenticate users and protect saved trips</>,
          <>to operate, secure and improve the service</>,
          <>to diagnose errors and prevent misuse</>
        ]
      },
      {
        heading: "Service providers",
        paragraphs: [
          <>MyTravelPlanner may use service providers such as Supabase for account/database services, Google Maps Platform for route and place information, OpenAI for AI-assisted planning, and the production hosting provider used for the website.</>,
          <>Information is sent to these providers only as needed to provide the relevant feature, subject to their own terms and privacy practices.</>
        ]
      },
      {
        heading: "Shared trip links",
        paragraphs: [
          <>When you create a public share link, anyone who has that link may view the shared trip until the link is revoked or disabled. Shared viewers do not receive ownership of the original trip.</>,
          <>A shared viewer may save an independent copy to their own account. The original owner's account email and user identifier are not intended to be displayed in the public shared-trip view.</>
        ]
      },
      {
        heading: "Data retention and deletion",
        paragraphs: [
          <>Saved trips remain associated with your account until deleted, subject to operational backups and legal requirements. Account and data-deletion options will be provided through the service or support channel available at launch.</>
        ]
      },
      {
        heading: "Sale of personal data",
        paragraphs: [
          <>MyTravelPlanner does not sell your personal information to advertisers.</>
        ]
      },
      {
        heading: "Children",
        paragraphs: [
          <>Traveller age groups are used for trip planning. The service does not require the names of children to create a plan. A parent or guardian should manage any account used by a minor where required by applicable law.</>
        ]
      },
      {
        heading: "Changes to this policy",
        paragraphs: [
          <>This policy may be updated as the service, providers or legal requirements change. The current version will show its latest update date.</>
        ]
      }
    ]
  },

  terms: {
    title: "Terms & Conditions",
    intro:
      "These terms govern use of MyTravelPlanner. By using the service, you agree to use it responsibly and to verify critical travel information before acting on a plan.",
    icon: <FileText size={22}/>,
    sections: [
      {
        heading: "Travel-planning service",
        paragraphs: [
          <>MyTravelPlanner provides planning assistance and informational recommendations. It is not a transport operator, travel agent, hotel, ticketing platform, temple or venue authority unless a specific feature expressly states otherwise.</>
        ]
      },
      {
        heading: "Your responsibility",
        bullets: [
          <>provide accurate trip and traveller information</>,
          <>verify official train, flight, road, hotel and venue information before booking or travel</>,
          <>check fares, availability, entry rules, identification requirements, health or safety advisories and local restrictions</>,
          <>use reasonable judgement when following any automated recommendation</>
        ]
      },
      {
        heading: "Estimates and third-party information",
        paragraphs: [
          <>Travel times, costs, schedules, ratings, availability and nearby-place information may be estimates or third-party information and can change without notice. MyTravelPlanner does not guarantee that such information is complete, current or error-free.</>
        ]
      },
      {
        heading: "Accounts and saved trips",
        paragraphs: [
          <>You are responsible for activity performed through your account and for maintaining the security of your authentication credentials. You may edit trips you own. A public shared-trip viewer must save a separate copy before editing or replanning another person's trip.</>
        ]
      },
      {
        heading: "Public share links",
        paragraphs: [
          <>Anyone with an active public share link may be able to view the shared trip. Do not place sensitive personal information in a trip you intend to share publicly. The owner may revoke or replace a share link where that feature is available.</>
        ]
      },
      {
        heading: "Acceptable use",
        bullets: [
          <>do not abuse, overload, scrape or attempt to bypass service limits</>,
          <>do not attempt unauthorized access to another user's account or trip</>,
          <>do not interfere with security controls or service infrastructure</>,
          <>do not use the service for unlawful, fraudulent or harmful activity</>
        ]
      },
      {
        heading: "Availability and changes",
        paragraphs: [
          <>Features may change, be limited, interrupted or withdrawn. The service may apply usage limits or suspend access when necessary for security, reliability, legal compliance or abuse prevention.</>
        ]
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          <>The MyTravelPlanner service, branding, software and original service content are protected by applicable intellectual-property laws. You retain responsibility for information you submit and may use your generated trip plans for personal travel planning and sharing.</>
        ]
      },
      {
        heading: "Limitation of liability",
        paragraphs: [
          <>To the maximum extent permitted by applicable law, MyTravelPlanner is not liable for losses arising solely from reliance on estimates, third-party information, missed transport, changed schedules, unavailable bookings, venue closures or other travel circumstances outside the service's control.</>
        ]
      },
      {
        heading: "Governing terms",
        paragraphs: [
          <>The final production version will identify the operating legal entity, governing law and jurisdiction before commercial launch.</>
        ]
      }
    ]
  },

  disclaimer: {
    title: "Travel Disclaimer",
    intro:
      "Travel plans are decision-support information, not a guarantee that real-world travel will happen exactly as shown.",
    icon: <TriangleAlert size={22}/>,
    sections: [
      {
        heading: "Always verify critical details",
        paragraphs: [
          <>Confirm transport schedules, ticket status, road conditions, hotel reservations, venue or darshan timings, entry requirements and other critical details with the official provider before departure.</>
        ]
      },
      {
        heading: "AI and automated planning",
        paragraphs: [
          <>Some plans may use AI-assisted reasoning. Automated systems can make mistakes or rely on incomplete information. MyTravelPlanner is designed to avoid inventing critical schedules, but you should still verify important facts independently.</>
        ]
      },
      {
        heading: "Costs",
        paragraphs: [
          <>Any cost shown is a rough planning estimate unless explicitly identified as a confirmed live price. Actual fares, taxes, tolls, hotel rates, food costs and local transport charges can differ materially.</>
        ]
      },
      {
        heading: "Safety and suitability",
        paragraphs: [
          <>You remain responsible for deciding whether a route, activity, vehicle, accommodation or schedule is suitable for your group, including children, seniors and travellers with accessibility or medical needs.</>
        ]
      },
      {
        heading: "Third-party services",
        paragraphs: [
          <>References to transport operators, maps, hotels, restaurants, attractions or other third parties do not constitute a guarantee or endorsement of their services.</>
        ]
      }
    ]
  },

  contact: {
    title: "Contact",
    intro:
      "Questions about MyTravelPlanner, your account, privacy or a saved trip can be directed to the support channel below.",
    icon: <Mail size={22}/>,
    sections: [
      {
        heading: "Support",
        paragraphs: [
          supportEmail
            ? <>Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></>
            : <>The production support email will be published when the final domain and branded mailbox are activated.</>
        ]
      },
      {
        heading: "Privacy and data requests",
        paragraphs: [
          <>Use the support address for account-access, correction or deletion requests once the production support mailbox is active.</>
        ]
      }
    ]
  }
};

function AboutUsPage() {
  const capabilities = [
    {
      icon: <Route size={22}/>,
      title: "Journey intelligence",
      text: "Turns route data into a practical movement plan instead of stopping at map time."
    },
    {
      icon: <BrainCircuit size={22}/>,
      title: "Context-aware AI",
      text: "Uses traveller mix, purpose, comfort and trip constraints to shape the recommendation."
    },
    {
      icon: <Users size={22}/>,
      title: "Traveller-aware planning",
      text: "Families, children, seniors and larger groups change what is realistic — the planner accounts for that."
    },
    {
      icon: <Clock3 size={22}/>,
      title: "Realistic time",
      text: "Adds room for meals, rest, freshen-up, arrival buffers and overnight stay when needed."
    },
    {
      icon: <Layers3 size={22}/>,
      title: "One trip, three useful views",
      text: "Best Journey for decisions, Full Plan for execution, Around Your Trip for nearby support."
    },
    {
      icon: <ShieldCheck size={22}/>,
      title: "Safer sharing",
      text: "Owners can share read-only plans, revoke links and let others save their own independent copy."
    }
  ];

  const travellerTypes = [
    {icon:<Briefcase size={20}/>, label:"Business"},
    {icon:<Landmark size={20}/>, label:"Pilgrimage"},
    {icon:<Baby size={20}/>, label:"Families"},
    {icon:<UserRound size={20}/>, label:"Senior-friendly"}
  ];

  const modes = [
    {icon:<Car size={19}/>, label:"Car"},
    {icon:<Train size={19}/>, label:"Train"},
    {icon:<Plane size={19}/>, label:"Flight"},
    {icon:<MapPinned size={19}/>, label:"Mixed"}
  ];

  const ecosystem = [
    {
      title:"QuickStories",
      href:"https://quickstories.in/",
      text:"Short-form digital storytelling."
    },
    {
      title:"ParentsBoard",
      href:"https://parentsboard.in/",
      text:"School and parent information platform."
    },
    {
      title:"Lucky Dangle",
      href:"https://apps.microsoft.com/detail/9n11m525d0m9?hl=en-US&gl=IN",
      text:"Lightweight Windows desktop charm application."
    }
  ];

  return (
    <div className="mtp-about">
      <section className="mtp-about-hero">
        <div className="mtp-about-hero-copy">
          <span className="mtp-about-kicker">
            <Sparkles size={16}/> AI TRAVEL PLANNING, WITHOUT THE NOISE
          </span>

          <h2>
            Quick reference for the trip.
            <span> Practical guidance for the journey.</span>
          </h2>

          <p>
            MyTravelPlanner is built to answer a simple question:
            <strong> what actually makes sense for this trip?</strong>
            It combines route context, traveller needs and planning logic to turn raw travel data into a usable journey plan.
          </p>

          <div className="mtp-about-hero-actions">
            <a href="/" className="mtp-about-primary-cta">
              Plan a trip <ArrowRight size={17}/>
            </a>

            <a href={`mailto:${supportEmail}`} className="mtp-about-secondary-cta">
              <Mail size={16}/> Contact
            </a>
          </div>
        </div>

        <div className="mtp-about-hero-visual" aria-label="MyTravelPlanner capabilities">
          <div className="mtp-about-orbit mtp-about-orbit-one">
            <Plane size={22}/>
          </div>
          <div className="mtp-about-orbit mtp-about-orbit-two">
            <Train size={22}/>
          </div>
          <div className="mtp-about-orbit mtp-about-orbit-three">
            <Car size={22}/>
          </div>

          <div className="mtp-about-core">
            <Compass size={34}/>
            <strong>MyTravelPlanner</strong>
            <span>No-nonsense journey guidance</span>
          </div>
        </div>
      </section>

      <section className="mtp-about-proof">
        <div>
          <strong>4</strong>
          <span>travel modes</span>
        </div>
        <div>
          <strong>3</strong>
          <span>planning views</span>
        </div>
        <div>
          <strong>4+</strong>
          <span>traveller contexts</span>
        </div>
        <div>
          <strong>1</strong>
          <span>practical trip picture</span>
        </div>
      </section>

      <section className="mtp-about-split">
        <div className="mtp-about-split-copy">
          <span className="mtp-about-section-label">WHY WE EXIST</span>
          <h3>Travel planning is usually fragmented.</h3>
          <p>
            Route apps show distance. Booking sites show inventory. Blogs show ideas.
            Travellers are still left to decide how the journey should actually happen.
          </p>
          <p>
            MyTravelPlanner sits between those layers. It is the decision layer that turns
            route, time, people and purpose into a clear travel strategy.
          </p>
        </div>

        <div className="mtp-about-problem-list">
          <div><CheckCircle2 size={18}/><span>Should we drive, take a train, fly, or combine modes?</span></div>
          <div><CheckCircle2 size={18}/><span>How much time should we realistically allow?</span></div>
          <div><CheckCircle2 size={18}/><span>Where do meals, rest, freshen-up and stay fit in?</span></div>
          <div><CheckCircle2 size={18}/><span>What changes when children, seniors or a larger group are travelling?</span></div>
        </div>
      </section>

      <section className="mtp-about-section">
        <div className="mtp-about-section-head">
          <div>
            <span className="mtp-about-section-label">WHAT IS INSIDE</span>
            <h3>Built around useful travel decisions</h3>
          </div>
          <p>Not more itinerary text. Better structure, context and next actions.</p>
        </div>

        <div className="mtp-about-capability-grid">
          {capabilities.map((item,index)=>(
            <article key={index} className="mtp-about-capability">
              <span>{item.icon}</span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mtp-about-section mtp-about-flow">
        <div className="mtp-about-section-head">
          <div>
            <span className="mtp-about-section-label">THE REPORT</span>
            <h3>Three layers. Zero clutter.</h3>
          </div>
        </div>

        <div className="mtp-about-flow-grid">
          <article>
            <span className="mtp-about-step">01</span>
            <Compass size={23}/>
            <h4>Best Journey</h4>
            <p>The fast decision view: recommended arrangement, realistic duration, timing and why it fits.</p>
          </article>

          <article>
            <span className="mtp-about-step">02</span>
            <Clock3 size={23}/>
            <h4>Full Plan</h4>
            <p>The executable timeline: travel, meals, breaks, stay, freshen-up and visit flow.</p>
          </article>

          <article>
            <span className="mtp-about-step">03</span>
            <MapPinned size={23}/>
            <h4>Around Your Trip</h4>
            <p>Useful nearby context: stay, food, pilgrimage and places to visit — only when needed.</p>
          </article>
        </div>
      </section>

      <section className="mtp-about-compare">
        <div className="mtp-about-section-head">
          <div>
            <span className="mtp-about-section-label">WHY IT IS DIFFERENT</span>
            <h3>From route data to travel judgement</h3>
          </div>
        </div>

        <div className="mtp-about-compare-grid">
          <div className="mtp-about-compare-column muted">
            <span className="mtp-about-compare-title">Typical travel tool</span>
            <p>Distance and duration</p>
            <p>Generic itinerary blocks</p>
            <p>Same logic for every traveller</p>
            <p>Mixed mode as a vague label</p>
            <p>Booking-first experience</p>
          </div>

          <div className="mtp-about-compare-column strong">
            <span className="mtp-about-compare-title">MyTravelPlanner</span>
            <p><CheckCircle2 size={16}/> Practical duration and buffers</p>
            <p><CheckCircle2 size={16}/> Journey strategy before detail</p>
            <p><CheckCircle2 size={16}/> Traveller-aware planning</p>
            <p><CheckCircle2 size={16}/> Concrete mode combinations</p>
            <p><CheckCircle2 size={16}/> Guidance-first experience</p>
          </div>
        </div>
      </section>

      <section className="mtp-about-section">
        <div className="mtp-about-section-head">
          <div>
            <span className="mtp-about-section-label">WHO IT IS FOR</span>
            <h3>Different journeys need different planning logic</h3>
          </div>
        </div>

        <div className="mtp-about-chip-row">
          {travellerTypes.map((item,index)=>(
            <span key={index}>{item.icon}{item.label}</span>
          ))}
        </div>

        <div className="mtp-about-mode-row">
          {modes.map((item,index)=>(
            <div key={index}>
              {item.icon}
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mtp-about-tech">
        <div className="mtp-about-tech-copy">
          <span className="mtp-about-section-label">HOW IT THINKS</span>
          <h3>AI where it adds value. Rules where they are enough.</h3>
          <p>
            MyTravelPlanner does not use AI just to generate more text.
            Route intelligence, deterministic rules and AI-assisted reasoning are combined so each layer does the job it is best at.
          </p>
        </div>

        <div className="mtp-about-tech-stack">
          <div><BrainCircuit size={20}/><span><strong>AI reasoning</strong><small>Context and recommendation quality</small></span></div>
          <div><Database size={20}/><span><strong>Structured trip data</strong><small>Saved plans and secure sharing</small></span></div>
          <div><Route size={20}/><span><strong>Route intelligence</strong><small>Distance and road comparison</small></span></div>
          <div><Zap size={20}/><span><strong>Lightweight logic</strong><small>Fast decisions without unnecessary cost</small></span></div>
        </div>
      </section>

      <section className="mtp-about-section">
        <div className="mtp-about-section-head">
          <div>
            <span className="mtp-about-section-label">PRODUCT CAPABILITIES</span>
            <h3>From planning to sharing</h3>
          </div>
        </div>

        <div className="mtp-about-tools">
          <span><Save size={18}/> Save & reopen</span>
          <span><Copy size={18}/> Copy to your account</span>
          <span><Share2 size={18}/> Secure sharing</span>
          <span><FileDown size={18}/> PDF / print</span>
          <span><Hotel size={18}/> Stay guidance</span>
          <span><Utensils size={18}/> Food planning</span>
        </div>
      </section>

      <section className="mtp-about-ecosystem">
        <div>
          <span className="mtp-about-section-label">BUILDER ECOSYSTEM</span>
          <h3>Independent products, built around practical usefulness</h3>
        </div>

        <div className="mtp-about-ecosystem-grid">
          {ecosystem.map((item,index)=>(
            <a key={index} href={item.href} target="_blank" rel="noreferrer">
              <span className="mtp-about-ecosystem-index">0{index+1}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <ArrowRight size={17}/>
            </a>
          ))}
        </div>
      </section>

      <section className="mtp-about-final">
        <div>
          <span className="mtp-about-section-label">THE IDEA</span>
          <h3>Plan smarter. Travel clearer.</h3>
          <p>
            MyTravelPlanner is being built as a fast, practical decision layer for travellers who want useful guidance without the noise.
          </p>
        </div>

        <a href="/" className="mtp-about-primary-cta">
          Start planning <ArrowRight size={17}/>
        </a>
      </section>

      <p className="mtp-about-note">
        Travel times, fares, schedules, availability and venue timings may change. Verify critical details with official providers before booking or travel.
      </p>
    </div>
  );
}
export function LegalPageModal({
  page,
  onClose
}:{
  page: LegalPage | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!page) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [page, onClose]);

  if (!page) return null;

  const content = pages[page];

  return createPortal(
    <div
      className="mtp-legal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        className="mtp-legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtp-legal-title"
      >
        <header className="mtp-legal-header">
          <div className="mtp-legal-title">
            <span className="mtp-legal-icon">{content.icon}</span>
            <div>
              <h1 id="mtp-legal-title">{content.title}</h1>
              <small>Last updated: {LAST_UPDATED}</small>
            </div>
          </div>

          <button
            type="button"
            className="mtp-legal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20}/>
          </button>
        </header>

        <div className={`mtp-legal-body ${page === "about" ? "mtp-about-body" : ""}`}>
          {page === "about" ? (
            <AboutUsPage/>
          ) : (
            <>
              <p className="mtp-legal-intro">{content.intro}</p>

              {content.sections.map((section, index) => (
                <section key={index} className="mtp-legal-section">
                  <h2>{section.heading}</h2>

                  {section.paragraphs?.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}

                  {section.bullets && (
                    <ul>
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      </article>
    </div>,
    document.body
  );
}

export function SiteFooter({
  onOpen
}:{
  onOpen: (page: LegalPage) => void;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mtp-site-footer">
      <div className="page-width mtp-site-footer-inner">
        <div className="mtp-footer-brand">
          <span><MapPin size={17}/> MyTravelPlanner</span>
          <p>
            Practical journey planning for real travellers.
          </p>
        </div>

        <nav className="mtp-footer-links" aria-label="Footer">
          <button type="button" onClick={() => onOpen("about")}>About</button>
          <button type="button" onClick={() => onOpen("privacy")}>Privacy</button>
          <button type="button" onClick={() => onOpen("terms")}>Terms</button>
          <button type="button" onClick={() => onOpen("disclaimer")}>Disclaimer</button>
          <button type="button" onClick={() => onOpen("contact")}>Contact</button>
        </nav>

        <p className="mtp-footer-note">
          Travel times, costs, schedules, availability and venue timings may be estimates
          or third-party information. Verify critical details before booking or travel.
        </p>

        <small className="mtp-footer-copy">
          © {currentYear} MyTravelPlanner. All rights reserved.
        </small>
      </div>
    </footer>
  );
}