# OmniMark UX Contract

## Product context

- Audience: agency owners and staff publishing a bilingual marketing site.
- Primary jobs: publish copy/configuration, review leads, export leads, and remove submissions.
- Target markets: the current authored content targets US/global buyers; ownership decides expansion.
- Active locales: English and Azerbaijani. English is the fallback; Azerbaijani launch copy requires native review.
- Timezone/calendar policy: stored timestamps are ISO UTC and rendered in the administrator's locale.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

No external business policy is maintained in this repository yet. `README.md` documents the current data and deployment behavior. The owner must supply approved privacy, retention, legal, proof, and content policy before launch.

## Visual contract

- `DESIGN.md` records the visual system and accepted brand direction.
- `css/style.css` owns public runtime tokens; `css/editor.css` and
  `css/admin.css` own deliberately independent authenticated control systems.
- `js/site-config.js` applies published owner overrides to the public tokens.
- Supported theme: light/dark surfaces within one brand theme.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | This contract | native | browser keyboard smoke |
| Form | Public/admin form controllers + server validator | `js/main.js`, `js/login.js`, `js/editor.js`, `server.js` | lead / newsletter / login / recovery / account | integration + browser validation |
| Scrollbar | Global application stylesheets | `DESIGN.md`, `css/style.css`, `css/admin.css` | geometry exceptions | static audit + browser overflow smoke |
| Toast | Editor/admin toast utilities | `js/editor.js`, `js/admin.js` | success / error | live region + browser smoke |
| Dialog | Native `<dialog>` with owned focus/return contract | `js/editor.js`, `js/admin.js` | publish / discard / destructive | keyboard browser smoke |
| Drawer/Sheet | Non-modal editor sheet | `js/editor.js`, `css/editor.css` | design-left / operations-right | browser responsive smoke |
| CRUD | Editor/admin API clients + server routes | `js/editor.js`, `js/admin.js`, `server.js` | draft / publish / collections / submission state / account / notification recipients / delete / reset | integration + collection browser lifecycle |
| File upload | Media panel + opaque media API | `js/editor.js`, `server.js` | picker / drag-drop / retry / responsive variants | integration + browser upload smoke |

Table selection and date-picker ownership are omitted because the editor has neither selection nor a date-picker; structured-data dates use typed ISO text fields.

## Component behavior

- Buttons expose hover, focus-visible, disabled, and pending states where a request occurs.
- Inputs retain values after validation failure; public forms show linked inline errors and focus the first invalid field.
- Secret inputs are masked by default and provide an explicit Show/Hide control.
- Password recovery never confirms whether a private address exists. Reset
  tokens are one-time, expire after 30 minutes, and a completed reset rotates
  the session secret so every prior session becomes invalid.
- Lead-recipient chips accept at most ten unique valid addresses. A non-empty
  private list owns delivery; an empty list deliberately falls back to the
  environment recipient list.
- Textareas use a stable minimum height and do not resize into adjacent editor controls.
- The submissions table owns horizontal overflow at narrow widths.
- On-page plain-text editing uses Enter to commit and Escape to cancel.
  Collection body fields keep normal paragraph/list Enter behavior and expose
  an explicit Done action; Ctrl/Command+Enter also commits. Pasted content is
  plain text and every saved HTML surface is allow-listed.
- Section and item drag handles have adjacent up/down or equivalent keyboard
  actions. Section order changes only among direct `<main>` siblings; the hero
  remains outside that ordering boundary.
- At 700 px and below, the editor owns one bottom dock with Undo, Publish and
  More. More provides Page, EN/AZ, Design, This page, Media, History, Inbox,
  Settings and Discard; desktop Phone preview is omitted because the viewport
  is already narrow. No desktop editor action disappears on touch.
- Touch section and card **⋯** controls open the shared owned action-sheet
  dialog. Sections expose Hide/Show, Accent and Move; cards expose the same
  reorder/status/image/removal operations as their desktop rails. Drag handles
  are not used for touch reordering. Image slots expose a permanent camera
  action, separate from the card action menu.
- Every phone text edit exposes Done. Its toolbar follows `visualViewport`
  above the virtual keyboard; plain text receives only Done while rich text
  retains its allow-listed formatting actions. Escape still cancels.
- Images can be added only to authored `data-image` slots. The slot owns crop
  geometry; the owner controls a per-use alt string and focal point. Focal
  placement has both a direct image target and keyboard-operable horizontal /
  vertical range controls. Empty slots preserve the authored placeholder.
- The media picker accepts PNG, JPEG and WebP, states the 8 MB limit before
  selection, exposes per-file preparation/upload/progress/failure/Retry state,
  and never accepts SVG. The browser makes the 480/960/1600 responsive copies
  without upscaling; the server verifies the bytes again.
- Collection listings are the canonical UI for cases, articles, jobs, team and
  testimonials. Published items are links only when they own a real detail
  route; unpublished items stay visible in edit mode with a textual Draft
  badge and are absent from public listings. Each list has one New action and
  each item has drag plus keyboard move controls, publish state, duplication,
  image selection and owned delete confirmation.
- Case, article and job detail pages use clean server routes. Item fields are
  bilingual; slugs and operational metadata are language-neutral. Changing a
  title never silently changes an existing slug.

## Dataset navigation

- The submissions filter is transient because it is a single, non-shareable administrative view over a small local dataset.
- Media search is immediate and local because the library is capped at 500
  items. It has an app-owned clear action; selection is explicit and singular.
- Empty and failure states render inside the table region.
- Bulk selection is not supported. Delete-all always requires the owned confirmation dialog.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Publish | Save & publish | button disabled + publishing label | current tab | status toast | draft retained + error toast | trigger remains available | `js/admin.js` |
| Delete one lead | row delete | pessimistic request | refreshed list | refreshed row count | list retained + error toast | list region | `js/admin.js` |
| Delete all leads | Delete all + confirm | modal then pessimistic request | empty list | refreshed row count | list retained + error toast | confirmation trigger restored | `js/admin.js` |
| Reset configuration | reset + confirm | local draft mutation | Overview | status toast | discard or reload remains available | Overview heading | `js/admin.js` |
| Filter leads | native select | immediate local filter | current tab | count updates | full list remains in memory | filter remains focused | `js/admin.js` |
| Autosave editor draft | any committed edit | “Saving…” in bar | current page | saved timestamp | local browser copy retained + offline status | edited context remains | `js/editor.js` |
| Publish editor draft | Publish + summary confirm | button disabled + publishing label | current page | toast + zero counter | server draft retained + error toast | trigger restored | `js/editor.js` |
| Discard editor draft | Discard + confirm | confirm disabled during delete | current live page reload | clean disabled Publish | draft retained on failure | trigger restored or page reload | `js/editor.js` |
| Mark lead read/unread | Inbox action | pessimistic request | open Inbox | unread count updates | list retained + error toast | refreshed lead list | `js/editor.js` |
| Request password reset | Forgot password? → Send reset link | button disabled + sending label | recovery view | generic sent-if-configured status | retry after surfaced throttle/server error | request trigger | `js/login.js` |
| Complete password reset | reset-link form | button disabled + saving label | sign-in form | persistent success status | values retained + generic invalid/expired error | first invalid field | `js/login.js` |
| Save recovery email | Settings → Account | button disabled + saving label | open Settings | inline success | values retained + linked error | failing field | `js/editor.js` |
| Save lead recipients | Settings → Lead notifications | button disabled | open Settings | inline success + source refresh | chip list retained + linked error | action remains available | `js/editor.js` |
| Send notification test | Send a test email | pessimistic, duplicate blocked | open Settings | exact delivered recipients | no automatic retry; inline failure | trigger remains available | `js/editor.js` |
| Edit page SEO | This page fields | local commit + normal draft autosave | open This page sheet | live search/share previews | invalid URL retained with linked correction | invalid field | `js/editor.js` |
| Upload media | picker or slot drop | per-file preparation, progress and stage label | open Media sheet | Ready row + thumbnail + toast | failed row retains file + Retry | upload row / picker | `js/editor.js`, `server.js` |
| Assign image slot | Use here / direct drop | metadata save when needed | current page | image and focal crop repaint live | draft unchanged if metadata save fails | Media sheet | `js/editor.js` |
| Delete media | Delete from library + confirm | pessimistic request, confirm disabled | open Media sheet | item removed + toast | item retained + error; blocked uses named | invoking item / sheet | `js/editor.js`, `server.js` |
| Create collection item | + New on a listing | draft save before navigation | clean item URL in edit mode | Draft badge + editable page | item remains in draft if navigation fails | new item page | `js/editor.js` |
| Edit collection item | direct text / Item details / Media | normal draft autosave | current item page | live repaint + saved timestamp | local draft retained | edited field or sheet | `js/editor.js`, `js/site-config.js` |
| Publish/unpublish item | item/card status + site Publish | normal publish summary | current edit page | public route/listing/sitemap update together | server draft retained | publish trigger | `js/editor.js`, `server.js` |

## Navigation and responsive behavior

- `/admin` is login-only and redirects authenticated owners to
  `index.html?edit=1`; `/admin-advanced.html` owns the legacy tab dashboard.
- Advanced-admin tabs update the URL hash and document heading without a full navigation.
- The editor page switcher saves the draft before full-page navigation and
  preserves `?edit=1`. Anonymous requests with that query never receive the
  editor assets.
- Published collection routes are `/work/<slug>`, `/insights/<slug>` and
  `/careers/<slug>`. Unknown and unpublished public slugs return the owned 404;
  an authenticated `?edit=1` request may resolve an unpublished draft item.
  Static hosting uses the documented `?item=<slug>` template fallback.
- Below 820px the sidebar becomes an in-flow wrapping navigation; tables scroll within their own container.
- The public drawer is modal, makes background content inert, traps focus, closes on Escape, and restores focus.
- Route errors use `404.html`; the server returns explicit JSON errors for API routes.

## Overlays and feedback

- The advanced dashboard's `#confirmDialog` is its single destructive confirmation primitive; native `confirm`, `alert`, and `prompt` are forbidden everywhere.
- The on-page editor creates the same owned `<dialog>` behavior for Publish,
  Discard and lead deletion. Dialogs trap focus, Escape cancels, and focus
  returns to the invoking control.
- Editor Design and Media are non-modal left sheets so the owner can inspect the page
  while changing it. Inbox, Settings and This page are non-modal right sheets. Escape
  closes a sheet and returns focus; dialogs opened from a sheet sit above it.
- At 700 px and below, those same editor sheets become full-screen with sticky
  close headers and 16 px form controls. Publish/Discard dialogs also fill the
  visual viewport with internally scrolling content and sticky safe-area
  actions. Short section/card action sheets remain bottom-anchored modal
  dialogs, trap focus, make the page inert, dismiss with Escape and restore
  focus to their **⋯** trigger.
- Cancel is initially focused, Escape cancels, and the browser restores focus to the invoking control.
- Admin toast messages use a polite live region, appear at the bottom center, and clear after 3.2 seconds.
- Unsaved changes use an in-app confirmation for editor actions and the platform unload guard for browser/tab exit.
- Layer order is dialog, public drawer, popover/mega-menu, cookie surface, then document content. Admin toast remains visible above editor content.

## Async and resilience

- Mutations are pessimistic. Publish, password/account writes and external
  test-email delivery disable their triggers; test email is non-idempotent and
  is never retried automatically. Public forms suppress duplicate submit while
  pending. Editor drafts debounce for 1.5 seconds and retain an immediate local browser copy.
- Each media file has independent visible progress. A failed upload is never
  retried automatically; Retry reuses an already-created original when one
  exists and regenerates its responsive variants. Slot changes remain in the
  normal draft/undo path while library metadata writes are pessimistic.
- Failed publish keeps the draft. Failed lead notifications never discard the already persisted submission.
- Session expiry returns to sign-in. Configuration writes use temporary files and atomic rename.
- Offline editor changes remain in one local browser copy and reconcile by the
  newest save timestamp when that browser returns. There is no multi-device
  merge, automatic conflict resolution, multi-user editing, or per-field history.

## Drafts, history and conflicts

- One draft at a time (`data/draft.json`). It records `baseUpdatedAt`, the
  live version it was started from.
- Publish compares that base with the live `updatedAt`. If they differ the
  server answers `409 stale`; the editor shows a "The live site changed
  meanwhile" dialog and only republishes with an explicit *Publish anyway*.
- The advanced dashboard's direct save gets `409 draft-exists` while an
  editor draft is pending; it asks before saving with `force: true`.
- Every publish archives the outgoing live version to `data/history/`
  (last 10). *History → Restore* loads a version **into the draft** — never
  straight to live — so the normal review-then-publish path still applies.
  Restore replaces the current draft and says so before doing it.
- Undo/Redo are session-scoped and cleared on publish; History is the
  cross-session way back.

## Validation

- Public lead validation is owned by `js/main.js` and mirrored by `server.js`.
- Public forms use `novalidate`, inline linked messages, `aria-invalid`, first-invalid focus, and server field-error mapping.
- Admin configuration is normalized and scheme/date constrained on the server.
  Password changes and resets enforce the server policy; recovery failures use
  one generic response. Per-page and site-wide `ogImage` accept only HTTP(S)
  or an owned 16-character media ID, and `noindex` pages are omitted from the
  generated sitemap. Image slot keys and IDs are pattern constrained; focal
  coordinates are finite values from 0 to 1 and alt text is length-capped.
- Collection types are capped at 100 records. IDs and slugs are constrained,
  slugs are unique within a type, application URLs require HTTPS, and rich
  bodies are sanitised server-side to the documented editorial element list.
- Secrets remain environment-only and are never copied into the public configuration or toast text. Recovery and lead-recipient addresses live only in private `data/admin.json`. Media metadata and files live under private `data/` paths; public bytes are served only through opaque ID/width routes with immutable caching.

## Permission and clipboard

- The editor has one password-authenticated role; no field-level permissions exist.
- Article copy-link writes the public canonical URL and reports success without exposing secret data.

## Verification

- Static: `npm run check` and the premium strict audit.
- Integration: `npm test` covers configuration, validation, persistence, notifications, and schema guards.
- Browser: `npm run test:browser` covers phone/laptop containment, navigation focus/inert behavior, validation, content affordances, admin layout, and the complete 390 px mobile edit/publish workflow.
- Owner gates still required: native Azerbaijani review, approved privacy/retention terms, and written approval for every proof item before enabling it.
