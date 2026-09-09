# A simpler website editor for OmniMark

> Decision update: the subsequent owner review supersedes this report's proposal
> to remove all everyday layout drag. Keep supported movement within the current
> section, retain local click/tap alternatives, add Page sections, and remove
> only new cross-section element movement and the generic Move to menu. See the
> [revised implementation plan](../OWNER-EDITOR-SIMPLIFICATION-PLAN.md). The
> comparisons below remain research evidence, not the final movement contract.

## Recommendation

Make the on-page editor a focused tool for maintaining an already designed website. Remove page-element drag handles from the everyday interface, preserve existing placements, and give owners explicit controls for ordering whole sections and repeated items. Keep content changes, image replacement, links, visibility, preview, and publishing easy to discover.

Do not replace every drag interaction with an equally broad “Move to…” menu. That would preserve the difficult decision: which container is a valid destination for this particular piece of content? Normal editing should avoid that question. A service belongs in its service list; a question belongs in its FAQ list; a hero image belongs in its designed image position.

The strongest references for this direction are the content-editing experiences in Webflow, Wix Studio, and Framer; WordPress’s curated editing capabilities; and Shopify’s explicit section controls. These products offer different degrees of freedom, but they demonstrate that maintaining content does not require exposing the full design environment. This is a design recommendation for OmniMark, not a claim that every editor should remove drag. [Webflow content editing](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor), [Wix client editing modes](https://support.wix.com/en/article/studio-editor-understanding-how-clients-edit-their-site), [Framer on-page editing](https://www.framer.com/help/articles/on-page-editing/).

The immediate decision should be **simplify the existing editor**, rather than fund a new general-purpose page builder. A later need for frequent landing-page composition could justify a small library of approved sections. The current priority is reliable maintenance of the existing website.

## Scope and strength of evidence

This report compares eight website editing systems: Webflow, Wix Studio, Framer, WordPress, Shopify, Squarespace, Sanity, and Storyblok. These are relevant to maintaining a public website; generic sales dashboards and analytics products would be weaker comparisons for the placement problem.

Product capabilities were checked against official documentation available on 9 September 2026. Product documentation establishes what an editor supports and how its publisher describes the workflow. It does not establish that one product is measurably easier than another. No logged-in comparative usability study of these products was conducted, and this report assigns no invented usability scores or market-share rankings.

The proposed audience is a nontechnical owner or staff editor maintaining a bilingual agency website. Likely activities include changing copy, replacing images, editing service information, adding case studies, reviewing enquiries, and publishing. These priorities follow the project brief and existing application; actual task frequency has not been measured.

Local implementation observations refer to branch `claude/site-build-brief-jpmkd6` at revision `f86c15a`. The existing source, placement plan, UX contract, and earlier simplification record were inspected. This is a research and implementation proposal, not a new audit of every live control or a claim that the proposed interface already exists.

## What comparable products do

The interpretation column is a recommendation for OmniMark. It is separate from the documented product capability.

| Product | Documented editing approach | Interpretation for OmniMark |
|---|---|---|
| Webflow | A Content editor role can update copy, media, and CMS content through a simplified interface while structural and styling changes are restricted. | Make routine content work the default experience. |
| Wix Studio | Content mode provides content updates; Full mode exposes the wider editor, subject to assigned permissions. | An owner need not see the same controls as the person who built the website. |
| Framer | On-page editing supports text, images, component properties, and CMS content; layout templates and overlays are outside its documented support. | Keep visual editing without promising arbitrary layout modification. |
| WordPress | Blocks can have movement/removal locks; content-only editing can hide layout controls; standard block tools also include up/down movement. | Restrict layout structure deliberately and retain explicit ordering controls. |
| Shopify | A preview inspector offers previous/next movement, hiding, duplication, and contextual settings for sections and blocks. | Use a small set of predictable commands attached to recognizable content units. |
| Squarespace | Fluid Engine provides a grid for free arrangement, including overlaps, with separate desktop and mobile arrangements. | Greater freedom is a different product commitment, with more layout decisions. |
| Sanity | Visual editing combines preview and field editing; its drag implementation updates ordered content arrays. | Model the thing being ordered explicitly if composition expands later. |
| Storyblok | A visual preview is paired with developer-defined fields and composable blocks, including presets. | Offer meaningful content types and approved starting points. |

### Webflow: maintain content within an established design

Webflow documents a role that edits static and CMS content, provides content-specific actions when an element is selected, and can publish when permission is enabled. Its documentation also distinguishes local component properties from shared component content that affects multiple instances. The published restriction on structural changes is particularly relevant: direct editing and unrestricted design manipulation are separate capabilities. [Webflow, “Edit site content as a content editor”](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor).

For OmniMark, an editor selecting a button should primarily see its text and destination. Selecting a public phone number should explain that it is shared where applicable. Understanding CSS containers should never be a prerequisite for changing either value.

### Wix Studio: distinguish client maintenance from full editing

Wix Studio’s documentation presents Content mode for text and media updates and Full mode for the broader design editor. The client can navigate between modes, while role permissions continue to apply. Its content experience combines a page view with a panel for entering information and media. [Wix, “Understanding How Clients Edit Their Site”](https://support.wix.com/en/article/studio-editor-understanding-how-clients-edit-their-site).

The useful lesson is separation of tasks. OmniMark does not need to add another mode switch immediately: its existing on-page workspace and advanced maintenance area already provide a basis for that separation. The next change should reduce what appears in normal editing, without creating a third competing dashboard.

### Framer: on-page editing does not imply a design canvas

Framer lets authorized people edit supported content from the published website, add CMS-backed pages, and open fields such as metadata that are not visible in the page itself. Its documentation says changes require review and publication by a collaborator with publishing permissions before becoming public. [Framer, “Using on-page editing”](https://www.framer.com/help/articles/on-page-editing/).

For OmniMark, keep direct editing for visible content and a compact details panel for fields such as a case-study slug or search description. The current explicit publication workflow is worth preserving. There is no need to copy Framer’s collaboration notifications or introduce a mandatory second approver for a single owner.

### WordPress: curated structure and explicit movement coexist

WordPress supports locking movement and removal, and content-only configurations hide structural controls while preserving supported content editing. Its handbook notes that ordinary locking is not automatically a permanent restriction: unlocking permissions and the content-only “Modify” escape need consideration. Separately, the general block toolbar documents both dragging and up/down movement. [WordPress block locking](https://developer.wordpress.org/block-editor/how-to-guides/curating-the-editor-experience/block-locking/), [WordPress block controls](https://wordpress.org/documentation/article/work-with-blocks/).

The transferable idea is an intentional editing contract. Some content can be changed, some repeated units can be reordered, and some layout relationships are maintained by the template. Simply hiding a button must not be represented as a new security boundary.

### Shopify: offer explicit actions and a page outline

Shopify’s inspector selects content in the preview and opens associated settings. It offers previous/next controls, with unavailable boundary positions disabled. Its sidebar groups sections and blocks and provides a way to recover hidden content. Shopify also supports drag, with unavailable destinations returning the item to its original position. Its global theme settings are distinct from settings for individual sections. [Shopify preview inspector](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/preview-inspector), [section organization](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/customizing-sections), [theme settings](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/theme-settings).

For OmniMark, the strongest reference is the outline and explicit controls. The fact that another product restricts destinations does not excuse unexplained rejected moves in this editor. Restrictions should correspond to objects the owner recognizes.

### Squarespace: more freedom brings another layout job

Squarespace’s Fluid Engine allows blocks to occupy a grid, including overlapping other blocks. Its documentation explains that desktop and mobile layouts are arranged separately. The same guide also identifies automatically arranged content options, such as auto layouts and galleries. This is a useful counterexample to any claim that professional products universally avoid drag. [Squarespace, “Moving blocks to customize layouts”](https://support.squarespace.com/hc/en-us/articles/206543987-Moving-blocks-to-customize-layouts).

For OmniMark, unrestricted placement would create an obligation to solve desktop and phone composition, overlap, reading order, and recovery. That investment fits a design tool. It is hard to justify for an owner whose primary need is keeping an existing website current.

### Sanity: rearrange modeled content

Sanity’s visual editing connects a rendered preview to editable fields. Its documented drag feature uses arrays of content objects; a move updates their order and the frontend renders the new data. The documentation explicitly distinguishes this from mutating the DOM. It also currently lists touch devices as unsupported for that drag feature. [Sanity visual editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing), [Sanity drag and drop](https://www.sanity.io/docs/visual-editing/enabling-drag-and-drop).

For a future OmniMark page-composition feature, the lesson is to define a section or list item as a real unit with a stable identity. It is not a recommendation to migrate to Sanity now. The existing section order, collection records, and shared draft infrastructure should be reused first.

### Storyblok: developer-defined content with visual context

Storyblok pairs a draft preview with a form whose fields are determined by the implementation. Blocks can compose page content, and presets provide prepared starting content. Its editor distinguishes draft, published, and changed states. Internal link fields can select content without manually typing its URL. [Storyblok, “Visual Editor”](https://www.storyblok.com/docs/manuals/visual-editor).

OmniMark should use task names such as “Add question,” “Add service,” and “Add case study.” A small, well-defined set of choices is easier to explain than a generic element palette. Existing link pickers, item fields, and draft states already support much of this direction.

## What the evidence supports—and what it does not

The consistent opportunity is separating content maintenance from design decisions. There is no evidence here that drag is inherently bad, or that every owner prefers a form. The product comparisons instead support several legitimate models: content editing inside fixed layouts, composition from approved units, and a full design canvas.

OmniMark’s current difficulty is a mismatch between the apparent promise and the actual editing model. A handle on an individual element suggests broad freedom. The implementation offers selected compatible containers, and an owner must discover those constraints while attempting a move. A longer tutorial would explain the restriction but would not remove the decision burden.

Nielsen Norman Group’s progressive-disclosure guidance supports prioritizing frequent tasks and making occasional capabilities discoverable through clearly named secondary controls. It also warns against excessive layers of disclosure. Accordingly, this proposal does not recommend burying essential image replacement or publishing several menus deep. [NN/g, “Progressive Disclosure”](https://www.nngroup.com/articles/progressive-disclosure/).

W3C’s guidance for WCAG 2.2 criterion 2.5.7 requires a single-pointer alternative to authored dragging functionality unless an exception applies. A keyboard shortcut alone is not that alternative. Clickable up/down controls and a clickable destination selector are relevant examples. This supports making explicit controls complete in their own right; it is not a certification that the current application meets all accessibility requirements. [W3C, “Dragging Movements”](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

## Diagnosis of the current OmniMark model

The current implementation has several movement systems: whole-section ordering, repeated-item ordering, collection ordering, and arbitrary element placements. They serve different purposes. A single “remove drag” change must identify which interaction is being removed instead of indiscriminately deleting shared infrastructure.

`ALLOWED_DROPS` in `js/site-config.js` maps paragraphs, buttons, list items, statistics, FAQs, steps, and cards to different allowed container types. The editor’s `moveSlots` function further considers target identity, parent containers, dependencies, and positions that would produce no change. Therefore a location that looks reasonable on the rendered page can still be unavailable. This follows the authored compatibility model in `ADD-AND-PLACE-PLAN.md`; broadening every selector would not make every resulting layout coherent.

The existing repository already contains valuable simplifications: an on-page main workspace, contextual actions, three owner Settings tasks, an image Apply flow, design presets, explanations, and review before publishing. These are recorded in `audit/OWNER-EDITOR-SIMPLIFICATION.md` and `UX-CONTRACT.md`. The next iteration should build on that work instead of presenting it as missing or starting again.

The earlier automated checks establish behavior for the journeys they exercise. They do not measure whether an unfamiliar owner can predict a destination, find an action, or recover without assistance. The reported difficulty with dragging is relevant usability evidence even when a particular scripted placement test passes.

## Recommended control policy

The following table is a proposed product contract, not a description of changes already implemented.

| Content or action | Normal owner controls | Layout boundary |
|---|---|---|
| Text and headings | Edit text; appropriate text formatting | Keep the authored position; do not show a drag handle. |
| Button | Edit label; choose link; approved style if needed | Keep it in its designed action area. |
| Image | Replace; describe; adjust focal point; Apply | Keep the image shell and responsive behavior. |
| Service, industry, FAQ, process step | Add item; edit; hide/restore; move earlier/later | Reorder within the same meaningful list. |
| Case study, article, job | Manage a content record; edit details; publish/unpublish | Use the collection’s existing display and ordering rules. |
| Whole page section | Select from Page sections; move up/down; show/hide | Reorder approved sections in the page body. |
| Header/footer | Edit permitted shared content with a scope explanation | No movement into or out of the body. |
| Contact form | Edit permitted copy and optional fields | Preserve required controls and form structure. |
| File dropped from the computer | Upload through the image flow | Dropping a file is not a layout move. |
| Existing cross-section placement | Continue rendering and restoring it | Removing its gesture must not reset the saved layout. |

Default recommendation: remove page-canvas drag handles for elements, sections, and repeated items from normal editing. Also remove drag-specific onboarding, cursors, and long-press instructions where they no longer lead to a useful action. Keep direct click/tap menus and supported ordering commands.

Retain image file drop as an optional upload method alongside the file chooser. If users later demonstrate a need for faster list sorting, a drag handle inside a dedicated list panel could return as a secondary shortcut. That should be evaluated separately from dragging page content across a long canvas.

Do not expose arbitrary cross-section element movement by default. A carefully named advanced relocation tool can remain available if there is a proven maintenance need, but the ordinary owner should not need it. Preserve its stored data and runtime renderer during the simplification.

## Proposed everyday workflow

### Enter the website and select the thing to change

Keep the on-page editor as the main workspace. The top-level controls should answer a small set of questions: which page, which language, what changed, how to preview, and how to publish. Inbox remains a business task; account and maintenance functions remain reachable without competing with the selected content.

A click or tap on editable content should identify the complete unit and offer its primary action. For a paragraph, that is Edit text. For an image, it is Replace image. For a button, the label and destination belong together. Avoid showing unrelated controls simply because the implementation can technically apply them.

On touch devices, provide the action directly after selection. Long press can be an optional shortcut, but should not be the only way to discover an action. A normal scroll must not accidentally start a move or an edit.

### Use one Page sections panel for occasional arrangement

Extend the existing page panel with a plainly named Page sections list. Display recognizable names such as Introduction, Services, Industries, Client results, and Contact. Selecting a row should highlight or scroll to the corresponding section in the preview. Use the authored section label as the first source, with a readable content-derived fallback.

Each reorderable row should offer Move up and Move down. For long pages, offer a compact “Place before…” selector listing other whole sections. Do not require a confirmation for each reversible one-step reorder: show the result immediately in the draft and offer Undo. Keep the final publication review.

Show hidden sections in the list with a Restore action. Distinguish “Hidden by you” from “Not approved for publication.” A section can be unavailable to visitors for more than one reason, and restoring one setting must not silently bypass another. Header/footer and other protected areas should not appear as interchangeable body destinations.

Keep the owner’s location stable after an operation. Moving a section must not close the panel, lose keyboard focus, reset scroll unexpectedly, or select a different section. The owner should be able to make several small ordering changes and then review the page.

### Manage repeated content as a list

Inside Services, offer Add service and a short list of existing services. Inside FAQs, offer Add question and the existing questions. An industry chip should remain an industry item, not become a generic text block that can be dropped into the hero.

For wrapping chips or a multi-column card grid, “Earlier in list” and “Later in list” can communicate order more accurately than visual direction. The underlying sequence determines how items wrap at each screen width. Do not let an owner believe that moving right on desktop creates an independent phone layout.

Keep the two languages attached to the same content identity. Reordering an English service must not detach its Azerbaijani translation or transfer another item’s hidden state to it. Preserve the existing catalogue remapping logic until a deliberate identity migration is justified.

### Replace images without moving their layout

Preserve the existing image sequence: choose/upload an image, provide its description, adjust the focal point if needed, inspect the crop, and Apply image. Upload completion should not replace the page image before Apply. Cancelling should leave the original assignment intact.

A file dropped into an image position should enter that same flow. It must not be confused with dragging an existing image to another location. Keep the file chooser as a complete alternative, show upload failures beside the relevant operation, and make the selected target clear throughout upload and application.

The ordinary image panel should emphasize the page task. Permanent library deletion, file variants, and storage maintenance are separate concerns. The existing role restrictions and checks for an image used elsewhere should remain in force.

### Offer layout choices only where they have been designed

An occasional need such as swapping a photograph and text can be solved by two clear options: Image left and Image right. Those controls should exist only for a section whose two variants have actually been implemented and checked. A static promise of “Swap sides” must not precede a working, responsive variant.

Do not put a universal columns selector on every section. For each proposed variant, specify its desktop layout, mobile reading order, image crop, long-copy behavior, and behavior in both languages. Preserve content when switching variants, and make the change undoable.

Begin with the variants the owner actually requests. A gallery of many generic layouts would create another settings problem. Adding whole new sections is also a separate capability from ordering the sections already present; it should be introduced only when the content need and template are clear.

### Keep draft and live state understandable

Continue using one draft and the existing publication mechanism. Distinguish locally changed, saving, saved draft, failed save, and published states using plain text. “Saved” alone is insufficient if an owner can mistake it for “visible to visitors.”

The publish review should state its scope. If the shared draft contains changes on several pages, Review changes must not imply that it publishes only the page currently visible. Include site-wide changes and both language variants when affected. Retain the existing stale-draft and concurrent-edit protections.

Undo should recover local editing actions; history should recover an earlier published configuration through the established restore flow. These are different jobs. Hiding drag must not remove either recovery path or silently apply an older layout.

## Settings that belong in each place

The current owner interface has already reduced Settings to Website details, Enquiry emails, and Account. Keep that structure. Put page-specific fields beside the page and item-specific fields beside the item. The remaining work is consistency, clear scope, and removing technical controls from ordinary tasks.

| Owner’s question | Appropriate location | Example explanation |
|---|---|---|
| What email should visitors see? | Website details | “Shown as the public contact address on the website.” |
| Who receives form enquiries? | Enquiry emails | “Private recipients for new enquiries. These addresses are not shown to visitors.” |
| Where should this button go? | Selected button | “Choose a page or section, or enter an external address.” |
| What will appear in search results? | This page → Search and sharing | “A suggested search description. Search engines may display a different snippet.” |
| Why is this section not visible? | Page sections / selected section | “Hidden from visitors. Restore this section to include it in the draft preview.” |
| Can these client results be published? | Existing content-approval control | “Show these results only after they are approved. This setting applies across the website.” |
| What changes when I edit a service name? | Service details | “Updates this service name everywhere the shared catalogue is used.” |
| Does this date schedule publication? | Item details | “Shown as the article date. Publishing is controlled separately.” |
| Will this account change wait for Publish? | Account / user access | “This account change takes effect immediately.” |

These are proposed wording examples. Before shipping, verify every statement against the actual field’s behavior. In particular, a public contact address, a private notification recipient, and a login email must never share an ambiguous “Email” explanation.

Keep technical maintenance controls available only in the established advanced area. A raw CSS variable, server integration, or configuration import is not an everyday page-editing task. Hiding an advanced setting from the normal interface is a usability choice; existing server-side permission enforcement must continue independently.

## Options and tradeoffs

The judgments below are specific to the current project and stated audience. They are not measured comparative performance results.

| Option | Benefit | Cost or limitation | Recommendation |
|---|---|---|---|
| Continue polishing unrestricted-looking element drag | Retains the broadest apparent freedom | Still requires resolving container rules, gesture reliability, nested targets, and responsive outcomes | Defer; no demonstrated routine need justifies prioritizing it. |
| Hide drag but keep every element-level Move to menu | Reduces pointer precision demands | Preserves confusing compatibility and destination choices | Insufficient as the complete solution. |
| Content editing plus whole-section and list ordering | Matches existing templates and common maintenance tasks | Owners cannot create arbitrary layouts | Adopt now. |
| Add a small approved section library | Supports repeatable landing pages without exposing CSS | Needs section schemas, templates, validation, and lifecycle rules | Consider after observing a real page-building need. |
| Replace the current CMS with another platform | May bring a larger ecosystem | Migration, permissions, bilingual data, media, and integration work | Not justified by the drag complaint alone. |

The recommendation gives up speculative layout freedom in exchange for more predictable editing. That tradeoff should be revisited if the owner begins creating new campaign pages regularly or repeatedly needs a layout change the templates cannot express.

## Implementation approach for the existing project

### First change: remove the misleading everyday affordance

Remove normal canvas drag handles and their gesture-specific instructions. Inventory all four affected sources: section tools, generic/repeated-item tools, collection tools, and selected-element tools. Do not remove image upload handlers just because they also listen for drop events.

Remove arbitrary element movement from the normal toolbar and touch action sheet. Gate corresponding keyboard shortcuts consistently so the interface does not advertise one policy while Alt+Up/Down performs a different hidden operation. Keep explicit ordering for supported sections and lists.

Preserve `placements`, `addedElements`, element links/styles, and their runtime application. Existing published and draft configurations must render the same way before and after the UI change. The removal of a gesture is not a migration that resets the website.

Deliver this as a small reviewable change with a clear regression fixture containing existing placements, copied blocks, hidden elements, and both languages. This is the best immediate next implementation step.

### Second change: make ordering coherent

Extend the existing page panel and action-sheet components for section and list ordering. Reuse `moveSection`, the existing item/collection ordering operations, and `commit()`. A new screen-local draft, a second ordering store, or a separate publish endpoint would create unnecessary inconsistency.

Use `sectionOrder` for the page’s established section sequence and existing list/collection ordering mechanisms for their respective content. Keep catalogue removal-index remapping through the shared rules. Respect `<scope>:<key>` identities and keep `hideTargetFor` / `elementRemovalInfo` as canonical target resolution.

For long moves, a destination selector should describe a whole-section or same-list relationship, such as “Before Contact” or “Before Analytics consulting.” It should not expose container IDs or rebuild the generic slot-selection interface under friendlier labels.

### Third change: add only validated layout variants

Introduce a section-specific variant only after a real need is identified. Store its value in the existing site configuration and validate a small enumeration of allowed choices. Do not implement a variant by adding another general placement system or by saving arbitrary pixel coordinates.

The renderer owns the responsive result. Each variant must preserve semantic reading order, existing content, hidden state, links, images, language behavior, undo, draft restoration, and publication. A thumbnail can help explain the choice once it faithfully represents the implemented variant.

### Later cleanup and capability boundaries

After the simplified workflow is proven, unused gesture code can be removed with confidence. Keep compatibility for persisted layout data and historic versions until a separately planned migration is complete. Do not erase history or publish changes as a side effect of cleanup.

No new role is required merely to simplify the owner interface. If the product later distinguishes an owner’s content permissions from a designer’s structural permissions, enforce that capability boundary in API writes as well as the UI. A hidden button is not authorization enforcement.

## Verification and an honest definition of “comfortable”

Functional regression tests remain necessary, but they are not a substitute for observing an unfamiliar owner completing realistic work. NN/g describes usability testing as observing representative participants performing tasks, and its task-writing guidance recommends scenarios that do not tell people which control to use. [NN/g usability testing](https://www.nngroup.com/articles/usability-testing-101/), [NN/g task scenarios](https://www.nngroup.com/articles/task-scenarios-usability-testing/).

Begin with a small formative round of approximately five representative owners or staff editors. This is a proposed discovery exercise, not a statistically representative satisfaction survey. Include desktop use and phone use where those match actual working habits. Record completion, assistance, mistaken selections, unexpected publication, recovery attempts, and comments about what participants expected.

| Task scenario | What to observe |
|---|---|
| “The opening message has changed; update it but do not make it public yet.” | Selection, editing, draft/live understanding. |
| “Replace the opening photo with this file and keep the person visible on a phone.” | Upload versus Apply, description, focal point, crop preview. |
| “Visitors should reach the Contact page from this button.” | Link discovery and understanding the destination. |
| “Add this service and put it immediately before the last service.” | Add flow, item identity, ordering, bilingual association. |
| “Client results should appear after Services.” | Finding section ordering without being instructed to use arrows. |
| “Take this section off the website temporarily, then bring it back.” | Hide versus delete, restore discoverability, approval gates. |
| “Correct the Azerbaijani wording without changing the English wording.” | Language scope and preserved identity. |
| “Review the changes, publish them, and explain what visitors can now see.” | Review scope, successful publication, confidence based on the actual state. |

Proposed release criteria: no accidental publication or content loss; critical tasks completed without facilitator intervention; clear recovery from one deliberate mistake; no participant forced to drag; and no unresolved high-severity confusion repeated across participants. These are proposed product criteria, not research results already achieved. If time-to-completion matters, establish a baseline with the current workflow before setting a target.

Automated coverage should include click/tap ordering, keyboard focus retention, boundary states, narrow viewports, long English and Azerbaijani content, hidden and unapproved sections, undo/redo, reload, draft conflict, published output, and history restoration. A fixture with pre-existing placements must remain unchanged by merely opening or saving through the simplified interface.

If any layout dragging is retained or reintroduced, verify real pointer movement and release behavior in the browser, including edge scrolling and cancellation. Programmatically dispatching a `drop` event only checks part of the behavior. Image file-drop tests should remain separate from page movement tests.

## Decision and remaining uncertainty

Proceed with content editing plus explicit section/list ordering. Remove everyday layout dragging and arbitrary element relocation from normal controls. Preserve the existing data, responsive templates, image upload flow, permission checks, and draft/publication machinery.

The uncertain part is how often this owner needs structural changes. A short observed trial and a record of requests for new layouts will answer that better than adding more controls in advance. If those requests become frequent, expand through approved sections and variants, with clear content identities and responsive behavior.

## Sources and local references

All online sources below were accessed on 9 September 2026. Dates are given where captured directly from the source; otherwise the entry is identified as living documentation. Product interfaces, plan availability, and permissions can change. The comparisons concern the documented capabilities, not all possible configurations of each platform.

| Source | Publisher and date information | Evidence used |
|---|---|---|
| [Edit site content as a content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor) | Webflow Help Center; updated 2 September 2026 | Content role, contextual editing, structural limitations, shared content. |
| [Understanding How Clients Edit Their Site](https://support.wix.com/en/article/studio-editor-understanding-how-clients-edit-their-site) | Wix Help Center; living documentation | Content and Full modes; role-dependent actions. |
| [Using on-page editing](https://www.framer.com/help/articles/on-page-editing/) | Framer Help; updated 7 August 2026 | Supported content, CMS pages, hidden fields, publication flow. |
| [Block Locking API](https://developer.wordpress.org/block-editor/how-to-guides/curating-the-editor-experience/block-locking/) | WordPress Block Editor Handbook; living documentation | Movement/removal locks, content-only editing, unlocking caveats. |
| [Work with blocks](https://wordpress.org/documentation/article/work-with-blocks/) | WordPress Documentation; living documentation | Contextual tools, drag and up/down controls, scoped settings. |
| [Customizing with the Preview inspector](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/preview-inspector) | Shopify Help Center; living documentation | Explicit movement, selection, hidden-content recovery, mobile settings access. |
| [Customizing Sections in the theme editor](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/customizing-sections) | Shopify Help Center; living documentation | Section outline, shared header/footer, constrained drag. |
| [Customizing Theme Settings](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/theme-settings) | Shopify Help Center; living documentation | Global theme settings versus section settings. |
| [Moving blocks to customize layouts](https://support.squarespace.com/hc/en-us/articles/206543987-Moving-blocks-to-customize-layouts) | Squarespace Help Center; living documentation | Fluid Engine grid, overlapping blocks, distinct mobile layout. |
| [Visual editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing) | Sanity Docs; updated 5 August 2026 | Visual preview and field editing. |
| [Enable drag and drop for Visual Editing](https://www.sanity.io/docs/visual-editing/enabling-drag-and-drop) | Sanity Docs; updated 10 August 2026 | Array-based ordering, re-rendering model, documented touch limitation. |
| [Visual Editor](https://www.storyblok.com/docs/manuals/visual-editor) | Storyblok Documentation; living documentation | Form/preview pairing, content blocks, presets, links, draft/published states. |
| [Understanding SC 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | W3C Accessibility Guidelines Working Group; updated 26 July 2026 | Single-pointer alternatives; distinction from keyboard accessibility. |
| [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Nielsen Norman Group; established usability guidance | Prioritizing frequent tasks and naming secondary controls clearly. |
| [Usability (User) Testing 101](https://www.nngroup.com/articles/usability-testing-101/) | Kate Moran, Nielsen Norman Group; published 1 December 2019, reviewed 15 July 2026 | Observation of representative people performing tasks. |
| [Turn User Goals into Task Scenarios for Usability Testing](https://www.nngroup.com/articles/task-scenarios-usability-testing/) | Nielsen Norman Group; established research-method guidance | Realistic scenarios without revealing the interface solution. |

Local sources at the inspected revision:

- [ADD-AND-PLACE-PLAN.md](../ADD-AND-PLACE-PLAN.md): intended compatibility rules and existing Phase B scope.
- [js/site-config.js](../js/site-config.js): `ALLOWED_DROPS`, allowed containers, target identities, and runtime placement.
- [js/editor.js](../js/editor.js): section/item/collection tools, element movement, touch actions, `commit()`, and publication UI.
- [UX-CONTRACT.md](../UX-CONTRACT.md): removal, shared identity, permissions, draft behavior, and existing field explanations.
- [Owner editor simplification](OWNER-EDITOR-SIMPLIFICATION.md): previously implemented owner workflow and its stated usability-evidence limitation.
- [test/move-element-journey.js](../test/move-element-journey.js): scope of existing movement regression checks.
