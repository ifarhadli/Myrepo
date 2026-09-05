# OmniMark live feature audit — 2026-09-05

## Verdict

The application code is broadly healthy and the implemented feature set works in a clean production-like environment. The release is **not ready to launch under the current live configuration**. The blockers are the configured domain, missing delivery/recovery configuration, and placeholder or fallback public content—not a systemic failure of the editor, server, or responsive website.

Target: WCAG 2.2 AA for the public website and admin/editor interfaces.

## Evidence and test result

- `npm run check`: passed for the server, all client scripts, and both test harnesses.
- Clean disposable copy: **189/189 server/API checks passed**.
- Clean disposable copy: **97/97 real-Chromium browser checks passed**.
- Live local crawl: **15/15 HTML pages** and **17/17 internal resources** returned successfully.
- Premium UI strict static audit: **0 errors, 0 warnings, 0 violations**.
- EN/AZ dictionaries: **467/467 keys**, with no missing keys in either language.
- Key text contrast pairs measured between **5.37:1 and 17.33:1**, passing WCAG AA for normal text.
- The repository's own tests exercise auth, password recovery, notifications, forms, drafts, publish/history/conflict handling, permissions, preview links, media validation and upload, collections and clean routes, SEO metadata, structured data, responsive layouts, keyboard/focus behavior, and mobile editing.

The current real draft was not changed or discarded during this audit.

## Launch blockers — P0

### 1. The configured production domain is not this website

`settings.siteUrl` is `https://www.omnimark.com`. That address currently redirects to Stilo's unrelated OmniMark Developer Resources product. Canonicals, Open Graph URLs, sitemap URLs, reset links, invitations, and shareable draft-preview links would therefore point at the wrong property.

Recommendation: choose and verify the agency's owned production domain, update **Settings → Public URL**, then regenerate/check `sitemap.xml`, `robots.txt`, canonical tags, recovery links, invitations, and preview links. Also have the owner confirm the naming/domain position before launch.

### 2. Leads are stored, but nobody is notified

The contact form and submission inbox work, but the current notification status is:

- Resend: not configured
- notification recipients: none
- webhook: not configured

The visitor can successfully submit while the agency receives no immediate notification. Password recovery and email invitations are also unavailable.

Recommendation: configure `RESEND_API_KEY`, set a verified sender, add at least one lead recipient in Settings, send a test message, and configure the recovery email. A webhook is optional but useful as a second delivery path.

### 3. Public identity, legal, imagery, and proof content are still placeholders

Current public settings include `hello@omnimark.com`, `austin@omnimark.com`, a `555` telephone number, an Austin placeholder address, and a generic LinkedIn homepage. Privacy and terms URLs are empty. No owner media has been assigned. `site.collections` is empty, so the public case, article, job, team, and testimonials are supplied by fallback/demo data.

The verified-proof switch is correctly off, which prevents some unverified proof from shipping. It does not make the fallback case/article/job suitable as final client content.

Recommendation: replace every identity field, add approved legal pages, upload real imagery with alt text, and either replace or unpublish every demo collection item before launch.

### 4. There is an unpublished live draft

The editor has a saved draft at revision 7, last saved by `Site owner`. This is not a defect, but it means the editor view and public view can differ.

Recommendation: review the change summary and deliberately publish or discard it before the release freeze.

## Product defects — P1

### 5. The desktop editor bar horizontally scrolls at 1366 px

At a normal laptop width, the fixed editor toolbar is wider than the viewport and exposes a horizontal scrollbar. The mobile layout is strong, but the desktop-to-mobile interval is not sufficiently adaptive because the compact bar only replaces it below 700 px.

Recommendation: introduce a compact/overflow menu at a larger breakpoint (roughly 1100–1250 px), preserve the primary actions, and eliminate visible horizontal scrolling from the toolbar.

![Desktop editor showing toolbar overflow](screenshots/06-editor-home.png)

### 6. The test harness inherits a real draft and becomes state-dependent

Both test harnesses recursively copy the repository into a temporary directory. They remove admin, submissions, and media state, but not `data/draft.json` or history. With a legitimate owner draft present, `npm test` fails at the first draft write with `409 draft-exists`; dependent assertions then fail. In a clean disposable copy the complete suites pass 189/189 and 97/97.

Recommendation: explicitly remove private volatile state—at least `draft.json`, history, preview state, and any future runtime-only files—from both temporary fixtures. Add a regression test that starts while the source repository contains a draft.

### 7. One advanced-dashboard conflict still uses native `confirm()`

`js/admin.js` uses the browser's native confirmation dialog when saving over an unpublished on-page draft. This contradicts the project's owned-dialog interaction contract, is inconsistent with the rest of the admin UI, and gives less control over focus and accessibility.

Recommendation: replace that branch with the existing accessible modal pattern and add a browser check for the exact stale-draft path.

## Improvements — P2

- Add a real social-share image. SEO fields and previews work, but the default social asset is empty.
- Decide whether analytics is part of launch. The consent flow works; analytics itself is not configured.
- Configure the scheduler only if the agency can reliably service booked meetings; its hidden-empty behavior is correct.
- Reduce mega-menu cognitive load. It fits within a 1366×768 viewport and is keyboard-operable, but five dense columns of small, wrapping labels still feel heavy.
- Make the publish summary more compact on mobile; it works, but seven stacked category blocks make a routine action feel long.
- Replace the developer-oriented recovery fallback copy (“delete `data/admin.json`”) with owner-facing escalation language while retaining the accurate recovery path in technical documentation.
- Separate AZ URLs and add `hreflang` only if Azerbaijani organic search is a business goal. The current language switch is complete for users, but it is not a multilingual SEO architecture.

## Feature-by-feature journey audit

| # | Journey | Health | Evidence |
|---|---|---|---|
| 1 | Public homepage and responsive shell | Healthy | Desktop/mobile layouts render, internal resources load, no tested public overflow. |
| 2 | Desktop mega-menu and mobile navigation | Healthy with density opportunity | Menu stays on-screen; mobile drawer fills the viewport and maintains accessible interaction. |
| 3 | Contact/newsletter forms | Working with launch blocker | Validation, storage, consent timestamp/source, errors, and inbox work; delivery notification is unconfigured. |
| 4 | Login, logout, sessions, recovery | Partially configured | Auth/session security passes; recovery feature passes in isolation but is unavailable in the live configuration. |
| 5 | On-page EN/AZ text editing | Healthy | Editing, language isolation, undo/redo, persistence, and publish passed in Chromium. |
| 6 | Draft, publish, history, conflicts | Healthy product; broken local fixture | Runtime conflict protection works; test harness is contaminated by an existing real draft. |
| 7 | Section/card hide, reorder, accent | Healthy | Desktop and touch controls passed; hidden content remains visible and badged only in edit mode. |
| 8 | SEO panel, metadata, sitemap, structured data | Working with launch blocker | Previews and injection work; wrong production URL and missing social image invalidate launch output. |
| 9 | Media library, upload, focal point, alt text | Healthy but unused live | Type/magic-byte/quota/path checks and visual slot behavior pass; current site has no assigned owner media. |
| 10 | Collections and clean item URLs | Healthy but demo-backed live | CRUD, bilingual item fields, routing, sitemap, sanitization, JSON-LD, and publishing pass. Live content still falls back to samples. |
| 11 | Inbox, read state, reply/export/delete | Healthy | Covered by API/browser tests; delivery alert configuration remains missing. |
| 12 | Settings and notification recipients | Healthy UI; incomplete config | Inputs, proof gating, recipients, test send, and status indicators work. |
| 13 | Mobile editor | Healthy | Bottom bar, More sheet, text editing, section actions, design changes, and publish fit at 390×844. |
| 14 | Users, roles, invitations, preview links | Healthy feature; email dependency absent | Permission boundaries, last-admin guard, invite/reset lifecycle, expiring/revocable preview links, noindex/no-store behavior pass. |
| 15 | Advanced dashboard | Mostly healthy | Full controls remain available; stale-draft override has one native-dialog regression. |

## Representative accepted screenshots

### Public site

![Live desktop homepage](screenshots/14-live-home-desktop.png)

![Mobile homepage](screenshots/01-home-mobile.png)

![Desktop mega-menu](screenshots/02-mega-menu-laptop.png)

![Mobile navigation drawer](screenshots/11-mobile-menu.png)

### Admin and editor

![Live admin login](screenshots/15-live-admin-login.png)

![Per-page SEO editor and share preview](screenshots/07-page-seo.png)

![Media library and focal-point controls](screenshots/08-media-library.png)

![Mobile editor section actions](screenshots/10-mobile-editor.png)

![Mobile publish summary](screenshots/12-mobile-publish.png)

### Collection flow

The following is from the isolated browser suite and demonstrates the collection route/template flow. Its “Untitled case” text is deliberate test content, not approved launch content.

![Isolated collection page flow](screenshots/09-collection-page.png)

## Strengths worth preserving

- The public design has a distinctive agency identity, strong hierarchy, and a memorable service-engine visual rather than a generic template feel.
- Proof gating defaults to off, which is the right honesty and compliance safeguard.
- The editor keeps content changes, design changes, inbox work, SEO, media, and settings in one consistent interaction model.
- Draft persistence, undo/redo, change summaries, version history, conflict guards, roles, and revocable previews provide unusually strong operational safety for a zero-dependency CMS.
- Responsive public navigation and the dedicated mobile editor are substantially better than simply shrinking the desktop interface.
- Server-side validation, HTML sanitization, private-path enforcement, same-origin write guards, throttling, `X-Frame-Options`, `nosniff`, referrer policy, and permissions policy form a solid baseline.

## Evidence limits

- Browser interaction used the repository's installed-Chromium/CDP harness because the in-app browser-control runtime was not exposed in this session.
- Resend, webhook, and real mail delivery could not be verified against production credentials because they are not configured. Their behavior was verified with the project's capture server.
- No destructive action was performed against the live draft, submissions, media, users, or settings.
- HTTPS-only behavior such as HSTS and `Secure` cookies must be checked again on the final deployed host. Local HTTP correctly cannot prove those controls.
- Two raw automated captures were rejected from evidence: one caught a kinetic headline mid-animation; one used an unreliable CLI mobile viewport crop.

## Recommended release order

1. Replace the production domain and confirm brand/domain ownership.
2. Configure Resend, lead recipients, recovery email, and a tested sender domain.
3. Replace all contact, legal, media, and fallback/demo content.
4. Review and resolve the existing draft.
5. Fix the desktop editor toolbar overflow and state-dependent test fixtures.
6. Replace the remaining native confirm dialog.
7. Run both full suites on the exact deployment artifact, then perform an HTTPS smoke pass on the final domain.
