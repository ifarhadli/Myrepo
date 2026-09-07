**Admin simplification and fixes — 7 September 2026**

The owner interface now exposes three Settings tasks: Website details,
Enquiry emails, and Account. Website details has seven main fields; privacy,
terms and booking links are collapsed. Raw layout/CSS controls, analytics
scripts, redundant contact fields and legacy global article/job metadata are
removed from the owner interface. Existing configuration values are preserved.
Proof approval belongs beside the page content. Overview concentrates on
unread enquiries, draft status, last publish and useful next actions.

| Original findings | Implemented correction |
|---|---|
| F1 | One owner for delegated panel listeners; repeated catalogue actions and tab visits no longer multiply mutations. |
| F2–F5 | Required live-base and shared-draft revision checks; local recovery retains its own metadata; history restore and publish reject stale revisions; edits during advanced publish remain unsaved and available. |
| F6 | Confirm individual enquiry deletion; cancel makes no request; one confirmation makes one request. Global deletion is collapsed and explicitly includes hidden rows. |
| F7, F11 | Server email validation, linked field errors and separate HTTP/network/conflict handling. |
| F8–F9 | Export all matching rows across pages; neutralize spreadsheet formula prefixes in values and headers. |
| F10 | Account and Sign out available to every editor role; the editor saves its private draft before sign out. |
| F12–F15 | Matching preview selection, real keyboard-operable Import button, checks for blank policy links, and removal of obsolete global metadata controls. |
| F16 | Configuration export/import is explicitly labeled with exclusions. |
| F17 | Search, form filters, server pagination and clear totals; remove silent 10,000-record truncation. |
| F18 | Persist email attempts/status; up to three attempts with stable idempotency keys; resume recent pending work; record webhook uncertainty. |

Verification uses disposable site copies, synthetic accounts/enquiries and a
local email stub. No real enquiries were deleted and no production content
was published. Screenshots cover desktop Settings, mobile Website details,
Account, advanced navigation and recovery conflicts.

- `npm test`: 206 checks passed, 0 failed.
- `npm run test:browser`: 103 existing browser checks plus 20 admin regression
  checks passed, 0 failed.
- Premium UI strict audit: 0 findings.
- Desktop and 390 px mobile screenshots opened and visually inspected.

Evidence: [server results](admin-fixes-server.log),
[browser and regression results](admin-fixes-browser.log),
[static results](admin-fixes-static.log),
[Settings screenshot](admin-fixes/screenshots/settings-menu.png),
[mobile website details](admin-fixes/screenshots/website-details-mobile.png).

Practical limits: configuration export is not a complete operational backup;
restore into an empty deployment was not implemented or demonstrated. The
JSON enquiry store still reads its file to filter results; pagination limits
response and UI size, not storage-engine work. Conflict recovery does not
automatically merge different people's edits. Email acceptance and retry are
tested against a local stub, not recipient inbox delivery. Webhook failures
are recorded without automatic replay. Restart retry logic is source-reviewed;
the suite exercises a timed email retry without a process restart.
