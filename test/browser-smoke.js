#!/usr/bin/env node
/* Optional real-browser smoke suite. Zero npm dependencies: it drives an
   installed Chromium browser through the Chrome DevTools Protocol, against a
   temporary copy of the site, and never touches real admin/submission data. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), http = require('http'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_PORT = 4300 + Math.floor(Math.random() * 400);
const DEBUG_PORT = APP_PORT + 500;
const MAIL_PORT = APP_PORT + 900;
const BASE = 'http://127.0.0.1:' + APP_PORT;
const TEST_PASSWORD = 'browser-smoke-pass';
const candidates = [
  process.env.BROWSER_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const browserBin = candidates.find(file => fs.existsSync(file));
if (!browserBin){ console.log('SKIP browser smoke: set BROWSER_BIN to a Chromium executable.'); process.exit(0); }

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omnimark-browser-'));
const browserProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'omnimark-chrome-'));
for (const file of fs.readdirSync(ROOT)){
  if (['.git', 'node_modules', 'audit', 'test'].includes(file)) continue;
  fs.cpSync(path.join(ROOT, file), path.join(tmpRoot, file), { recursive: true });
}
fs.rmSync(path.join(tmpRoot, 'data', 'admin.json'), { force: true });
fs.rmSync(path.join(tmpRoot, 'data', 'submissions.json'), { force: true });
fs.rmSync(path.join(tmpRoot, 'data', 'media.json'), { force: true });
fs.rmSync(path.join(tmpRoot, 'data', 'media'), { recursive: true, force: true });
fs.rmSync(path.join(tmpRoot, 'data', 'draft.json'), { force: true });
fs.rmSync(path.join(tmpRoot, 'data', 'history'), { recursive: true, force: true });

const sentMail = [];
const mailServer = http.createServer((req,res)=>{let raw='';req.on('data',chunk=>{raw+=chunk;});req.on('end',()=>{try{sentMail.push(JSON.parse(raw));}catch(error){}res.writeHead(200,{'Content-Type':'application/json'});res.end('{"id":"browser-email"}');});});
const mailReady = new Promise((resolve,reject)=>{mailServer.once('error',reject);mailServer.listen(MAIL_PORT,'127.0.0.1',resolve);});

const app = spawn(process.execPath, ['server.js'], {
  cwd: tmpRoot,
  env: Object.assign({}, process.env, { PORT: String(APP_PORT), HOST: '127.0.0.1', ADMIN_PASSWORD: TEST_PASSWORD,
    RESEND_API_KEY: 're_browser_test', RESEND_API_URL: 'http://127.0.0.1:' + MAIL_PORT + '/emails', NOTIFY_EMAIL_TO: '', NOTIFY_WEBHOOK_URL: '' }),
  stdio: ['ignore', 'pipe', 'pipe']
});
let appOut = '';
app.stdout.on('data', d => { appOut += d; });
app.stderr.on('data', d => { appOut += d; });
const browser = spawn(browserBin, [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + DEBUG_PORT, '--user-data-dir=' + browserProfile, '--window-size=1366,768', 'about:blank'
], { stdio: 'ignore' });

let pass = 0, fail = 0;
function check(name, value, extra){
  if (value) pass++; else fail++;
  console.log((value ? 'PASS ' : 'FAIL ') + name + (value || extra == null ? '' : '  → ' + String(extra).slice(0, 500)));
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, timeout){
  const end = Date.now() + timeout;
  while (Date.now() < end){ try { const value = await fn(); if (value) return value; } catch (e) {} await pause(50); }
  return null;
}

async function main(){
  await mailReady;
  const pageInfo = await waitFor(async () => {
    const list = await (await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json/list')).json();
    return list.find(item => item.type === 'page');
  }, 10000);
  if (!pageInfo) throw new Error('Chromium debugging endpoint did not start.');
  const ready = await waitFor(() => /Admin dashboard/.test(appOut), 10000);
  if (!ready) throw new Error('Site server did not start: ' + appOut);

  const ws = new WebSocket(pageInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id); pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  };
  function send(method, params){
    return new Promise((resolve, reject) => {
      const id = ++seq; pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async function evaluate(expression){
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed');
    return response.result.value;
  }
  async function viewport(width, height){
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  }
  async function go(route){
    await send('Page.navigate', { url: BASE + route });
    /* DOMContentLoaded is enough for these local scripts. Waiting for complete
       makes the suite depend on third-party font hosts being reachable. */
    const loaded = await waitFor(async () => (await evaluate('document.readyState')) !== 'loading', 10000);
    if (!loaded) throw new Error('Timed out loading ' + route);
  }
  async function screenshot(name){
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const dir = path.join(ROOT, 'audit', 'final', 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  /* The product has local font fallbacks; the smoke suite must not inherit
     availability or latency from third-party font/image hosts. */
  await send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', 'https://example.test/*'] });

  await viewport(390, 844); await go('/index.html');
  let state = await evaluate(`(() => { const h=document.querySelector('#hamburgerBtn'), r=h.getBoundingClientRect(); return {
    overflow:document.documentElement.scrollWidth-window.innerWidth, hamburgerVisible:getComputedStyle(h).display!=='none',
    hamburgerInside:r.left>=0&&r.right<=window.innerWidth, proofHidden:[...document.querySelectorAll('[data-proof]')].every(x=>getComputedStyle(x).display==='none') }; })()`);
  check('390px home has no horizontal overflow', state.overflow <= 0, JSON.stringify(state));
  check('390px hamburger stays visible and inside viewport', state.hamburgerVisible && state.hamburgerInside, JSON.stringify(state));
  check('unverified proof is hidden by default', state.proofHidden, JSON.stringify(state));
  state = await evaluate(`({ emptyLinks:document.querySelectorAll('a[href="#"]').length, legalMissing:document.querySelectorAll('.legal-missing').length, cookieButton:document.querySelector('#cookiePrefsLink')?.tagName })`);
  check('missing legal URLs render honestly and cookie preferences stays actionable', state.emptyLinks === 0 && state.legalMissing === 2 && state.cookieButton === 'BUTTON', JSON.stringify(state));
  await evaluate(`document.querySelector('#hamburgerBtn').click()`); await pause(320);
  state = await evaluate(`(() => { const d=document.querySelector('#mobileDrawer'); return { open:d.classList.contains('open'), hidden:d.getAttribute('aria-hidden'), drawerInert:d.inert, mainInert:document.querySelector('main').inert, visibility:getComputedStyle(d).visibility }; })()`);
  check('drawer opens as an active modal and inerts the page', state.open && state.hidden === 'false' && !state.drawerInert && state.mainInert && state.visibility === 'visible', JSON.stringify(state));
  await evaluate(`document.querySelector('#drawerClose').click()`); await waitFor(() => evaluate(`getComputedStyle(document.querySelector('#mobileDrawer')).visibility==='hidden'`), 1200);
  state = await evaluate(`(() => { const d=document.querySelector('#mobileDrawer'); return { hidden:d.getAttribute('aria-hidden'), drawerInert:d.inert, mainInert:document.querySelector('main').inert, visibility:getComputedStyle(d).visibility }; })()`);
  check('drawer close restores the page and removes hidden links', state.hidden === 'true' && state.drawerInert && !state.mainInert && state.visibility === 'hidden', JSON.stringify(state));
  await screenshot('home-390');

  await go('/contact.html');
  state = await evaluate(`({ overflow:document.documentElement.scrollWidth-window.innerWidth, columns:getComputedStyle(document.querySelector('.contact-layout')).gridTemplateColumns })`);
  check('390px contact layout collapses without overflow', state.overflow <= 0 && state.columns.trim().split(/\s+/).length === 1, JSON.stringify(state));
  await evaluate(`document.querySelector('.validate-form button[type="submit"]').click()`);
  state = await evaluate(`({ invalid:document.querySelectorAll('.validate-form [aria-invalid="true"]').length, messages:[...document.querySelectorAll('.validate-form .err-msg')].filter(x=>getComputedStyle(x).display!=='none').length })`);
  check('contact form exposes text for every required-field error', state.invalid === 5 && state.messages === 5, JSON.stringify(state));
  await screenshot('contact-390-errors');

  await go('/service-brand-launch.html');
  state = await evaluate(`({ overflow:document.documentElement.scrollWidth-window.innerWidth, columns:getComputedStyle(document.querySelector('.service-layout')).gridTemplateColumns, closed:[...document.querySelectorAll('.faq-item:not(.open) .faq-a')].every(x=>x.inert&&getComputedStyle(x).visibility==='hidden') })`);
  check('390px service layout collapses without overflow', state.overflow <= 0 && state.columns.trim().split(/\s+/).length === 1, JSON.stringify(state));
  check('closed FAQ panels are inert and hidden', state.closed, JSON.stringify(state));

  await viewport(1366, 768); await go('/index.html');
  await evaluate(`document.querySelector('.nav-item.has-mega > a').click()`); await pause(300);
  state = await evaluate(`(() => { const m=document.querySelector('.mega'), r=m.getBoundingClientRect(); return {
    visible:getComputedStyle(m).visibility==='visible', left:r.left, right:r.right, bottom:r.bottom, width:innerWidth, height:innerHeight,
    counts:[...m.querySelectorAll('.mega-col ul')].map(x=>x.querySelectorAll('a').length), all:!!m.querySelector('.all-services') }; })()`);
  check('1366×768 mega-menu stays within the viewport', state.visible && state.left >= 0 && state.right <= state.width && state.bottom <= state.height, JSON.stringify(state));
  check('mega-menu uses the configured four-link density', state.counts.every(n => n === 4) && state.all, JSON.stringify(state));
  await screenshot('mega-1366');

  await viewport(800, 900); await go('/article.html');
  state = await evaluate(`({ svg:!!document.querySelector('.article-diagram svg'), linkedin:document.querySelector('[data-share="linkedin"]').href, x:document.querySelector('[data-share="x"]').href, copy:!!document.querySelector('button[data-share="copy"]') })`);
  check('article diagram and all share controls are real', state.svg && /linkedin\.com\/sharing/.test(state.linkedin) && /twitter\.com\/intent/.test(state.x) && state.copy, JSON.stringify(state));

  await viewport(900, 800); await go('/admin.html');
  await evaluate(`document.querySelector('#forgotPassword').click()`);
  await waitFor(() => evaluate(`!document.querySelector('#recoverView').hidden && !document.querySelector('#recoverStatus').hidden`), 3000);
  state = await evaluate(`({ loginHidden:document.querySelector('#loginForm').hidden, recoverHidden:document.querySelector('#recoverView').hidden, message:document.querySelector('#recoverHelp').textContent, sendDisabled:document.querySelector('#sendRecovery').disabled })`);
  check('login recovery view explains unavailable email honestly', state.loginHidden && !state.recoverHidden && state.sendDisabled && /delete data\/admin\.json/.test(state.message), JSON.stringify(state));
  await screenshot('login-recovery-900');
  await go('/admin.html?reset='+'a'.repeat(64));
  state = await evaluate(`({ resetHidden:document.querySelector('#resetForm').hidden, loginHidden:document.querySelector('#loginForm').hidden, fields:document.querySelectorAll('#resetForm input[type="password"]').length })`);
  check('reset links open an owned new-password form', !state.resetHidden && state.loginHidden && state.fields === 2, JSON.stringify(state));

  await viewport(1440, 900); await go('/admin-advanced.html');
  await waitFor(() => evaluate(`!document.querySelector('#login').hidden`), 3000);
  await evaluate(`document.querySelector('#loginForm').requestSubmit()`);
  state = await evaluate(`({ invalid:document.querySelector('#loginPw').getAttribute('aria-invalid'), focus:document.activeElement.id, message:document.querySelector('#loginErr').textContent })`);
  check('admin sign-in owns its empty-password validation', state.invalid === 'true' && state.focus === 'loginPw' && /Enter your password/.test(state.message), JSON.stringify(state));
  state = await evaluate(`(() => { const toggle=document.querySelector('[data-password-toggle="loginPw"]'); toggle.click(); const input=document.querySelector('#loginPw'); const result={type:input.type,pressed:toggle.getAttribute('aria-pressed')}; toggle.click(); return result; })()`);
  check('admin password can be revealed without changing its value', state.type === 'text' && state.pressed === 'true', JSON.stringify(state));
  await evaluate(`(() => { document.querySelector('#loginPw').value=${JSON.stringify(TEST_PASSWORD)}; document.querySelector('#loginForm').requestSubmit(); })()`);
  const signedIn = await waitFor(() => evaluate(`!document.querySelector('#app').hidden`), 10000);
  check('admin signs in and renders the overview', !!signedIn);
  await evaluate(`document.querySelector('[data-tab="account"]').click()`); await pause(100);
  await evaluate(`(() => { const button=document.querySelector('#resetAll'); button.focus(); button.click(); })()`); await pause(100);
  state = await evaluate(`(() => { const d=document.querySelector('#confirmDialog'); return {open:d.open,message:document.querySelector('#confirmMessage').textContent,active:document.activeElement.value}; })()`);
  check('destructive admin actions use the owned confirmation dialog', state.open && /Reset every setting/.test(state.message) && state.active === 'cancel', JSON.stringify(state));
  await evaluate(`document.querySelector('#confirmDialog button[value="cancel"]').click()`); await pause(100);
  state = await evaluate(`({ open:document.querySelector('#confirmDialog').open, focus:document.activeElement.id })`);
  check('confirmation cancel restores focus to its trigger', !state.open && state.focus === 'resetAll', JSON.stringify(state));
  await evaluate(`document.querySelector('[data-tab="settings"]').click()`); await pause(100);
  state = await evaluate(`({ overflow:document.documentElement.scrollWidth-window.innerWidth, mega:!!document.querySelector('[data-bind="settings.megaMenuLinkLimit"]'), proof:!!document.querySelector('[data-bind="features.showVerifiedProof"]'), article:!!document.querySelector('[data-bind="structured.articleAuthor"]'), job:!!document.querySelector('[data-bind="structured.jobApplyUrl"]') })`);
  check('admin settings omit technical fields and fit the desktop', state.overflow <= 0 && !state.mega && !state.proof && !state.article && !state.job, JSON.stringify(state));
  await screenshot('admin-settings-1440');

  /* ---- authenticated on-page editor ---- */
  await viewport(1366, 900); await go('/index.html?edit=1');
  const editorReady = await waitFor(() => evaluate(`!!document.querySelector('.omni-bar') && document.documentElement.classList.contains('omni-editing')`), 10000);
  state = await evaluate(`({ bar:!!document.querySelector('.omni-bar'), editing:document.documentElement.classList.contains('omni-editing'), kinetic:document.querySelectorAll('.kinetic .kw').length, controls:document.querySelectorAll('.omni-bar button,.omni-bar select').length })`);
  check('authenticated edit mode renders the bar before motion starts', !!editorReady && state.bar && state.editing && state.kinetic === 0 && state.controls >= 11, JSON.stringify(state));
  state = await evaluate(`({ publish:document.querySelector('[data-editor-publish]').textContent.trim(), disabled:document.querySelector('[data-editor-publish]').disabled, drafted:!!window.OmniEditor.getState().draft.collections })`);
  check('opening a page invents no changes', state.publish === 'Publish (0)' && state.disabled && !state.drafted, JSON.stringify(state));
  /* the drag handle lives in a hover-only toolbar; if it hides once the pointer
     leaves the source, the browser cancels the drag and only ▲▼ work */
  await evaluate(`(() => { const s=document.querySelector('[data-section="index.s1"]');
    s.querySelector('.omni-drag').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}));
    document.querySelector('[data-section="index.s3"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); })()`);
  await pause(400); /* the toolbar fades in; measure after the transition */
  state = await evaluate(`(() => { const s=document.querySelector('[data-section="index.s1"]'), cs=getComputedStyle(s.querySelector('.omni-section-tools'));
    const out={ dragging:document.documentElement.classList.contains('omni-dragging'), source:s.classList.contains('omni-drag-source'), visibility:cs.visibility, opacity:cs.opacity };
    s.querySelector('.omni-drag').dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:new DataTransfer()}));
    out.cleared=!document.documentElement.classList.contains('omni-dragging'); return out; })()`);
  check('a dragged section keeps its handle visible until the drag ends', state.dragging && state.source && state.visibility === 'visible' && Number(state.opacity) === 1 && state.cleared, JSON.stringify(state));
  state = await evaluate(`(() => { const shells=[...document.querySelectorAll('[data-image-shell]')];
    const small=shells.find(s=>s.offsetWidth&&s.offsetWidth<220), big=shells.find(s=>s.offsetWidth>=220);
    const label=s=>s?getComputedStyle(s.querySelector('.omni-image-action')).fontSize:null;
    return { smallCompact:!!small&&small.classList.contains('omni-image-shell--compact'), smallLabel:label(small), bigCompact:big?big.classList.contains('omni-image-shell--compact'):false, bigLabel:label(big) }; })()`);
  check('small image slots use a compact badge instead of covering the slot', state.smallCompact && state.smallLabel === '0px' && !state.bigCompact && state.bigLabel !== '0px', JSON.stringify(state));
  state = await evaluate(`(() => { const bar=document.querySelector('.omni-bar'); const visible=[...bar.querySelectorAll('.omni-bar__desktop button,.omni-bar__desktop select')].filter(el=>getComputedStyle(el).display!=='none'); return {
    overflow:bar.scrollWidth-bar.clientWidth, inside:visible.every(el=>el.getBoundingClientRect().right<=window.innerWidth+0.5),
    more:getComputedStyle(bar.querySelector('.omni-bar__desktop [data-editor-more]')).display!=='none', historyHidden:getComputedStyle(bar.querySelector('[data-editor-history]')).display==='none' }; })()`);
  check('1366px desktop bar folds secondary controls into More and does not overflow', state.overflow <= 0 && state.inside && state.more && state.historyHidden, JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-bar__desktop [data-editor-more]').click()`);
  await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Editor menu'`), 3000);
  state = await evaluate(`({ title:document.querySelector('#omniPanelTitle')?.textContent, history:!!document.querySelector('[data-mobile-open="history"]'), expanded:document.querySelector('.omni-bar__desktop [data-editor-more]').getAttribute('aria-expanded') })`);
  check('desktop More menu exposes the folded controls', state.title === 'Editor menu' && state.history && state.expanded === 'true', JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click()`); await pause(100);
  await evaluate(`document.querySelector('[data-editor-page]').click()`);
  await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='This page' && !!document.querySelector('#omniSeoTitle')?.placeholder`), 3000);
  await evaluate(`(() => { const values=[['#omniSeoTitle','Home search title'],['#omniSeoDescription','A precise page description for search and social sharing.'],['#omniSeoImage','https://example.test/home-share.jpg']]; values.forEach(([selector,value])=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});const noindex=document.querySelector('#omniSeoNoindex');noindex.checked=true;noindex.dispatchEvent(new Event('change',{bubbles:true})); })()`);await pause(120);
  await waitFor(() => evaluate(`document.querySelector('[data-share-empty]').textContent==='Image preview unavailable'`), 1000);
  state = await evaluate(`(() => { const page=window.OmniEditor.getState().draft.pages.index;return{title:document.querySelector('[data-google-title]').textContent,description:document.querySelector('[data-share-description]').textContent,image:document.querySelector('[data-share-image]').src,imageHidden:document.querySelector('[data-share-image]').hidden,imageState:document.querySelector('[data-share-empty]').textContent,titleCount:document.querySelector('[data-title-count]').textContent,descriptionCount:document.querySelector('[data-description-count]').textContent,media:!!document.querySelector('[data-seo-media]'),draft:page};})()`);
  check('This page SEO controls update both previews and the draft', state.title === 'Home search title' && /precise page description/.test(state.description) && /home-share\.jpg/.test(state.image) && state.imageHidden && state.imageState === 'Image preview unavailable' && /17 \/ 60/.test(state.titleCount) && /57 \/ 160/.test(state.descriptionCount) && state.media && state.draft.noindex === true && state.draft.ogImage === 'https://example.test/home-share.jpg', JSON.stringify(state));
  await screenshot('editor-this-page-1366');
  await evaluate(`document.querySelector('.omni-panel__close').click()`);
  await evaluate(`(() => { const el=document.querySelector('[data-i18n="home.hero.h1"]'); el.click(); el.textContent='A sharper draft headline.'; el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); })()`);
  const draftSaved = await waitFor(() => evaluate(`fetch('/api/draft',{credentials:'same-origin'}).then(r=>r.json()).then(x=>x.draft?.i18n?.en?.['home.hero.h1']==='A sharper draft headline.')`), 6000);
  check('click-to-edit commits and autosaves an English text key', !!draftSaved);
  await go('/index.html?edit=1'); await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`), 10000);
  state = await evaluate(`document.querySelector('[data-i18n="home.hero.h1"]').textContent`);
  check('server draft survives an editor reload', state === 'A sharper draft headline.', state);
  await evaluate(`document.querySelector('[data-editor-preview]').click()`);await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Draft preview'`),3000);
  await evaluate(`document.querySelector('[data-preview-create]').click()`);
  const previewCreated = await waitFor(() => evaluate(`document.querySelector('#omniPreviewUrl')?.value||''`),8000);
  state=await evaluate(`({url:document.querySelector('#omniPreviewUrl').value,status:document.querySelector('[data-preview-status]').textContent,message:document.querySelector('.omni-form-message').textContent})`);
  check('Preview panel creates a clear expiring private link',!!previewCreated&&/preview=/.test(state.url)&&/active until/.test(state.status)&&/Anyone with this URL/.test(state.message),JSON.stringify(state));
  const previewToken=new URL(state.url).searchParams.get('preview');
  await go('/?preview='+encodeURIComponent(previewToken));await waitFor(() => evaluate(`document.documentElement.classList.contains('omni-preview')`),5000);
  state=await evaluate(`({ribbon:document.querySelector('.omni-preview-ribbon')?.textContent,headline:document.querySelector('[data-i18n="home.hero.h1"]')?.textContent.trim().replace(/\\s+/g,' '),editor:!!document.querySelector('.omni-bar'),linked:[...document.querySelectorAll('a[href]')].some(a=>a.href.includes('preview='))})`);
  check('shared preview is visibly non-live, uses the draft, and carries access through internal links',/Preview — not live/.test(state.ribbon||'')&&state.headline==='A sharper draft headline.'&&!state.editor&&state.linked,JSON.stringify(state));
  await evaluate(`document.querySelector('form')?.requestSubmit()`);await pause(80);
  check('preview blocks forms with an owned explanation',await evaluate(`/No information was sent/.test(document.querySelector('.omni-preview-ribbon span')?.textContent||'')`));
  await go('/index.html?edit=1');await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`),10000);
  await evaluate(`document.querySelector('[data-editor-preview]').click()`);await waitFor(() => evaluate(`!document.querySelector('[data-preview-revoke]').hidden`),3000);await evaluate(`document.querySelector('[data-preview-revoke]').click()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-dialog[open]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')`),5000);
  check('Preview panel revokes the current URL immediately',await evaluate(`fetch('/?preview='+${JSON.stringify(previewToken)}).then(response=>response.status===403)`));
  await evaluate(`document.querySelector('.omni-panel__close').click()`);
  await evaluate(`document.querySelector('[data-editor-lang="az"]').click()`); await pause(100);
  await evaluate(`(() => { const el=document.querySelector('[data-i18n="home.hero.h1"]'); el.click(); el.textContent='Daha kəskin qaralama başlıq.'; el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); document.querySelector('[data-editor-lang="en"]').click(); })()`); await pause(100);
  state = await evaluate(`({ text:document.querySelector('[data-i18n="home.hero.h1"]').textContent, lang:document.documentElement.lang, az:window.OmniEditor.getState().draft.i18n.az['home.hero.h1'] })`);
  check('AZ editing stays separate from the English draft', state.text === 'A sharper draft headline.' && state.lang === 'en' && state.az === 'Daha kəskin qaralama başlıq.', JSON.stringify(state));
  await evaluate(`(() => { const el=document.querySelector('[data-i18n="home.hero.eyebrow"]'); const before=el.textContent; el.click(); el.textContent='Temporary eyebrow'; el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return {before,after:el.textContent,editing:el.hasAttribute('contenteditable')}; })()`);
  state = await evaluate(`({ text:document.querySelector('[data-i18n="home.hero.eyebrow"]').textContent, editing:document.querySelector('[data-i18n="home.hero.eyebrow"]').hasAttribute('contenteditable') })`);
  check('Escape cancels the active text edit', state.text !== 'Temporary eyebrow' && !state.editing, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-section="index.s2"] [data-section-hide]').click()`); await pause(80);
  state = await evaluate(`(() => { const s=document.querySelector('[data-section="index.s2"]'),b=s.querySelector('.omni-section-badge'); return {hidden:s.getAttribute('data-editor-hidden'),badge:b&&!b.hidden&&b.textContent}; })()`);
  check('hidden sections remain visible and labelled in edit mode', state.hidden === 'true' && state.badge === 'Hidden', JSON.stringify(state));
  const beforeOrder = await evaluate(`[...document.querySelectorAll('main > [data-section]')].map(x=>x.dataset.section).slice(0,3).join(',')`);
  await evaluate(`document.querySelector('[data-section="index.s1"] [data-section-down]').click()`); await pause(80);
  const afterOrder = await evaluate(`[...document.querySelectorAll('main > [data-section]')].map(x=>x.dataset.section).slice(0,3).join(',')`);
  check('section move controls update DOM order immediately', beforeOrder !== afterOrder && afterOrder.startsWith('index.s2,index.s1'), beforeOrder + ' → ' + afterOrder);
  await evaluate(`document.querySelector('[data-section="index.s1"] [data-section-accent-button]').click()`); await pause(80);
  state = await evaluate(`document.querySelector('[data-section="index.s1"]').style.getPropertyValue('--acc')`);
  check('section accent cycles live through the shared layout model', state === 'var(--c1)', state);
  await screenshot('editor-home-1366');
  await evaluate(`document.querySelector('[data-editor-publish]').click()`);
  const publishDialog = await waitFor(() => evaluate(`!!document.querySelector('.omni-dialog[open]')`), 3000);
  state = await evaluate(`({ open:!!document.querySelector('.omni-dialog[open]'), summary:document.querySelectorAll('.omni-summary li').length, focus:document.activeElement.hasAttribute('data-dialog-cancel') })`);
  check('Publish opens an owned summary dialog', !!publishDialog && state.open && state.summary === 7 && state.focus, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  const published = await waitFor(() => evaluate(`!document.querySelector('.omni-dialog') && document.querySelector('[data-editor-publish]').disabled`), 10000);
  check('Publish promotes the draft and resets the counter', !!published);
  await go('/index.html');
  state = await evaluate(`(() => { const sections=[...document.querySelectorAll('main > [data-section]')]; const hidden=document.querySelector('[data-section="index.s2"]'); return {editor:!!document.querySelector('.omni-bar'),display:getComputedStyle(hidden).display,order:sections.slice(0,2).map(x=>x.dataset.section).join(','),accent:document.querySelector('[data-section="index.s1"]').style.getPropertyValue('--acc')}; })()`);
  state.meta = await evaluate(`({ title:document.title, robots:document.querySelector('meta[name="robots"]')?.content, image:document.querySelector('meta[property="og:image"]')?.content })`);
  check('published section layout and page SEO reach the public page', !state.editor && state.display === 'none' && state.order === 'index.s2,index.s1' && state.accent === 'var(--c1)' &&
    state.meta.title === 'Home search title' && state.meta.robots === 'noindex,nofollow' && /home-share\.jpg/.test(state.meta.image), JSON.stringify(state));

  /* ---- in-place catalogue, design controls and preview ---- */
  await go('/services.html?edit=1'); await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`), 10000);
  const catalogueBefore = await evaluate(`document.querySelectorAll('.eng-row[data-n="1"] .eng-cols li').length`);
  await evaluate(`(() => { let guard=100; while(document.querySelectorAll('.eng-row[data-n="1"] .eng-cols li').length>3&&guard--){document.querySelector('.eng-row[data-n="1"] .eng-cols li .omni-item-remove').click();} return document.querySelectorAll('.eng-row[data-n="1"] .eng-cols li').length; })()`);
  state = await evaluate(`({ count:document.querySelectorAll('.eng-row[data-n="1"] .eng-cols li').length, model:window.OmniEditor.getState().draft.engines[0].groups.reduce((n,g)=>n+g.items.length,0) })`);
  check('catalogue items can be removed in place from both the DOM and model', catalogueBefore > state.count && state.count === 3 && state.model === 3, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-editor-publish]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`), 3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`), 10000);
  await go('/index.html');await evaluate(`document.querySelector('.nav-item.has-mega > a').click()`);await pause(100);
  state = await evaluate(`document.querySelectorAll('.mega-col[data-n="1"] ul a').length`);
  check('published catalogue removal reduces the public mega-menu', state === 3, state);

  await go('/index.html?edit=1');await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`), 10000);await evaluate(`document.querySelector('[data-editor-design]').click()`);await pause(100);
  state = await evaluate(`({ panel:document.querySelector('#omniPanelTitle').textContent, colours:document.querySelectorAll('.omni-colour-row').length, fonts:document.querySelectorAll('.omni-font-card').length, motion:document.querySelectorAll('[data-motion]').length })`);
  check('Design opens the complete live palette sheet', state.panel === 'Design' && state.colours === 8 && state.fonts === 4 && state.motion === 3, JSON.stringify(state));
  await evaluate(`(() => { const input=document.querySelector('#omniColour7');input.value='#135e4a';input.dispatchEvent(new Event('input',{bubbles:true})); })()`);await pause(80);
  state = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--signal').trim()`);
  check('colour chips repaint shared site tokens live', state.toLowerCase() === '#135e4a', state);
  await evaluate(`document.querySelector('[data-editor-undo]').click()`);await pause(80);
  const undoColour = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--signal').trim()`);
  await evaluate(`document.querySelector('[data-editor-redo]').click()`);await pause(80);
  const redoColour = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--signal').trim()`);
  check('editor undo and redo restore design mutations', undoColour.toLowerCase() !== '#135e4a' && redoColour.toLowerCase() === '#135e4a', undoColour + ' → ' + redoColour);
  await evaluate(`[...document.querySelectorAll('.omni-font-card')].find(x=>x.querySelector('strong').textContent==='Sora').click()`);await pause(80);
  state = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim()`);
  check('font presets repaint the display family live', /Sora/.test(state), state);
  await evaluate(`document.querySelector('[data-motion="off"]').click()`);await pause(80);
  state = await evaluate(`({ mode:window.OmniEditor.getState().draft.design.motion, flags:['kineticHeadlines','marquee','customCursor','magneticButtons','reveal','countUp'].every(k=>window.OmniEditor.getState().draft.features[k]===false) })`);
  check('motion mode writes the individual runtime flags', state.mode === 'off' && state.flags, JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-phone]').click()`);await pause(100);
  state = await evaluate(`(() => { const f=document.querySelector('#omniPageFrame'),r=f.getBoundingClientRect();return{pressed:document.querySelector('[data-editor-phone]').getAttribute('aria-pressed'),width:r.width,clip:getComputedStyle(f).overflowX,pageOverflow:document.documentElement.scrollWidth-innerWidth,nav:getComputedStyle(f.querySelector('.primary-nav')).display,visual:getComputedStyle(f.querySelector('.hero-visual')).display};})()`);
  check('phone preview uses a contained 390px responsive frame', state.pressed === 'true' && Math.round(state.width) === 390 && state.clip === 'clip' && state.pageOverflow <= 0 && state.nav === 'none' && state.visual === 'none', JSON.stringify(state));
  await screenshot('editor-phone-preview-1366');
  await evaluate(`(() => { const select=document.querySelector('#omniPageSelect');select.value='about';select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  const switched = await waitFor(() => evaluate(`location.pathname.endsWith('/about.html')&&!!document.querySelector('.omni-bar')`), 10000);
  check('page switcher carries the private draft into another real page', !!switched);
  await evaluate(`(() => { const select=document.querySelector('#omniPageSelect');select.value='index';select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  const homeReady = await waitFor(() => evaluate(`location.pathname.endsWith('/index.html')&&!!document.querySelector('[data-collection="cases"] [data-collection-status]')`), 10000);
  if(homeReady){await evaluate(`document.querySelector('[data-collection="cases"] [data-collection-status]').click()`);await pause(80);state=await evaluate(`(() => { const item=document.querySelector('[data-collection="cases"] [data-collection-id]');return{draft:!!item.querySelector('.collection-draft'),visible:!item.hidden,published:window.OmniEditor.getState().draft.collections.cases[0].published,html:item.innerHTML.slice(0,220)};})()`);}else state={draft:false,visible:false,published:true};
  check('collection cards can be unpublished without disappearing from the editor', !!homeReady && state.draft && state.visible && state.published === false, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-editor-discard]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`), 3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  const discarded = await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')&&document.querySelector('[data-editor-publish]').disabled`), 10000);
  state = await evaluate(`fetch('/api/draft',{credentials:'same-origin'}).then(r=>r.json()).then(x=>x.draft===null)`);
  check('Discard clears both server and client draft state', !!discarded && state);

  /* ---- media library, slots, focal point and publish guard ---- */
  await evaluate(`document.querySelector('[data-image="index.hero"]').parentElement.querySelector('.omni-image-action').click()`);
  const mediaOpened = await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Media' && !!document.querySelector('#omniMediaFiles')`), 5000);
  state = await evaluate(`({ target:document.querySelector('[data-media-target]')?.textContent, empty:document.querySelector('[data-media-grid]')?.textContent })`);
  check('image-slot control opens an owned media panel for that slot', !!mediaOpened && state.target === 'index.hero' && /No images yet|Loading media/.test(state.empty), JSON.stringify(state));
  await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;const ctx=canvas.getContext('2d');const gradient=ctx.createLinearGradient(0,0,1200,800);gradient.addColorStop(0,'#4634f0');gradient.addColorStop(1,'#c6f24e');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,800);ctx.fillStyle='#ffffff';ctx.font='700 88px sans-serif';ctx.fillText('CASE',80,430);canvas.toBlob(blob=>{const input=document.querySelector('#omniMediaFiles'),dt=new DataTransfer();dt.items.add(new File([blob],'phase-b-case.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();},'image/png');})`);
  const firstUpload = await waitFor(() => evaluate(`document.querySelector('.omni-upload [data-upload-status]')?.textContent==='Ready' && document.querySelectorAll('.omni-media-card').length===1`), 15000);
  state = await evaluate(`({ cards:document.querySelectorAll('.omni-media-card').length, progress:document.querySelector('.omni-upload progress')?.value, dimensions:document.querySelector('.omni-media-card small')?.textContent, variants:window.OmniEditor.getState().media[0].variants })`);
  check('browser creates and uploads all responsive image variants with progress', !!firstUpload && state.cards === 1 && state.progress === 100 && /1200 × 800/.test(state.dimensions) && state.variants.join(',') === '480,960,1600', JSON.stringify(state));
  await evaluate(`(() => {const alt=document.querySelector('[data-media-alt]'),x=document.querySelector('[data-focal-x]'),y=document.querySelector('[data-focal-y]');alt.value='Purple and lime case-study artwork';x.value='25';y.value='68';x.dispatchEvent(new Event('input',{bubbles:true}));y.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-media-use]').click();})()`);
  const firstAssigned = await waitFor(() => evaluate(`window.OmniEditor.getState().draft.images?.['index.hero']?.alt==='Purple and lime case-study artwork'`), 8000);
  state = await evaluate(`(() => {const img=document.querySelector('[data-image="index.hero"]'),slot=window.OmniEditor.getState().draft.images['index.hero'];return{hidden:img.hidden,srcset:img.srcset,position:img.style.objectPosition,slot};})()`);
  check('alt text and focal point apply live to the selected image slot', !!firstAssigned && !state.hidden && /-480\.webp 480w/.test(state.srcset) && state.position === '25% 68%' && state.slot.focal.x === .25 && state.slot.focal.y === .68, JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-undo]').click()`);await pause(100);
  const imageUndone = await evaluate(`!window.OmniEditor.getState().draft.images?.['index.hero'] && document.querySelector('[data-image="index.hero"]').hidden`);
  await evaluate(`document.querySelector('[data-editor-redo]').click()`);await pause(100);
  const imageRedone = await evaluate(`window.OmniEditor.getState().draft.images?.['index.hero']?.id && !document.querySelector('[data-image="index.hero"]').hidden`);
  check('image-slot assignment participates in editor undo and redo', imageUndone && imageRedone);

  await evaluate(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=900;canvas.height=900;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff5b35';ctx.fillRect(0,0,900,900);ctx.fillStyle='#0b0c10';ctx.beginPath();ctx.arc(650,260,150,0,Math.PI*2);ctx.fill();canvas.toBlob(blob=>{const shell=document.querySelector('[data-image="mega.featured"]').parentElement,dt=new DataTransfer();dt.items.add(new File([blob],'direct-drop.png',{type:'image/png'}));shell.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));resolve();},'image/png');})`);
  const directAssigned = await waitFor(() => evaluate(`!!window.OmniEditor.getState().draft.images?.['mega.featured']?.id && document.querySelector('.omni-upload [data-upload-status]')?.textContent==='Ready'`), 15000);
  check('dropping a file directly on a slot uploads and assigns it', !!directAssigned);
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-publish]').click()`);
  const altGuard = await waitFor(() => evaluate(`document.querySelector('#omniDialogTitle')?.textContent==='Add missing alt text'`), 3000);
  state = await evaluate(`({ title:document.querySelector('#omniDialogTitle')?.textContent, slot:document.querySelector('[data-dialog-content]')?.textContent })`);
  check('Publish blocks assigned images that are missing alt text', !!altGuard && /mega\.featured/.test(state.slot), JSON.stringify(state));
  await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Media' && !!document.querySelector('[data-media-alt]')`), 5000);
  await evaluate(`(() => {const alt=document.querySelector('[data-media-alt]'),x=document.querySelector('[data-focal-x]'),y=document.querySelector('[data-focal-y]');alt.value='Coral case artwork with a dark circle';x.value='72';y.value='29';x.dispatchEvent(new Event('input',{bubbles:true}));y.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-media-use]').click();})()`);
  await waitFor(() => evaluate(`window.OmniEditor.getState().draft.images?.['mega.featured']?.alt==='Coral case artwork with a dark circle'`), 8000);
  await evaluate(`document.querySelector('.omni-panel__body').scrollTop=document.querySelector('.omni-panel__body').scrollHeight`);await pause(120);await screenshot('editor-media-1366');
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-publish]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  const mediaPublished = await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`),10000);
  check('image changes publish through the existing draft workflow', !!mediaPublished);
  await viewport(390,844);await go('/index.html');
  state = await evaluate(`(() => {const first=document.querySelector('[data-image="index.hero"]'),second=document.querySelector('[data-image="mega.featured"]'),empty=document.querySelector('[data-image="index.logos.l2"]');return{overflow:document.documentElement.scrollWidth-innerWidth,first:{hidden:first.hidden,srcset:first.srcset,position:first.style.objectPosition,alt:first.alt},second:{hidden:second.hidden,srcset:second.srcset,position:second.style.objectPosition,alt:second.alt},empty:{hidden:empty.hidden,fallback:!empty.parentElement.classList.contains('has-slot-image')}};})()`);
  check('published responsive images preserve focal crops without mobile overflow', state.overflow <= 0 && !state.first.hidden && /-1600\.webp 1600w/.test(state.first.srcset) && state.first.position === '25% 68%' && state.first.alt === 'Purple and lime case-study artwork' && !state.second.hidden && state.second.position === '72% 29%', JSON.stringify(state));
  check('an empty image slot keeps its authored placeholder', state.empty.hidden && state.empty.fallback, JSON.stringify(state));
  await evaluate(`(() => {document.documentElement.style.scrollBehavior='auto';const target=document.querySelector('[data-image="index.hero"]');scrollTo(0,target.getBoundingClientRect().top+scrollY-120);})()`);await pause(900);await screenshot('home-media-390');
  await viewport(1366,900);await go('/index.html?edit=1');await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`),10000);await evaluate(`document.querySelector('[data-image="index.hero"]').parentElement.querySelector('.omni-image-action').click()`);const deleteReady=await waitFor(() => evaluate(`!!document.querySelector('[data-media-delete]')`),10000);
  state = await evaluate(`({ deleteDisabled:document.querySelector('[data-media-delete]')?.disabled, used:document.querySelector('.omni-media-used')?.textContent, panel:document.querySelector('#omniPanelTitle')?.textContent, cards:document.querySelectorAll('.omni-media-card').length, selected:document.querySelectorAll('.omni-media-card[aria-pressed="true"]').length, body:document.querySelector('.omni-panel__body')?.textContent.slice(0,180) })`);
  check('in-use media cannot be deleted and explains where it is used', !!deleteReady && state.deleteDisabled && /index\.hero/.test(state.used), JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click()`);

  /* ---- editable collections and clean item routes ---- */
  await go('/work.html?edit=1');
  const collectionsReady = await waitFor(() => evaluate(`!!document.querySelector('[data-collection-add="cases"]')&&!!document.querySelector('[data-collection="cases"] [data-collection-id]')`), 10000);
  check('case listing exposes real collection controls in edit mode', !!collectionsReady);
  await evaluate(`document.querySelector('[data-collection-add="cases"]').click()`);
  const newCaseReady = await waitFor(() => evaluate(`location.pathname==='/work/untitled-case'&&!!document.querySelector('.omni-item-toolbar')&&!!document.querySelector('[data-field="title"]')`), 10000);
  state = await evaluate(`({ path:location.pathname, draft:document.querySelector('.omni-item-toolbar span')?.textContent, title:document.querySelector('[data-field="title"]')?.textContent })`);
  check('New case creates an unpublished item and opens its clean editable URL', !!newCaseReady && state.path === '/work/untitled-case' && state.draft === 'Draft' && state.title === 'Untitled case', JSON.stringify(state));
  await evaluate(`(() => {const title=document.querySelector('[data-field="title"]');title.click();title.textContent='Browser Growth Case';title.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('[data-editor-lang="az"]').click();})()`);await pause(100);
  await evaluate(`(() => {const title=document.querySelector('[data-field="title"]');title.click();title.textContent='Browser AZ Case';title.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('[data-editor-lang="en"]').click();})()`);await pause(100);
  state = await evaluate(`(() => {const item=window.OmniEditor.getState().draft.collections.cases.find(x=>x.slug==='untitled-case');return{visible:document.querySelector('[data-field="title"]').textContent,en:item.fields.title.en,az:item.fields.title.az};})()`);
  check('collection fields edit independently in EN and AZ', state.visible === 'Browser Growth Case' && state.en === 'Browser Growth Case' && state.az === 'Browser AZ Case', JSON.stringify(state));
  await evaluate(`document.querySelector('[data-field="body"]').click()`);await pause(80);state=await evaluate(`({ formats:[...document.querySelectorAll('.omni-mini-tools [data-format]')].map(x=>x.dataset.format), editable:document.querySelector('[data-field="body"]').isContentEditable })`);
  await evaluate(`(() => {const body=document.querySelector('[data-field="body"]');body.innerHTML='<h2>The intervention</h2><p onclick="bad()">A joined-up growth system.</p><script>bad()</script>';document.querySelector('.omni-mini-tools [data-format="done"]').click();})()`);await pause(80);
  const richBody=await evaluate(`window.OmniEditor.getState().draft.collections.cases.find(x=>x.slug==='untitled-case').fields.body.en`);
  check('collection rich text has block controls and sanitises before draft save', state.editable && ['p','h2','list','quote','done'].every(x=>state.formats.includes(x)) && /<h2>The intervention<\/h2>/.test(richBody) && !/onclick|script/i.test(richBody), richBody);
  await evaluate(`document.querySelector('[data-editor-page]').click()`);await waitFor(() => evaluate(`!!document.querySelector('#omniItemSlug')`),3000);await evaluate(`(() => {const slug=document.querySelector('#omniItemSlug');slug.value='browser-growth-case';slug.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(100);
  state=await evaluate(`({ path:location.pathname,slug:window.OmniEditor.getState().draft.collections.cases.find(x=>x.id===window.OMNI_ITEM.item.id).slug })`);
  check('editing an item slug updates the draft and browser URL without reloading', state.path === '/work/browser-growth-case' && state.slug === 'browser-growth-case', JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click()`);
  await evaluate(`document.querySelector('[data-item-details]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-collection-add-metric]')`),3000);await evaluate(`document.querySelector('[data-collection-add-metric]').click()`);await waitFor(() => evaluate(`document.querySelectorAll('.omni-metric-row').length===1`),3000);
  await evaluate(`(() => {const inputs=document.querySelectorAll('.omni-metric-row input');inputs[0].value='42%';inputs[1].value='Qualified pipeline growth';inputs[1].dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(100);
  state = await evaluate(`(() => {const item=window.OmniEditor.getState().draft.collections.cases.find(x=>x.slug==='browser-growth-case');return item.fields.metrics[0];})()`);
  check('case metrics are authored through the item-details panel', state.value === '42%' && state.label.en === 'Qualified pipeline growth', JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-item-image]').parentElement.querySelector('.omni-image-action').click()`);await waitFor(() => evaluate(`document.querySelectorAll('.omni-media-card').length>=1`),5000);await evaluate(`document.querySelector('.omni-media-card').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-media-use]')`),3000);await evaluate(`document.querySelector('[data-media-use]').click()`);
  const collectionImageAssigned = await waitFor(() => evaluate(`!!window.OmniEditor.getState().draft.collections.cases.find(x=>x.slug==='browser-growth-case')?.image?.id&&!document.querySelector('[data-item-image]').hidden`),8000);
  check('a library image can be assigned to a collection item with responsive output', !!collectionImageAssigned);
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-item-status]').click();document.querySelector('[data-editor-publish]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  const collectionPublished = await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`),10000);
  check('new collection item publishes through the shared draft workflow', !!collectionPublished);
  await go('/work/browser-growth-case');await waitFor(() => evaluate(`document.querySelector('[data-field="title"]')?.textContent==='Browser Growth Case'`),10000);
  state = await evaluate(`({ title:document.querySelector('[data-field="title"]')?.textContent,metric:document.querySelector('.collection-metric strong')?.textContent,image:document.querySelector('[data-item-image]')?.srcset,canonical:document.querySelector('link[rel="canonical"]')?.href })`);
  check('published case renders its text, metric, image and canonical on the clean URL', state.title === 'Browser Growth Case' && state.metric === '42%' && /-1600\.webp 1600w/.test(state.image) && /\/work\/browser-growth-case$/.test(state.canonical), JSON.stringify(state));
  await screenshot('collection-case-public-1366');
  await go('/work.html');await waitFor(() => evaluate(`document.querySelector('[data-collection="cases"]')?.textContent.includes('Browser Growth Case')`),5000);
  check('published case appears in the public collection listing', await evaluate(`document.querySelector('[data-collection="cases"]').textContent.includes('Browser Growth Case')`));
  await screenshot('collection-listing-public-1366');
  await go('/work/browser-growth-case?edit=1');await waitFor(() => evaluate(`!!document.querySelector('[data-item-status]')`),10000);await evaluate(`document.querySelector('[data-item-status]').click();document.querySelector('[data-editor-publish]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-publish]').disabled`),10000);
  await go('/work/browser-growth-case');state=await evaluate(`({ title:document.title, editor:!!document.querySelector('.omni-bar') })`);
  await go('/work.html');const unpublishedAbsent=await evaluate(`!document.querySelector('[data-collection="cases"]').textContent.includes('Browser Growth Case')`);
  check('unpublishing hides the item route and removes it from public listings', /404|not found/i.test(state.title) && !state.editor && unpublishedAbsent, JSON.stringify(state));

  /* ---- inbox, settings and keyboard contracts ---- */
  await go('/admin.html');
  const loginRedirect = await waitFor(() => evaluate(`location.pathname.endsWith('/index.html')&&location.search==="?edit=1"&&!!document.querySelector('.omni-bar')`), 10000);
  check('authenticated login entry redirects straight to the page editor', !!loginRedirect);
  await evaluate(`fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form:'contact',name:'Browser Lead',email:'lead@example.test',company:'Test Co',spend:'$10k',consent:true,message:'Please reply'})}).then(r=>r.json())`);
  await evaluate(`document.querySelector('[data-editor-inbox]').click()`);
  const inboxLoaded = await waitFor(() => evaluate(`document.querySelectorAll('.omni-lead').length===1`), 5000);
  state = await evaluate(`({ loaded:document.querySelector('#omniPanelTitle')?.textContent, unread:document.querySelector('[data-unread]').textContent, bold:document.querySelector('.omni-lead').classList.contains('is-unread'), export:!![...document.querySelectorAll('.omni-panel button')].find(x=>x.textContent==='Export all CSV') })`);
  check('Inbox loads newest submissions with unread and export state', !!inboxLoaded && state.loaded === 'Inbox' && state.unread === '(1)' && state.bold && state.export, JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-lead__summary').click()`);
  state = await evaluate(`({ expanded:document.querySelector('.omni-lead__summary').getAttribute('aria-expanded'), details:!document.querySelector('.omni-lead__detail').hidden, reply:document.querySelector('.omni-lead__detail a')?.href })`);
  check('Inbox details expose a direct mail reply action', state.expanded === 'true' && state.details && /^mailto:lead@example\.test/.test(state.reply), JSON.stringify(state));
  await evaluate(`[...document.querySelectorAll('.omni-inline-actions button')].find(x=>x.textContent==='Mark read').click()`);
  const readUpdated = await waitFor(() => evaluate(`document.querySelector('[data-unread]').textContent===''`), 5000);
  state = await evaluate(`fetch('/api/submissions',{credentials:'same-origin'}).then(r=>r.json()).then(x=>x[0].read===true)`);
  check('Inbox mark-read persists and updates the toolbar count', !!readUpdated && state);
  await evaluate(`document.querySelector('[data-editor-settings]').click()`);await pause(100);
  state=await evaluate(`({choices:[...document.querySelectorAll('[data-settings-view]')].map(x=>x.getAttribute('data-settings-view')),inputs:document.querySelectorAll('.omni-panel input').length})`);
  check('Settings starts with three understandable tasks and no wall of fields',state.choices.join(',')==='website,notifications,account'&&state.inputs===0,JSON.stringify(state));
  await screenshot('editor-settings-menu-1366');
  await evaluate(`document.querySelector('[data-settings-view="website"]').click()`);
  state=await evaluate(`({title:document.querySelector('#omniPanelTitle').textContent,email:!!document.querySelector('#omni-setting-settings-email'),technical:!!document.querySelector('#omni-setting-analytics-consentScript,#omni-setting-settings-megaMenuLinkLimit,#omni-setting-settings-phoneHref'),fields:document.querySelectorAll('.omni-panel input,.omni-panel select').length})`);
  check('Website details keeps contact fields and removes technical settings',state.title==='Website details'&&state.email&&!state.technical&&state.fields<=10,JSON.stringify(state));
  await screenshot('editor-website-details-1366');
  await evaluate(`document.querySelector('[data-editor-settings]').click();document.querySelector('[data-settings-view="notifications"]').click()`);
  await waitFor(()=>evaluate(`document.querySelector('[data-notify-source]')?.textContent.includes('notifications')`),3000);
  state = await evaluate(`(() => { const input=document.querySelector('#omniNotifyEmail');input.value='bad-address';document.querySelector('[data-add-recipient]').click();const described=input.getAttribute('aria-describedby');return{invalid:input.getAttribute('aria-invalid'),focus:document.activeElement.id,described,message:document.getElementById(described)?.textContent};})()`);
  check('notification chip validation is inline, linked and focused', state.invalid === 'true' && state.focus === 'omniNotifyEmail' && state.described === 'omniNotifyMessage' && /valid email/.test(state.message), JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__body').scrollTop=document.querySelector('.omni-panel__body').scrollHeight`);await pause(80);
  await screenshot('editor-settings-account-1366');
  await evaluate(`(() => { document.querySelector('[data-editor-page]').click();const input=document.querySelector('[data-proof-setting]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true})); })()`);await pause(80);
  state = await evaluate(`({ draft:window.OmniEditor.getState().draft.features.showVerifiedProof, shown:document.documentElement.classList.contains('show-verified-proof') })`);
  check('Page content approval writes the draft and repaints gated sections', state.draft === true && state.shown, JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click()`);
  await evaluate(`document.querySelector('[data-editor-history]').click()`);await pause(150);
  await waitFor(() => evaluate(`!!document.querySelector('.omni-history__item, .omni-panel-state')`), 5000);
  state = await evaluate(`({ title:document.querySelector('#omniPanelTitle').textContent, items:document.querySelectorAll('.omni-history__item').length, restore:!!document.querySelector('.omni-history__item button'), undoLabel:document.querySelector('[data-editor-undo]').textContent.trim() })`);
  check('History panel lists published versions with Restore, and Undo is labelled', state.title === 'History' && state.items >= 1 && state.restore && /Undo/.test(state.undoLabel), JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click()`);
  const tabCount = await evaluate(`[...document.querySelectorAll('.omni-bar__desktop button:not([disabled]),.omni-bar__desktop select:not([disabled])')].filter(el=>getComputedStyle(el).display!=='none').length`);
  await evaluate(`document.querySelector('.omni-bar__desktop select,.omni-bar__desktop button:not([disabled])').focus()`);
  const reached = [await evaluate(`[...document.querySelectorAll('.omni-bar__desktop button:not([disabled]),.omni-bar__desktop select:not([disabled])')].filter(el=>getComputedStyle(el).display!=='none').indexOf(document.activeElement)`)];
  for(let i=1;i<tabCount;i++){
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
    reached.push(await evaluate(`[...document.querySelectorAll('.omni-bar__desktop button:not([disabled]),.omni-bar__desktop select:not([disabled])')].filter(el=>getComputedStyle(el).display!=='none').indexOf(document.activeElement)`));
  }
  check('Tab reaches every enabled editor-bar control in order', reached.length === tabCount && reached.every((value,index)=>value===index), JSON.stringify(reached));
  await evaluate(`(() => { const button=document.querySelector('[data-editor-discard]');button.focus();button.click(); })()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-dialog[open]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  state = await evaluate(`document.activeElement.hasAttribute('data-dialog-cancel')`);
  check('editor modal traps focus from its last control to its first', state);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await pause(80);
  state = await evaluate(`({ closed:!document.querySelector('.omni-dialog'),focus:document.activeElement.hasAttribute('data-editor-discard') })`);
  check('Escape closes an editor modal and restores its trigger', state.closed && state.focus, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-editor-discard]').click()`);await waitFor(() => evaluate(`!!document.querySelector('[data-dialog-confirm]')`),3000);await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')&&document.querySelector('[data-editor-publish]').disabled`),10000);

  /* ---- native 390px editor: bottom dock, sheets and touch alternatives ---- */
  await viewport(390,844);await go('/index.html?edit=1');await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')&&document.documentElement.classList.contains('omni-editing')`),10000);
  state=await evaluate(`(() => {const mobile=document.querySelector('.omni-bar__mobile'),desktop=document.querySelector('.omni-bar__desktop'),buttons=[...mobile.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect();return{label:button.textContent.trim(),left:r.left,right:r.right,height:r.height}}),camera=document.querySelector('[data-image="index.hero"]').parentElement.querySelector('.omni-image-action'),card=document.querySelector('[data-collection="cases"] [data-collection-id]');return{mobile:getComputedStyle(mobile).display,desktop:getComputedStyle(desktop).display,overflow:document.documentElement.scrollWidth-innerWidth,buttons:buttons,camera:getComputedStyle(camera).visibility,cardMenu:!!card&&getComputedStyle(card.querySelector(':scope > .omni-touch-menu')).display,cardTools:!!card&&getComputedStyle(card.querySelector(':scope > .omni-collection-tools')).display};})()`);
  check('390px edit mode uses a contained Undo / Publish / More bottom dock',state.mobile==='grid'&&state.desktop==='none'&&state.overflow<=0&&state.buttons.length===3&&state.buttons.every(button=>button.left>=0&&button.right<=390&&button.height>=44),JSON.stringify(state));
  check('touch editor exposes permanent card and image actions without hover',state.camera==='visible'&&state.cardMenu==='grid'&&state.cardTools==='none',JSON.stringify(state));
  await screenshot('editor-mobile-390');
  await evaluate(`document.querySelector('[data-collection="cases"] [data-collection-id] > .omni-touch-menu').click()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-action-sheet[open]')`),3000);
  state=await evaluate(`[...document.querySelectorAll('.omni-action-sheet__body button')].map(button=>button.textContent.trim())`);
  check('collection cards expose status, image, reorder and delete in the touch sheet',['Move up','Move down','Change image','Delete case'].every(label=>state.includes(label))&&state.some(label=>label==='Publish'||label==='Unpublish'),JSON.stringify(state));
  await evaluate(`document.querySelector('[data-action-sheet-close]').click()`);await pause(80);
  await evaluate(`(() => {const el=document.querySelector('[data-i18n="home.hero.h1"]');el.click();el.textContent='Mobile editor headline.';})()`);await pause(100);
  state=await evaluate(`(() => {const tools=document.querySelector('.omni-mini-tools'),done=tools&&tools.querySelector('[data-format="done"]'),style=tools&&getComputedStyle(tools);return{editable:document.querySelector('[data-i18n="home.hero.h1"]').isContentEditable,done:!!done&&getComputedStyle(done).display!=='none',position:style&&style.position,bottom:style&&style.bottom,overflow:tools?tools.scrollWidth-tools.clientWidth:0};})()`);
  check('mobile text editing docks a keyboard-safe toolbar with Done',state.editable&&state.done&&state.position==='fixed'&&state.overflow<=0,JSON.stringify(state));
  await evaluate(`document.querySelector('[data-format="done"]').click()`);await pause(100);
  check('mobile Done commits the text into the draft',await evaluate(`window.OmniEditor.getState().draft.i18n.en['home.hero.h1']==='Mobile editor headline.'`));
  await evaluate(`document.querySelector('[data-section="index.s1"] > .omni-touch-menu').click()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-action-sheet[open]')`),3000);
  state=await evaluate(`(() => {const sheet=document.querySelector('.omni-action-sheet'),labels=[...sheet.querySelectorAll('.omni-action-sheet__body button')].map(x=>x.textContent.trim());return{open:sheet.open,labels:labels,focus:sheet.contains(document.activeElement)};})()`);
  check('section touch badge opens the owned Hide / Accent / Move action sheet',state.open&&state.focus&&['Hide section','Move up','Move down'].every(label=>state.labels.includes(label))&&state.labels.some(label=>label.startsWith('Accent')),JSON.stringify(state));
  await screenshot('editor-section-sheet-390');
  await evaluate(`[...document.querySelectorAll('.omni-action-sheet__body button')].find(button=>button.textContent.trim()==='Hide section').click()`);await pause(100);
  check('section actions hide the section while keeping its editor badge visible',await evaluate(`document.querySelector('[data-section="index.s1"]').getAttribute('data-editor-hidden')==='true'&&!document.querySelector('[data-section="index.s1"] .omni-section-badge').hidden`));
  await evaluate(`document.querySelector('[data-editor-more]').click()`);await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Editor menu'`),3000);
  state=await evaluate(`(() => {const panel=document.querySelector('.omni-panel'),r=panel.getBoundingClientRect(),actions=[...panel.querySelectorAll('[data-mobile-open]')].map(x=>x.textContent.trim());return{width:r.width,height:r.height,expanded:document.querySelector('[data-editor-more]').getAttribute('aria-expanded'),page:!!panel.querySelector('#omniMobilePageSelect'),languages:panel.querySelectorAll('[data-mobile-lang]').length,actions:actions};})()`);
  check('More opens a full-screen mobile menu with every secondary editor destination',Math.round(state.width)===390&&Math.round(state.height)===844&&state.expanded==='true'&&state.page&&state.languages===2&&['Design','This page','Media','History','Settings','Discard draft'].every(label=>state.actions.includes(label)),JSON.stringify(state));
  await screenshot('editor-more-390');
  await evaluate(`document.querySelector('[data-mobile-open="design"]').click()`);await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Design'`),3000);
  await evaluate(`(() => {const input=document.querySelector('#omniColour7');input.value='#B9E84A';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(100);
  state=await evaluate(`(() => {const panel=document.querySelector('.omni-panel'),r=panel.getBoundingClientRect(),input=document.querySelector('#omniHex7');return{width:r.width,height:r.height,font:getComputedStyle(input).fontSize,signal:getComputedStyle(document.documentElement).getPropertyValue('--signal').trim().toUpperCase()};})()`);
  check('mobile Design is full-screen, prevents iOS input zoom and repaints live',Math.round(state.width)===390&&Math.round(state.height)===844&&parseFloat(state.font)>=16&&state.signal==='#B9E84A',JSON.stringify(state));
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-mobile-publish]').click()`);await waitFor(() => evaluate(`!!document.querySelector('.omni-dialog[open]')`),3000);
  state=await evaluate(`(() => {const dialog=document.querySelector('.omni-dialog'),r=dialog.getBoundingClientRect();return{width:r.width,height:r.height,focus:dialog.contains(document.activeElement)};})()`);
  check('mobile Publish uses a full-screen focus-contained review dialog',Math.round(state.width)===390&&Math.round(state.height)===844&&state.focus,JSON.stringify(state));
  await screenshot('editor-publish-390');
  await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);await waitFor(() => evaluate(`!document.querySelector('.omni-dialog')&&document.querySelector('[data-editor-mobile-publish]').disabled`),10000);
  await go('/index.html');state=await evaluate(`({editor:!!document.querySelector('.omni-bar'),headline:document.querySelector('[data-i18n="home.hero.h1"]').textContent.trim().replace(/\\s+/g,' '),hidden:getComputedStyle(document.querySelector('[data-section="index.s1"]')).display,signal:getComputedStyle(document.documentElement).getPropertyValue('--signal').trim().toUpperCase(),overflow:document.documentElement.scrollWidth-innerWidth})`);
  check('mobile Publish promotes text, section and design changes without public overflow',!state.editor&&state.headline==='Mobile editor headline.'&&state.hidden==='none'&&state.signal==='#B9E84A'&&state.overflow<=0,JSON.stringify(state));
  /* ---- multi-user invitation and Editor permission presentation ---- */
  await viewport(1366,900);await go('/index.html?edit=1');await waitFor(() => evaluate(`!!document.querySelector('[data-editor-users]')`),10000);
  await evaluate(`document.querySelector('[data-editor-users]').click()`);await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Users and roles'&&document.querySelectorAll('.omni-user-card').length===1`),5000);
  state=await evaluate(`({cards:document.querySelectorAll('.omni-user-card').length,role:document.querySelector('.omni-user-card__head span').textContent,inviteDisabled:document.querySelector('.omni-user-invite [type="submit"]').disabled})`);
  check('legacy Admin invitation stays disabled until the owner email is set',state.cards===1&&/admin/.test(state.role)&&state.inviteDisabled,JSON.stringify(state));
  await evaluate(`fetch('/api/account/recovery-email',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},body:JSON.stringify({current:${JSON.stringify(TEST_PASSWORD)},email:'owner@example.test'})}).then(r=>r.json())`);
  await evaluate(`document.querySelector('.omni-panel__close').click();document.querySelector('[data-editor-users]').click()`);await waitFor(() => evaluate(`document.querySelector('#omniPanelTitle')?.textContent==='Users and roles'&&document.querySelectorAll('.omni-user-card').length===1&&!document.querySelector('.omni-user-invite [type="submit"]').disabled`),8000);
  state=await evaluate(`({title:document.querySelector('#omniPanelTitle')?.textContent,cards:document.querySelectorAll('.omni-user-card').length,role:document.querySelector('.omni-user-card__head span')?.textContent,inviteDisabled:document.querySelector('.omni-user-invite [type="submit"]')?.disabled})`);
  check('Admin user panel enables invitations after the owner email is set',state.cards===1&&/admin/.test(state.role||'')&&state.inviteDisabled===false,JSON.stringify(state));
  const inviteMailStart=sentMail.length;
  await evaluate(`(() => {document.querySelector('#omniInviteName').value='Browser Editor';document.querySelector('#omniInviteEmail').value='browser-editor@example.test';document.querySelector('#omniInviteRole').value='editor';document.querySelector('.omni-user-invite').requestSubmit();})()`);
  const invitationArrived=await waitFor(()=>sentMail.length===inviteMailStart+1,8000);
  await waitFor(() => evaluate(`document.querySelectorAll('.omni-user-card').length===2`),5000);
  const invitation=sentMail[inviteMailStart],inviteToken=invitation&&((invitation.text||'').match(/reset=([a-f0-9]{64})/)||[])[1];
  state=await evaluate(`({cards:document.querySelectorAll('.omni-user-card').length,pending:[...document.querySelectorAll('.omni-user-card__head span')].some(x=>/editor · invited/.test(x.textContent)),message:document.querySelector('.omni-user-invite .omni-form-message').textContent})`);
  check('Admin invitation UI sends mail and adds a pending Editor',!!invitationArrived&&!!inviteToken&&state.cards===2&&state.pending&&/expires in 48 hours/.test(state.message),JSON.stringify(state));
  await go('/admin.html?reset='+inviteToken);await waitFor(() => evaluate(`!document.querySelector('#resetForm').hidden`),3000);
  await evaluate(`(() => {document.querySelector('#resetPw').value='browser-editor-pass';document.querySelector('#resetPw2').value='browser-editor-pass';document.querySelector('#resetForm').requestSubmit();})()`);
  await waitFor(() => evaluate(`!document.querySelector('#loginForm').hidden&&!document.querySelector('#loginEmailField').hidden`),5000);
  await evaluate(`(() => {document.querySelector('#loginEmail').value='browser-editor@example.test';document.querySelector('#loginPw').value='browser-editor-pass';document.querySelector('#loginForm').requestSubmit();})()`);
  await waitFor(() => evaluate(`!!window.OmniEditor?.getState().user`),10000);
  state=await evaluate(`(() => {const s=window.OmniEditor.getState();return{role:s.user.role,settings:!!document.querySelector('[data-editor-settings]'),users:!!document.querySelector('[data-editor-users]'),preview:!!document.querySelector('[data-editor-preview]'),publish:s.permissions.publish};})()`);
  check('Editor sees content tools but no Admin-only Settings or Users',state.role==='editor'&&!state.settings&&!state.users&&state.preview&&state.publish,JSON.stringify(state));
  await evaluate(`document.querySelector('[data-editor-media]').click()`);await waitFor(() => evaluate(`document.querySelectorAll('.omni-media-card').length>0`),5000);await evaluate(`document.querySelector('.omni-media-card').click()`);await pause(80);
  state=await evaluate(`({disabled:document.querySelector('[data-media-delete]').disabled,title:document.querySelector('[data-media-delete]').title,help:document.querySelector('#omniMediaDeleteHelp')?.textContent})`);
  check('Editor media deletion is visibly unavailable with role guidance',state.disabled&&/Only an Admin/.test(state.title)&&/requires an Admin/.test(state.help||''),JSON.stringify(state));
  await go('/admin-advanced.html');
  check('Editor receives an owned access-denied page for the advanced dashboard',await evaluate(`/Admin access required/.test(document.body.textContent)&&!/id="app"/.test(document.documentElement.innerHTML)`));
  ws.close();
  console.log('\n' + pass + ' browser checks passed, ' + fail + ' failed');
}

main().catch(error => { fail++; console.error(error.stack || error); }).then(async () => {
  app.kill(); browser.kill();mailServer.close();
  await pause(100);
  const tempBase = path.resolve(os.tmpdir()) + path.sep;
  for (const target of [tmpRoot, browserProfile]){
    if (path.resolve(target).startsWith(tempBase)) try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
});
