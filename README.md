# OmniMark — marketing site + on-page editor

Static, framework-free marketing site (15 pages, EN/AZ) with a zero-dependency
Node server that adds an authenticated **on-page editor** for copy, layout,
the services catalogue, design, settings and form submissions.

```
node server.js
#  OmniMark site   →  http://127.0.0.1:3000/
#  Site editor     →  http://127.0.0.1:3000/admin
#  First run: generated admin password  →  ************
```

Requires Node 18+. No `npm install` — there are no dependencies.

---

## Layout

```
*.html               15 pages (index, services, work, about, contact, …)
admin.html           editor sign-in (needs server.js)
admin-advanced.html  developer dashboard for complete/raw configuration
css/style.css        design tokens + every site component
css/admin.css        dashboard styles (independent of the site's tokens)
css/editor.css       authenticated editor bar, controls, sheets and preview
js/data.js           service catalogue: 5 engines × groups × sub-services, industries
js/i18n-data.js      EN + AZ dictionary — every string on the site (592 keys each)
js/site-config.js    applies the admin-saved config (tokens, fonts, copy, catalogue…)
js/partials.js       renders header, mega-menu, drawer, footer AND both accordions from data.js
js/i18n.js           swaps text on [data-i18n] elements, persists language choice
js/main.js           interactions: nav, drawer, accordions, forms, cookie banner, motion
js/editor.js         on-page editing, draft autosave, undo/redo, panels
js/login.js          editor sign-in and authenticated redirect
js/admin.js          advanced dashboard
server.js            static server + /api for the dashboard (Node built-ins only)
data/site.json       what the dashboard saved (source of truth)
data/site.js         generated from site.json; loaded in <head> on every page
data/draft.json      private unpublished editor draft (git-ignored)
data/admin.json      password hash + session secret   (git-ignored)
data/submissions.json  contact / teardown / newsletter entries (git-ignored)
sitemap.xml, robots.txt  regenerated on every publish from Settings → Site URL
DESIGN.md            maintained visual direction and design-token contract
UX-CONTRACT.md       shared admin/public interaction and resilience decisions
premium-ui.json      machine-readable UI ownership and verification commands
```

Script order on every page: `data/site.js` + `js/site-config.js` in `<head>`
(so colours/fonts land before first paint), then at the end of `<body>`:
`data.js → i18n-data.js → partials.js → i18n.js → main.js`.

---

## Editing the site

Sign in at `/admin`. After login you land on the real homepage with a thin
editor bar. Click visible text to edit it, switch between EN and AZ in the
bar, and use each section's hover toolbar to hide, recolour or reorder it.
Reorder or remove supported cards in place; service and industry catalogue
items can also be added. **Design** changes the curated colours, font pairing
and motion level while the page is visible. **Phone** previews the current
page in a contained 390 px layout.

Changes autosave to the private `data/draft.json` file and a local browser
backup. Undo/redo covers the current session. **Publish** first shows a
category summary, then writes `data/site.json` and regenerates `data/site.js`,
`sitemap.xml` and `robots.txt`. **Discard** removes the unpublished draft.
Closing the browser does not publish anything.

**Going back.** ↶ Undo / Redo ↷ step through the current session's edits.
**History** lists the last 10 published versions (kept in the private
`data/history/`); *Restore* loads one into the draft — you review it and
publish, the live site never changes by itself. Every draft remembers which
live version it started from: if the live site was changed meanwhile (for
example from the advanced dashboard), Publish stops and asks before
overwriting, and the advanced dashboard asks before saving while an editor
draft exists.

The **Inbox** panel lists submissions newest first, tracks unread state,
opens a reply in the owner's mail app and exports CSV. **Settings** covers
contact details, public site settings, scheduler/analytics tools, proof
gating and notification status.

### Advanced dashboard

`/admin-advanced.html` keeps the original structured dashboard for developer
work: custom CSS and layout tokens, full catalogue records, per-page SEO,
structured data, account/password, JSON backup/import and reset. It links
back to the on-page editor. Both admin routes are excluded from the sitemap
and disallowed in `robots.txt`.

Untouched fields inherit from `data.js`, `i18n-data.js` and `style.css`, so
code defaults remain the fallback instead of being copied into every draft.

Organization structured data is rendered server-side from the site settings
on every page. Article schema appears only when author and publication date
are filled in; JobPosting appears only when every required job field is
complete. Keep those fields empty until they exactly match the visible page.
Unconfigured privacy/terms destinations render as muted non-links rather than
false links; add the approved URLs in *Settings* before launch.

### Password

On first start the server generates a password, prints it once, and stores
only a scrypt hash in `data/admin.json`. Set `ADMIN_PASSWORD=…` in the
environment before the first run to choose it yourself. Change it any time
from *Account*. Lost it? Delete `data/admin.json` and restart.

### Form notifications (set before launch)

Submissions are always stored and shown in the dashboard. To have them
forwarded as well, set these in the server's environment — never in
`site.json`, which is public:

| Variable | Effect |
|---|---|
| `RESEND_API_KEY` | Send a transactional acknowledgement to each valid form submitter via [Resend](https://resend.com). Contact/teardown confirmations promise a reply within one business day; newsletter welcomes include an unsubscribe `mailto:` link. |
| `NOTIFY_EMAIL_TO` | With `RESEND_API_KEY`, email each new submission to this comma-separated recipient list. |
| `NOTIFY_EMAIL_FROM` | Optional verified sender; otherwise Resend's onboarding sender is used. |
| `NOTIFY_WEBHOOK_URL` | JSON `POST` of every submission to a Slack incoming webhook, Zapier/Make, or a CRM endpoint. |

The server prints the notification status on boot; the admin *Overview*
warns when neither is configured.

Newsletter records include `consentAt` and `consentSource`. There is no bulk
newsletter sender in this repository yet, so unsubscribe requests go to the
site contact mailbox; when a sending platform is selected, implement its
suppression list there rather than deleting consent records.

### Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Platforms inject this. |
| `HOST` | `127.0.0.1`, or `0.0.0.0` when `PORT` is set by a platform | |
| `ADMIN_PASSWORD` | generated | Read only on first run. |
| `SECURE_COOKIES` | auto | Set `1` to force the `Secure` cookie flag; auto-on when `x-forwarded-proto: https`. |
| `TRUST_PROXY` | off | Set `1` behind a reverse proxy so rate limits key on `X-Forwarded-For`. |

### Security model

Session = HMAC-signed, `HttpOnly`, `SameSite=Strict` cookie, 12 h. Mutating
API calls additionally require an `X-Requested-With` header and a matching
`Origin`. Login is throttled (10 / 15 min per IP), form submissions too
(30 / 10 min). Every saved value is validated and length-capped server-side,
and all catalogue / settings strings are HTML-escaped when rendered.
`data/admin.json`, `data/submissions.json`, `data/draft.json` and
`data/history/` are never served.

Copy that may contain markup (strings tagged `html`) is sanitised in the
on-page editor (allow-list: `b strong em i a[href] br`), but the server only
length-caps it: the admin role is trusted at code-execution level anyway
(it can paste analytics snippets). Do not hand the password to anyone you
would not let edit the site's JavaScript.

The server binds to `127.0.0.1` by default; set `HOST=0.0.0.0` to expose it,
and put it behind HTTPS (nginx / Caddy / a platform proxy) before doing so.

---

## Deploying

**With the admin (recommended):** run `node server.js` on any host with Node
18+ (a VPS, Render, Railway, Fly, …). `PORT` and `HOST` are read from the
environment. Persist the `data/` directory.

**Static only:** copy the folder to any static host. The last published
`data/site.js` ships with it, so design/copy/catalogue edits are live. The
forms will show an error (there is nothing to POST to) unless the Node server
is reachable at `/api/submit` on the same origin.

---

## Developer notes

- Colours: change a token in `:root` (`css/style.css`) *or* from the
  dashboard; the dashboard wins because its `<style>` is injected later.
- Adding a page: copy an existing one (keep the head scripts and the
  `#site-header` / `#site-footer` mounts), give sections
  `data-section="page.sN"` if you want them toggleable, and it appears in
  *Pages & SEO* and the sitemap automatically.
- Adding a string: put it in both `en` and `az` in `js/i18n-data.js` and
  reference it with `data-i18n="ns.key"`. It shows up in *Copy* at once.
- `npm run check` syntax-checks every script.
- `npm test` also runs [test/server.test.js](test/server.test.js): 85
  integration checks in a disposable copy covering serving, auth, publish
  validation, structured data, submissions, acknowledgements and passwords.
- `npm run test:browser` drives an installed Chrome/Edge through its debugging
  protocol: 50 responsive, focus, inert-state, validation, editor and admin
  checks. Set `BROWSER_BIN` if Chromium is installed somewhere non-standard.
- Static design rules live in [DESIGN.md](DESIGN.md) and shared UI behavior in
  [UX-CONTRACT.md](UX-CONTRACT.md). Audit screenshots are intentionally ignored;
  the Markdown findings remain versioned under `audit/`.
