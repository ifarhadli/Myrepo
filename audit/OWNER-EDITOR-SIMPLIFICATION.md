**Owner editor simplification**

Implemented the approved everyday editing model:

- Select content to reveal its actions; keep keyboard-accessible action menus,
  Move up/down, dragging and Undo.
- Use the on-page editor as the main workspace. Put occasional tools in More
  and disclose the maintenance dashboard in Account.
- Choose/upload an image, describe it, adjust its crop, then Apply image.
  Upload completion does not change the page. Image library maintenance is
  separate; placement has one primary action and returns to the page on success.
- Offer Original, Calm and Editorial colour/font presets with an undoable Reset.
- Review only the changed areas, optionally open a private draft preview,
  then explicitly Publish changes.
- Add shared visible field explanations for website details, page/search
  settings, item metadata, metrics, team links, notifications and account
  controls. Help is linked to each field and retains validation associations.

The field copy distinguishes public contact email from private enquiry
recipients, draft changes from immediately saved account settings, dates from
automatic scheduling, and web-address changes from harmless text edits.

Verification: 206 server checks, 111 main browser checks, and 21 admin
regression checks passed. Strict UI audit and DESIGN.md lint reported zero
errors or warnings. Desktop and 390 px mobile screenshots were inspected.
Tests use isolated data copies and synthetic accounts/enquiries.

Evidence: [server](owner-simple-server.log), [browser](owner-simple-browser.log),
[static audit](owner-simple-static.log), [design lint](owner-simple-design-lint.log).

Screenshots: [image flow](final/screenshots/owner-image-apply-390.png),
[design presets](final/screenshots/owner-design-presets.png),
[settings explanations](admin-fixes/screenshots/website-details-mobile.png),
[item details](final/screenshots/owner-item-details.png).

The brand, fixed page structure and existing permission checks remain in use.
This is local verification; production deployment and provider delivery are
not part of this change. User comprehension has not been measured in a
moderated usability study.
