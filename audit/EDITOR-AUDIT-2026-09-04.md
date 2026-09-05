# OmniMark — on-page editor audit

Date: 4 September 2026 (evening)
Branch: `claude/site-build-brief-jpmkd6` — `023b115` + uncommitted history/conflict work
Scope: independent verification of the four editor commits (Codex, per `EDITOR-PLAN.md`) and a self-review of the follow-up changes (publish history, restore, draft/live conflict guards, Undo labelling).

## Verdict

**Ship it.** The editor matches the plan, the security model survived the change, and the one real flaw found in this pass (a way for a reloaded editor to hide a conflict) is fixed and covered by a test. Remaining open items are unchanged: owner content, hosting configuration, and the two product decisions.

## Verified

| Check | Result |
|---|---|
| `npm test` (syntax on 12 files + API suite) | **96 / 96** |
| `npm run test:browser` (real Chrome, editor included) | **51 / 51** |
| Dictionaries | 592 EN / 592 AZ, 0 missing, 0 orphan |
| `data/site.js` vs `data/site.json` | in sync |
| Editor script injected only for a valid session **and** `?edit=1` | confirmed live (anonymous: no; authed without flag: no; authed with flag: yes) |
| `data/draft.json`, `data/history/*` | 403 on every path tried, git-ignored |
| New routes without session / without CSRF header | 401 / 403 |
| Restore with a traversal-shaped id | 404 (id is pattern-matched before any file access) |
| HTML sanitiser for rich strings | `<template>` parse, allow-list `b strong em i a[href] br`, attribute strip, `href` scheme check |
| Inbox renders visitor input | `textContent` only |
| Dynamic `innerHTML` in the editor | constants, regex-validated colours, server-computed numbers |

## Findings

### F1 — Draft base could be silently refreshed · **Fixed**
The first version of the conflict guard let the editor send `baseUpdatedAt` from the live version it had *just loaded*. Scenario: draft started Monday; developer saves from the advanced dashboard Tuesday; owner reopens the editor Wednesday → first autosave rewrote the base to Wednesday's live and the stale check passed. Fixed twice over: the server now keeps a draft's original base for its lifetime, and the editor carries the base the server handed it. Regression test: *"re-saving an existing draft keeps its original base"*.

### F2 — No way back after a bad publish · **Fixed (this pass)**
Every publish now archives the outgoing live version to `data/history/` (last 10). *History → Restore* loads a version into the draft for review; live never changes without a Publish. Tested end-to-end (archive, list, restore, 404, cap).

### F3 — Advanced dashboard could be overwritten by a later editor publish · **Fixed (this pass)**
`PUT /api/site` returns `409 draft-exists` while an editor draft is pending (dashboard asks before forcing); `POST /api/publish` returns `409 stale` when live moved on (editor shows "Publish anyway"). Both tested.

### F4 — Undo/Redo were unlabelled arrows · **Fixed**
Now "↶ Undo" / "Redo ↷" with keyboard hints; History sits beside them.

### F5 — Server does not sanitise rich-text overrides · **Accepted, documented**
Client sanitises; the server only length-caps. The admin role is trusted at code-execution level (analytics snippets), so this is consistent — README's security model now says so explicitly.

### F6 — History restore replaces the whole draft · **By design, note**
Restore is version-level, not per-field. The dialog states how many unpublished changes it will replace. Per-field history is out of scope.

### F7 — `data/history/` grows in the volume, not in git · **Info**
10 × ~100 KB. Negligible; include the `data/` volume in backups as already documented.

## Still open (unchanged, not code)
Content (cases, portraits, logos, verified numbers, legal pages) · hosting configuration (domain, Resend, notification recipients) · decisions: separate AZ URLs / hreflang; bespoke admin vs. headless CMS for media, collections, multi-user.

## Uncommitted at time of writing
`server.js`, `js/editor.js`, `js/admin.js`, `css/editor.css`, `.gitignore`, `README.md`, `UX-CONTRACT.md`, `test/server.test.js`, `test/browser-smoke.js`, plus this file and `audit/FINAL-AUDIT-2026-09-04.md`.
Suggested commit: `feat(editor): publish history, restore and draft conflict guards`.
