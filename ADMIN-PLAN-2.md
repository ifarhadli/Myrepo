# Admin plan 2 — the six things the owner will certainly need

Status: Phases A–D implemented · Phase E optional · Author: Claude · Executor: Codex
Branch: `claude/site-build-brief-jpmkd6` (continue; one commit per phase)
Prerequisite: `EDITOR-PLAN.md` is implemented (`023b115`) plus the history /
conflict-guard follow-up. Read `README.md`, `UX-CONTRACT.md` and
`EDITOR-PLAN.md §1` first — reuse what is there; do not build parallel systems.

Ground rules (unchanged): zero npm dependencies · Node 18+ · CRLF preserved on
existing files · every write behind session + `X-Requested-With: OmniAdmin` +
Origin check · everything the browser can read is public (`data/site.json`,
`data/site.js`) — **private data goes in `data/admin.json` or another
`PRIVATE_FILES` entry, never in `site.json`** · `npm test` and
`npm run test:browser` green before each commit · docs updated per phase.

## Scope

| # | Feature | Phase |
|---|---|---|
| 3 | Password recovery by email | A |
| 4 | Lead-notification recipients editable in the editor | A |
| 6 | Per-page SEO + share preview in the editor | A |
| 1 | Images: slots, upload, library, focal point, alt text | B |
| 2 | Collections: add/remove cases, articles, jobs, team, testimonials as real pages | C |
| 5 | Mobile edit mode | D |
| — | Second user with roles, shareable draft-preview link | E (optional, after D) |

Out of scope, still: free positioning of elements, new block types, per-field
history, built-in analytics, separate AZ URLs.

---

## Phase A — one day, no product decisions

### A1 · Password recovery (item 3)

Today a forgotten password means a developer deletes `data/admin.json`. Add a
magic-link reset that works when Resend is configured, and an honest message
when it is not.

**Storage (`data/admin.json`, private):** add `recoveryEmail` (string) and
`recovery: { hash, exp }` (sha256 of a one-time token, ISO expiry).

**Routes**

| Route | Auth | Behaviour |
|---|---|---|
| `POST /api/account/recovery-email` `{ current, email }` | session + CSRF | verifies current password, stores `recoveryEmail` |
| `POST /api/recover` `{}` | public, throttle **3 / 15 min per IP** | if `recoveryEmail` and Resend are configured: token = 32 random bytes, store sha256 + 30-min expiry, email `<base>/admin.html?reset=<token>`; **always** respond `200 { ok: true }` (no enumeration). `<base>` = `settings.siteUrl` if set, else scheme+Host of the request (scheme from `x-forwarded-proto`) |
| `POST /api/reset` `{ token, next }` | public, throttle 5 / 15 min | hash-compare token, check expiry, set new password (existing `hashPassword`), rotate `secret` (logs out all sessions), clear `recovery`; 400 on any failure with one generic message |
| `GET /api/status` | session | add `recovery: { emailSet, resendConfigured }` |

**UI**
- `admin.html`: "Forgot password?" under the form → explains what will happen → *Send reset link* → confirmation copy. With `?reset=<token>` in the URL: new-password form (min 8, repeat), then redirect to sign-in. If `/api/status`-equivalent public info says recovery isn't possible, show: "Password recovery isn't set up. Whoever runs the server can delete `data/admin.json` and restart to generate a new password." (Expose that boolean via a public `GET /api/recover` → `{ available: bool }`.)
- Editor → Settings → **Account** group: current password + recovery email + *Save*; change-password moves here from the advanced dashboard (keep it there too).

**Tests (server):** recovery-email set requires correct password; `/api/recover` returns 200 whether or not an email is configured and sends exactly one mail via the existing Resend capture in `test/server.test.js` when configured; reset with wrong/expired/reused token → 400; reset with valid token changes the password, old sessions are invalid, token single-use; throttle returns 429.

### A2 · Notification recipients (item 4)

Recipient addresses are not secrets, but `site.json` is public, so they still
must not go there.

- `data/admin.json` gains `notifyEmails: string[]` (≤ 10, validated).
- `notify()` recipients = `admin.notifyEmails` when non-empty, else env `NOTIFY_EMAIL_TO`. `notifyConfig()` reports `emailSource: 'settings' | 'env' | 'none'`.
- Routes: `GET /api/account/notifications` → `{ emails, source, resendConfigured, webhookConfigured }`; `PUT /api/account/notifications` `{ emails }` (session + CSRF); `POST /api/notify/test` (session + CSRF, throttle 3 / 10 min) sends a sample lead to the current recipients and returns delivery result.
- Editor → Settings → **Lead notifications**: chips input for addresses (add/remove, inline validation), source badge, *Send a test email* button with result toast, webhook status read-only with the env-var hint. The Overview warning in the advanced dashboard reads the same source.

**Tests:** PUT validates/caps; notify uses settings list over env; test-send is throttled and uses the capture.

### A3 · Per-page SEO and share preview (item 6)

- New bar button **This page** (icon: tag) → right panel with: browser/search title, meta description (with character counters 60 / 160), social image (URL field now; media picker in Phase B), **Hide from search engines** toggle, and two live previews: a Google result snippet and a LinkedIn/WhatsApp share card (image, title, description, domain).
- Writes `draft.pages[pageKey]` (existing shape) plus new `noindex: boolean` and `ogImage: string`. Server: `injectMeta()` emits `<meta name="robots" content="noindex,nofollow">` and per-page `og:image` when set; `listPages()`/sitemap skip `noindex` pages; `validateSite()` accepts the two new fields.
- Falls back to the page's authored title/description in the inputs' placeholders.

**Tests:** server injects robots/og:image per page; sitemap excludes noindex pages; browser: panel opens, counters update, preview text mirrors input, draft carries `pages[key]`.

**Commit A:** `feat(admin): password recovery, notification recipients, per-page SEO`

---

## Phase B — images (item 1) · 2–3 days

Principle: images live in **slots the design already defines**. The owner
clicks a slot and fills it; the slot decides size and crop. No free placement.
"Positioning" = a **focal point**, one click on the image, honoured by every
crop at every breakpoint.

### B1 · Storage and serving

- Directory `data/media/` (git-ignored; add `media` to the private-path check like `history`). Index `data/media.json` (private) — `{ id, name, alt, width, height, bytes, type, variants: [480, 960, 1600], focal: { x: 0.5, y: 0.5 }, uploadedAt }`. `id` = 16 hex chars.
- Files: `data/media/<id>.<ext>` (original, ≤ 8 MB) and `data/media/<id>-<w>.webp` for each variant. Public URL `/media/<id>-<w>.webp` and `/media/<id>.<ext>`; a new static branch that resolves **only** from the id regex — never from the path — sets the stored content type, `Cache-Control: public, max-age=31536000, immutable`, and 404 otherwise.
- **Zero-dependency resizing:** the browser makes the variants. The editor draws the picked file onto a `<canvas>` at 480/960/1600 px wide (never upscaling), exports WebP at quality 0.82 (JPEG fallback if `toBlob('image/webp')` is unsupported), and uploads original + variants. The server validates magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`), rejects anything else (SVG included — no sanitiser, so no SVG in v1), caps original 8 MB / variant 2 MB, library 500 files / 500 MB total.
- Routes (all session + CSRF unless stated): `GET /api/media` (list, newest first); `POST /api/media?name=…` raw body → `{ id }`; `POST /api/media/:id/variant?w=480|960|1600` raw body; `PATCH /api/media/:id` `{ alt, name, focal }`; `DELETE /api/media/:id` → 409 if any slot references it. Upload throttle 60 / 10 min per IP. Body limit for these routes only: 8 MB (`MAX_BODY` stays 2 MB elsewhere).

### B2 · Slots

- Markup: `data-image="<slotKey>"` on an `<img>` (or on a container that gets a background). Slot keys and where:
  `index.hero` (hero visual; replaces the SVG when set) · `index.cases.c1…c4` · `work.cases.c1…c4` · `case-study.cover` · `article.figure` · `index.team.t1…t5`, `about.team.t1…t6` · `index.logos.l1…l8` (client strip; logos render `object-fit: contain` on a neutral chip) · `mega.featured` (the mega-menu thumbnail).
- `site.images = { "<slotKey>": { id, alt?, focal? } }` (alt/focal override the library defaults per use). `validateSite()`: key pattern `[a-z0-9.-]{1,60}`, id 16 hex.
- `site-config.js` gains `applyImages(cfg)`: for each slot, set `src` (960), `srcset` (480/960/1600 + `sizes` from a `data-sizes` attr, default `(max-width: 760px) 100vw, 50vw`), `alt`, `loading="lazy"` (except `index.hero`: eager + `fetchpriority="high"`), `style.objectPosition` from focal. Empty slot → existing placeholder stays (initials, gradient, SVG). Run after `omni:partials-ready`.
- Server: `injectMeta()` uses the page's `ogImage` (A3) or `settings.ogImage`; both may now be a media id — resolve to the 1600 variant URL.

### B3 · Editor

- Hover a slot → overlay "📷 Change" (empty: "＋ Add image"); drop a file on the slot uploads straight into it. Click → **Media panel** (left): drop zone / *Upload* button (multiple), grid of thumbnails (480 variant), search by name, select → "Use here". Selected item shows: name, alt (required before publish — the pre-publish summary lists slots with missing alt), **focal point** (click on the image; crosshair; live preview in the slot), *Remove from slot*, *Delete from library* (blocked if used, says where).
- Upload progress per file; failures explained (type, size, quota).
- Undo covers slot changes (commit pattern). Publish summary gains `images`.
- Settings → Site → social image becomes a media pick (URL still allowed).

### B4 · Tests

Server: magic-byte rejection (rename a text file to .png), size caps, path traversal on `/media/../`, id regex, delete-in-use 409, variant upload requires existing id, quota. Browser: upload a generated PNG (draw on canvas in the test page), fill `index.cases.c1`, set focal, publish → public page has `<img srcset>` and `object-position`; empty slot keeps placeholder; missing alt is flagged before publish; 390 px still no overflow with images.

**Commit B:** `feat(media): image slots, library, focal point`

---

## Phase C — collections (item 2) · 3–4 days

Turns the single templates into real item pages the owner can add from the
site itself. Replaces the "coming soon" placeholders.

### C1 · Model

`site.collections = { cases: [...], articles: [...], jobs: [...], team: [...], testimonials: [...] }`, each item:

```jsonc
{ "id": "a1b2c3d4e5f6a7b8", "slug": "nordline-pipeline", "published": true, "order": 0,
  "createdAt": "…", "updatedAt": "…",
  "image": { "id": "…", "alt": "…", "focal": {"x":0.5,"y":0.5} },   // optional
  "fields": { "title": {"en":"…","az":"…"}, "summary": {"en":"…","az":"…"}, "body": {"en":"<p>…</p>","az":"…"}, "…": … } }
```

Per-type field sets (all bilingual unless noted): **cases** title, sector (industry key, not bilingual), summary, metrics (list of `{ value, label{en,az} }` ≤ 4), body, client (plain), year (plain) · **articles** title, dek, body, author (plain), date (ISO), readingMinutes (number) · **jobs** title, location (plain), remote (bool), type (full-time/part-time/contract), summary, body, applyUrl (https), validThrough (ISO) · **team** name (plain), role, bio (short), linkedin (https) · **testimonials** quote, name (plain), role, company (plain).

Defaults: move today's single case study, article, role and the team/testimonial copy into `js/data.js` as `window.OMNI_COLLECTIONS` so the site renders identically with an empty `site.collections`. Same "untouched = inherit" rule as the catalogue.

Validation: ids 16 hex; slugs `[a-z0-9-]{2,60}` unique per type; body HTML through a **server-side** allow-list sanitiser (`p h2 h3 ul ol li blockquote b strong em i a[href] br`) — collections are the first place rich text is authored at scale, so the server must sanitise here regardless of the admin-trust argument; caps: 100 items per type, body ≤ 50 KB.

### C2 · Routing and templates

- Clean URLs: `/work/<slug>`, `/insights/<slug>`, `/careers/<slug>` (server); static fallback `case-study.html?item=<slug>` etc. Unknown slug → 404 page. Sitemap lists published items; `injectMeta()` uses the item's title/summary/image for `<title>`, description, og:*, canonical; Article/JobPosting JSON-LD generated **from the item** (replaces the settings-level article/job fields; keep those only as legacy fallback when no items exist).
- Templates `case-study.html`, `article.html`, `role-detail.html`: mark fields with `data-field="title"` etc.; `site-config.js` `applyItem()` resolves the item (from `?item=` or the injected `window.OMNI_ITEM` the server adds) and fills fields for the current language; bilingual switch re-fills. Item image → the `case-study.cover` / `article.figure` slot.
- Listing mounts, rendered by `partials.js` like the accordions: `<div data-collection="cases" data-limit="4">` on `index.html`, `work.html` (with the existing sector filter now driven by items), `insights.html`, `careers.html`, `about.html` (team), `index.html` (team teaser, testimonials). Unpublished items render only in edit mode, badged "Draft". Remove the hard-coded cards and the "coming soon" copy; keep the empty-state copy for a type with zero published items.

### C3 · Editor

- Listing hover → "＋ New case / article / job / team member / testimonial" → creates an item with placeholder text ("Untitled case"), slug from EN title, opens `/work/<slug>?edit=1`.
- Item page: every `data-field` is click-to-edit (plain or rich per field); rich fields get the mini-toolbar plus Paragraph / Heading / List / Quote; metrics editable as a small list. Item toolbar (top of page): Published/Draft toggle, *Delete* (confirm; hard delete but History keeps the last 10 publishes), *Duplicate*, sector/date/type pickers as small selects, **This page** panel shows the slug (editable, uniqueness checked live) and SEO.
- Listing: drag to reorder (existing `data-list` pattern), Unpublish/Delete from the card toolbar.
- All through `commit()`; publish summary gains `items` per type.

### C4 · Tests

Server: validation (slug uniqueness, sanitiser strips `<script>` and `onclick`, caps), routing 200/404, sitemap, JSON-LD from item, static `?item=` fallback, unpublished item not served publicly but visible with session + `?edit=1`. Browser: create a case from the listing, edit title EN/AZ, add a metric, set image, publish → `/work/<slug>` renders, listing shows the card in the chosen order, unpublishing removes it from the public listing.

**Commit C:** `feat(collections): cases, articles, jobs, team and testimonials as editable pages`

---

## Phase D — mobile edit mode (item 5) · 1 day

- ≤ 700 px: the bar becomes a bottom sheet: row 1 = *Undo*, *Publish (n)*, *More ⋯*; *More* opens a sheet with Page, EN/AZ, Design, This page, Media, History, Inbox, Settings, Discard. Phone-preview button hidden (already on a phone).
- Panels and dialogs open full-screen with a sticky close button; inputs ≥ 16 px font (no iOS zoom).
- Sections: no hover on touch → a small "⋯" badge at each section's corner; tap → sheet with Hide, Accent, Move up, Move down (no drag on touch). Cards likewise. Image slots show the "📷" badge permanently on touch.
- Text editing: tap to edit; mini-toolbar docks above the keyboard (`visualViewport` resize handling); Done button commits.
- Browser tests at 390 × 844 in edit mode: bar fits with no horizontal overflow, edit a text, hide a section via the sheet, change a colour, publish. Keep the desktop suite unchanged.

**Commit D:** `feat(editor): mobile edit mode`

---

## Phase E — optional, after D

**E1 · Second user with roles (2 days).** `data/admin.json` → `users: [{ id, email, name, role: 'admin'|'editor', hash, salt, totp? }]`; session carries `uid` + `role`; `editor` can edit and publish content, not Settings/Account/Media delete/Users; `admin` everything. Invite by email (Resend) with a set-password link (reuse the reset flow). Optional TOTP 2FA (zero-dep HMAC-SHA1, QR as inline SVG). History entries record `by`. Existing single-password install migrates to one admin user on first boot.

**E2 · Shareable draft preview (½ day).** `POST /api/preview-link` → signed token (HMAC, 7-day expiry, revocable); `/?preview=<token>` serves the page with the **draft** injected as `OMNI_SITE` and a "Preview — not live" ribbon, no editor, no session needed. Never lists private data.

---

## Docs per phase

`README.md` (features, env/private storage, media notes, collections), `UX-CONTRACT.md` (slots, focal point, collections rules, mobile sheets), `EDITOR-PLAN.md` status line, `audit/AUDIT.md` resolution table (media / collections / mobile rows).

## Acceptance — owner's point of view

1. I forgot my password; I click "Forgot password?", get an email, set a new one. Nobody had to touch the server.
2. I add my colleague's address in Settings and she gets the next lead. I press "Send a test" and it arrives.
3. I open "This page", fix the title and description, and see what the LinkedIn card will look like before I publish.
4. I click the empty photo on a case card, drop in a picture, click on the face so it stays centred, write the alt text, publish. It looks right on my phone.
5. I click "＋ New case", type the title in EN and AZ, paste the story, add two numbers and a photo, publish — and it has its own link I can send to the client.
6. On my phone I fix a typo, hide a section and publish, without pinching or scrolling sideways.
7. Nothing I upload or write can break the layout or the site's security; unpublished work is invisible to visitors.
