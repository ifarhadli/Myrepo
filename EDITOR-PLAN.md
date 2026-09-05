# On-page editor — implementation plan

Status: implemented · extended by Admin plan 2 Phases A–C · Author: Claude · Executor: Codex
Branch: `claude/site-build-brief-jpmkd6` (continue on this branch, commit per phase)

## 0. Goal and non-goals

Replace the nine-tab form dashboard with an **edit-on-the-page** mode: the
owner logs in, lands on the real website with a thin editor bar, and edits by
clicking. Same server, same `data/site.json`, zero new dependencies.

**In scope**
- Click-to-edit every text string, in EN and AZ
- Hide/show, reorder (drag + keyboard) and accent-colour any section
- Reorder / add / remove cards and catalogue items in place
- Design palette: brand colours, curated font pairings, motion mode
- Draft autosave on the server, undo/redo, Publish with a change summary
- Inbox (submissions) and Settings as slide-in panels
- Phone-width preview toggle, page switcher
- Old dashboard kept for developers at `admin-advanced.html`

**Out of scope (do not build)**
- Free positioning / dragging of individual elements
- New block types, layout changes, rich page builder
- Image / media upload
- Multi-user, roles, revision history

## 1. Existing foundations to reuse (do not duplicate)

| Thing | Where | Use |
|---|---|---|
| Every text carries `data-i18n="ns.key"`; HTML strings carry `data-i18n-html` | all pages, `js/partials.js` | editable targets; key = storage key |
| Every section carries `data-section="page.sN"` / `page.hero`; proof sections carry `data-proof` | all pages | section toolbar, order, accent |
| Catalogue rendered from `window.OMNI_ENGINES` with keys `engines.eN.groups.G.items.I`; industries `industries.N` | `js/partials.js`, `js/data.js` | in-place catalogue editing maps to `site.engines` / `enginesAz` / `industries` / `industriesAz` |
| Runtime overrides: tokens, fonts, custom CSS, hidden sections, flags, i18n merge, engines swap | `js/site-config.js` (`OmniSite.applyDesign/applyData/flags/get`) | extend with `sectionOrder`, `sectionAccent`, `itemOrder`; the editor calls `applyDesign(draft)` for live repaint |
| Feature flags gate motion (`kineticHeadlines`, `reveal`, `marquee`, `countUp`, `customCursor`, `magneticButtons`) | `js/main.js` `on(flag)` | edit mode forces them off |
| Design token list, font catalogue, `DEFAULT_SITE`, `labelize()`, `api()` helper | `js/admin.js`, `js/site-config.js` (`fontCatalog`), `server.js` | copy the constants into `js/editor.js` **once**; do not import admin.js |
| Auth + CSRF: HttpOnly session cookie, `X-Requested-With: OmniAdmin`, Origin check; `validateSite()` | `server.js` | all editor writes go through the same guards |
| Tests | `test/server.test.js` (API), `test/browser-smoke.js` (Chrome via CDP) | extend both; keep green |

Files are CRLF on this checkout. Preserve line endings when editing.

## 2. Data model changes (`data/site.json`)

Add, all optional, all validated in `validateSite()`:

```jsonc
{
  "sectionOrder":  { "index": ["index.hero","index.s6","index.s1", "…"] },   // per page; unknown keys ignored, missing keys appended in DOM order
  "hiddenSections": ["index.s3"],                                              // exists
  "sectionAccent": { "index.s6": 3 },                                          // 1–5 → --c1…--c5, absent = design default
  "itemOrder":     { "index.cases": ["c2","c1","c3"], "work.cases": ["…"] },   // per data-list; ids from data-item
  "hiddenItems":   ["work.cases:c4"],                                          // removed cards (never delete markup)
  "design": { "…existing…", "fontPreset": "bricolage-inter", "motion": "on|calm|off" }
}
```

Rules
- `sectionOrder[page]`: array of section keys, max 60, strings ≤ 60 chars.
- `sectionAccent`: integer 1–5 only.
- `itemOrder` / `hiddenItems`: ids `[a-z0-9-]{1,40}`, list keys `[a-z0-9.-]{1,60}`.
- `motion`: `on` = all motion flags true; `calm` = kinetic/marquee/cursor/magnetic off, reveal/countUp on; `off` = all false. Setting `motion` **writes the individual flags** in `features` so `main.js` needs no change.
- `fontPreset` maps to `fontDisplay/fontBody/fontMono` (write all three; preset is just the label).

Curated font presets (Google Fonts, all already in `fontCatalog`):

| id | display | body | mono |
|---|---|---|---|
| `bricolage-inter` (default) | Bricolage Grotesque | Inter | JetBrains Mono |
| `sora-dmsans` | Sora | DM Sans | Fira Code |
| `syne-manrope` | Syne | Manrope | IBM Plex Mono |
| `playfair-worksans` | Playfair Display | Work Sans | Space Mono |

### Markup additions (one-off pass over the HTML)

- Every reorderable list gets `data-list="page.name"` on the container and `data-item="id"` on each child:
  `index.cases`, `work.cases`, `index.insights`, `insights.articles`, `index.team`, `about.team`, `careers.roles`, `industry.strip` (home industries strip if static), `home.testimonials`.
- Items already rendered by partials (catalogue, industries dropdown) are **not** `data-list`; they are edited via the catalogue model.

## 3. Server changes (`server.js`)

New private file `data/draft.json` (add to `PRIVATE_FILES` and `.gitignore`).

| Route | Auth | Behaviour |
|---|---|---|
| `GET /api/draft` | session | returns draft if present, else `{ draft: null, live: <site> }` |
| `PUT /api/draft` | session + CSRF | body validated with `validateSite()`; written atomically; returns `{ ok, savedAt }` |
| `DELETE /api/draft` | session + CSRF | discards draft |
| `POST /api/publish` | session + CSRF | reads draft → `saveSite()` (existing) → deletes draft → returns `{ ok, site, summary }` |
| `PATCH /api/submissions/:id` | session + CSRF | `{ read: true|false }` only |

`summary` = counts of changed keys by category vs the previously live site: `texts`, `sections`, `items`, `catalogue`, `design`, `settings`. Compute by diffing flattened objects; keep it simple.

HTML injection (existing `injectMeta`): when the request has a **valid session** and `?edit=1`, inject before `</body>`:
`<link rel="stylesheet" href="css/editor.css"><script src="js/editor.js" defer></script>`.
Never inject without a valid session, so anonymous visitors never download the editor.

`validateSite()` learns the new fields (§2). Everything else stays.

## 4. Client: `js/editor.js` + `css/editor.css`

Loaded only via server injection (§3). On load:
1. `GET /api/me` → if not authed, `location.replace('admin.html')`.
2. `GET /api/draft` → `state.draft = draft || clone(live)`, `state.live = live`.
3. Apply draft: `OmniSite.applyDesign(draft)`, then re-apply i18n overrides for the current language on every `[data-i18n]` (use `OmniI18n.applyI18n()` after merging draft.i18n into `OM_I18N` — write a small `mergeDraftDict()`; do not reload).
4. Add `html.omni-editing`. That class: disables kinetic/reveal/marquee/countUp/cursor/magnetic via CSS + a `main.js` early return (`if (document.documentElement.classList.contains('omni-editing')) return;` inside those init functions), shows all sections including hidden ones at 40 % opacity with a "hidden" badge, and shows `[data-proof]` sections regardless of the proof flag (with a badge).
5. Rewrite internal links to append `?edit=1`; block form submission; block link navigation while an element is being edited.

### 4.1 Bar (`.omni-bar`, fixed top, 48 px, `role="toolbar"`)

`● Edit mode` · **Page ▾** (14 pages, current highlighted) · **EN | AZ** (which language is being edited; switching calls `OmniI18n.setLang`) · **📱** phone preview (wraps `<main>`+header+footer in a 390 px centered frame via CSS class, no iframe) · **↶ ↷** · **Design** · **Inbox (n unread)** · **Settings** · **Discard** · **Publish (n)**.

- Keyboard: Ctrl/⌘+Z / Shift+Z undo/redo, Ctrl/⌘+S publish, Esc leaves the current text edit.
- `n` on Publish = number of changed keys in the draft vs live; 0 disables the button.
- All bar controls are real `<button>`s with labels; focus visible.

### 4.2 Text editing

- Hover any `[data-i18n]` → dashed outline. Click → `contenteditable="plaintext-only"` (fallback `contenteditable` + paste-as-text handler). Enter = commit (Shift+Enter = newline only where the original contained `<br>`), Esc = cancel.
- Keys with `data-i18n-html`: a 3-button mini-toolbar (Bold, Link, Clear formatting); sanitise on commit — allow only `b, strong, em, i, a[href], br`; strip everything else.
- Commit writes `draft.i18n[lang][key] = text`; if equal to the code default → delete the override (falls back). Empty → delete.
- Catalogue text (`engines.*`, `industries.*`) writes to `draft.engines` / `draft.enginesAz` / `draft.industries[Az]` instead (initialise from defaults on first touch, same as admin.js `ensureEngines()`).
- Never edit inside the editor bar/panels; never edit `.mark`.

### 4.3 Sections

Hover a `[data-section]` → toolbar at its top-right: `⋮⋮ drag` · `👁 hide/show` · `● accent` (cycles none→1→…→5) · `▲ ▼`.
- Drag: HTML5 drag-and-drop on the handle only; drop indicator line between sections; keyboard alternative = ▲ ▼. Hero cannot move below the first content section? — **allow all**, simpler; but keep `<header class="hero">` and `<main>` boundaries: order is applied only among siblings inside `<main>`, hero stays first. Document this.
- Apply order to DOM immediately; store in `draft.sectionOrder[page]`.
- `site-config.js` gains `applyLayout(cfg)`: reorders `[data-section]` siblings in `<main>` per `sectionOrder[page]`, sets `style.setProperty('--acc', 'var(--cN)')` for `sectionAccent`, reorders `[data-list]` children per `itemOrder`, hides `hiddenItems`. Called after `omni:partials-ready`.

### 4.4 Cards and catalogue items

- `[data-list] > [data-item]`: drag handle + `×` on hover; `+ add` only for catalogue lists (cards need real content — adding a blank card is out of scope; removing/reordering is in).
- Catalogue (`.eng-cols li`, mega-menu items follow automatically on publish): `×` removes item from both EN and AZ arrays; `+ add service` appends "New service"/"Yeni xidmət" and opens it for editing.
- Industries strip / dropdown: same via `draft.industries[Az]`.

### 4.5 Design panel (slide-in, left)

- **Colours:** chips for `--c1…--c5`, `--ink`, `--paper`, `--signal`. Click chip → native `<input type=color>` anchored to it + hex field + "reset". Live repaint via `applyDesign(draft)`.
- **Fonts:** 4 preset cards rendered in their own faces; click applies.
- **Motion:** segmented `On · Calm · Off`.
- **Advanced ›** link to `admin-advanced.html#design` (custom CSS, layout tokens).

### 4.6 Inbox panel (slide-in, right)

List newest first; unread bold; click expands fields; **Reply** = `mailto:` with visitor address + subject; **Mark read**; **Delete**; **Export CSV**. Uses existing `/api/submissions` + new `PATCH`.

### 4.7 Settings panel (slide-in, right)

Groups, each field labelled (`<label for>`):
- **Contact:** email, phone (display), phone (dial), address line 1/2, one-line address, local office email, LinkedIn
- **Site:** site name, public URL, default language, privacy URL, terms URL, social image URL
- **Tools:** scheduler URL, Google Analytics ID, tag snippet (textarea, marked "advanced")
- **Show verified proof** switch with the warning text from admin.js
- **Notifications:** read-only status from `/api/status` with the env-var hint
- Writes to `draft.settings` / `draft.features` / `draft.analytics`.

### 4.8 Draft, undo, publish

- Every mutation goes through `commit(patchFn, label)`: applies to `draft`, pushes inverse onto undo stack (max 100), re-renders the affected part, schedules `PUT /api/draft` (debounce 1.5 s; also on `visibilitychange`/`beforeunload` via `navigator.sendBeacon` fallback to sync XHR).
- Draft badge in bar: "Saved · 12:03" / "Saving…" / "Offline — changes kept locally" (keep a `localStorage` copy as a second net; reconcile on load if newer than server draft).
- **Publish:** modal with summary from the server ("4 texts · 1 section hidden · colours changed"), *Publish* / *Cancel*. On success: `state.live = site`, toast, counter → 0.
- **Discard:** confirm modal → `DELETE /api/draft` → reload.
- Modals: focus trapped, Esc closes, focus returns to trigger (reuse the pattern Codex added in admin.js).

## 5. Login and the old dashboard

- `admin.html` becomes **login only** (reuse existing login card). After login → `location.href = 'index.html?edit=1'`. If already authed on load → redirect immediately. Add a small "Advanced dashboard" link under the card.
- Current dashboard file → `admin-advanced.html` (update its `<title>` to "Advanced — OmniMark Admin", link back to "Open editor"). `robots.txt`/`writeSeoFiles` disallow both files. `test/browser-smoke.js` admin checks point at the new file.
- Add "Edit this page" to nothing public — the entry point is `/admin` only.

## 6. Tests (must be green before each commit)

`test/server.test.js` add:
- draft lifecycle: PUT (validated) → GET returns draft → publish → live updated, draft gone → GET returns `draft: null`
- publish summary counts
- draft endpoints 401 without session, 403 without header
- `validateSite` drops bad `sectionAccent` (0, 6, "x"), bad ids, oversize arrays
- editor assets injected only with session + `?edit=1` (anonymous `?edit=1` → no `editor.js` in HTML)
- `data/draft.json` not served (403)
- PATCH submission read flag

`test/browser-smoke.js` add (login first via the API, then load `/?edit=1`):
- bar renders; `html.omni-editing` present; kinetic spans absent
- click hero h1, type, Enter → draft PUT contains the key; reload → text persists; switch to AZ, edit, switch back → EN unchanged
- hide a section → badge shown in editor, and after publish the public page (no `?edit=1`) lacks it
- move section down via ▼ → DOM order changes; publish → public order changes
- accent cycle sets `--acc` on the section
- catalogue: remove one item → mega-menu item count decreases after publish
- design chip changes `--signal` live; font preset changes `--font-display`
- undo restores text; Publish counter matches; Discard clears
- phone preview toggles 390 px frame without horizontal overflow
- Inbox opens, marks read; Settings saves proof switch
- keyboard: Tab reaches every bar control; Esc cancels an edit; modals trap focus
- anonymous `/?edit=1` shows no bar

## 7. Docs

- `README.md`: replace the tab table with a short "Editing the site" section (bar, panels, publish, draft) + "Advanced dashboard" paragraph; update Layout list with `editor.js/css`, `admin-advanced.html`, `data/draft.json`.
- `UX-CONTRACT.md`: add the editor's interaction rules (what is/isn't editable, drag rules, publish/draft semantics).
- `audit/AUDIT.md` resolution table: mark "admin usability / no preview" as fixed with a pointer to this plan.

## 8. Phases and commits

| Phase | Deliverable | Commit message |
|---|---|---|
| 1 | Server: draft/publish/patch routes, validation, conditional injection, `data/draft.json` private; `site-config.applyLayout`; markup `data-list/data-item`; API tests | `feat(editor): draft/publish API and layout model` |
| 2 | `editor.js` core: bar, text editing EN/AZ, sections hide/reorder/accent, undo/redo, draft autosave, publish + summary modal; login redirect; browser tests for the above | `feat(editor): on-page text and section editing` |
| 3 | Cards + catalogue in place; Design panel (chips, presets, motion); phone preview; page switcher | `feat(editor): catalogue, cards and design palette` |
| 4 | Inbox + Settings panels; old dashboard → `admin-advanced.html`; docs; remaining tests; audit resolution | `feat(editor): inbox, settings and handover` |

Each phase: `npm test` and `npm run test:browser` green, no secrets staged, CRLF preserved.

## 9. Acceptance (owner's point of view)

1. I log in and I'm looking at my website with a bar on top. Nothing to learn.
2. I click any text and change it. I switch to AZ and change it there. I see it change immediately.
3. I hide a section, drag a section, and recolour a section without touching a form.
4. I remove a service from the catalogue and it disappears from the menu after Publish.
5. I pick a colour and a font pairing and the page repaints while I look at it.
6. I close the laptop mid-edit; tomorrow my changes are still there as a draft.
7. Publish tells me what will change before it goes live. Discard throws it away.
8. The inbox shows who wrote to us; Reply opens my mail app.
9. Nothing I can do in edit mode can break the layout on a phone.
