/* Section-scoped movement and compatibility in disposable desktop/phone fixtures. */
'use strict';
module.exports=async function({evaluate:ev,go,viewport,check,screenshot,pause,send},width){
  async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(100);}throw Error('Move journey timed out: '+String(fn));}
  async function click(selector){if(!await ev(`!!document.querySelector(${JSON.stringify(selector)})`))throw Error('Missing move control '+selector);await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(130);}
  async function editor(route='/index.html?edit=1'){await go(route);await until(()=>ev(`!!window.OmniEditor?.getState().user&&!!document.querySelector('.omni-bar')`));}
  async function publish(){await click(width<=700?'[data-editor-mobile-publish]':'[data-editor-publish]');await until(()=>ev(`!!document.querySelector('[data-dialog-confirm]')`));await click('[data-dialog-confirm]');await until(()=>ev(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`));}
  async function escape(){await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await pause(130);}
  async function restoreDraft(value){await ev(`window.OmniEditor.commit(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,${JSON.stringify(value)});},'Restore test baseline')`);await pause(150);}
  async function startDrag(){await ev(`document.querySelector('[data-element-drag]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}))`);}
  let pointerTrace;
  async function pointerDrag(zone){
    await ev(`document.querySelector(${JSON.stringify(button)}).scrollIntoView({block:'center',behavior:'instant'})`);await pause(200);
    const source=await ev(`(()=>{const r=document.querySelector('[data-element-drag]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...source});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...source,button:'left',buttons:1,clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:source.x+12,y:source.y+12,button:'left',buttons:1});
    await until(()=>ev(`!!document.querySelector(${JSON.stringify(zone)})`));
    const target=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(zone)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    for(let i=1;i<=8;i++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:source.x+(target.x-source.x)*i/8,y:source.y+(target.y-source.y)*i/8,button:'left',buttons:1});await pause(35);}
    // Chromium needs a movement after dragenter to deliver dragover before release.
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x+1,y:target.y,button:'left',buttons:1});await pause(100);
    pointerTrace=await ev(`(()=>{const hit=document.elementFromPoint(${target.x},${target.y});return {source:${JSON.stringify(source)},target:${JSON.stringify(target)},hit:hit?.outerHTML,over:document.querySelector('.omni-element-dropzone.is-over')?.outerHTML};})()`);
    await pause(100);await send('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',buttons:0,clickCount:1});await pause(250);
  }
  const button='[data-i18n="home.hero.ctaSecondary"]',lede='[data-i18n="home.hero.lede"]';
  await viewport(width,900);await editor();
  const baseline=await ev(`JSON.parse(JSON.stringify(window.OmniEditor.getState().draft))`);
  const originalOrder=await ev(`[...document.querySelectorAll('main > [data-section]')].map(s=>s.dataset.section)`);
  await click('[data-editor-page]');
  check(width+'px Page sections matches the page sequence without dirtying the draft',await ev(`JSON.stringify([...document.querySelectorAll('[data-page-section][data-reorderable="true"]')].map(r=>r.dataset.pageSection))===${JSON.stringify(JSON.stringify(originalOrder))}&&JSON.stringify(window.OmniEditor.getState().draft)===${JSON.stringify(JSON.stringify(baseline))}`));
  check(width+'px hero is discoverable with its fixed-position boundary explained',await ev(`document.querySelector('[data-page-section="index.hero"] [data-page-section-status]').textContent.includes('Fixed position')&&document.querySelector('[data-page-section="index.hero"] [data-page-section-down]').disabled`));
  check(width+'px Page sections uses readable labels and explicit availability',await ev(`[...document.querySelectorAll('[data-page-section-select]')].every(b=>b.textContent.trim()&&!b.textContent.startsWith('index.'))&&document.querySelector('[data-page-section="index.s1"] [data-page-section-status]').textContent.includes('Not approved')`));
  const row='[data-page-section="index.s1"]';
  await click(row+' [data-page-section-toggle]');
  check(width+'px hiding proof does not enable publication approval',await ev(`document.querySelector('${row} [data-page-section-status]').textContent==='Hidden by you · Approval also required'&&!window.OmniEditor.getState().draft.features.showVerifiedProof`));
  await click(row+' [data-page-section-toggle]');
  await ev(`document.querySelector('${row} [data-page-section-down]').focus()`);await click(row+' [data-page-section-down]');
  check(width+'px section movement updates page, draft, panel and keeps focus',await ev(`(()=>{const order=[...document.querySelectorAll('main > [data-section]')].map(s=>s.dataset.section);return order.indexOf('index.s1')===${originalOrder.indexOf('index.s1')+1}&&JSON.stringify(order)===JSON.stringify(window.OmniEditor.getState().draft.sectionOrder.index)&&JSON.stringify(order)===JSON.stringify([...document.querySelectorAll('[data-page-section][data-reorderable="true"]')].map(r=>r.dataset.pageSection))&&document.activeElement.matches('${row} [data-page-section-down]');})()`));
  await click('[data-editor-undo]');
  check(width+'px Undo refreshes Page sections in place',await ev(`JSON.stringify([...document.querySelectorAll('[data-page-section][data-reorderable="true"]')].map(r=>r.dataset.pageSection))===${JSON.stringify(JSON.stringify(originalOrder))}`));
  check(width+'px first and last section boundaries are disabled',await ev(`document.querySelector('[data-page-section]:first-child [data-page-section-up]').disabled&&document.querySelector('[data-page-section]:last-child [data-page-section-down]').disabled`));
  await screenshot('page-sections-'+width);await click('.omni-panel__close');await restoreDraft(baseline);

  await click('[data-i18n="home.hero.h1"]');check(width+'px headline has no movement controls',await ev(`!document.querySelector('[data-element-drag],[data-element-step]')`));
  await click('[data-i18n="home.cta.labelCompany"]');check(width+'px form fields cannot move',await ev(`!document.querySelector('[data-element-drag],[data-element-step]')`));
  await ev(`window.OmniEditor.commit(d=>{d.placements=[{key:'index:home.hero.h1',anchor:'index:home.hero.micro',position:'after'},{key:'index:home.cta.labelCompany',anchor:'index:home.hero.lede',position:'before'},{key:'index:home.hero.ctaSecondary',anchor:window.OmniSite.elementRemovalInfo(document.querySelector('.stat-row')).id,position:'into'},{key:'index:home.hero.lede',anchor:'index:missing.future',position:'after'}];},'Check placement guards')`);await pause(130);
  check(width+'px runtime rejects protected, incompatible and missing destinations',await ev(`document.querySelector('[data-i18n="home.hero.h1"]').nextElementSibling.matches('${lede}')&&!!document.querySelector('[data-i18n="home.cta.labelCompany"]').closest('form')&&!!document.querySelector('${button}').closest('.hero')`));await click('[data-editor-undo]');
  await click(lede);await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true}))`);await pause(140);
  check(width+'px Alt+Down moves below the button row within the hero',await ev(`document.querySelector('${lede}').previousElementSibling.matches('.btn-row')&&!!document.querySelector('${lede}').closest('.hero')`));await click('[data-editor-undo]');
  await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true}))`);await pause(130);
  check(width+'px Alt+Up moves to the preceding slot',await ev(`document.querySelector('${lede}').nextElementSibling.matches('h1')`));await click('[data-editor-undo]');
  await click(button);
  if(width>700){
    await startDrag();
    check('drag targets stay inside the current hero',await ev(`(()=>{const zones=[...document.querySelectorAll('[data-element-drop-anchor]')];return zones.length>0&&zones.every(z=>window.OmniSite.findElements(z.dataset.elementDropAnchor).some(el=>el.closest('.hero')))&&!zones.some(z=>z.dataset.elementDropAnchor==='index:home.cta.sub');})()`));
    check('left/right row targets retain vertical geometry',await ev(`(()=>{const z=document.querySelector('[data-element-drop-anchor="index:home.hero.ctaPrimary"][data-element-drop-position="before"]'),r=document.querySelector('.hero .btn-row').firstElementChild.getBoundingClientRect();return z.dataset.elementDropFlow==='row'&&z.classList.contains('is-vertical')&&Math.abs(parseFloat(z.style.left)+10-r.left)<3;})()`));
    await screenshot('section-dropzones-'+width);
    await ev(`document.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:new DataTransfer(),clientY:innerHeight-2}))`);await pause(240);
    check('drag still auto-scrolls at the viewport edge',await ev(`scrollY>0`));await escape();
    check('Escape removes drop zones without writing a placement',await ev(`!document.querySelector('.omni-element-dropzones')&&!document.documentElement.classList.contains('omni-dragging')&&!window.OmniEditor.getState().draft.placements.length`));
    await pointerDrag('[data-element-drop-anchor="index:home.hero.ctaPrimary"][data-element-drop-position="before"]');
    check('real mouse drag reorders left/right and clears drag state',await ev(`document.querySelector('.hero .btn-row').firstElementChild.matches('${button}')&&!document.documentElement.classList.contains('omni-dragging')&&!document.querySelector('.omni-element-dropzones')`),JSON.stringify(pointerTrace));
    await click('[data-editor-undo]');await escape();await click(button);
    await pointerDrag('[data-element-drop-anchor="index:home.hero.h1"][data-element-drop-position="after"]');
  }else{
    check('phone exposes Earlier and Later without long press',await ev(`!!document.querySelector('[data-element-step="-1"]')&&!!document.querySelector('[data-element-step="1"]')&&!document.querySelector('[data-element-move]')`));
    await click('[data-element-step="-1"]');
    check('phone Earlier reorders buttons left/right',await ev(`document.querySelector('.hero .btn-row').firstElementChild.matches('${button}')`));
    await click('[data-element-step="1"]');
    check('phone Later returns a button to the end of its row',await ev(`document.querySelector('.hero .btn-row').lastElementChild.matches('${button}')`));
    await click('[data-element-actions]');
    check('phone sheet has local controls and no generic Move to menu',await ev(`!!document.querySelector('[data-action-label="Earlier"]')&&!!document.querySelector('[data-action-label="Later"]')&&!document.querySelector('[data-action-label="Move to…"]')`));await click('[data-action-sheet-close]');
    for(let i=0;i<6&&!await ev(`document.querySelector('${button}').parentElement.nextElementSibling?.matches('${lede}')`);i++)await click('[data-element-step="-1"]');
  }
  check(width+'px hero button can move out of its row above the paragraph',await ev(`document.querySelector('${button}').parentElement.matches('.btn-row')&&document.querySelector('${button}').parentElement.nextElementSibling.matches('${lede}')&&!!document.querySelector('${button}').closest('.hero')`));
  await click('[data-editor-lang="az"]');await click('[data-editor-lang="en"]');
  check(width+'px language repaint preserves a single moved button',await ev(`document.querySelectorAll('${button}').length===1&&document.querySelector('${button}').parentElement.nextElementSibling.matches('${lede}')`));
  await screenshot('local-move-'+width);
  const moved=await ev(`JSON.stringify(window.OmniEditor.getState().draft.placements)`);
  await click('[data-editor-undo]');await click('[data-editor-redo]');
  check(width+'px Redo restores the same local placement',await ev(`JSON.stringify(window.OmniEditor.getState().draft.placements)===${JSON.stringify(moved)}&&document.querySelector('${button}').parentElement.nextElementSibling.matches('${lede}')`));
  await publish();await go('/index.html');
  check(width+'px local movement survives publishing and public reload',await ev(`document.querySelector('${button}').parentElement.nextElementSibling.matches('${lede}')&&!document.querySelector('.omni-bar')&&document.documentElement.scrollWidth<=innerWidth`));
  await editor();await restoreDraft(baseline);

  // Old cross-section layouts still render, save and restore through the same runtime.
  const added='ae-1234abcd';
  await ev(`window.OmniEditor.commit(d=>{d.placements=[{key:'index:home.hero.ctaSecondary',anchor:'index:home.cta.sub',position:'after'}];d.addedElements=[{id:'${added}',scope:'index',kind:'paragraph',anchor:'index:home.hero.lede',position:'after'}];d.elementLinks={'index:home.hero.ctaSecondary':'contact.html#teardown'};d.elementStyles={'index:home.hero.ctaSecondary':'secondary'};d.hiddenElements=['index:home.hero.micro'];d.hiddenSections=['index.s1'];d.i18n=d.i18n||{};d.i18n.en=d.i18n.en||{};d.i18n.az=d.i18n.az||{};d.i18n.en['added.${added}']='Compatibility paragraph';d.i18n.az['added.${added}']='Uyğunluq mətni';},'Compatibility fixture')`);await publish();await go('/index.html');
  check(width+'px old placement, link, style and hidden state render publicly',await ev(`!!document.querySelector('${button}').closest('.cta-band')&&document.querySelector('${button}').getAttribute('href')==='contact.html#teardown'&&document.querySelector('${button}').classList.contains('btn-secondary')&&getComputedStyle(document.querySelector('[data-i18n="home.hero.micro"]')).display==='none'&&!document.querySelector('.omni-bar')&&document.documentElement.scrollWidth<=innerWidth`));
  await editor();
  const fixture=await ev(`JSON.parse(JSON.stringify(window.OmniEditor.getState().draft))`);
  await click('[data-editor-page]');await click('.omni-panel__close');
  check(width+'px opening Page sections leaves old configuration unchanged',await ev(`JSON.stringify(window.OmniEditor.getState().draft)===${JSON.stringify(JSON.stringify(fixture))}`));
  await click('[data-editor-lang="az"]');
  check(width+'px compatibility addition retains Azerbaijani',await ev(`document.querySelector('[data-omni-added="${added}"]').textContent==='Uyğunluq mətni'`));await click('[data-editor-lang="en"]');
  await click(lede);await click('[data-element-edit]');await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Unrelated edited introduction';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(150);await publish();await editor();
  check(width+'px unrelated edit/save/reload preserves compatibility data',await ev(`['placements','addedElements','elementLinks','elementStyles','hiddenElements','hiddenSections'].every(k=>JSON.stringify(window.OmniEditor.getState().draft[k])===JSON.stringify(${JSON.stringify(fixture)}[k]))`));
  await click('[data-editor-history]');await until(()=>ev(`!!document.querySelector('.omni-history__item button:not(:disabled)')`));await click('.omni-history__item button');await click('[data-dialog-confirm]');await until(()=>ev(`!document.querySelector('.omni-dialog')&&!!window.OmniEditor?.getState().user&&document.querySelector('${lede}').textContent!=='Unrelated edited introduction'`));
  check(width+'px History restores the fixture without resetting placements',await ev(`!!document.querySelector('${button}').closest('.cta-band')&&document.querySelector('[data-omni-added="${added}"]').textContent==='Compatibility paragraph'&&['placements','addedElements','elementLinks','elementStyles','hiddenElements','hiddenSections'].every(k=>JSON.stringify(window.OmniEditor.getState().draft[k])===JSON.stringify(${JSON.stringify(fixture)}[k]))`));
  await restoreDraft(baseline);await publish();

  await editor('/service-brand-launch.html?edit=1');
  const serviceBaseline=await ev(`JSON.parse(JSON.stringify(window.OmniEditor.getState().draft))`);
  const service='main [data-i18n="engines.e1.groups.0.items.0"]';
  const names=await ev(`({en:(window.OmniEditor.getState().draft.engines||window.OmniEditor.getState().defaults.engines)[0].groups[0].items.slice(0,2),az:window.OM_I18N.az.engines.e1.groups[0].items.slice(0,2)})`);
  await click(service);await click('[data-element-step="1"]');
  check(width+'px static bullet ordering changes its own list sequence',await ev(`document.querySelector('${service}').parentElement.children[1].matches('[data-i18n="engines.e1.groups.0.items.0"]')&&window.OmniEditor.getState().draft.placements.some(r=>r.key==='*:engines.e1.groups.0.items.0')`));
  await click('[data-editor-lang="az"]');
  check(width+'px bullet ordering keeps Azerbaijani paired',await ev(`document.querySelector('${service}').textContent===${JSON.stringify(names.az[0])}`));await click('[data-editor-lang="en"]');
  await click('[data-editor-undo]');await escape();await click('[data-i18n="svcBrand.faq1q"]');await click('[data-element-add]');await click('[data-action-label="Another like this"]');await until(()=>ev(`!!window.OmniEditor.getState().activeEdit`));
  const faq=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1).id`);
  const faqAnchor=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1).anchor`);
  await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(130);
  await click('[data-omni-added="'+faq+'"] .faq-a-in');await click('[data-element-step="1"]');
  check(width+'px moving copied FAQ content preserves its fields and uses its own record',await ev(`document.querySelector('[data-omni-added="${faq}"]').parentElement.matches('.faq-list')&&document.querySelector('[data-omni-added="${faq}"]').querySelectorAll('[data-i18n]').length===2&&!window.OmniEditor.getState().draft.placements.length&&window.OmniEditor.getState().draft.addedElements.find(r=>r.id==='${faq}').anchor!==${JSON.stringify(faqAnchor)}`));
  await restoreDraft(serviceBaseline);await pause(1900);await editor('/services.html?edit=1');
  const catalogue=await ev(`({en:window.OM_I18N.en.engines.e1.groups[0].items[0],az:window.OM_I18N.az.engines.e1.groups[0].items[0]})`);
  await click(service);await click('[data-element-step="1"]');
  check(width+'px catalogue ordering reuses bilingual arrays and creates no placement',await ev(`window.OmniEditor.getState().draft.engines[0].groups[0].items[1]===${JSON.stringify(catalogue.en)}&&window.OmniEditor.getState().draft.enginesAz[0].groups[0].items[1]===${JSON.stringify(catalogue.az)}&&!window.OmniEditor.getState().draft.placements.length`));
  await click('[data-editor-undo]');await pause(1900);await editor();
};
