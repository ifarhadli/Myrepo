#!/usr/bin/env node
/* End-to-end test for server.js + the admin API. Zero dependencies.
   Copies the site into a temp dir, boots the server there on a scratch
   port with a known password, and exercises static serving, auth, publish,
   validation, meta injection and submissions. `npm test` runs it.
   Nothing in the real data/ directory is touched. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), http = require('http'), os = require('os'), path = require('path'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DEFAULT_COLLECTIONS = require(path.join(ROOT, 'js', 'data.js')).collections;
const PORT = 3111 + Math.floor(Math.random() * 500);
const BASE = 'http://127.0.0.1:' + PORT;
const MAIL_PORT = PORT + 700;
const PW = 'test-pass-1234';

const sentMail = [], mailKeys = [];
let failNextLead = false;
const mailServer = http.createServer((req, res) => {
  let raw = '';
  req.on('data', d => { raw += d; });
  req.on('end', () => {
    let message;
    try { message = JSON.parse(raw); sentMail.push(message); mailKeys.push(req.headers['idempotency-key']); } catch (e) {}
    if (failNextLead && message && /New newsletter submission/.test(message.subject || '')) {
      failNextLead = false;
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end('{"error":"Temporary test outage"}');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"id":"test-email"}');
  });
});
const mailReady = new Promise((resolve, reject) => {
  mailServer.once('error', reject);
  mailServer.listen(MAIL_PORT, '127.0.0.1', resolve);
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'omnimark-test-'));
for (const f of fs.readdirSync(ROOT)){
  if (['.git', 'node_modules', 'audit', 'test'].includes(f)) continue;
  fs.cpSync(path.join(ROOT, f), path.join(TMP, f), { recursive: true });
}
const legacySalt = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(TMP, 'data', 'admin.json'), JSON.stringify({ salt: legacySalt, hash: crypto.scryptSync(PW, legacySalt, 64).toString('hex'), secret: crypto.randomBytes(32).toString('hex'), createdAt: new Date().toISOString(), notifyEmails: [] }, null, 2));
fs.rmSync(path.join(TMP, 'data', 'submissions.json'), { force: true });
fs.rmSync(path.join(TMP, 'data', 'media.json'), { force: true });
fs.rmSync(path.join(TMP, 'data', 'media'), { recursive: true, force: true });
/* a real draft or publish history on the developer's machine must not leak
   into the run — the suite has to behave the same here and in CI */
fs.rmSync(path.join(TMP, 'data', 'draft.json'), { force: true });
fs.rmSync(path.join(TMP, 'data', 'history'), { recursive: true, force: true });

const child = spawn(process.execPath, ['server.js'], {
  cwd: TMP,
  env: Object.assign({}, process.env, { PORT: String(PORT), HOST: '127.0.0.1', ADMIN_PASSWORD: PW,
    NODE_ENV: 'test', RECOVERY_TTL_MS: '2000', TRUST_PROXY: '1',
    RESEND_API_KEY: 're_test', RESEND_API_URL: 'http://127.0.0.1:' + MAIL_PORT + '/emails',
    NOTIFY_EMAIL_FROM: 'OmniMark Test <test@example.test>', NOTIFY_WEBHOOK_URL: '', NOTIFY_EMAIL_TO: 'leads@example.test' })
});
let out = '';
child.stdout.on('data', d => { out += d; });
child.stderr.on('data', d => { out += d; });

let pass = 0, fail = 0;
function check(name, ok, extra){
  (ok ? pass++ : fail++);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra == null ? '' : '  → ' + String(extra).slice(0, 300)));
}
let cookie = '';
async function req(method, p, body, opts){
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': opts.raw ? (opts.type || 'application/octet-stream') : 'application/json' }, opts.headers || {});
  const requestCookie = Object.prototype.hasOwnProperty.call(opts, 'cookie') ? opts.cookie : cookie;
  if (requestCookie) headers.Cookie = requestCookie;
  if (opts.admin) headers['X-Requested-With'] = 'OmniAdmin';
  if(opts.admin&&!opts.noRevision){
    if(method==='PUT'&&p==='/api/site'&&!Object.prototype.hasOwnProperty.call(body||{},'baseUpdatedAt')){const live=await (await fetch(BASE+'/api/site')).json();body=Object.assign({},body,{baseUpdatedAt:live.updatedAt||null});}
    if(((method==='POST'&&p==='/api/publish')||(method==='DELETE'&&p==='/api/draft')||(method==='POST'&&/^\/api\/history\/.+\/restore$/.test(p)))&&!Object.prototype.hasOwnProperty.call(body||{},'draftRevision')){const d=await (await fetch(BASE+'/api/draft',{headers})).json();body=Object.assign({},body,{draftRevision:d.revision||0});}
  }
  const payload = body === undefined ? undefined : (opts.raw ? body : JSON.stringify(body));
  const r = await fetch(BASE + p, { method, headers, body: payload, redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc && opts.captureCookie !== false) cookie = sc.split(';')[0];
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, text, json, headers: r.headers, setCookie: sc ? sc.split(';')[0] : '' };
}
function rawHttpPath(rawPath){
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: PORT, method: 'GET', path: rawPath }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
}
const readTmp = f => fs.readFileSync(path.join(TMP, f), 'utf8');

async function main(){
  await mailReady;
  const t0 = Date.now();
  while (!/Admin dashboard/.test(out) && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 100));
  check('server booted', /Admin dashboard/.test(out), out);
  check('link targets require a session',(await req('GET','/api/link-targets')).status===401);
  const migratedAdmin = JSON.parse(readTmp('data/admin.json'));
  check('legacy single-password installs migrate to one Admin user', migratedAdmin.version === 2 && migratedAdmin.users.length === 1 && migratedAdmin.users[0].role === 'admin' && !Object.prototype.hasOwnProperty.call(migratedAdmin, 'hash'));

  /* ---- static serving ---- */
  let r = await req('GET', '/');
  check('GET / serves index', r.status === 200 && /<title>OmniMark/.test(r.text));
  check('Organization structured data is server-rendered', /"@type":"Organization"/.test(r.text) && /"name":"OmniMark"/.test(r.text));
  check('index has head scripts', /data\/site\.js/.test(r.text) && /js\/site-config\.js/.test(r.text));
  check('index accordion is a data-driven mount', /data-accordion="home"><\/div>/.test(r.text) && !/engines\.e1\.groups\.0\.items\.0/.test(r.text));
  check('home canonical is site root', /<link rel="canonical" href="https:\/\/www\.omnimark\.com\/">/.test(r.text));
  check('security headers', r.headers.get('x-content-type-options') === 'nosniff' && /camera=\(\)/.test(r.headers.get('permissions-policy') || ''));
  r = await req('GET', '/about');
  check('clean URL /about', r.status === 200 && /<title>About/.test(r.text));
  check('canonical + og:url + twitter injected', /<link rel="canonical" href="https:\/\/www\.omnimark\.com\/about\.html">/.test(r.text) && /property="og:url"/.test(r.text) && /name="twitter:card"/.test(r.text));
  r = await req('GET', '/nope');
  check('404 page with 404 status', r.status === 404 && /Page not found/.test(r.text));
  r = await req('GET', '/data/admin.json');
  check('admin.json blocked', r.status === 403);
  r = await req('GET', '/data/submissions.json');
  check('submissions.json blocked', r.status === 403);
  r = await req('GET', '/data/draft.json');
  check('draft.json blocked', r.status === 403);
  r = await req('GET', '/data/media.json');
  check('media.json blocked', r.status === 403);
  r = await req('GET', '/data/media/0000000000000000.png');
  check('private media directory blocked', r.status === 403);
  r = await req('GET', '/server.js');
  check('server.js not served', r.status === 404);
  r = await req('GET', '/../package.json');
  check('path traversal blocked', r.status !== 200 || !/omnimark-site/.test(r.text));
  r = await req('GET', '/data/site.js');
  check('site.js served', r.status === 200 && /window\.OMNI_SITE/.test(r.text));
  r = await req('GET', '/sitemap.xml');
  check('sitemap served', r.status === 200 && /<urlset/.test(r.text) && /about\.html/.test(r.text) && !/admin(?:-advanced)?\.html/.test(r.text));
  r = await req('GET', '/robots.txt');
  check('robots served', r.status === 200 && /Disallow: \/admin\.html/.test(r.text) && /Disallow: \/admin-advanced\.html/.test(r.text));
  check('robots keeps data/site.js crawlable', !/Disallow: \/data/.test(r.text));
  check('cookie banner comes from partials', !/id="cookieBanner"/.test(readTmp('index.html')) && /id="cookieBanner"/.test(readTmp('js/partials.js')));
  check('contact scheduler is config-driven', /data-scheduler/.test(readTmp('contact.html')) && !/scheduler-ph/.test(readTmp('contact.html')));

  /* ---- auth ---- */
  r = await req('GET', '/api/me');
  check('me: not authed', r.json && r.json.authed === false);
  r = await req('GET', '/api/recover');
  check('public recovery status is honest before setup', r.status === 200 && r.json.available === false);
  const mailBeforeUnconfiguredRecovery = sentMail.length;
  r = await req('POST', '/api/recover', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.10' } });
  check('recovery request never reveals missing configuration', r.status === 200 && r.json.ok && sentMail.length === mailBeforeUnconfiguredRecovery);
  r = await req('GET', '/?edit=1');
  check('anonymous edit query does not inject editor assets', r.status === 200 && !/js\/editor\.js/.test(r.text));
  r = await req('PUT', '/api/site', {}, { admin: true });
  check('PUT site rejected without session', r.status === 401);
  r = await req('GET', '/api/draft');
  check('GET draft rejected without session', r.status === 401);
  r = await req('PUT', '/api/draft', {}, { admin: true });
  check('PUT draft rejected without session', r.status === 401);
  const anonymousDraftDelete = await req('DELETE', '/api/draft', undefined, { admin: true });
  const anonymousPublish = await req('POST', '/api/publish', undefined, { admin: true });
  check('draft delete and publish reject requests without a session', anonymousDraftDelete.status === 401 && anonymousPublish.status === 401);
  r = await req('PATCH', '/api/submissions/0000000000000000', { read: true }, { admin: true });
  check('submission read patch rejected without session', r.status === 401);
  r = await req('GET', '/api/media');
  check('media library rejected without session', r.status === 401);
  r = await req('POST', '/api/media?name=test.png', Buffer.from('not an image'), { raw: true, admin: true });
  check('media upload rejected without session', r.status === 401);
  r = await req('GET', '/api/status');
  check('status needs session', r.status === 401);
  r = await req('POST', '/api/login', { password: 'wrong' }, { admin: true });
  check('wrong password 401', r.status === 401);
  r = await req('POST', '/api/login', { password: PW });
  check('login without X-Requested-With rejected', r.status === 403);
  r = await req('POST', '/api/login', { password: PW }, { admin: true });
  check('login ok + HttpOnly cookie', r.status === 200 && /om_admin=/.test(cookie) && /HttpOnly/.test(r.headers.get('set-cookie') || ''));
  check('cookie not Secure over plain http', !/Secure/.test(r.headers.get('set-cookie') || ''));
  r = await req('GET', '/api/me');
  check('me: authed', r.json && r.json.authed === true);
  r = await req('PUT', '/api/draft', {});
  check('PUT draft rejected without CSRF header', r.status === 403);
  const draftDeleteNoHeader = await req('DELETE', '/api/draft');
  const publishNoHeader = await req('POST', '/api/publish');
  check('draft delete and publish require the CSRF header', draftDeleteNoHeader.status === 403 && publishNoHeader.status === 403);
  r = await req('GET', '/?edit=1');
  check('authenticated edit query injects editor assets', r.status === 200 && /css\/editor\.css/.test(r.text) && /js\/editor\.js/.test(r.text));
  r = await req('GET', '/api/status');
  check('status reports notification and recovery config', r.status === 200 && r.json.notifications && r.json.notifications.email === true &&
    r.json.notifications.emailSource === 'env' && r.json.notifications.webhook === false && r.json.notifications.autoReply === true &&
    r.json.recovery && r.json.recovery.emailSet === false && r.json.recovery.resendConfigured === true, r.text);
  r = await req('GET', '/api/account/notifications');
  check('notification recipients start from the environment fallback', r.status === 200 && r.json.source === 'env' && r.json.emails[0] === 'leads@example.test', r.text);
  r = await req('PUT', '/api/account/notifications', { emails: Array.from({ length: 11 }, (_, i) => 'lead' + i + '@example.test') }, { admin: true });
  check('notification recipients are capped at ten', r.status === 400);
  r = await req('PUT', '/api/account/notifications', { emails: ['valid@example.test', 'not-an-email'] }, { admin: true });
  check('notification recipient validation rejects a bad address', r.status === 400);
  r = await req('PUT', '/api/account/notifications', { emails: ['Owner@Example.test', 'ops@example.test'] }, { admin: true });
  check('private notification recipients override the environment', r.status === 200 && r.json.source === 'settings' && r.json.emails.join(',') === 'owner@example.test,ops@example.test', r.text);
  const mailBeforeNotifyTest = sentMail.length;
  r = await req('POST', '/api/notify/test', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.20' } });
  check('test notification reports delivery to private recipients', r.status === 200 && r.json.delivered === true && r.json.source === 'settings' &&
    sentMail.length === mailBeforeNotifyTest + 1 && sentMail[mailBeforeNotifyTest].to.join(',') === 'owner@example.test,ops@example.test', r.text);
  let throttledTest;
  for (let i = 0; i < 4; i++) throttledTest = await req('POST', '/api/notify/test', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.21' } });
  check('test notification endpoint is throttled at three sends', throttledTest.status === 429);
  r = await req('GET', '/api/pages');
  check('pages list (14, no 404/admin)', r.status === 200 && Array.isArray(r.json) && r.json.length === 14 && r.json.some(p => p.key === 'index' && p.sections.length === 13), r.text.slice(0, 200));
  const idx = r.json.find(p => p.key === 'index');
  check('section labels extracted', idx && idx.sections[0].key === 'index.hero' && /Hero/.test(idx.sections[0].label) && idx.sections.every(s => s.label));

  /* ---- media library ---- */
  r = await req('GET', '/api/media');
  check('media library starts empty', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r.text);
  r = await req('POST', '/api/media?name=no-header.png', Buffer.from('not an image'), { raw: true });
  check('media writes require the CSRF header', r.status === 403);
  r = await req('POST', '/api/media?name=renamed-text.png', Buffer.from('<svg>not an image</svg>'), { raw: true, admin: true });
  check('media upload rejects renamed text and SVG by magic bytes', r.status === 400 && /PNG, JPEG or WebP/.test(r.json.error), r.text);
  const tinyPng = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(tinyPng, 0); tinyPng.writeUInt32BE(1, 16); tinyPng.writeUInt32BE(1, 20);
  r = await req('POST', '/api/media?name=Hero%20portrait.png', tinyPng, { raw: true, admin: true, type: 'image/png' });
  const mediaId = r.json && r.json.item && r.json.item.id;
  check('valid image upload creates opaque metadata and private index', r.status === 201 && /^[a-f0-9]{16}$/.test(mediaId || '') && r.json.item.width === 1 && r.json.item.height === 1 && fs.existsSync(path.join(TMP, 'data', 'media.json')), r.text);
  r = await req('GET', '/api/media');
  check('media library lists newest images', r.status === 200 && r.json.length === 1 && r.json[0].id === mediaId && r.json[0].name === 'Hero portrait.png', r.text);
  r = await req('PATCH', '/api/media/' + mediaId, { focal: { x: 2, y: 0.5 } }, { admin: true });
  check('media focal point rejects out-of-range coordinates', r.status === 400);
  r = await req('PATCH', '/api/media/' + mediaId, { alt: 'Founder speaking on stage', name: 'Founder portrait', focal: { x: 0.28, y: 0.61 } }, { admin: true });
  check('media metadata updates alt, name and focal point', r.status === 200 && r.json.item.alt === 'Founder speaking on stage' && r.json.item.name === 'Founder portrait' && r.json.item.focal.x === 0.28, r.text);
  const tinyJpeg = Buffer.from('ffd8ffc00011080001000103011100021100031100ffd9', 'hex');
  r = await req('POST', '/api/media/0000000000000000/variant?w=480', tinyJpeg, { raw: true, admin: true, type: 'image/jpeg' });
  check('variant upload requires an existing media id', r.status === 404);
  r = await req('POST', '/api/media/' + mediaId + '/variant?w=700', tinyJpeg, { raw: true, admin: true, type: 'image/jpeg' });
  check('variant upload accepts only the three owned widths', r.status === 400);
  r = await req('POST', '/api/media/' + mediaId + '/variant?w=960', tinyJpeg, { raw: true, admin: true, type: 'image/jpeg' });
  check('valid JPEG fallback variant is stored under its public width URL', r.status === 200 && r.json.item.variants.join(',') === '960', r.text);
  r = await req('POST', '/api/media/' + mediaId + '/variant?w=480', Buffer.alloc(2 * 1024 * 1024 + 1), { raw: true, admin: true, type: 'image/jpeg', headers: { 'X-Forwarded-For': '198.51.100.53' } });
  check('generated variants enforce the 2 MB cap', r.status === 413, r.status);
  r = await req('GET', '/media/' + mediaId + '-960.webp');
  check('public media variant uses stored type and immutable caching', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && /immutable/.test(r.headers.get('cache-control') || '') && r.text.length > 0, r.text);
  r = await req('GET', '/media/' + mediaId + '.png');
  check('public original is served only through its exact opaque id and extension', r.status === 200 && r.headers.get('content-type') === 'image/png');
  const traversalStatus = await rawHttpPath('/media/%2e%2e/server.js');
  check('public media route rejects path traversal', traversalStatus === 404, traversalStatus);
  r = await req('POST', '/api/media?name=Unused.png', tinyPng, { raw: true, admin: true, type: 'image/png' });
  const unusedMediaId = r.json && r.json.item && r.json.item.id;
  r = await req('DELETE', '/api/media/' + unusedMediaId, undefined, { admin: true });
  check('an unused image can be deleted from the library', r.status === 200 && r.json.ok && !fs.existsSync(path.join(TMP, 'data', 'media', unusedMediaId + '.png')), r.text);
  r = await req('POST', '/api/media?name=too-large.png', Buffer.alloc(8 * 1024 * 1024 + 1), { raw: true, admin: true, type: 'image/png', headers: { 'X-Forwarded-For': '198.51.100.50' } });
  check('original image upload enforces the 8 MB cap', r.status === 413, r.status);
  const quotaFile = path.join(TMP, 'data', 'media', 'deadbeefdeadbeef-1600.webp');
  const quotaFd = fs.openSync(quotaFile, 'w'); fs.ftruncateSync(quotaFd, 500 * 1024 * 1024); fs.closeSync(quotaFd);
  r = await req('POST', '/api/media?name=quota.png', tinyPng, { raw: true, admin: true, type: 'image/png', headers: { 'X-Forwarded-For': '198.51.100.51' } });
  check('media library enforces the 500 MB total quota', r.status === 409 && /500 MB/.test(r.json.error), r.text);
  fs.rmSync(quotaFile, { force: true });
  let uploadThrottle;
  for (let i = 0; i < 61; i++) uploadThrottle = await req('POST', '/api/media?name=bad.png', Buffer.from('bad'), { raw: true, admin: true, headers: { 'X-Forwarded-For': '198.51.100.52' } });
  check('media uploads are throttled at sixty per ten minutes', uploadThrottle.status === 429, uploadThrottle.status);

  /* ---- publish + validation ---- */
  const cfg = {
    settings: { siteUrl: 'https://example.test', email: 'hi@example.test', phone: '+994 12 000 00 00', address: 'Baku',
      schedulerUrl: 'javascript:alert(1)', privacyUrl: 'javascript:x', linkedin: 'https://linkedin.com/company/x', ogImage: 'https://example.test/og.png' },
    features: { customCursor: false, cookieBanner: false },
    design: { tokens: { '--signal': '#ff0000', 'bad key': 'x', '--custom-token': 'red;}body{display:none' }, fontDisplay: 'Sora',
      fontPreset: 'sora-dmsans', motion: 'calm', customCss: '.hero{color:red}' },
    structured: { orgLegalName: 'OmniMark LLC', orgLogoUrl: 'javascript:bad', articleAuthor: 'Priya Anand',
      articleDatePublished: '2026-09-01', articleDateModified: 'not-a-date', jobTitle: 'Draft role' },
    hiddenSections: ['index.s3'],
    addedElements: [{id:'ae-1234abcd',scope:'index',kind:'paragraph',anchor:'index:home.hero.lede',position:'after'}],
    elementLinks: {'index:home.hero.ctaPrimary':'contact.html#sec-contact-form','index:home.hero.ctaSecondary':'javascript:alert(1)','bad:key?':'https://example.test','index:bad':'data:text/html,x'},
    elementStyles: {'index:home.hero.ctaPrimary':'secondary','index:bad':'huge'},
    hiddenElements: ['index:home.hero.micro', '*:unknown.future-key', 'index:home.hero.micro'],
    sectionOrder: { index: ['index.s2', 'index.s1'], about: Array.from({ length: 70 }, (_, i) => 'about.s' + i) },
    sectionAccent: { 'index.s1': 3, low: 0, high: 6, text: 'x' },
    itemOrder: { 'index.cases': ['c2', 'BAD', 'c1', 'c2'], 'bad/list': ['c1'] },
    hiddenItems: ['index.cases:c3', 'bad item', 'index.cases:UPPER'],
    images: { 'index.hero': { id: mediaId, alt: 'Founder speaking on stage', focal: { x: 0.28, y: 0.61 } },
      'bad/key': { id: mediaId }, 'index.bad': { id: 'not-an-id' } },
    pages: { about: { title: 'About us <b>', description: 'Desc "quoted"', ogImage: 'https://example.test/about-og.png' },
      contact: { noindex: true }, article: { noindex: false, ogImage: 'javascript:bad' }, work: { ogImage: mediaId } },
    i18n: { en: { 'nav.work': 'Cases' }, az: { 'nav.work': 'Keyslər' } },
    engines: [{ id: 'x', num: '01', name: 'E1 <script>', promise: 'p', href: 'a.html', detail: 'b.html', groups: [{ title: 'G', items: ['one', 'two'] }] }],
    enginesAz: [{ name: 'E1az', promise: 'paz', groups: [{ title: 'Gaz', items: ['bir', 'iki'] }] }],
    industries: ['Retail'], industriesAz: ['Pərakəndə'],
    collections: JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS))
  };
  cfg.collections.articles[0].fields.body.en = '<script>alert(1)</script><p onclick="alert(2)">Safe article body</p>';
  const unpublishedCase = JSON.parse(JSON.stringify(cfg.collections.cases[0]));
  unpublishedCase.id = 'ca5e000000000002'; unpublishedCase.slug = 'private-draft-case'; unpublishedCase.published = false; unpublishedCase.order = 1;
  unpublishedCase.fields.title.en = 'Private draft case'; cfg.collections.cases.push(unpublishedCase);
  r = await req('PUT', '/api/site', cfg, { admin: true });
  check('PUT site ok', r.status === 200 && r.json && r.json.ok, r.text);
  const saved = r.json && r.json.site;
  check('additions retain validated anchors and styles; unsafe links are dropped',saved.addedElements[0].id==='ae-1234abcd'&&Object.keys(saved.elementLinks).length===1&&saved.elementLinks['index:home.hero.ctaPrimary']==='contact.html#sec-contact-form'&&Object.keys(saved.elementStyles).length===1);
  const rules=require(path.join(ROOT,'js','element-rules.js'));
  const placement={key:'index:home.hero.micro',anchor:'index:home.hero.lede',position:'before'};
  for(const placements of [{},Array(401).fill(placement),[{...placement,key:'bad'}],[{...placement,anchor:'index:<bad>'}],[{...placement,position:'free'}],[{...placement,anchor:placement.key}]]){
    const invalid=await req('PUT','/api/site',{...cfg,placements},{admin:true});check('invalid element placements are rejected',invalid.status===400&&invalid.json.field==='placements',invalid.text);
  }
  const placed=await req('PUT','/api/site',{...cfg,placements:[placement,{key:'index:home.hero.ctaSecondary',anchor:'index:home.hero.lede',position:'after'},{...placement,position:'after',ignored:true}]},{admin:true});
  check('placements keep the last entry per key in application order and strip unknown fields',placed.status===200&&placed.json.site.placements.length===2&&placed.json.site.placements[1].key===placement.key&&placed.json.site.placements[1].position==='after'&&!('ignored' in placed.json.site.placements[1]));
  check('shared Elements summary counts moved keys',rules.changes({},placed.json.site).moved===2);
  check('placement application order participates in the Elements summary',rules.changes(placed.json.site,{...placed.json.site,placements:placed.json.site.placements.slice().reverse()}).moved===2);
  check('shared link validator accepts supported destinations', ['https://example.test/a','http://example.test','mailto:hello@example.test','tel:+123456789','contact.html','#sec-index-hero','/work/growth-case','/insights/article','/careers/designer'].every(rules.link));
  check('shared link validator rejects unsafe, ambiguous and rewritten URLs', ['javascript:alert(1)','data:text/html,x','//evil.test','\\evil.test','https://name:secret@example.test',' contact.html','contact.html\n','ftp://example.test','../contact.html'].every(value=>!rules.link(value)));
  for(const changed of [{addedElements:Array(401).fill(cfg.addedElements[0])},{addedElements:[{...cfg.addedElements[0],id:'invalid'}]},{addedElements:[{...cfg.addedElements[0],kind:'field'}]},{addedElements:[{...cfg.addedElements[0],position:'free'}]},{addedElements:[{...cfg.addedElements[0],anchor:'contact:home.hero.lede'}]},{addedElements:[{...cfg.addedElements[0],kind:'copy'}]},{elementLinks:Object.fromEntries(Array.from({length:401},(_,i)=>['index:x'+i,'contact.html']))}]){
    const invalid=await req('PUT','/api/site',{...cfg,...changed},{admin:true});check('invalid additions and oversized overrides are rejected',invalid.status===400,invalid.text);
  }
  const targets=await req('GET','/api/link-targets');
  check('link targets expose pages, labelled section ids and published items',targets.status===200&&targets.json.pages.some(page=>page.key==='contact')&&targets.json.sections.index.every(section=>section.id&&section.label)&&targets.json.items.cases.every(item=>item.slug!=='private-draft-case')&&targets.json.items.cases.length>0,targets.text.slice(0,200));
  check('element keys deduplicate and preserve keys from unknown pages', saved.hiddenElements.join(',') === 'index:home.hero.micro,*:unknown.future-key');
  for (const hiddenElements of ['index:bad', ['bad'], ['INDEX:key'], ['index:<script>'], Array(401).fill('index:key')]){
    const invalid = await req('PUT','/api/site',{...cfg,hiddenElements},{admin:true});
    check('invalid hiddenElements rejected: '+(Array.isArray(hiddenElements)?hiddenElements.length+' entries':typeof hiddenElements),invalid.status===400&&invalid.json.field==='hiddenElements',invalid.text);
  }
  check('validation: bad token key dropped, CSS-breaking value kept as opaque string', saved && !('bad key' in saved.design.tokens) && saved.design.tokens['--signal'] === '#ff0000');
  for (const key of ['--ink','--paper','--signal','--violet']) {
    const invalid = await req('PUT','/api/site',{...cfg,design:{tokens:{[key]:'not-a-color'}}},{admin:true});
    check('invalid brand colour rejected with field: '+key,invalid.status===400&&invalid.json.field==='design.tokens.'+key,invalid.text);
  }
  const invalidDraftColor=await req('PUT','/api/draft',{...cfg,design:{tokens:{'--signal':'invalid'}}},{admin:true});
  check('draft API also rejects invalid brand colours',invalidDraftColor.status===400&&invalidDraftColor.json.field==='design.tokens.--signal',invalidDraftColor.text);
  const removalFixture={hiddenElements:['*:industries.1','*:engines.e1.groups.1.items.0','index:home.hero.micro']};
  rules.remapRemovedItems(removalFixture,'industries.',1,2,4);
  rules.remapRemovedItems(removalFixture,'engines.e1.groups.',0,null,3);
  check('shared catalogue remapping preserves hidden identities across reorder and group deletion',removalFixture.hiddenElements.join(',')==='*:industries.2,*:engines.e1.groups.0.items.0,index:home.hero.micro');
  rules.remapRemovedItems(removalFixture,'industries.',2,null,4);
  check('deleting hidden catalogue content drops its obsolete removal key',!removalFixture.hiddenElements.some(key=>key.includes('industries.')));
  removalFixture.hiddenElements.push('*:industries.999');rules.remapRemovedItems(removalFixture,'industries.',0,1,3);
  check('catalogue edits retain unknown valid future removal keys',removalFixture.hiddenElements.includes('*:industries.999'));
  check('validation: features merged with defaults', saved && saved.features.customCursor === false && saved.features.reveal === true);
  check('validation: font and motion presets map to runtime fields', saved && saved.design.fontPreset === 'sora-dmsans' && saved.design.fontDisplay === 'Sora' &&
    saved.design.fontBody === 'DM Sans' && saved.design.fontMono === 'Fira Code' && saved.design.motion === 'calm' && saved.features.marquee === false && saved.features.countUp === true);
  check('validation: settings merged', saved && saved.settings.email === 'hi@example.test' && saved.settings.siteName === 'OmniMark');
  check('validation: unsafe URL schemes dropped', saved && saved.settings.schedulerUrl === '' && saved.settings.privacyUrl === '' && saved.settings.linkedin === 'https://linkedin.com/company/x' && saved.settings.ogImage === 'https://example.test/og.png', JSON.stringify(saved && saved.settings));
  check('validation: structured URLs and dates cleaned', saved && saved.structured.orgLogoUrl === '' && saved.structured.articleDatePublished === '2026-09-01' && saved.structured.articleDateModified === '');
  check('validation: engines cleaned', saved && saved.engines.length === 1 && saved.engines[0].groups[0].items.length === 2 && saved.enginesAz[0].name === 'E1az');
  check('validation: editor layout fields cleaned', saved && saved.sectionOrder.index.length === 2 && saved.sectionOrder.about.length === 60 &&
    saved.sectionAccent['index.s1'] === 3 && !('low' in saved.sectionAccent) && !('high' in saved.sectionAccent) && !('text' in saved.sectionAccent) &&
    saved.itemOrder['index.cases'].join(',') === 'c2,c1' && !('bad/list' in saved.itemOrder) && saved.hiddenItems.join(',') === 'index.cases:c3', JSON.stringify(saved));
  check('validation: image slots keep only safe keys, ids and focal points', saved && saved.images['index.hero'].id === mediaId && saved.images['index.hero'].alt === 'Founder speaking on stage' &&
    saved.images['index.hero'].focal.x === 0.28 && !saved.images['bad/key'] && !saved.images['index.bad'], JSON.stringify(saved && saved.images));
  check('validation: page SEO fields are typed and URL-safe', saved && saved.pages.contact.noindex === true && saved.pages.article.noindex === false &&
    saved.pages.article.ogImage === '' && saved.pages.about.ogImage === 'https://example.test/about-og.png' && saved.pages.work.ogImage === mediaId, JSON.stringify(saved.pages));
  check('validation: collections are typed and rich HTML is sanitized', saved && saved.collections.cases.length === 2 &&
    saved.collections.articles[0].fields.body.en === '<p>Safe article body</p>' && saved.collections.jobs[0].applyUrl.startsWith('https://'), JSON.stringify(saved && saved.collections));
  const siteJs = readTmp('data/site.js');
  check('site.js regenerated + </script escaped', /hi@example\.test/.test(siteJs) && !/<\/script/.test(siteJs) && !/<\//.test(siteJs.replace(/<\\\//g, '')));
  check('sitemap uses new siteUrl, collection routes, and excludes noindex/draft pages', /https:\/\/example\.test\/about\.html/.test(readTmp('sitemap.xml')) &&
    /https:\/\/example\.test\/work\/saas-pipeline-rebuild/.test(readTmp('sitemap.xml')) && !/private-draft-case/.test(readTmp('sitemap.xml')) && !/contact\.html/.test(readTmp('sitemap.xml')));
  r = await req('GET', '/about.html');
  check('meta injection: title escaped', /<title>About us &lt;b&gt;<\/title>/.test(r.text), (r.text.match(/<title>[^<]*<\/title>/) || [])[0]);
  check('meta injection: description', /name="description" content="Desc &quot;quoted&quot;"/.test(r.text));
  check('meta injection: og:title', /property="og:title" content="About us &lt;b&gt;"/.test(r.text));
  check('meta injection: per-page og:image overrides the site default', /property="og:image" content="https:\/\/example\.test\/about-og\.png"/.test(r.text) && /twitter:card" content="summary_large_image"/.test(r.text));
  r = await req('GET', '/contact.html');
  check('noindex page emits robots metadata', /<meta name="robots" content="noindex,nofollow">/.test(r.text));
  r = await req('GET', '/work.html');
  check('media ids resolve to absolute 1600px social-image URLs', new RegExp('property="og:image" content="https://example\\.test/media/' + mediaId + '-1600\\.webp"').test(r.text), r.text.match(/<meta property="og:image"[^>]*>/));
  r = await req('DELETE', '/api/media/' + mediaId, undefined, { admin: true });
  check('media deletion is blocked while a live slot references the image', r.status === 409 && Array.isArray(r.json.references) && r.json.references.includes('live:index.hero'), r.text);
  const mediaIndexPath = path.join(TMP, 'data', 'media.json'), realMediaIndex = fs.readFileSync(mediaIndexPath, 'utf8');
  fs.writeFileSync(mediaIndexPath, JSON.stringify(Array.from({ length: 500 }, (_, index) => ({ id: index.toString(16).padStart(16, '0'), name: 'Item ' + index,
    alt: '', width: 1, height: 1, bytes: 24, type: 'image/png', ext: 'png', variants: [], variantTypes: {}, variantBytes: {}, focal: { x: 0.5, y: 0.5 }, uploadedAt: new Date().toISOString() }))));
  r = await req('POST', '/api/media?name=over-count.png', tinyPng, { raw: true, admin: true, type: 'image/png', headers: { 'X-Forwarded-For': '198.51.100.54' } });
  check('media library enforces the 500-item cap', r.status === 409 && /500 images/.test(r.json.error), r.text);
  fs.writeFileSync(mediaIndexPath, realMediaIndex);
  r = await req('GET', '/article.html');
  check('Article structured data emitted with publishing fields', /"@type":"Article"/.test(r.text) && /"name":"Priya Anand"/.test(r.text) && /"datePublished":"2026-09-01"/.test(r.text));
  r = await req('GET', '/work/saas-pipeline-rebuild');
  check('published collection item has a clean canonical route', r.status === 200 && /window\.OMNI_ITEM/.test(r.text) && /https:\/\/example\.test\/work\/saas-pipeline-rebuild/.test(r.text) && /3\.4× qualified pipeline/.test(r.text));
  r = await req('GET', '/case-study.html?item=saas-pipeline-rebuild');
  check('static collection fallback resolves by item query', r.status === 200 && /window\.OMNI_ITEM/.test(r.text) && /saas-pipeline-rebuild/.test(r.text));
  r = await req('GET', '/work/no-such-case');
  check('unknown collection slug returns the 404 page', r.status === 404 && /Page not found/.test(r.text));
  r = await req('GET', '/work/private-draft-case');
  check('unpublished collection item is not public', r.status === 404);
  r = await req('GET', '/work/private-draft-case?edit=1');
  check('unpublished collection item is visible to its authenticated editor', r.status === 200 && /js\/editor\.js/.test(r.text) && /Private draft case/.test(r.text));
  const duplicateCollections = JSON.parse(JSON.stringify(cfg));
  const duplicateCase = JSON.parse(JSON.stringify(duplicateCollections.collections.cases[0])); duplicateCase.id = 'ca5e000000000003'; duplicateCollections.collections.cases.push(duplicateCase);
  r = await req('PUT', '/api/site', duplicateCollections, { admin: true });
  check('collection slugs must be unique within a type', r.status === 400 && /unique/.test(r.json.error), r.text);
  r = await req('GET', '/role-detail.html');
  check('partial JobPosting data is not published', !/"@type":"JobPosting"/.test(r.text));
  const cfgWithJob = JSON.parse(JSON.stringify(cfg));
  Object.assign(cfgWithJob.collections.jobs[0], { validThrough: '2026-12-31', remote: true, applyUrl: 'https://example.test/apply' });
  r = await req('PUT', '/api/site', cfgWithJob, { admin: true });
  check('complete collection JobPosting fields save', r.status === 200 && r.json.site.collections.jobs[0].remote === true, r.text);
  r = await req('GET', '/careers/senior-media-buyer');
  check('complete JobPosting is server-rendered', /"@type":"JobPosting"/.test(r.text) && /"employmentType":"FULL_TIME"/.test(r.text) && /"jobLocationType":"TELECOMMUTE"/.test(r.text));
  r = await req('GET', '/api/site');
  check('GET site is public + reflects save', r.status === 200 && r.json.settings.email === 'hi@example.test');

  /* ---- editor draft lifecycle ---- */
  const draftCfg = JSON.parse(JSON.stringify(r.json));
  draftCfg.i18n.en['home.hero.h1'] = 'Draft headline';
  draftCfg.hiddenSections = ['index.s3', 'index.s4'];
  draftCfg.hiddenElements.push('*:nav.insights');
  draftCfg.placements=[{key:'index:home.hero.micro',anchor:'index:home.hero.lede',position:'before'}];
  draftCfg.addedElements.push({id:'ae-8765abcd',scope:'index',kind:'button',anchor:'index:home.hero.lede',position:'after'});
  draftCfg.elementLinks['index:added.ae-8765abcd']='contact.html';draftCfg.elementStyles['index:added.ae-8765abcd']='primary';
  r = await req('PUT', '/api/draft', draftCfg, { admin: true });
  check('PUT draft validates and saves atomically', r.status === 200 && r.json.ok && !!r.json.savedAt && fs.existsSync(path.join(TMP, 'data', 'draft.json')), r.text);
  r = await req('GET', '/api/draft');
  check('GET draft returns draft and live', r.status === 200 && r.json.draft.i18n.en['home.hero.h1'] === 'Draft headline' && r.json.live.i18n.en['home.hero.h1'] !== 'Draft headline');
  r = await req('POST', '/api/publish', undefined, { admin: true });
  check('publish promotes draft and returns categorized summary', r.status === 200 && r.json.site.i18n.en['home.hero.h1'] === 'Draft headline' &&
    r.json.summary.elements === 5 && r.json.summary.texts === 1 && r.json.summary.sections >= 1 && typeof r.json.summary.design === 'number', r.text);
  r = await req('GET', '/api/draft');
  check('publish removes the draft', r.status === 200 && r.json.draft === null && !fs.existsSync(path.join(TMP, 'data', 'draft.json')));
  r = await req('POST', '/api/publish', undefined, { admin: true });
  check('publish without a draft is rejected', r.status === 409);
  r = await req('PUT', '/api/draft', draftCfg, { admin: true });
  r = await req('DELETE', '/api/draft', undefined, { admin: true });
  check('DELETE draft discards it', r.status === 200 && !fs.existsSync(path.join(TMP, 'data', 'draft.json')));

  /* ---- published-version history + conflict guards ---- */
  r = await req('GET', '/api/history');
  check('history lists the version replaced by publish', r.status === 200 && Array.isArray(r.json) && r.json.length >= 1 && r.json[0].changes >= 1 && /^[0-9TZ-]+$/.test(r.json[0].id), r.text.slice(0, 200));
  const versionId = r.json[0].id;
  r = await req('GET', '/data/history/' + versionId + '.json');
  check('history files are not served', r.status === 403);
  r = await req('POST', '/api/history/' + versionId + '/restore', undefined, { admin: true });
  check('restore loads a version into the draft, not live', r.status === 200 && r.json.ok && r.json.draft.i18n.en['home.hero.h1'] !== 'Draft headline', r.text.slice(0, 200));
  r = await req('GET', '/api/draft');
  check('restored draft records its origin; live untouched', r.json.restoredFrom === versionId && r.json.live.i18n.en['home.hero.h1'] === 'Draft headline');
  const restoredRevision = r.json.revision;
  r = await req('POST', '/api/history/nope-1/restore', undefined, { admin: true });
  check('restore of unknown version is 404', r.status === 404);
  r = await req('PUT', '/api/site', draftCfg, { admin: true });
  check('advanced save is refused while a draft exists', r.status === 409 && r.json.code === 'draft-exists', r.text.slice(0, 200));
  r = await req('PUT', '/api/site', Object.assign({}, draftCfg, { force: true }), { admin: true });
  check('advanced save with force succeeds', r.status === 200 && r.json.ok);
  /* an editor that reloads after the live site moved must not be able to
     "refresh" the draft's base and hide the conflict */
  const liveNow = r.json.site.updatedAt;
  r = await req('PUT', '/api/draft', Object.assign({}, draftCfg, { baseUpdatedAt: liveNow, draftRevision: restoredRevision }), { admin: true });
  check('re-saving an existing draft keeps its original base', r.status === 200 && r.json.baseUpdatedAt && r.json.baseUpdatedAt !== liveNow, r.text.slice(0, 200));
  r = await req('POST', '/api/publish', undefined, { admin: true });
  check('publishing a draft older than live is refused as stale', r.status === 409 && r.json.code === 'stale', r.text.slice(0, 200));
  r = await req('POST', '/api/publish', { force: true }, { admin: true });
  check('stale draft publishes with force', r.status === 200 && r.json.ok && r.json.site.i18n.en['home.hero.h1'] === 'Draft headline', r.text.slice(0, 200));
  r = await req('GET', '/api/history');
  check('history grows with each publish and is capped at 10', r.json.length >= 2 && r.json.length <= 10);

  /* ---- audit regression: exact revisions and validation ---- */
  const liveBeforeAudit=(await req('GET','/api/site')).json;
  const clientA=JSON.parse(JSON.stringify(liveBeforeAudit)),clientB=JSON.parse(JSON.stringify(liveBeforeAudit));
  clientA.settings.siteName='First admin change';
  r=await req('PUT','/api/site',Object.assign({},clientA,{baseUpdatedAt:liveBeforeAudit.updatedAt}),{admin:true});
  check('first advanced client publishes with its reviewed live revision',r.status===200,r.text);
  clientB.settings.phone='Second admin change';
  r=await req('PUT','/api/site',Object.assign({},clientB,{baseUpdatedAt:liveBeforeAudit.updatedAt}),{admin:true});
  check('stale advanced client cannot erase newer changes',r.status===409&&r.json.code==='site-stale',r.text);
  r=await req('PUT','/api/site',clientB,{admin:true,noRevision:true});
  check('advanced publish requires a live revision',r.status===428,r.text);
  const invalidEmail=JSON.parse(JSON.stringify(liveBeforeAudit));invalidEmail.settings.email='not-an-email';
  r=await req('PUT','/api/site',invalidEmail,{admin:true});
  check('invalid contact email is rejected with its field name',r.status===400&&r.json.field==='settings.email',r.text);
  const currentAuditLive=(await req('GET','/api/site')).json;
  r=await req('PUT','/api/draft',Object.assign({},currentAuditLive,{draftRevision:0}),{admin:true});const reviewRevision=r.json.revision;
  const editedAgain=JSON.parse(JSON.stringify(currentAuditLive));editedAgain.i18n.en['home.hero.h1']='Someone edited after review';
  r=await req('PUT','/api/draft',Object.assign({},editedAgain,{draftRevision:reviewRevision}),{admin:true});const newerRevision=r.json.revision;
  r=await req('POST','/api/publish',{draftRevision:reviewRevision},{admin:true});
  check('publish cannot promote a draft changed after review',r.status===409&&r.json.code==='draft-stale',r.text);
  r=await req('POST','/api/publish',{}, {admin:true,noRevision:true});
  check('publish without reviewed revision is rejected',r.status===409&&r.json.code==='draft-stale',r.text);
  r=await req('POST','/api/history/'+versionId+'/restore',{draftRevision:reviewRevision},{admin:true});
  check('history restore cannot replace a newer shared draft',r.status===409&&r.json.code==='draft-stale',r.text);
  await req('DELETE','/api/draft',{draftRevision:newerRevision},{admin:true});
  r=await req('PUT','/api/draft',Object.assign({},editedAgain,{draftRevision:newerRevision}),{admin:true});
  check('stale draft cannot resurrect after another client discards it',r.status===409&&r.json.code==='draft-stale',r.text);
  await req('PUT','/api/site',liveBeforeAudit,{admin:true});

  /* ---- submissions ---- */
  cookie = '';
  const formMailStart = sentMail.length;
  r = await req('POST', '/api/submit', { form: 'contact', email: 'a@b.co' });
  check('submit contact enforces server-side required fields', r.status === 400 && r.json.fields.name && r.json.fields.company && r.json.fields.spend && r.json.fields.consent, r.text);
  const formSitePath = path.join(TMP,'data','site.json'), formSiteBefore = fs.readFileSync(formSitePath,'utf8');
  const formSite = JSON.parse(formSiteBefore);
  formSite.hiddenElements = ['contact:home.cta.labelCompany','index:home.cta.labelSpend','contact:home.cta.labelName','contact:home.cta.labelEmail','contact:contactPage.consent','*:home.cta.labelSpend'];
  fs.writeFileSync(formSitePath,JSON.stringify(formSite));
  r = await req('POST','/api/submit',{form:'contact'});
  check('protected enquiry fields stay required even with forged hidden keys',r.status===400&&r.json.fields.name&&r.json.fields.email&&r.json.fields.consent,r.text);
  check('only the matching live page field becomes optional',!r.json.fields.company&&r.json.fields.spend,r.text);
  r = await req('POST', '/api/submit', { form: 'contact', name: 'A', email: 'a@b.co', spend: '$10k', consent: true, message: 'hi' });
  check('submit contact accepts an omitted field hidden in live configuration', r.status === 200 && r.json.ok, r.text);
  fs.writeFileSync(formSitePath,formSiteBefore);
  r = await req('POST', '/api/submit', { form: 'newsletter', email: 'NEWS@EXAMPLE.TEST' });
  check('submit newsletter ok', r.status === 200 && r.json.ok, r.text);
  r = await req('POST', '/api/submit', { form: 'newsletter', email: 'not-an-email' });
  check('submit invalid email rejected', r.status === 400 && r.json.fields.email);
  r = await req('POST', '/api/submit', { form: 'newsletter' });
  check('submit empty rejected', r.status === 400 && r.json.fields.email);
  const mailUntil = Date.now() + 3000;
  while (sentMail.length < formMailStart + 4 && Date.now() < mailUntil) await new Promise(resolve => setTimeout(resolve, 25));
  const formMail = sentMail.slice(formMailStart);
  check('Resend receives internal and visitor messages', formMail.length === 4, JSON.stringify(formMail));
  check('submission notifications use private recipients over the environment', formMail.some(m => /^\[OmniMark\] New contact/.test(m.subject || '') && m.to.join(',') === 'owner@example.test,ops@example.test'));
  check('contact acknowledgement matches public promise', formMail.some(m => /^We received your enquiry/.test(m.subject || '') && /within one business day/.test(m.text || '') && Array.isArray(m.to) && m.to[0] === 'a@b.co'));
  check('newsletter welcome includes unsubscribe mailto', formMail.some(m => /^Welcome to/.test(m.subject || '') && /mailto:hi@example\.test\?subject=Unsubscribe%20from%20OmniMark/.test(m.text || '')));
  r = await req('POST', '/api/login', { password: PW }, { admin: true });
  r = await req('GET', '/api/submissions');
  const contactSub = r.json.find(s => s.form === 'contact');
  const newsletterSub = r.json.find(s => s.form === 'newsletter');
  check('submissions listed', r.status === 200 && r.json.length === 2 && contactSub && contactSub.fields.email === 'a@b.co');
  check('newsletter consent metadata stored', newsletterSub && newsletterSub.fields.email === 'news@example.test' && !!newsletterSub.consentAt && newsletterSub.consentSource === 'footer-newsletter-form', JSON.stringify(newsletterSub));
  check('notification acceptance is persisted separately from the enquiry', contactSub.delivery.email === 'accepted' && contactSub.delivery.attempts === 1);
  check('lead email requests carry a stable idempotency key', mailKeys.includes('lead-' + contactSub.id));
  r = await req('GET', '/api/submissions?limit=1&page=2');
  check('enquiries paginate with full totals', r.status === 200 && r.json.items.length === 1 && r.json.total === 2 && r.json.pages === 2 && r.json.page === 2);
  r = await req('GET', '/api/submissions?limit=1&page=99&form=contact&q=a%40b.co');
  check('form and search combine and out-of-range pages clamp', r.status === 200 && r.json.total === 1 && r.json.page === 1 && r.json.items[0].id === contactSub.id && r.json.allTotal === 2);
  r = await req('GET', '/api/submissions?form=newsletter&q=NEWS');
  check('export query returns only matching rows without pagination', r.status === 200 && r.json.length === 1 && r.json[0].id === newsletterSub.id);
  const id = contactSub.id;
  r = await req('PATCH', '/api/submissions/' + id, { read: true }, { admin: true });
  check('submission read flag can be patched', r.status === 200 && r.json.submission.read === true, r.text);
  r = await req('PATCH', '/api/submissions/' + id, { read: 'yes' }, { admin: true });
  check('submission read patch validates boolean', r.status === 400);
  r = await req('DELETE', '/api/submissions/' + id, undefined, { admin: true });
  check('submission deleted', r.status === 200 && r.json.removed === 1);

  /* ---- password lifecycle ---- */
  r = await req('POST', '/api/password', { current: 'nope', next: 'longenough' }, { admin: true });
  check('password change needs current', r.status === 401);
  r = await req('POST', '/api/password', { current: PW, next: 'short' }, { admin: true });
  check('password change min length', r.status === 400);
  r = await req('POST', '/api/password', { current: PW, next: 'newpass-5678' }, { admin: true });
  check('password changed + session re-issued', r.status === 200);
  r = await req('GET', '/api/me');
  check('still authed after change', r.json && r.json.authed === true);
  r = await req('POST', '/api/logout', undefined, { admin: true });
  r = await req('GET', '/api/me');
  check('logged out', r.json && r.json.authed === false);
  r = await req('POST', '/api/login', { password: PW }, { admin: true });
  check('old password no longer works', r.status === 401);

  /* ---- password recovery ---- */
  r = await req('POST', '/api/login', { password: 'newpass-5678' }, { admin: true });
  check('new password signs in for recovery setup', r.status === 200);
  r = await req('POST', '/api/users/invite', { name: 'Too Soon', email: 'too-soon@example.test', role: 'editor' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.59' } });
  check('legacy Admin must set an account email before inviting another user', r.status === 409 && r.json.code === 'owner-email-required');
  r = await req('POST', '/api/account/recovery-email', { current: 'wrong', email: 'owner@example.test' }, { admin: true });
  check('recovery email change requires the current password', r.status === 401);
  r = await req('POST', '/api/account/recovery-email', { current: 'newpass-5678', email: 'Recovery@Example.test' }, { admin: true });
  check('recovery email saves privately after password verification', r.status === 200 && r.json.email === 'recovery@example.test');
  r = await req('GET', '/api/account/recovery-email');
  check('authenticated recovery settings return the saved address', r.status === 200 && r.json.email === 'recovery@example.test' && r.json.resendConfigured === true);
  r = await req('GET', '/api/recover');
  check('public recovery becomes available after setup', r.status === 200 && r.json.available === true);
  const mailBeforeRecovery = sentMail.length;
  r = await req('POST', '/api/recover', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.30' } });
  const firstRecoveryMail = sentMail[mailBeforeRecovery];
  const firstToken = firstRecoveryMail && ((firstRecoveryMail.text || '').match(/reset=([a-f0-9]{64})/) || [])[1];
  check('configured recovery request sends exactly one private reset email', r.status === 200 && sentMail.length === mailBeforeRecovery + 1 &&
    firstRecoveryMail.to[0] === 'recovery@example.test' && /https:\/\/example\.test\/admin\.html\?reset=/.test(firstRecoveryMail.text || '') && !!firstToken, JSON.stringify(firstRecoveryMail));
  await new Promise(resolve => setTimeout(resolve, 2200));
  r = await req('POST', '/api/reset', { token: firstToken, next: 'recovered-pass-1' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.40' } });
  check('expired reset token gets the generic failure', r.status === 400 && /invalid or expired/.test(r.json.error));
  const mailBeforeValidRecovery = sentMail.length;
  r = await req('POST', '/api/recover', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.30' } });
  const validRecoveryMail = sentMail[mailBeforeValidRecovery];
  const validToken = validRecoveryMail && ((validRecoveryMail.text || '').match(/reset=([a-f0-9]{64})/) || [])[1];
  check('a fresh recovery request replaces the expired token', r.status === 200 && sentMail.length === mailBeforeValidRecovery + 1 && !!validToken);
  r = await req('POST', '/api/reset', { token: '0'.repeat(64), next: 'recovered-pass-1' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.40' } });
  check('wrong reset token gets the same generic failure', r.status === 400 && /invalid or expired/.test(r.json.error));
  const oldSession = cookie;
  r = await req('POST', '/api/reset', { token: validToken, next: 'recovered-pass-1' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.40' } });
  check('valid reset changes the password and consumes the token', r.status === 200 && r.json.ok);
  cookie = oldSession;
  r = await req('GET', '/api/me');
  check('password reset invalidates the old session', r.status === 200 && r.json.authed === false);
  r = await req('POST', '/api/reset', { token: validToken, next: 'another-pass-1' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.40' } });
  check('used reset token cannot be reused', r.status === 400 && /invalid or expired/.test(r.json.error));
  cookie = '';
  r = await req('POST', '/api/login', { password: 'recovered-pass-1' }, { admin: true });
  check('recovered password signs in', r.status === 200);
  let recoverThrottle;
  for (let i = 0; i < 4; i++) recoverThrottle = await req('POST', '/api/recover', {}, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.31' } });
  check('recovery requests are throttled at three per 15 minutes', recoverThrottle.status === 429);
  let resetThrottle;
  for (let i = 0; i < 6; i++) resetThrottle = await req('POST', '/api/reset', { token: 'f'.repeat(64), next: 'long-enough' }, { admin: true, headers: { 'X-Forwarded-For': '198.51.100.41' } });
  check('reset attempts are throttled at five per 15 minutes', resetThrottle.status === 429);

  /* ---- Phase E: users, roles, shared-draft conflicts and preview links ---- */
  const adminCookie = cookie;
  r = await req('GET', '/api/users', undefined, { cookie: adminCookie });
  const ownerId = r.json && r.json.currentUserId;
  check('Admin can list safe user records and limits', r.status === 200 && r.json.users.length === 1 && r.json.users[0].role === 'admin' && r.json.maxUsers === 10 && !('hash' in r.json.users[0]), r.text);
  r = await req('POST', '/api/users/invite', { name: '', email: 'bad', role: 'editor' }, { admin: true, cookie: adminCookie });
  check('invitation validates owned fields', r.status === 400 && r.json.field === 'email');
  const inviteMailStart = sentMail.length;
  r = await req('POST', '/api/users/invite', { name: 'Editorial Lead', email: 'editor@example.test', role: 'editor' }, { admin: true, cookie: adminCookie, headers: { 'X-Forwarded-For': '198.51.100.60' } });
  const editorId = r.json && r.json.user && r.json.user.id;
  const inviteMail = sentMail[inviteMailStart], inviteToken = inviteMail && ((inviteMail.text || '').match(/reset=([a-f0-9]{64})/) || [])[1];
  check('Admin invitation persists a pending Editor and sends one private link', r.status === 201 && /^[a-f0-9]{16}$/.test(editorId || '') && r.json.user.status === 'invited' && sentMail.length === inviteMailStart + 1 && inviteMail.to[0] === 'editor@example.test' && !!inviteToken, JSON.stringify(inviteMail));
  r = await req('POST', '/api/users/invite', { name: 'Duplicate', email: 'editor@example.test', role: 'editor' }, { admin: true, cookie: adminCookie, headers: { 'X-Forwarded-For': '198.51.100.61' } });
  check('user emails are unique', r.status === 409 && r.json.field === 'email');
  r = await req('POST', '/api/reset', { token: inviteToken, next: 'editor-pass-123' }, { admin: true, cookie: '', captureCookie: false, headers: { 'X-Forwarded-For': '198.51.100.42' } });
  check('accepting an invitation sets the password and activates the user', r.status === 200 && r.json.ok);
  r = await req('GET', '/api/auth', undefined, { cookie: '' });
  check('email becomes required when multiple users are active', r.status === 200 && r.json.emailRequired === true);
  r = await req('POST', '/api/login', { password: 'editor-pass-123' }, { admin: true, cookie: '', captureCookie: false });
  check('password-only login is rejected once accounts are ambiguous', r.status === 401);
  r = await req('POST', '/api/login', { email: 'editor@example.test', password: 'editor-pass-123' }, { admin: true, cookie: '', headers: { 'X-Forwarded-For': '198.51.100.81' } });
  const editorCookie = r.setCookie;
  check('Editor signs in by email and receives the role capability map', r.status === 200 && r.json.user.role === 'editor' && r.json.permissions.editContent && r.json.permissions.publish && !r.json.permissions.manageSettings && !r.json.permissions.manageUsers, r.text);
  r = await req('GET', '/admin-advanced.html', undefined, { cookie: editorCookie, captureCookie: false });
  check('advanced dashboard is server-blocked for Editors', r.status === 403 && /Admin access required/.test(r.text));
  r = await req('GET', '/api/users', undefined, { cookie: editorCookie, captureCookie: false });
  const editorStatus = await req('GET', '/api/status', undefined, { cookie: editorCookie, captureCookie: false });
  const editorNotifications = await req('GET', '/api/account/notifications', undefined, { cookie: editorCookie, captureCookie: false });
  check('Editor cannot read user, account, or server settings', r.status === 403 && editorStatus.status === 403 && editorNotifications.status === 403);
  r = await req('DELETE', '/api/media/' + mediaId, undefined, { admin: true, cookie: editorCookie, captureCookie: false });
  check('Editor cannot permanently delete media', r.status === 403 && r.json.code === 'forbidden');
  r = await req('GET', '/api/submissions', undefined, { cookie: editorCookie, captureCookie: false });
  check('Editor can work with the lead inbox', r.status === 200 && Array.isArray(r.json));

  r = await req('GET', '/api/site', undefined, { cookie: '' });
  const roleDraft = JSON.parse(JSON.stringify(r.json));
  roleDraft.i18n = roleDraft.i18n || { en: {}, az: {} }; roleDraft.i18n.en = roleDraft.i18n.en || {};
  roleDraft.i18n.en['home.hero.h1'] = 'Shared role draft';
  r = await req('PUT', '/api/draft', Object.assign({}, roleDraft, { draftRevision: 0 }), { admin: true, cookie: editorCookie, captureCookie: false });
  const editorRevision = r.json && r.json.revision;
  check('Editor can create a content draft and is recorded as its author', r.status === 200 && editorRevision === 1 && r.json.savedBy.id === editorId, r.text);
  const protectedDraft = JSON.parse(JSON.stringify(roleDraft)); protectedDraft.settings.siteName = 'Forbidden settings edit';
  r = await req('PUT', '/api/draft', Object.assign({}, protectedDraft, { draftRevision: editorRevision }), { admin: true, cookie: editorCookie, captureCookie: false });
  check('server rejects settings changes smuggled through an Editor draft', r.status === 403 && r.json.code === 'forbidden');
  const cssDraft = JSON.parse(JSON.stringify(roleDraft)); cssDraft.design.customCss = 'body{display:none}';
  r = await req('PUT', '/api/draft', Object.assign({}, cssDraft, { draftRevision: editorRevision }), { admin: true, cookie: editorCookie, captureCookie: false });
  check('Editor cannot smuggle advanced custom CSS through the draft API', r.status === 403 && r.json.code === 'forbidden');
  r = await req('GET', '/api/draft', undefined, { cookie: adminCookie, captureCookie: false });
  const adminDraft = JSON.parse(JSON.stringify(r.json.draft)), sharedRevision = r.json.revision;
  adminDraft.i18n.en['home.hero.h1'] = 'Latest shared draft';
  r = await req('PUT', '/api/draft', Object.assign({}, adminDraft, { draftRevision: sharedRevision }), { admin: true, cookie: adminCookie, captureCookie: false });
  check('a second user advances the shared draft revision', r.status === 200 && r.json.revision === sharedRevision + 1 && r.json.savedBy.id === ownerId, r.text);
  roleDraft.i18n.en['home.hero.h1'] = 'Stale overwrite attempt';
  r = await req('PUT', '/api/draft', Object.assign({}, roleDraft, { draftRevision: sharedRevision }), { admin: true, cookie: editorCookie, captureCookie: false });
  check('stale editor save is rejected without overwriting the shared draft', r.status === 409 && r.json.code === 'draft-stale' && r.json.savedBy.id === ownerId, r.text);
  r = await req('DELETE', '/api/draft', { draftRevision: sharedRevision }, { admin: true, cookie: editorCookie, captureCookie: false });
  check('a stale editor cannot discard a newer shared draft', r.status === 409 && r.json.code === 'draft-stale' && fs.existsSync(path.join(TMP, 'data', 'draft.json')));
  r = await req('GET', '/api/draft', undefined, { cookie: editorCookie, captureCookie: false });
  check('shared draft retains the latest accepted edit', r.json.draft.i18n.en['home.hero.h1'] === 'Latest shared draft');

  r = await req('POST', '/api/preview-link', { path: '/' }, { admin: true, cookie: editorCookie, captureCookie: false, headers: { 'X-Forwarded-For': '198.51.100.70' } });
  const previewUrl = r.json && r.json.url, previewToken = previewUrl && new URL(previewUrl).searchParams.get('preview');
  check('Editor can create one expiring draft-preview link', r.status === 201 && /^https:\/\/example\.test\//.test(previewUrl || '') && !!previewToken && r.json.createdBy.id === editorId, r.text);
  r = await req('GET', '/?preview=' + encodeURIComponent(previewToken), undefined, { cookie: '', captureCookie: false });
  check('anonymous preview renders draft data with a clear non-live ribbon', r.status === 200 && /Latest shared draft/.test(r.text) && /Preview — not live/.test(r.text) && /js\/preview\.js/.test(r.text) && !/js\/editor\.js/.test(r.text), r.text.slice(0, 200));
  check('preview responses are noindex, no-store, and suppress referrers', /noindex,nofollow/.test(r.text) && /no-store/.test(r.headers.get('cache-control') || '') && r.headers.get('referrer-policy') === 'no-referrer');
  r = await req('GET', '/?preview=invalid', undefined, { cookie: '', captureCookie: false });
  check('invalid preview tokens get an owned access-denied page', r.status === 403 && /Preview unavailable/.test(r.text));
  r = await req('DELETE', '/api/preview-link', undefined, { admin: true, cookie: editorCookie, captureCookie: false });
  const revokedPreview = await req('GET', '/?preview=' + encodeURIComponent(previewToken), undefined, { cookie: '', captureCookie: false });
  check('revoking a preview invalidates it immediately without deleting the draft', r.status === 200 && revokedPreview.status === 403 && fs.existsSync(path.join(TMP, 'data', 'draft.json')));
  r = await req('POST', '/api/preview-link', { path: '/' }, { admin: true, cookie: editorCookie, captureCookie: false, headers: { 'X-Forwarded-For': '198.51.100.71' } });
  const publishPreviewToken = new URL(r.json.url).searchParams.get('preview');
  r = await req('POST', '/api/publish', undefined, { admin: true, cookie: editorCookie, captureCookie: false });
  check('Editor can publish content but not protected settings', r.status === 200 && r.json.site.i18n.en['home.hero.h1'] === 'Latest shared draft');
  const publishedPreview = await req('GET', '/?preview=' + encodeURIComponent(publishPreviewToken), undefined, { cookie: '', captureCookie: false });
  check('publishing consumes the draft and revokes its preview link', publishedPreview.status === 403 && !fs.existsSync(path.join(TMP, 'data', 'draft.json')));
  r = await req('GET', '/api/history', undefined, { cookie: editorCookie, captureCookie: false });
  check('published history records the responsible user', r.status === 200 && r.json[0].by && r.json[0].by.id === editorId && r.json[0].by.role === 'editor', r.text.slice(0, 240));

  r = await req('PATCH', '/api/users/' + ownerId, { role: 'editor' }, { admin: true, cookie: adminCookie, captureCookie: false });
  check('an Admin cannot change their own role or remove the last-admin guard', r.status === 409);
  r = await req('PATCH', '/api/users/' + editorId, { role: 'admin' }, { admin: true, cookie: adminCookie, captureCookie: false });
  const oldEditorMe = await req('GET', '/api/me', undefined, { cookie: editorCookie, captureCookie: false });
  check('role changes invalidate that user’s existing sessions', r.status === 200 && r.json.user.role === 'admin' && oldEditorMe.json.authed === false);
  r = await req('PATCH', '/api/users/' + editorId, { role: 'editor' }, { admin: true, cookie: adminCookie, captureCookie: false });
  r = await req('POST', '/api/login', { email: 'editor@example.test', password: 'editor-pass-123' }, { admin: true, cookie: '', headers: { 'X-Forwarded-For': '198.51.100.80' } });
  const refreshedEditorCookie = r.setCookie;
  r = await req('PATCH', '/api/users/' + editorId, { status: 'disabled' }, { admin: true, cookie: adminCookie, captureCookie: false });
  const disabledMe = await req('GET', '/api/me', undefined, { cookie: refreshedEditorCookie, captureCookie: false });
  const disabledLogin = await req('POST', '/api/login', { email: 'editor@example.test', password: 'editor-pass-123' }, { admin: true, cookie: '', captureCookie: false, headers: { 'X-Forwarded-For': '198.51.100.82' } });
  check('disabling access signs the user out and blocks login without deleting records', r.status === 200 && r.json.user.status === 'disabled' && disabledMe.json.authed === false && disabledLogin.status === 401);
  r = await req('PATCH', '/api/users/' + editorId, { status: 'active' }, { admin: true, cookie: adminCookie, captureCookie: false });
  const restoredLogin = await req('POST', '/api/login', { email: 'editor@example.test', password: 'editor-pass-123' }, { admin: true, cookie: '', captureCookie: false, headers: { 'X-Forwarded-For': '198.51.100.83' } });
  check('Admin can restore a disabled account with its password intact', r.status === 200 && restoredLogin.status === 200 && restoredLogin.json.user.role === 'editor');
  r = await req('PATCH', '/api/users/' + editorId, { status: 'invited' }, { admin: true, cookie: adminCookie, captureCookie: false });
  check('active users cannot be put into a fake pending-invitation state', r.status === 400);

  /* Retention and notification retries use only the disposable fixture. */
  const subsPath = path.join(TMP, 'data', 'submissions.json');
  const retainedSubs = fs.readFileSync(subsPath, 'utf8');
  const synthetic = Array.from({ length: 10001 }, (_, i) => ({ id: 'retention-' + i, form: 'newsletter', at: new Date(1700000000000 + i).toISOString(), fields: { email: 'retained-' + i + '@example.test' }, read: true }));
  fs.writeFileSync(subsPath, JSON.stringify(synthetic));
  failNextLead = true;
  r = await req('POST', '/api/submit', { form: 'newsletter', email: 'retry@example.test' }, { headers: { 'X-Forwarded-For': '198.51.100.99' } });
  check('new enquiries never silently delete the oldest retained record', r.status === 200 && JSON.parse(fs.readFileSync(subsPath, 'utf8')).length === 10002 && JSON.parse(fs.readFileSync(subsPath, 'utf8'))[0].id === 'retention-0');
  const retryRow = () => JSON.parse(fs.readFileSync(subsPath, 'utf8')).find(item => item.fields.email === 'retry@example.test');
  /* this poll follows a 10,002-record write, so a tight deadline made the check
     flake on a busy machine and cascade into the two retry checks below */
  let retryDeadline = Date.now() + 20000;
  while (retryRow().delivery.email !== 'retrying' && Date.now() < retryDeadline) await new Promise(resolve => setTimeout(resolve, 25));
  check('temporary email failures leave a durable retry status', retryRow().delivery.email === 'retrying' && retryRow().delivery.attempts === 1);
  // The retention boundary has been checked; poll the retry using a small fixture.
  fs.writeFileSync(subsPath, JSON.stringify([retryRow()]));
  retryDeadline = Date.now() + 45000;
  while (retryRow().delivery.email !== 'accepted' && Date.now() < retryDeadline) await new Promise(resolve => setTimeout(resolve, 100));
  const deliveredRetry = retryRow();
  check('failed lead email retries once and records acceptance', deliveredRetry.delivery.email === 'accepted' && deliveredRetry.delivery.attempts === 2, JSON.stringify(deliveredRetry.delivery));
  check('retry reuses the original notification idempotency key', mailKeys.filter(key => key === 'lead-' + deliveredRetry.id).length === 2);
  fs.writeFileSync(subsPath, retainedSubs);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
}
main().catch(e => { console.error(e); fail++; }).then(() => {
  child.kill();
  mailServer.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
});
