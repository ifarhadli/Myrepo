/* Shared Phase B desktop/phone journey in the disposable browser fixtures. */
'use strict';
module.exports=async function({evaluate:ev,go,viewport,check,screenshot,pause},width){
  async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(100);}throw Error('Move journey timed out: '+String(fn));}
  async function click(selector){if(!await ev(`!!document.querySelector(${JSON.stringify(selector)})`))throw Error('Missing move control '+selector);await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(110);}
  async function editor(){await go('/index.html?edit=1');await until(()=>ev(`!!window.OmniEditor?.getState().user&&!!document.querySelector('.omni-bar')`));}
  async function publish(){await click(width<=700?'[data-editor-mobile-publish]':'[data-editor-publish]');await until(()=>ev(`!!document.querySelector('[data-dialog-confirm]')`));await click('[data-dialog-confirm]');await until(()=>ev(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`));}
  const button='[data-i18n="home.hero.ctaSecondary"]',lede='[data-i18n="home.hero.lede"]';
  await viewport(width,900);await editor();
  await click('[data-i18n="home.hero.h1"]');check(width+'px headline has no movement controls',await ev(`!document.querySelector('[data-element-drag],[data-element-move]')`));
  await click('[data-i18n="home.cta.labelCompany"]');check(width+'px optional form fields cannot move',await ev(`!document.querySelector('[data-element-drag],[data-element-move]')`));
  await ev(`window.OmniEditor.commit(d=>{d.placements=[{key:'index:home.hero.h1',anchor:'index:home.hero.micro',position:'after'},{key:'index:home.cta.labelCompany',anchor:'index:home.hero.lede',position:'before'},{key:'index:home.hero.ctaSecondary',anchor:window.OmniSite.elementRemovalInfo(document.querySelector('.stat-row')).id,position:'into'},{key:'index:home.hero.lede',anchor:'index:missing.future',position:'after'}];},'Check placement guards')`);await pause(130);
  check(width+'px runtime rejects protected, incompatible and missing destinations',await ev(`document.querySelector('[data-i18n="home.hero.h1"]').nextElementSibling.matches('[data-i18n="home.hero.lede"]')&&!!document.querySelector('[data-i18n="home.cta.labelCompany"]').closest('form')&&!!document.querySelector(${JSON.stringify(button)}).closest('.hero')`));await click('[data-editor-undo]');
  await ev(`window.OmniEditor.commit(d=>{d.placements=[{key:'index:home.hero.ctaSecondary',anchor:'index:home.process.h2',position:'after'}];},'Move to light section')`);await pause(130);
  check(width+'px secondary buttons adapt to a light destination',await ev(`document.querySelector(${JSON.stringify(button)}).classList.contains('on-light')`));await click('[data-editor-undo]');
  check(width+'px Undo restores the authored button contrast',await ev(`!document.querySelector(${JSON.stringify(button)}).classList.contains('on-light')`));
  await click(lede);await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true}))`);await pause(140);
  check(width+'px Alt+Down moves one slot through the shared draft',await ev(`window.OmniEditor.getState().draft.placements.some(r=>r.key==='index:home.hero.lede')&&document.querySelector('[data-i18n="home.hero.lede"]').previousElementSibling.matches('.btn-row')`));
  await click('[data-editor-undo]');check(width+'px Undo restores the authored order',await ev(`document.querySelector('[data-i18n="home.hero.lede"]').nextElementSibling.matches('.btn-row')`));
  await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true}))`);await pause(130);
  check(width+'px Alt+Up moves to the preceding slot',await ev(`document.querySelector('[data-i18n="home.hero.lede"]').nextElementSibling.matches('h1')`));await click('[data-editor-undo]');
  await click(button);
  if(width>700){
    await ev(`document.querySelector('[data-element-drag]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}))`);
    check('element dragging uses the existing lifecycle and offers container ends',await ev(`document.documentElement.classList.contains('omni-dragging')&&document.querySelector('[data-i18n="home.hero.ctaSecondary"]').classList.contains('omni-drag-source')&&!!document.querySelector('.omni-element-dropzone.is-container')`));
    await screenshot('element-dropzones-'+width);
    await ev(`document.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:new DataTransfer(),clientY:innerHeight-2}))`);await pause(240);
    check('element drag auto-scrolls near the viewport edge',await ev(`scrollY>0`));
    const zone='[data-element-drop-anchor="index:home.cta.sub"][data-element-drop-position="after"]';
    await ev(`(()=>{const zone=document.querySelector(${JSON.stringify(zone)}),dt=new DataTransfer();zone.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);await pause(160);
    check('drop clears overlays and drag state',await ev(`!document.querySelector('.omni-element-dropzones')&&!document.documentElement.classList.contains('omni-dragging')`));
  }else{
    await ev(`document.querySelector(${JSON.stringify(button)}).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:40,clientY:320}))`);await pause(650);
    check('phone long-press opens the existing element action sheet',await ev(`!!document.querySelector('.omni-action-sheet[open] [data-action-label="Move to…"]')`));
    await click('[data-action-label="Move to…"]');
    check('Move to lists readable section names',await ev(`[...document.querySelectorAll('.omni-action-sheet [data-action-label]')].every(b=>!b.dataset.actionLabel.startsWith('index.'))`));
    await ev(`[...document.querySelectorAll('[data-action-label]')].find(b=>b.dataset.actionLabel.startsWith('Show us your funnel')).click()`);await pause(130);await screenshot('move-slots-'+width);
    await ev(`[...document.querySelectorAll('[data-action-label]')].find(b=>b.dataset.actionLabel.startsWith('Under: Twenty minutes')).click()`);await pause(130);
    check('Move to asks to confirm the chosen place',await ev(`document.querySelector('[data-dialog-confirm]').textContent==='Move here'`));await click('[data-dialog-confirm]');
  }
  check(width+'px moving to the CTA creates a button row and stores the placement',await ev(`(()=>{const el=document.querySelector(${JSON.stringify(button)});return !!el.closest('.cta-band')&&el.parentElement.matches('.btn-row')&&window.OmniEditor.getState().draft.placements.some(r=>r.key==='index:home.hero.ctaSecondary'&&r.anchor==='index:home.cta.sub')&&document.documentElement.scrollWidth<=innerWidth;})()`));
  check(width+'px movement is announced in the shared live region',await ev(`document.querySelector('.omni-toast').textContent.startsWith('Moved under:')`));
  check(width+'px moved secondary button stays readable on the signal CTA',await ev(`getComputedStyle(document.querySelector(${JSON.stringify(button)})).color===getComputedStyle(document.querySelector('.cta-band')).color`));
  await click('[data-editor-lang="az"]');await click('[data-editor-lang="en"]');
  check(width+'px language repaint is idempotent and keeps placement',await ev(`document.querySelectorAll(${JSON.stringify(button)}).length===1&&!!document.querySelector(${JSON.stringify(button)}).closest('.cta-band')`));
  await click('[data-editor-undo]');check(width+'px Undo returns the button and removes its temporary row',await ev(`!!document.querySelector(${JSON.stringify(button)}).closest('.hero')&&!document.querySelector('[data-omni-placement-row]')`));
  await click('[data-editor-redo]');await ev(`document.querySelector(${JSON.stringify(button)}).scrollIntoView({block:'center',behavior:'instant'})`);await screenshot('moved-element-'+width);
  // Add and move share one history snapshot; additions keep their own placement.
  await click(lede);await click('[data-element-add]');await click('[data-action-label="Paragraph"]');await until(()=>ev(`window.OmniEditor.getState().activeEdit?.key?.startsWith('added.')`));
  const added=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1).id`);
  await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Moved new paragraph';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(130);
  await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true}))`);await pause(130);
  check(width+'px moving an addition updates its record without a parallel placement',await ev(`(()=>{const s=window.OmniEditor.getState().draft,row=s.addedElements.find(r=>r.id===${JSON.stringify(added)});return row.anchor!=='index:home.hero.lede'&&!s.placements.some(r=>r.key.includes(${JSON.stringify(added)}));})()`));
  await publish();await go('/index.html');
  check(width+'px published placement survives public reload without editor chrome',await ev(`!!document.querySelector(${JSON.stringify(button)}).closest('.cta-band')&&!!document.querySelector('[data-omni-added="${added}"]')&&!document.querySelector('.omni-bar')&&document.documentElement.scrollWidth<=innerWidth`));
  await editor();await click('[data-editor-history]');await until(()=>ev(`!!document.querySelector('.omni-history__item button')`));await click('.omni-history__item button');await click('[data-dialog-confirm]');
  await until(()=>ev(`!document.querySelector('.omni-dialog')&&!!window.OmniEditor?.getState().draft&&!window.OmniEditor.getState().draft.addedElements.some(r=>r.id===${JSON.stringify(added)})`));
  check(width+'px History reverses Add and Move together',await ev(`!!document.querySelector(${JSON.stringify(button)}).closest('.hero')&&!document.querySelector('[data-omni-added="${added}"]')&&!window.OmniEditor.getState().draft.placements.length`));await publish();
  if(width>700){
    await go('/service-brand-launch.html?edit=1');await until(()=>ev(`!!window.OmniEditor?.getState().user`));await click('main [data-i18n="engines.e1.groups.0.items.0"]');
    await ev(`document.querySelector('[data-element-drag]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}))`);
    check('bullets only offer list slots and never button rows',await ev(`[...document.querySelectorAll('[data-element-drop-anchor]')].every(z=>{const anchor=window.OmniSite.findElements(z.dataset.elementDropAnchor).find(el=>el.closest('main')),container=z.dataset.elementDropPosition==='into'?anchor:anchor?.parentElement;return !!container&&container.matches('ul,ol')&&!container.matches('.btn-row');})`));
    await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);check('Escape cancels an element drag without changing the draft',await ev(`!document.documentElement.classList.contains('omni-dragging')&&!document.querySelector('.omni-element-dropzones')&&!window.OmniEditor.getState().draft.placements.length`));
    await click('[data-i18n="svcBrand.faq1q"]');await click('[data-element-add]');await click('[data-action-label="Another like this"]');await until(()=>ev(`!!window.OmniEditor.getState().activeEdit`));
    const faq=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1).id`);
    await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(130);
    await click('[data-omni-added="'+faq+'"] .faq-a-in');await click('[data-element-move]');
    check('moving a copied FAQ answer offers destinations for the whole FAQ',await ev(`document.querySelectorAll('.omni-action-sheet__body [data-action-label]').length===1`));
    await click('.omni-action-sheet__body [data-action-label]');
    await ev(`[...document.querySelectorAll('[data-action-label]')].find(b=>b.dataset.actionLabel.startsWith('Under: Who owns')).click()`);await pause(130);await click('[data-dialog-confirm]');
    check('moving an added component preserves all of its editable fields',await ev(`document.querySelector('[data-omni-added="${faq}"]').parentElement.matches('.faq-list')&&document.querySelector('[data-omni-added="${faq}"]').querySelectorAll('[data-i18n]').length===2&&!window.OmniEditor.getState().draft.placements.length`));
    await click('[data-element-remove]');await pause(1800);await editor();
  }
};
