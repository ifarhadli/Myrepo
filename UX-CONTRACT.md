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
| Toast | Admin toast utility | `js/admin.js` | success / error | live region + admin browser smoke |
| CRUD | Admin API client + server routes | `js/admin.js`, `server.js` | publish / delete / reset | integration suite |

Table selection and date-picker ownership are omitted because the editor has neither selection nor a date-picker; structured-data dates use typed ISO text fields.

## Component behavior

- Buttons expose hover, focus-visible, disabled, and pending states where a request occurs.
- Inputs retain values after validation failure; public forms show linked inline errors and focus the first invalid field.
- Secret inputs are masked by default and provide an explicit Show/Hide control.
- Textareas use a stable minimum height and do not resize into adjacent editor controls.
- The submissions table owns horizontal overflow at narrow widths.

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

## Navigation and responsive behavior

- Admin tabs update the URL hash and document heading without a full navigation.
- Below 820px the sidebar becomes an in-flow wrapping navigation; tables scroll within their own container.
- The public drawer is modal, makes background content inert, traps focus, closes on Escape, and restores focus.
- Route errors use `404.html`; the server returns explicit JSON errors for API routes.

## Overlays and feedback

- `#confirmDialog` is the single destructive confirmation primitive; native `confirm`, `alert`, and `prompt` are forbidden.
- Cancel is initially focused, Escape cancels, and the browser restores focus to the invoking control.
- Admin toast messages use a polite live region, appear at the bottom center, and clear after 3.2 seconds.
- Unsaved changes use an in-app confirmation for editor actions and the platform unload guard for browser/tab exit.
- Layer order is dialog, public drawer, popover/mega-menu, cookie surface, then document content. Admin toast remains visible above editor content.

## Async and resilience

- Mutations are pessimistic. Publish disables its trigger; public forms suppress duplicate submit while pending.
- Failed publish keeps the draft. Failed lead notifications never discard the already persisted submission.
- Session expiry returns to sign-in. Configuration writes use temporary files and atomic rename.
- There is no offline write queue, autosave, conflict merge, or multi-user editing.

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
