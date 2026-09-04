/* Translation dictionary — EN / AZ. Consumed by js/i18n.js via
   data-i18n="dot.path" attributes. Namespaces map to where content
   lives: nav/footer/mega/drawer/industries/cookie are shared (rendered
   by partials.js on every page); engines is the five-engine content
   shared by the mega-menu, mobile drawer and both accordions; the rest
   are per-page namespaces named after the page. */
window.OM_I18N = {
  en: {
    forms: {
      error: "We could not send that. Please try again, or email us at",
      subscribeError: "Could not subscribe right now. Please try again.",
      required: "This field is required.",
      emailInvalid: "Enter a valid email address.",
      consentRequired: "Please agree before sending."
    },
    availability: {
      caseSoon: "Case study coming soon",
      insightSoon: "Insight coming soon",
      pageSoon: "Page coming soon",
      roleSoon: "Role page coming soon"
    },
    nav: {
      skip: "Skip to content",
      home: "Home", services: "Services", work: "Work", industries: "Industries",
      about: "About", insights: "Insights", careers: "Careers", contact: "Contact"
    },
    footer: {
      blurb: "One accountable team across the whole path to purchase — brand, media, platforms and sales.",
      signalTitle: "The Signal",
      signalDesc: "One email every other Tuesday on what's actually working in B2B demand.",
      subscribe: "Subscribe",
      subscribed: "Subscribed. Watch your inbox.",
      emailPlaceholder: "you@company.com",
      colServices: "Services", colCompany: "Company", colResources: "Resources", colConnect: "Connect",
      about: "About", work: "Work", careers: "Careers", contact: "Contact",
      insights: "Insights", industries: "Industries", markets: "Markets", allServices: "All services",
      rights: "All rights reserved.",
      privacy: "Privacy Policy", terms: "Terms", cookiePrefs: "Cookie Preferences"
    },
    mega: {
      featuredCase: "Featured case",
      featuredHeadline: "3.4&times; qualified pipeline in two quarters",
      featuredSub: "B2B SaaS · Series B",
      readCase: "Read the case &rarr;",
      viewAll: "View all &rarr;",
      allServices: "All services &rarr;"
    },
    drawer: { viewEngine: "View engine &rarr;" },
    cookie: {
      text: "We use cookies for analytics and to improve the site. Non-essential cookies stay off until you say yes.",
      accept: "Accept", reject: "Reject"
    },
    industries: [
      "Retail & FMCG", "Banking & fintech", "Telecom", "Automotive", "Real estate",
      "Healthcare & pharma", "Hospitality & travel", "Education", "B2B & industrial",
      "E-commerce", "Government & public sector"
    ],
    engines: {
      "e1": {
        "name": "Brand & Launch",
        "promise": "Decide what you stand for, then make sure every channel says the same thing.",
        "groups": [
          {
            "title": "Strategy",
            "items": [
              "Category & competitor research",
              "Audience segmentation and personas",
              "Brand positioning",
              "Messaging architecture",
              "Value proposition testing",
              "Brand architecture (master / sub-brand)"
            ]
          },
          {
            "title": "Identity",
            "items": [
              "Naming & verbal identity",
              "Tone of voice",
              "Logo and visual identity",
              "Type, colour and motion systems",
              "Packaging and retail identity",
              "Brand guidelines and design systems"
            ]
          },
          {
            "title": "Launch",
            "items": [
              "Go-to-market strategy",
              "Launch campaign platform",
              "Phased launch calendar",
              "Pricing and offer narrative",
              "Sales-ready launch kit",
              "Employer brand and internal rollout",
              "Brand health tracking"
            ]
          }
        ]
      },
      "e2": {
        "name": "Creative & Production",
        "promise": "One idea, built properly for every screen, street and shelf it lands on.",
        "groups": [
          {
            "title": "Above the line",
            "items": [
              "TV and CTV commercials",
              "Radio and audio",
              "Cinema",
              "Press and print",
              "OOH and DOOH",
              "Campaign platform development"
            ]
          },
          {
            "title": "Below the line",
            "items": [
              "Brand activations and experiential",
              "Sampling and field marketing",
              "Shopper and trade marketing",
              "POSM and retail design",
              "Events and sponsorship activation",
              "Direct mail and guerrilla"
            ]
          },
          {
            "title": "Channel & production",
            "items": [
              "Social-native creative (vertical, sound-off)",
              "Performance creative for paid social and search",
              "YouTube and CTV formats",
              "Retail-media assets",
              "Creator and influencer briefs",
              "CRM and email creative",
              "Film, photo, motion, 3D and sonic production",
              "Localisation, adaptation and versioning",
              "Creative testing frameworks"
            ]
          }
        ]
      },
      "e3": {
        "name": "Media & Reach",
        "promise": "Every channel bought on the same logic and reported against the same number.",
        "groups": [
          {
            "title": "Planning",
            "items": [
              "Audience and consumption research",
              "Reach and frequency modelling",
              "Channel mix and budget allocation",
              "Seasonality and flighting",
              "Competitive spend analysis",
              "Post-campaign analysis and reporting"
            ]
          },
          {
            "title": "Offline buying",
            "items": [
              "TV and radio",
              "OOH and DOOH",
              "Press and magazines",
              "Cinema",
              "Sponsorship and branded content",
              "Negotiation and inventory control"
            ]
          },
          {
            "title": "Digital, geo & performance",
            "items": [
              "Paid search and shopping",
              "Paid social",
              "Programmatic, native and video",
              "Retail and marketplace media",
              "App install and mobile",
              "SEO — technical, on-page, content",
              "GEO / AEO — visibility inside AI answer engines",
              "Digital PR and link acquisition",
              "Geo-targeted and geo-fenced campaigns",
              "Market-entry and multi-market rollout",
              "Local landing page systems, local SEO and map listings",
              "Attribution, incrementality testing and dashboards"
            ]
          }
        ]
      },
      "e4": {
        "name": "Platforms & Product",
        "promise": "The infrastructure the campaigns land on, and the system that remembers everyone who arrives.",
        "groups": [
          {
            "title": "Web & commerce",
            "items": [
              "UX / UI design",
              "Design systems",
              "CMS and headless builds",
              "Landing page and funnel systems",
              "E-commerce builds and merchandising",
              "CRO and A/B testing",
              "Performance, accessibility and security",
              "Maintenance and support retainers"
            ]
          },
          {
            "title": "Apps & product",
            "items": [
              "Product discovery and definition",
              "Prototyping",
              "iOS, Android and cross-platform build",
              "Web apps and customer portals",
              "QA and release management",
              "App store optimisation",
              "Ongoing product support"
            ]
          },
          {
            "title": "CRM & data",
            "items": [
              "CRM selection and implementation",
              "Custom objects and data modelling",
              "Lifecycle and automation flows",
              "Lead scoring and routing",
              "Loyalty and retention programs",
              "Integrations — telephony, chat, ERP, POS, payments",
              "Analytics engineering, server-side tracking, consent",
              "Reporting dashboards"
            ]
          }
        ]
      },
      "e5": {
        "name": "Sales & Revenue",
        "promise": "The part every other agency hands back to you.",
        "groups": [
          {
            "title": "Process design",
            "items": [
              "ICP and qualification framework",
              "Pipeline stages and exit criteria",
              "Lead handoff SLA between marketing and sales",
              "Forecasting and pipeline review cadence",
              "Territory and account segmentation",
              "Compensation design input"
            ]
          },
          {
            "title": "Enablement",
            "items": [
              "Discovery, demo and negotiation playbooks",
              "Objection handling matrix",
              "Battlecards and competitive positioning",
              "Sales decks, one-pagers and proposal templates",
              "Outbound sequences and cadences",
              "Call review and coaching"
            ]
          },
          {
            "title": "Consulting",
            "items": [
              "Commercial diagnostic and funnel audit",
              "Sales team structure and hiring profiles",
              "Tooling selection and rollout",
              "Distributor and channel sales development",
              "Training programs and workshops",
              "Fractional CRO / commercial leadership"
            ]
          }
        ]
      },
      "explore": "Explore the engine &rarr;"
    },
    home: {
      "hero": {
        "eyebrow": "Advertising · Digital · Platforms · Sales",
        "h1": "From the billboard to the closed deal.",
        "lede": "Most agencies hand you a deck and a media plan. We build the brand, make the creative, buy the media, ship the site and the CRM behind it, then rebuild your sales process so the pipeline it creates actually closes. One team, the whole span, one number at the end of it.",
        "ctaPrimary": "Book a 20-minute funnel teardown",
        "ctaSecondary": "See the work",
        "micro": "No deck. No discovery marathon. Just a look at where your funnel leaks."
      },
      "proof": {
        "label": "Brands we build, buy and sell for",
        "fallback": "Working with brands across retail, FMCG, banking, telecom, automotive and real estate.",
        "partners": "Certified partners: Google · Meta · HubSpot"
      },
      "gap": {
        "eyebrow": "The gap",
        "h2": "You don't have five marketing problems. You have five suppliers.",
        "body": "The media agency blames the creative. The creative agency blames the website. The developers never spoke to whoever set up the CRM, and nobody has met the sales team. Every handover costs you a month and a version of the truth. OmniMark takes ownership of the entire span instead — one brief, one team, one number at the end of it.",
        "card1": "<strong>Offline and online, one plan.</strong> The TV buy, the OOH sites and the paid social are planned against the same audience model — not by three companies who've never met.",
        "card2": "<strong>We build what the campaign lands on.</strong> The site, the app and the CRM are ours too, so traffic never arrives somewhere half-finished.",
        "card3": "<strong>We stay past the lead.</strong> We design the sales process and train the people running it. Impressions are not a deliverable."
      },
      "services": {
        "eyebrow": "What we do",
        "h2": "Five engines. One unbroken path.",
        "sub": "Take the whole span, or plug into the part that's actually broken. Most clients start with one engine and end up with three."
      },
      "ourModel": {
        "label": "Our model",
        "c1t": "Engagement",
        "c1": "Monthly cycles, no annual lock-in. Either side can walk with 30 days' notice.",
        "c2t": "Scope changes",
        "c2": "Priced and agreed before we start, not discovered on the invoice.",
        "c3t": "Ownership",
        "c3": "You own every asset, every line of code and every list we build. Nothing is held hostage.",
        "c4t": "Billing",
        "c4": "Real-time budget dashboard, not a PDF that arrives three weeks after the month closes."
      },
      "industriesHead": "Who we do it for.",
      "process": {
        "eyebrow": "How we work",
        "h2": "Four moves. Ninety days to signal.",
        "s1t": "Weeks 1–2",
        "s1h": "Diagnose",
        "s1b": "Funnel audit, CRM teardown, buyer interviews, competitor review. You get the written diagnosis whether or not we end up working together.",
        "s2t": "Weeks 3–4",
        "s2h": "Design",
        "s2b": "Positioning, channel plan, measurement model, and a 90-day roadmap with named owners and dates.",
        "s3t": "Weeks 5–10",
        "s3h": "Deploy",
        "s3b": "Build and launch. Creative in market, sequences live, dashboards wired to the CRM.",
        "s4t": "Week 11+",
        "s4h": "Double down",
        "s4b": "Kill what's flat, fund what's working. Budget reallocates monthly against pipeline, not clicks."
      },
      "work": {
        "eyebrow": "Selected work",
        "h2": "The work, and what it moved.",
        "c1sector": "B2B SaaS",
        "c1result": "3.4× qualified pipeline in two quarters",
        "c1desc": "Moved from category-generic to problem-led positioning, then rewired paid and outbound around the new message.",
        "c1m1": "+240% MQL→SQL",
        "c1m2": "−38% CAC",
        "c1m3": "19 days faster cycle",
        "c2sector": "DTC / Home",
        "c2result": "From one channel to four, without raising blended CAC",
        "c2desc": "Diversified off a single paid platform and built a retention program that paid for the expansion.",
        "c2m1": "4 profitable channels",
        "c2m2": "+52% repeat rate",
        "c2m3": "flat blended CAC",
        "c3sector": "Fintech (anonymised)",
        "c3result": "A pipeline number leadership finally trusted",
        "c3desc": "Rebuilt lifecycle stages and attribution so board reporting stopped contradicting the CRM.",
        "c3m1": "1 source of truth",
        "c3m2": "6 weeks to deploy",
        "c3m3": "100% stage compliance",
        "seeAll": "See all work"
      },
      "numbers": {
        "eyebrow": "Proof, not adjectives",
        "l1": "Media managed annually",
        "l2": "Brands",
        "l3": "Markets",
        "l4": "Client retention",
        "footnote": "Aggregate results across client engagements, 2024–2026. Individual results vary."
      },
      "testi": {
        "eyebrow": "Proof",
        "h2": "Don't take our word for it.",
        "q1": "“We'd been running marketing and sales like two separate companies. OmniMark made it one motion inside a quarter — and for the first time our forecast matched what actually closed.”",
        "n1": "Rania Kessler",
        "r1": "VP Revenue, Halo Bank",
        "q2": "“They killed a channel we loved in month two because the numbers said to. Nobody else has ever told us to stop spending.”",
        "n2": "Daniel Okafor",
        "r2": "Founder, Coastway"
      },
      "team": {
        "eyebrow": "Who you'll actually work with",
        "h2": "Senior operators. No account-manager telephone game.",
        "body": "Every OmniMark pod is led by someone who has carried a number themselves — not a coordinator relaying notes between you and a production team. You meet the people doing the work on the first call, and they stay on the account.",
        "cta": "Meet the team"
      },
      "insights": {
        "eyebrow": "Insights",
        "h2": "What we're arguing about this month.",
        "a1": "The MQL is dead. Here's the metric that replaced it.",
        "a1m": "Demand · 6 min",
        "a2": "Your attribution model is lying to your CFO",
        "a2m": "RevOps · 9 min",
        "a3": "Cold outbound isn't dead. Your list is.",
        "a3m": "Sales · 5 min",
        "readMore": "Read more insights"
      },
      "cta": {
        "h2": "Show us your funnel. We'll show you the leaks.",
        "sub": "Twenty minutes on a call, a written teardown within 48 hours. No pitch deck, no obligation.",
        "reassurance": "We reply within one business day. No drip sequences — we practise what we preach.",
        "labelName": "Name",
        "labelEmail": "Work email",
        "labelCompany": "Company",
        "labelSpend": "Monthly marketing spend",
        "labelBroken": "What's broken right now?",
        "spendPlaceholder": "Select a range",
        "spend1": "Under $10k",
        "spend2": "$10k–$50k",
        "spend3": "$50k–$200k",
        "spend4": "$200k+",
        "button": "Request the teardown",
        "errEmail": "Enter a valid work email.",
        "successH": "Got it.",
        "successB": "We'll reply within one business day."
      }
    },
    services: {
      lede: "Eleven services, ordered the way a buyer actually moves: define the brand, make the work, buy the reach, build the platform, close the deal. Take the whole span, or plug into the part that's actually broken.",
      ctaHeadline: "Not sure which engine you need?",
      ctaSub: "Tell us what's broken. We'll tell you which of the five actually fixes it — free, in twenty minutes.",
      ctaButton: "Book the call"
    },
  "svcBrand": {
    "badge": "Engine 01 · Foundation",
    "h1": "Before you buy a single impression, be worth remembering.",
    "lede": "Positioning, identity and go-to-market — built so the creative, the media buy and the sales deck all say the same thing on day one.",
    "navTitle": "On this page",
    "navIncluded": "What's included",
    "navHow": "How it works",
    "navCase": "A case in point",
    "navPricing": "What it costs",
    "navFaq": "Questions",
    "includedH2": "Three sub-services, one connected system.",
    "howEyebrow": "How we run it",
    "s1b": "Category audit, buyer interviews, positioning gap analysis.",
    "s2b": "Positioning territory, verbal and visual identity direction.",
    "s3b": "Guidelines shipped, launch kit built, internal rollout run.",
    "s4b": "Brand health tracked, messaging refined against real market response.",
    "caseEyebrow": "A case in point",
    "pricingH2": "Two ways in.",
    "projectTag": "Project",
    "projectDesc": "Fixed-scope positioning & identity engagement. Typical range $35k–$90k depending on depth and number of sub-brands.",
    "retainerTag": "Retainer",
    "retainerDesc": "Ongoing brand stewardship — guidelines governance, campaign platform refreshes, health tracking. From $8k/month, monthly cycles, no lock-in.",
    "faqEyebrow": "Questions we get asked",
    "faq1q": "What's the minimum commitment?",
    "faq1a": "Ninety days. Anything shorter and you're paying for setup without seeing the result.",
    "faq2q": "Who owns the brand assets when we're done?",
    "faq2a": "You do. Every file, every guideline, every source asset transfers on final payment.",
    "faq3q": "Do you handle trademark and legal clearance?",
    "faq3a": "We run initial naming screens and flag conflicts, then hand off to your trademark counsel for formal clearance.",
    "faq4q": "Can we start with just one sub-service?",
    "faq4a": "Yes. Positioning-only and identity-only engagements are common — most clients expand into launch once the foundation is set.",
    "crossLabel": "What usually comes next",
    "cross1p": "Once the positioning is set, the creative that carries it across every channel.",
    "cross2tag": "All five engines",
    "cross2h": "See the full span",
    "cross2p": "From the billboard to the closed deal — how the engines connect."
  },
  "subService": {
    "crumb": "Demand Generation",
    "h1": "You don't have a traffic problem. You have a demand problem.",
    "lede": "Capturing existing demand is table stakes and it caps out fast. We build the programs that make people want the thing in the first place — then make sure sales can close them.",
    "navHow": "How we run it",
    "navFaq": "Questions we get asked",
    "inc1": "Category and demand-category definition",
    "inc2": "Original research and point-of-view content",
    "inc3": "Community and category-building programs",
    "inc4": "Full-funnel paid media built around the new demand, not just capture",
    "inc5": "Lifecycle nurture from first interest to sales-ready",
    "howBody": "We start with what the market already believes and where that belief is wrong or incomplete. The program is built to correct it in public — content, campaigns and community that make the category itself, not just your product in it.",
    "caseDesc": "A demand program built around a new, contested point of view — not another feature comparison page.",
    "setupTag": "Program setup",
    "setupDesc": "Category definition, initial content and campaign build. From $20k.",
    "retainerTag": "Monthly retainer",
    "retainerDesc": "Ongoing content, media and lifecycle management. From $6k/month, monthly cycles.",
    "faq1q": "What's the minimum commitment?",
    "faq1a": "Ninety days. Anything shorter and you're paying for setup without seeing the result.",
    "faq2q": "How is this different from lead generation?",
    "faq2a": "Lead gen captures demand that already exists. This creates demand that didn't — then captures that too.",
    "faq3q": "What team size does this need on our side?",
    "faq3a": "One stakeholder for approvals and subject-matter input. We run the program.",
    "faq4q": "Who owns the content and assets?",
    "faq4a": "You do, from day one."
  },
  "industryPage": {
    "eyebrow": "Industry",
    "lede": "Basket size, seasonality and shelf presence decide the plan. We build the brand, buy the traditional and digital media, and wire the CRM to loyalty — one model instead of three suppliers guessing at each other's numbers.",
    "s1eyebrow": "What's different here",
    "s1h2": "Retail runs on two clocks — the calendar and the shelf.",
    "c1t": "Seasonality",
    "c1": "Media plans built around promotional calendars and category peaks, not a flat monthly spend.",
    "c2t": "Trade & shopper",
    "c2": "POSM, sampling and trade marketing planned in the same brief as the digital campaign, not bolted on after.",
    "c3t": "Loyalty & retention",
    "c3": "CRM and lifecycle programs that connect in-store and online purchase history to one customer record.",
    "s2eyebrow": "Relevant engines",
    "s2h2": "Where clients in this sector usually start.",
    "cross1p": "Shopper and trade marketing, POSM, seasonal campaign platforms.",
    "cross2p": "E-commerce builds, loyalty CRM, merchandising.",
    "s3h2": "Work in this sector.",
    "ctaH2": "Talk to someone who's run a retail calendar before."
  },
  "geo": {
    "eyebrow": "Market",
    "h1": "OmniMark in Austin, TX",
    "lede": "Our home market. Full-scope work for Austin and Central Texas brands, plus the local media and channel context that a national deck usually skips.",
    "ctaBtn": "Talk to the Austin team",
    "s1eyebrow": "Local media landscape",
    "s1h2": "What actually reaches an Austin audience.",
    "s1body": "Austin skews younger, tech-heavy and increasingly mobile-first, but out-of-home along I-35 and MoPac still carries real reach for anything with a physical footprint. Local radio and audio hold up better here than in most metros. The read below is directional — we confirm current rate cards and inventory availability at the plan stage, not before.",
    "thChannel": "Channel",
    "thRead": "Read for this market",
    "row1c": "OOH / DOOH",
    "row1r": "Strong on I-35, MoPac and downtown core; premium during SXSW and F1 weekends.",
    "row2c": "Radio & audio",
    "row2r": "High commute-hour reach; good complement to podcast buys skewing tech and culture.",
    "row3c": "Paid social & search",
    "row3r": "Competitive CPMs in tech/SaaS categories; less contested in home services and healthcare.",
    "row4c": "Local SEO",
    "row4r": "Map-pack visibility matters disproportionately for anything with a physical location.",
    "s2eyebrow": "Who we work with here",
    "s2h2": "Local clients, full-scope engagements.",
    "s3eyebrow": "Office",
    "addressTag": "Address",
    "contactTag": "Contact",
    "ctaH2": "Local team, full-scope offer."
  },
  "work": {
    "lede": "Not a portfolio. Proof — filtered by the sector you actually care about.",
    "filterAll": "All",
    "filterFintech": "Fintech",
    "c4result": "Loyalty relaunch lifted repeat purchase 31% in one quarter",
    "c4desc": "Unified in-store and online purchase history into a single CRM record, then rebuilt the lifecycle program around it.",
    "c4m1": "+31% repeat purchase",
    "c4m2": "1 customer record",
    "c3descExtra": "Rebuilt lifecycle stages and attribution so board reporting stopped contradicting the CRM. Shared without client name at their request.",
    "emptyText": "No cases in this sector yet.",
    "emptyLink": "Ask us directly"
  },
  "caseStudy": {
    "footnote": "B2B SaaS · Series B · 90 employees · Engagement: 8 months",
    "thPipeline": "Qualified pipeline",
    "thCycle": "Sales cycle",
    "hContext": "Context",
    "pContext": "A Series-B B2B SaaS company selling into mid-market operations teams. Paid and outbound were both hitting their volume targets. Sales was closing almost none of what came through.",
    "hProblem": "The problem",
    "pProblem": "Paid was hitting volume targets and sales was ignoring the output. Nobody had defined what “qualified” meant, so both teams were right. Marketing pointed at the MQL count; sales pointed at a pipeline that wasn't converting. The board deck and the CRM told two different stories every month.",
    "hDid": "What we did",
    "pDid": "Ran the funnel audit and buyer interviews from our standard diagnose phase, then rebuilt in this order: a shared ICP and qualification framework agreed by both teams, ad creative and landing pages rewritten around the new definition, a lead-scoring model wired into the CRM, and a handoff SLA with actual consequences if either side missed it.",
    "hHappened": "What happened",
    "pHappened": "Qualified pipeline grew 3.4× over two quarters without a proportional increase in spend — most of the gain came from better qualification, not more volume. MQL-to-SQL conversion rose 240%. Blended CAC fell 38% as budget moved away from channels that were producing volume without quality. Sales cycle shortened by 19 days once reps stopped re-qualifying leads marketing had already scored.",
    "hDifferently": "What we'd do differently",
    "pDifferently": "We rebuilt the ad creative before fixing the lifecycle stages. Doing it in the other order would have saved about six weeks — the creative work had to be redone once the qualification framework changed what “working” meant.",
    "quote": "“We'd been running marketing and sales like two separate companies. OmniMark made it one motion inside a quarter.”",
    "role": "VP Revenue, Client (name withheld)",
    "moreLabel": "More work",
    "cross1h": "See all cases",
    "cross1p": "DTC, fintech and retail results.",
    "cross2tag": "Get started",
    "cross2h": "Book a teardown",
    "cross2p": "Twenty minutes, no pitch deck."
  },
  "about": {
    "h1": "We started OmniMark because we kept getting hired to fix the same thing.",
    "lede": "Every audit ended the same way: the marketing was fine, the sales team was fine, and the space between them was a mess. Agencies wouldn't touch it because it isn't a channel, and consultancies wrote decks about it without building anything. So we built the team that does both.",
    "s1eyebrow": "How we operate",
    "s1h2": "Values, without the generic list.",
    "v1": "We say no to work we can't move.",
    "v2": "We show the numbers even when they're flat.",
    "v3": "Seniors do the work, not just the pitch.",
    "careersH2": "We hire operators, not résumés.",
    "careersBody": "If you've run a number and want to run six, talk to us.",
    "careersCta": "See open roles",
    "ctaH2": "Meet the pod that would run your account."
  },
  "insightsPage": {
    "lede": "The point of view that justifies the fee — written by the people doing the work, not a content team writing about it.",
    "filterAll": "All",
    "filterDemand": "Demand",
    "filterSales": "Sales",
    "filterBrand": "Brand",
    "a4": "Positioning isn't a workshop. It's a decision.",
    "a4m": "Brand · 7 min",
    "a5": "Stop reporting on impressions. Start reporting on pipeline.",
    "a5m": "RevOps · 8 min",
    "a6": "Why your best channel last quarter is your worst channel this one",
    "a6m": "Demand · 4 min",
    "emptyText": "Nothing in this category yet."
  },
  "article": {
    "category": "Demand",
    "role": "Priya Anand · Platforms & Product",
    "readTime": "6 min read",
    "updated": "Updated September 2026",
    "p1": "Every SaaS company we onboard has an MQL number they're proud of and a sales team that ignores it. That gap isn't a training problem. It's a measurement problem — the MQL was designed to make marketing look productive, not to predict revenue.",
    "h2a": "What the MQL actually measures",
    "p2": "A marketing-qualified lead is, in most implementations, someone who downloaded something and fit a firmographic filter. It measures curiosity and budget, not intent to buy. Sales teams learned this within a quarter of the first MQL dashboard going live, and they've been quietly discounting the number ever since.",
    "quote": "The MQL tells you who might be interested. It has never told you who's about to buy.",
    "h2b": "What we measure instead: Pipeline-Qualified Engagement",
    "p3": "We replaced the single MQL gate with a composite score built from behavior sales already trusts: repeat visits to pricing, multiple stakeholders from the same account engaging within a two-week window, and direct outreach to a rep rather than a form fill. We call it Pipeline-Qualified Engagement, or PQE.",
    "figAlt": "The old MQL funnel counts individual form fills; the PQE model combines several account-level buying signals.",
    "figOld": "OLD: INDIVIDUAL MQL",
    "figDownload": "Content download",
    "figForm": "Form fill + firmographic fit",
    "figMql": "MQL sent to sales",
    "figVolume": "High volume, weak intent",
    "figNew": "NEW: ACCOUNT-LEVEL PQE",
    "figPricing": "Repeat pricing visits",
    "figStakeholders": "Multiple stakeholders",
    "figRep": "Direct rep outreach",
    "figIntent": "Lower volume, stronger intent",
    "figCaption": "Fig 1. — Old funnel vs. PQE model. Illustrative.",
    "h3": "Why it works better",
    "li1": "It's built from signals sales already believes, so adoption doesn't require a mandate from above.",
    "li2": "It rewards account-level behavior, not one anonymous form fill.",
    "li3": "It's harder to game with a single high-intent asset.",
    "calloutB": "Worth knowing",
    "calloutTextHtml": "PQE isn't a replacement metric you can bolt onto an existing CRM in an afternoon. It requires the lead-scoring and lifecycle rebuild described in our <a href=\"services.html#engine-05\" style=\"text-decoration:underline\">Sales &amp; Revenue</a> engine.",
    "h2c": "Rolling it out without a turf war",
    "p4": "The rollout that works is the one where sales helps write the scoring model, not receive it. We run this as a two-week joint workshop before a single line of the CRM changes — the model has to survive contact with the people who'll actually act on it.",
    "inlineCtaP": "Want the actual scoring model? We'll walk you through it.",
    "inlineCtaBtn": "Book a call",
    "h2d": "The one number that matters at the board level",
    "p5": "None of this replaces revenue as the ultimate scoreboard. PQE is a leading indicator that lets marketing and sales agree on direction three months before the pipeline numbers confirm it either way.",
    "keepReading": "Keep reading",
    "cross1p": "9 min read",
    "cross2tag": "All insights",
    "cross2h": "See everything",
    "cross2p": "Demand, RevOps, sales and brand.",
    "linkCopied": "Article link copied."
  },
  "contactPage": {
    "schedulerLabel": "Pick a time directly",
    "formLabelSolo": "Send us the short version",
    "formLabel": "Or send us the short version",
    "consent": "I agree to be contacted about this enquiry.",
    "panelH3": "Prefer to reach us directly?",
    "emailLead": "Email", "orCall": "or call",
    "officeLabel": "Office",
    "notReadyTag": "Not ready for a call?",
    "notReadyHtml": "Browse the <a href=\"services.html\" class=\"btn-text\">five engines</a> or read <a href=\"insights.html\" class=\"btn-text\">what we're arguing about</a> this month."
  },
  "careersPage": {
    "h1": "We hire operators, not résumés.",
    "lede": "If you've run a number and want to run six, talk to us.",
    "openRoles": "Open roles",
    "role1t": "Senior Media Buyer, Offline & Digital",
    "role1m": "Media & Reach team · Austin, TX · Hybrid",
    "role2t": "Lifecycle & CRM Strategist",
    "role2m": "Platforms & Product team · Remote (US) · Full-time",
    "role3t": "Brand Strategist",
    "role3m": "Brand & Launch team · Austin, TX · Hybrid",
    "role4t": "Revenue Enablement Lead",
    "role4m": "Sales & Revenue team · Remote (US) · Full-time",
    "viewRole": "View role",
    "whyEyebrow": "Why here",
    "w1t": "Ownership",
    "w1": "You own an engine or a piece of one — not a slice of a slide deck.",
    "w2t": "Range",
    "w2": "Full-scope clients mean your work touches brand, media, product and sales — not one lane forever.",
    "w3t": "Honesty",
    "w3": "We show clients flat numbers. We show each other the same."
  },
  "roleDetail": {
    "team": "Media & Reach team",
    "footnote": "Austin, TX · Hybrid · Full-time",
    "h2do": "What you'll do",
    "doBody": "Plan and buy across TV, OOH/DOOH, paid search and paid social for the same client roster — on one audience model, not three disconnected ones. You'll own the channel mix recommendation and defend it directly to clients.",
    "h2look": "What we're looking for",
    "li1": "4+ years buying both traditional and digital media, not just one.",
    "li2": "Comfortable presenting a channel-mix rationale directly to a client CMO.",
    "li3": "Fluent in at least one major DSP and one traditional buying platform.",
    "h2how": "How we work",
    "howBody": "Monthly budget reallocation against pipeline, not clicks. You'll sit inside the same pod as creative, platforms and sales for your accounts — not in a media silo that hands off a spreadsheet.",
    "compB": "Compensation",
    "compText": "Base + performance bonus tied to client retention, not billings alone. Range shared on the first call.",
    "apply": "Apply — talk to us"
  },
  "notFound": {
    "h1": "That page isn't in the funnel.",
    "body": "The link's broken or the page moved. Try the homepage, or tell us what's broken — we're fairly good at that part.",
    "backHome": "Back to home"
  }
  },
  az: {
    forms: {
      error: "Göndərmək mümkün olmadı. Yenidən cəhd edin və ya bizə yazın:",
      subscribeError: "Hazırda abunə olmaq mümkün olmadı. Yenidən cəhd edin.",
      required: "Bu sahə mütləq doldurulmalıdır.",
      emailInvalid: "Düzgün e-poçt ünvanı daxil edin.",
      consentRequired: "Göndərməzdən əvvəl razılıq verin."
    },
    availability: {
      caseSoon: "Keys tezliklə",
      insightSoon: "Yazı tezliklə",
      pageSoon: "Səhifə tezliklə",
      roleSoon: "Vakansiya səhifəsi tezliklə"
    },
    nav: {
      skip: "Məzmuna keç",
      home: "Ana səhifə", services: "Xidmətlər", work: "İşlər", industries: "Sahələr",
      about: "Haqqımızda", insights: "Bloq", careers: "Karyera", contact: "Əlaqə"
    },
    footer: {
      blurb: "Alış prosesinin bütün mərhələlərində məsuliyyət daşıyan tək komanda — brend, media, platformalar və satış.",
      signalTitle: "The Signal",
      signalDesc: "B2B tələbatında nəyin işlədiyi barədə hər iki həftədə bir e-poçt.",
      subscribe: "Abunə ol",
      subscribed: "Abunə oldunuz. Poçt qutunuzu izləyin.",
      emailPlaceholder: "siz@sirket.com",
      colServices: "Xidmətlər", colCompany: "Şirkət", colResources: "Resurslar", colConnect: "Əlaqə",
      about: "Haqqımızda", work: "İşlər", careers: "Karyera", contact: "Əlaqə",
      insights: "Bloq", industries: "Sahələr", markets: "Bazarlar", allServices: "Bütün xidmətlər",
      rights: "Bütün hüquqlar qorunur.",
      privacy: "Məxfilik Siyasəti", terms: "Şərtlər", cookiePrefs: "Kuki Tənzimləmələri"
    },
    mega: {
      featuredCase: "Seçilmiş nümunə",
      featuredHeadline: "İki rüb ərzində keyfiyyətli satış kanalı 3.4 dəfə artdı",
      featuredSub: "B2B SaaS · B seriyası",
      readCase: "Nümunəyə baxın &rarr;",
      viewAll: "Hamısına bax &rarr;",
      allServices: "Bütün xidmətlər &rarr;"
    },
    drawer: { viewEngine: "İstiqaməti gör &rarr;" },
    cookie: {
      text: "Analitika və saytı təkmilləşdirmək üçün kuki fayllarından istifadə edirik. Vacib olmayan kukilər siz razılıq verməyənə qədər deaktiv qalır.",
      accept: "Qəbul et", reject: "Rədd et"
    },
    industries: [
      "Pərakəndə satış və FMCG", "Bank işi və fintex", "Telekommunikasiya", "Avtomobil sənayesi", "Daşınmaz əmlak",
      "Səhiyyə və əczaçılıq", "Qonaqpərvərlik və turizm", "Təhsil", "B2B və sənaye",
      "E-ticarət", "Dövlət və ictimai sektor"
    ],
    engines: {
      "e1": {
        "name": "Brend və Başlanğıc",
        "promise": "Nəyi təmsil etdiyinizi müəyyən edin, sonra bütün kanalların eyni mesajı verdiyinə əmin olun.",
        "groups": [
          {
            "title": "Strategiya",
            "items": [
              "Kateqoriya və rəqib araşdırması",
              "Auditoriya seqmentasiyası və personalar",
              "Brend mövqeləndirmə",
              "Mesaj arxitekturası",
              "Dəyər təklifinin sınaqdan keçirilməsi",
              "Brend arxitekturası (əsas / alt-brend)"
            ]
          },
          {
            "title": "Kimlik",
            "items": [
              "Adlandırma və şifahi kimlik",
              "Danışıq tonu",
              "Loqo və vizual kimlik",
              "Şrift, rəng və hərəkət sistemləri",
              "Qablaşdırma və pərakəndə satış kimliyi",
              "Brend qaydaları və dizayn sistemləri"
            ]
          },
          {
            "title": "Buraxılış",
            "items": [
              "Bazara çıxış strategiyası",
              "Buraxılış kampaniyası platforması",
              "Mərhələli buraxılış təqvimi",
              "Qiymətləndirmə və təklif nərativi",
              "Satışa hazır buraxılış dəsti",
              "İşəgötürən brendi və daxili tətbiq",
              "Brendin sağlamlığının izlənməsi"
            ]
          }
        ]
      },
      "e2": {
        "name": "Yaradıcılıq və İstehsal",
        "promise": "Bir ideya — düşdüyü hər ekran, hər küçə və hər rəf üçün düzgün hazırlanmış.",
        "groups": [
          {
            "title": "Ənənəvi media (ATL)",
            "items": [
              "TV və CTV reklamları",
              "Radio və audio",
              "Kinoteatr",
              "Mətbuat və çap",
              "OOH və DOOH (açıq hava reklamı)",
              "Kampaniya platformasının hazırlanması"
            ]
          },
          {
            "title": "Ənənəvi olmayan media (BTL)",
            "items": [
              "Brend aktivasiyaları və təcrübə marketinqi",
              "Nümunə paylanması və sahə marketinqi",
              "Alıcı və ticarət marketinqi",
              "POSM və pərakəndə satış dizaynı",
              "Tədbirlər və sponsorluq aktivasiyası",
              "Birbaşa poçt və qərilla marketinqi"
            ]
          },
          {
            "title": "Kanal və istehsal",
            "items": [
              "Sosial media üçün yaradıcı məzmun (şaquli, səssiz)",
              "Ödənişli sosial media və axtarış üçün performans kreativi",
              "YouTube və CTV formatları",
              "Pərakəndə media materialları",
              "Yaradıcı və influencer briflər",
              "CRM və e-poçt kreativi",
              "Film, foto, motion, 3D və səs istehsalı",
              "Lokallaşdırma, uyğunlaşdırma və versiyalaşdırma",
              "Kreativ test çərçivələri"
            ]
          }
        ]
      },
      "e3": {
        "name": "Media və Əhatə",
        "promise": "Bütün kanallar eyni məntiqlə alınır və eyni göstəriciyə görə hesabat verilir.",
        "groups": [
          {
            "title": "Planlaşdırma",
            "items": [
              "Auditoriya və istehlak araşdırması",
              "Əhatə və tezlik modelləşdirməsi",
              "Kanal qarışığı və büdcə bölgüsü",
              "Mövsümilik və yayım planlaşdırması",
              "Rəqib xərclərinin təhlili",
              "Kampaniyadan sonrakı təhlil və hesabat"
            ]
          },
          {
            "title": "Oflayn alış",
            "items": [
              "TV və radio",
              "OOH və DOOH",
              "Mətbuat və jurnallar",
              "Kinoteatr",
              "Sponsorluq və brendli məzmun",
              "Danışıqlar və inventar nəzarəti"
            ]
          },
          {
            "title": "Rəqəmsal, coğrafi və performans",
            "items": [
              "Ödənişli axtarış və alış-veriş reklamları",
              "Ödənişli sosial media",
              "Proqramlı, nativ və video reklam",
              "Pərakəndə satış və marketpleys media",
              "Tətbiq yükləmə və mobil",
              "SEO — texniki, səhifə daxili, məzmun",
              "GEO / AEO — süni intellekt cavab sistemlərində görünürlük",
              "Rəqəmsal PR və keçid əldə etmə",
              "Coğrafi hədəflənmiş kampaniyalar",
              "Bazara giriş və çoxbazarlı tətbiq",
              "Yerli açılış səhifəsi sistemləri, yerli SEO və xəritə qeydiyyatı",
              "Atribusiya, artım testləri və idarə panelləri"
            ]
          }
        ]
      },
      "e4": {
        "name": "Platformalar və Məhsul",
        "promise": "Kampaniyaların düşdüyü infrastruktur və gələn hər kəsi xatırlayan sistem.",
        "groups": [
          {
            "title": "Veb və kommersiya",
            "items": [
              "UX / UI dizayn",
              "Dizayn sistemləri",
              "CMS və headless həllər",
              "Açılış səhifəsi və satış hunisi sistemləri",
              "E-ticarət qurulması və merçendayzinq",
              "CRO və A/B testləri",
              "Performans, əlçatanlıq və təhlükəsizlik",
              "Texniki dəstək və baxım xidmətləri"
            ]
          },
          {
            "title": "Tətbiqlər və məhsul",
            "items": [
              "Məhsulun kəşfi və tərifi",
              "Prototipləşdirmə",
              "iOS, Android və çarpaz platforma qurulması",
              "Veb tətbiqlər və müştəri portalları",
              "Keyfiyyətə nəzarət və buraxılış idarəetməsi",
              "Tətbiq mağazası optimallaşdırması",
              "Davamlı məhsul dəstəyi"
            ]
          },
          {
            "title": "CRM və məlumat",
            "items": [
              "CRM seçimi və tətbiqi",
              "Xüsusi obyektlər və məlumat modelləşdirməsi",
              "Həyat dövrü və avtomatlaşdırma axınları",
              "Lead qiymətləndirməsi və yönləndirilməsi",
              "Loyallıq və saxlama proqramları",
              "İnteqrasiyalar — telefoniya, çat, ERP, POS, ödənişlər",
              "Analitika mühəndisliyi, server tərəfli izləmə, razılıq idarəetməsi",
              "Hesabat panelləri"
            ]
          }
        ]
      },
      "e5": {
        "name": "Satış və Gəlir",
        "promise": "Digər bütün agentliklərin sizə geri qaytardığı hissə.",
        "groups": [
          {
            "title": "Proses dizaynı",
            "items": [
              "İCP və keyfiyyət qiymətləndirmə çərçivəsi",
              "Satış boru xətti mərhələləri və çıxış meyarları",
              "Marketinq və satış arasında lead ötürmə SLA-sı",
              "Proqnozlaşdırma və boru xətti nəzərdən keçirmə ritmi",
              "Ərazi və hesab seqmentasiyası",
              "Kompensasiya dizaynına töhfə"
            ]
          },
          {
            "title": "Dəstəkləmə",
            "items": [
              "Kəşf, demo və danışıq təlimatları",
              "Etirazlarla iş matrisi",
              "Battlecard-lar və rəqabət mövqeləndirməsi",
              "Satış təqdimatları, bir səhifəliklər və təklif şablonları",
              "Outbound ardıcıllıqlar və ritmlər",
              "Zəng təhlili və koçinq"
            ]
          },
          {
            "title": "Konsaltinq",
            "items": [
              "Kommersiya diaqnostikası və huni auditi",
              "Satış komandasının strukturu və işə qəbul profilləri",
              "Alət seçimi və tətbiqi",
              "Distribütor və kanal satışının inkişafı",
              "Təlim proqramları və seminarlar",
              "Qismən CRO / kommersiya rəhbərliyi"
            ]
          }
        ]
      },
      "explore": "Bu istiqaməti kəşf edin &rarr;"
    },
    home: {
      "hero": {
        "eyebrow": "Reklam · Rəqəmsal · Platformalar · Satış",
        "h1": "Bilborddan bağlanmış sövdələşməyə qədər.",
        "lede": "Əksər agentliklər sizə təqdimat və media planı verir. Biz brendi qururuq, kreativi hazırlayırıq, medianı alırıq, saytı və onun arxasındakı CRM-i işə salırıq, sonra satış prosesinizi elə yenidən qururuq ki, yaratdığı satış kanalı həqiqətən bağlansın. Tək komanda, bütün mərhələlər, sonda bir rəqəm.",
        "ctaPrimary": "20 dəqiqəlik huni təhlili sifariş edin",
        "ctaSecondary": "İşlərimizə baxın",
        "micro": "Təqdimat yox. Uzun kəşfiyyat prosesi yox. Sadəcə huninizin harada sızdığına baxış."
      },
      "proof": {
        "label": "Brend qurduğumuz, media aldığımız və satdığımız şirkətlər",
        "fallback": "Pərakəndə satış, FMCG, bank işi, telekommunikasiya, avtomobil sənayesi və daşınmaz əmlak sahələrində brendlərlə işləyirik.",
        "partners": "Sertifikatlı tərəfdaşlar: Google · Meta · HubSpot"
      },
      "gap": {
        "eyebrow": "Boşluq",
        "h2": "Sizin beş marketinq probleminiz yoxdur. Beş təchizatçınız var.",
        "body": "Media agentliyi kreativi günahlandırır. Kreativ agentlik saytı günahlandırır. Developerlər CRM-i quran şəxslə heç danışmayıb, satış komandasını isə heç kim tanımır. Hər ötürmə sizə bir ay və bir həqiqət versiyası itkisinə başa gəlir. OmniMark bunun əvəzinə bütün prosesin məsuliyyətini öz üzərinə götürür — bir brif, bir komanda, sonda bir rəqəm.",
        "card1": "<strong>Oflayn və onlayn, tək plan.</strong> TV alışı, açıq hava reklamı yerləri və ödənişli sosial media eyni auditoriya modelinə əsasən planlaşdırılır — bir-birini heç tanımayan üç şirkət tərəfindən deyil.",
        "card2": "<strong>Kampaniyanın düşdüyü yeri də biz qururuq.</strong> Sayt, tətbiq və CRM də bizimdir, ona görə trafik heç vaxt yarımçıq bir yerə düşmür.",
        "card3": "<strong>Biz lead-dən sonra da yanınızdayıq.</strong> Satış prosesini biz dizayn edirik və onu idarə edən insanları biz öyrədirik. Təəssürat say-göstəricisi son məhsul deyil."
      },
      "services": {
        "eyebrow": "Nə edirik",
        "h2": "Beş istiqamət. Bir kəsilməz yol.",
        "sub": "Bütün prosesi götürün, ya da əslində problemli olan hissəyə qoşulun. Əksər müştərilər bir istiqamətlə başlayır və üç istiqamətlə davam edir."
      },
      "ourModel": {
        "label": "Modelimiz",
        "c1t": "Əməkdaşlıq",
        "c1": "Aylıq dövrlər, illik bağlılıq yoxdur. Hər iki tərəf 30 gün əvvəlcədən xəbərdarlıqla ayrıla bilər.",
        "c2t": "Əhatə dəyişiklikləri",
        "c2": "Başlamazdan əvvəl qiymətləndirilir və razılaşdırılır, hesab-fakturada üzə çıxmır.",
        "c3t": "Mülkiyyət",
        "c3": "Yaratdığımız hər material, hər kod sətri və hər siyahı sizindir. Heç nə girov saxlanmır.",
        "c4t": "Hesablaşma",
        "c4": "Real vaxt büdcə paneli — ay bitəndən üç həftə sonra gələn PDF deyil."
      },
      "industriesHead": "Kimlər üçün işləyirik.",
      "process": {
        "eyebrow": "Necə işləyirik",
        "h2": "Dörd addım. Nəticə üçün doxsan gün.",
        "s1t": "1–2-ci həftələr",
        "s1h": "Diaqnoz",
        "s1b": "Huni auditi, CRM təhlili, alıcı müsahibələri, rəqib araşdırması. Birlikdə işləməyimizdən asılı olmayaraq yazılı diaqnozu alırsınız.",
        "s2t": "3–4-cü həftələr",
        "s2h": "Dizayn",
        "s2b": "Mövqeləndirmə, kanal planı, ölçmə modeli və məsul şəxslər və tarixlərlə 90 günlük yol xeritəsi.",
        "s3t": "5–10-cu həftələr",
        "s3h": "Tətbiq",
        "s3b": "Qurulma və buraxılış. Kreativ bazarda, ardıcıllıqlar aktiv, panellər CRM-ə qoşulu.",
        "s4t": "11-ci həftədən sonra",
        "s4h": "Gücləndirmə",
        "s4b": "İşləməyəni dayandırırıq, işləyəni maliyyələşdiririk. Büdcə hər ay klik deyil, satış kanalına görə yenidən bölüşdürülür."
      },
      "work": {
        "eyebrow": "Seçilmiş işlər",
        "h2": "İşlərimiz və onların nəticəsi.",
        "c1sector": "B2B SaaS",
        "c1result": "İki rüb ərzində 3.4 dəfə keyfiyyətli satış kanalı",
        "c1desc": "Kateqoriya-ümumi mövqedən problem-yönümlü mövqeləndirməyə keçdik, sonra ödənişli reklamı və outbound-u yeni mesaja uyğun qurduq.",
        "c1m1": "+240% MQL→SQL",
        "c1m2": "−38% CAC",
        "c1m3": "19 gün daha sürətli dövr",
        "c2sector": "DTC / Ev",
        "c2result": "Bir kanaldan dördə — qarışıq CAC-ı artırmadan",
        "c2desc": "Tək ödənişli platformadan diversifikasiya etdik və genişlənməyə görə ödəyən bir saxlama proqramı qurduq.",
        "c2m1": "4 gəlirli kanal",
        "c2m2": "+52% təkrar alış",
        "c2m3": "sabit qarışıq CAC",
        "c3sector": "Fintex (anonim)",
        "c3result": "Rəhbərliyin nəhayət etibar etdiyi satış kanalı rəqəmi",
        "c3desc": "Həyat dövrü mərhələlərini və atribusiyanı elə yenidən qurduq ki, idarə heyyəti hesabatları artıq CRM ilə ziddiyyət təşkil etmirdi.",
        "c3m1": "1 həqiqət mənbəyi",
        "c3m2": "6 həftəyə tətbiq",
        "c3m3": "100% mərhələ uyğunluğu",
        "seeAll": "Bütün işlərə bax"
      },
      "numbers": {
        "eyebrow": "Sübut, sifət deyil",
        "l1": "İllik idarə olunan media büdcəsi",
        "l2": "Brend",
        "l3": "Bazar",
        "l4": "Müştəri saxlanma dərəcəsi",
        "footnote": "2024–2026-cı illər üzrə müştəri layihələri üzrə cəmlənmiş nəticələr. Fərdi nəticələr dəyişə bilər."
      },
      "testi": {
        "eyebrow": "Sübut",
        "h2": "Sözümüzə inanmayın.",
        "q1": "“Marketinq və satışı iki ayrı şirkət kimi idarə edirdik. OmniMark bunu bir rüb ərzində tək bir hərəkətə çevirdi — və ilk dəfə proqnozumuz həqiqətən bağlanan sövdələşmələrlə üst-üstə düşdü.”",
        "n1": "Rania Kessler",
        "r1": "Gəlir üzrə vitse-prezident, Halo Bank",
        "q2": "“Sevdiyimiz bir kanalı ikinci ayda dayandırdılar, çünki rəqəmlər belə deyirdi. Bizə xərcləməyi dayandırmağı deyyən başqa heç kim olmayıb.”",
        "n2": "Daniel Okafor",
        "r2": "Təsisçi, Coastway"
      },
      "team": {
        "eyebrow": "Kimlərlə işləyəcəksiniz",
        "h2": "Təcrübəli mütəxəssislər. Hesab meneceri telefon oyunu yoxdur.",
        "body": "Hər OmniMark komandasına özü rəqəm daşımış biri rəhbərlik edir — sizinlə istehsal komandası arasında qeydləri ötürən koordinator deyil. İşi görən insanlarla ilk zəngdə tanış olursunuz və onlar hesabda qalır.",
        "cta": "Komanda ilə tanış olun"
      },
      "insights": {
        "eyebrow": "Bloq",
        "h2": "Bu ay nə barədə mübahisə edirik.",
        "a1": "MQL öldü. Onu əvəz edən göstərici budur.",
        "a1m": "Tələbat · 6 dəq",
        "a2": "Atribusiya modeliniz maliyyə direktorunuza yalan deyir",
        "a2m": "RevOps · 9 dəq",
        "a3": "Soyuq outbound ölməyib. Sizin siyahınız ölüb.",
        "a3m": "Satış · 5 dəq",
        "readMore": "Daha çox məqalə oxuyun"
      },
      "cta": {
        "h2": "Huninizi bizə göstərin. Biz sızmaları göstərək.",
        "sub": "İyirmi dəqiqəlik zəng, 48 saat ərzində yazılı təhlil. Təqdimat yox, öhdəlik yox.",
        "reassurance": "Bir iş günü ərzində cavab veririk. Avtomatik e-poçt seriyaları yoxdur — dediyimizi özümüz də tətbiq edirik.",
        "labelName": "Ad",
        "labelEmail": "İş e-poçtu",
        "labelCompany": "Şirkət",
        "labelSpend": "Aylıq marketinq büdcəsi",
        "labelBroken": "Hazırda nə işləmir?",
        "spendPlaceholder": "Aralıq seçin",
        "spend1": "$10k-dan az",
        "spend2": "$10k–$50k",
        "spend3": "$50k–$200k",
        "spend4": "$200k+",
        "button": "Təhlili sifariş edin",
        "errEmail": "Düzgün iş e-poçtu daxil edin.",
        "successH": "Qəbul edildi.",
        "successB": "Bir iş günü ərzində cavab verəcəyik."
      }
    },
    services: {
      lede: "On bir xidmət, alıcının həqiqətən hərəkət etdiyi ardıcıllıqla düzülüb: brendi müəyyən et, işi hazırla, əhatəni al, platformanı qur, sövdələşməni bağla. Bütün prosesi götürün, ya da əslində problemli olan hissəyə qoşulun.",
      ctaHeadline: "Hansı istiqamətə ehtiyacınız olduğuna əmin deyilsiniz?",
      ctaSub: "Bizə nəyin işləmədiyini deyin. Biz sizə beşdən hansının həqiqətən problemi həll etdiyini deyəcəyik — pulsuz, iyirmi dəqiqəyə.",
      ctaButton: "Zəng sifariş edin"
    },
  "svcBrand": {
    "badge": "İstiqamət 01 · Foundation",
    "h1": "Bir təəssürat belə almazdan əvvəl, yadda qalmağa dəyər olun.",
    "lede": "Mövqeləndirmə, kimlik və bazara çıxış — ilk gündən kreativin, media alışının və satış təqdimatının eyni şeyi deməsi üçün qurulub.",
    "navTitle": "Bu səhifədə",
    "navIncluded": "Nə daxildir",
    "navHow": "Necə işləyir",
    "navCase": "Nümunə",
    "navPricing": "Qiymət",
    "navFaq": "Suallar",
    "includedH2": "Üç alt-xidmət, bir bağlı sistem.",
    "howEyebrow": "Necə həyata keçiririk",
    "s1b": "Kateqoriya auditi, alıcı müsahibələri, mövqeləndirmə boşluğu təhlili.",
    "s2b": "Mövqeləndirmə istiqaməti, şifahi və vizual kimlik yönü.",
    "s3b": "Qaydalar hazır, buraxılış dəsti qurulub, daxili tətbiq həyata keçirilib.",
    "s4b": "Brend sağlamlığı izlənir, mesajlaşma real bazar reaksiyasına görə təkmilləşdirilir.",
    "caseEyebrow": "Real nümunə",
    "pricingH2": "İki yol var.",
    "projectTag": "Layihə",
    "projectDesc": "Sabit əhatəli mövqeləndirmə və kimlik xidməti. Dərinlik və alt-brend sayından asılı olaraq adətən $35k–$90k aralığında.",
    "retainerTag": "Abunə xidməti",
    "retainerDesc": "Davamlı brend idarəçiliyi — qaydalara nəzarət, kampaniya platformasının yenilənməsi, sağlamlıq izlənməsi. Aydan $8k-dan başlayaraq, aylıq dövrlər, bağlılıq yoxdur.",
    "faqEyebrow": "Bizə verilən suallar",
    "faq1q": "Minimum öhdəlik nə qədərdir?",
    "faq1a": "Doxsan gün. Daha qısa müddətdə nəticəni görmədən quraşdırmaya pul ödəyirsiniz.",
    "faq2q": "İş bitdikdən sonra brend materialları kimə məxsus olur?",
    "faq2a": "Sizə. Son ödənişdən sonra hər fayl, hər qayda, hər mənbə material sizə keçir.",
    "faq3q": "Ticarət nişanı və hüquqi təsdiqləmə ilə siz məşğul olursunuz?",
    "faq3a": "İlkin adlandırma yoxlamalarını edirik və münaqişələri qeyd edirik, sonra rəsmi təsdiq üçün sizin ticarət nişanı vəkilinizə ötürürük.",
    "faq4q": "Yalnız bir alt-xidmətlə başlaya bilərikmi?",
    "faq4a": "Bəli. Yalnız mövqeləndirmə və ya yalnız kimlik xidmətləri adi haldır — əksər müştərilər təməl qurulduqdan sonra buraxılış mərhələsinə keçir.",
    "crossLabel": "Adətən sonra nə gəlir",
    "cross1p": "Mövqeləndirmə müəyyən olunduqdan sonra, onu bütün kanallara daşıyan kreativ.",
    "cross2tag": "Bütün beş istiqamət",
    "cross2h": "Bütün prosesə baxın",
    "cross2p": "Bilborddan bağlanmış sövdələşməyə qədər — istiqamətlər necə bağlanır."
  },
  "subService": {
    "crumb": "Tələbat Yaratma",
    "h1": "Sizin trafik probleminiz yoxdur. Tələbat probleminiz var.",
    "lede": "Mövcud tələbatı tutmaq minimum tələbdir və tez tavana dəyir. Biz insanların əvvəlcə bunu istəməsini təmin edən proqramlar qururuq — sonra satışın onları bağlaya bilməsini təmin edirik.",
    "navHow": "Necə həyata keçiririk",
    "navFaq": "Bizə verilən suallar",
    "inc1": "Kateqoriya və tələbat-kateqoriyası tərifi",
    "inc2": "Orijinal araşdırma və baxış bucağı məzmunu",
    "inc3": "İcma və kateqoriya qurma proqramları",
    "inc4": "Yalnız tutmaq üçün deyil, yeni tələbat ətrafında qurulmuş tam-huni ödənişli media",
    "inc5": "İlk maraqdan satışa hazır olana qədər həyat dövrü qulluğu",
    "howBody": "Bazarın artıq nəyə inandığından və bu inancın harada yanlış və ya natamam olduğundan başlayırıq. Proqram bunu ictimai şəkildə düzəltmək üçün qurulur — kateqoriyanın özünü yaradan məzmun, kampaniyalar və icma, təkcə sizin məhsulunuzu deyil.",
    "caseDesc": "Yeni, mübahisəli bir baxış bucağı ətrafında qurulmuş tələbat proqramı — başqa bir funksiya müqayisə səhifəsi deyil.",
    "setupTag": "Proqramın qurulması",
    "setupDesc": "Kateqoriya tərifi, ilkin məzmun və kampaniya qurulması. $20k-dan başlayaraq.",
    "retainerTag": "Aylıq abunə",
    "retainerDesc": "Davamlı məzmun, media və həyat dövrü idarəetməsi. Aydan $6k-dan başlayaraq, aylıq dövrlər.",
    "faq1q": "Minimum öhdəlik nə qədərdir?",
    "faq1a": "Doxsan gün. Daha qısa müddətdə nəticəni görmədən quraşdırmaya pul ödəyirsiniz.",
    "faq2q": "Bu lead generasiyadan nə ilə fərqlənir?",
    "faq2a": "Lead generasiyası artıq mövcud olan tələbatı tutur. Bu isə olmayan tələbatı yaradır — sonra onu da tutur.",
    "faq3q": "Sizin tərəfdən nə qədər komanda lazımdır?",
    "faq3a": "Təsdiqlər və məzmun töhfəsi üçün bir məsul şəxs kifayətdir. Proqramı biz idarə edirik.",
    "faq4q": "Məzmun və materiallar kimə məxsusdur?",
    "faq4a": "İlk gündən sizə."
  },
  "industryPage": {
    "eyebrow": "Sahə",
    "lede": "Səbət ölçüsü, mövsümilik və rəf mövcudluğu planı müəyyən edir. Biz brendi qururuq, ənənəvi və rəqəmsal medianı alırıq, CRM-i loyallığa qoşuruq — bir-birinin rəqəmlərini təxmin edən üç təchizatçı əvəzinə tək model.",
    "s1eyebrow": "Burada nə fərqlidir",
    "s1h2": "Pərakəndə satış iki saatla işləyir — təqvim və rəf.",
    "c1t": "Mövsümilik",
    "c1": "Media planları aylıq sabit xərc əvəzinə promosyon təqvimləri və kateqoriya zirvələri ətrafında qurulur.",
    "c2t": "Ticarət və alıcı",
    "c2": "POSM, nümunə paylanması və ticarət marketinqi rəqəmsal kampaniya ilə eyni brifdə planlaşdırılır, sonradan əlavə edilmir.",
    "c3t": "Loyallıq və saxlama",
    "c3": "Mağazadaxili və onlayn alış tarixçəsini bir müştəri qeydinə birləşdirən CRM və həyat dövrü proqramları.",
    "s2eyebrow": "Aidiyyəti istiqamətlər",
    "s2h2": "Bu sektordakı müştərilər adətən haradan başlayır.",
    "cross1p": "Alıcı və ticarət marketinqi, POSM, mövsümi kampaniya platformaları.",
    "cross2p": "E-ticarət qurulması, loyallıq CRM, merçendayzinq.",
    "s3h2": "Bu sektordakı işlər.",
    "ctaH2": "Pərakəndə satış təqvimi idarə etmiş biri ilə danışın."
  },
  "geo": {
    "eyebrow": "Bazar",
    "h1": "Austin, TX-də OmniMark",
    "lede": "Bizim ev bazarımız. Austin və Mərkəzi Texas brendləri üçün tam əhatəli iş, üstəlik milli təqdimatların adətən keçdiyi yerli media və kanal konteksti.",
    "ctaBtn": "Austin komandası ilə danışın",
    "s1eyebrow": "Yerli media mənzərəsi",
    "s1h2": "Austin auditoriyasına həqiqətən nə çatır.",
    "s1body": "Austin daha gənc, texnologiya yönümlü və getdikcə daha çox mobil-öncəlikli auditoriyaya malikdir, lakin I-35 və MoPac boyunca açıq hava reklamı fiziki mövcudluğu olan hər şey üçün hələ də real əhatə təmin edir. Yerli radio və audio burada əksər şəhərlərdən daha yaxşı nəticə verir. Aşağıdakı məlumat istiqamətvericidir — cari qiymət cədvəllərini və inventar mövcudluğunu plan mərhələsində, əvvəl deyil, təsdiqləyirik.",
    "thChannel": "Kanal",
    "thRead": "Bu bazar üçün qiymətləndirmə",
    "row1c": "OOH / DOOH",
    "row1r": "I-35, MoPac və mərkəzdə güclü; SXSW və F1 həftəsonları premium.",
    "row2c": "Radio və audio",
    "row2r": "Yüksək iş saatı əhatəsi; texnologiya və mədəniyyətə yönəlmiş podkast alışlarına yaxşı tamamlayıcı.",
    "row3c": "Ödənişli sosial media və axtarış",
    "row3r": "Texnologiya/SaaS kateqoriyalarında rəqabətli CPM-lər; ev xidmətləri və səhiyyədə daha az rəqabət.",
    "row4c": "Yerli SEO",
    "row4r": "Fiziki məkanı olan hər şey üçün xəritə-paketi görünürlüyü qeyri-mütənasib dərəcədə vacibdir.",
    "s2eyebrow": "Burada kimlərlə işləyirik",
    "s2h2": "Yerli müştərilər, tam əhatəli əməkdaşlıq.",
    "s3eyebrow": "Ofis",
    "addressTag": "Ünvan",
    "contactTag": "Əlaqə",
    "ctaH2": "Yerli komanda, tam əhatəli təklif."
  },
  "work": {
    "lede": "Portfolio deyil. Sübut — həqiqətən maraqlandığınız sektora görə filtrlənmiş.",
    "filterAll": "Hamısı",
    "filterFintech": "Fintex",
    "c4result": "Loyallıq yenidən başlaması bir rübdə təkrar alışı 31% artırdı",
    "c4desc": "Mağazadaxili və onlayn alış tarixçəsini bir CRM qeydinə birləşdirdik, sonra həyat dövrü proqramını onun ətrafında yenidən qurduq.",
    "c4m1": "+31% təkrar alış",
    "c4m2": "1 müştəri qeydi",
    "c3descExtra": "Həyat dövrü mərhələlərini və atribusiyanı elə yenidən qurduq ki, idarə heyəti hesabatları artıq CRM ilə ziddiyyət təşkil etmirdi. Müştərinin xahişi ilə adı göstərilmədən paylaşılıb.",
    "emptyText": "Bu sektorda hələ nümunə yoxdur.",
    "emptyLink": "Birbaşa bizdən soruşun"
  },
  "caseStudy": {
    "footnote": "B2B SaaS · B seriyası · 90 işçi · Əməkdaşlıq: 8 ay",
    "thPipeline": "Keyfiyyətli satış kanalı",
    "thCycle": "Satış dövrü",
    "hContext": "Kontekst",
    "pContext": "Orta bazar əməliyyat komandalarına satış edən B seriyası B2B SaaS şirkəti. Ödənişli və outbound hər ikisi həcm hədəflərinə çatırdı. Satış isə demək olar ki, heç nəyi bağlamırdı.",
    "hProblem": "Problem",
    "pProblem": "Ödənişli reklam həcm hədəflərinə çatırdı, satış isə nəticəni nəzərə almırdı. Heç kim “keyfiyyətli”nin nə demək olduğunu müəyyən etməmişdi, ona görə hər iki komanda haqlı idi. Marketinq MQL sayına işarə edirdi; satış isə konversiya olmayan satış kanalına. İdarə heyəti təqdimatı və CRM hər ay iki fərqli hekayə danışırdı.",
    "hDid": "Nə etdik",
    "pDid": "Standart diaqnoz mərhələmizdən huni auditi və alıcı müsahibələri apardıq, sonra bu ardıcıllıqla yenidən qurduq: hər iki komandanın razılaşdığı ortaq ICP və keyfiyyət çərçivəsi, yeni tərifə uyğun yenidən yazılmış reklam kreativi və açılış səhifələri, CRM-ə qoşulmuş lead-qiymətləndirmə modeli və hər iki tərəf üçün real nəticələri olan ötürmə SLA-sı.",
    "hHappened": "Nə baş verdi",
    "pHappened": "Keyfiyyətli satış kanalı iki rüb ərzində xərcin mütənasib artımı olmadan 3.4 dəfə böyüdü — artımın çoxu daha çox həcmdən deyil, daha yaxşı keyfiyyətdən gəldi. MQL-dən SQL-ə konversiya 240% artdı. Keyfiyyətsiz həcm yaradan kanallardan büdcə çıxarıldıqca qarışıq CAC 38% azaldı. Nümayəndələr marketinqin artıq qiymətləndirdiyi lead-ləri yenidən qiymətləndirməyi dayandırdıqdan sonra satış dövrü 19 gün qısaldı.",
    "hDifferently": "Nəyi fərqli edərdik",
    "pDifferently": "Həyat dövrü mərhələlərini düzəltməzdən əvvəl reklam kreativini yenidən qurduq. Əks ardıcıllıqla etsəydik, təxminən altı həftə qənaət edərdik — keyfiyyət çərçivəsi “işləyən”in mənasını dəyişdikdən sonra kreativ işi yenidən etməli olduq.",
    "quote": "“Marketinq və satışı iki ayrı şirkət kimi idarə edirdik. OmniMark bunu bir rüb ərzində tək bir hərəkətə çevirdi.”",
    "role": "Gəlir üzrə vitse-prezident, Müştəri (adı gizli saxlanılıb)",
    "moreLabel": "Daha çox iş",
    "cross1h": "Bütün nümunələrə bax",
    "cross1p": "DTC, fintex və pərakəndə satış nəticələri.",
    "cross2tag": "Başlayın",
    "cross2h": "Təhlil sifariş edin",
    "cross2p": "İyirmi dəqiqə, təqdimat yoxdur."
  },
  "about": {
    "h1": "OmniMark-ı elə buna görə qurduq ki, hər dəfə eyni şeyi düzəltməyə çağırılırdıq.",
    "lede": "Hər audit eyni şəkildə bitirdi: marketinq qaydasında idi, satış komandası qaydasında idi, aralarındakı boşluq isə qarmaqarışıq idi. Agentliklər bura toxunmurdu, çünki bu bir kanal deyil, konsaltinq şirkətləri isə heç nə qurmadan bu barədə təqdimatlar yazırdı. Ona görə hər ikisini edən komandanı biz qurduq.",
    "s1eyebrow": "Necə işləyirik",
    "s1h2": "Dəyərlər, ümumi siyahı olmadan.",
    "v1": "Hərəkət etdirə bilmədiyimiz işə yox deyirik.",
    "v2": "Rəqəmlər durğun olanda belə onları göstəririk.",
    "v3": "Təcrübəli mütəxəssislər işi görür, təkcə təqdimatı deyil.",
    "careersH2": "Biz mütəxəssis işə götürürük, CV yox.",
    "careersBody": "Əgər bir rəqəm idarə etmisinizsə və altı idarə etmək istəyirsinizsə, bizimlə danışın.",
    "careersCta": "Açıq vakansiyalara bax",
    "ctaH2": "Hesabınızı idarə edəcək komanda ilə tanış olun."
  },
  "insightsPage": {
    "lede": "Haqqı doğrultan baxış bucağı — işi görən insanlar tərəfindən yazılıb, bu barədə yazan məzmun komandası tərəfindən deyil.",
    "filterAll": "Hamısı",
    "filterDemand": "Tələbat",
    "filterSales": "Satış",
    "filterBrand": "Brend",
    "a4": "Mövqeləndirmə seminar deyil. Qərardır.",
    "a4m": "Brend · 7 dəq",
    "a5": "Təəssürat haqqında hesabat verməyi dayandırın. Satış kanalı haqqında hesabat verməyə başlayın.",
    "a5m": "RevOps · 8 dəq",
    "a6": "Niyə keçən rübün ən yaxşı kanalı bu rübün ən pis kanalıdır",
    "a6m": "Tələbat · 4 dəq",
    "emptyText": "Bu kateqoriyada hələ heç nə yoxdur."
  },
  "article": {
    "category": "Tələbat",
    "role": "Priya Anand · Platformalar və Məhsul",
    "readTime": "6 dəqiqəlik oxu",
    "updated": "Yenilənib: Sentyabr 2026",
    "p1": "Qeydiyyatdan keçirdiyimiz hər SaaS şirkətinin fəxr etdiyi bir MQL rəqəmi və onu nəzərə almayan satış komandası var. Bu boşluq təlim problemi deyil. Bu ölçmə problemidir — MQL gəliri proqnozlaşdırmaq üçün deyil, marketinqi məhsuldar göstərmək üçün yaradılıb.",
    "h2a": "MQL həqiqətən nəyi ölçür",
    "p2": "Marketinq-keyfiyyətli lead, əksər hallarda, nəyisə yükləmiş və firmoqrafik filtrə uyğun gələn şəxsdir. Bu, alma niyyətini deyil, marağı və büdcəni ölçür. Satış komandaları bunu ilk MQL panelinin işə düşməsindən bir rüb sonra öyrəndi və o vaxtdan bəri bu rəqəmi sakitcə nəzərə almırlar.",
    "quote": "MQL sizə kimin maraqlana biləcəyini deyir. Heç vaxt kimin almaq üzrə olduğunu deməyib.",
    "h2b": "Bunun əvəzinə nəyi ölçürük: Pipeline-Qualified Engagement",
    "p3": "Tək MQL qapısını satışın artıq etibar etdiyi davranışdan qurulmuş kompozit bir bal ilə əvəz etdik: qiymətləndirmə səhifəsinə təkrar baxışlar, eyni hesabdan iki həftəlik pəncərədə iştirak edən bir neçə maraqlı tərəf və forma doldurmaq əvəzinə birbaşa nümayəndəyə müraciət. Biz buna Pipeline-Qualified Engagement, yəni PQE deyirik.",
    "figAlt": "Köhnə MQL hunisi fərdi forma doldurmalarını sayır; PQE modeli hesab səviyyəsində bir neçə alış siqnalını birləşdirir.",
    "figOld": "KÖHNƏ: FƏRDİ MQL",
    "figDownload": "Kontentin yüklənməsi",
    "figForm": "Forma + firmanın uyğunluğu",
    "figMql": "MQL satışa ötürülür",
    "figVolume": "Yüksək həcm, zəif niyyət",
    "figNew": "YENİ: HESAB SƏVİYYƏLİ PQE",
    "figPricing": "Qiymət səhifəsinə təkrar baxış",
    "figStakeholders": "Bir neçə maraqlı tərəf",
    "figRep": "Nümayəndəyə birbaşa müraciət",
    "figIntent": "Aşağı həcm, daha güclü niyyət",
    "figCaption": "Şəkil 1. — Köhnə huni ilə PQE modelinin müqayisəsi. İllüstrativdir.",
    "h3": "Niyə daha yaxşı işləyir",
    "li1": "Satışın artıq inandığı siqnallardan qurulub, ona görə qəbul edilməsi üçün yuxarıdan əmr tələb olunmur.",
    "li2": "Bir anonim forma doldurmağı deyil, hesab səviyyəsində davranışı mükafatlandırır.",
    "li3": "Tək bir yüksək-niyyətli material ilə aldatmaq daha çətindir.",
    "calloutB": "Bilməyə dəyər",
    "calloutTextHtml": "PQE mövcud CRM-ə bir gündə əlavə edə biləcəyiniz sadə bir əvəzedici göstərici deyil. Bu, <a href=\"services.html#engine-05\" style=\"text-decoration:underline\">Satış və Gəlir</a> istiqamətimizdə təsvir olunan lead-qiymətləndirmə və həyat dövrü yenidən qurulmasını tələb edir.",
    "h2c": "Ərazi müharibəsi olmadan tətbiq etmək",
    "p4": "İşləyən tətbiq o zaman olur ki, satış qiymətləndirmə modelini qəbul etmək əvəzinə onu yazmağa kömək edir. Biz bunu CRM-də bir sətir belə dəyişmədən əvvəl iki həftəlik birgə seminar kimi keçiririk — model onu həqiqətən istifadə edəcək insanlarla təmasdan sağ çıxmalıdır.",
    "inlineCtaP": "Real qiymətləndirmə modelini istəyirsiniz? Sizə addım-addım izah edərik.",
    "inlineCtaBtn": "Zəng sifariş edin",
    "h2d": "İdarə heyəti səviyyəsində əhəmiyyətli olan tək rəqəm",
    "p5": "Bunların heç biri gəliri son hesab lövhəsi kimi əvəz etmir. PQE, marketinq və satışın satış kanalı rəqəmləri təsdiqləməzdən üç ay əvvəl istiqamətə razılaşmasına imkan verən öncül göstəricidir.",
    "keepReading": "Oxumağa davam edin",
    "cross1p": "9 dəqiqəlik oxu",
    "cross2tag": "Bütün bloq yazıları",
    "cross2h": "Hamısına baxın",
    "cross2p": "Tələbat, RevOps, satış və brend.",
    "linkCopied": "Yazının keçidi kopyalandı."
  },
  "contactPage": {
    "schedulerLabel": "Birbaşa vaxt seçin",
    "formLabelSolo": "Bizə qısa versiyanı göndərin",
    "formLabel": "Və ya bizə qısa versiyanı göndərin",
    "consent": "Bu sorğu ilə bağlı mənimlə əlaqə saxlanmasına razıyam.",
    "panelH3": "Birbaşa bizimlə əlaqə saxlamağı üstün tutursunuz?",
    "emailLead": "E-poçt:", "orCall": "və ya zəng edin:",
    "officeLabel": "Ofis",
    "notReadyTag": "Zəngə hazır deyilsiniz?",
    "notReadyHtml": "<a href=\"services.html\" class=\"btn-text\">Beş istiqamətə</a> baxın və ya bu ay <a href=\"insights.html\" class=\"btn-text\">nə barədə mübahisə etdiyimizi</a> oxuyun."
  },
  "careersPage": {
    "h1": "Biz mütəxəssis işə götürürük, CV yox.",
    "lede": "Əgər bir rəqəm idarə etmisinizsə və altı idarə etmək istəyirsinizsə, bizimlə danışın.",
    "openRoles": "Açıq vakansiyalar",
    "role1t": "Baş Media Alıcısı, Oflayn və Rəqəmsal",
    "role1m": "Media və Əhatə komandası · Austin, TX · Hibrid",
    "role2t": "Həyat Dövrü və CRM Strateqi",
    "role2m": "Platformalar və Məhsul komandası · Uzaqdan (ABŞ) · Tam ştat",
    "role3t": "Brend Strateqi",
    "role3m": "Brend və Başlanğıc komandası · Austin, TX · Hibrid",
    "role4t": "Gəlir Dəstəyi Rəhbəri",
    "role4m": "Satış və Gəlir komandası · Uzaqdan (ABŞ) · Tam ştat",
    "viewRole": "Vakansiyaya bax",
    "whyEyebrow": "Niyə burada",
    "w1t": "Mülkiyyət",
    "w1": "Bir istiqaməti və ya onun bir hissəsini idarə edirsiniz — təqdimatın bir dilimini deyil.",
    "w2t": "Genişlik",
    "w2": "Tam əhatəli müştərilər deməkdir ki, işiniz brend, media, məhsul və satışa toxunur — həmişəlik bir sahədə qalmır.",
    "w3t": "Dürüstlük",
    "w3": "Müştərilərə durğun rəqəmləri göstəririk. Bir-birimizə də eyni şeyi göstəririk."
  },
  "roleDetail": {
    "team": "Media və Əhatə komandası",
    "footnote": "Austin, TX · Hibrid · Tam ştat",
    "h2do": "Nə edəcəksiniz",
    "doBody": "Eyni müştəri portfeli üçün TV, OOH/DOOH, ödənişli axtarış və ödənişli sosial media üzrə planlaşdırma və alış edəcəksiniz — üç ayrı deyil, bir auditoriya modelinə əsasən. Kanal qarışığı tövsiyəsini siz hazırlayacaq və birbaşa müştərilərə müdafiə edəcəksiniz.",
    "h2look": "Kimi axtarırıq",
    "li1": "Təkcə birini deyil, həm ənənəvi, həm də rəqəmsal media alışında 4+ il təcrübə.",
    "li2": "Kanal qarışığı əsaslandırmasını birbaşa müştərinin marketinq direktoruna təqdim etməkdə rahat.",
    "li3": "Ən azı bir əsas DSP və bir ənənəvi alış platformasında sərbəst.",
    "h2how": "Necə işləyirik",
    "howBody": "Kliklərə deyil, satış kanalına görə aylıq büdcə yenidən bölgüsü. Hesablarınız üçün kreativ, platformalar və satışla eyni komandada olacaqsınız — cədvəl ötürən media silosunda deyil.",
    "compB": "Kompensasiya",
    "compText": "Baza maaş + təkcə hesab-fakturaya deyil, müştəri saxlanmasına bağlı performans bonusu. Aralıq ilk zəngdə paylaşılır.",
    "apply": "Müraciət edin — bizimlə danışın"
  },
  "notFound": {
    "h1": "Bu səhifə huninin içində deyil.",
    "body": "Link sınıb və ya səhifə köçürülüb. Ana səhifəni sınayın, ya da bizə nəyin sınmış olduğunu deyin — bu sahədə kifayət qədər bacarıqlıyıq.",
    "backHome": "Ana səhifəyə qayıt"
  }
  }
};
