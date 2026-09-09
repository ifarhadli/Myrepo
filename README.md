# OmniMark — marketing site + on-page editor

Static, framework-free marketing site (15 pages, EN/AZ) with a zero-dependency
Node server that adds an authenticated **on-page editor** for copy, layout,
images, reusable content collections, the services catalogue, design, settings
and form submissions.

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
admin-advanced.html  structured dashboard for content and enquiries
css/style.css        design tokens + every site component
css/admin.css        dashboard styles (independent of the site's tokens)
css/editor.css       authenticated editor bar, controls, sheets and preview
js/data.js           fallback catalogue, industries and collection records
js/i18n-data.js      EN + AZ dictionary — every string on the site (592 keys each)
js/site-config.js    applies the admin-saved config (tokens, fonts, copy, catalogue…)
js/partials.js       renders shared navigation, accordions and collection listings
js/i18n.js           swaps text on [data-i18n] elements, persists language choice
js/main.js           interactions: nav, drawer, accordions, forms, cookie banner, motion
js/editor.js         on-page editing, draft autosave, undo/redo, panels
js/login.js          editor sign-in and authenticated redirect
js/preview.js        public-safe shell for expiring private draft previews
js/admin.js          advanced dashboard
server.js            static server + /api for the dashboard (Node built-ins only)
data/site.json       what the dashboard saved (source of truth)
data/site.js         generated from site.json; loaded in <head> on every page
data/draft.json      private unpublished editor draft (git-ignored)
data/media.json      private media index (git-ignored)
data/media/          originals + responsive variants (git-ignored; served at /media/:id)
data/admin.json      users/roles/recovery + private notification settings (git-ignored)
data/submissions.json  contact / teardown / newsletter entries (git-ignored)
sitemap.xml, robots.txt  regenerated on every publish from configured site URL
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
editor bar. Click an element to select it, then choose **Edit text** (or click
the selected text again) to edit it. Switch between EN and AZ in the
bar, and select a section to hide, recolour or reorder it.
Reorder or remove supported cards in place; service and industry catalogue
items can also be added. **Design** offers Original, Calm and Editorial presets, plus Reset design.
Individual colour and font controls stay outside everyday editing. **Phone** previews the current
page in a contained 390 px layout.

**Adding elements, links and styles:** select content and choose **Add**.
**Another like this** copies its English and Azerbaijani words into independently
editable text. The menu also offers designed paragraphs, bullets, buttons,
stats, FAQs, steps or cards where they fit. New text opens ready to type;
switch EN/AZ to edit each language. **Link** chooses a page, this page's section,
published item, URL, email or phone destination. Buttons offer **Primary**,
**Secondary** and **Text** styles. Changes use the same draft, review and Publish.
Removing an added element deletes its record and overrides; Undo restores them.
Adding form fields and copying protected controls are unavailable.

**Moving elements:** select content, then drag its handle to a highlighted line
or container end. Only places that fit the component are offered; the page scrolls
as you drag near its edges. **Move to…** offers the same destinations by section
and confirms the chosen place. On phones, long-press content and choose **Move to…**,
or use the selection toolbar. **Alt+↑/↓** moves selected content one slot outside
text entry. Buttons placed between blocks get a button row automatically. Hidden
sections remain valid destinations and stay hidden. Form fields, navigation and
protected controls cannot move. Undo, Remove and History work after moving;
Publish makes the placement live.

**Removing elements:** select text, a button, bullet, image, stat or other
content and choose **Remove**. This hides it for visitors after **Publish**;
it stays faded and labelled in the editor. **Restore**, **Undo**, and published
**History** bring it back without losing content. Button text removes the whole
button, and a form label removes its whole field. Name, email, consent and
submit controls, the site wordmark, language switch, cookie controls and page
headline are protected; the disabled Remove button explains why. Shared menu
links and catalogue entries are removed wherever they appear, in both languages.
Delete/Backspace removes the selected element outside text entry; Escape clears
selection. On phones, **Actions** offers the same Remove/Restore choices.

On screens up to 700 px, edit mode becomes a thumb-reachable bottom dock with
**Undo**, **Review changes**, and **More**. More opens the page switcher, EN/AZ,
Design, This page, Image library, History, Preview, Inbox, role-appropriate Settings
and Users, and Discard in one full-screen sheet. Section and card **⋯** buttons replace hover controls with
Hide/Show, Accent, Move, status, image, and delete actions. Image slots keep a
visible camera button, and every text edit has a **Done** action docked above
the on-screen keyboard. The desktop editor and its 390 px preview remain
unchanged above this breakpoint.

**Preview** creates one revocable private link to the saved draft. The link
expires after seven days, is excluded from search, blocks forms, and carries a
clear “Preview — not live” ribbon. Creating another link replaces the old one;
publishing or discarding the draft revokes it automatically.

Image positions are fixed by the design. Hover a hero, case, team, logo,
article, case-study or mega-menu image slot and choose **Add image** / **Change
image**, or drop an image directly on the slot. **Image library** opens
from More; page-sharing settings open the image chooser. It accepts PNG, JPEG and WebP
(not SVG), creates 480/960/1600 px responsive versions in the browser, and
stores a reusable private library. Alt text is required before a slotted image
can be published. Click the preview or use its two keyboard-accessible sliders
to set the focal point that every crop keeps visible. Removing a slot keeps the
library item; permanent library deletion is blocked while any live, draft or
retained-history version still uses it.

Select text to edit it. Section and card actions appear for the selected
content; each also has a keyboard-accessible actions menu. Move up/down is
explicit and dragging remains optional. **More** holds image-library, design,
history and other occasional tasks; Account contains the maintenance link.

Image changes follow **Choose/upload → Adjust crop → Apply image**. Uploading
alone adds a library file; applying changes the draft and returns to the page.
Library management is separate from image placement. Settings, page metadata,
item details and account fields include linked explanations of what they
change, including timing and empty-value behavior where relevant.

**Review changes** lists only changed areas and offers a private preview
before **Publish changes** updates the live site.

Changes autosave to the private `data/draft.json` file and a local browser
backup. Undo/redo covers the current session. **Review changes** shows the
changed areas; **Publish changes** then writes `data/site.json` and regenerates `data/site.js`,
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

Draft records also carry a revision and the last editor’s identity. If another
person saves first, the stale browser keeps its local copy and must explicitly
load the latest shared draft instead of overwriting it.

The **Inbox** panel searches and paginates enquiries newest first, tracks unread
state, opens a reply in the owner's mail app and exports all matching rows as
spreadsheet-safe CSV. **This page** edits the
current page's search title, description, social image and index visibility,
with live Google and LinkedIn/WhatsApp previews. **Settings** has three tasks:
**Website details** (seven main fields and collapsed policy/booking links),
**Enquiry emails** (private recipients and a test email), and **Account**
(password, recovery email and sign out). Every role can reach Account from
More and sign out. Approved proof visibility belongs in **This page**.
Technical deployment settings, raw layout values, scripts and legacy global
article/job metadata are not owner-facing controls; existing values remain
supported in configuration.

Admins also see **Users**, where they can invite up to ten people by email,
choose Admin or Editor, change roles, disable access, restore it, and resend a
pending invitation. Editors can edit and publish content, use the inbox, and
upload or update media. Only Admins can manage users, account/server settings,
the advanced dashboard, or permanently delete media files.

Cases, articles and jobs are real collections with clean public URLs such as
`/work/saas-pipeline-rebuild`, `/insights/mql-is-dead` and
`/careers/senior-media-buyer`. Team members and testimonials use the same
collection model on their listing pages. In edit mode, use **+ New**, open an
item, edit EN/AZ text directly, and use **Item details** for slugs, filters,
dates, metrics and application metadata. Collection cards can be reordered,
duplicated, unpublished or deleted; unpublished records remain visible with a
Draft badge only to an authenticated editor. Rich item bodies support
paragraphs, headings, lists, quotes and inline formatting. Publish updates the
listing, detail route, metadata, structured data and sitemap together.

### Advanced dashboard

`/admin-advanced.html` provides a structured view of content, four brand colours,
contact details, per-page SEO, enquiries, account/password, and configuration
export/import. Configuration export excludes accounts, enquiries, media and
publish history; operational backups must separately preserve `data/`. The on-page
**This page** panel is now the preferred SEO workflow. The dashboard links
back to the on-page editor. Both admin routes are excluded from the sitemap
and disallowed in `robots.txt`.

Untouched fields inherit from `data.js`, `i18n-data.js` and `style.css`, so
code defaults remain the fallback instead of being copied into every draft.

Organization structured data is rendered server-side from the site settings
on every page. Article and JobPosting schema is generated from each published
collection item; JobPosting appears only when its required location, closing
date and HTTPS application URL are complete. Legacy structured-data settings
remain only as a fallback when no collection records exist.
Unconfigured privacy/terms destinations render as muted non-links rather than
false links; add the approved URLs in *Settings* before launch.

### Password

On first start the server generates a password, prints it once, and stores
only a scrypt hash in `data/admin.json`. Set `ADMIN_PASSWORD=…` and optionally
`ADMIN_EMAIL=…` before the first run. In editor *Settings → Account*, set or
change the Admin recovery email (Resend must also be configured) and password.
*Forgot password?* sends a non-enumerating, single-use link that expires after
30 minutes. An invitation uses the same set-password screen and expires after
48 hours. Password and role changes invalidate only that user’s sessions.
Legacy single-password `admin.json` files migrate automatically to one Admin
account. Without recovery configuration, the sign-in page honestly explains
the server-side reset fallback.

### Form notifications (set before launch)

Submissions are always stored and shown in the dashboard. To have them
forwarded as well, set these in the server's environment — never in
`site.json`, which is public:

| Variable | Effect |
|---|---|
| `RESEND_API_KEY` | Send a transactional acknowledgement to each valid form submitter via [Resend](https://resend.com). Contact/teardown confirmations promise a reply within one business day; newsletter welcomes include an unsubscribe `mailto:` link. |
| `NOTIFY_EMAIL_TO` | With `RESEND_API_KEY`, fallback comma-separated lead recipients when no private recipients are saved in the editor. |
| `NOTIFY_EMAIL_FROM` | Optional verified sender; otherwise Resend's onboarding sender is used. |
| `NOTIFY_WEBHOOK_URL` | JSON `POST` of every submission to a Slack incoming webhook, Zapier/Make, or a CRM endpoint. |

In editor *Settings → Enquiry emails*, up to ten recipients can be saved
privately and tested with one click. A non-empty saved list takes precedence
over `NOTIFY_EMAIL_TO`; the UI and advanced *Overview* identify the active
source. The server prints the notification status on boot and the dashboard
warns when neither email nor webhook forwarding is configured.

Each enquiry retains email status separately from the enquiry itself.
Failed internal email notifications retry up to three total attempts, 30 seconds
apart, using the same request idempotency key. Pending work resumes after a
restart only within one hour; older uncertain sends are marked unconfirmed.
A changed payload is not resent under the original key. Accepted means the
provider accepted the request, not that the recipient read or received it.
Webhook failures are recorded as unconfirmed without automatic replay.
Enquiries are retained until explicitly deleted; there is no automatic
10,000-record truncation.

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
| `ADMIN_EMAIL` | empty | Optional first Admin email, read only when a new `data/admin.json` is created. |
| `SECURE_COOKIES` | auto | Set `1` to force the `Secure` cookie flag; auto-on when `x-forwarded-proto: https`. |
| `TRUST_PROXY` | off | Set `1` behind a reverse proxy so rate limits key on `X-Forwarded-For`. |

### Security model

Session = HMAC-signed, `HttpOnly`, `SameSite=Strict` cookie, 12 h. Mutating
API calls additionally require an `X-Requested-With` header and a matching
`Origin`. Login is throttled (10 / 15 min per IP), recovery requests are
limited to 3 / 15 min, reset attempts to 5 / 15 min, notification tests to
3 / 10 min, and form submissions to 30 / 10 min. Every saved value is
validated and length-capped server-side,
and all catalogue / settings strings are HTML-escaped when rendered.
`data/admin.json`, `data/submissions.json`, `data/draft.json`,
`data/media.json`, `data/media/` and `data/history/` are never served as raw
private paths. Approved image bytes are exposed only through opaque,
allow-listed `/media/<id>-<width>.webp` or original URLs. Uploads are
magic-byte checked; originals are capped at 8 MB, variants at 2 MB, and the
library at 500 files / 500 MB. Upload writes are throttled to 60 / 10 min per
IP. User invitations are limited to 10 / hour and preview-link creation to 20
/ hour.

Copy that may contain markup (strings tagged `html`) is sanitised in the
on-page editor (allow-list: `b strong em i a[href] br`). Collection bodies use
the wider editorial allow-list (`p h2 h3 ul ol li blockquote b strong em i
a[href] br`) in both the editor and server, so scripts, event handlers and
unsupported markup are removed before storage. The administrator can still
paste analytics snippets, so only the Admin role can reach those settings.

The server binds to `127.0.0.1` by default; set `HOST=0.0.0.0` to expose it,
and put it behind HTTPS (nginx / Caddy / a platform proxy) before doing so.

---

## Deploying

**With the admin (recommended):** run `node server.js` on any host with Node
18+ (a VPS, Render, Railway, Fly, …). `PORT` and `HOST` are read from the
environment. Persist the `data/` directory.

Persist the entire directory, including `data/media/`; media originals and
variants are not stored in Git.

**Static only:** copy the folder to any static host. The last published
`data/site.js` ships with it, so design/copy/catalogue/collection listings are
live. Static detail fallbacks use `case-study.html?item=<slug>`,
`article.html?item=<slug>` and `role-detail.html?item=<slug>`; clean collection
URLs, media library URLs and forms require the Node server. There is no
static-media export command yet.

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
- `npm test` also runs [test/server.test.js](test/server.test.js):
  integration checks in a disposable copy covering serving, auth, publish,
  media and collection validation/storage, clean item routing, structured
  data, submissions, acknowledgements, account migration, roles, concurrent
  draft guards, preview links, addition validation and link destinations.
- `npm run test:browser` drives an installed Chrome/Edge through its debugging
  protocol: responsive, media, collection lifecycle, focus, inert-state,
  validation, role, preview, editor and admin checks. Set `BROWSER_BIN` if Chromium is
  installed somewhere non-standard. The shared Add/Link/Style journey verifies
  bilingual copies, publishing, Remove, Undo and History at desktop and phone widths.
- Static design rules live in [DESIGN.md](DESIGN.md) and shared UI behavior in
  [UX-CONTRACT.md](UX-CONTRACT.md). Audit screenshots are intentionally ignored;
  the Markdown findings remain versioned under `audit/`.
