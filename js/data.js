/* Shared content data — five engines, eleven services, per brief §05.
   Single source of truth for the mega-menu, mobile drawer, the footer
   services column and BOTH accordions (home + services index) — all are
   rendered by partials.js so they cannot drift. The admin dashboard can
   replace these arrays at runtime through data/site.js (see
   js/site-config.js).
     href   — anchor on the services index (mega-menu "View all")
     detail — the engine page the accordion "Explore" link opens */
var OMNI_ENGINES = [
  {
    id: "brand-launch",
    num: "01",
    name: "Brand & Launch",
    codename: "Foundation",
    promise: "Decide what you stand for, then make sure every channel says the same thing.",
    headline: "Before you buy a single impression, be worth remembering.",
    href: "service-brand-launch.html",
    detail: "service-brand-launch.html",
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
    detail: "sub-service.html",
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
    detail: "geo.html",
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
    detail: "sub-service.html",
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
    detail: "sub-service.html",
    groups: [
      { title: "Process design", items: ["ICP and qualification framework","Pipeline stages and exit criteria","Lead handoff SLA between marketing and sales","Forecasting and pipeline review cadence","Territory and account segmentation","Compensation design input"] },
      { title: "Enablement", items: ["Discovery, demo and negotiation playbooks","Objection handling matrix","Battlecards and competitive positioning","Sales decks, one-pagers and proposal templates","Outbound sequences and cadences","Call review and coaching"] },
      { title: "Consulting", items: ["Commercial diagnostic and funnel audit","Sales team structure and hiring profiles","Tooling selection and rollout","Distributor and channel sales development","Training programs and workshops","Fractional CRO / commercial leadership"] }
    ]
  }
];

var OMNI_INDUSTRIES = [
  "Retail & FMCG","Banking & fintech","Telecom","Automotive","Real estate",
  "Healthcare & pharma","Hospitality & travel","Education","B2B & industrial",
  "E-commerce","Government & public sector"
];

/* Collection defaults keep a fresh install identical to the authored site.
   Once an owner touches Collections, the validated copy in site.json wins. */
var OMNI_COLLECTIONS = {
  cases: [{
    id: "ca5e000000000001", slug: "saas-pipeline-rebuild", published: true, order: 0,
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    sector: "b2b", client: "Series B SaaS company", year: "2026",
    fields: {
      title: { en: "3.4× qualified pipeline without increasing spend", az: "Xərci artırmadan 3.4× keyfiyyətli satış kanalı" },
      summary: { en: "A shared qualification model aligned marketing and sales, lifted MQL-to-SQL conversion 240%, and cut blended CAC 38%.", az: "Ortaq keyfiyyət modeli marketinq və satışı uyğunlaşdırdı, MQL-dən SQL-ə konversiyanı 240% artırdı və qarışıq CAC-ı 38% azaltdı." },
      body: {
        en: "<h2>Context</h2><p>A Series-B B2B SaaS company selling into mid-market operations teams. Paid and outbound were both hitting their volume targets. Sales was closing almost none of what came through.</p><h2>The problem</h2><p>Paid was hitting volume targets and sales was ignoring the output. Nobody had defined what qualified meant, so both teams were right. Marketing pointed at the MQL count; sales pointed at a pipeline that wasn't converting.</p><h2>What we did</h2><p>We rebuilt the shared ICP and qualification framework, rewrote the campaign around it, wired lead scoring into the CRM, and introduced a handoff SLA.</p><h2>What happened</h2><p>Qualified pipeline grew 3.4× over two quarters without a proportional increase in spend. MQL-to-SQL conversion rose 240%, blended CAC fell 38%, and the sales cycle shortened by 19 days.</p>",
        az: "<h2>Kontekst</h2><p>Orta bazar əməliyyat komandalarına satış edən B seriyası B2B SaaS şirkəti. Ödənişli və outbound kanallar həcm hədəflərinə çatırdı, lakin satış demək olar ki, heç nəyi bağlamırdı.</p><h2>Problem</h2><p>Heç kim keyfiyyətli lead-in nə demək olduğunu müəyyən etməmişdi. Marketinq MQL sayına, satış isə konversiya olmayan satış kanalına baxırdı.</p><h2>Nə etdik</h2><p>Ortaq ICP və keyfiyyət çərçivəsini qurduq, kampaniyanı yenidən yazdıq, lead qiymətləndirməsini CRM-ə qoşduq və ötürmə SLA-sı tətbiq etdik.</p><h2>Nə baş verdi</h2><p>Keyfiyyətli satış kanalı iki rübdə 3.4 dəfə böyüdü. MQL-dən SQL-ə konversiya 240% artdı, qarışıq CAC 38% azaldı və satış dövrü 19 gün qısaldı.</p>"
      },
      metrics: [
        { value: "3.4×", label: { en: "Qualified pipeline", az: "Keyfiyyətli satış kanalı" } },
        { value: "+240%", label: { en: "MQL→SQL", az: "MQL→SQL" } },
        { value: "−38%", label: { en: "CAC", az: "CAC" } },
        { value: "−19 days", label: { en: "Sales cycle", az: "Satış dövrü" } }
      ]
    }
  }],
  articles: [{
    id: "a471c1e000000001", slug: "mql-is-dead", published: true, order: 0,
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    category: "demand", author: "Priya Anand", date: "2026-09-01", readingMinutes: 6,
    fields: {
      title: { en: "The MQL is dead. Here's the metric that replaced it.", az: "MQL öldü. Onu əvəz edən göstərici budur." },
      dek: { en: "MQL counts optimize for a number sales stopped trusting years ago. Here is what we measure instead.", az: "MQL sayı satışın illər əvvəl etibar etməyi dayandırdığı rəqəmi optimallaşdırır. Bunun əvəzinə ölçdüyümüz budur." },
      body: {
        en: "<p>Every SaaS company we onboard has an MQL number they are proud of and a sales team that ignores it. That gap is not a training problem. It is a measurement problem.</p><h2>What the MQL actually measures</h2><p>A marketing-qualified lead is usually someone who downloaded something and fit a firmographic filter. It measures curiosity and budget, not intent to buy.</p><blockquote>The MQL tells you who might be interested. It has never told you who is about to buy.</blockquote><h2>What we measure instead</h2><p>Pipeline-Qualified Engagement combines signals sales already trusts: repeat pricing visits, several stakeholders from the same account, and direct outreach to a representative.</p><h3>Why it works better</h3><ul><li>It is built from signals sales already believes.</li><li>It rewards account-level behavior.</li><li>It is harder to game with a single asset.</li></ul><h2>Rolling it out without a turf war</h2><p>The rollout works when sales helps write the scoring model. We run a two-week joint workshop before a single CRM field changes.</p>",
        az: "<p>Qeydiyyatdan keçirdiyimiz hər SaaS şirkətinin fəxr etdiyi MQL rəqəmi və onu nəzərə almayan satış komandası var. Bu, təlim deyil, ölçmə problemidir.</p><h2>MQL həqiqətən nəyi ölçür</h2><p>Marketinq-keyfiyyətli lead adətən nəyisə yükləmiş və firmoqrafik filtrə uyğun gələn şəxsdir. Bu, alış niyyətini deyil, marağı və büdcəni ölçür.</p><blockquote>MQL sizə kimin maraqlana biləcəyini deyir. Heç vaxt kimin almaq üzrə olduğunu deməyib.</blockquote><h2>Bunun əvəzinə nəyi ölçürük</h2><p>Pipeline-Qualified Engagement satışın artıq etibar etdiyi siqnalları birləşdirir: qiymət səhifəsinə təkrar baxışlar, eyni hesabdan bir neçə maraqlı tərəf və nümayəndəyə birbaşa müraciət.</p><h3>Niyə daha yaxşı işləyir</h3><ul><li>Satışın inandığı siqnallardan qurulub.</li><li>Hesab səviyyəsində davranışı mükafatlandırır.</li><li>Tək bir materialla aldatmaq daha çətindir.</li></ul><h2>Ərazi müharibəsi olmadan tətbiq</h2><p>Satış qiymətləndirmə modelinin yazılmasına kömək etdikdə tətbiq işləyir. CRM dəyişməzdən əvvəl iki həftəlik birgə seminar keçiririk.</p>"
      }
    }
  }],
  jobs: [{
    id: "b0b0000000000001", slug: "senior-media-buyer", published: true, order: 0,
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    location: "Austin, TX", remote: false, type: "full-time", applyUrl: "https://www.omnimark.com/contact.html", validThrough: "",
    fields: {
      title: { en: "Senior Media Buyer, Offline & Digital", az: "Baş Media Alıcısı, Oflayn və Rəqəmsal" },
      summary: { en: "Media & Reach team · Austin, TX · Hybrid", az: "Media və Əhatə komandası · Austin, TX · Hibrid" },
      body: { en: "<h2>What you'll do</h2><p>Plan and buy across TV, OOH/DOOH, paid search and paid social on one audience model. You will own the channel-mix recommendation and defend it directly to clients.</p><h2>What we're looking for</h2><ul><li>4+ years buying traditional and digital media.</li><li>Comfort presenting to a client CMO.</li><li>Fluency in a major DSP and a traditional buying platform.</li></ul><h2>How we work</h2><p>Monthly budget reallocation against pipeline, not clicks. You will sit inside the same pod as creative, platforms and sales.</p>", az: "<h2>Nə edəcəksiniz</h2><p>TV, OOH/DOOH, ödənişli axtarış və sosial media üzrə vahid auditoriya modeli ilə planlaşdırma və alış edəcəksiniz. Kanal qarışığı tövsiyəsini hazırlayıb müştərilərə müdafiə edəcəksiniz.</p><h2>Kimi axtarırıq</h2><ul><li>Ənənəvi və rəqəmsal media alışında 4+ il təcrübə.</li><li>Müştəri CMO-suna təqdimat etmək rahatlığı.</li><li>Əsas DSP və ənənəvi alış platformasında sərbəstlik.</li></ul><h2>Necə işləyirik</h2><p>Büdcəni kliklərə deyil, satış kanalına görə aylıq yenidən bölürük. Kreativ, platformalar və satışla eyni komandada olacaqsınız.</p>" }
    }
  }],
  team: [
    ["7ea0000000000001","Maya Sorensen","Ex-VaynerMedia · Brand & Launch","Keçmiş VaynerMedia · Brend və Buraxılış"],
    ["7ea0000000000002","Jonah Trent","Ex-R/GA · Creative & Production","Keçmiş R/GA · Kreativ və İstehsal"],
    ["7ea0000000000003","Priya Anand","Ex-HubSpot · Platforms & Product","Keçmiş HubSpot · Platformalar və Məhsul"],
    ["7ea0000000000004","Leo Castellan","Ex-Wieden+Kennedy · Media & Reach","Keçmiş Wieden+Kennedy · Media və Əhatə"],
    ["7ea0000000000005","Elena Wu","Ex-Salesforce · Sales & Revenue","Keçmiş Salesforce · Satış və Gəlir"],
    ["7ea0000000000006","David Kim","Ex-Wpromote · Media & Reach","Keçmiş Wpromote · Media və Əhatə"]
  ].map(function(x,index){ return { id:x[0], slug:"team-"+(index+1), published:true, order:index, createdAt:"2026-09-01T00:00:00.000Z", updatedAt:"2026-09-01T00:00:00.000Z", name:x[1], linkedin:"", fields:{ role:{en:x[2],az:x[3]}, bio:{en:"",az:""} } }; }),
  testimonials: [
    { id:"7e57000000000001", slug:"rania-kessler", published:true, order:0, createdAt:"2026-09-01T00:00:00.000Z", updatedAt:"2026-09-01T00:00:00.000Z", name:"Rania Kessler", company:"Halo Bank", fields:{ quote:{en:"We'd been running marketing and sales like two separate companies. OmniMark made it one motion inside a quarter — and for the first time our forecast matched what actually closed.",az:"Marketinq və satışı iki ayrı şirkət kimi idarə edirdik. OmniMark bunu bir rüb ərzində tək bir hərəkətə çevirdi — və ilk dəfə proqnozumuz həqiqətən bağlanan sövdələşmələrlə üst-üstə düşdü."},role:{en:"VP Revenue",az:"Gəlir üzrə vitse-prezident"} } },
    { id:"7e57000000000002", slug:"daniel-okafor", published:true, order:1, createdAt:"2026-09-01T00:00:00.000Z", updatedAt:"2026-09-01T00:00:00.000Z", name:"Daniel Okafor", company:"Coastway", fields:{ quote:{en:"They killed a channel we loved in month two because the numbers said to. Nobody else has ever told us to stop spending.",az:"Sevdiyimiz bir kanalı ikinci ayda dayandırdılar, çünki rəqəmlər belə deyirdi. Bizə xərcləməyi dayandırmağı deyən başqa heç kim olmayıb."},role:{en:"Founder",az:"Təsisçi"} } }
  ]
};

if (typeof window !== "undefined") {
  window.OMNI_ENGINES = OMNI_ENGINES;
  window.OMNI_INDUSTRIES = OMNI_INDUSTRIES;
  window.OMNI_COLLECTIONS = OMNI_COLLECTIONS;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { engines: OMNI_ENGINES, industries: OMNI_INDUSTRIES, collections: OMNI_COLLECTIONS };
}
