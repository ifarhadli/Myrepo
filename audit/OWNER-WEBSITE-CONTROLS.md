# Owner website controls — 9 September 2026

Implemented on `claude/site-build-brief-jpmkd6` using the existing settings,
draft/publish and media workflows.

## Owner tasks

- Services opens the Services page directly from desktop and mobile navigation.
- Settings → Website details → Offer English version controls public availability.
  Turning it off forces Azerbaijani for visitors, including returning visitors
  who previously chose English. English content remains editable and can be
  offered again. The starting-language field appears only when both languages
  are available.
- Website details → Choose or replace logo opens the existing image library.
  Selecting the brand itself also offers Change logo. Header, mobile menu and
  footer update together. Logos retain their proportions; irrelevant cropping
  controls are hidden. Logo name starts with the business name and is editable.
  Apply, Undo, Redo and removing the assignment use the existing machinery.
- Under construction takes effect after publishing. Public document routes show
  a temporary Azerbaijani screen with the published brand and contact email.
  Login, authenticated editing and signed private previews remain available.
  Turn the toggle off and publish to reopen the site.

## Evidence

- `npm test`: 261 passed, zero failures.
- `npm run test:browser`: 209 smoke checks and 115 regression checks passed.
- Final focused owner run: 56 checks passed, including additional logo Undo/Redo
  checks at 1366 px and 390 px. Run with `OWNER_CONTROLS_ONLY=1` and
  `node test/browser-smoke.js`.
- Premium strict audit: zero errors or warnings. DESIGN.md lint: zero errors or
  warnings. `git diff --check` passed.
- Reviewed screenshots of desktop settings, phone logo assignment, public brand
  rendering and the phone construction screen. Evidence is local under
  `audit/final/screenshots/owner-*.png`.
- Browser scenarios upload a synthetic logo and use real pointer input for the
  visible owner controls. Server scenarios check permissions, unpublished versus
  published availability, anonymous access, private previews and reopening.

## Delivery limits

No production settings or real media were changed. The actual client logo has
not been supplied in this workspace; synthetic logos exist only in disposable
test sites. Deployment and assigning the supplied brand asset remain separate
from this implementation. English remains available and construction remains off
by default until an Admin changes and publishes those settings.
