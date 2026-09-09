# Page sections and local movement

Implemented the agreed first-stage change on `claude/site-build-brief-jpmkd6`.

- **This page → Page sections** shows readable section names, draft order,
  manual visibility and approval status. It includes fixed-position areas with
  an explanation. Move up/down and Hide/Restore reuse the established operations;
  Undo/Redo refresh the panel while retaining focus and scroll.
- Element drag stays available within compatible positions in the current
  section. Left/right button-row targets remain vertical. A hero button can
  leave its row and sit above its paragraph. Whole-section and existing
  list/collection dragging remain available.
- Earlier/Later and Alt+Up/Down share the local movement operation. Phone users
  can select content and use visible buttons or the existing action sheet.
  The generic cross-section Move to menu is removed.
- Catalogue reordering uses existing bilingual arrays and removal-key remapping.
  Added components retain their own placement record and editable fields.
- Saved cross-section placements continue rendering through the existing runtime.
  The change adds no persisted ordering, removal, draft or publication mechanism.

Two problems were resolved during verification: the runtime now remembers
authored section/list order so Undo can remove the first ordering override;
and generated button wrappers are considered when excluding no-op destinations,
allowing repeated Earlier/Later actions to progress beyond the current position.

## Verification

Baseline: 243 server checks, 182 browser checks and 111 regression checks passed.

Final checks:

- `npm test`: **243 passed, 0 failed**.
- `npm run test:browser`: **180 browser checks and 115 regression checks passed**.
- Strict frontend audit: **0 errors, 0 warnings**.
- `designmd lint DESIGN.md`: **0 errors, 0 warnings**.
- `git diff --check`: clean.

The movement journey replaces obsolete cross-section destination-menu assertions
with local movement and page-outline assertions. It includes Chromium mouse
press/move/release for button-row reordering and button-above-paragraph placement,
phone Earlier/Later, Alt+Up/Down, Escape cleanup, auto-scroll, Undo/Redo,
publication and public reload. The compatibility fixture contains an older
cross-section placement, added content, custom link/style, hidden content and
English/Azerbaijani text. It survives an unrelated edit/save/reload and is restored
through the existing History interface.

Desktop and 390px screenshots were inspected. Tests use disposable data copies,
synthetic accounts and isolated servers. They do not change the live website.
No observed owner usability session or physical-phone test is claimed. Further
settings/menu simplification remains a separate review stage.

Local evidence: [server log](section-editor-server.log),
[browser log](section-editor-browser.log), [static audit](section-editor-static.log),
[design lint](section-editor-design-lint.log).
