/* Shared content data — five engines, eleven services, per brief §05.
   Single source of truth for the mega-menu, mobile drawer and the
   services-index accordion so the three stay in sync. */
window.OMNI_ENGINES = [
  {
    id: "brand-launch",
    num: "01",
    name: "Brand & Launch",
    codename: "Foundation",
    promise: "Decide what you stand for, then make sure every channel says the same thing.",
    headline: "Before you buy a single impression, be worth remembering.",
    href: "service-brand-launch.html",
    groups: [
      { title: "Strategy", items: ["Category & competitor research","Audience segmentation and personas","Brand positioning","Messaging architecture","Value proposition testing","Brand architecture (master / sub-brand)"] },
      { title: "Identity", items: ["Naming & verbal identity","Tone of voice","Logo and visual identity","Type, colour and motion systems","Packaging and retail identity","Brand guidelines and design systems"] },
      { title: "Launch", items: ["Go-to-market strategy","Launch campaign platform","Phased launch calendar","Pricing and offer narrative","Sales-ready launch kit","Employer brand and internal rollout","Brand health tracking"] }
    ]
  },
  {
    id: "creative-production",
    num: "02",
    name: "Creative & Production",
    codename: "Signal",
    promise: "One idea, built properly for every screen, street and shelf it lands on.",
    headline: "A 48-sheet and a nine-second vertical are not the same job. We stop treating them like they are.",
    href: "services.html#engine-02",
    groups: [
      { title: "Above the line", items: ["TV and CTV commercials","Radio and audio","Cinema","Press and print","OOH and DOOH","Campaign platform development"] },
      { title: "Below the line", items: ["Brand activations and experiential","Sampling and field marketing","Shopper and trade marketing","POSM and retail design","Events and sponsorship activation","Direct mail and guerrilla"] },
      { title: "Channel & production", items: ["Social-native creative (vertical, sound-off)","Performance creative for paid social and search","YouTube and CTV formats","Retail-media assets","Creator and influencer briefs","CRM and email creative","Film, photo, motion, 3D and sonic production","Localisation, adaptation and versioning","Creative testing frameworks"] }
    ]
  },
  {
    id: "media-reach",
    num: "03",
    name: "Media & Reach",
    codename: "Reach",
    promise: "Every channel bought on the same logic and reported against the same number.",
    headline: "We don't have a favourite channel. We have your number.",
    href: "services.html#engine-03",
    groups: [
      { title: "Planning", items: ["Audience and consumption research","Reach and frequency modelling","Channel mix and budget allocation","Seasonality and flighting","Competitive spend analysis","Post-campaign analysis and reporting"] },
      { title: "Offline buying", items: ["TV and radio","OOH and DOOH","Press and magazines","Cinema","Sponsorship and branded content","Negotiation and inventory control"] },
      { title: "Digital, geo & performance", items: ["Paid search and shopping","Paid social","Programmatic, native and video","Retail and marketplace media","App install and mobile","SEO — technical, on-page, content","GEO / AEO — visibility inside AI answer engines","Digital PR and link acquisition","Geo-targeted and geo-fenced campaigns","Market-entry and multi-market rollout","Local landing page systems, local SEO and map listings","Attribution, incrementality testing and dashboards"] }
    ]
  },
  {
    id: "platforms-product",
    num: "04",
    name: "Platforms & Product",
    codename: "Build",
    promise: "The infrastructure the campaigns land on, and the system that remembers everyone who arrives.",
    headline: "Traffic is worth nothing if it lands somewhere broken.",
    href: "services.html#engine-04",
    groups: [
      { title: "Web & commerce", items: ["UX / UI design","Design systems","CMS and headless builds","Landing page and funnel systems","E-commerce builds and merchandising","CRO and A/B testing","Performance, accessibility and security","Maintenance and support retainers"] },
      { title: "Apps & product", items: ["Product discovery and definition","Prototyping","iOS, Android and cross-platform build","Web apps and customer portals","QA and release management","App store optimisation","Ongoing product support"] },
      { title: "CRM & data", items: ["CRM selection and implementation","Custom objects and data modelling","Lifecycle and automation flows","Lead scoring and routing","Loyalty and retention programs","Integrations — telephony, chat, ERP, POS, payments","Analytics engineering, server-side tracking, consent","Reporting dashboards"] }
    ]
  },
  {
    id: "sales-revenue",
    num: "05",
    name: "Sales & Revenue",
    codename: "Close",
    promise: "The part every other agency hands back to you.",
    headline: "We stay past the lead.",
    href: "services.html#engine-05",
    groups: [
      { title: "Process design", items: ["ICP and qualification framework","Pipeline stages and exit criteria","Lead handoff SLA between marketing and sales","Forecasting and pipeline review cadence","Territory and account segmentation","Compensation design input"] },
      { title: "Enablement", items: ["Discovery, demo and negotiation playbooks","Objection handling matrix","Battlecards and competitive positioning","Sales decks, one-pagers and proposal templates","Outbound sequences and cadences","Call review and coaching"] },
      { title: "Consulting", items: ["Commercial diagnostic and funnel audit","Sales team structure and hiring profiles","Tooling selection and rollout","Distributor and channel sales development","Training programs and workshops","Fractional CRO / commercial leadership"] }
    ]
  }
];

window.OMNI_INDUSTRIES = [
  "Retail & FMCG","Banking & fintech","Telecom","Automotive","Real estate",
  "Healthcare & pharma","Hospitality & travel","Education","B2B & industrial",
  "E-commerce","Government & public sector"
];
