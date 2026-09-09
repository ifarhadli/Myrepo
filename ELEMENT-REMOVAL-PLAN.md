# Element removal — make every visible element removable from the editor

Status: approved for implementation · Author: Claude · Executor: Codex
Branch: `claude/site-build-brief-jpmkd6` (one commit; push to `master` after review)
Prerequisites: `EDITOR-PLAN.md` and `ADMIN-PLAN-2.md` are implemented. Reuse what
exists — this feature is the same pattern as hidden sections and hidden cards,
extended down to single elements. Do not build a parallel mechanism.

Ground rules (unchanged): zero npm dependencies · CRLF preserved · every write
behind session + `X-Requested-With: OmniAdmin` + Origin check · `npm test` and
`npm run test:browser` green before the commit · docs updated.

## 0. The owner's request and the answer

The owner asked: *"How do I delete an element inside a block?"* Today he can
hide a section, hide a card, remove a catalogue item — but not a paragraph, a
button, a bullet, a label, a footnote, an image slot, a stat, a nav link.

After this plan: **anything he can see, he can remove**, with three rules.

1. **Remove = hide, never destroy.** The element gets a badge and fades in the
   editor; it disappears for visitors; one click restores it. Undo, Publish
   summary and History all cover it. Nothing on the site is ever deleted.
2. **Whole controls go, not their text.** Removing the text of a button removes
   the button. Removing a bullet removes the `<li>`. Removing a form field's
   label removes the whole field. The owner never gets an empty shell.
3. **Only things that break the site are protected** — see §3. The list is
   short and the owner sees why each is protected.

## 1. Data model (`data/site.json`)

```jsonc
"hiddenElements": ["index:home.hero.micro", "*:nav.insights", "contact:home.cta.labelCompany"]
```

- One string per hidden element: `<scope>:<key>`.
  - `key` = the element's `data-i18n` key, or for elements without one, the
    `data-hide-key` the markup pass adds (§4).
  - `scope` = the page key (`index`, `contact`, …) for page content, or `*` for
    anything rendered by `partials.js` (header, mega-menu, drawer, footer,
    cookie banner), because those render on every page.
- Validation in `validateSite()`: array, ≤ 400 entries, each
  `^(\*|[a-z0-9-]{1,40}):[a-zA-Z0-9._-]{1,120}$`, de-duplicated, unknown keys
  kept (a key may belong to a page not currently loaded).
- The same key hides in **both languages** — it is one element on one site.

## 2. Runtime (`js/site-config.js`)

`applyHiddenElements(cfg)`, called with the existing `applyLayout` after
`omni:partials-ready` and again after any partial re-render:

1. For each entry, find the element: `[data-i18n="<key>"]` or
   `[data-hide-key="<key>"]`, restricted to the current page for page scope
   and to `#site-header, #site-footer, #cookieBanner, .mega, .drawer` for `*`.
2. Resolve the **hide target** — the smallest unit that removes cleanly:
   `el.closest('.btn, button, a.d-link, li, .field, .checkfield, .stat, .card, .chip, figure, .pstep, dt, dd, .faq-item, p, h1, h2, h3, h4, h5, h6, .eyebrow, .label, .footnote, .micro, .breadcrumb, [data-image-shell]') || el`.
   If the target contains **another** `[data-i18n]` that is *not* hidden and is
   not a descendant meant to go with it (e.g. a card's title inside a card),
   fall back one level: hide the element itself. Keep this heuristic in one
   function, `hideTargetFor(el)`, used by runtime and editor alike.
3. Set `data-omni-hidden-element="<scope>:<key>"` on the target. Public CSS:
   `[data-omni-hidden-element]{display:none!important}`. Editor CSS overrides
   to faded + badge, exactly like `data-section` hidden styling today.
4. **Layout safety after hiding:** if a hide target is the only remaining
   visible child of a flex/grid row (`.btn-row`, `.grid-2/3`, `.stat-row`,
   `.eng-cols > div`), the row keeps its own rules — no special-casing. But
   `.btn-row` with zero visible children gets `display:none` via
   `:not(:has(> :not([data-omni-hidden-element])))` so no empty gap remains
   (Chrome/Safari/Firefox all support `:has` now).

**Forms:** when a `.field` is hidden, the client validator skips it and the
server must not require it. `validateSubmission()` in `server.js` reads the
live `hiddenElements`; a field whose hide key is present becomes optional.
Protected fields (§3) can't be hidden, so name/email/consent are always sent.

**Menus rendered from data:** nav links, footer columns, mega-menu columns are
built by `partials.js`. They carry `data-i18n` keys already (`nav.work`,
`footer.colServices`, `engines.e2.name`…). Hiding `*:nav.work` hides that link
in the desktop nav, the drawer and the footer together — say so in the badge
tooltip: "Hidden everywhere this appears".

## 3. Protected elements (cannot be removed)

Removing these breaks function, law or the editor itself; the Hide button is
shown disabled with the reason as its tooltip.

| Element | Reason shown |
|---|---|
| Wordmark `.mark` (header, drawer, footer) | "The site name links home" |
| Name and email inputs + labels in every form, the consent checkbox, the submit button | "Required to receive enquiries" |
| Cookie banner buttons and the Cookie Preferences link | "Required by the consent setting" |
| Language switch | "Visitors need it to change language" |
| The `<h1>` of each page | "Every page needs a headline — edit it instead" |
| Editor chrome (`.omni-*`) and `<main>` itself | not selectable at all |

Everything else — hero paragraph, micro line, secondary button, eyebrow,
stats, process steps, testimonials, FAQ items, bullets in the catalogue
accordion, footer links, nav items, images, the featured case in the
mega-menu — is removable.

## 4. Markup pass (one-off)

Elements the owner can see but that carry no `data-i18n` need a stable id:
add `data-hide-key="<page>.<block>.<n>"` to: hero SVG/visual wrappers, stat
figures (`.stat-fig` — key it with its label's key + `.fig`), image slots
(reuse the existing `data-image` value), decorative dividers that are content
(`.split-rule`), logo chips (`index.logos.lN`), CTA `.arrow` spans are **not**
separately hideable (they go with the button). Never add hide keys to inputs.

## 5. Editor (`js/editor.js`, `css/editor.css`)

- **Selection model (exists):** clicking a block selects it. Extend selection to
  the hide target of any `[data-i18n]` / `[data-hide-key]` element, so a bare
  paragraph or bullet can be selected without entering text-edit.
- **Toolbar:** the mini toolbar (text edit) and the block toolbar (selection)
  both gain **Remove** (icon: 🗑, label "Remove"). Hidden targets show
  **Restore** (↺) instead. Protected elements show Remove disabled with the
  reason tooltip. Mobile action sheet gains the same entry.
- **Keyboard:** with a block selected, `Delete`/`Backspace` (when not inside a
  text edit) = Remove; `Esc` deselects. Announce via the existing live region:
  "Removed. Undo or Restore to bring it back."
- **Visual state:** hidden target = 40% opacity + dashed outline + badge
  "Removed · click ↺ to restore", same tokens as hidden sections. Badge text
  for `*` scope adds "on every page".
- **Commit:** `commit(d => toggle in d.hiddenElements, 'Remove element')` —
  Undo/Redo free, Publish summary counts it under a new `elements` bucket
  (`publishSummary` in `server.js` and `summaryCounts` in the editor).
- **Discoverability:** the first time an element is selected in a session,
  a one-line hint under the toolbar: "Remove hides this for visitors; you can
  restore it any time." Dismiss stores `omni-hint-remove` in `localStorage`.
- **Field help:** add entries to `js/admin-fields.js` for the Remove and Restore
  actions in plain language.

## 6. Tests

`test/server.test.js`
- `hiddenElements` validated: cap, pattern, dedupe, unknown keys kept.
- A hidden form field becomes optional server-side; protected fields never do.
- Publish summary reports `elements`.

`test/browser-smoke.js` (desktop) and `test/admin-regression.js` (mobile)
- Select the hero micro line → Remove → element carries
  `data-omni-hidden-element`, faded with badge; publish; public page: element
  not in layout (`offsetParent === null`), no horizontal overflow, `.btn-row`
  with both buttons removed leaves no gap.
- Remove the text of "See the work" → the whole `<a class="btn">` is hidden,
  not just the span.
- Remove a catalogue bullet → the `<li>` is hidden on the services page and in
  the mega-menu.
- Remove `*:nav.insights` → link gone from desktop nav, drawer and footer.
- Hide the "Company" field on contact → form still submits without it; the
  server accepts it; hiding "Email" is refused with the tooltip reason.
- Restore → element back; Undo after Remove → back; History restore → back.
- Protected `<h1>` shows disabled Remove.
- Keyboard: Delete on a selected block removes; Esc deselects.
- Mobile sheet exposes Remove/Restore; no overflow at 390 px.

## 7. Docs

- `README.md` "Editing the site": a paragraph "Removing elements" (it hides,
  restore any time, protected list).
- `UX-CONTRACT.md`: the hide-target heuristic and the protected list.
- `audit/AUDIT.md` resolution table: "single elements not removable" → fixed.

## 8. Acceptance — owner's words

1. I click any text, button, bullet, picture or stat and press Remove. It fades
   with a note; visitors don't see it after I publish.
2. I press ↺ and it's back exactly as it was. Undo works too.
3. Removing a button removes the whole button, not just its words.
4. I removed the "Company" field from the contact form and enquiries still
   arrive. I couldn't remove the email field, and it told me why.
5. I removed "Insights" from the menu and it left the header, the phone menu
   and the footer together.
6. Nothing I remove leaves a hole or breaks the phone layout.

**Commit:** `feat(editor): remove and restore any element`
