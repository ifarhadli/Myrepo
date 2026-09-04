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
- `css/style.css` owns public runtime tokens; `css/admin.css` owns the deliberately independent editor system.
- `js/site-config.js` applies published owner overrides to the public tokens.
- Supported theme: light/dark surfaces within one brand theme.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | This contract | native | browser keyboard smoke |
| Form | Public form controller + server validator | `js/main.js`, `server.js` | lead / newsletter / admin | integration + browser validation |
| Scrollbar | Global application stylesheets | `DESIGN.md`, `css/style.css`, `css/admin.css` | geometry exceptions | static audit + browser overflow smoke |
| Toast | Editor/admin toast utilities | `js/editor.js`, `js/admin.js` | success / error | live region + browser smoke |
| Dialog | Native `<dialog>` with owned focus/return contract | `js/editor.js`, `js/admin.js` | publish / discard / destructive | keyboard browser smoke |
| Drawer/Sheet | Non-modal editor sheet | `js/editor.js`, `css/editor.css` | design-left / operations-right | browser responsive smoke |
| CRUD | Editor/admin API clients + server routes | `js/editor.js`, `js/admin.js`, `server.js` | draft / publish / submission state / delete / reset | integration suite |

Table selection and date-picker ownership are omitted because the editor has neither selection nor a date-picker; structured-data dates use typed ISO text fields.

## Component behavior

- Buttons expose hover, focus-visible, disabled, and pending states where a request occurs.
- Inputs retain values after validation failure; public forms show linked inline errors and focus the first invalid field.
- Secret inputs are masked by default and provide an explicit Show/Hide control.
- Textareas use a stable minimum height and do not resize into adjacent editor controls.
- The submissions table owns horizontal overflow at narrow widths.
- On-page text editing uses Enter to commit and Escape to cancel. Shift+Enter
  is reserved for authored multiline HTML strings; pasted content is plain
  text and saved HTML is allow-listed.
- Section and item drag handles have adjacent up/down or equivalent keyboard
  actions. Section order changes only among direct `<main>` siblings; the hero
  remains outside that ordering boundary.

## Dataset navigation

- The submissions filter is transient because it is a single, non-shareable administrative view over a small local dataset.
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

## Navigation and responsive behavior

- `/admin` is login-only and redirects authenticated owners to
  `index.html?edit=1`; `/admin-advanced.html` owns the legacy tab dashboard.
- Advanced-admin tabs update the URL hash and document heading without a full navigation.
- The editor page switcher saves the draft before full-page navigation and
  preserves `?edit=1`. Anonymous requests with that query never receive the
  editor assets.
- Below 820px the sidebar becomes an in-flow wrapping navigation; tables scroll within their own container.
- The public drawer is modal, makes background content inert, traps focus, closes on Escape, and restores focus.
- Route errors use `404.html`; the server returns explicit JSON errors for API routes.

## Overlays and feedback

- The advanced dashboard's `#confirmDialog` is its single destructive confirmation primitive; native `confirm`, `alert`, and `prompt` are forbidden everywhere.
- The on-page editor creates the same owned `<dialog>` behavior for Publish,
  Discard and lead deletion. Dialogs trap focus, Escape cancels, and focus
  returns to the invoking control.
- Editor Design is a non-modal left sheet so the owner can inspect the page
  while changing it. Inbox and Settings are non-modal right sheets. Escape
  closes a sheet and returns focus; dialogs opened from a sheet sit above it.
- Cancel is initially focused, Escape cancels, and the browser restores focus to the invoking control.
- Admin toast messages use a polite live region, appear at the bottom center, and clear after 3.2 seconds.
- Unsaved changes use an in-app confirmation for editor actions and the platform unload guard for browser/tab exit.
- Layer order is dialog, public drawer, popover/mega-menu, cookie surface, then document content. Admin toast remains visible above editor content.

## Async and resilience

- Mutations are pessimistic. Publish disables its trigger; public forms suppress duplicate submit while pending. Editor drafts debounce for 1.5 seconds and retain an immediate local browser copy.
- Failed publish keeps the draft. Failed lead notifications never discard the already persisted submission.
- Session expiry returns to sign-in. Configuration writes use temporary files and atomic rename.
- Offline editor changes remain in one local browser copy and reconcile by the
  newest save timestamp when that browser returns. There is no multi-device
  merge, conflict resolution, multi-user editing, or revision history.

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
- Admin configuration is normalized and scheme/date constrained on the server. Password changes enforce the server policy.
- Secrets remain environment-only and are never copied into the public configuration or toast text.

## Permission and clipboard

- The editor has one password-authenticated role; no field-level permissions exist.
- Article copy-link writes the public canonical URL and reports success without exposing secret data.

## Verification

- Static: `npm run check` and the premium strict audit.
- Integration: `npm test` covers configuration, validation, persistence, notifications, and schema guards.
- Browser: `npm run test:browser` covers phone/laptop containment, navigation focus/inert behavior, validation, content affordances, and admin layout.
- Owner gates still required: native Azerbaijani review, approved privacy/retention terms, and written approval for every proof item before enabling it.
