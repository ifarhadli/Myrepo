# OmniMark deep design and frontend audit

Date: 4 September 2026  
Scope: 15 public pages, the EN/AZ experience, primary navigation, lead forms, and the admin dashboard.  
Evidence: fresh current-run screenshots at desktop, laptop, and mobile sizes; source review; response-header checks; a 54-test end-to-end run; and a throttled local performance sample.

## Implementation resolution — same-day follow-up

The audit below is preserved as the point-in-time evidence that drove the work. The selected launch-hardening scope is now implemented:

| Area | Current result |
|---|---|
| Responsive layouts | Contact and both service-detail templates collapse at phone width; a repository-wide inline fixed-layout sweep found no additional blocking grid declarations. |
| Navigation/disclosures | Mega-menu density is editable (default four links), viewport-bounded, and scrollable. Drawer and collapsed panels synchronize visibility, ARIA, and `inert`. |
| Forms | Every required lead field has linked text, autocomplete where applicable, mirrored server validation, honest one-business-day success copy, and a Resend acknowledgement when configured. |
| Trust/content | Proof is off by default. Only content with a real destination links; missing legal URLs are non-interactive. Sub-services retain useful links to their parent engine anchors. |
| Design/accessibility | Semantic on-light accent tokens pass their text role; team identity is always visible; the admin uses an owned confirmation dialog and revealable secret inputs. |
| Article | The fake gradient figure is a labelled inline SVG; LinkedIn, X, and copy-link actions are wired. |
| SEO/schema | Organization is global; Article is guarded by publishing fields; JobPosting is omitted until every real required value exists. |
| Newsletter scope | Consent timestamp/source are stored and the welcome has an unsubscribe mailto. A real suppression lifecycle waits for the chosen sending platform. |
| Evidence | `npm test`: 66/66. `npm run test:browser`: 19/19. Premium strict static audit: 0 findings. `designmd lint`: 0 errors, 0 warnings. |

Still owner-blocked: approved cases/assets/logos/portraits/numbers/testimonials, real contact and legal details, production notification credentials, and a decision on AZ URLs and future CMS/multi-user scope.

## Overall verdict

The product has a strong foundation, but it is not ready to represent a large agency publicly yet.

The strongest parts are the direct positioning, consistent visual language, readable typography, coherent five-engine structure, reduced-motion support, usable form validation, and unusually capable zero-dependency admin. The build also passes all 54 automated tests.

The blockers are concentrated and fixable:

1. Three commercially important mobile templates do not reflow at 390 px.
2. The proof layer is still placeholder content: no real work imagery, real logos, verified people, or independently supportable results.
3. Several accessibility paths remain incomplete: contrast, skip navigation, off-screen focus, and collapsed accordion content.
4. Multiple visible links promise different content but lead to the same generic page; the article share controls do nothing.
5. Legal, analytics, notification, social-image, and production-operation settings are still unset.

The design should not be thrown away. Its best idea is already present: one connected path from awareness to revenue. The next design pass should make that idea ownable through real work, a disciplined color system, and one signature motion/graphic language instead of more generic gradient decoration.

## Audited journey

| Step | What was reviewed | Health |
|---:|---|---|
| 1 | Homepage hero and initial conversion choice | Good foundation |
| 2 | Client proof, operating model, work, and team proof | Not launch-ready |
| 3 | Desktop Services mega-menu | Needs correction |
| 4 | Services overview and service detail templates | Desktop good; mobile broken |
| 5 | Work index and case-study detail | Structure good; content incomplete |
| 6 | Insights index and article detail | Structure good; false/dead assets present |
| 7 | Contact form, validation, and response promise | Desktop usable; mobile and service contract need work |
| 8 | Mobile homepage and navigation drawer | Mostly healthy; accessibility follow-up needed |
| 9 | Admin authentication and overview | Usable; launch setup visibly incomplete |
| 10 | Admin design, copy, and responsive editing | Strong MVP; mobile is dense |
| 11 | Submission management | Clear empty state; not yet a lead workflow |

## Step evidence and findings

### 1. Homepage hero — good foundation

![Homepage desktop hero with cookie consent](deep-2026-09-04/screenshots/01-home-desktop-hero-cookie.png)

![Homepage mobile hero](deep-2026-09-04/screenshots/13-home-mobile.png)

What works:

- The headline is memorable and quickly communicates full-funnel scope.
- Primary and secondary actions are easy to distinguish.
- Desktop and mobile hierarchy is clear, with no homepage horizontal overflow at 390 px.
- The dark ink, warm paper, signal green, and display/body type pairing feel deliberate.

What to improve:

- The opening paragraph is long for a first viewport. Cut roughly 25–35% and let a real case or client outcome prove the rest.
- The current chart and glow are generic technology-agency motifs. Replace the chart with a real integrated-work frame or make the five-color path an unmistakable OmniMark signature.
- The repeated negative framing (“no deck”, “no discovery marathon”, “not a portfolio”) is sharp but becomes defensive across the site. Keep one anti-agency line and balance the rest with positive evidence.

### 2. Proof and people — not launch-ready

![Homepage client proof and supplier problem](deep-2026-09-04/screenshots/02-home-desktop-proof.png)

![Homepage team section with initials-only placeholders](deep-2026-09-04/screenshots/23-home-team-desktop.png)

What works:

- Proof appears early, before the long services explanation.
- The “five suppliers” argument is a strong articulation of the buyer problem.
- The team promise—senior operators doing the work—is strategically valuable.

What blocks launch:

- The repository contains zero real image, video, or logo assets outside audit screenshots. Client “logos,” work visuals, team portraits, and article art are text or CSS gradients.
- The displayed brands, named people, prior employers, testimonials, partner certifications, `$450M+`, `120+`, `18 markets`, and `94% retention` all need documented approval and substantiation. If any are fictional, hide the sections rather than ship them.
- On desktop, names and roles are still hidden until hover/focus. Core trust information should be visible without interaction. If a person has no profile page, the card should not be an extra keyboard stop.

Market comparison: current large-agency sites lead with recognizable client/project work and visual evidence. R/GA surfaces named projects such as Google, Nike, and Moncler; Monks exposes a filterable inventory of 23 visually represented cases; and Ogilvy’s work index is a large client/project catalog. OmniMark’s structure is comparable, but the evidence layer is not yet comparable. Sources: [R/GA](https://www.rga.com/), [Monks work inventory](https://www.monks.com/work-inventory), [Ogilvy work](https://www.ogilvy.com/work).

### 3. Desktop Services mega-menu — needs correction

![Mega-menu at 1440 by 900](deep-2026-09-04/screenshots/05-home-desktop-mega.png)

![Mega-menu clipped at a common 1366 by 768 laptop viewport](deep-2026-09-04/screenshots/05a-home-mega-1366x768.png)

The horizontal positioning is fixed, but the menu is now too tall. It measures about 804 px from a 92 px top position, putting its bottom around 896 px. At a 768 px viewport the featured case and last links are unreachable in the visible area.

Recommended design:

- Show 3–4 priority links per engine, not seven.
- Add an explicit “All services” destination.
- Give the panel `max-height: calc(100dvh - header - margin)` and internal scrolling as a safety net.
- Keep the featured case only when it contains a real image and case destination; otherwise remove it.
- Make “Services” itself navigable to the overview instead of using the top-level link only as a toggle.

### 4. Services — strong taxonomy, broken detail reflow

![Services overview on desktop](deep-2026-09-04/screenshots/06-services-desktop.png)

![Services overview on mobile](deep-2026-09-04/screenshots/15-services-mobile.png)

![Brand and Launch detail overflowing a 390 px viewport](deep-2026-09-04/screenshots/15a-service-brand-mobile.png)

![Sub-service detail overflowing a 390 px viewport](deep-2026-09-04/screenshots/15b-sub-service-mobile.png)

The five-engine model is the strongest piece of information architecture in the product. The overview accordion is scannable and makes a very broad offer feel organized.

The two detail templates use inline `220px 1fr` grids, so their desktop side navigation survives on mobile. Both pages become 568 px wide inside a 390 px viewport and clip the main content. This affects [service-brand-launch.html](../service-brand-launch.html:36) and [sub-service.html](../sub-service.html:35).

Acceptance target: no page-level horizontal scrolling at 320, 375, 390, or 414 px, including at 200% zoom. On narrow screens, move the local navigation into a compact jump menu above the content and set grid children to `min-width: 0`.

### 5. Work and case studies — good skeleton, insufficient proof

![Work index](deep-2026-09-04/screenshots/07-work-desktop.png)

![Case-study detail](deep-2026-09-04/screenshots/08-case-study-desktop.png)

What works:

- Outcomes lead before methods.
- Filters, metric chips, and the context/problem/approach/result structure are useful.
- Including “what we’d do differently” is credible and uncommon.

What is missing:

- All four work cards lead to the same case-study page.
- The case visuals are indistinct gradients, so a branding, commerce, CRM, and media engagement all look identical.
- The case page needs real artifacts, client or confidentiality context, baseline and measurement method, time window, team/scope, and permissioned testimony.
- Launch with at least 6–9 substantive cases across the five engines. If only one case is ready, show one honest case instead of four false choices.

DEPT and Monks demonstrate the expected pattern: real imagery, named or clearly anonymized clients, tagged capabilities, and outcome metrics within each case. Sources: [DEPT case example](https://www.deptagency.com/case/increasing-revenue-and-growing-brand-awareness-with-new-audiences/), [Monks case example](https://www.monks.com/case-studies/transforming-manulifes-paid-digital-media-operations-housing-success-story).

### 6. Insights and article — good editorial voice, incomplete product

![Insights index](deep-2026-09-04/screenshots/10-insights-desktop.png)

![Article “diagram” rendered as an empty gradient](deep-2026-09-04/screenshots/24-article-figure-desktop.png)

What works:

- The titles have a point of view and the list is easy to scan.
- Category filters and reading times are useful.
- The article body uses a comfortable reading measure and clear subheads.

What blocks launch:

- All six insight rows lead to the same article.
- The element labelled to assistive technology as “Diagram comparing the old MQL funnel to the PQE model” is visually only a blurred gradient. This is misleading to both sighted and screen-reader users.
- LinkedIn, X, and copy-link controls are `href="#"` with no sharing behavior.
- Author identity, expertise, dates, and claims must be real and reviewable.

Add real editorial figures, functional sharing, author pages, related content, and Article/Breadcrumb structured data. Google recommends that structured data describe visible page content and follow the relevant content policies. Sources: [Google structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).

### 7. Contact — good desktop validation, broken mobile layout and a promise mismatch

![Contact form on desktop](deep-2026-09-04/screenshots/11-contact-desktop.png)

![Contact form validation](deep-2026-09-04/screenshots/12-contact-errors-desktop.png)

![Contact form clipping its second column on mobile](deep-2026-09-04/screenshots/16-contact-mobile.png)

What works:

- Labels are explicit, required fields are clear, invalid fields receive `aria-invalid`, the first invalid field receives focus, and email has an inline message.
- Direct email, phone, and office alternatives are visible.
- The form persists a submission before notification is attempted.

What needs correction:

- The inline `1.1fr .9fr` grid on [contact.html](../contact.html:34) forces a roughly 557 px layout in a 390 px viewport.
- Name, company, spend, and consent rely on red borders/color without a field-specific message. The alert red is only about 3.27:1 on the paper background, below the 4.5:1 minimum for normal text.
- Common personal fields lack `autocomplete` tokens such as `name`, `email`, and `organization`.
- “Check your inbox for a calendar link within the hour” is not automated. Current Resend logic notifies the agency and sets reply-to; it does not send the visitor a confirmation or calendar link.
- Notifications are currently shown as not configured in the admin. Until email or webhook delivery is configured, leads only appear in local storage and the admin list.
- The API validates email format but does not enforce the form-specific required fields or consent server-side.
- Making monthly marketing spend mandatory on the first touch can suppress high-value enquiries and excludes brand/product/sales work that does not map cleanly to media spend. Ask for challenge, desired outcome, timeline, and engagement size; make budget optional or contextual.

### 8. Mobile navigation — visually healthy, incomplete modal behavior

![Mobile drawer](deep-2026-09-04/screenshots/14-drawer-mobile.png)

The header now fits at 390 px, the drawer is legible, focus enters it, Tab is trapped, Escape closes it, and focus returns to the opener.

Remaining accessibility risks:

- The drawer is translated off-screen when closed but remains focusable; `aria-hidden` alone does not remove descendants from keyboard order.
- When open, the page behind it is not made inert.
- Collapsed service accordion panels keep their “Explore” links focusable because only height/overflow changes; they are not hidden or inert.
- The injected skip link points to `#main`, but public `<main>` landmarks do not have `id="main"`.

Use the platform `inert` attribute for modal/background state, `hidden` or inert for collapsed panels, and a real main target. These issues need a keyboard and screen-reader regression pass after correction; screenshots alone cannot establish WCAG conformance.

### 9. Admin sign-in and overview — usable, visibly incomplete setup

![Admin sign-in](deep-2026-09-04/screenshots/17-admin-login-desktop.png)

![Admin overview and launch checklist](deep-2026-09-04/screenshots/18-admin-overview-desktop.png)

Strengths:

- Sign-in is simple and the dashboard clearly separates drafts from published state.
- The overview makes unresolved launch setup visible.
- Password hashes and submissions are git-ignored, sessions are HttpOnly/SameSite, mutation origin checks exist, writes are atomic, and rate limits are present.

Before production:

- Rotate the development credential, require a secret-managed production credential, HTTPS, persistent storage, backups, and restore testing.
- Configure notification delivery and surface delivery status/retry rather than logging a failed notification only.
- A single shared password is suitable for an owner-operated MVP, not a large-agency publishing workflow. Add named accounts, roles, 2FA/SSO, audit history, revisions, and staged publishing when more than one editor is involved.

### 10. Admin editing — strong MVP, dense on mobile

![Admin design editor and live preview](deep-2026-09-04/screenshots/19-admin-design-desktop.png)

![Admin copy editor](deep-2026-09-04/screenshots/20-admin-copy-desktop.png)

![Admin copy editor on mobile](deep-2026-09-04/screenshots/22a-admin-copy-mobile.png)

The design editor, bilingual copy fields, live preview, global labels, and unsaved-state handling are strong for a dependency-free MVP.

Improvements:

- On mobile the complete nine-item navigation consumes about 250 px before the editor begins. Collapse it into an admin drawer and keep Save/Publish sticky.
- Replace seven native `confirm()` flows with an app-owned confirmation dialog that names the affected object, supports focus management, and can explain recoverability.
- Add search clear behavior, changed-field counts per section, bulk translation review, and a side-by-side mobile preview.
- Add validation for contrast, empty required content, title/description length, social-image dimensions, and broken/internal destination reuse before publish.
- A free-form CSS field and pasted analytics scripts need revisions/rollback and a preview/staging boundary.

### 11. Submissions — clear storage, not yet a lead operation

![Submissions empty state on desktop](deep-2026-09-04/screenshots/21-admin-submissions-desktop.png)

![Submissions empty state on mobile](deep-2026-09-04/screenshots/22-admin-mobile.png)

The empty state is clear and export/delete controls are easy to find. For a real agency operation, add lead status, owner, notes, source/UTM fields, notification-delivery status, resend/retry, duplicate protection, retention rules, and CRM handoff. Do not turn this into a full CRM; integrate with the chosen CRM and keep this view as a resilient inbox.

### Supplementary desktop coverage

![Homepage services accordion](deep-2026-09-04/screenshots/03-home-desktop-services.png)

![Homepage process and selected-work transition](deep-2026-09-04/screenshots/04-home-desktop-work.png)

![About page](deep-2026-09-04/screenshots/09-about-desktop.png)

These states reinforce the same conclusion: layout rhythm, typography, and component consistency are good; the missing real work and people assets are what keep the system from feeling like a finished large-agency site.

## Prioritized findings

### P0 — resolve before any public launch

1. Fix page-level horizontal overflow on Contact, Brand & Launch, and sub-service templates.
2. Replace or hide fictional/placeholder client names, logos, team identities, prior employers, testimonials, partner claims, performance stats, contact details, and office information.
3. Replace the placeholder public domain, legal links, LinkedIn destination, contact information, and social image.
4. Configure at least one form notification channel and reconcile the visitor success message with the service that actually exists.
5. Give every visible case, insight, industry, service, and role choice a truthful destination—or remove the false choice.

### P1 — resolve in the launch candidate

1. Shorten and viewport-bound the mega-menu.
2. Correct small-text contrast. Current accent ratios on paper/white include coral about 2.74/3.09, signal about 1.15/1.30, teal about 1.63/1.84, magenta about 2.96/3.34, and alert about 3.27/3.68. Normal text needs 4.5:1 under WCAG 2.2. Keep the bright colors as decoration/borders and introduce accessible foreground variants. Source: [WCAG 2.2 contrast criterion](https://www.w3.org/TR/WCAG22/#contrast-minimum).
3. Repair the skip target and prevent focus from reaching closed drawers/collapsed panels; make the background inert while the mobile dialog is open.
4. Implement real article imagery/diagrams and functional share actions.
5. Add field-specific errors, autocomplete, server-side required-field/consent validation, and a reliable success/autoresponder contract.
6. Add Organization, Breadcrumb, Article, and JobPosting structured data where the visible content supports it. Source: [Google JobPosting guidance](https://developers.google.com/search/docs/appearance/structured-data/job-posting).
7. Decide the language SEO architecture. If Azerbaijani search matters, use separate crawlable URLs, localized titles/descriptions, canonicals, and hreflang. The current same-URL toggle is a user-interface translation, not a bilingual search architecture.

### P2 — quality and scale

1. Replace the mobile admin tab wall with a drawer and optimize long editors for narrow screens.
2. Replace native confirms with accessible product dialogs.
3. Add a media pipeline: AVIF/WebP, responsive `srcset`/`sizes`, dimensions, crop variants, lazy loading below the fold, and CDN/object storage. Responsive images reduce unnecessary mobile transfer and can improve LCP. Source: [web.dev responsive-image guidance](https://web.dev/articles/serve-responsive-images).
4. Self-host/subset critical fonts or preconnect/preload them deliberately; add long-lived, fingerprinted asset caching and Brotli/gzip at the proxy/CDN.
5. Create durable `DESIGN.md` and `UX-CONTRACT.md` documents that define tokens, component behavior, layer/overlay rules, responsive breakpoints, empty/error/loading states, accessibility targets, and source-of-truth ownership.
6. Add visual regression snapshots for representative desktop/mobile routes and state-based keyboard tests; the current functional suite cannot catch CSS reflow or clipped overlays.
7. Correct the process-step color selectors. The decorative line is the first child, so the current `nth-child()` rules shift the intended colors: step 01 renders coral and step 04 falls back to violet instead of following the declared sequence.

## Recommended design direction

### Make “one unbroken path” the ownable brand asset

Use the five engine colors only to encode progression from brand to revenue. Turn the line into a consistent system across the hero, navigation, case studies, charts, section transitions, and showreel. It should connect real client artifacts—not float as a decorative gradient.

### Make the homepage work-first

A better first sequence is:

1. Sharp proposition and one real flagship case frame.
2. Recognizable, permissioned client proof.
3. Three outcome-led cases that collectively prove the integrated offer.
4. The five-engine model.
5. Method, people, thought leadership, and contact.

This changes the site from “we can do everything” to “here is evidence that we have done connected work.”

### Use a stricter visual hierarchy

- Preserve ink/paper/signal as the primary brand trio.
- Reserve the five accent colors for engine identity; do not use them as small body text unless an accessible shade is selected for the surface.
- Increase mono labels from 10–11 px to 12–13 px where they carry meaning.
- Keep one large kinetic moment per page; avoid stacking custom cursor, magnetic buttons, marquee, count-up, gradient drift, and multiple reveals by default.
- Use persistent captions for people and work. Hover should enhance information, never reveal essential information.

### Build a real art-direction system

Create three reusable visual families:

1. Case work: full-bleed campaign/product frames with controlled crops and real artifacts.
2. Evidence: annotated metrics, before/after comparisons, channel maps, and measurement diagrams.
3. People/culture: consistent portrait direction and candid working imagery.

Do not replace placeholders with unrelated stock photography. The agency’s own work should be the visual product.

## What should be added

### Launch essentials

- Real legal pages: Privacy, Terms, and a complete cookie policy/preferences experience.
- Accessibility statement and an accessible contact route.
- At least 6–9 real case studies with assets, permissions, scope, metrics, and measurement notes.
- Real leadership/team profiles and office/market truth.
- A social-share image system and per-page preview QA.
- Analytics/event plan: CTA clicks, service interest, case engagement, form start/error/success, scheduler booking, and source/UTM persistence.
- CRM routing with lead owner and SLA, plus a visitor confirmation email if the interface promises one.
- Newsletter double opt-in, unsubscribe path, and consent/retention policy.
- Production monitoring, backups, restore tests, uptime/error alerts, and staged deployment.

### CMS/admin roadmap

These are scope additions, not defects in the current MVP:

- Structured collections for cases, articles, roles, team, clients, testimonials, and locations.
- Media library with crop variants, focal point, alt text, rights/expiry metadata, and usage tracking.
- Drafts, preview links, scheduled publishing, revisions, rollback, and approval workflow.
- Named users, roles, SSO/2FA, audit log, and content locking.
- Redirect manager, broken-link report, SEO/social preview, and structured-data validation.
- Submission assignment/status/notes and CRM sync health.

### Enterprise credibility

- Procurement/trust page covering company details, privacy/security posture, accessibility, responsible AI, and key partner certifications.
- Awards/press only where independently verifiable.
- Credentials deck or capability PDF for procurement-led buyers.
- Global/market coverage backed by real offices, partner network, or service model.
- Methodology pages for measurement, experimentation, and commercial accountability.

## Frontend and performance notes

- All 15 public routes returned one H1, one main landmark, no duplicate IDs, and no missing programmatic labels in the sampled visible controls.
- The current asset-light homepage transfers roughly 355 KB of encoded resources in the warm local browser sample.
- Under a synthetic 4G connection and 4× CPU throttle, the local homepage sample produced approximately 1.29 s LCP and 0.006 CLS. This is encouraging, but the sample has local-server latency and no real campaign imagery.
- Field targets should remain at LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.1 at the 75th percentile. Source: [web.dev Core Web Vitals](https://web.dev/articles/vitals).
- Every public page currently loads the full shared script/data set, including the complete 520-key EN and 520-key AZ dictionaries. The size is acceptable today, but collections and media should not become one global payload.
- The Node server does not compress responses and gives non-data assets only five minutes of caching. Put it behind a production proxy/CDN with compression, fingerprinted long-lived assets, HTTPS/HSTS, and a CSP based on approved analytics vendors.
- The README says 517 dictionary keys per language; the current source contains 520/520. Update the documentation.

## Evidence limits

- Screenshots were captured from a current isolated Chrome 152 session against the running local build; prior audit screenshots were not reused.
- Visual captures used reduced-motion mode for stable evidence. Motion was reviewed in source, not judged frame by frame.
- This was not a legal opinion, penetration test, real-device lab, or formal WCAG conformance audit.
- Screen-reader behavior still needs NVDA/Firefox and VoiceOver/Safari testing after focus fixes.
- Production CDN, HTTPS, email/webhook delivery, CRM integration, analytics, consent vendor, SEO indexing, and field Core Web Vitals could not be verified locally.
- No real brand assets or owner-approved proof were available, so art direction could only be evaluated as a system, not as finished agency work.
- The premium static audit helper did not complete and was terminated; manual source review and browser evidence were used instead.

Screenshot evidence is stored in `audit/deep-2026-09-04/screenshots/`.
