# Add and place — add elements, link buttons, move anything to a slot

Status: approved for implementation · Author: Claude · Executor: Codex
Branch: `claude/site-build-brief-jpmkd6` — two commits (Phase A, Phase B); push to `master` after review
Prerequisites: `ELEMENT-REMOVAL-PLAN.md` is implemented (`35e45b9`). This plan is its
mirror image and must reuse its machinery: `hideTargetFor`, `elementRemovalInfo`,
the `<scope>:<key>` addressing, `data-hide-key`, the selection model, the
`beginDrag/endDrag` + `html.omni-dragging` pattern, `commit()`, the publish
summary, History, `js/admin-fields.js`. Do not build a parallel system.

Ground rules (unchanged): zero npm dependencies · CRLF preserved · every write
behind session + `X-Requested-With: OmniAdmin` + Origin check · `npm test` and
`npm run test:browser` green before each commit · docs updated per phase.

## 0. What the owner gets

Today he can edit and remove what the designer placed. After this:

1. **Add** — one click duplicates any element, or inserts a paragraph, bullet
   or button under any text. New things are copies of designed things, so
   they always fit.
2. **Link** — any button or link can be pointed at a page, a section, a case,
   an article, a job, a URL, an email or a phone number.
3. **Style** — a button can be Primary, Secondary or a plain text link.
4. **Move** — drag any element to any slot on the page; drop zones light up.
   On phones: long-press → "Move to…".

Principle, unchanged: **never a blank canvas, never pixel positioning.** Every
addition is a designed component; every drop lands in a place the design has
room for. That is what keeps his phone layout intact without him checking.

## 1. Data model (`data/site.json`) — all optional, all validated

```jsonc
"addedElements": [
  { "id": "ae-3f9a1c7d", "scope": "index", "kind": "button",
    "cloneOf": "home.hero.ctaSecondary",              // optional: copy this element's markup
    "anchor": "index:home.hero.lede", "position": "after" }   // after | before | into
],
"elementLinks":  { "index:home.hero.ctaSecondary": "contact.html#teardown",
                   "index:added.ae-3f9a1c7d": "mailto:hello@omnimark.az" },
"elementStyles": { "index:added.ae-3f9a1c7d": "secondary" },      // primary | secondary | text
"placements":    [ { "key": "index:home.hero.micro", "anchor": "index:home.hero.h1", "position": "before" } ]
```

- Added elements get keys `added.<id>`; their text lives in the normal
  dictionary overrides, `i18n.en["added.<id>"]` and `i18n.az["added.<id>"]`,
  so EN/AZ editing, Remove, History and Publish need nothing new. Empty text
  renders the placeholder "New text" / "Yeni mətn" (dictionary keys
  `editor.newText`, added to `js/i18n-data.js`).
- `kind` ∈ `paragraph | bullet | button | stat | faq | step | card | copy`.
  `copy` = duplicate of `cloneOf` (any removable element); the other kinds use
  the templates in §2.
- `position`: `after`/`before` an anchor's hide target, or `into` a container
  (append). Anchors may be other added elements (`<scope>:added.<id>`).
- `placements` move **existing** elements; `addedElements` carry their own
  anchor. Both are applied in array order, so the last entry wins.
- Validation (`validateSite()`): each list ≤ 400; ids `ae-[0-9a-f]{8}`; keys
  and anchors match `^(\*|[a-z0-9-]{1,40}):[a-zA-Z0-9._-]{1,120}$`; `kind` and
  `position` and style from the fixed sets; links pass the same scheme check
  as settings URLs (`https?:`, `mailto:`, `tel:`, relative `*.html[#…]`,
  `/work/<slug>`-style item routes, `#section`) — anything else is dropped,
  never rewritten. De-duplicate placements by `key` (keep last).

## 2. Runtime (`js/site-config.js`)

`applyAdditions(cfg)` runs after `omni:partials-ready` and after any partial
re-render, **in this order**: added elements → placements → links → styles →
hidden elements (existing). Everything keys off `hideTargetFor`.

**Templates** — one function `elementTemplate(kind, scope, id)` returns
markup using only classes that already exist in `css/style.css`:

| kind | markup | allowed containers |
|---|---|---|
| paragraph | `<p data-i18n="added.<id>">` | between blocks in any section body |
| bullet | `<li data-i18n="added.<id>">` | any `ul`/`ol` that is content (catalogue accordion `ul`, article lists, `.eng-cols ul`) |
| button | `<a class="btn btn-primary" href="#" data-i18n="added.<id>">` | a `.btn-row`; or between blocks — then it is wrapped in a new `<div class="btn-row">` |
| stat | `<div class="stat"><div class="stat-fig" data-hide-key="added.<id>.fig">0</div><div class="stat-lab" data-i18n="added.<id>"></div></div>` | `.stat-row` |
| faq | the existing `.faq-item` markup with `added.<id>.q` / `added.<id>.a` keys | `.faq-list` |
| step | the existing `.pstep` markup with `added.<id>.t` / `added.<id>.d` | `.process-track` |
| card | `.card` with `added.<id>.t` (tag) and `added.<id>` (body) | `.grid-2`, `.grid-3`, `.claim-cards` |
| copy | `cloneNode(true)` of `cloneOf`'s hide target, then **sanitised**: strip `id`, `data-image`, `data-item`, `data-collection-*`, `[hidden]` images, nested `data-i18n` keys re-keyed to `added.<id>.<n>` in DOM order, `data-hide-key` re-keyed the same way | wherever `cloneOf` is allowed |

Text of every re-keyed node is copied into the draft's EN and AZ overrides at
creation time (editor side), so a copy starts with the original words, not
placeholders.

**Compatibility** is one table, `ALLOWED_DROPS`, exported for the editor: for a
given element kind (derived from the hide target: `.btn`→button, `li`→bullet,
`.stat`→stat, `.faq-item`→faq, `.pstep`→step, `.card`→card, else block) it
lists the container selectors it may live in. "Between blocks" means a direct
child position of a section's content wrapper (`.wrap > *`, `.split > div`,
`.eng-panel-in`, `.article-body`, `.cta-grid > div`).

**Placement resolution**: for each entry, find the element's hide target and
the anchor's hide target; `before`/`after` insert as sibling, `into` appends.
If the anchor is missing (removed markup, other page), skip silently. A moved
button leaving a `.btn-row` that becomes empty lets the existing `:has()` rule
hide the row; a button dropped between blocks gets a fresh `.btn-row` wrapper
(runtime creates it; the wrapper is not stored).

**Links**: set `href` on the target `a` (or nearest `a` inside the target).
Never touch protected elements (§4). **Styles**: replace the button's class
set with `btn btn-primary` / `btn btn-secondary` (+ `on-light` unless inside
`.on-dark, .hero, .cta-band, .numbers-band`) / `btn-text`. Keep `data-i18n`
and any `.arrow` span.

**Removing an added element** (existing Remove) deletes its record and its
overrides instead of hiding — it was owner-made; Undo restores it in full.

## 3. Server (`server.js`)

- `validateSite()` per §1. `publishSummary()` counts `added`, `moved`, `links`,
  `styles` inside the existing `elements` bucket (one number for the owner,
  detail in the tooltip).
- `GET /api/link-targets` (session): `{ pages:[{key,title}], sections:{page:[{id,label}]}, items:{cases:[{slug,title}], articles:[…], jobs:[…]} }` built from
  `listPages()`, the `data-section` scan the Pages API already does (labels
  from the first heading), and published collections. Cached per publish.
- Markup pass: every `[data-section]` that lacks an `id` gets one
  (`sec-<key with dots→dashes>`) so sections are linkable with `#`.
- Nothing about form validation changes; **form fields cannot be added**
  (`field` is not a kind) because the server's rules are fixed.

## 4. Editor (`js/editor.js`, `css/editor.css`) — Phase A

**Add.** With an element selected, the block toolbar gains **＋ Add**. It
opens a small menu: **Another like this** first, then the kinds allowed in
this container (§2 table), each with a one-line hint from `admin-fields.js`.
Choosing one → `commit()` adds the record (and, for `copy`, the text
overrides) → runtime re-applies → the new element is selected and, for text
kinds, text edit opens immediately. Protected elements cannot be copied;
`.field`, forms, the wordmark, language switch and cookie controls never show
Add.

**Link.** For any target that is or contains an `a`: toolbar button **Link**
→ right panel with four radio groups: *Page* (dropdown), *Section on this
page* (dropdown of sections with their labels), *Item* (cases / articles /
jobs, from `/api/link-targets`), *Custom* (URL, email, phone — validated
inline with the same rules as the server). Shows the current destination in
words ("Goes to: Contact page → Book a teardown"). Save = `commit()`.

**Style.** For buttons: a three-way segmented control in the same panel and
as a quick action in the toolbar. Live repaint via runtime.

**Keys shown to the owner:** never. Labels only.

## 5. Editor — Phase B: move by drag, and "Move to…"

- Every selected element shows a drag handle (⋮⋮). `dragstart` → `beginDrag`;
  the page renders **drop zones**: a 3px highlighted line at every valid slot
  for this element kind (from `ALLOWED_DROPS`), plus a highlighted band on
  every valid container's empty end. Invalid places show nothing; the cursor
  says "not allowed" there. Sections that are hidden are still valid.
- Drop → `commit()` writes a `placements` entry (or updates the added
  element's anchor) → runtime re-applies. Undo works. Dropping a button onto a
  "between blocks" line wraps it in a new row automatically.
- Auto-scroll near the viewport edges while dragging (the page is long).
- **Mobile / keyboard:** the action sheet and the block toolbar get
  **Move to…** → a sheet listing sections (by label) → then slots inside
  ("Top", "Under: <first words of each block>", "Bottom", and any valid rows)
  → confirm. Keyboard: with a block selected, `Alt+↑/↓` moves it one slot.
- Protected elements (§4 of the removal plan) and `.field` cannot be dragged;
  the handle is absent.
- Announce moves in the live region: "Moved under <block>".

## 6. Tests

`test/server.test.js`
- Validation: caps, id/key patterns, kinds, positions, styles, link schemes
  (`javascript:` and `data:` dropped, relative pages and `#sec-…` kept),
  placement de-duplication.
- `/api/link-targets` shape; requires session.
- Summary counts added/moved/links/styles.

`test/browser-smoke.js` (desktop) / `test/admin-regression.js` (mobile)
- Add "Another like this" on a hero bullet → new `li` with placeholder in both
  languages; edit EN and AZ; publish → public page has it; Remove deletes it;
  Undo brings it back with text.
- Add a Button under the hero paragraph → a `.btn-row` appears with one
  primary button; set Link → Page → Contact; set Style → Secondary; publish →
  public `<a class="btn btn-secondary" href="contact.html">`, correct
  `on-light` handling, no overflow at 390.
- Copy a stat → `.stat-row` has one more; copy a FAQ item → both q/a keys
  editable.
- Link panel: section list shows this page's sections with labels; choosing
  one writes `#sec-…` and the section actually has that id; custom
  `javascript:` is rejected inline.
- Drag: move the hero secondary button to the CTA band's row → placement
  stored; public page renders it there; the hero row still centres; Undo
  returns it. Drag a bullet onto a `.btn-row` → no drop zone offered.
- Auto-wrap: drop a button between two paragraphs → wrapped in `.btn-row`.
- Mobile: long-press → Move to… → choose section + slot → moved; no overflow.
- Keyboard: `Alt+↓` moves the selected block one slot.
- Protected h1 and form fields: no Add-copy, no drag handle.
- History restore reverses an add + move together.

## 7. Docs

- `README.md` "Editing the site": "Adding and moving elements" paragraph.
- `UX-CONTRACT.md`: kinds table, allowed containers, drop-zone rule, what is
  never draggable.
- `js/admin-fields.js`: hints for Add, Link, Style, Move to.
- `audit/AUDIT.md` resolution table: "cannot add or reposition elements" → fixed.

## 8. Phases and commits

| Phase | Deliverable | Commit |
|---|---|---|
| A | Data model, runtime templates/links/styles, Add menu, Link panel, Style, tests, docs | `feat(editor): add elements, link buttons, button styles` |
| B | Placements, drag-to-slot with drop zones, Move to… sheet, keyboard move, tests | `feat(editor): move any element to any slot` |

Stop after Phase A for review before starting B.

## 9. Acceptance — owner's words

1. I click a bullet, press Add, and a new bullet appears under it ready to type — in both languages.
2. I click a paragraph, Add → Button, and a button appears under it. I type its label, choose "Contact page" as where it goes, make it Secondary. It looks like the other buttons.
3. I copy a stat and a FAQ question and just change the words.
4. I drag the button up above the paragraph, or into another section; the page shows me where it can go, and it lands neatly. On my phone I use "Move to…".
5. Nothing I add or move looks broken on the phone.
6. Undo, Remove and History work on everything I added or moved.
