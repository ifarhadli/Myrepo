**OmniMark admin dashboard — functional and logical audit, 7 September 2026**

This document records the pre-fix baseline. See the
[implementation follow-up](ADMIN-FIXES-2026-09-07.md) for subsequent fixes,
the simplified Settings interface, verification and remaining limits.

**Verdict: the core product works, but important editing and publishing safeguards are unreliable.** The on-page editor is more complete than the advanced dashboard. Routine single-user operations often succeed; repeated catalogue actions, concurrent editing, recovery, and slow saves can produce duplicate changes or lose work. Fix those before expanding the dashboard.

This is an audit of the current local implementation, not a certification of the deployed site. No application fixes were made. All test writes used temporary copies, synthetic accounts and synthetic leads. No real leads were removed, no real site was published, and no external email was sent by the audit.

**Evidence and scope**

- `npm test`: **189 passed, 0 failed**, including script syntax checks.
- `npm run test:browser`: **102 passed, 0 failed** in Chromium.
- Premium static audit, strict mode: **0 findings**. This did not detect the behavioral failures below.
- Additional browser/API probes reproduced the failures below. Two concurrent clients were simulated through separate configuration snapshots; the publish race was exercised by advancing the server draft between save and publish. A delayed browser response was used for the save-in-progress check. Local recovery used a synthetic browser draft whose timestamp was newer but whose revision was older than the shared draft.
- Desktop at 1440 × 900, existing browser coverage at 1366 px, and narrow screens at 390 px. Screenshot files were opened and inspected during this audit. External fonts were blocked in the harness, so typography uses the application's fallbacks.
- Reviewed `admin.html`, `admin-advanced.html`, `js/admin.js`, `js/editor.js`, relevant server routes, `DESIGN.md`, `UX-CONTRACT.md`, and current test behavior.
- The built-in in-app browser execution tool was unavailable; the audit used isolated Chromium through the same native debugging protocol as the repository's browser tests.

Evidence: [server log](admin-audit-server-test.log), [browser log](admin-audit-browser-test.log), [static log](admin-audit-static.log), [primary probe results](admin-2026-09-07/results.json), [additional probe results](admin-2026-09-07-extra/results.json), [reproducible audit harness](run-admin-audit.cjs).

Run the extra probes in PowerShell with `$env:AUDIT_EXTRA='1'; node audit/run-admin-audit.cjs`; remove that variable to run the primary probes. Probes deliberately demonstrate defects and record observations; they are not a passing regression-test suite. Temporary fixtures are retained for inspection and their locations are printed in the logs.

**Flow coverage and health**

| Step | Surface / task | Health | Evidence |
|---|---|---|---|
| 1 | Sign in, recovery, access control | Working in tested paths; no editor sign-out control | Screenshot 01; authentication and role integration/browser checks |
| 2 | Overview and launch readiness | Partially useful; checklist is incomplete and contains obsolete guidance | Screenshot 02; F14–F15 |
| 3 | Design and live preview | Editing works; initial preview destination is mislabeled | Screenshot 24; F12 |
| 4 | Copy and translations | EN/AZ editing, search and reset exist; weak publishing recovery | Screenshot 04; F2–F5 |
| 5 | Services catalogue | Broken on repeated add/re-render operations | Screenshot 21; F1 |
| 6 | Industries | Broken on repeated add/re-render operations | Screenshot 06; F1 |
| 7 | Pages and SEO | Basic edits work; long undifferentiated list and legacy metadata overlap | Screenshot 07; page SEO browser checks; F15 |
| 8 | Site settings | Controls work, but invalid contact email can be published | Screenshot 11; F7 |
| 9 | Submissions and export | Leads load; deletion, export scope and spreadsheet handling have defects | Screenshot 12; F1, F6, F8–F9 |
| 10 | Account, import and backup | Password flow works; import keyboard access and backup completeness are limited | Screenshot 10; F13, F16 |
| 11 | On-page edit, autosave, undo and recovery | Happy paths pass; stale local recovery and error classification fail | Screenshot 18; F3, F11 |
| 12 | Media and collection lifecycle | Upload, variants, focal point, alt checks and case lifecycle pass | Current-run media and collection browser checks |
| 13 | Publish, history and private preview | Happy paths pass; publish has a revision race | Current-run publish screenshot; F2–F4 |
| 14 | Inbox, notifications and users | Read state, reply link and roles work; triage and delivery monitoring are incomplete | Inbox/account/user browser checks; F10, F17–F18 |
| 15 | Narrow-screen administration | On-page controls adapt well; advanced navigation consumes much of the screen | Screenshots 14 and 20 |

**What is already working and should be kept**

The on-page editing model is useful: owners edit real pages, drafts remain separate from live content, EN and AZ changes remain independent, undo/redo works, and hidden sections remain discoverable in edit mode. Normal autosave, reload recovery, publish, discard and page switching pass the existing browser checks.

Media is substantially implemented: browser-generated responsive variants, upload progress, focal positioning, keyboard sliders, alt text, and prevention of deleting in-use images. A case can be created as a draft, edited in both languages, assigned media, published to a real route, and unpublished from its route and listing.

Access controls are real server checks. Tested cases reject Editor access to advanced settings, user management and media deletion; reject protected settings smuggled through draft requests; invalidate sessions after access changes; and prevent removing the last administrator. Password recovery and invitation token lifecycles are covered with a local email stub. This is useful coverage, not a penetration-test claim.

The editor's owned confirmation dialogs, keyboard focus restoration, mobile action sheets, image controls and three-action mobile dock are worth preserving. Private previews expire, can be revoked, are visibly non-live, and suppress indexing and form submission in tested paths.

**Highest-priority defects — fix before relying on routine administration**

**F1 — High: repeated actions install more handlers and mutate more than one item.**

Reproduction: open Services and click its first Add service twice. The group went from **6 → 7 → 9** services. Industries went **11 → 12 → 14**. Revisit Submissions and delete one lead: one click produced **three DELETE requests** in the probe.

The reused `#panel` gets additional delegated listeners every time a renderer runs. Replacing its children does not remove those listeners. Services and Industries also re-render from inside their own action handlers, so the problem grows during a normal editing session. Adjacent-row deletion and repeated reordering are consequently at risk as well; the exact multi-row deletion case was not executed.

Source: [tab rendering](../js/admin.js#L297), [service listeners](../js/admin.js#L536), [industry listeners](../js/admin.js#L597), [submission listener](../js/admin.js#L729). Fix by giving handlers one owner: bind once, replace the panel itself, or explicitly dispose listeners before rendering. Acceptance: repeated visits and 20 consecutive actions each cause exactly one intended mutation/request.

![Two Add service clicks created three New service rows](admin-2026-09-07-extra/screenshots/21-duplicate-services.png)

**F2 — High: advanced-dashboard saves silently overwrite newer live changes.**

Two clients loaded the same config. A changed the site name and saved. B changed only the phone and saved its older snapshot. Both returned **200**, and A's site name reverted. The server checks for an editor draft but does not compare the advanced client's live revision with the current live revision.

Source: [advanced save endpoint](../server.js#L1321), [client save](../js/admin.js#L796). Add a live revision precondition to all direct publishes, return a conflict instead of overwriting, and show the changed fields before an explicit replacement. Acceptance: stale B cannot silently revert A.

**F3 — High: restored local drafts bypass the existing shared-draft conflict protection.**

The browser had local revision 0 and the server had another editor's revision 1. Reload selected the local draft by timestamp but assigned it the server's revision 1. No conflict dialog appeared. The next autosave overwrote the colleague's change and became revision 2.

Source: [local persistence](../js/editor.js#L97), [boot and recovery](../js/editor.js#L803). Recover local content with its own revision and live-base metadata. Present a comparison or recovery choice when it differs from the shared draft; do not relabel it as current. Acceptance: an old local copy cannot overwrite a newer shared draft without resolving the conflict.

**F4 — High: Publish does not verify the exact shared draft being approved.**

The probe saved A as revision 1, then B as revision 2, then published while supplying A's revision 1. The server returned **200** and published B's text. The real editor performs save and publish as separate requests, leaving this interleaving possible. The publish endpoint checks the live base, but ignores a reviewed draft revision.

Source: [publish endpoint](../server.js#L1378), [editor publish sequence](../js/editor.js#L740). Require the reviewed/saved draft revision in Publish and check it immediately before committing. Apply equivalent version checks to shared-history restoration, whose endpoint currently also replaces the draft without a client revision check. Acceptance: changes made after review force another review.

**F5 — High: edits made while an advanced publish is pending are lost.**

With the save response delayed, edit the phone while the request is pending. When it resolves, the phone input still displays the new text, but the server retains the old phone, the dirty indicator is empty and Save is disabled. The response replaces both saved state and current editable state without preserving later input.

Source: [save response handling](../js/admin.js#L796). Keep the submitted snapshot separate from edits made afterward, or consistently disable editing until the save finishes. Acceptance: the later edit remains visibly unsaved, or could never be entered during the request.

![Phone input shows a value that was not saved, while Save is disabled](admin-2026-09-07-extra/screenshots/23-edit-lost-during-save.png)

**F6 — High: individual lead deletion is immediate and irreversible.**

Clicking the small × in advanced Submissions deleted the record with **no open confirmation dialog**. There is no undo. The on-page Inbox correctly uses an owned confirmation for the equivalent action. The existing browser test named “destructive admin actions use the owned confirmation dialog” does not establish coverage for this row action.

Source: [row delete](../js/admin.js#L729), [safer Inbox deletion](../js/editor.js#L563). Reuse the Inbox confirmation, name the lead, disable the action while pending and restore focus afterward. Acceptance: Cancel makes no request, confirmation makes one request, and an API failure preserves the row.

**Other confirmed defects and important gaps**

| ID / priority | Finding and evidence | Recommended correction |
|---|---|---|
| F7 / Medium | **Invalid contact email publishes successfully.** Entered `definitely-not-an-email`; it was stored and the UI announced publication, without marking the field invalid. [Server settings validation](../server.js#L418) only bounds this string; the settings panel is not validated as a form before save. | Validate email and other typed configuration fields on both client and server. Return linked field errors. Avoid silently sanitizing an entered value into a different successful result. |
| F8 / Medium | **Export ignores the visible filter.** With Newsletter selected and 1 visible row, CSV contained both newsletter and contact records. After deleting the newsletter, the empty state said “Nothing here yet” while a contact still existed; Export and Delete all remained available. [Submissions](../js/admin.js#L694) | Define export and deletion scope explicitly: “Export filtered (1)” / “Export all (2)”. Use a true no-results state and expose global deletion away from filtered row actions. |
| F9 / Medium | **CSV preserves user input as spreadsheet formulas.** A synthetic contact name `=1+1` appeared unchanged in exported CSV. Quoting CSV cells does not make their values literal spreadsheet text. Both exporters lack formula-prefix handling. [Advanced exporter](../js/admin.js#L713), [editor exporter](../js/editor.js#L557) | Export untrusted values as literal text using a documented spreadsheet-safe policy; preserve the original stored submission. The audit verified CSV bytes, not execution in Excel. |
| F10 / Medium | **No Sign out or Exit editor action in the on-page editor.** Desktop toolbar, More and Settings contain neither. Advanced has Sign out, but Editor-role users cannot access that dashboard. | Add a role-independent account menu with identity, Sign out and View live site. Preserve drafts through the exit flow. |
| F11 / Medium | **Server validation failures are labeled Offline.** A deliberately invalid duplicate collection record caused a validation rejection, yet the toolbar said “Offline — changes kept locally.” [Error handler](../js/editor.js#L119) | Distinguish offline/network errors, validation, permission denial, expired sessions and conflicts. Name the invalid item/field and offer an appropriate recovery action. This was a fault-path probe, not a claim that the normal New case button creates duplicate IDs. |
| F12 / Medium | **Design's initial page selection does not match its preview.** Selector says About (`about.html`), iframe loads Home (`index.html`). Captured after animation settled. [Design renderer](../js/admin.js#L392) | Initialize selector and iframe from one chosen page. Reload must preserve that selection. |
| F13 / Medium | **Import JSON is unreachable with normal keyboard tabbing.** The styled label has `tabIndex=-1`, no button semantics, and its file input is hidden. [Import control](../js/admin.js#L747) | Use a real keyboard-operable button connected to the file chooser. Verify Enter/Space, cancel and error feedback. |
| F14 / Medium | **Launch checklist misses absent legal links.** It tests Privacy/Terms only for `'#'`; both defaults are empty. Screenshot 02 contains no legal-link task. [Checklist](../js/admin.js#L310) | Detect blank and placeholder values. Separate required owner setup, optional enhancements and operational failures. This is an internal consistency finding, not a legal compliance determination. |
| F15 / Medium | **Global Article/JobPosting fields are misleading for the collection model.** The dashboard asks for a global article author/date, although collection detail schema uses each item's metadata; global article fallback applies only with no article items. Jobs have a similar legacy branch. [Schema routing](../server.js#L985) | Hide legacy fields when collections are active. Direct article/job editing to its owning item. Keep organization metadata in site settings. |
| F16 / Medium | **“Backup & restore” exports configuration only.** It does not include uploaded image bytes, leads, accounts, notification recipients or history. Media IDs in imported config are insufficient to migrate the library. The UI does say configuration, but the broader section name can be mistaken for full recovery. [Export](../js/admin.js#L770) | Rename to “Export/import site configuration”; document exclusions beside the controls. Add a separate complete operational backup and demonstrate restore into an empty instance. |
| F17 / Medium | **Inbox capacity and retention have no deliberate user workflow.** Both surfaces render the entire loaded lead dataset. The server silently removes oldest records beyond **10,000**; no archive or capacity warning accompanies that limit. [Retention code](../server.js#L1202) | Add paginated retrieval, search, form/read filters, clear totals and deliberate archive/retention handling. The 10,000-record boundary is source-confirmed, not a load-test result. |
| F18 / Medium | **Notification configuration is not delivery monitoring.** Leads are stored before notifications dispatch, which is good; delivery failures go to server logs. There is no durable retry queue or per-lead delivery status. The Overview wording “Every submission is forwarded” is stronger than this implementation guarantees. [Notification dispatch](../server.js#L882) | Show configured/attempted/sent/failed separately. Persist delivery attempts and add controlled retry with duplicate protection. Real provider delivery and process-crash recovery were not tested. |

![Invalid email stored with a successful publish message](admin-2026-09-07/screenshots/11-invalid-email-published.png)

![Filtered submissions show 1 row while the badge indicates 2 total records](admin-2026-09-07/screenshots/12-filtered-submissions.png)

![Design selector says About while the iframe displays Home](admin-2026-09-07-extra/screenshots/24-design-preview.png)

**What is unnecessary or should be moved out of the everyday workflow**

| Current element | Assessment | Better placement / replacement |
|---|---|---|
| Two independent publishing models | Main source of confusing draft ownership and conflict behavior | Keep the editor as the normal authoring workflow. Route advanced configuration through the same draft/review/version system. Retain developer-only controls where needed. |
| Copy overrides as a headline KPI | Counts implementation details rather than work requiring attention | Replace with unread leads, draft owner/age, unpublished changes and failed operations. |
| Long “How this works” and deployment instructions on Overview | Useful documentation, costly permanent dashboard space | Move into contextual help or an initial setup view. |
| Global article/job metadata | Mostly legacy alongside item collections | Hide when inapplicable; edit metadata on each article or job. |
| Custom CSS, raw tag snippets, individual motion toggles and many color tokens | Useful specialist controls; too much everyday configuration | Put under clearly marked advanced settings. Keep common brand presets and a simple motion preference in the primary editor. |
| Separate address and phone representations without assistance | Easy to create inconsistent contact information | Derive defaults from structured fields, with explicit overrides when necessary. |
| A separate Industries navigation destination | Currently a short bilingual label list; every entry shares one destination | Group under Content/Catalogue unless distinct industry pages and metadata are required. Do not automatically remove the existing public links. |
| Reset everything near routine backup actions | Broad action with little contextual explanation of collection/image assignment effects | Move to a maintenance area and show a concrete reset summary before publication. |

Do not add revenue charts, campaign analytics, a full CRM, AI writing, scheduling or a bulk email sender just to make the dashboard look complete. Those need an actual workflow and trustworthy data source. This product's immediate job is safe website publishing and reliable enquiry handling.

**What should be added**

1. **One reliable change lifecycle:** explicit Live / Shared draft / Local recovery status, author and revision, a readable before/after review, and version checks on save, publish, restore and discard.
2. **A useful Overview:** unread enquiries, oldest unhandled enquiry, latest publish with actor, current shared draft, failed notification attempts, and actionable setup checks. Each item should link to the work that resolves it.
3. **A modest lead workflow:** search, form/read filters, pagination, refresh, reply link, and optional New / Contacted / Closed status if the owner needs follow-up tracking. Treat ownership and retention as product decisions, not inferred policies.
4. **An account menu on every admin surface:** current user, role, password/account access where permitted, view live and sign out.
5. **Recoverable saves:** field-level validation, stable busy controls, meaningful offline/conflict/session messages, local export of unresolved work, and no loss of newer edits when a response arrives.
6. **Backup and operational status:** clearly scoped configuration export plus a separate tested full restore, storage capacity, and notification delivery records.
7. **Content organization:** a searchable page/content list with type, language completeness and publication status; deep links into the existing on-page editor. Improve the existing CMS before adding another editor.
8. **Accessible editing utilities:** keyboard-accessible import, visible clear search controls, explicit names for row actions, and stable focus after Inbox read/delete re-renders.

**UX, accessibility and responsive assessment**

The visual system is coherent: a clear admin sidebar, restrained forms and a distinct public-site editor rail. Desktop pages generally fit the viewport, and the editor's mobile More menu is organized and usable. Existing tests verify modal focus trapping/restoration, keyboard reachability of toolbar actions, touch action sheets, validation on supported forms and 390 px layouts.

The advanced dashboard is excessively long in Copy, Services, Pages and Settings. In this fixture Copy renders **450 strings / roughly 900 textareas**, Services creates **280 input/textarea controls** across its collapsed groups, and Pages exposes **90 inputs/controls**. Those are DOM inventory counts, not a measured performance failure. Start from a chosen page or group and provide meaningful status and search.

On 390 px advanced Submissions, navigation occupies roughly the upper 380 px before the content heading. Collapse it into an accessible menu. The editor's three-action dock is a better narrow-screen pattern. Neither needs a visual redesign to fix its business logic.

Confirmed accessibility gap: keyboard-inaccessible import. Other risks visible in the implementation are terse ×/arrow action names, tiny utility text, unclear per-row unread status before expansion, and focus dropping when the Inbox completely rebuilds after Mark read. Verify these with keyboard and assistive technology before claiming conformance. The product can edit Azerbaijani content, but its administration chrome remains English; decide whether administrator localization is a requirement.

Not tested: a screen reader, real iOS/Android keyboards, a complete 200% zoom matrix, cross-browser assistive-technology behavior, color changes across every owner-configurable theme, production load, deployed HTTPS/proxy settings, real mailbox deliverability, full backup recovery or a comprehensive security assessment. Existing simulated mobile checks do not establish all of these.

**Implementation order and release criteria**

| Order | Work | Completion evidence |
|---|---|---|
| 1 | F1–F6: duplicate actions and data-loss protection | Repeated-action tests; two-client stale writes; stale local recovery; publish interleaving; delayed save with new input; single-delete cancel/failure/success |
| 2 | F7–F13: validation, export, account exit, error recovery, preview and keyboard import | Bad data rejected with field feedback; exact export scope; literal spreadsheet values; every role can sign out; errors identify their cause; keyboard-only import |
| 3 | F14–F18: setup, schema ownership, backup, lead capacity and delivery | Checklist reflects real config; item schema has one owner; restore demonstration; pagination/capacity behavior; observable and retryable delivery |
| 4 | Simplify daily navigation and add task-oriented Overview | Owners can identify pending work and reach it without developer knowledge; verify against representative tasks and both viewport sizes |

The regression tests should assert actual user outcomes. A broad passing test named “destructive actions use a dialog” is insufficient if a destructive row button is not exercised. Static audit success and the current 291 passing checks are a good foundation, but they do not cover the reproduced failure modes.

**Inspected screen sequence**

1. Sign in: clear entry, recovery and advanced link. Password/recovery checks pass; sign-out is absent in the editor destination.

![Sign-in screen](admin-2026-09-07/screenshots/01-sign-in.png)

2. Overview: working layout; technical documentation dominates and the launch checks miss blank legal links.

![Overview and launch checklist](admin-2026-09-07/screenshots/02-overview.png)

3. Design: see screenshot 24 above for the preview mismatch. The controls render and live design mutation tests pass.

4. Copy and translations: bilingual columns and filters work; the initial view renders the complete dictionary rather than starting from a page task.

![Copy and translations](admin-2026-09-07/screenshots/04-content.png)

5. Services: see screenshot 21 above. Repeated creation is broken despite correctly paired EN/AZ inputs.

6. Industries: readable paired list, but repeated creation is also broken.

![Industries](admin-2026-09-07/screenshots/06-industries.png)

7. Pages and SEO: basic controls and section visibility exist; page filenames, template entries and long scrolling make task selection harder.

![Pages and SEO](admin-2026-09-07/screenshots/07-pages.png)

8. Settings: see screenshot 11 above for invalid email publication; normal fields and feature controls render correctly.

9. Submissions: see screenshot 12 above; reading works, while deletion and CSV scope need correction.

10. Account and backup: password fields are masked and can be revealed. Import needs keyboard support and backup scope needs clearer separation.

![Account and backup](admin-2026-09-07/screenshots/10-account.png)

11. Editor save failure: toolbar incorrectly calls a server validation rejection an offline state.

![Editor shows Offline for invalid draft data](admin-2026-09-07/screenshots/18-editor-save-error.png)

12. Media and collection workflow: responsive uploads, metadata and focal controls pass current-run tests. This screenshot shows the media detail panel scrolled to its focal controls; it is not a full view of the upload/library top section.

![Media details and focal controls](final/screenshots/editor-media-1366.png)

13. Publish: a readable modal and cancel action exist. Counts describe categories but do not show exact before/after changes; revision binding remains missing.

![Mobile publish review](final/screenshots/editor-publish-390.png)

14. Operations: account and notification controls are in the editor Settings sheet. Inbox read/reply and invitation/role behavior were exercised by current-run tests; dedicated invitation/role screenshots were not captured, so those findings are test-backed rather than visually audited screen states.

![Editor Settings](admin-2026-09-07/screenshots/16-editor-settings.png)

15. Narrow screens: advanced navigation takes substantial vertical space; the editor menu is much more focused but lacks sign-out.

![Advanced dashboard at 390 pixels](admin-2026-09-07/screenshots/14-advanced-mobile.png)

![On-page editor menu at 390 pixels](admin-2026-09-07/screenshots/20-mobile-menu.png)

Recommended next step: fix F1–F6, add focused regression coverage for the reproduced failures, then simplify the two publishing workflows around the shared draft model.
