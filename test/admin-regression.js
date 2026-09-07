/* Admin regressions: isolated fixture and native CDP browser; no real accounts or email. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'audit','admin-fixes');
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
const errors=[];let cookie='',ws,seq=0;const pending=new Map();
let passed=0;function check(name,ok,details){if(!ok)throw new Error(name+': '+JSON.stringify(details));passed++;console.log('PASS '+name);}
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

 const baseline=(await api('GET','site')).data;
 await click('[data-tab="services"]');const before=await ev(`document.querySelectorAll('[data-eng^="0.groups.0.items."]').length`);
 for(let i=0;i<4;i++)await click('[data-add-item="0.0"]');
 check('four service clicks add exactly four services',await ev(`document.querySelectorAll('[data-eng^="0.groups.0.items."]').length`)===before+4);
 await click('[data-tab="industries"]');const industryBefore=await ev(`document.querySelectorAll('[data-ind]').length`);
 for(let i=0;i<3;i++)await click('#addInd');
 check('three industry clicks add exactly three industries',await ev(`document.querySelectorAll('[data-ind]').length`)===industryBefore+3);
 await click('#discardBtn');await click('#confirmDialog [value="confirm"]');
 await click('[data-tab="design"]');await pause(700);
 check('design preview selection matches its iframe',await ev(`document.querySelector('#previewPage').value===document.querySelector('#preview').getAttribute('src')`));
 await click('[data-tab="settings"]');await fill('[data-bind="settings.siteName"]','Saved name');
 await ev(`window.nativeFetch=fetch;window.fetch=function(u,o){const result=window.nativeFetch.apply(this,arguments);return o?.method==='PUT'&&String(u).endsWith('api/site')?result.then(r=>new Promise(resolve=>setTimeout(()=>resolve(r),900))):result;};`);
 await click('#saveBtn');await fill('[data-bind="settings.phone"]','+1 234 567 890');await pause(1100);
 check('edit during publish remains dirty and saveable',await ev(`document.querySelector('#dirty').textContent==='Unsaved changes'&&!document.querySelector('#saveBtn').disabled`));
 await click('#saveBtn');await pause(1200);check('next publish persists the later edit',(await api('GET','site')).data.settings.phone==='+1 234 567 890');
 await ev('window.fetch=window.nativeFetch');
 await fill('[data-bind="settings.email"]','broken-address');await click('#saveBtn');await pause(200);
 check('invalid email identifies the field without publishing',await ev(`document.querySelector('[data-bind="settings.email"]').getAttribute('aria-invalid')==='true'`)&&(await api('GET','site')).data.settings.email!=='broken-address');
 await click('#discardBtn');await click('#confirmDialog [value="confirm"]');
 await api('POST','submit',{form:'newsletter',email:'newsletter@example.test'});await api('POST','submit',{form:'contact',name:'=1+1',email:'contact@example.test',company:'Test',spend:'1000',consent:true});
 await click('[data-tab="submissions"]');await click('[data-tab="overview"]');await click('[data-tab="submissions"]');await until(()=>ev(`document.querySelectorAll('[data-del-sub]').length===2`));
 await fill('#subForm','newsletter','change');await until(()=>ev(`document.querySelectorAll('[data-del-sub]').length===1`));
 await ev(`window.blobs=[];window.createUrl=URL.createObjectURL;URL.createObjectURL=function(blob){window.blobs.push(blob);return window.createUrl.call(URL,blob)};`);await click('#subCsv');await until(()=>ev('window.blobs.length===1'));
 let csv=await ev('window.blobs[0].text()');check('filtered CSV contains only matching enquiries',csv.includes('newsletter@example.test')&&!csv.includes('contact@example.test'));
 await fill('#subForm','contact','change');await until(()=>ev(`document.querySelector('#subList').textContent.includes('contact@example.test')`));await click('#subCsv');await until(()=>ev('window.blobs.length===2'));csv=await ev('window.blobs[1].text()');check('CSV exports formula prefixes as literal text',csv.includes("'=1+1"));
 await ev(`window.deleteCount=0;window.nativeFetch=fetch;window.fetch=function(u,o){if(o?.method==='DELETE')window.deleteCount++;return window.nativeFetch.apply(this,arguments);};`);
 await click('[data-del-sub]');check('single lead delete requires confirmation',await ev(`document.querySelector('#confirmDialog').open&&window.deleteCount===0`));await click('#confirmDialog [value="cancel"]');check('cancelling delete preserves the lead',(await api('GET','submissions')).data.length===2);
 await click('[data-del-sub]');await click('#confirmDialog [value="confirm"]');await pause(250);check('one confirmed delete sends exactly one request',await ev('window.deleteCount===1')&&(await api('GET','submissions')).data.length===1);
 await view(390,844);await shot('advanced-mobile');check('mobile advanced navigation starts collapsed',await ev(`document.querySelector('#adminNavigation').hidden&&document.querySelector('.topbar').getBoundingClientRect().top<300`));await view();
 // A local draft must retain its own version when another editor has saved.
 const live=(await api('GET','site')).data,shared=JSON.parse(JSON.stringify(live));shared.i18n.en['home.hero.h1']='Colleague shared draft';
 await api('PUT','draft',{...shared,draftRevision:0,baseUpdatedAt:live.updatedAt});
 await go('/index.html?edit=1','!!window.OmniEditor');
 await ev(`(()=>{const s=window.OmniEditor.getState(),draft=${JSON.stringify(live)};draft.i18n.en['home.hero.h1']='Older offline copy';localStorage.setItem('omni-editor-draft-'+s.user.id,JSON.stringify({savedAt:new Date(Date.now()+60000).toISOString(),draft,draftRevision:0,baseUpdatedAt:s.live.updatedAt}));s.allowNavigate=true;})()`);
 await go('/index.html?edit=1','!!window.OmniEditor');await until(()=>ev(`!!document.querySelector('dialog[open]')`));
 check('stale local recovery opens conflict and retains original revision',await ev(`window.OmniEditor.getState().recoveryConflict&&window.OmniEditor.getState().draftRevision===0`));await shot('draft-conflict');
 await pause(1700);check('stale local recovery does not overwrite shared content',(await api('GET','draft')).data.draft.i18n.en['home.hero.h1']==='Colleague shared draft');
 await click('[data-dialog-confirm]');await until(()=>ev(`!document.querySelector('dialog[open]')`));check('load latest resolves conflict explicitly',await ev(`!window.OmniEditor.getState().recoveryConflict&&window.OmniEditor.getState().draft.i18n.en['home.hero.h1']==='Colleague shared draft'`));
 await click('[data-editor-settings]');await shot('settings-menu');await click('[data-settings-view="website"]');
 check('all website settings have linked plain-language explanations',await ev(`Array.from(document.querySelectorAll('.omni-settings input,.omni-settings select')).every(input=>input.hasAttribute('data-field-explained')&&input.getAttribute('aria-describedby').split(' ').some(id=>document.getElementById(id)?.classList.contains('omni-field-help')))`));
 await fill('#omni-setting-settings-email','bad-email','change');check('owner email validation is inline',await ev(`document.querySelector('#omni-setting-settings-email').getAttribute('aria-invalid')==='true'&&!document.querySelector('#omni-setting-settings-email-error').hidden`));
 await fill('#omni-setting-settings-email','owner@example.test','change');await pause(1900);await shot('website-details');
 await view(390,844);await shot('website-details-mobile');check('mobile website details fits without horizontal scrolling',await ev('document.documentElement.scrollWidth<=innerWidth'));
 await click('.omni-panel__close');await click('.omni-bar__mobile [data-editor-more]');await click('[data-mobile-open="account"]');await until(()=>ev(`!!document.querySelector('[data-account-logout]')`));await shot('account-mobile');
 await click('[data-account-logout]');await click('[data-dialog-confirm]');await until(()=>ev(`location.pathname==='/admin.html'`));
 check('sign out ends the authenticated browser session',await ev(`fetch('/api/me').then(r=>r.json()).then(x=>!x.authed)`));
 check('sign out retains the private server draft',!!(await api('GET','draft')).data.draft);
 check('regression journeys have no uncaught browser exceptions',errors.length===0,errors);
 console.log(passed+' regression checks passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();browser.kill();app.kill();});
