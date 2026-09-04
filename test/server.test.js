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
  r = await req('GET', '/server.js');
  check('server.js not served', r.status === 404);
  r = await req('GET', '/../package.json');
  check('path traversal blocked', r.status !== 200 || !/omnimark-site/.test(r.text));
  r = await req('GET', '/data/site.js');
  check('site.js served', r.status === 200 && /window\.OMNI_SITE/.test(r.text));
  r = await req('GET', '/sitemap.xml');
  check('sitemap served', r.status === 200 && /<urlset/.test(r.text) && /about\.html/.test(r.text) && !/admin\.html/.test(r.text));
  r = await req('GET', '/robots.txt');
  check('robots served', r.status === 200 && /Disallow: \/admin\.html/.test(r.text));
  check('robots keeps data/site.js crawlable', !/Disallow: \/data/.test(r.text));
  check('cookie banner comes from partials', !/id="cookieBanner"/.test(readTmp('index.html')) && /id="cookieBanner"/.test(readTmp('js/partials.js')));
  check('contact scheduler is config-driven', /data-scheduler/.test(readTmp('contact.html')) && !/scheduler-ph/.test(readTmp('contact.html')));

  /* ---- auth ---- */
  r = await req('GET', '/api/me');
  check('me: not authed', r.json && r.json.authed === false);
  r = await req('PUT', '/api/site', {}, { admin: true });
  check('PUT site rejected without session', r.status === 401);
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
  r = await req('GET', '/api/status');
  check('status reports notification config', r.status === 200 && r.json.notifications && r.json.notifications.email === true && r.json.notifications.webhook === false && r.json.notifications.autoReply === true, r.text);
  r = await req('GET', '/api/pages');
  check('pages list (14, no 404/admin)', r.status === 200 && Array.isArray(r.json) && r.json.length === 14 && r.json.some(p => p.key === 'index' && p.sections.length === 13), r.text.slice(0, 200));
  const idx = r.json.find(p => p.key === 'index');
  check('section labels extracted', idx && idx.sections[0].key === 'index.hero' && /Hero/.test(idx.sections[0].label) && idx.sections.every(s => s.label));

  /* ---- publish + validation ---- */
  const cfg = {
    settings: { siteUrl: 'https://example.test', email: 'hi@example.test', phone: '+994 12 000 00 00', address: 'Baku',
      schedulerUrl: 'javascript:alert(1)', privacyUrl: 'javascript:x', linkedin: 'https://linkedin.com/company/x', ogImage: 'https://example.test/og.png' },
    features: { customCursor: false, cookieBanner: false },
    design: { tokens: { '--signal': '#ff0000', 'bad key': 'x', '--ink': 'red;}body{display:none' }, fontDisplay: 'Sora', customCss: '.hero{color:red}' },
    hiddenSections: ['index.s3'],
    pages: { about: { title: 'About us <b>', description: 'Desc "quoted"' } },
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
  check('validation: settings merged', saved && saved.settings.email === 'hi@example.test' && saved.settings.siteName === 'OmniMark');
  check('validation: unsafe URL schemes dropped', saved && saved.settings.schedulerUrl === '' && saved.settings.privacyUrl === '' && saved.settings.linkedin === 'https://linkedin.com/company/x' && saved.settings.ogImage === 'https://example.test/og.png', JSON.stringify(saved && saved.settings));
  check('validation: engines cleaned', saved && saved.engines.length === 1 && saved.engines[0].groups[0].items.length === 2 && saved.enginesAz[0].name === 'E1az');
  const siteJs = readTmp('data/site.js');
  check('site.js regenerated + </script escaped', /hi@example\.test/.test(siteJs) && !/<\/script/.test(siteJs) && !/<\//.test(siteJs.replace(/<\\\//g, '')));
  check('sitemap uses new siteUrl', /https:\/\/example\.test\/about\.html/.test(readTmp('sitemap.xml')));
  r = await req('GET', '/about.html');
  check('meta injection: title escaped', /<title>About us &lt;b&gt;<\/title>/.test(r.text), (r.text.match(/<title>[^<]*<\/title>/) || [])[0]);
  check('meta injection: description', /name="description" content="Desc &quot;quoted&quot;"/.test(r.text));
  check('meta injection: og:title', /property="og:title" content="About us &lt;b&gt;"/.test(r.text));
  check('meta injection: og:image after save', /property="og:image" content="https:\/\/example\.test\/og\.png"/.test(r.text) && /twitter:card" content="summary_large_image"/.test(r.text));
  r = await req('GET', '/api/site');
  check('GET site is public + reflects save', r.status === 200 && r.json.settings.email === 'hi@example.test');

  /* ---- submissions ---- */
  cookie = '';
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
  while (sentMail.length < 4 && Date.now() < mailUntil) await new Promise(resolve => setTimeout(resolve, 25));
  check('Resend receives internal and visitor messages', sentMail.length === 4, JSON.stringify(sentMail));
  check('contact acknowledgement matches public promise', sentMail.some(m => /^We received your enquiry/.test(m.subject || '') && /within one business day/.test(m.text || '') && Array.isArray(m.to) && m.to[0] === 'a@b.co'));
  check('newsletter welcome includes unsubscribe mailto', sentMail.some(m => /^Welcome to/.test(m.subject || '') && /mailto:hi@example\.test\?subject=Unsubscribe%20from%20OmniMark/.test(m.text || '')));
  r = await req('POST', '/api/login', { password: PW }, { admin: true });
  r = await req('GET', '/api/submissions');
  const contactSub = r.json.find(s => s.form === 'contact');
  const newsletterSub = r.json.find(s => s.form === 'newsletter');
  check('submissions listed', r.status === 200 && r.json.length === 2 && contactSub && contactSub.fields.email === 'a@b.co');
  check('newsletter consent metadata stored', newsletterSub && newsletterSub.fields.email === 'news@example.test' && !!newsletterSub.consentAt && newsletterSub.consentSource === 'footer-newsletter-form', JSON.stringify(newsletterSub));
  const id = contactSub.id;
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

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
}
main().catch(e => { console.error(e); fail++; }).then(() => {
  child.kill();
  mailServer.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
});
