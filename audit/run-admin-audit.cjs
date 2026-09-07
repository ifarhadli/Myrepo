/* Audit probes: isolated fixture and browser; no real site data or email. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(__dirname,process.env.AUDIT_EXTRA?'admin-2026-09-07-extra':'admin-2026-09-07');
fs.mkdirSync(path.join(OUT,'screenshots'),{recursive:true});
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'omni-admin-audit-'));
for(const name of fs.readdirSync(ROOT)) if(/\.html$/.test(name)||['server.js','css','js'].includes(name))fs.cpSync(path.join(ROOT,name),path.join(TMP,name),{recursive:true});
fs.mkdirSync(path.join(TMP,'data'),{recursive:true});
for(const name of ['site.json','site.js']) if(fs.existsSync(path.join(ROOT,'data',name)))fs.copyFileSync(path.join(ROOT,'data',name),path.join(TMP,'data',name));
const PORT=5300+Math.floor(Math.random()*200),DEBUG=PORT+500,BASE='http://127.0.0.1:'+PORT,PW='audit-local-password';
const app=spawn(process.execPath,['server.js'],{cwd:TMP,windowsHide:true,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',ADMIN_PASSWORD:PW,ADMIN_EMAIL:'',RESEND_API_KEY:'',NOTIFY_EMAIL_TO:'',NOTIFY_WEBHOOK_URL:''},stdio:'ignore'});
const bin=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=spawn(bin,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port='+DEBUG,'--user-data-dir='+path.join(TMP,'browser'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){try{const r=await fn();if(r)return r;}catch{}await pause(100);}throw Error('Wait failed: '+String(fn));}
const findings=[],errors=[];let cookie='',ws,seq=0;const pending=new Map();
function record(name,details){findings.push({name,details});console.log(name+': '+JSON.stringify(details));fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({findings,errors},null,2));}
async function api(method,route,body){const r=await fetch(BASE+'/api/'+route,{method,headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin',Origin:BASE,Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,data:await r.json()};}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function snap(name){const ax=await send('Accessibility.getFullAXTree');fs.writeFileSync(path.join(OUT,name+'.dom.json'),JSON.stringify(ax,null,2));return ax;}
async function click(selector){await snap('latest');await ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];if(els.length!==1)throw Error('Ambiguous click '+els.length);els[0].click()})()`);await pause(120);}
async function fill(selector,value,event='input'){await snap('latest');await ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];if(els.length!==1)throw Error('Ambiguous fill');els[0].value=${JSON.stringify(value)};els[0].dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}))})()`);await pause(80);}
async function go(route,ready){await send('Page.navigate',{url:BASE+route});await until(()=>ev(`location.pathname===${JSON.stringify(route.split(/[?#]/)[0])} && document.readyState!=='loading' ${ready?'&& ('+ready+')':''}`));await pause(180);await snap('latest');}
async function shot(name){await snap(name);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(OUT,'screenshots',name+'.png'),Buffer.from(r.data,'base64'));}
async function view(width=1440,height=900){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});}
async function main(){
 await until(()=>fetch(BASE+'/api/auth').then(r=>r.ok));
 const tabs=await until(()=>fetch('http://127.0.0.1:'+DEBUG+'/json/list').then(r=>r.json()).then(a=>a.find(x=>x.type==='page')));
 ws=new WebSocket(tabs.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params);};
 await send('Page.enable');await send('Runtime.enable');await send('Accessibility.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']});
 await view();await go('/admin.html');await shot('01-sign-in');
 await fill('#loginPw',PW);await click('#loginForm button[type="submit"]');await until(()=>ev('!!window.OmniEditor'));await snap('latest');
 await api('POST','login',{password:PW});
 await go('/admin-advanced.html',`!document.querySelector('#app').hidden`);
 if(process.env.AUDIT_EXTRA){
  await click('[data-tab="services"]');let count=await ev(`document.querySelectorAll('[data-eng^="0.groups.0.items."]').length`);
  await click('[data-add-item="0.0"]');let count1=await ev(`document.querySelectorAll('[data-eng^="0.groups.0.items."]').length`);
  await click('[data-add-item="0.0"]');let count2=await ev(`document.querySelectorAll('[data-eng^="0.groups.0.items."]').length`);
  record('Repeated Add service duplicates',{before:count,afterFirst:count1,afterSecond:count2});
  await ev(`document.querySelector('[data-add-item="0.0"]').scrollIntoView({block:'center'})`);await shot('21-duplicate-services');
  await click('[data-tab="industries"]');count=await ev(`document.querySelectorAll('[data-ind]').length`);await click('#addInd');count1=await ev(`document.querySelectorAll('[data-ind]').length`);await click('#addInd');count2=await ev(`document.querySelectorAll('[data-ind]').length`);
  record('Repeated Add industry duplicates',{before:count,afterFirst:count1,afterSecond:count2});await shot('22-duplicate-industries');
  await click('[data-tab="settings"]');await fill('[data-bind="settings.siteName"]','Audit submitted value');
  await ev(`window.auditFetch=fetch;window.auditPutPending=false;window.fetch=function(u,o){const p=window.auditFetch.apply(this,arguments);if(o?.method==='PUT'&&String(u).endsWith('api/site')){window.auditPutPending=true;return p.then(r=>new Promise(resolve=>setTimeout(()=>resolve(r),1200)))}return p};`);
  await click('#saveBtn');await fill('[data-bind="settings.phone"]','Edit made while publishing');await pause(1400);
  record('Edits during save lost while input still looks changed',{ui:await ev(`({phone:document.querySelector('[data-bind="settings.phone"]').value,dirty:document.querySelector('#dirty').textContent,disabled:document.querySelector('#saveBtn').disabled})`),savedPhone:(await api('GET','site')).data.settings.phone});await shot('23-edit-lost-during-save');
  await click('[data-tab="design"]');await pause(1300);record('Design preview selected page mismatch',await ev(`({selected:document.querySelector('#previewPage').value,frame:document.querySelector('#preview').getAttribute('src')})`));await shot('24-design-preview');
  await click('[data-tab="account"]');record('Import JSON keyboard reachability',await ev(`(()=>{const f=document.querySelector('#importFile'),l=f.closest('label');return {fileHidden:f.hidden,labelTabIndex:l.tabIndex,labelRole:l.getAttribute('role')}})()`));
  await go('/index.html?edit=1','!!window.OmniEditor');await click('[data-editor-settings]');record('Editor settings lack sign out',await ev(`({text:document.querySelector('.omni-panel').textContent,logoutControls:[...document.querySelectorAll('.omni-panel button,.omni-panel a')].filter(e=>/sign out|log out|exit editor/i.test(e.textContent)).length})`));
  return;
 }
 await shot('02-overview');
 record('Launch checklist misses empty legal URLs',await ev(`({privacy:document.querySelector('#panel').textContent.includes('Privacy Policy'),text:document.querySelector('#panel').textContent})`));
 for(const [n,tab] of [['03','design'],['04','content'],['05','services'],['06','industries'],['07','pages'],['08','settings'],['09','submissions'],['10','account']]){
  await click('[data-tab="'+tab+'"]');await pause(150);await shot(n+'-'+tab);
  record('Panel '+tab,await ev(`({heading:document.querySelector('#tabTitle').textContent,inputs:document.querySelectorAll('#panel input,#panel textarea,#panel select').length,overflow:document.documentElement.scrollWidth-innerWidth})`));
 }
 const original=(await api('GET','site')).data;
 const a=JSON.parse(JSON.stringify(original)),b=JSON.parse(JSON.stringify(original));a.settings.siteName='Audit tab A new name';b.settings.phone='Audit tab B phone';
 const ar=await api('PUT','site',a),br=await api('PUT','site',b),latest=(await api('GET','site')).data;
 record('Two advanced sessions overwrite without stale guard',{first:ar.status,second:br.status,expectedName:a.settings.siteName,actualName:latest.settings.siteName});
 await api('PUT','site',original);
 await click('[data-tab="settings"]');await fill('[data-bind="settings.email"]','definitely-not-an-email');await click('#saveBtn');await pause(250);
 record('Invalid contact email publish', {saved:(await api('GET','site')).data.settings.email,ui:await ev(`({toast:document.querySelector('#toast').textContent,invalid:document.querySelector('[data-bind="settings.email"]').getAttribute('aria-invalid')})`)});await shot('11-invalid-email-published');
 await api('PUT','site',original);
 const leadA={form:'newsletter',email:'audit-news@example.test'},leadB={form:'contact',name:'=1+1',email:'audit-lead@example.test',company:'Audit company',spend:'1000',message:'Synthetic audit enquiry',consent:true};
 record('Seed newsletter',await api('POST','submit',leadA));record('Seed contact',await api('POST','submit',leadB));
 await click('[data-tab="submissions"]');await until(()=>ev('document.querySelectorAll("[data-del-sub]").length===2'));
 await fill('#subForm','newsletter','change');await shot('12-filtered-submissions');
 await ev(`window.auditBlobs=[];window.auditCreateUrl=URL.createObjectURL;URL.createObjectURL=function(b){window.auditBlobs.push(b);return window.auditCreateUrl.call(URL,b);}`);
 await click('#subCsv');record('Filtered export includes all forms',await ev(`Promise.all(window.auditBlobs.map(b=>b.text()))`));
 const del=await ev(`document.querySelector('[data-del-sub]').getAttribute('data-del-sub')`);await click('[data-del-sub="'+del+'"]');
 record('Individual lead deleted without confirmation',{dialog:await ev(`document.querySelector('#confirmDialog').open`),remaining:(await api('GET','submissions')).data.length});await shot('13-deleted-no-confirmation');
 await view(390,844);await shot('14-advanced-mobile');await view();
 // Returning to Submissions installs another handler on the reused panel.
 await click('[data-tab="overview"]');await click('[data-tab="submissions"]');await until(()=>ev('!!document.querySelector("[data-del-sub]")'));
 await ev(`window.auditDeletes=0;window.auditFetch=window.fetch;window.fetch=function(u,o){if(o&&o.method==='DELETE')window.auditDeletes++;return window.auditFetch.apply(this,arguments);};`);
 const lastId=await ev(`document.querySelector('[data-del-sub]').getAttribute('data-del-sub')`);await click('[data-del-sub="'+lastId+'"]');await pause(250);record('Repeated tab visits duplicate delete requests',await ev('window.auditDeletes'));
 // A revision after autosave must be checked again at publish time.
 const live=(await api('GET','site')).data,draftA=JSON.parse(JSON.stringify(live));draftA.i18n.en['home.hero.title']='Audit draft A';
 const da=await api('PUT','draft',{...draftA,baseUpdatedAt:live.updatedAt,draftRevision:0});
 const draftB=JSON.parse(JSON.stringify(draftA));draftB.i18n.en['home.hero.title']='Audit draft B not reviewed by A';
 const db=await api('PUT','draft',{...draftB,baseUpdatedAt:live.updatedAt,draftRevision:da.data.revision});
 const published=await api('POST','publish',{draftRevision:da.data.revision});
 record('Publish ignores reviewed draft revision',{aRevision:da.data.revision,bRevision:db.data.revision,publishStatus:published.status,publishedTitle:published.data.site?.i18n.en['home.hero.title']});
 await api('PUT','site',original);
 await go('/index.html?edit=1','!!window.OmniEditor');await shot('15-editor');
 record('Editor exit and sign-out controls',await ev(`[...document.querySelectorAll('.omni-bar button,.omni-bar a')].map(e=>e.textContent)`));
 await click('[data-editor-settings]');await shot('16-editor-settings');
 await click('.omni-panel__close');await click('[data-editor-inbox]');await shot('17-editor-inbox-empty');await click('.omni-panel__close');
 // A server validation rejection is not an offline error.
 await ev(`window.OmniEditor.commit(d=>{d.collections=d.collections||JSON.parse(JSON.stringify(window.OmniEditor.getState().defaults.collections));d.collections.cases.push(JSON.parse(JSON.stringify(d.collections.cases[0])))},'Audit duplicate collection item');`);await pause(1800);
 record('Validation error save status',await ev(`({status:document.querySelector('[data-editor-status]').textContent,localKeys:Object.keys(localStorage).filter(x=>x.includes('draft'))})`));await shot('18-editor-save-error');
 // Reload with a local copy newer than another editor's server revision.
 await api('DELETE','draft',{});let current=(await api('GET','site')).data;
 const serverDraft=JSON.parse(JSON.stringify(current));serverDraft.i18n.en['home.hero.title']='Shared colleague change';
 const sr=await api('PUT','draft',{...serverDraft,draftRevision:0,baseUpdatedAt:current.updatedAt});
 await ev(`(()=>{const s=window.OmniEditor.getState(),d=${JSON.stringify(current)};d.i18n.en['home.hero.title']='Older offline draft';localStorage.setItem(Object.keys(localStorage).find(k=>k.includes('draft')),JSON.stringify({savedAt:new Date(Date.now()+60000).toISOString(),draft:d,draftRevision:0}));s.allowNavigate=true})()`);
 await go('/index.html?edit=1','!!window.OmniEditor');record('Offline restoration adopts current server revision',await ev(`({text:window.OmniEditor.getState().draft.i18n.en['home.hero.title'],revision:window.OmniEditor.getState().draftRevision,dialog:!!document.querySelector('dialog[open]')})`));
 await ev(`window.OmniEditor.commit(d=>{d.i18n.en['home.hero.title']='Offline overwrites colleague'},'Audit subsequent edit');`);await pause(1800);
 const overwritten=await api('GET','draft');record('Offline restored draft overwrites colleague',{status:overwritten.status,revision:overwritten.data.revision,title:overwritten.data.draft?.i18n.en['home.hero.title']});await shot('19-restored-local-draft');
 await view(390,844);await click('.omni-bar__mobile [data-editor-more]');await shot('20-mobile-menu');await view();
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({findings,errors},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();browser.kill();app.kill();console.log('Fixture retained at '+TMP);});
