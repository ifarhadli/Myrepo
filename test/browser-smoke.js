#!/usr/bin/env node
/* Optional real-browser smoke suite. Zero npm dependencies: it drives an
   installed Chromium browser through the Chrome DevTools Protocol, against a
   temporary copy of the site, and never touches real admin/submission data. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_PORT = 4300 + Math.floor(Math.random() * 400);
const DEBUG_PORT = APP_PORT + 500;
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

const app = spawn(process.execPath, ['server.js'], {
  cwd: tmpRoot,
  env: Object.assign({}, process.env, { PORT: String(APP_PORT), HOST: '127.0.0.1', ADMIN_PASSWORD: TEST_PASSWORD,
    RESEND_API_KEY: '', NOTIFY_EMAIL_TO: '', NOTIFY_WEBHOOK_URL: '' }),
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
    const loaded = await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 10000);
    if (!loaded) throw new Error('Timed out loading ' + route);
  }
  async function screenshot(name){
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const dir = path.join(ROOT, 'audit', 'final', 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  await send('Runtime.enable'); await send('Page.enable');

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
  await evaluate(`document.querySelector('#drawerClose').click()`); await pause(320);
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

  await viewport(1440, 900); await go('/admin-advanced.html');
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
  check('admin exposes launch settings without desktop overflow', state.overflow <= 0 && state.mega && state.proof && state.article && state.job, JSON.stringify(state));
  await screenshot('admin-settings-1440');

  /* ---- authenticated on-page editor ---- */
  await viewport(1366, 900); await go('/index.html?edit=1');
  const editorReady = await waitFor(() => evaluate(`!!document.querySelector('.omni-bar') && document.documentElement.classList.contains('omni-editing')`), 10000);
  state = await evaluate(`({ bar:!!document.querySelector('.omni-bar'), editing:document.documentElement.classList.contains('omni-editing'), kinetic:document.querySelectorAll('.kinetic .kw').length, controls:document.querySelectorAll('.omni-bar button,.omni-bar select').length })`);
  check('authenticated edit mode renders the bar before motion starts', !!editorReady && state.bar && state.editing && state.kinetic === 0 && state.controls >= 11, JSON.stringify(state));
  await evaluate(`(() => { const el=document.querySelector('[data-i18n="home.hero.h1"]'); el.click(); el.textContent='A sharper draft headline.'; el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); })()`);
  const draftSaved = await waitFor(() => evaluate(`fetch('/api/draft',{credentials:'same-origin'}).then(r=>r.json()).then(x=>x.draft?.i18n?.en?.['home.hero.h1']==='A sharper draft headline.')`), 6000);
  check('click-to-edit commits and autosaves an English text key', !!draftSaved);
  await go('/index.html?edit=1'); await waitFor(() => evaluate(`!!document.querySelector('.omni-bar')`), 10000);
  state = await evaluate(`document.querySelector('[data-i18n="home.hero.h1"]').textContent`);
  check('server draft survives an editor reload', state === 'A sharper draft headline.', state);
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
  check('Publish opens an owned summary dialog', !!publishDialog && state.open && state.summary === 6 && state.focus, JSON.stringify(state));
  await evaluate(`document.querySelector('[data-dialog-confirm]').click()`);
  const published = await waitFor(() => evaluate(`!document.querySelector('.omni-dialog') && document.querySelector('[data-editor-publish]').disabled`), 10000);
  check('Publish promotes the draft and resets the counter', !!published);
  await go('/index.html');
  state = await evaluate(`(() => { const sections=[...document.querySelectorAll('main > [data-section]')]; const hidden=document.querySelector('[data-section="index.s2"]'); return {editor:!!document.querySelector('.omni-bar'),display:getComputedStyle(hidden).display,order:sections.slice(0,2).map(x=>x.dataset.section).join(','),accent:document.querySelector('[data-section="index.s1"]').style.getPropertyValue('--acc')}; })()`);
  check('published section visibility, order and accent reach the public page', !state.editor && state.display === 'none' && state.order === 'index.s2,index.s1' && state.accent === 'var(--c1)', JSON.stringify(state));
  ws.close();
  console.log('\n' + pass + ' browser checks passed, ' + fail + ' failed');
}

main().catch(error => { fail++; console.error(error.stack || error); }).then(async () => {
  app.kill(); browser.kill();
  await pause(100);
  const tempBase = path.resolve(os.tmpdir()) + path.sep;
  for (const target of [tmpRoot, browserProfile]){
    if (path.resolve(target).startsWith(tempBase)) try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
});
