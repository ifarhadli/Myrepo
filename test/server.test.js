#!/usr/bin/env node
/* End-to-end test for server.js + the admin API. Zero dependencies.
   Copies the site into a temp dir, boots the server there on a scratch
   port with a known password, and exercises static serving, auth, publish,
   validation, meta injection and submissions. `npm test` runs it.
   Nothing in the real data/ directory is touched. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), http = require('http'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 3111 + Math.floor(Math.random() * 500);
const BASE = 'http://127.0.0.1:' + PORT;
const MAIL_PORT = PORT + 700;
const PW = 'test-pass-1234';

const sentMail = [];
const mailServer = http.createServer((req, res) => {
  let raw = '';
  req.on('data', d => { raw += d; });
  req.on('end', () => {
    try { sentMail.push(JSON.parse(raw)); } catch (e) {}
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
fs.rmSync(path.join(TMP, 'data', 'admin.json'), { force: true });
fs.rmSync(path.join(TMP, 'data', 'submissions.json'), { force: true });

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
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (cookie) headers.Cookie = cookie;
  if (opts.admin) headers['X-Requested-With'] = 'OmniAdmin';
  const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, text, json, headers: r.headers };
}
const readTmp = f => fs.readFileSync(path.join(TMP, f), 'utf8');

async function main(){
  await mailReady;
  const t0 = Date.now();
  while (!/Admin dashboard/.test(out) && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 100));
  check('server booted', /Admin dashboard/.test(out), out);

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

  /* ---- publish + validation ---- */
  const cfg = {
    settings: { siteUrl: 'https://example.test', email: 'hi@example.test', phone: '+994 12 000 00 00', address: 'Baku',
      schedulerUrl: 'javascript:alert(1)', privacyUrl: 'javascript:x', linkedin: 'https://linkedin.com/company/x', ogImage: 'https://example.test/og.png' },
    features: { customCursor: false, cookieBanner: false },
    design: { tokens: { '--signal': '#ff0000', 'bad key': 'x', '--ink': 'red;}body{display:none' }, fontDisplay: 'Sora',
      fontPreset: 'sora-dmsans', motion: 'calm', customCss: '.hero{color:red}' },
    structured: { orgLegalName: 'OmniMark LLC', orgLogoUrl: 'javascript:bad', articleAuthor: 'Priya Anand',
      articleDatePublished: '2026-09-01', articleDateModified: 'not-a-date', jobTitle: 'Draft role' },
    hiddenSections: ['index.s3'],
    sectionOrder: { index: ['index.s2', 'index.s1'], about: Array.from({ length: 70 }, (_, i) => 'about.s' + i) },
    sectionAccent: { 'index.s1': 3, low: 0, high: 6, text: 'x' },
    itemOrder: { 'index.cases': ['c2', 'BAD', 'c1', 'c2'], 'bad/list': ['c1'] },
    hiddenItems: ['index.cases:c3', 'bad item', 'index.cases:UPPER'],
    pages: { about: { title: 'About us <b>', description: 'Desc "quoted"', ogImage: 'https://example.test/about-og.png' },
      contact: { noindex: true }, article: { noindex: false, ogImage: 'javascript:bad' } },
    i18n: { en: { 'nav.work': 'Cases' }, az: { 'nav.work': 'Keyslər' } },
    engines: [{ id: 'x', num: '01', name: 'E1 <script>', promise: 'p', href: 'a.html', detail: 'b.html', groups: [{ title: 'G', items: ['one', 'two'] }] }],
    enginesAz: [{ name: 'E1az', promise: 'paz', groups: [{ title: 'Gaz', items: ['bir', 'iki'] }] }],
    industries: ['Retail'], industriesAz: ['Pərakəndə']
  };
  r = await req('PUT', '/api/site', cfg, { admin: true });
  check('PUT site ok', r.status === 200 && r.json && r.json.ok, r.text);
  const saved = r.json && r.json.site;
  check('validation: bad token key dropped, CSS-breaking value kept as opaque string', saved && !('bad key' in saved.design.tokens) && saved.design.tokens['--signal'] === '#ff0000');
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
  check('validation: page SEO fields are typed and URL-safe', saved && saved.pages.contact.noindex === true && saved.pages.article.noindex === false &&
    saved.pages.article.ogImage === '' && saved.pages.about.ogImage === 'https://example.test/about-og.png', JSON.stringify(saved.pages));
  const siteJs = readTmp('data/site.js');
  check('site.js regenerated + </script escaped', /hi@example\.test/.test(siteJs) && !/<\/script/.test(siteJs) && !/<\//.test(siteJs.replace(/<\\\//g, '')));
  check('sitemap uses new siteUrl and excludes noindex pages', /https:\/\/example\.test\/about\.html/.test(readTmp('sitemap.xml')) && !/contact\.html/.test(readTmp('sitemap.xml')));
  r = await req('GET', '/about.html');
  check('meta injection: title escaped', /<title>About us &lt;b&gt;<\/title>/.test(r.text), (r.text.match(/<title>[^<]*<\/title>/) || [])[0]);
  check('meta injection: description', /name="description" content="Desc &quot;quoted&quot;"/.test(r.text));
  check('meta injection: og:title', /property="og:title" content="About us &lt;b&gt;"/.test(r.text));
  check('meta injection: per-page og:image overrides the site default', /property="og:image" content="https:\/\/example\.test\/about-og\.png"/.test(r.text) && /twitter:card" content="summary_large_image"/.test(r.text));
  r = await req('GET', '/contact.html');
  check('noindex page emits robots metadata', /<meta name="robots" content="noindex,nofollow">/.test(r.text));
  r = await req('GET', '/article.html');
  check('Article structured data emitted with publishing fields', /"@type":"Article"/.test(r.text) && /"name":"Priya Anand"/.test(r.text) && /"datePublished":"2026-09-01"/.test(r.text));
  r = await req('GET', '/role-detail.html');
  check('partial JobPosting data is not published', !/"@type":"JobPosting"/.test(r.text));
  const cfgWithJob = JSON.parse(JSON.stringify(cfg));
  Object.assign(cfgWithJob.structured, { jobTitle: 'Senior Media Buyer, Offline & Digital',
    jobDescription: 'Plan and buy accountable media across offline and digital channels.', jobDatePosted: '2026-09-01',
    jobValidThrough: '2026-12-31', jobEmploymentType: 'FULL_TIME', jobLocation: 'Austin, TX, US',
    jobRemote: true, jobApplyUrl: 'https://example.test/apply' });
  r = await req('PUT', '/api/site', cfgWithJob, { admin: true });
  check('complete JobPosting settings save', r.status === 200 && r.json.site.structured.jobRemote === true, r.text);
  r = await req('GET', '/role-detail.html');
  check('complete JobPosting is server-rendered', /"@type":"JobPosting"/.test(r.text) && /"employmentType":"FULL_TIME"/.test(r.text) && /"jobLocationType":"TELECOMMUTE"/.test(r.text));
  r = await req('GET', '/api/site');
  check('GET site is public + reflects save', r.status === 200 && r.json.settings.email === 'hi@example.test');

  /* ---- editor draft lifecycle ---- */
  const draftCfg = JSON.parse(JSON.stringify(r.json));
  draftCfg.i18n.en['home.hero.h1'] = 'Draft headline';
  draftCfg.hiddenSections = ['index.s3', 'index.s4'];
  r = await req('PUT', '/api/draft', draftCfg, { admin: true });
  check('PUT draft validates and saves atomically', r.status === 200 && r.json.ok && !!r.json.savedAt && fs.existsSync(path.join(TMP, 'data', 'draft.json')), r.text);
  r = await req('GET', '/api/draft');
  check('GET draft returns draft and live', r.status === 200 && r.json.draft.i18n.en['home.hero.h1'] === 'Draft headline' && r.json.live.i18n.en['home.hero.h1'] !== 'Draft headline');
  r = await req('POST', '/api/publish', undefined, { admin: true });
  check('publish promotes draft and returns categorized summary', r.status === 200 && r.json.site.i18n.en['home.hero.h1'] === 'Draft headline' &&
    r.json.summary.texts === 1 && r.json.summary.sections >= 1 && typeof r.json.summary.design === 'number', r.text);
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
  r = await req('POST', '/api/history/nope-1/restore', undefined, { admin: true });
  check('restore of unknown version is 404', r.status === 404);
  r = await req('PUT', '/api/site', draftCfg, { admin: true });
  check('advanced save is refused while a draft exists', r.status === 409 && r.json.code === 'draft-exists', r.text.slice(0, 200));
  r = await req('PUT', '/api/site', Object.assign({}, draftCfg, { force: true }), { admin: true });
  check('advanced save with force succeeds', r.status === 200 && r.json.ok);
  /* an editor that reloads after the live site moved must not be able to
     "refresh" the draft's base and hide the conflict */
  const liveNow = r.json.site.updatedAt;
  r = await req('PUT', '/api/draft', Object.assign({}, draftCfg, { baseUpdatedAt: liveNow }), { admin: true });
  check('re-saving an existing draft keeps its original base', r.status === 200 && r.json.baseUpdatedAt && r.json.baseUpdatedAt !== liveNow, r.text.slice(0, 200));
  r = await req('POST', '/api/publish', undefined, { admin: true });
  check('publishing a draft older than live is refused as stale', r.status === 409 && r.json.code === 'stale', r.text.slice(0, 200));
  r = await req('POST', '/api/publish', { force: true }, { admin: true });
  check('stale draft publishes with force', r.status === 200 && r.json.ok && r.json.site.i18n.en['home.hero.h1'] === 'Draft headline', r.text.slice(0, 200));
  r = await req('GET', '/api/history');
  check('history grows with each publish and is capped at 10', r.json.length >= 2 && r.json.length <= 10);

  /* ---- submissions ---- */
  cookie = '';
  const formMailStart = sentMail.length;
  r = await req('POST', '/api/submit', { form: 'contact', email: 'a@b.co' });
  check('submit contact enforces server-side required fields', r.status === 400 && r.json.fields.name && r.json.fields.company && r.json.fields.spend && r.json.fields.consent, r.text);
  r = await req('POST', '/api/submit', { form: 'contact', name: 'A', email: 'a@b.co', company: 'C', spend: '$10k', consent: true, message: 'hi' });
  check('submit contact ok', r.status === 200 && r.json.ok, r.text);
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

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
}
main().catch(e => { console.error(e); fail++; }).then(() => {
  child.kill();
  mailServer.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
});
