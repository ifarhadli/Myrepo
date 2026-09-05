---
version: alpha
name: "OmniMark"
description: "A high-accountability marketing agency site that turns a five-engine service model into one connected, editorial system."
colors:
  ink: "#0B0C10"
  paper: "#F4F1EA"
  signal: "#C6F24E"
  primary: "#4634F0"
  graphite: "#5B616E"
  alert: "#E2574C"
  surface: "#FFFFFF"
  surface-secondary: "#EAE6DC"
  engine-01-on-light: "#4634F0"
  engine-02-on-light: "#A63218"
  engine-03-on-light: "#4D6500"
  engine-04-on-light: "#006F66"
  engine-05-on-light: "#B51457"
  alert-on-light: "#98291F"
  alert-on-dark: "#FF8B82"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Trebuchet MS, system-ui, sans-serif"
  body:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
rounded:
  DEFAULT: "14px"
  sm: "8px"
  pill: "999px"
spacing:
  section-desktop: "128px"
  section-mobile: "72px"
  page-gutter-desktop: "32px"
  page-gutter-mobile: "20px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "12px"
  reading-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
  secondary-surface:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
  muted-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
  engine-01-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.engine-01-on-light}"
  engine-02-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.engine-02-on-light}"
  engine-03-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.engine-03-on-light}"
  engine-04-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.engine-04-on-light}"
  engine-05-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.engine-05-on-light}"
  alert-brand-swatch:
    backgroundColor: "{colors.alert}"
  alert-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.alert-on-light}"
  alert-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.alert-on-dark}"
---

# OmniMark Design System

## Overview

### Creative North Star

The public site should feel like an accountable campaign control room expressed with editorial restraint: dark operational panels, paper-like reading surfaces, and a five-colour signal path that follows work from brand to revenue.

### Product context and register

- **Audience and primary job:** senior marketing and revenue buyers evaluating whether one agency can own the whole path to purchase; administrators publishing the site without editing source files.
- **Target markets and evidence:** the current authored content names US locations and global/multi-market services. It does not establish one country as the exclusive market.
- **Locales and language policy:** English and Azerbaijani share one page architecture. English is the fallback when an Azerbaijani string is missing; owner-supplied launch copy still requires native review.
- **Usage scene:** public evaluation on phone and laptop; occasional desktop-oriented administration with a usable narrow-screen fallback.
- **Register:** hybrid. Public routes carry the expressive brand system; the authenticated on-page editor uses a thin neutral control layer that does not inherit owner-selected brand colours. `/admin-advanced.html` remains a quiet developer tool.
- **Memorable signature:** the five-engine spectrum is the single expressive device. It encodes the service journey and may appear in spines, signals, motion, and artwork.
- **Restraint:** forms, navigation, admin controls, errors, proof status, and content availability prioritize clarity and trust over spectacle.
- **Anti-references:** generic neon SaaS dashboards, decorative gradients with no information role, hover-only disclosure, and portfolio cards that imply content which does not exist.
- **Token ownership/runtime mapping:** `css/style.css` is the canonical public runtime token source. This file mirrors accepted values and intent. `js/site-config.js` applies administrator overrides, and `js/admin.js` exposes those same runtime token names.

## Colors

Ink and paper form the primary reading contrast. Signal lime is reserved for high-priority actions and expressive dark-surface moments. Primary violet (the runtime `--violet` token) owns links and focus. The five base engine colours remain the artwork/background palette; `*-on-light` variants are the semantic text colours on paper and white surfaces. Error copy uses `alert-on-light` or `alert-on-dark` according to its surface. Colour never carries availability, validation, or selection by itself.

## Typography

Bricolage Grotesque carries concise headlines, Inter carries interface and body text, and JetBrains Mono carries metadata, labels, and numbers. Public prose stays near a 70-character measure. Uppercase mono labels are short; instructions and errors use sentence case. Azerbaijani text may wrap and must not be constrained by English character counts.

## Layout

The public system uses a 1280px maximum content width, 32px desktop gutters, 20px phone gutters, and section rhythm of 128px/72px. Responsive grids use `minmax(0, …)` and collapse before their content overflows. Service side navigation becomes an in-flow horizontal jump list below 900px. Overlays own their scrolling; pages retain normal document scrolling.

## Elevation & Depth

Borders and tonal surfaces establish most hierarchy. Shadows are reserved for floating navigation, overlays, and hover lift on genuinely interactive cards. Static or unavailable cards stay flat. Backdrop blur is limited to sticky navigation.

## Shapes

Cards use 14px corners, small controls use 8px, and primary actions use pill geometry. Dark editorial callouts may use asymmetric radii when a coloured rule explains the relationship. Information diagrams use crisp strokes and restrained rounded nodes.

## Components

### Foundational visual states

Every enabled control has default, hover, focus-visible, active, disabled, and busy treatment where applicable. Focus uses violet on light surfaces and signal on dark surfaces. Text, not colour alone, communicates errors and unavailable content.

### Buttons and actions

Primary actions are signal-filled, secondary actions are bordered, and utility actions are text or ghost treatments. Busy buttons reserve their original dimensions. Navigation uses links; in-place actions use buttons.

### Navigation and data display

The desktop mega-menu is viewport-bounded and internally scrollable. The mobile navigation is modal, traps focus, makes the background inert, and restores focus on close. Service accordions synchronize visual, ARIA, visibility, and inert state. Tables retain an explicit horizontal scroll container on narrow screens.

The on-page editor bar is a 48px ink control rail above the public page. Its
one expressive cue is the signal-green edit status; sheets, dialogs and item
controls otherwise use neutral paper/ink surfaces and violet focus. Design is
a non-modal left sheet; Inbox, Settings and This page use the right operations
edge. Search and share previews stay inside bordered white cards, use authored
content fallbacks, and show an explicit loading/unavailable image state.
Phone preview centers one 390px page frame on a quiet gray work surface.

At 700px and below, the editor becomes a 62px ink bottom dock with exactly
three primary controls: Undo, signal-filled Publish, and More. Secondary
navigation moves into a full-screen paper sheet so the live page keeps its
reading width and no toolbar scroll is required. Compact dark **⋯** badges are
the touch equivalent of section and card hover rails; their actions open one
owned bottom sheet. Image slots retain a separate camera badge. Text-format
controls form a single horizontally scrollable dock immediately above the
visual keyboard, with Done held at the trailing edge. These are responsive
variants of the shared editor owners, not a second mobile design system.

Media uses the same neutral left sheet as Design. The upload target is a
bordered white drop surface with an explicit file-picker action; each file
gets a stable progress row before entering a compact two-column thumbnail
grid. Selection uses a violet border plus `aria-pressed`, never colour alone.
The selected image gets one large crop preview, concise metadata fields and a
crosshair focal control backed by keyboard-accessible axis sliders. On-page
slot actions are restrained dark pills that appear on hover/focus; empty slots
keep the action visible so absence never becomes an undiscoverable state.

Collection listings reuse the established public case, article, role, team and
testimonial compositions instead of introducing admin-looking cards. The
editor adds one compact neutral control rail above each item; public geometry
must not move when that rail is absent. Draft status is a written badge, and
unpublished records use reduced emphasis only as a secondary cue. Detail pages
keep the editorial reading measure, place operational metadata above the body,
and use the existing media-slot crop language. Rich body controls stay in the
editor's floating ink toolbar; they do not imitate a full document processor.
Collection empty states are direct and non-promotional, and no public card may
link to an item without a resolvable published route.

### Forms and overlays

Forms own validation with `novalidate`, visible linked field errors, first-error focus, preserved values, and duplicate-submit prevention. The mobile drawer and any admin confirmation surface use owned semantics, Escape behavior, focus containment, and focus restoration.

Editor sheets keep compact labels, stable field geometry and their own scroll
owner. Publish/Discard dialogs use a bordered paper surface, cancel-first
focus, sticky actions and the documented global layer scale. Hidden sections
and items remain visible only in edit mode at reduced opacity with a textual
badge; colour is never the sole status signal.

On phones, long editor sheets and publish dialogs fill the visual viewport;
headers/actions remain reachable across safe-area and virtual-keyboard
changes. Short contextual section/card choices remain bottom sheets with a
visible grab cue, clear text actions, focus containment, Escape dismissal and
focus restoration.

### Iconography

Icons are simple inline line symbols at the point of use. Unfamiliar and destructive actions retain visible text or a specific accessible name; icons never replace essential meaning.

### Motion

Motion communicates entrance, expansion, and spatial movement using the shared 260ms easing. The spectrum receives the strongest motion. Reduced-motion mode removes transforms and long transitions while preserving state feedback.

### Content and data visualization

Copy is direct, specific, and honest about what happens next. Proof remains unpublished until verified. Diagrams label their relationships in text and include accessible descriptions; decorative gradients are not presented as data.

## Do's and Don'ts

- **Do:** use the spectrum to explain the five-engine path and keep surrounding surfaces restrained.
- **Do:** keep public and admin behavior centralized in their shared scripts and tokens.
- **Don't:** make essential names, actions, validation, or content availability hover-only.
- **Don't:** use a card, link, metric, or schema to imply evidence or destination content that has not been supplied.
