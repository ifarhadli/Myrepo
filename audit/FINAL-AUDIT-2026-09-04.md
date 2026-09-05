# OmniMark — final pre-deploy audit

Date: 4 September 2026
Branch: `claude/site-build-brief-jpmkd6` at `47e591c` (clean tree)
Scope: independent verification of the eight launch-hardening commits, plus a fresh pass over security, integrity, accessibility and deploy readiness. Read-only; nothing was changed.

## Verdict

**The code is launch-ready. The blockers are content and configuration, not engineering.**

Everything the previous two audits flagged as a code defect is fixed and covered by a test. What remains open is owner-supplied (cases, portraits, logos, verified numbers, legal pages, real contact details), environment configuration (domain, notification credentials), and two product decisions (separate Azerbaijani URLs; bespoke admin vs. headless CMS).

## Verified green

| Check | Result |
|---|---|
| `npm test` (syntax + 66 server/API checks) | 66 / 66 |
| `npm run test:browser` (19 real-Chrome checks: 390 px overflow, 1366×768 mega-menu, drawer inert/focus, proof gating, share controls, admin dialog) | 19 / 19 |
| i18n dictionaries | 540 EN / 540 AZ, 0 missing, 0 orphan (4 keys referenced from JS, not markup) |
| Internal links | all resolve; the only "misses" are `data:` favicon URIs the checker doesn't skip |
| `data/site.js` vs `data/site.json` | in sync |
| Inline `grid-template-columns` overrides (root cause of the 3 broken mobile templates) | none left in any page |
| Placeholder / TBC copy in HTML | none |
| Duplicate ids, multiple `<h1>`, unlabelled inputs (public pages) | none |
| API surface | unchanged: 11 routes, all mutating routes behind session + `X-Requested-With` + Origin |
| JSON-LD serialisation | `<` → `<`, U+2028/2029 escaped — safe inside `<script>` |
| Structured-data URLs (`orgLogoUrl`, `jobApplyUrl`) | scheme-checked server-side; `JobPosting` correctly absent when job fields are empty |
| `innerHTML` / `insertAdjacentHTML` sinks in public JS | all fed by `esc()`/`escapeHtml()` or by the admin-trusted analytics snippet |
| Visitor acknowledgement email | reflects only a sanitised first name (CR/LF stripped, 80 chars); no free-text reflection |
| Secrets in git | `data/admin.json`, `data/submissions.json` untracked; screenshots ignored |
| Proof gating | `html:not(.show-verified-proof) [data-proof]{display:none!important}`, default **off** |
| Success copy | "We'll reply within one business day." — matches what the system does |

## New findings (all minor; none block deploy)

### F1 — Auto-reply can be pointed at any address · Low–Medium
Once `RESEND_API_KEY` is set, the public contact/newsletter form makes the site send an acknowledgement to whatever email the visitor types. The only cap is 30 submissions / 10 min per IP. An attacker with a few IPs can use the agency's sender to annoy a third party (content is fixed, so it's nuisance, not phishing).
**Fix (≈30 lines):** add a hidden honeypot field (F2) and a per-target-address cap (e.g. 3 acknowledgements per address per day). Do this before enabling `RESEND_API_KEY`.

### F2 — No spam guard on forms · Low
No honeypot or challenge; `submissions.json` will collect bot junk (capped at 10,000 records). A hidden `website` field that must stay empty blocks most bots at zero cost.

### F3 — `inert` has no fallback · Low
Drawer/accordion use `node.inert = true`. Safari < 15.4 and pre-2022 Android ignore it — the drawer still works, but background links stay tabbable there. Acceptable for a 2026 launch; an `aria-hidden` + `tabindex=-1` walk would close it.

### F4 — Browser suite needs a local Chrome · Info
`test/browser-smoke.js` drives an installed Chrome over DevTools. It fails on a CI runner without Chrome. `npm test` (server suite) is CI-safe on its own.

### F5 — Mixed line endings · Cosmetic
`git diff --check` reports 8 whitespace warnings across the last 8 commits; files are a mix of CRLF and LF. A `.gitattributes` with `* text=auto` normalises it once.

### F6 — Proof band is invisible until the owner flips it · Info
By design, the homepage currently shows no stats, logos, testimonials or team. Make sure the owner knows *Settings → Show verified proof* exists and is off on purpose.

### F7 — Codex governance files · Info
`DESIGN.md`, `UX-CONTRACT.md`, `premium-ui.json` were added by the implementing agent's tooling. They're accurate and harmless; `premium-ui.json` references that tool's own verification commands. Keep or drop — no code depends on them.

## Still open (unchanged, not code)

- Content: 6–9 real cases, portraits, client logos, testimonials, verified statistics, Privacy / Terms / cookie policy pages.
- Configuration: public domain, contact details, LinkedIn, social image, scheduler URL, analytics ID, notification credentials.
- Decisions: separate AZ URLs + hreflang (only if AZ search matters); bespoke admin vs. headless CMS for media/collections/revisions/multi-user.
- CSP: deliberately not set — it would break owner-pasted tag snippets; apply at the proxy if wanted.

## Deploy checklist (Railway)

1. Push the branch; connect the repo to a Railway service.
2. Add a **Volume** mounted at `/app/data`.
3. Environment: `ADMIN_PASSWORD`, `TRUST_PROXY=1`; when ready, `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` (a verified domain sender), optionally `NOTIFY_WEBHOOK_URL`. `PORT` is injected; `HOST` auto-switches to `0.0.0.0`; `Secure` cookies and HSTS switch on automatically behind Railway's HTTPS.
4. Attach the custom domain.
5. In the admin: Site URL, contact details, legal URLs, social image, scheduler, analytics → **Save & publish**.
6. Verify the proof content, then switch **Show verified proof** on.
7. *Account → Export JSON* as the first backup; repeat after every content session.
