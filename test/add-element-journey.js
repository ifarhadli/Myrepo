/* Phase A journey reused by the desktop and mobile browser fixtures. */
'use strict';
module.exports=async function(h,width){
  const {evaluate:ev,go,viewport,check,screenshot,pause}=h;
  async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(100);}throw Error('Add-element journey timed out: '+String(fn));}
  async function click(selector){if(!await ev(`!!document.querySelector(${JSON.stringify(selector)})`))throw Error('Missing Add journey control: '+selector);await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(90);}
  async function fill(selector,value){await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  async function editor(route='/index.html?edit=1'){await go(route);await until(()=>ev(`!!window.OmniEditor?.getState().user&&!!document.querySelector('.omni-bar')`));}
  async function publish(){await click(width<=700?'[data-editor-mobile-publish]':'[data-editor-publish]');await until(()=>ev(`!!document.querySelector('[data-dialog-confirm]')`));await click('[data-dialog-confirm]');await until(()=>ev(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`));}
  const copies=[];
  async function copy(selector,kind){
    await click(selector);await click('[data-element-add]');await click('[data-action-label="Another like this"]');
    await until(()=>ev(`window.OmniEditor.getState().activeEdit?.key?.startsWith('added.')`));
    const record=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1)`),query='[data-omni-added="'+record.id+'"]';
    check(width+'px '+kind+' copy has fresh bilingual keys and no inherited editor identity',await ev(`(()=>{const s=window.OmniEditor.getState(),node=document.querySelector(${JSON.stringify(query)}),keys=[node,...node.querySelectorAll('[data-i18n]')].map(n=>n.getAttribute('data-i18n')).filter(Boolean);return keys.length>0&&keys.every(k=>k.startsWith('added.${record.id}')&&typeof s.draft.i18n.en[k]==='string'&&typeof s.draft.i18n.az[k]==='string')&&!node.querySelector('[data-image],[data-item],[data-collection-id],input,form')&&!node.hasAttribute('data-item');})()`));
    await ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(120);
    copies.push({record,query,kind});return query;
  }
  await viewport(width,900);
  {
    await editor('/service-brand-launch.html?edit=1');
    const bullet=await copy('main [data-i18n="engines.e1.groups.0.items.0"]','bullet');
    await click(bullet);if(!await ev(`!!window.OmniEditor.getState().activeEdit`))await click('[data-element-edit]');
    await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Independent copied bullet';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(120);
    await click('[data-editor-lang="az"]');await click(bullet);if(!await ev(`!!window.OmniEditor.getState().activeEdit`))await click('[data-element-edit]');
    await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Independent AZ bullet';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await pause(120);await click('[data-editor-lang="en"]');
    check('copied bullet text is independent from its source in both languages',await ev(`document.querySelector(${JSON.stringify(bullet)}).textContent==='Independent copied bullet'&&document.querySelector('[data-i18n="engines.e1.groups.0.items.0"]').textContent!=='Independent copied bullet'`));
    const faq=await copy('[data-i18n="svcBrand.faq1q"]','FAQ');
    check('copied FAQ retains editable question and answer',await ev(`document.querySelector(${JSON.stringify(faq)}).querySelectorAll('[data-i18n]').length===2&&!!document.querySelector(${JSON.stringify(faq)}).querySelector('.faq-a-in[data-i18n]')`));
    await pause(1800);await editor();
    const count=await ev(`document.querySelector('.stat-row').children.length`);
    await copy('[data-i18n="home.numbers.v1"]','stat');
    check('stat copy adds one designed stat with its original figure',await ev(`document.querySelector('.stat-row').children.length===${count+1}&&document.querySelector('.stat-row [data-omni-added] .stat-fig').textContent==='$450M+'`));
    await pause(1800);
  }
  await editor();
  await click('[data-i18n="home.hero.ctaSecondary"]');await click('[data-element-style="text"]');
  check(width+'px existing buttons can become text links',await ev(`document.querySelector('[data-i18n="home.hero.ctaSecondary"]').classList.contains('btn-text')`));
  await click('[data-editor-undo]');
  check(width+'px Undo restores the authored button style',await ev(`document.querySelector('[data-i18n="home.hero.ctaSecondary"]').classList.contains('btn-secondary')`));
  await click('[data-i18n="home.hero.h1"]');check(width+'px headline cannot be copied',await ev(`!document.querySelector('[data-element-add]')`));
  await click('[data-i18n="home.cta.labelCompany"]');check(width+'px form fields cannot be added or copied',await ev(`!document.querySelector('[data-element-add]')`));
  await click('[data-i18n="home.hero.lede"]');await click('[data-element-add]');
  check(width+'px Add offers only compatible designed components',await ev(`['Another like this','Paragraph','Button'].every(label=>[...document.querySelectorAll('[data-action-label]')].some(b=>b.dataset.actionLabel===label))&&!document.querySelector('[data-action-label="Bullet"]')`));
  await screenshot('add-menu-'+width);
  await click('[data-action-label="Button"]');
  await until(()=>ev(`window.OmniEditor.getState().activeEdit?.key?.startsWith('added.')`));
  const id=await ev(`window.OmniEditor.getState().draft.addedElements.at(-1).id`),key='added.'+id,selector='[data-omni-added="'+id+'"]';
  check(width+'px new button is wrapped and ready to type',await ev(`document.querySelector(${JSON.stringify(selector)}).parentElement.matches('.btn-row')&&window.OmniEditor.getState().activeEdit.el.textContent==='New text'`));
  await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Talk to our team';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);await pause(100);
  await click('[data-editor-lang="az"]');check(width+'px new button has an Azerbaijani placeholder',await ev(`document.querySelector(${JSON.stringify(selector)}).textContent==='Yeni mətn'`));
  await click(selector);if(!await ev(`!!window.OmniEditor.getState().activeEdit`))await click('[data-element-edit]');
  await ev(`window.OmniEditor.getState().activeEdit.el.textContent='Bizimlə danışın';document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);await pause(100);await click('[data-editor-lang="en"]');
  await click('[data-element-link]');await until(()=>ev(`!!document.querySelector('#omni-link-page')`));
  await screenshot('element-link-'+width);
  await click('input[name="omni-link-kind"][value="custom"]');await fill('#omni-link-custom','javascript:alert(1)');await click('[data-element-link-save]');
  check(width+'px unsafe custom links fail inline without changing the draft',await ev(`document.querySelector('#omni-link-custom').getAttribute('aria-invalid')==='true'&&!window.OmniEditor.getState().draft.elementLinks?.[${JSON.stringify('index:'+key)}]`));
  await click('input[name="omni-link-kind"][value="section"]');
  const section=await ev(`document.querySelector('#omni-link-section').value`);
  check(width+'px section choices have real targets and readable labels',await ev(`!!document.getElementById(${JSON.stringify(section.slice(1))})&&[...document.querySelector('#omni-link-section').options].every(o=>o.textContent&&!o.textContent.startsWith('index.'))`));
  await click('[data-element-link-save]');await click('[data-element-link]');await until(()=>ev(`!!document.querySelector('#omni-link-page')`));
  await click('input[name="omni-link-kind"][value="page"]');await fill('#omni-link-page','contact.html');await click('.omni-panel [data-element-style="secondary"]');await click('[data-element-link-save]');
  check(width+'px Link and Style repaint the added button without overflowing',await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});return el.getAttribute('href')==='contact.html'&&el.matches('.btn.btn-secondary')&&!el.matches('.on-light')&&document.documentElement.scrollWidth<=innerWidth;})()`));
  check(width+'px style labels fit their segments',await ev(`[...document.querySelectorAll('.omni-element-tools [data-element-style]')].every(b=>b.scrollWidth<=b.clientWidth)`));
  check(width+'px repaint keeps only the current addition selected',await ev(`document.querySelector(${JSON.stringify(selector)}).classList.contains('omni-selected')&&!document.querySelector('[data-i18n="home.hero.ctaSecondary"]').classList.contains('omni-selected')`));
  await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await screenshot('add-button-'+width);
  await publish();await go('/index.html');
  check(width+'px published addition retains independent text, link and style',await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});return el.textContent==='Talk to our team'&&el.getAttribute('href')==='contact.html'&&el.classList.contains('btn-secondary')&&!document.querySelector('.omni-bar')&&document.documentElement.scrollWidth<=innerWidth;})()`));
  if(copies.length){
    check('published stat copy survives reload',await ev(`!!document.querySelector(${JSON.stringify(copies[2].query)})`));
    await go('/service-brand-launch.html');
    check('published bullet copy keeps its edited words',await ev(`document.querySelector(${JSON.stringify(copies[0].query)}).textContent==='Independent copied bullet'`));
    const faq=copies[1].query;
    check('published copied FAQ has unique answer IDs and a working disclosure',await ev(`(()=>{const node=document.querySelector(${JSON.stringify(faq)}),q=node.querySelector('.faq-q'),a=node.querySelector('.faq-a'),before=q.getAttribute('aria-expanded');q.click();return q.getAttribute('aria-expanded')!==before&&q.getAttribute('aria-controls')===a.id&&document.querySelectorAll('#'+a.id).length===1&&a.inert===(q.getAttribute('aria-expanded')==='false');})()`));
  }
  await editor();await click(selector);await click('[data-element-remove]');
  check(width+'px Remove deletes the owner-made record and its overrides',await ev(`!window.OmniEditor.getState().draft.addedElements.some(r=>r.id===${JSON.stringify(id)})&&!window.OmniEditor.getState().draft.i18n.en[${JSON.stringify(key)}]&&!document.querySelector(${JSON.stringify(selector)})`));
  await click('[data-editor-undo]');
  check(width+'px Undo restores the entire added element',await ev(`document.querySelector(${JSON.stringify(selector)}).textContent==='Talk to our team'&&window.OmniEditor.getState().draft.i18n.az[${JSON.stringify(key)}]==='Bizimlə danışın'&&document.querySelector(${JSON.stringify(selector)}).getAttribute('href')==='contact.html'`));
  await click('[data-editor-history]');await until(()=>ev(`!!document.querySelector('.omni-history__item button')`));await click('.omni-history__item button');await click('[data-dialog-confirm]');
  await until(()=>ev(`!!window.OmniEditor?.getState().user&&!window.OmniEditor.getState().draft.addedElements.some(r=>r.id===${JSON.stringify(id)})&&!document.querySelector('.omni-dialog')`));
  check(width+'px History restores the version before Add/Link/Style',await ev(`!document.querySelector(${JSON.stringify(selector)})`));await publish();
};
