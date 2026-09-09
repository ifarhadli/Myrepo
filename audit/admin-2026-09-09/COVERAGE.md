# Admin audit coverage

Status describes the tested action family. It does not certify every repeated button instance or every possible data combination. “Suite” refers to a fresh run on 9 September 2026, not old test results.

| Area | Actions exercised | Result / limits |
|---|---|---|
| Login | Show/Hide, empty submit, wrong password, valid sign-in, Forgot password, unavailable recovery, Back | Passed tested states; recovery delivery uses mock/server checks |
| Password setup | Invitation link, too-short validation, matching password, save, sign-in as invitee | Passed locally with mock invitation token |
| Account | Recovery email save/error, password show/hide, short/mismatch validation, successful change, sign-out | Passed; synthetic accounts only |
| Users | Invite, missing-name validation, resend, role change cancel/confirm, disable cancel/confirm, restore, role access denial | Passed these actions; missing pending-invitation cancellation is finding 4 |
| Editor toolbar | Settings, This page, Preview, Inbox, More, Design, Image library, History, Phone preview, Account, Users, Discard | Panels/actions opened; equivalent desktop/mobile entry points also covered by suites |
| Languages / pages | EN/AZ edits, page switching and draft carry-over | Fresh suites passed; not every page/language permutation |
| Website details | Editing name/email/legal link, validation, Website links disclosure, back/close, publish | Passed normal path; not every contact-field value permutation |
| Enquiry emails | Empty/invalid recipient, add, save, test notification | Passed with local mock mail; removal/default-recipient variants covered by server tests |
| Design presets | Original, Calm, Editorial, Reset, Undo/Redo | Passed |
| Page / item settings | Open, SEO fields, noindex/proof controls, social media selection, slug and metadata | Fresh suites passed; bulk page title/section-toggle input also exercised |
| Element editing | Select, Edit text, Enter, Escape, Remove/Restore, removal hint dismissal | Passed for tested authored/added targets |
| Add | Paragraph, Button, Another like this, compound copies | Direct Paragraph/Button checks passed; fresh suites cover bullet/stat/FAQ and rekeying |
| Links / style | Empty/unsafe link rejection, Page/Section/Item/Custom choice, valid custom Save, Primary/Secondary/Text | Passed; hidden section destinations still need clearer visibility guidance |
| Placement | Move to section/slot/confirmation, native drag with visible drop zones and successful drop, Alt+Up/Down, Undo/Redo | Passed mechanics; hidden-destination warning absent (finding 3); fresh suites include mobile and left/right row behavior |
| Section / catalogue editor | Section visibility/order/accent, item move/remove/restore, industry chip and logo controls | Fresh suites passed; direct industry remove also exercised |
| Collections | New/edit case/article/job/team/testimonial, rich text, publish/unpublish, slug validation | Fresh browser-suite coverage; not every repeated collection instance clicked manually |
| Draft lifecycle | Autosave, Review, Cancel, Publish, Discard cancel/confirm, History restore confirm | Passed; server/browser suites cover concurrent draft/publish conflict paths |
| Preview | Create, replace, copy, revoke cancel/confirm | Token lifecycle passed locally; empty Copy/Open state broken (finding 6); external configured URL not opened |
| Media | Choose file, upload, card selection, rename, description, focal control, save details, Apply, Remove, search, delete cancel/confirm | Passed; fresh suites include image variants, invalid uploads, in-use/role protection and slot switching |
| Inbox | Refresh, search, Clear, form filter, Next/Previous, expand, Mark read, Delete cancel/confirm, CSV | Passed; native mail-client Reply not launched; unread toggle also covered by suites |
| Advanced overview | Tab navigation, status/website checklist inspection | Opened successfully; not every duplicate outbound shortcut clicked |
| Advanced Design | Four colour reset buttons, colour text, preview page select and Reload, Save & publish | Normal controls work; invalid colour publishes (finding 2) |
| Advanced translations | Search, namespace/changed filter, text entry, reset, empty results, tab switching | Core actions work; delayed callback can throw after leaving (finding 5) |
| Advanced services | Add service twice, move up/down, remove, add group, remove-group cancel/confirm, reset cancel/confirm | Actions execute; duplicate placeholders allowed; individual deletion differs from reversible editor removal |
| Advanced industries | Add, remove, move, reset confirmation | Reorder changes the wrong item's visibility (finding 1) |
| Advanced pages/settings | Title edit, section toggles, email validation, discard | Passed tested paths |
| Advanced enquiries | 28-record pagination, search/clear, filter, refresh, matching export, individual delete, delete all cancel/confirm | Passed; CSV blob inspected; deleting all correctly includes filtered-out records |
| Advanced account/export | Password form, Export JSON, Import chooser, malformed JSON, valid import, reset cancel/confirm, discard | Passed; valid import/reset remain unpublished until an explicit publish |
| Responsive / keyboard | 390 px panels, advanced Menu, phone preview, Enter/Escape, Alt arrows, suite focus/touch checks | Tested layouts fit; secondary mobile/accessibility polish listed in report |

See [REPORT.md](REPORT.md) for findings, screenshots and environmental limits; [CONTROL-LOG.md](CONTROL-LOG.md) lists the 141 distinct selectors used in 281 successful mouse-click dispatches.
