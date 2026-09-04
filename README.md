# OmniMark — marketing site + admin dashboard

Static, framework-free marketing site (15 pages, EN/AZ) with a zero-dependency
Node server that adds an **admin dashboard** for editing design, copy,
the services catalogue, page SEO, site settings and form submissions.

```
node server.js
#  OmniMark site   →  http://127.0.0.1:3000/
#  Admin dashboard →  http://127.0.0.1:3000/admin.html
#  First run: generated admin password  →  ************
```

Requires Node 18+. No `npm install` — there are no dependencies.

---

## Layout

```
*.html               15 pages (index, services, work, about, contact, …)
admin.html           the dashboard (needs server.js)
css/style.css        design tokens + every site component
css/admin.css        dashboard styles (independent of the site's tokens)
js/data.js           service catalogue: 5 engines × groups × sub-services, industries
js/i18n-data.js      EN + AZ dictionary — every string on the site (517 keys each)
js/site-config.js    applies the admin-saved config (tokens, fonts, copy, catalogue…)
js/partials.js       renders header, mega-menu, drawer, footer AND both accordions from data.js
js/i18n.js           swaps text on [data-i18n] elements, persists language choice
js/main.js           interactions: nav, drawer, accordions, forms, cookie banner, motion
js/admin.js          the dashboard
server.js            static server + /api for the dashboard (Node built-ins only)
data/site.json       what the dashboard saved (source of truth)
data/site.js         generated from site.json; loaded in <head> on every page
data/admin.json      password hash + session secret   (git-ignored)
data/submissions.json  contact / teardown / newsletter entries (git-ignored)
sitemap.xml, robots.txt  regenerated on every publish from Settings → Site URL
```

Script order on every page: `data/site.js` + `js/site-config.js` in `<head>`
(so colours/fonts land before first paint), then at the end of `<body>`:
`data.js → i18n-data.js → partials.js → i18n.js → main.js`.

---

## The admin dashboard

Sign in at `/admin.html`. Everything is a draft until **Save & publish**
(also `Ctrl/⌘+S`). Publishing writes `data/site.json`, regenerates
`data/site.js`, `sitemap.xml` and `robots.txt`.

| Tab | What you control |
|---|---|
| **Design** | Every colour token (`--ink`, `--signal`, engine accents `--c1…--c5`, …), radius, max-width, section spacing, transition speed, the three font families (Google Fonts), motion toggles (cursor, magnetic buttons, kinetic headlines, marquee, counters, reveal) and free-form **custom CSS**. Live preview iframe updates as you type. |
| **Copy & translations** | All ~350 non-catalogue strings in English and Azerbaijani, searchable, grouped by page. Emptying a field falls back to the code default. Strings tagged `html` contain markup. |
| **Services catalogue** | The five engines: names, promises, codenames, links, and every group / sub-service in both languages — add, remove, reorder. Mega-menu, drawer, footer and both accordions follow automatically. |
| **Industries** | The industry list (dropdown, drawer, strip), both languages. |
| **Pages & SEO** | Per-page `<title>` and meta description (injected server-side, and by JS on static hosts), and a checkbox per section to hide/show it. |
| **Settings** | Site name, public URL, default language, contact details, legal links, mega-menu density, proof gating, Organization / Article / JobPosting schema fields, Google Analytics ID and consent-gated tag snippets. |
| **Submissions** | Every contact-form, funnel-teardown and newsletter submission; filter, delete, export CSV. |
| **Account & backup** | Change password, export/import the whole config as JSON, reset to defaults. |

Untouched fields keep inheriting from the code, so a developer can still
change defaults in `data.js` / `i18n-data.js` / `style.css` without fighting
the dashboard.

Organization structured data is rendered server-side from the site settings
on every page. Article schema appears only when author and publication date
are filled in; JobPosting appears only when every required job field is
complete. Keep those fields empty until they exactly match the visible page.

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
`data/admin.json` and `data/submissions.json` are never served.

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
- `npm run check` syntax-checks every script; `npm test` also runs
  [test/server.test.js](test/server.test.js) — an end-to-end suite that boots
  the server in a temp copy and exercises static serving, auth, publish
  validation, meta injection, submissions and the password lifecycle
  (50+ checks, no dependencies).
