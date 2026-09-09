# Admin dashboard audit — 9 September 2026

The main editor works, but the admin experience is **not fully correct yet**. Six confirmed issues remain. The most important ones can change which content visitors see or damage the public site's colours.

Audited branch: `claude/site-build-brief-jpmkd6`, commit `bf59120603c18b6b197707732fbacb940ba40ddc`.

## Scope and evidence

This was an interactive audit of the on-page editor, its settings and account panels, and the advanced dashboard. The goal was to check whether an ordinary admin can make changes, understand their effect, and recover from mistakes.

- **281 additional mouse clicks**, across **141 distinct selectors**, plus 50 field-entry operations, selection changes, keyboard actions, and a native mouse drag/drop journey.
- Desktop at 1440 px and mobile emulation at 390 px. The existing suites also exercise 1366 px and 390 px layouts.
- **490 existing checks passed:** `npm test` 235; browser smoke 169; admin regression 86.
- 60 screenshots and 910 DOM snapshots captured during this audit. Only screenshots opened and inspected during this run are used as report evidence.
- Additional exploration captured **two occurrences of the same uncaught application exception**, described in finding 5. Therefore the green test suites are not an all-clear.

All writes, uploads, invitations, publishing, password changes, and enquiry deletion happened in a disposable local copy with synthetic accounts and a local mock email service. Application source and real site data were not changed. The audit browser and local services were stopped after testing.

Screenshots show the evolving test fixture. After the deliberate invalid-colour test, some later screenshots also show its damaged public button colours; that is not the initial default appearance.

## Findings, in priority order

### 1. High — Advanced industry reordering moves the hidden state to the wrong industry

**Reproduction:** In the home-page editor, remove Banking & fintech using its item menu, then publish. Open Advanced → Industries, move Banking down below Telecom, and Save & publish. Return to the editor or public page.

**Observed:** Banking becomes visible again; Telecom is now removed. The configuration still contains `*:industries.1`, even though the industry at index 1 changed. The editor had correctly hidden Banking before the advanced reorder.

**Impact:** A routine reorder can republish content the admin deliberately removed and hide unrelated content. Both languages share this visibility state.

**Fix:** Make advanced catalogue mutations use the same identity/remapping rules as the on-page editor. Audit delete/reset operations and service reordering for the same index-dependent problem. The industry case is reproduced; the similar service handlers are a code-review concern, not a separately reproduced finding.

**Acceptance:** Hide Banking, reorder it in either interface, publish, reload, switch language: Banking remains hidden and Telecom remains visible. Deleting a preceding entry must also preserve the correct hidden item.

Source: [industry mutations](../../js/admin.js:522).

![Telecom incorrectly removed while Banking is visible after reordering](screenshots/18-wrong-industry-hidden.png)

### 2. High — Invalid brand colours can be published and break public controls

**Reproduction:** Advanced → Design → enter `not-a-color` in the Signal text field → Save & publish.

**Observed:** A green “Published. The live site is updated.” message appears. The value remains in the field and reaches the public `--signal` custom property. The primary call-to-action loses its coloured background and becomes difficult to read against the dark hero.

**Impact:** A typo in a settings field can damage the public site's appearance. The success message gives the admin no indication that the setting is invalid.

**Fix:** Validate these four colour inputs before saving and validate their values on the server. The visible fields should accept a documented colour format, retain the last valid value on rejection, and show an inline error. Ordinary users already have safer complete design presets in the on-page editor.

**Acceptance:** Invalid text never reaches published tokens; valid colours and reset still work; an invalid field is focused and explained.

Sources: [colour handler](../../js/admin.js:341), [server token normalization](../../server.js:443).

![Invalid colour retained alongside a successful publication message and damaged preview](screenshots/20-invalid-colour.png)

### 3. Medium — Move to… can silently place content in a section hidden from visitors

**Reproduction:** Select a visible paragraph → Move to… → Section 2 → Bottom of section → Move here → publish.

**Observed:** The destination is the logos/proof section, `index.s1`. Its proof gate is off. The paragraph exists in the published DOM but is invisible because its section has `display:none`. Neither the destination list nor confirmation explains this. “Section 2” and “Section 5” also give little help identifying the destination.

**Impact:** An admin can complete a successful move and unintentionally remove visible content from the public page.

**Fix:** Use meaningful section names such as “Client logos.” Mark every destination's actual public visibility, including proof-gated sections. Explain the outcome before confirming a move into a hidden destination. Preserve the existing placement, hidden-section and commit machinery.

**Acceptance:** A hidden destination is clearly labelled; confirmation says visitors will not see the content; visible destinations remain easy to choose. Test both hidden-section and proof-gated cases on desktop and mobile.

Sources: [destination labels](../../js/editor.js:866), [Move to flow](../../js/editor.js:903).

![Move destinations include vague names and no hidden-state explanation](screenshots/35-move-destinations.png)

### 4. Medium — Pending invitations cannot be cancelled from the user panel

**Reproduction:** Users → invite someone → inspect the new invited user's controls.

**Observed:** The pending user has a role selector and Resend invitation. There is no Cancel invitation or Disable access action until the user is active. This was checked with a fresh pending account and again after resending its invitation.

**Impact:** If an admin invites the wrong address or changes their mind, the ordinary UI cannot revoke that outstanding invitation before it expires. This matters especially for Admin invitations.

**Fix:** Add “Cancel invitation” using the existing user-status/recovery invalidation machinery, with a clear confirmation. The server already has user status updates; a parallel invitation subsystem is unnecessary.

**Acceptance:** A cancelled invitation cannot set a password or activate access. The UI shows the new state and gives a deliberate route to invite the person again.

Source: [user access actions](../../js/editor.js:724).

![Pending invited account offers Resend but no cancellation control](screenshots/50-pending-invitation.png)

### 5. Medium — Leaving translation search can throw an application exception

**Reproduction:** Advanced → Text & translations → enter a search, then switch to another dashboard tab while the search's delayed redraw is pending.

**Observed:** Reproduced twice during this audit:

```text
TypeError: Cannot read properties of null (reading 'value')
    at draw (js/admin.js:368:32)
    at js/admin.js:16:122
```

The delayed callback looks for search controls after the panel has been replaced. The destination panel remained usable in these reproductions; a full dashboard lock-up was not observed.

**Fix:** Cancel pending search callbacks when leaving the tab, or scope and guard them against the original mounted panel. Avoid independent delayed input/change redraws that survive navigation.

**Acceptance:** Type in search and immediately switch tabs repeatedly; there are no exceptions or delayed mutations of the new panel. Translation editing and filters still work.

Sources: [draw function](../../js/admin.js:367), [debounced listeners](../../js/admin.js:388). Captured exception evidence: [errors.json](errors.json).

### 6. Low — Preview offers Copy/Open controls when there is no link

**Reproduction:** Open Preview with no active link, or revoke the active link. Click Copy link.

**Observed:** The empty URL box and both actions remain visible. Copy changes to “Copied” and reports “Preview link copied,” although the value is empty. Open preview has no usable destination. The wrapper has `hidden=true`, but its computed display is `grid`.

**Cause:** The `.omni-preview-link` display rule overrides the browser's hidden presentation. The copy handler also lacks an empty-value guard.

**Fix:** Ensure the hidden wrapper actually stays hidden and independently disable/guard Copy and Open unless a usable URL exists.

**Acceptance:** With no link, only the explanation and Create action are available. Create, replace, copy and revoke all update both visual and accessible state.

Sources: [preview CSS](../../css/editor.css:205), [copy handler](../../js/editor.js:714).

![No active preview link, yet the empty field reports Copied](screenshots/48-preview-empty-copied.png)

## What works

1. **Sign-in and accounts — working in tested paths.** Empty/wrong-password feedback, Show/Hide, recovery-email saving, password validation/change, invitation acceptance, Admin/Editor role separation, role changes, disable/restore and sign-out were exercised. Editor access to the advanced dashboard is denied. Invitations and notification tests were delivered to the local mock service.
2. **Normal editing — working, with the placement caveat above.** Text edits, removal/restoration, additions, link validation and button styles work. Native dragging produced drop zones and successfully moved an added paragraph below the main heading. Undo/Redo, Alt+Up/Down, mobile Move to, long-press and horizontal row drops are covered by the current interactive run and/or fresh browser suites.
3. **Drafts and publishing — working in tested paths.** Review/cancel/publish, draft discard, private preview creation/replacement/revocation, and History → Restore into draft work. The fresh regression suites also pass conflict, recovery and published-state checks. The incorrect advanced reorder and colour publication are specific exceptions.
4. **Images — working in tested paths.** Real file input upload, image conversion, rename, description, focal crop, Apply, Remove from this use, search/empty results, and confirmed library deletion work. The suites also cover invalid input, multiple-file slot drops, role restrictions and in-use deletion protection.
5. **Enquiries — working in tested paths.** Tested with 28 synthetic enquiries: search, clear, type filters, refresh, next/previous pages, details, read/unread state, filtered CSV, individual delete cancellation/confirmation, and delete-all cancellation/confirmation. CSV filtering was verified against the downloaded blob. Delete all explicitly warns that filtered-out records are included.
6. **Settings and maintenance — mostly working.** The three settings categories and field explanations are useful. Invalid email is rejected in both interfaces. All nine advanced tabs opened. Colour resets, translation filtering/reset, catalogue additions/reordering, page settings, configuration export, invalid/valid import, reset confirmation and discard were exercised. See the six findings for exceptions.

Evidence of successful flows: [native drag result](screenshots/42-native-drag-success.png), [mobile image details](screenshots/33-image-details-mobile.png), [mobile enquiry details](screenshots/31-mobile-enquiry-detail.png), [confirmed enquiry cleanup](screenshots/52-cleared-enquiries.png).

## Make it easier for the admin

Keep the present three settings categories: **Website details, Enquiry emails, Account**. They are understandable and do not need another redesign.

- Make the on-page editor the single normal editing route. Keep maintenance for import/export and genuinely necessary bulk work; duplicated colour/catalogue controls should either share the exact same rules or be removed from the secondary UI.
- Fix the visibility/colour issues before adding more settings. More options would increase the chance of inconsistent changes.
- Add useful destination names and visibility explanations to Move to. Keep drag as a shortcut; the explicit Move to flow is valuable on phones and for keyboard users.
- Keep one description per field. The image description currently has two overlapping help paragraphs.
- Standardize destructive wording. Editor Remove is reversible hiding; advanced service/industry deletion splices the list without an individual confirmation or Undo. This distinction should be explicit, or the controls should share one consistent removal flow.
- Consider marking newly added placeholder content and unset button destinations in review. Repeated Add service currently allows two “New service” entries to be published. This is a usability guardrail recommendation, not proof that intentional duplicate labels should be forbidden.

## Accessibility and mobile observations

The fresh regression suite verifies several focus-return, modal containment, protected-control and touch-target cases. Field explanations are linked to inputs, mobile panels fit the viewport in the examined states, and the native keyboard actions above were exercised.

Further polish is needed: the mobile inbox's Refresh/Previous/Next controls look like small native buttons; user-facing move names should be clearer; duplicate media help increases reading effort; the advanced mobile navigation remains expanded after selecting a tab. These are secondary observations, not a complete accessibility conformance assessment.

## Coverage limits

This is a broad action-family audit, **not a claim that every duplicate button on every page, every destination combination or every language permutation was clicked**. The detailed click selector inventory is in [CONTROL-LOG.md](CONTROL-LOG.md); the flow matrix is in [COVERAGE.md](COVERAGE.md).

- External email delivery, recipient inbox arrival, real mail-client Reply handling and external booking/social destinations were not exercised against live services. No messages were sent to real people.
- The fixture inherits `siteUrl=https://www.omnimark.com`; generated invitation/preview URLs use that configured origin. Mock invitation tokens and browser-suite preview tokens were exercised locally. The actual external origin was not opened with these tokens. Deployment must provide the correct public origin; this audit does not establish that live hosting is configured correctly.
- Existing browser suites sometimes dispatch DOM actions directly. The extra pass used native mouse clicks and keyboard input; file selection used CDP and some native selects used change events. The initial native drag attempts needed extra pointer movement to produce Chromium dragover; the completed drag emitted drop and updated placement successfully.
- Timing/navigation retries and invalid audit selectors were not counted as product failures. The two recorded `draw()` exceptions originated in application code and are a confirmed finding.
- No real-device Safari/Firefox, screen reader session, full contrast scan, production load test or complete security penetration test was performed.

## Validation files

- [npm test log](npm-test.log): 235 passed, 0 failed.
- [npm run test:browser log](npm-browser.log): 169 browser checks and 86 regression checks passed.
- [Counts and audited revision](verification.json).
- [Interactive action log](actions.json), [clicked control inventory](CONTROL-LOG.md), [application exceptions](errors.json).
- [Audit session harness](session.cjs). Uses a disposable fixture and local mock email only.

No implementation fixes or commit were made as part of this audit.
