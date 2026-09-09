# Owner editor simplification plan

Status: revised after owner review. Stage 1 is authorized as one commit; later
stages remain proposals for review. The implementation keeps local drag.

## Objective

Make routine website maintenance understandable to a nontechnical owner: select content, make a meaningful change, review it, and publish deliberately. Make occasional ordering possible using clear click/tap actions. Reduce layout decisions that the current drag interface exposes without reliably explaining them.

This builds on the existing editor and [research report](audit/ADMIN-EDITOR-RESEARCH-2026-09-09.md). It is not a new dashboard, CMS migration, public-site redesign, or unrestricted page builder. Current working behaviors are the starting point; an item described below may need verification rather than reimplementation.

## 1. Establish the baseline before changing behavior

- Record the implementation revision and run `npm test` and `npm run test:browser`. Report any existing failure before attributing it to the new work.
- Use isolated test data for edits and publishing exercises. Capture representative desktop and narrow-screen editor states, plus the same pages outside edit mode.
- Inventory whole-section, repeated-item, collection, and arbitrary-element movement separately. Map their controls, touch gestures, keyboard shortcuts, guidance, ordering stores, and tests.
- Make a compatibility fixture containing authored and added content, existing cross-section placements, custom links/styles, hidden content, and English/Azerbaijani text. Include a historical configuration that can be restored through the existing history flow.
- Record existing destinations that the owner genuinely needs. If a useful operation has no suitable replacement, resolve it before retiring its control. Do not assume every old movement capability is needed merely because it exists.

Opening the new editor must not change the website or create a dirty draft on its own. Comparison must cover rendered output and content/order/placement data; expected save metadata such as a revision timestamp is treated separately.

## 2. Define the everyday control set

| Selected content | Main actions | Ordering policy |
|---|---|---|
| Text or heading | Edit text; existing appropriate formatting | Supported positions in the current section; protected headings stay fixed. |
| Button | Edit label and link together; existing approved styles | Reorder in a row or move between supported blocks within its section. |
| Image | Choose/upload, description, crop/focal point, Apply | Replace the image within its existing position. |
| Service, industry, FAQ, step, other supported repeated item | Edit; Add item; existing hide/remove/restore actions | Earlier/later within its own list. |
| Whole page section | Edit content; show/hide; inspect status | Move up/down within the existing permitted section sequence. |
| Case study, article, job, other collection record | Existing record details and publishing actions | Retain the collection's established sorting and manual ordering capabilities. |
| Existing added or relocated element | Edit text/media/link/style where supported; existing removal and recovery | Preserve old placements and allow supported movement within its current section. |
| Header, footer, protected form structure | Existing permitted content changes | Respect existing structural boundaries. |

Every action must correspond to a supported operation. A collection sorted by publication date must not display arrows implying an unrelated manual order. Existing added elements must remain manageable even when their creation or relocation shortcut is no longer shown in normal controls.

## 3. Give sections one understandable ordering location

Extend the existing **This page** panel with **Page sections**. Keep page search/sharing settings in that same established panel; do not add a second page-management screen.

- Show human section names, for example Introduction, Services, Industries, Results, Contact. Resolve names through maintained labels or visible content, never raw selector IDs.
- Selecting a section identifies it in the preview. Keep keyboard focus in the panel when appropriate; do not force a jump for every reorder.
- Provide labelled Move up and Move down buttons. Disable unavailable boundary moves; explain other restrictions when necessary.
- Keep existing useful contextual section arrows as shortcuts, backed by the same operation. The panel and on-page controls must agree.
- Keep hidden sections discoverable with Restore. Identify visibility restrictions accurately, including manual hiding and existing approval requirements.
- A move updates the draft immediately and offers existing Undo. Keep selection, panel state, and scroll stable. No confirmation dialog for each reversible reorder.
- Only add a whole-section **Place before…** selector if testing shows that long pages make repeated arrows burdensome. This is not required for the first release.

Mobile uses the existing sheet components and the same actions. No long press is needed to discover or complete ordering.

## 4. Make repeated content easy to manage

Reuse the current owning list and item actions. Use names such as **Add service**, **Add industry**, and **Add question** where those content types already exist.

- An added item enters its own list at a predictable position and opens its relevant fields. If an existing Add below action identifies a specific position, preserve that clarity.
- Use **Earlier in list / Later in list** for wrapping chips or grids, where a visual left/right/up/down description could mislead on another screen width.
- Keep empty lists recoverable with a visible Add action.
- Preserve translation associations, links, hidden states, and shared-catalogue relationships when items move.
- Keep collection creation, duplication, publication status, and record editing through their existing owners. Do not turn collection records into loose page elements.
- Review generic Add choices in context. Show only supported, useful choices and retain existing valid additions. Do not invent new schemas or delete old content to shorten a menu.

## 5. Keep local drag and retire cross-section element movement

Keep dragging for whole-section ordering, list/grid ordering, and supported element placement within the current section. Preserve the fixed left/right drop geometry. A hero button may leave its button row and move above the hero paragraph: the section, not the row, is the outer movement boundary. Existing authored compatibility rules still apply.

- Generate only relevant compatible drop zones in the current section. Keep handles, indicators, cancellation and auto-scroll for supported dragging.
- Remove arbitrary element-level **Move to…** from normal toolbars and action sheets. Moving a paragraph between unrelated sections is outside the everyday workflow.
- Offer Earlier/Later directly on selected elements and in their phone action sheet. Prefer adjacent positions in the same list/row, then supported positions in the same section. Disable unavailable directions. Alt+Up/Down uses the same operation and preserves normal text-input keys.
- Keep ordinary text selection, page scrolling, and browser-native behavior working.
- Preserve image file drop and the file chooser. Dropping a file into an upload target is a different task from moving page content.
- Do not add a new “Enable drag” owner setting. Observe the corrected dragging in real editing sessions before considering any further removal.

Page sections, local click/tap alternatives and removal of generic cross-section destinations ship together in the first behavior commit. The Page sections panel does not replace item movement on phones; Earlier/Later must work in that same commit.

## 6. Refine contextual editing and image handling conservatively

Keep the established first-click selection and explicit Edit text/second-click behavior unless testing identifies a specific problem. Avoid retraining the owner through a new click model in the movement-simplification change.

One selected object should have one coherent set of relevant actions. Inspect small industry chips, logos, and nested content so duplicate toolbars do not overlap text or cover each other. Essential actions must be available by keyboard and touch, with hover only enhancing discovery.

Preserve the current image workflow: choose/upload, describe, inspect crop/focal point, **Apply image**. Cancelling must leave the page assignment unchanged. Upload failure must retain context and explain recovery. Preserve existing media-library permission checks and usage checks. An upload that completes does not imply that the page image has been applied or published.

Fix demonstrated gaps through the current shared controls; do not rebuild working image or text editors as part of simplification.

## 7. Explain settings where decisions are made

Keep the current three owner Settings tasks: **Website details**, **Enquiry emails**, and **Account**. Keep page settings beside the page and record-specific settings beside their record.

Inventory the actual owner-visible fields, reuse the shared field-help mechanism, and check each explanation against runtime behavior. Help should say what changes, where it appears, and whether it is a draft change or takes effect immediately when that distinction matters. Add a short example only where useful.

| Field/task | Intended explanation to validate |
|---|---|
| Public contact email | Shown to visitors as the website's contact address. |
| Enquiry recipients | Private addresses that receive new form enquiries. |
| Button destination | Where a visitor goes after selecting this button. |
| Shared service name | Identify the places that use this shared name. |
| Image description | Describe meaningful image content; explain decorative-image handling only if supported. |
| Article date | Explain the displayed date and whether it affects ordering; do not imply scheduling when none exists. |
| Visibility | Explain the affected content and any independent approval requirement. |
| Account change | State when it takes effect and whether it participates in website publishing. |

Explanations remain visible beside fields and programmatically associated with them. Do not put all help behind tooltips. Preserve entered values and existing inline validation. Technical maintenance fields stay in their established advanced location; useful owner fields are not removed solely because they are less frequent.

Keep the existing design presets. New section layout choices, such as Image left/right, are deferred until an actual need is identified and both responsive variants exist. No new universal spacing, column, CSS, or free-position settings.

## 8. Preserve the draft, review, and recovery contract

Use the existing distinction between draft saving and publishing. Improve unclear labels only after verifying the real state transitions.

- Page/content edits continue through the shared draft and explicit publish review.
- Review describes all affected pages, shared settings, and language variants according to the actual shared publication scope.
- Save failure, conflict, and publication failure retain edits and provide the established recovery route.
- Undo/Redo, discard, history restoration, and preview retain their current meanings.
- Hiding is not permanent deletion. Restoring hidden content must not bypass independent publication requirements.
- Account and operational settings retain their existing immediate-save semantics; do not silently place them in the website draft.

No backend lifecycle change is needed merely to simplify visible controls. Existing role and server authorization checks continue to apply.

## 9. Implementation ownership and compatibility

Use current owners rather than parallel mechanisms:

- `js/editor.js`: extend existing page panel, action sheets, selection tools, section/item/collection operations, and `commit()`.
- Keep `sectionOrder`, existing item/collection ordering, `placements`, `addedElements`, links and styles in the established configuration.
- Reuse `hideTargetFor`, `elementRemovalInfo`, and `<scope>:<key>` identity rules. Preserve catalogue remapping rules; do not introduce a second hidden-state system.
- Reuse `beginDrag/endDrag` and preserve start/end/cancellation behavior. Narrowing destinations must not leave stale dragging state or disabled UI behind.
- Keep runtime placement rendering in `js/site-config.js` and shared validation rules compatible with published, draft, and historic configurations. Removing a UI feature does not authorize removing its renderer.
- Reuse `js/admin-fields.js` for help and existing CSS owners for responsive tool layout. Update `UX-CONTRACT.md` and relevant `DESIGN.md` behavior notes alongside implementation, identifying which previous drag behavior is superseded. Preserve visual tokens.
- Reuse existing browser journeys and regression infrastructure. Change obsolete gesture expectations deliberately while retaining data, rendering, recovery, and equivalent user-task coverage.

Exact helper/file changes are confirmed against the implementation revision before coding. No duplicate store, auto-migration, publication endpoint, advanced dashboard, or role model is planned.

## 10. Delivery stages

### Stage 0 — baseline and compatibility inventory

Capture the evidence in section 1. Record blockers and any owner operation that would otherwise become inaccessible. This is preparation, not a production UI change.

### Stage 1 — Page sections and section-scoped movement

One focused commit: add Page sections, keep drag within supported current-section positions, remove new cross-section element destinations and the generic Move to sheet, and provide Earlier/Later on phones. Include meaningful regression coverage, true pointer drag checks, compatibility/history verification and contract updates. Preserve the remaining editor layout and image flow.

Review this working result before expanding scope. The review should show actual section/list ordering, phone operation, and an existing placement surviving unchanged. If it introduces a task regression, fix it or revert this commit before proceeding.

### Stage 2 — contextual clarity and field explanations

One separate commit: address demonstrated action overlap or irrelevant options and complete the verified field-help inventory. Keep existing settings organization and interaction patterns. Confirm that image, text, link, and record workflows remain at least as direct.

### Stage 3 — validation and targeted corrections

Observe realistic owner tasks and fix concrete confusion in small changes. Retain the simplified model only when it works in practice. New section libraries, new layout variants, further drag removal, and deletion of legacy placement support are separate future decisions, not automatic follow-up work. There is no mandatory two-week waiting period.

This document requests no commit, push, publication, or deployment by itself; it describes how subsequent implementation should be packaged and reviewed.

## 11. Verification and release criteria

Run `npm test` and `npm run test:browser` after each implementation commit's changes. Preserve coverage of valid older configurations even when interaction-specific drag assertions need replacement. Do not make a suite green by removing a still-required behavior or substituting a label-only check for a complete journey.

Exercise these tasks in the browser using actual click/tap and keyboard input on desktop and a narrow viewport:

1. Edit text; cancel; edit again; Undo/Redo; reload the saved draft.
2. Change a button label and destination, including an invalid destination and recovery.
3. Choose/upload an image; cancel without changing the page; Apply; verify its phone crop. Check file drop separately and a failed upload.
4. Add an item; move it within its list; edit it; hide/remove and recover it through the established mechanism. Verify an empty list can be populated.
5. Move a section in both directions, including boundaries and hidden sections; preserve panel selection and focus; Undo and reload.
6. Check English and Azerbaijani content remains attached to the correct items after ordering.
7. Open, edit an unrelated field, save, publish in an isolated environment, and restore history for a configuration with existing placements and added elements. Confirm no unintended content/layout reset.
8. Verify keyboard focus, touch scrolling, long labels, zoom, narrow sheets, and small chip/logo controls. No task relies only on hover or long press.
9. Verify draft/live indicators, multi-page review scope, save/publish failures, stale-draft protection, and role restrictions.
10. Compare public pages before and after a no-op editor visit. Changed admin controls must not change the public design.

Automated checks establish functional behavior. A short observed owner trial establishes whether the controls are understandable. Use task prompts such as “Put Results after Services” without telling the participant which button to press. Record assistance, wrong turns, recovery, and accidental actions; compare against the baseline where a speed or step-count claim is made.

Release criteria: required suites pass; compatibility fixture retains content and intended layout; all core owner tasks have complete click/tap paths; no data loss or accidental publish; no unresolved severe usability regression. A green suite alone does not justify claiming that every owner will find the interface comfortable.

## 12. Rollback and limits

Keep the first changes reversible through code commits. Since no content migration is planned, reverting the UI change should restore controls while preserving legitimate drafts and publications made meanwhile. Verify compatibility in the isolated fixture rather than resetting live content as a rollback shortcut.

Stop expansion if useful content becomes inaccessible, public layout changes unexpectedly, translations lose their association, controls overlap, or previously straightforward tasks become harder. Repair that specific regression before adding features.

The immediate goal is a small, demonstrably easier editor. The plan deliberately defers new page-building capabilities until real owner tasks justify them.
