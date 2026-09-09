# OmniMark website and admin audit

Audited: 4 September 2026  
Scope: all 15 public HTML pages, shared frontend code, the Node server/API, and every admin section.  
Method: source review, route and API checks, authenticated CRUD checks against an isolated temporary copy, and visual inspection at 1440×900 and 390×844. No original site content or admin data was changed.

## Resolution status — 4 September 2026

The findings below were verified against the source and screenshots, then addressed on the same day. Status per item:

| Finding | Status | Where |
|---|---|---|
| Cannot add or reposition elements | **Fixed — Phases A and B**: compatible Add/copy, bilingual text, Link/Style, drag-to-slot, mobile Move to and Alt+Up/Down use the existing draft/Undo/Publish/History flow. Structural grids and protected controls remain guarded | `ADD-AND-PLACE-PLAN.md`, `js/site-config.js`, `js/editor.js`, `js/element-rules.js`, server/browser tests |
| Single elements not removable | **Fixed** — reversible Remove/Restore for keyed content, whole controls, shared menu/catalogue copies and optional form fields; protected controls explain why; existing draft, Undo, Publish and History retained | `js/site-config.js`, `js/editor.js`, `server.js`, browser/server regressions |
| P0-1 Desktop mega-menu off-screen | **Fixed** — panel now positions from the header (`.nav-item.has-mega{position:static}`); measures 253–1173 px at 1440 | `css/style.css`, `js/partials.js` |
| P0-2 Consent UI only on homepage | **Fixed** — banner rendered by `partials.js` on every page; analytics gating now site-wide | `js/partials.js`, `index.html` |
| P0-3 Mobile header overflow | **Fixed** — Contact drops out of the bar ≤600 px (kept in drawer); 390 px, no overflow | `css/style.css` |
| P0-3 Drawer focus / dialog semantics / layering | **Fixed** — `role="dialog"`, `aria-modal`, focus in, Tab trap, focus return; cookie banner z-index below drawer | `js/main.js`, `js/partials.js`, `css/style.css` |
| P0-3 Team names hover-only | **Fixed** — names and roles are always visible on desktop and touch | `css/style.css`, `js/main.js` |
| P0-4 Scheduler placeholder | **Fixed** — removed; *Settings → Meeting scheduler URL* renders an iframe, empty hides the block | `contact.html`, `js/main.js`, `server.js`, `js/admin.js` |
| P0-4 Placeholder team / logos / stats / legal / contact | **Open — content**, owner to supply; proof is hidden by default and missing legal URLs are non-links | `js/site-config.js`, `js/partials.js` |
| P0-5 Careers switch desktop-only | **Fixed** | `js/partials.js` |
| P0-5 Hard-coded “OmniMark” marks | **Fixed** — follow *Site name* | `js/partials.js` |
| P0-5 `formFallbackNote` dead field | **Fixed** — removed | `server.js`, `js/admin.js`, `data/site.*` |
| P0-5 Admin copy claim overstated | **Fixed** — wording corrected | `js/admin.js` |
| P0-5 Nav editor, arbitrary page/block CRUD and roles | **Open — scope**, needs a product decision | — |
| P1 1,111 unlabelled admin controls | **Fixed** — `labelize()` links every `.field` label and adds `aria-label` (key + language, engine + field) to the rest | `js/admin.js` |
| P1 Admin nav no focus style | **Fixed** | `css/admin.css` |
| P1 Form errors without `aria-invalid` / focus | **Fixed** — linked text under every required field, autocomplete, `aria-invalid`, server field mapping, focus to first invalid | `js/main.js`, `server.js` |
| P1 No skip link / `aria-current` | **Fixed** | `js/partials.js`, `css/style.css` |
| P1 `role="menu"` misuse | **Fixed** — `role="group"` | `js/partials.js` |
| P1 FAQ `aria-controls` / hidden answers | **Fixed** — `aria-controls` + `aria-hidden` | `js/main.js` |
| P1 Filters `aria-pressed` | **Fixed** | `js/main.js` |
| P1 No canonical / `og:image` / Twitter | **Fixed** — injected server-side on every page; *This page* owns per-page title, description, social image, noindex and live share/search previews | `server.js`, `js/editor.js`, `css/editor.css` |
| P1 `robots.txt` blocks `/data/` | **Fixed** | `robots.txt`, `server.js` |
| P1 AZ on same URL, no hreflang | **Open — architecture** | — |
| P1 Last-write-wins, no revisions | **Fixed for the supported workflow** — revisioned shared drafts reject stale Save/Discard, identify the latest editor, and keep per-user local copies; advanced saves conflict; the last 10 publishes record the responsible user and are restorable. Per-field history remains out of scope | `server.js`, `js/editor.js` |
| P1 Admin usability / partial preview | **Fixed** — authenticated on-page editing previews EN/AZ copy, catalogue, layout, colours and fonts directly on every public page; drafts autosave before Publish | `EDITOR-PLAN.md`, `js/editor.js`, `css/editor.css`, `server.js` |
| P1 Non-atomic `site.js` / sitemap / robots writes | **Fixed** — tmp + rename | `server.js` |
| P2 Cookie without `Secure` | **Fixed** — set behind HTTPS (`x-forwarded-proto`) or `SECURE_COOKIES=1` | `server.js` |
| P2 No HSTS / Permissions-Policy | **Fixed** — HSTS behind HTTPS; Permissions-Policy always | `server.js` |
| P2 No CSP | **Open** — would break owner-pasted tag snippets; apply at the proxy if wanted | — |
| P2 Rate limit behind proxy | **Fixed** — `TRUST_PROXY=1` keys on `X-Forwarded-For` | `server.js` |
| P2 URL fields not scheme-validated | **Fixed** | `server.js` |
| P2 Submissions plaintext, no retention | **Open** — small-scale JSON by design; revisit with a DB | — |
| P2 No automated tests | **Fixed** — 189 integration checks plus 97 real-browser checks | `test/`, `package.json` |
| P2 Mobile Services drawer button UA styling | **Fixed** — button reset | `css/style.css` |
| Post-audit: no email / CRM notification | **Fixed** — Resend email + generic webhook; up to 10 private recipients are editable/testable and take precedence over the env fallback | `server.js`, `js/editor.js`, `js/admin.js`, `README.md` |
| Admin plan 2: no password recovery | **Fixed** — private recovery email, non-enumerating request, expiring one-time token, password/session rotation, honest unavailable state | `server.js`, `admin.html`, `js/login.js`, `js/editor.js` |
| Admin plan 2: per-page search control incomplete | **Fixed for current static pages** — per-page metadata, social image and noindex are draft/publish controlled; noindex pages leave the sitemap | `server.js`, `js/editor.js` |
| Admin plan 2: no image management | **Fixed** — authored image slots, private upload/library, browser-built responsive variants, per-use alt/focal point, social-image picking and guarded deletion | `server.js`, `js/site-config.js`, `js/editor.js`, `css/editor.css` |
| Admin plan 2: hard-coded cases, articles, jobs, team and testimonials | **Fixed** — bilingual validated collections, in-place lifecycle controls, clean detail routes, item metadata/schema and sitemap integration | `js/data.js`, `js/partials.js`, `js/site-config.js`, `js/editor.js`, `server.js` |
| Admin plan 2: editor unusable on a phone | **Fixed** — 390 px bottom dock, complete More sheet, touch section/card/image actions, keyboard-aware Done toolbar and full-screen mobile panels/dialogs | `js/editor.js`, `css/editor.css`, `test/browser-smoke.js` |
| Admin plan 2: one account / no draft sharing | **Fixed** — automatic legacy migration, Admin/Editor roles, email invitations, per-user session invalidation, server-enforced capabilities, actor history, conflict-safe shared drafts and revocable seven-day noindex previews | `server.js`, `admin.html`, `js/login.js`, `js/editor.js`, `js/preview.js` |
| Deep audit: mobile contact/service overflow | **Fixed** — all inline fixed-grid declarations swept; contact and service layouts collapse cleanly | `contact.html`, `css/style.css` |
| Deep audit: mega-menu density/height | **Fixed** — admin-configurable link count (default 4), global All services link, viewport-bounded scroll | `js/partials.js`, `css/style.css`, `js/admin.js` |
| Deep audit: hidden focus in drawer/accordions | **Fixed** — closed content is invisible and inert; modal background is inert | `js/main.js`, `js/partials.js`, `css/style.css` |
| Deep audit: contrast and false destinations | **Fixed** — semantic on-light tokens; only real cards link; sub-services lead to relevant parent anchors | `css/style.css`, public templates |
| Deep audit: dead article figure/share actions | **Fixed** — real inline SVG funnels plus LinkedIn, X, and copy-link behavior | `article.html`, `js/main.js` |
| Deep audit: false response promise | **Fixed** — one-business-day message plus Resend visitor acknowledgement | `js/i18n-data.js`, `server.js` |
| Deep audit: proof publication risk | **Fixed** — *Show verified proof content* defaults off and requires owner approval | `js/site-config.js`, `js/admin.js`, `data/site.*` |
| Deep audit: schema opportunity | **Fixed** — Organization globally, guarded Article, and JobPosting only from a complete real record | `server.js`, `js/admin.js` |
| Deep audit: newsletter consent | **Fixed to current scope** — stores consent timestamp/source; welcome provides unsubscribe mailto; suppression belongs in the future sending platform | `server.js`, `README.md` |
| Deep audit: native admin confirmations | **Fixed** — owned accessible dialogs with cancel-first focus and focus return | `admin-advanced.html`, `js/admin.js`, `js/editor.js`, `css/admin.css`, `css/editor.css` |

Everything marked **Fixed** is covered by `npm test` where it is testable server-side; the current browser suite also checks 390 px, 1366×768, article actions, legal affordances, drawer/accordion state, the on-page editor, its panels, draft lifecycle and both admin entry points. The historical findings below preserve the original evidence; this resolution table is the current status.

---

## Executive verdict

The public site has a distinctive, polished visual direction and the custom admin is a strong start. Publishing, authentication, submissions, bilingual copy, design tokens, and the fixed service catalogue all work in the tested environment.

It is **not ready to be called a fully editable production website**. There are launch-blocking navigation and consent bugs, important mobile and accessibility failures, placeholder conversion content, incomplete SEO/localization, and large classes of hard-coded content that the admin cannot manage.

Recommended status: **hold production launch until the P0 items below are fixed**.

## Journey health

| # | Audited journey | Health | Evidence |
|---|---|---|---|
| 1 | Homepage hierarchy and primary CTA | Healthy | Strong first impression, clear message, good contrast and hierarchy. |
| 2 | Desktop services navigation | Broken | The 920 px mega-menu is positioned from the narrow Services item and starts 175 px outside the viewport. |
| 3 | Work/case discovery | At risk | Filters function, but the case visuals are abstract placeholders and some filters/tags are hard-coded. |
| 4 | Contact conversion | Broken | A 560 px-tall “scheduler embeds here” placeholder dominates the page; production contact details are still defaults. |
| 5 | Mobile navigation | Broken | The 390 px layout overflows to 397 px, the hamburger clips, and the cookie banner covers the open drawer. |
| 6 | Mobile team discovery | Broken | Names and roles remain at `opacity: 0`; cards have no focusable child, so touch/keyboard users only see initials. |
| 7 | Cookie preferences and analytics consent | Broken | The banner exists only on the homepage. The footer preferences link does nothing on the other 14 pages. |
| 8 | Admin sign-in and session protection | Mostly healthy | Password hashing, signed sessions, CSRF-style checks, rate limits, and private-file blocking work. Production hardening is incomplete. |
| 9 | Admin edit and publish | At risk | Existing structured fields save and publish, but preview is partial and simultaneous editors can overwrite each other. |
| 10 | “Full editing” coverage | Broken | No media manager, page builder, page CRUD, nav editor, or structured editors for team/cases/articles/jobs. |
| 11 | Submissions | Healthy with limits | Create, list, export, individual delete, and delete-all worked in the isolated copy. Retention/privacy controls are missing. |
| 12 | EN/AZ localization and SEO | At risk | Dictionaries are balanced, but Azerbaijani uses the same URL and there is no canonical, hreflang, social image, or Twitter metadata. |

## Visual evidence

### Public site

The desktop foundation is strong: typography, spacing, color, and calls to action feel deliberate.

![Homepage desktop](screenshots/01-home-desktop.png)

The services page is clear and well structured.

![Services desktop](screenshots/02-services-desktop.png)

The desktop mega-menu is visibly clipped on the left. Runtime measurement: `left = -175 px`, `width = 920 px` at a 1440 px viewport.

![Clipped desktop mega-menu](screenshots/21-desktop-mega-menu.png)

The contact page exposes an internal placeholder at its highest-value conversion point.

![Contact scheduler placeholder](screenshots/04-contact-desktop.png)

At 390 px, the header overflows and the menu control is clipped.

![Mobile homepage overflow](screenshots/05-home-mobile.png)

The cookie banner overlays the navigation drawer, and the Services control looks like an unstyled browser-default button.

![Mobile drawer and cookie conflict](screenshots/06-mobile-menu.png)

Team identity is hidden on mobile because the card depends on hover.

![Team information hidden on mobile](screenshots/20-mobile-team-hidden-info.png)

The Careers setting hides the desktop header button but not the mobile drawer link.

![Careers feature toggle mismatch](screenshots/19-careers-toggle-mobile-bug.png)

### Admin

The admin has a clean visual system and a useful launch overview.

![Admin overview](screenshots/09-admin-overview.png)

Design editing plus an embedded preview is the strongest part of the product.

![Admin design controls](screenshots/10-admin-design.png)

The bilingual copy editor is comprehensive but extremely dense and not programmatically labelled.

![Admin copy editor](screenshots/11-admin-copy.png)

The responsive admin remains usable, but the wrapped navigation consumes much of the first screen.

![Admin mobile layout](screenshots/18-admin-mobile.png)

## P0 — fix before production

### 1. Desktop mega-menu is off-screen

The menu is absolutely positioned from the Services `<li>` with `left: 50%` and `translateX(-50%)`. At 1440 px, 175 px of the menu is outside the viewport. The first service engine is inaccessible visually.

- Evidence: [CSS positioning](../css/style.css#L198), [menu markup](../js/partials.js#L46)
- Fix: position the panel relative to the header/container, or calculate a viewport-clamped horizontal offset. Verify at 1024, 1280, 1440, and 1920 px.

### 2. Consent UI works only on the homepage

`initCookieBanner()` exits when `#cookieBanner` is absent, but that element exists only in `index.html`. The shared footer still renders “Cookie Preferences” on every page. On `services.html`, the link was present and clicking it produced no banner.

- Evidence: [homepage-only banner](../index.html#L323), [early return](../js/main.js#L279), [shared footer link](../js/partials.js#L220)
- Impact: visitors cannot revisit consent on 14 pages, and consent-gated analytics does not initialize consistently across the site.
- Fix: render one shared consent component with the shared footer/header or have the script create it on every page.

### 3. Mobile header, drawer, and team experience fail

- At 390 px, `document.documentElement.scrollWidth` was 397 px; `.nav-actions` and `#hamburgerBtn` ended at 396.9 px.
- Opening the drawer leaves focus on `#hamburgerBtn`. The drawer has no dialog role, `aria-modal`, focus trap, inert background, or focus return behavior.
- The cookie banner uses `z-index: 120`, above the drawer, and covers navigation choices.
- Team names and roles are hover/focus-within only, but cards contain no focusable controls.
- Evidence: [drawer behavior](../js/main.js#L76), [drawer/cookie layers](../css/style.css#L235), [team hover treatment](../css/style.css#L438)

### 4. Replace placeholder launch content

The scheduler placeholder explicitly says the CRM decision is still pending. Team portraits, client logos, case-study artwork, article art, the mega-menu thumbnail, contact details, legal links, and several proof points are also placeholder/default content.

- Evidence: [scheduler placeholder](../contact.html#L36), [hard-coded team](../index.html#L261)
- Impact: the site looks polished but does not yet establish real-world credibility or provide a finished conversion path.

### 5. Define and implement actual “full editing” scope

The dashboard edits many fields, but it is not a full CMS. The current product promise should be narrowed or the missing models below should be added.

| Area | Editable now | Missing for full editing |
|---|---|---|
| Design | Tokens, fonts, motion flags, custom CSS | Reusable theme versions and safer CSS validation |
| Copy | 378 dictionary keys in EN and AZ | Hard-coded names, numbers, filter labels, table values, and code-only strings |
| Services | Fields/groups/items within five fixed engines | Add/delete/reorder engines; dynamic service-detail pages |
| Industries | Names and ordering | Unique slug, page, SEO, hero, body, cases, and CTA per industry |
| Pages | Title, description, visibility of 62 existing sections across 14 pages | Create/delete/reorder pages and blocks; slugs; 404 editing; templates |
| Marketing content | Some dictionary copy | Team, clients, stats, case studies, articles, jobs, testimonials, and related content as collections |
| Navigation | Feature switches | Header/footer menu structure, labels, ordering, destinations, CTA |
| Media | None | Upload/select/replace/crop images, alt text, file metadata |
| SEO | Title and description | Canonical, social images, Twitter cards, hreflang, indexing, structured data |
| Conversion | Contact text and settings | Scheduler/embed configuration and complete form routing/notifications |
| Workflow | One draft and Save & publish | Autosave recovery, preview of all content, revisions, rollback, roles, audit log, conflict handling |

Specific mismatches:

- The admin says Copy covers “every text string,” but team data, proof numbers, case metrics, and several filters/tags are in HTML/JS. See [the admin claim](../js/admin.js#L251).
- The live preview only reflects colors, fonts, hidden sections, and custom CSS. Copy/catalogue changes appear only after publishing and reloading. See [the preview limitation](../js/admin.js#L303).
- `siteName` changes footer copyright and the giant footer wordmark, while header, drawer, and small footer marks hard-code “OmniMark.” See [hard-coded marks](../js/partials.js#L133) and [settings-driven footer text](../js/partials.js#L216).
- `careersButton` controls only the desktop header; the drawer link is unconditional. See [desktop condition](../js/partials.js#L143) and [mobile link](../js/partials.js#L160).
- `formFallbackNote` exists in both schemas but has no admin field and no frontend consumer. See [admin defaults](../js/admin.js#L89) and [settings field list](../js/admin.js#L141).

## P1 — accessibility, SEO, and publishing safety

### Accessibility

Observed admin control labelling in the audited dataset:

| Admin section | Controls | Programmatically labelled | Unlabelled |
|---|---:|---:|---:|
| Design | 50 | 45 | 5 |
| Copy & translations | 759 | 1 | 758 |
| Services | 280 | 0 | 280 |
| Industries | 22 | 0 | 22 |
| Pages & SEO | 90 | 62 | 28 |
| Settings | 19 | 4 | 15 |
| Account | 4 | 1 | 3 |
| **Total** | **1,224** | **113** | **1,111** |

Visible text beside an input is not enough: use a wrapping `<label>` or matching `for`/`id`, and identify locale for each EN/AZ control.

Additional issues:

- Admin side-navigation buttons have `all: unset` and no focus style. Computed focus had no visible outline or shadow. See [admin side navigation CSS](../css/admin.css#L58).
- Submitting the empty contact form produced four visual errors, zero `aria-invalid` fields, zero `aria-describedby` associations, and left focus on the submit button. See [form validation](../js/main.js#L167).
- There is no skip link or `aria-current` on active public navigation.
- The services panel uses `role="menu"` without implementing menuitems or arrow-key behavior. Prefer ordinary disclosure navigation or implement the full pattern. See [mega-menu markup](../js/partials.js#L59).
- FAQ buttons update `aria-expanded`, but have no `aria-controls`; collapsed answers remain in the accessibility tree because they are only visually clipped. See [FAQ behavior](../js/main.js#L139).
- Filter buttons expose visual `.active` state but no `aria-pressed`, and result changes are not announced.

Positive accessibility foundations: public `:focus-visible` styling, reduced-motion handling, semantic headings, one `<main>`, and one `<h1>` per audited public page.

### SEO and localization

All 15 public pages had a title, description, `og:title`, `og:description`, one `<main>`, and one `<h1>`. Missing on all audited pages: canonical URL, `og:image`, Twitter metadata, and hreflang.

The EN/AZ dictionaries each contain 520 keys, but Azerbaijani is a client-side language state on the same URLs. Search engines and shared links do not get an independent AZ URL, server-rendered `lang="az"`, or AZ metadata.

`robots.txt` disallows `/data/`, while `/data/site.js` is required to render published admin overrides. A crawler honoring the rule may see stale defaults. See [robots.txt](../robots.txt#L5).

### Draft/publish safety

- The client sends the entire site document on save. Two open admin sessions can overwrite each other with last-write-wins behavior.
- Copy and catalogue changes cannot be fully previewed before publishing.
- There is no revision history, rollback, autosave recovery, or version/conflict token. Export is the only manual backup.
- `site.json` is written atomically; generated `site.js`, sitemap, and robots files are not, so a crash can leave a partial publish. See [server publishing](../server.js#L77).

## P2 — production hardening and maintainability

### Security and privacy

What is already good:

- scrypt password hashing and timing-safe comparison;
- signed 12-hour sessions with `HttpOnly` and `SameSite=Strict`;
- same-origin and custom-header checks on authenticated mutations;
- request size limits, validation/length caps, and login/submission rate limiting;
- direct access to private JSON data is blocked.

Gaps to close:

- Session cookies do not include `Secure`. Add it in HTTPS production.
- No Content Security Policy, HSTS, or Permissions Policy is emitted by the Node server. Add these at the app or trusted reverse proxy.
- The custom analytics snippet intentionally executes arbitrary admin JavaScript. Treat admin access as a code-execution privilege and document that boundary.
- Submissions are plaintext JSON with no retention schedule, encryption-at-rest strategy, or practical storage quota below 10,000 records.
- Rate limiting keys only on `req.socket.remoteAddress`. Behind the recommended reverse proxy, every visitor can share one proxy IP and exhaust the global allowance. Configure trusted proxy handling or rate-limit at the proxy. See [client IP logic](../server.js#L268).
- URL fields are not scheme-validated server-side; restrict public links to appropriate `https:`, `mailto:`, and `tel:` schemes.

### Maintainability and testing

- `npm run check` passes, but it only syntax-checks six JavaScript files. There are no unit, integration, accessibility, or repeatable browser tests.
- The framework-free site has a small footprint and zero runtime dependencies, which is a positive.
- Metadata, heads, and script tags are repeated across 15 public HTML files.
- `DEFAULT_SITE` and related behavior are duplicated between the server, admin, and runtime, creating schema drift risk.
- The server uses synchronous file reads in request paths. This is acceptable for very low traffic but should not be treated as scalable storage.
- Add regression tests for consent on every page, viewport overflow, both navigation modes, EN/AZ, form errors, feature switches, authenticated publish, submission lifecycle, and concurrent-update rejection.

## Recommended implementation order

1. Fix viewport-critical UI: desktop mega-menu, 320–390 px header overflow, drawer layering/focus, and always-visible mobile team identity.
2. Make consent global and verify analytics behavior on all 15 pages.
3. Replace launch placeholders and configure real contact, legal, scheduler, and media assets.
4. Decide the CMS contract. For genuine full editing, add structured collections, media, nav management, page/block CRUD, localized slugs/SEO, and dynamic templates.
5. Add draft/preview/revision/concurrency safety before multiple editors use the dashboard.
6. Complete programmatic labels, focus behavior, error announcements, disclosure semantics, and automated accessibility checks.
7. Add production headers, secure cookies, proxy-aware limiting, retention controls, atomic publishing, and real automated tests.

## Verification performed

- Loaded and visually inspected the principal public journeys and every admin section.
- Checked 26 local page/asset URLs with no unexpected HTTP failures.
- Verified `/data/admin.json` is blocked and unauthenticated admin API access returns 401.
- Verified login rejection/acceptance, session cookie behavior, same-origin/custom-header rejection, authenticated save/publish, SEO title output, valid/invalid form submission, submissions listing, and individual deletion in an isolated temporary copy.
- Verified all 34 inspected source/content files decode as UTF-8.
- Verified 520 EN and 520 AZ dictionary keys.
- Verified the Pages API exposes 14 editable pages and 62 section toggles; the 404 page is excluded.
- Ran `npm run check` successfully.

## Limits

- No production domain, analytics account, CRM/scheduler, email delivery service, or reverse-proxy configuration was supplied, so those integrations were assessed from code and placeholders rather than live services.
- No assistive-technology session was performed; accessibility findings are based on DOM, keyboard/focus behavior, CSS, and browser runtime inspection.
- The authenticated write tests ran only against a clean temporary copy. The original ignored admin data and all pre-existing working-tree changes were left untouched.
