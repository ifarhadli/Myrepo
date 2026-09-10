'use strict';
module.exports=async function({evaluate:ev,go,viewport,check,screenshot,pause,send},width){
  const mobile=width<600;
  const until=async expression=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(await ev(expression))return;await pause(100);}throw new Error('Owner journey timed out: '+expression);};
  // Use actual pointer input on visible controls, including the phone menu.
  async function click(selector){
    const point=await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing control: '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await pause(100);
  }
  async function editor(){await go('/index.html?edit=1');await until("!!document.querySelector('[data-editor-settings]')");}
  async function settings(){
    if(mobile){await click('.omni-bar__mobile [data-editor-more]');await click('[data-mobile-open="settings"]');}
    else await click('[data-editor-settings]');
    await click('[data-settings-view="website"]');
  }
  async function publish(){
    if(await ev(`!!document.querySelector('.omni-panel__close')`))await click('.omni-panel__close');
    await click(mobile?'[data-editor-mobile-publish]':'[data-editor-publish]');await until(`!!document.querySelector('[data-dialog-confirm]')`);await click('[data-dialog-confirm]');
    await until(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`);
  }
  await viewport(width,900);await editor();
  const baseline=await ev(`fetch('/api/site').then(r=>r.json())`);
  await click('#site-header .mark');await click('[data-edit-logo]');
  check(width+'px selecting the brand opens logo editing',await ev(`window.OmniEditor.getState().mediaContext.key==='shared.logo'`));
  await click('.omni-panel__close');
  if(mobile){await click('#hamburgerBtn');await until(`getComputedStyle(document.querySelector('#mobileDrawer')).transform==='matrix(1, 0, 0, 1, 0, 0)'`);}
  await click(mobile?'.drawer [data-lang="en"]':'.topnav [data-lang="en"]');
  check(width+'px clicking public language opens its settings without Remove',await ev(`!!document.querySelector('[data-owner-english]')&&document.activeElement.hasAttribute('data-owner-english')&&!document.querySelector('.omni-element-tools')&&!document.querySelector('#mobileDrawer.open')`));
  await screenshot('owner-controls-'+width);
  check(width+'px website controls and linked explanations fit',await ev(`document.documentElement.scrollWidth<=innerWidth&&['english','construction'].every(key=>{const x=document.querySelector('[data-owner-'+key+']');return x&&document.getElementById(x.getAttribute('aria-describedby'))?.textContent.length>30;})`));
  await click('[data-owner-english]');
  check(width+'px English toggle hides public switch in draft',await ev(`window.OmniEditor.getState().draft.features.englishVersion===false&&!document.querySelector('#omni-setting-settings-defaultLang')&&[...document.querySelectorAll('.lang-switch')].every(x=>getComputedStyle(x).display==='none')`));
  await click('.omni-panel__close');await click(mobile?'[data-editor-mobile-undo]':'[data-editor-undo]');await settings();
  check(width+'px Undo restores language control and switch',await ev(`document.querySelector('[data-owner-english]').checked&&!!document.querySelector('#omni-setting-settings-defaultLang')`));
  await click('[data-owner-english]');await click('[data-owner-logo]');await until(`!!document.querySelector('#omniMediaFiles')`);
  await ev(`new Promise(resolve=>{const c=document.createElement('canvas');c.width=800;c.height=400;const x=c.getContext('2d');x.fillStyle='#4634f0';x.fillRect(0,0,800,400);x.fillStyle='#fff';x.font='bold 100px sans-serif';x.fillText('TEST LOGO',40,135);c.toBlob(blob=>{const input=document.querySelector('#omniMediaFiles'),dt=new DataTransfer();dt.items.add(new File([blob],'owner-logo.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();},'image/png');})`);
  await until(`document.querySelector('[data-media-alt]')&&window.OmniEditor.getState().uploads[0]?.status==='Ready'`);
  check(width+'px logo upload offers an uncropped preview',await ev(`document.querySelector('[data-media-target]').textContent==='Website logo'&&getComputedStyle(document.querySelector('.omni-focal-field')).display==='none'&&getComputedStyle(document.querySelector('.omni-media-detail-preview')).display!=='none'`));
  check(width+'px logo name is filled from website name',await ev(`document.querySelector('[data-media-alt]').value===window.OmniEditor.getState().draft.settings.siteName`));
  await ev(`const alt=document.querySelector('[data-media-alt]');alt.value='Owner test logo';alt.dispatchEvent(new Event('input',{bubbles:true}));`);
  await screenshot('owner-logo-'+width);await click('[data-media-use]');
  await until(`!!window.OmniEditor.getState().draft.images['shared.logo']`);
  await pause(300);
  check(width+'px applying logo updates all brand locations without stretching',await ev(`[...document.querySelectorAll('.mark')].every(mark=>{const img=mark.querySelector('[data-brand-logo]');return img&&!img.hidden&&img.naturalWidth===480&&mark.querySelector('[data-brand-text]').hidden&&getComputedStyle(img).objectFit==='contain';})`));
  await click(mobile?'[data-editor-mobile-undo]':'[data-editor-undo]');
  check(width+'px Undo removes the draft logo from every brand location',await ev(`[...document.querySelectorAll('.mark [data-brand-text]')].every(x=>!x.hidden)&&!window.OmniEditor.getState().draft.images['shared.logo']`));
  if(mobile){await click('.omni-bar__mobile [data-editor-more]');await click('[data-mobile-open="redo"]');}else await click('[data-editor-redo]');
  check(width+'px Redo restores the uploaded logo everywhere',await ev(`[...document.querySelectorAll('.mark [data-brand-logo]')].every(x=>!x.hidden)&&!!window.OmniEditor.getState().draft.images['shared.logo']`));
  const originalHeight=await ev(`document.querySelector('#site-header [data-brand-logo]').getBoundingClientRect().height`);
  await settings();
  await ev(`(()=>{const size=document.querySelector('[data-owner-logo-size]');size.value='extra-large';size.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check(width+'px size choice enlarges the logo immediately',await ev(`document.querySelector('#site-header [data-brand-logo]').getBoundingClientRect().height>${originalHeight}+10&&window.OmniEditor.getState().draft.settings.logoSize==='extra-large'`));
  await click('.omni-panel__close');await click(mobile?'[data-editor-mobile-undo]':'[data-editor-undo]');await settings();
  check(width+'px Undo restores logo size and its field',await ev(`document.querySelector('[data-owner-logo-size]').value==='standard'&&Math.abs(document.querySelector('#site-header [data-brand-logo]').getBoundingClientRect().height-${originalHeight})<1`));
  await click('[data-owner-logo]');await until(`!!document.querySelector('[data-owner-logo-size]')`);
  await ev(`(()=>{const size=document.querySelector('[data-owner-logo-size]');size.value='extra-large';size.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check(width+'px logo image panel reuses the size setting',await ev(`window.OmniEditor.getState().draft.settings.logoSize==='extra-large'`));
  await click('.omni-panel__close');await screenshot('owner-large-logo-'+width);
  await publish();await ev(`localStorage.setItem('om-lang','en')`);await go('/index.html');
  check(width+'px public site stays AZ despite saved EN preference',await ev(`document.documentElement.lang==='az'&&[...document.querySelectorAll('.lang-switch')].every(x=>getComputedStyle(x).display==='none')`));
  check(width+'px logo size survives publishing and reload',await ev(`window.OMNI_SITE.settings.logoSize==='extra-large'&&document.querySelector('#site-header .mark').dataset.logoSize==='extra-large'&&document.documentElement.scrollWidth<=innerWidth`));
  if(mobile){await viewport(320,800);check('large logo fits a 320px phone even with the language switch',await ev(`(()=>{const switcher=document.querySelector('.topnav .lang-switch'),hidden=switcher.hidden;switcher.hidden=false;const fits=document.documentElement.scrollWidth<=innerWidth;switcher.hidden=hidden;return fits;})()`));await viewport(width,900);}
  check(width+'px English copy remains stored',JSON.stringify(await ev(`window.OMNI_SITE.i18n.en`))===JSON.stringify(baseline.i18n.en));
  await screenshot('owner-public-logo-'+width);
  if(mobile){await click('#hamburgerBtn');await click('.drawer a[href="services.html"]');await until(`location.pathname==='/services.html'`);check('mobile Services opens the page directly',true);}
  await editor();await settings();await click('[data-owner-construction]');
  check(width+'px construction stays private until publish',await ev(`fetch('/services.html').then(r=>r.status===200)`));
  await publish();await go('/index.html');
  check(width+'px construction page shows logo and fits',await ev(`document.documentElement.lang==='az'&&!!document.querySelector('main img')&&!document.querySelector('.omni-bar')&&document.documentElement.scrollWidth<=innerWidth`));
  await screenshot('owner-construction-'+width);
  await editor();await settings();
  check(width+'px owner can still edit while construction is active',await ev(`document.querySelector('[data-owner-construction]').checked`));
  await click('[data-owner-construction]');await click('[data-owner-english]');await click('[data-owner-logo]');
  await until(`!!document.querySelector('[data-media-remove]')`);await click('[data-media-remove]');
  check(width+'px removing uploaded logo restores the business name',await ev(`[...document.querySelectorAll('.mark [data-brand-text]')].every(x=>!x.hidden)`));
  await publish();await ev(`localStorage.setItem('om-lang','en')`);await go('/index.html');
  check(width+'px reopening restores public English and its switch',await ev(`document.documentElement.lang==='en'&&[...document.querySelectorAll('.lang-switch')].every(x=>!x.hidden)`));
  // Restore the pre-journey fixture so later journeys retain their own assumptions.
  await ev(`fetch('/api/site').then(r=>r.json()).then(live=>fetch('/api/site',{method:'PUT',headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},body:JSON.stringify({...${JSON.stringify(baseline)},baseUpdatedAt:live.updatedAt})})).then(r=>{if(!r.ok)throw Error('Fixture restore failed')})`);
};
