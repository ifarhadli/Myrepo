#!/usr/bin/env node
/* OmniMark site server + admin API. Zero dependencies — Node 18+.
   - Serves the static site (clean URLs, 404 page, security headers) and
     injects admin-set <title> / description / og tags into pages on the fly.
   - /admin is the editor sign-in; /admin-advanced.html is the developer dashboard.
   - Persists to data/site.json (+ regenerates data/site.js, sitemap.xml
     and robots.txt so a plain static host still gets the saved state),
     data/admin.json (password/recovery + private notification settings) and
     data/submissions.json (contact / teardown / newsletter forms).

   Run:  node server.js            (PORT=3000 by default)
   Env:  PORT, HOST, ADMIN_PASSWORD (only read on first run, when
         data/admin.json does not exist yet). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DEFAULT_CONTENT = require('./js/data.js');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const SITE_JSON = path.join(DATA, 'site.json');
const SITE_JS = path.join(DATA, 'site.js');
const ADMIN_JSON = path.join(DATA, 'admin.json');
const SUBS_JSON = path.join(DATA, 'submissions.json');
const DRAFT_JSON = path.join(DATA, 'draft.json');
const MEDIA_JSON = path.join(DATA, 'media.json');
const MEDIA_DIR = path.join(DATA, 'media');
/* the last few published versions — restorable from the editor's History panel */
const HISTORY_DIR = path.join(DATA, 'history');
const HISTORY_KEEP = 10;
const PORT = parseInt(process.env.PORT, 10) || 3000;
/* local dev binds to loopback; a platform that injects PORT (Railway, Render,
   Fly…) needs 0.0.0.0 or its proxy can't reach the process */
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const COOKIE = 'om_admin';
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12h
const RECOVERY_TTL = process.env.NODE_ENV === 'test' && Number(process.env.RECOVERY_TTL_MS) > 0 ? Number(process.env.RECOVERY_TTL_MS) : 30 * 60 * 1000;
const MAX_BODY = 2 * 1024 * 1024;        // 2 MB — site.json with full copy overrides
const MAX_MEDIA_ORIGINAL = 8 * 1024 * 1024;
const MAX_MEDIA_VARIANT = 2 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 500;
const MAX_MEDIA_BYTES = 500 * 1024 * 1024;
const MEDIA_WIDTHS = [480, 960, 1600];
const PRIVATE_FILES = new Set(['admin.json', 'submissions.json', 'draft.json', 'media.json']);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf'
};

/* ---------- storage ---------- */
function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeTextAtomic(file, text){
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function writeBufferAtomic(file, buffer){
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, file);
}
function writeJsonAtomic(file, obj){ writeTextAtomic(file, JSON.stringify(obj, null, 2) + '\n'); }
const DEFAULT_SITE = {
  version: 1, updatedAt: null,
  settings: {
    siteName: 'OmniMark', siteUrl: 'https://www.omnimark.com', defaultLang: 'en',
    email: 'hello@omnimark.com', phone: '+1 (800) 555-1234', phoneHref: '+18005551234',
    address: '400 Commerce St, Austin, TX 78701', addressLine1: '400 Commerce St', addressLine2: 'Austin, TX 78701',
    geoEmail: 'austin@omnimark.com', linkedin: 'https://www.linkedin.com', privacyUrl: '', termsUrl: '',
    schedulerUrl: '', ogImage: '', megaMenuLinkLimit: 4
  },
  features: { langSwitch: true, newsletter: true, cookieBanner: true, careersButton: true, showVerifiedProof: false, customCursor: true,
    magneticButtons: true, kineticHeadlines: true, marquee: true, countUp: true, reveal: true },
  design: { tokens: {}, fontDisplay: 'Bricolage Grotesque', fontBody: 'Inter', fontMono: 'JetBrains Mono', customCss: '' },
  analytics: { gaId: '', consentScript: '' },
  structured: { orgLegalName: '', orgLogoUrl: '', articleAuthor: '', articleDatePublished: '', articleDateModified: '',
    jobTitle: '', jobDescription: '', jobDatePosted: '', jobValidThrough: '', jobEmploymentType: '', jobLocation: '', jobRemote: false, jobApplyUrl: '' },
  hiddenSections: [], sectionOrder: {}, sectionAccent: {}, itemOrder: {}, hiddenItems: [], images: {},
  pages: {}, i18n: { en: {}, az: {} },
  engines: null, enginesAz: null, industries: null, industriesAz: null,
  collections: null
};
function loadSite(){ return Object.assign({}, DEFAULT_SITE, readJson(SITE_JSON, {})); }

function cleanMediaName(value){
  return String(value || 'Untitled image').replace(/[\\/\0-\x1f\x7f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Untitled image';
}
function cleanFocal(value){
  if (!isPlain(value)) return { x: 0.5, y: 0.5 };
  const x = Number(value.x), y = Number(value.y);
  return {
    x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5,
    y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5
  };
}
function loadMedia(){
  const raw = readJson(MEDIA_JSON, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => isPlain(item) && /^[a-f0-9]{16}$/.test(item.id || '') && ['image/png', 'image/jpeg', 'image/webp'].includes(item.type))
    .map(item => ({
      id: item.id,
      name: cleanMediaName(item.name),
      alt: typeof item.alt === 'string' ? item.alt.slice(0, 500) : '',
      width: Number.isInteger(item.width) ? item.width : 0,
      height: Number.isInteger(item.height) ? item.height : 0,
      bytes: Number.isInteger(item.bytes) ? item.bytes : 0,
      type: item.type,
      ext: ['png', 'jpg', 'webp'].includes(item.ext) ? item.ext : (item.type === 'image/png' ? 'png' : item.type === 'image/webp' ? 'webp' : 'jpg'),
      variants: Array.isArray(item.variants) ? item.variants.filter(w => MEDIA_WIDTHS.includes(w)).sort((a, b) => a - b) : [],
      variantTypes: isPlain(item.variantTypes) ? item.variantTypes : {},
      variantBytes: isPlain(item.variantBytes) ? item.variantBytes : {},
      focal: cleanFocal(item.focal),
      uploadedAt: typeof item.uploadedAt === 'string' ? item.uploadedAt : null
    }));
}
function saveMedia(items){ writeJsonAtomic(MEDIA_JSON, items); }
function mediaDiskBytes(){
  let total = 0;
  try {
    for (const name of fs.readdirSync(MEDIA_DIR)){
      if (!/^[a-f0-9]{16}(?:-(?:480|960|1600)\.webp|\.(?:png|jpg|webp))$/.test(name)) continue;
      try { const stat = fs.statSync(path.join(MEDIA_DIR, name)); if (stat.isFile()) total += stat.size; } catch (e) {}
    }
  } catch (e) {}
  return total;
}
function imageInfo(buffer){
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))){
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 30000 && height <= 30000 ? { type: 'image/png', ext: 'png', width, height } : null;
  }
  if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff){
    let offset = 2;
    while (offset + 9 < buffer.length){
      if (buffer[offset] !== 0xff){ offset++; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)){
        const height = buffer.readUInt16BE(offset + 5), width = buffer.readUInt16BE(offset + 7);
        return width > 0 && height > 0 && width <= 30000 && height <= 30000 ? { type: 'image/jpeg', ext: 'jpg', width, height } : null;
      }
      if (marker === 0xd8 || marker === 0xd9){ offset += 2; continue; }
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2) break;
      offset += 2 + size;
    }
    return null;
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'){
    const chunk = buffer.toString('ascii', 12, 16);
    let width = 0, height = 0;
    if (chunk === 'VP8X' && buffer.length >= 30){
      width = 1 + buffer.readUIntLE(24, 3); height = 1 + buffer.readUIntLE(27, 3);
    } else if (chunk === 'VP8 ' && buffer.length >= 30){
      width = buffer.readUInt16LE(26) & 0x3fff; height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f){
      width = 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]);
      height = 1 + ((buffer[24] << 6) | ((buffer[23] & 0x0f) << 2) | (buffer[22] >> 6));
    }
    return width > 0 && height > 0 && width <= 30000 && height <= 30000 ? { type: 'image/webp', ext: 'webp', width, height } : null;
  }
  return null;
}
function mediaReferences(id){
  const refs = [];
  const inspect = (site, prefix) => {
    if (!isPlain(site)) return;
    if (isPlain(site.images)) for (const key of Object.keys(site.images)) if (site.images[key] && site.images[key].id === id) refs.push(prefix + key);
    if (site.settings && site.settings.ogImage === id) refs.push(prefix + 'settings.ogImage');
    if (isPlain(site.pages)) for (const key of Object.keys(site.pages)) if (site.pages[key] && site.pages[key].ogImage === id) refs.push(prefix + 'pages.' + key + '.ogImage');
    if (isPlain(site.collections)) for (const type of Object.keys(site.collections)){
      const items = Array.isArray(site.collections[type]) ? site.collections[type] : [];
      items.forEach(item => {
        if (item && item.image && item.image.id === id) refs.push(prefix + 'collections.' + type + '.' + item.id + '.image');
        if (item && item.seo && item.seo.ogImage === id) refs.push(prefix + 'collections.' + type + '.' + item.id + '.seo.ogImage');
      });
    }
  };
  inspect(loadSite(), 'live:');
  const draft = readDraft(); if (draft) inspect(draft.draft, 'draft:');
  listHistory().forEach(version => inspect(version.site, 'history:' + version.id + ':'));
  return Array.from(new Set(refs));
}

/* Everything the browser will evaluate as JS — keep "</script" from
   terminating the tag. */
function siteToJs(site){
  return '/* GENERATED by server.js from data/site.json — do not edit by hand.\n' +
    '   Loaded in <head> on every page so js/site-config.js can apply the\n' +
    '   admin-saved design + content before first paint. */\n' +
    'window.OMNI_SITE = ' + JSON.stringify(site, null, 2).replace(/<\//g, '<\\/') + ';\n';
}
function listPages(){
  return fs.readdirSync(ROOT).filter(f => /\.html$/i.test(f) && !['admin.html', 'admin-advanced.html', '404.html'].includes(f)).sort();
}
function writeSeoFiles(site){
  const base = String((site.settings && site.settings.siteUrl) || '').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const detailTemplates = new Set(['case-study.html', 'article.html', 'role-detail.html']);
  const urls = listPages().filter(f => !detailTemplates.has(f)).filter(f => {
    const key = f.replace(/\.html$/i, '');
    return !(site.pages && site.pages[key] && site.pages[key].noindex === true);
  }).map(f => {
    const loc = base + '/' + (f === 'index.html' ? '' : f);
    return '  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + today + '</lastmod></url>';
  });
  const collections = effectiveCollections(site);
  for (const type of ['cases', 'articles', 'jobs']) for (const item of collections[type] || []){
    if (!item.published || (item.seo && item.seo.noindex)) continue;
    const loc = base + collectionPath(type, item.slug);
    urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + escapeXml(String(item.updatedAt || today).slice(0, 10)) + '</lastmod></url>');
  }
  writeTextAtomic(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
  writeTextAtomic(path.join(ROOT, 'robots.txt'),
    /* data/site.js must stay crawlable — it carries the published copy */
    'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-advanced.html\nDisallow: /api/\n\nSitemap: ' + base + '/sitemap.xml\n');
}
/* Keep the outgoing live version so a publish can be undone from the editor. */
function listHistory(){
  let names = [];
  try { names = fs.readdirSync(HISTORY_DIR).filter(f => /^[0-9TZ-]+\.json$/.test(f)); } catch (e) { return []; }
  return names.sort().reverse().map(f => {
    const rec = readJson(path.join(HISTORY_DIR, f), null);
    return rec && isPlain(rec.site) ? { id: f.replace(/\.json$/, ''), archivedAt: rec.archivedAt || null, publishedAt: rec.publishedAt || null, site: rec.site } : null;
  }).filter(Boolean);
}
function archiveCurrent(){
  const prev = readJson(SITE_JSON, null);
  if (!isPlain(prev)) return;
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeJsonAtomic(path.join(HISTORY_DIR, stamp + '.json'), { archivedAt: new Date().toISOString(), publishedAt: prev.updatedAt || null, site: prev });
  listHistory().slice(HISTORY_KEEP).forEach(h => { try { fs.rmSync(path.join(HISTORY_DIR, h.id + '.json')); } catch (e) {} });
}
function saveSite(site){
  archiveCurrent();
  site.updatedAt = new Date().toISOString();
  writeJsonAtomic(SITE_JSON, site);
  writeTextAtomic(SITE_JS, siteToJs(site));
  writeSeoFiles(site);
  return site;
}
function escapeXml(s){ return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
function escapeHtml(s){ return String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

/* ---------- validation of an incoming site config ---------- */
function isPlain(o){ return o && typeof o === 'object' && !Array.isArray(o); }
function strMap(o, max){
  const out = {};
  if (!isPlain(o)) return out;
  for (const k of Object.keys(o)){
    if (typeof o[k] === 'string' && k.length <= 200 && o[k].length <= (max || 20000)) out[k] = o[k];
  }
  return out;
}
function cleanEngines(arr){
  if (!Array.isArray(arr) || !arr.length || arr.length > 8) return null;
  return arr.map((e, i) => {
    if (!isPlain(e)) e = {};
    const s = k => typeof e[k] === 'string' ? e[k].slice(0, 500) : '';
    return {
      id: (s('id') || 'engine-' + (i + 1)).replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'engine-' + (i + 1),
      num: s('num') || ('0' + (i + 1)).slice(-2),
      name: s('name'), codename: s('codename'), promise: s('promise'), headline: s('headline'),
      href: s('href') || 'services.html', detail: s('detail') || s('href') || 'services.html',
      groups: (Array.isArray(e.groups) ? e.groups : []).slice(0, 8).map(g => ({
        title: isPlain(g) && typeof g.title === 'string' ? g.title.slice(0, 200) : '',
        items: (isPlain(g) && Array.isArray(g.items) ? g.items : []).filter(x => typeof x === 'string').map(x => x.slice(0, 300)).slice(0, 40)
      }))
    };
  });
}
function cleanStrArray(arr, max){
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.filter(x => typeof x === 'string').map(x => x.slice(0, 200)).slice(0, max || 60);
}
function cleanIdArray(arr, max){
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)))).slice(0, max || 60);
}
function safeMediaValue(value){
  const trimmed = String(value || '').trim();
  return /^[a-f0-9]{16}$/.test(trimmed) || /^https?:\/\//i.test(trimmed) ? trimmed.slice(0, 2000) : '';
}
const COLLECTION_TYPES = ['cases', 'articles', 'jobs', 'team', 'testimonials'];
const COLLECTION_ROUTES = { cases: '/work/', articles: '/insights/', jobs: '/careers/' };
function collectionPath(type, slug){ return (COLLECTION_ROUTES[type] || '/') + String(slug || ''); }
function effectiveCollections(site){
  return isPlain(site && site.collections) ? site.collections : DEFAULT_CONTENT.collections;
}
function localized(value, limit, html){
  value = isPlain(value) ? value : {};
  const out = {};
  for (const lang of ['en', 'az']){
    let text = typeof value[lang] === 'string' ? value[lang] : '';
    if (html) text = sanitizeCollectionHtml(text.slice(0, 50000));
    else text = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit || 5000);
    out[lang] = text;
  }
  return out;
}
function sanitizeCollectionHtml(value){
  let html = String(value || '').slice(0, 50000);
  html = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const allowed = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'b', 'strong', 'em', 'i', 'a', 'br']);
  return html.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (tag, closing, rawName, attrs) => {
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) return '';
    if (closing) return name === 'br' ? '' : '</' + name + '>';
    if (name === 'br') return '<br>';
    if (name !== 'a') return '<' + name + '>';
    const match = String(attrs || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = String(match ? (match[1] || match[2] || match[3] || '') : '').trim();
    if (!/^(https?:|mailto:|tel:|\/|#|[a-z0-9-]+\.html)/i.test(href)) return '<a>';
    return '<a href="' + escapeHtml(href) + '">';
  }).trim();
}
function cleanCollectionImage(raw){
  if (!isPlain(raw) || !/^[a-f0-9]{16}$/.test(raw.id || '')) return null;
  const out = { id: raw.id, alt: typeof raw.alt === 'string' ? raw.alt.trim().slice(0, 500) : '' };
  if (isPlain(raw.focal)) out.focal = cleanFocal(raw.focal);
  return out;
}
function validIsoDate(value){
  value = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) ? value : '';
}
function validTimestamp(value){
  value = String(value || '').trim();
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : '';
}
function cleanCollectionItem(type, raw, index){
  if (!isPlain(raw) || !/^[a-f0-9]{16}$/.test(raw.id || '') || !/^[a-z0-9-]{2,60}$/.test(raw.slug || '')) return null;
  const now = new Date().toISOString();
  const item = {
    id: raw.id, slug: raw.slug, published: raw.published === true,
    order: Number.isInteger(raw.order) ? Math.max(-10000, Math.min(10000, raw.order)) : index,
    createdAt: validTimestamp(raw.createdAt) || now, updatedAt: validTimestamp(raw.updatedAt) || now,
    fields: {}
  };
  const fields = isPlain(raw.fields) ? raw.fields : {};
  if (type === 'cases'){
    item.sector = /^[a-z0-9-]{1,40}$/.test(raw.sector || '') ? raw.sector : 'other';
    item.client = String(raw.client || '').trim().slice(0, 300);
    item.year = String(raw.year || '').trim().slice(0, 20);
    item.fields.title = localized(fields.title, 500); item.fields.summary = localized(fields.summary, 2000); item.fields.body = localized(fields.body, 50000, true);
    item.fields.metrics = (Array.isArray(fields.metrics) ? fields.metrics : []).slice(0, 4).filter(isPlain).map(metric => ({
      value: String(metric.value || '').trim().slice(0, 40), label: localized(metric.label, 160)
    }));
  } else if (type === 'articles'){
    item.category = ['demand', 'revops', 'sales', 'brand'].includes(raw.category) ? raw.category : 'demand';
    item.author = String(raw.author || '').trim().slice(0, 200); item.date = validIsoDate(raw.date);
    item.readingMinutes = Number.isInteger(raw.readingMinutes) ? Math.max(1, Math.min(180, raw.readingMinutes)) : 5;
    item.fields.title = localized(fields.title, 500); item.fields.dek = localized(fields.dek, 2000); item.fields.body = localized(fields.body, 50000, true);
  } else if (type === 'jobs'){
    item.location = String(raw.location || '').trim().slice(0, 300); item.remote = raw.remote === true;
    item.type = ['full-time', 'part-time', 'contract'].includes(raw.type) ? raw.type : 'full-time';
    item.applyUrl = /^https:\/\//i.test(raw.applyUrl || '') ? String(raw.applyUrl).trim().slice(0, 2000) : '';
    item.validThrough = validIsoDate(raw.validThrough);
    item.fields.title = localized(fields.title, 500); item.fields.summary = localized(fields.summary, 2000); item.fields.body = localized(fields.body, 50000, true);
  } else if (type === 'team'){
    item.name = String(raw.name || '').trim().slice(0, 200); item.linkedin = /^https:\/\//i.test(raw.linkedin || '') ? String(raw.linkedin).trim().slice(0, 2000) : '';
    item.fields.role = localized(fields.role, 500); item.fields.bio = localized(fields.bio, 2000);
  } else {
    item.name = String(raw.name || '').trim().slice(0, 200); item.company = String(raw.company || '').trim().slice(0, 200);
    item.fields.quote = localized(fields.quote, 3000); item.fields.role = localized(fields.role, 500);
  }
  const image = cleanCollectionImage(raw.image); if (image) item.image = image;
  if (isPlain(raw.seo)){
    const seo = {};
    if (typeof raw.seo.title === 'string') seo.title = raw.seo.title.trim().slice(0, 1000);
    if (typeof raw.seo.description === 'string') seo.description = raw.seo.description.trim().slice(0, 1000);
    if (typeof raw.seo.ogImage === 'string') seo.ogImage = safeMediaValue(raw.seo.ogImage);
    if (typeof raw.seo.noindex === 'boolean') seo.noindex = raw.seo.noindex;
    if (Object.keys(seo).length) item.seo = seo;
  }
  return item;
}
function cleanCollections(raw){
  if (!isPlain(raw)) return null;
  const defaults = DEFAULT_CONTENT.collections || {}, out = {};
  for (const type of COLLECTION_TYPES){
    const source = Array.isArray(raw[type]) ? raw[type] : (defaults[type] || []);
    const seenIds = new Set(), seenSlugs = new Set();
    out[type] = source.slice(0, 100).map((item, index) => cleanCollectionItem(type, item, index)).filter(item => {
      if (!item) return false;
      if (seenIds.has(item.id) || seenSlugs.has(item.slug)) throw new Error('Collection IDs and slugs must be unique within ' + type + '.');
      seenIds.add(item.id); seenSlugs.add(item.slug); return true;
    });
  }
  return out;
}
const FONT_PRESETS = {
  'bricolage-inter': ['Bricolage Grotesque', 'Inter', 'JetBrains Mono'],
  'sora-dmsans': ['Sora', 'DM Sans', 'Fira Code'],
  'syne-manrope': ['Syne', 'Manrope', 'IBM Plex Mono'],
  'playfair-worksans': ['Playfair Display', 'Work Sans', 'Space Mono']
};
const MOTION_FLAGS = ['customCursor', 'magneticButtons', 'kineticHeadlines', 'marquee', 'countUp', 'reveal'];
function validateSite(input){
  if (!isPlain(input)) throw new Error('config must be an object');
  const site = JSON.parse(JSON.stringify(DEFAULT_SITE));
  site.settings = Object.assign({}, site.settings, strMap(input.settings, 2000));
  const megaMenuLinkLimit = Number.parseInt(input.settings && input.settings.megaMenuLinkLimit, 10);
  site.settings.megaMenuLinkLimit = Number.isFinite(megaMenuLinkLimit) ? Math.max(1, Math.min(12, megaMenuLinkLimit)) : 4;
  if (!['en', 'az'].includes(site.settings.defaultLang)) site.settings.defaultLang = 'en';
  /* links the public pages will render as href — no javascript:/data: schemes */
  const safeLink = (v, schemes) => {
    v = String(v || '').trim();
    if (!v || v === '#' || /^(\/|\.\/|[a-z0-9-]+\.html)/i.test(v)) return v;
    const m = v.match(/^([a-z][a-z0-9+.-]*):/i);
    return m && schemes.includes(m[1].toLowerCase()) ? v : '';
  };
  for (const k of ['linkedin', 'privacyUrl', 'termsUrl']) site.settings[k] = safeLink(site.settings[k], ['http', 'https', 'mailto', 'tel']);
  site.settings.siteUrl = /^https?:\/\//i.test(site.settings.siteUrl || '') ? site.settings.siteUrl.trim() : '';
  site.settings.ogImage = safeMediaValue(site.settings.ogImage);
  site.settings.schedulerUrl = /^https:\/\//i.test(site.settings.schedulerUrl || '') ? site.settings.schedulerUrl.trim() : '';
  if (isPlain(input.features)) for (const k of Object.keys(site.features)) if (k in input.features) site.features[k] = !!input.features[k];
  if (isPlain(input.design)){
    site.design.tokens = strMap(input.design.tokens, 200);
    for (const k of Object.keys(site.design.tokens)) if (!/^--[a-z0-9-]{1,40}$/i.test(k)) delete site.design.tokens[k];
    for (const k of ['fontDisplay', 'fontBody', 'fontMono']) if (typeof input.design[k] === 'string') site.design[k] = input.design[k].slice(0, 80);
    if (typeof input.design.fontPreset === 'string' && FONT_PRESETS[input.design.fontPreset]){
      site.design.fontPreset = input.design.fontPreset;
      const fonts = FONT_PRESETS[input.design.fontPreset];
      site.design.fontDisplay = fonts[0]; site.design.fontBody = fonts[1]; site.design.fontMono = fonts[2];
    }
    if (['on', 'calm', 'off'].includes(input.design.motion)){
      site.design.motion = input.design.motion;
      MOTION_FLAGS.forEach(k => { site.features[k] = input.design.motion === 'on'; });
      if (input.design.motion === 'calm'){
        site.features.countUp = true; site.features.reveal = true;
      }
    }
    if (typeof input.design.customCss === 'string') site.design.customCss = input.design.customCss.slice(0, 200000);
  }
  if (isPlain(input.analytics)){
    if (typeof input.analytics.gaId === 'string') site.analytics.gaId = input.analytics.gaId.trim().slice(0, 40);
    if (typeof input.analytics.consentScript === 'string') site.analytics.consentScript = input.analytics.consentScript.slice(0, 50000);
  }
  if (isPlain(input.structured)){
    site.structured = Object.assign({}, site.structured, strMap(input.structured, 10000));
    site.structured.jobRemote = !!input.structured.jobRemote;
    for (const k of ['orgLogoUrl', 'jobApplyUrl']) site.structured[k] = /^https?:\/\//i.test(site.structured[k] || '') ? site.structured[k].trim() : '';
    for (const k of ['articleDatePublished', 'articleDateModified', 'jobDatePosted', 'jobValidThrough']){
      const v = String(site.structured[k] || '').trim();
      site.structured[k] = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) ? v : '';
    }
    const employment = String(site.structured.jobEmploymentType || '').toUpperCase();
    site.structured.jobEmploymentType = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER'].includes(employment) ? employment : '';
  }
  site.hiddenSections = cleanStrArray(input.hiddenSections, 500) || [];
  if (isPlain(input.sectionOrder)) for (const page of Object.keys(input.sectionOrder)){
    if (!/^[a-z0-9-]{1,60}$/i.test(page) || !Array.isArray(input.sectionOrder[page])) continue;
    site.sectionOrder[page] = Array.from(new Set(input.sectionOrder[page]
      .filter(key => typeof key === 'string' && key.length <= 60))).slice(0, 60);
  }
  if (isPlain(input.sectionAccent)) for (const key of Object.keys(input.sectionAccent)){
    if (key.length <= 60 && Number.isInteger(input.sectionAccent[key]) && input.sectionAccent[key] >= 1 && input.sectionAccent[key] <= 5){
      site.sectionAccent[key] = input.sectionAccent[key];
    }
  }
  if (isPlain(input.itemOrder)) for (const key of Object.keys(input.itemOrder)){
    if (/^[a-z0-9.-]{1,60}$/.test(key)) site.itemOrder[key] = cleanIdArray(input.itemOrder[key], 60);
  }
  if (Array.isArray(input.hiddenItems)){
    site.hiddenItems = Array.from(new Set(input.hiddenItems.filter(value => typeof value === 'string' &&
      /^[a-z0-9.-]{1,60}:[a-z0-9-]{1,40}$/.test(value)))).slice(0, 500);
  }
  if (isPlain(input.images)) for (const key of Object.keys(input.images)){
    const raw = input.images[key];
    if (!/^[a-z0-9.-]{1,60}$/.test(key) || !isPlain(raw) || !/^[a-f0-9]{16}$/.test(raw.id || '')) continue;
    const image = { id: raw.id };
    if (typeof raw.alt === 'string') image.alt = raw.alt.slice(0, 500);
    if (isPlain(raw.focal)) image.focal = cleanFocal(raw.focal);
    site.images[key] = image;
  }
  if (isPlain(input.pages)) for (const k of Object.keys(input.pages)){
    if (!/^[a-z0-9-]{1,60}$/i.test(k) || !isPlain(input.pages[k])) continue;
    const raw = input.pages[k], p = {};
    if (typeof raw.title === 'string') p.title = raw.title.slice(0, 1000);
    if (typeof raw.description === 'string') p.description = raw.description.slice(0, 1000);
    if (typeof raw.ogImage === 'string') p.ogImage = safeMediaValue(raw.ogImage);
    if (typeof raw.noindex === 'boolean') p.noindex = raw.noindex;
    if (Object.keys(p).length) site.pages[k] = p;
  }
  if (isPlain(input.i18n)){ site.i18n.en = strMap(input.i18n.en); site.i18n.az = strMap(input.i18n.az); }
  site.engines = cleanEngines(input.engines);
  site.enginesAz = site.engines ? cleanEngines(input.enginesAz) : null;
  site.industries = cleanStrArray(input.industries);
  site.industriesAz = site.industries ? cleanStrArray(input.industriesAz) : null;
  site.collections = cleanCollections(input.collections);
  return site;
}

function readDraft(){
  const record = readJson(DRAFT_JSON, null);
  if (!record || !isPlain(record.draft)) return null;
  return { draft: record.draft, savedAt: record.savedAt || null, baseUpdatedAt: record.baseUpdatedAt || null, restoredFrom: record.restoredFrom || null };
}
function removeDraft(){
  try { fs.rmSync(DRAFT_JSON, { force: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
function flatten(value, prefix, out){
  out = out || {};
  prefix = prefix || '';
  if (Array.isArray(value) || !isPlain(value)){
    out[prefix] = JSON.stringify(value);
    return out;
  }
  const keys = Object.keys(value);
  if (!keys.length) out[prefix] = '{}';
  keys.forEach(key => flatten(value[key], prefix ? prefix + '.' + key : key, out));
  return out;
}
function diffCount(before, after){
  const a = flatten(before), b = flatten(after);
  return Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).filter(key => a[key] !== b[key]).length;
}
function publishSummary(before, after){
  return {
    texts: diffCount(before.i18n || {}, after.i18n || {}),
    sections: diffCount({ order: before.sectionOrder || {}, hidden: before.hiddenSections || [], accent: before.sectionAccent || {} },
      { order: after.sectionOrder || {}, hidden: after.hiddenSections || [], accent: after.sectionAccent || {} }),
    items: diffCount({ order: before.itemOrder || {}, hidden: before.hiddenItems || [], collections: before.collections },
      { order: after.itemOrder || {}, hidden: after.hiddenItems || [], collections: after.collections }),
    images: diffCount(before.images || {}, after.images || {}),
    catalogue: diffCount({ engines: before.engines, enginesAz: before.enginesAz, industries: before.industries, industriesAz: before.industriesAz },
      { engines: after.engines, enginesAz: after.enginesAz, industries: after.industries, industriesAz: after.industriesAz }),
    design: diffCount(before.design || {}, after.design || {}),
    settings: diffCount({ settings: before.settings || {}, features: before.features || {}, analytics: before.analytics || {}, structured: before.structured || {}, pages: before.pages || {} },
      { settings: after.settings || {}, features: after.features || {}, analytics: after.analytics || {}, structured: after.structured || {}, pages: after.pages || {} })
  };
}

/* ---------- auth ---------- */
function hashPassword(pw, salt){
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, rec){
  if (!rec || !rec.salt || !rec.hash) return false;
  const h = crypto.scryptSync(String(pw), rec.salt, 64);
  const stored = Buffer.from(rec.hash, 'hex');
  return h.length === stored.length && crypto.timingSafeEqual(h, stored);
}
function loadAdmin(){
  let admin = readJson(ADMIN_JSON, null);
  if (admin && admin.hash && admin.secret){
    const recoveryEmail = typeof admin.recoveryEmail === 'string' ? admin.recoveryEmail.trim().toLowerCase().slice(0, 254) : '';
    admin.recoveryEmail = isEmail(recoveryEmail) ? recoveryEmail : '';
    admin.notifyEmails = cleanEmails(admin.notifyEmails);
    if (!isPlain(admin.recovery) || !/^[a-f0-9]{64}$/.test(admin.recovery.hash || '') || !admin.recovery.exp) admin.recovery = null;
    return { admin, generated: null };
  }
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  admin = Object.assign(hashPassword(pw), { secret: crypto.randomBytes(32).toString('hex'), createdAt: new Date().toISOString(),
    recoveryEmail: '', recovery: null, notifyEmails: [] });
  writeJsonAtomic(ADMIN_JSON, admin);
  return { admin, generated: process.env.ADMIN_PASSWORD ? null : pw };
}
let ADMIN = null;
function saveAdmin(next){
  ADMIN = next;
  writeJsonAtomic(ADMIN_JSON, ADMIN);
  return ADMIN;
}
function sign(payload){
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN.secret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(tok){
  if (!tok || typeof tok !== 'string') return null;
  const i = tok.lastIndexOf('.');
  if (i < 0) return null;
  const body = tok.slice(0, i), sig = tok.slice(i + 1);
  const want = crypto.createHmac('sha256', ADMIN.secret).update(body).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Date.now() || p.v !== ADMIN.createdAt) return null;
    return p;
  } catch (e) { return null; }
}
function parseCookies(req){
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function isAuthed(req){ return !!verifyToken(parseCookies(req)[COOKIE]); }
/* HTTPS is terminated by the platform / reverse proxy; it tells us via
   x-forwarded-proto. SECURE_COOKIES=1 forces the flag on. */
function isSecure(req){
  return process.env.SECURE_COOKIES === '1' || req.headers['x-forwarded-proto'] === 'https';
}
function sessionCookie(tok, maxAgeSec, secure){
  return COOKIE + '=' + encodeURIComponent(tok) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAgeSec + (secure ? '; Secure' : '');
}

/* simple per-IP throttles: login (10 / 15 min), form submissions (30 / 10 min) */
function limiter(max, windowMs){
  const hits = new Map();
  return ip => {
    const now = Date.now();
    let rec = hits.get(ip);
    if (!rec || rec.reset < now){ rec = { count: 0, reset: now + windowMs }; hits.set(ip, rec); }
    rec.count++;
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return rec.count <= max;
  };
}
const loginLimiter = limiter(10, 15 * 60 * 1000);
const submitLimiter = limiter(30, 10 * 60 * 1000);
const recoverLimiter = limiter(3, 15 * 60 * 1000);
const resetLimiter = limiter(5, 15 * 60 * 1000);
const notifyTestLimiter = limiter(3, 10 * 60 * 1000);
const mediaUploadLimiter = limiter(60, 10 * 60 * 1000);

/* ---------- http helpers ---------- */
function send(res, status, body, headers){
  const h = Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  }, headers || {});
  if ((typeof body === 'string' || Buffer.isBuffer(body)) && h['Content-Length'] == null) h['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(status, h);
  res.end(body);
}
function json(res, status, obj, headers){
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY){ reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}
function readRawBody(req, limit){
  return new Promise((resolve, reject) => {
    let size = 0, settled = false; const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (settled) return;
      if (size > limit){
        settled = true;
        const error = new Error('Image exceeds the upload size limit.'); error.status = 413;
        reject(error); return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!settled) resolve(Buffer.concat(chunks)); });
    req.on('error', error => { if (!settled){ settled = true; reject(error); } });
  });
}
/* Mutating requests must come from our own pages: SameSite=Strict cookie
   plus a custom header (no cross-site form can set one) plus an Origin check. */
function sameOrigin(req){
  if (req.headers['x-requested-with'] !== 'OmniAdmin') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}
/* behind a reverse proxy every visitor shares the proxy's socket address —
   set TRUST_PROXY=1 there so the throttles key on the real client */
function clientIp(req){
  if (TRUST_PROXY){
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return (req.socket && req.socket.remoteAddress) || '0.0.0.0';
}

/* ---------- submission notifications ----------
   Secrets live in the environment, never in site.json (which is public).
     RESEND_API_KEY + editor recipients or NOTIFY_EMAIL_TO  → email via api.resend.com
     NOTIFY_WEBHOOK_URL                                       → JSON POST (Slack, Zapier, Make, a CRM)
   Fire-and-forget after the submission is on disk; failures are logged,
   never surfaced to the visitor. */
function isEmail(value){
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function cleanEmails(values){
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(value => String(value || '').trim().toLowerCase()).filter(isEmail))).slice(0, 10);
}
function notificationRecipients(){
  const stored = cleanEmails(ADMIN && ADMIN.notifyEmails);
  if (stored.length) return { emails: stored, source: 'settings' };
  const env = cleanEmails(String(process.env.NOTIFY_EMAIL_TO || '').split(','));
  return { emails: env, source: env.length ? 'env' : 'none' };
}
function notifyConfig(){
  const recipients = notificationRecipients();
  return {
    email: !!(process.env.RESEND_API_KEY && recipients.emails.length),
    emailSource: recipients.source,
    webhook: /^https:\/\//i.test(process.env.NOTIFY_WEBHOOK_URL || ''),
    autoReply: !!process.env.RESEND_API_KEY
  };
}
async function postWithTimeout(url, headers, body){
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  } finally { clearTimeout(timer); }
}
function resendDetails(site){
  const name = String((site.settings && site.settings.siteName) || 'OmniMark').replace(/[\r\n]+/g, ' ').trim().slice(0, 100) || 'OmniMark';
  return {
    name,
    sender: process.env.NOTIFY_EMAIL_FROM || (name + ' <onboarding@resend.dev>'),
    url: process.env.RESEND_API_URL || 'https://api.resend.com/emails',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY }
  };
}
function sendLeadEmail(sub, site){
  const recipients = notificationRecipients();
  if (!process.env.RESEND_API_KEY || !recipients.emails.length) return Promise.resolve({ ok: false, reason: 'not-configured', recipients: [] });
  const mail = resendDetails(site);
  const lines = Object.keys(sub.fields).map(k => k + ': ' + sub.fields[k]).join('\n');
  const text = 'New ' + sub.form + ' submission on ' + mail.name + '\n' + sub.at + '\n\n' + lines + '\n\nPage: ' + sub.page + '\nLanguage: ' + sub.lang;
  return postWithTimeout(mail.url, mail.headers,
    { from: mail.sender, to: recipients.emails, reply_to: sub.fields.email || undefined,
      subject: '[' + mail.name + '] New ' + sub.form + ' submission' + (sub.fields.name ? ' from ' + sub.fields.name : ''), text })
    .then(() => ({ ok: true, recipients: recipients.emails, source: recipients.source }));
}
function notify(sub, site){
  const cfg = notifyConfig();
  const mail = resendDetails(site);
  const name = mail.name;
  const lines = Object.keys(sub.fields).map(k => k + ': ' + sub.fields[k]).join('\n');
  const text = 'New ' + sub.form + ' submission on ' + name + '\n' + sub.at + '\n\n' + lines + '\n\nPage: ' + sub.page + '\nLanguage: ' + sub.lang;
  if (cfg.webhook){
    postWithTimeout(process.env.NOTIFY_WEBHOOK_URL, { 'Content-Type': 'application/json' },
      { text, site: name, form: sub.form, at: sub.at, page: sub.page, lang: sub.lang, fields: sub.fields, id: sub.id,
        consentAt: sub.consentAt, consentSource: sub.consentSource })
      .catch(e => console.error('[notify] webhook failed:', e.message));
  }
  if (cfg.email){
    sendLeadEmail(sub, site)
      .catch(e => console.error('[notify] email failed:', e.message));
  }
  if (cfg.autoReply && sub.fields.email){
    const firstName = String(sub.fields.name || '').replace(/[\r\n]+/g, ' ').trim().split(/\s+/)[0].slice(0, 80);
    const hello = firstName ? 'Hi ' + firstName + ',' : 'Hello,';
    let subject, replyText;
    if (sub.form === 'newsletter'){
      const mailbox = (site.settings && site.settings.email) || String(process.env.NOTIFY_EMAIL_TO || '').split(',')[0].trim();
      const unsubscribe = mailbox ? 'mailto:' + mailbox + '?subject=' + encodeURIComponent('Unsubscribe from ' + name) : '';
      subject = 'Welcome to ' + name;
      replyText = hello + '\n\nThanks for subscribing. We have recorded your signup and will send updates to this address.' +
        (unsubscribe ? '\n\nTo unsubscribe at any time, use this link: ' + unsubscribe : '') +
        '\n\n' + name;
    } else {
      subject = 'We received your enquiry — ' + name;
      replyText = hello + '\n\nThanks for contacting ' + name + '. Your enquiry is safely in our queue, and we will reply within one business day.\n\nThis is an automated confirmation; you can reply directly if you need to add context.\n\n' + name;
    }
    postWithTimeout(mail.url, mail.headers,
      { from: mail.sender, to: [sub.fields.email], reply_to: (site.settings && site.settings.email) || undefined, subject, text: replyText })
      .catch(e => console.error('[notify] visitor acknowledgement failed:', e.message));
  }
}

function submissionErrors(form, fields){
  const rules = {
    contact: ['name', 'email', 'company', 'spend', 'consent'],
    teardown: ['name', 'email', 'company', 'spend'],
    newsletter: ['email']
  };
  if (!rules[form]) return null;
  const errors = {};
  for (const field of rules[form]){
    if (field === 'consent'){
      if (fields[field] !== 'true') errors[field] = 'consent required';
    } else if (!String(fields[field] || '').trim()) errors[field] = 'required';
  }
  const email = String(fields.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'invalid email';
  return errors;
}

/* ---------- page metadata for the admin "Pages" tab ---------- */
function stripTags(s){ return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function pageInfo(file){
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, ''])[1].trim();
  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ''])[1];
  const sections = [];
  const re = /<(section|header)\b[^>]*\bdata-section="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))){
    const end = html.indexOf('</' + m[1] + '>', m.index);
    const inner = html.slice(m.index, end > 0 ? end : m.index + 4000);
    const lab = inner.match(/<(h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/i) || inner.match(/<p class="(?:eyebrow|label)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const aria = m[0].match(/aria-label="([^"]+)"/);
    let label = lab ? stripTags(lab[lab.length - 1]) : (aria ? aria[1] : '');
    if (m[1] === 'header') label = 'Hero' + (label ? ' — ' + label : '');
    sections.push({ key: m[2], label: (label || m[2]).slice(0, 90) });
  }
  return { key: file.replace(/\.html$/i, ''), file, title, description, sections };
}

function resolveMediaUrl(value, base, width){
  const raw = String(value || '').trim();
  if (/^[a-f0-9]{16}$/.test(raw)) return (base || '') + '/media/' + raw + '-' + (width || 1600) + '.webp';
  return /^https?:\/\//i.test(raw) ? raw : '';
}

function itemText(item, key, lang){
  const value = item && item.fields && item.fields[key];
  if (isPlain(value)) return String(value[lang] || value.en || value.az || '');
  return String(value || '');
}
function structuredData(html, key, site, base, loc, context){
  if (!base || !loc) return null;
  const settings = site.settings || {};
  const cfg = site.structured || {};
  const orgId = base + '/#organization';
  const org = {
    '@type': 'Organization', '@id': orgId,
    name: settings.siteName || 'OmniMark', url: base
  };
  if (cfg.orgLegalName) org.legalName = cfg.orgLegalName;
  if (cfg.orgLogoUrl) org.logo = cfg.orgLogoUrl;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email || '')) org.email = settings.email;
  if (settings.phone) org.telephone = settings.phone;
  if (settings.address) org.address = { '@type': 'PostalAddress', streetAddress: settings.address };
  if (/^https?:\/\//i.test(settings.linkedin || '')) org.sameAs = [settings.linkedin];
  const graph = [org];

  if (context && context.type === 'articles'){
    const item = context.item, lang = (settings.defaultLang === 'az' ? 'az' : 'en');
    const article = {
      '@type': 'Article', '@id': loc + '#article', mainEntityOfPage: loc,
      headline: stripTags(itemText(item, 'title', lang)), publisher: { '@id': orgId }
    };
    const description = stripTags((item.seo && item.seo.description) || itemText(item, 'dek', lang));
    if (description) article.description = description;
    if (item.date) article.datePublished = item.date;
    if (item.updatedAt) article.dateModified = item.updatedAt;
    if (item.author) article.author = { '@type': 'Person', name: item.author };
    const image = resolveMediaUrl((item.seo && item.seo.ogImage) || (item.image && item.image.id), base, 1600);
    if (image) article.image = image;
    graph.push(article);
  } else if (key === 'article' && !(effectiveCollections(site).articles || []).length && cfg.articleAuthor && cfg.articleDatePublished){
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const desc = ((site.pages && site.pages.article && site.pages.article.description) || ((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1]) || '').trim();
    const article = {
      '@type': 'Article', '@id': loc + '#article', mainEntityOfPage: loc,
      headline: stripTags(h1 ? h1[1] : ''), datePublished: cfg.articleDatePublished,
      author: { '@type': 'Person', name: cfg.articleAuthor },
      publisher: { '@id': orgId }
    };
    if (desc) article.description = stripTags(desc);
    if (cfg.articleDateModified) article.dateModified = cfg.articleDateModified;
    const articleImage = resolveMediaUrl((site.pages && site.pages.article && site.pages.article.ogImage) || settings.ogImage, base, 1600);
    if (articleImage) article.image = articleImage;
    graph.push(article);
  }

  const collectionJob = context && context.type === 'jobs' ? context.item : null;
  const collectionJobReady = collectionJob && collectionJob.validThrough && collectionJob.applyUrl && collectionJob.location;
  if (collectionJobReady){
    const lang = settings.defaultLang === 'az' ? 'az' : 'en';
    const job = {
      '@type': 'JobPosting', '@id': loc + '#job', title: itemText(collectionJob, 'title', lang),
      description: itemText(collectionJob, 'body', lang), datePosted: String(collectionJob.createdAt || '').slice(0, 10),
      validThrough: collectionJob.validThrough, employmentType: collectionJob.type.replace('-', '_').toUpperCase(),
      hiringOrganization: { '@id': orgId }, url: collectionJob.applyUrl,
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: collectionJob.location } }
    };
    if (collectionJob.remote) job.jobLocationType = 'TELECOMMUTE';
    graph.push(job);
  }

  const jobReady = !context && !(effectiveCollections(site).jobs || []).length && key === 'role-detail' && ['jobTitle', 'jobDescription', 'jobDatePosted', 'jobValidThrough', 'jobEmploymentType', 'jobLocation', 'jobApplyUrl'].every(k => cfg[k]);
  if (jobReady){
    const job = {
      '@type': 'JobPosting', '@id': loc + '#job', title: cfg.jobTitle,
      description: cfg.jobDescription, datePosted: cfg.jobDatePosted,
      validThrough: cfg.jobValidThrough, employmentType: cfg.jobEmploymentType,
      hiringOrganization: { '@id': orgId }, url: cfg.jobApplyUrl,
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: cfg.jobLocation } }
    };
    if (cfg.jobRemote) job.jobLocationType = 'TELECOMMUTE';
    graph.push(job);
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function jsonLd(value){
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function recoveryAvailable(){ return !!(ADMIN && ADMIN.recoveryEmail && process.env.RESEND_API_KEY); }
function requestBase(req){
  const site = loadSite();
  const configured = String((site.settings && site.settings.siteUrl) || '').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const scheme = forwarded === 'https' ? 'https' : 'http';
  const host = String(req.headers.host || '').trim();
  return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) ? scheme + '://' + host : '';
}
async function sendRecoveryEmail(req, token){
  const site = loadSite(), mail = resendDetails(site), base = requestBase(req);
  if (!base) throw new Error('No safe public base URL is configured.');
  const link = base + '/admin.html?reset=' + encodeURIComponent(token);
  await postWithTimeout(mail.url, mail.headers, {
    from: mail.sender, to: [ADMIN.recoveryEmail], subject: 'Reset your ' + mail.name + ' admin password',
    text: 'A password reset was requested for the ' + mail.name + ' website editor.\n\nReset your password within 30 minutes:\n' + link +
      '\n\nIf you did not request this, you can ignore this email.'
  });
}

function mediaRecordForClient(item){
  return {
    id: item.id, name: item.name, alt: item.alt, width: item.width, height: item.height,
    bytes: item.bytes, type: item.type, variants: item.variants.slice(), focal: item.focal,
    uploadedAt: item.uploadedAt, usedBy: mediaReferences(item.id)
  };
}
function mediaPath(item){ return path.join(MEDIA_DIR, item.id + '.' + item.ext); }
function variantPath(id, width){ return path.join(MEDIA_DIR, id + '-' + width + '.webp'); }
function mediaQuotaAllows(extraBytes, replacingBytes){
  return mediaDiskBytes() - (replacingBytes || 0) + extraBytes <= MAX_MEDIA_BYTES;
}

/* Inject admin-set title / description / og into a page as it is served. */
function injectMeta(html, key, site, context){
  const item = context && context.item;
  const lang = site.settings && site.settings.defaultLang === 'az' ? 'az' : 'en';
  const pg = item ? (item.seo || {}) : ((site.pages && site.pages[key]) || {});
  const itemTitle = item ? itemText(item, 'title', lang) : '';
  const itemDescription = item ? itemText(item, context.type === 'articles' ? 'dek' : 'summary', lang) : '';
  const titleValue = pg.title || itemTitle;
  const descriptionValue = pg.description || itemDescription;
  if (titleValue){
    const suffix = item && site.settings && site.settings.siteName ? ' — ' + site.settings.siteName : '';
    const t = escapeHtml(titleValue + suffix);
    html = html.replace(/<title>[^<]*<\/title>/i, '<title>' + t + '</title>')
               .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, '$1' + t + '$2');
  }
  if (descriptionValue){
    const d = escapeHtml(stripTags(descriptionValue));
    html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, '$1' + d + '$2')
               .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, '$1' + d + '$2');
  }
  /* canonical / social tags for every page, derived from Settings */
  const base = String((site.settings && site.settings.siteUrl) || '').replace(/\/+$/, '');
  const extra = [];
  const loc = base ? base + (context && context.path ? context.path : '/' + (key === 'index' ? '' : key + '.html')) : '';
  if (base && !/rel="canonical"/i.test(html)){
    extra.push('<link rel="canonical" href="' + escapeHtml(loc) + '">');
    extra.push('<meta property="og:url" content="' + escapeHtml(loc) + '">');
  }
  if (pg.noindex === true || (item && item.published !== true)){
    if (/<meta\s+name="robots"[^>]*>/i.test(html)) html = html.replace(/<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="noindex,nofollow">');
    else extra.push('<meta name="robots" content="noindex,nofollow">');
  }
  const img = resolveMediaUrl(pg.ogImage || (item && item.image && item.image.id) || (site.settings && site.settings.ogImage), base, 1600);
  if (img){
    const tag = '<meta property="og:image" content="' + escapeHtml(img) + '">';
    if (/property="og:image"/i.test(html)) html = html.replace(/<meta\s+property="og:image"[^>]*>/i, tag);
    else extra.push(tag);
  }
  if (!/name="twitter:card"/i.test(html)) extra.push('<meta name="twitter:card" content="' + (img ? 'summary_large_image' : 'summary') + '">');
  if (item && context.type === 'articles') html = html.replace(/<meta\s+property="og:type"[^>]*>/i, '<meta property="og:type" content="article">');
  const schema = structuredData(html, key, site, base, loc, context);
  if (schema) extra.push('<script type="application/ld+json">' + jsonLd(schema) + '</script>');
  if (extra.length) html = html.replace(/<\/head>/i, extra.join('\n') + '\n</head>');
  return html;
}

/* ---------- API ---------- */
async function api(req, res, url){
  const p = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  if (p === '/site' && method === 'GET') return json(res, 200, loadSite());
  if (p === '/me' && method === 'GET') return json(res, 200, { authed: isAuthed(req) });
  if (p === '/recover' && method === 'GET') return json(res, 200, { available: recoveryAvailable() });

  if (p === '/recover' && method === 'POST'){
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!recoverLimiter(clientIp(req))) return json(res, 429, { error: 'Too many reset requests. Wait 15 minutes.' });
    if (recoveryAvailable()){
      const token = crypto.randomBytes(32).toString('hex');
      const recovery = { hash: crypto.createHash('sha256').update(token).digest('hex'), exp: new Date(Date.now() + RECOVERY_TTL).toISOString() };
      saveAdmin(Object.assign({}, ADMIN, { recovery }));
      try { await sendRecoveryEmail(req, token); }
      catch (e) { console.error('[recovery] email failed:', e.message); }
    }
    return json(res, 200, { ok: true });
  }
  if (p === '/reset' && method === 'POST'){
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!resetLimiter(clientIp(req))) return json(res, 429, { error: 'Too many reset attempts. Wait 15 minutes.' });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: 'The reset link is invalid or expired.' }); }
    const token = String(body.token || ''), next = String(body.next || ''), recovery = ADMIN && ADMIN.recovery;
    let valid = /^[a-f0-9]{64}$/.test(token) && next.length >= 8 && next.length <= 200 && recovery && /^[a-f0-9]{64}$/.test(recovery.hash || '') && Date.parse(recovery.exp) > Date.now();
    if (valid){
      const got = Buffer.from(crypto.createHash('sha256').update(token).digest('hex'), 'hex');
      const want = Buffer.from(recovery.hash, 'hex');
      valid = got.length === want.length && crypto.timingSafeEqual(got, want);
    }
    if (!valid) return json(res, 400, { error: 'The reset link is invalid or expired.' });
    saveAdmin(Object.assign({}, ADMIN, hashPassword(next), { secret: crypto.randomBytes(32).toString('hex'), createdAt: new Date().toISOString(), recovery: null }));
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, isSecure(req)) });
  }

  if (p === '/submit' && method === 'POST'){
    if (!submitLimiter(clientIp(req))) return json(res, 429, { error: 'Too many submissions, try again later.' });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    const form = String(body.form || 'form').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'form';
    if (!['contact', 'teardown', 'newsletter'].includes(form)) return json(res, 400, { error: 'unsupported form' });
    const fields = {};
    for (const k of Object.keys(body)){
      if (k === 'form' || k === 'lang' || k === 'page') continue;
      const v = body[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') fields[k.slice(0, 60)] = String(v).slice(0, 5000);
    }
    const errors = submissionErrors(form, fields);
    if (errors && Object.keys(errors).length) return json(res, 400, { error: 'validation failed', fields: errors });
    fields.email = fields.email.trim().toLowerCase();
    const subs = readJson(SUBS_JSON, []);
    const sub = { id: crypto.randomBytes(8).toString('hex'), form, fields, at: new Date().toISOString(), lang: String(body.lang || 'en').slice(0, 5), page: String(body.page || '').slice(0, 200) };
    if (form === 'newsletter'){
      sub.consentAt = sub.at;
      sub.consentSource = 'footer-newsletter-form';
    }
    subs.push(sub);
    if (subs.length > 10000) subs.splice(0, subs.length - 10000);
    writeJsonAtomic(SUBS_JSON, subs);
    notify(sub, loadSite());
    return json(res, 200, { ok: true });
  }

  if (p === '/login' && method === 'POST'){
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (!loginLimiter(clientIp(req))) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes.' });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (!verifyPassword(body.password || '', ADMIN)) return json(res, 401, { error: 'Wrong password.' });
    const tok = sign({ exp: Date.now() + SESSION_TTL, v: ADMIN.createdAt, n: crypto.randomBytes(6).toString('hex') });
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(tok, SESSION_TTL / 1000, isSecure(req)) });
  }
  if (p === '/logout' && method === 'POST'){
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, isSecure(req)) });
  }

  /* ---- everything below needs a session ---- */
  if (!isAuthed(req)) return json(res, 401, { error: 'Not signed in.' });
  if (method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'forbidden' });

  if (p === '/media' && method === 'GET'){
    const items = loadMedia().sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
    return json(res, 200, items.map(mediaRecordForClient));
  }
  if (p === '/media' && method === 'POST'){
    if (!mediaUploadLimiter(clientIp(req))) return json(res, 429, { error: 'Too many uploads. Wait 10 minutes.' });
    const items = loadMedia();
    if (items.length >= MAX_MEDIA_ITEMS) return json(res, 409, { error: 'The media library limit of 500 images has been reached.' });
    let buffer;
    try { buffer = await readRawBody(req, MAX_MEDIA_ORIGINAL); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
    const info = imageInfo(buffer);
    if (!info) return json(res, 400, { error: 'Use a valid PNG, JPEG or WebP image. SVG files are not accepted.' });
    if (!mediaQuotaAllows(buffer.length)) return json(res, 409, { error: 'The 500 MB media-library limit would be exceeded.' });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    let id;
    do { id = crypto.randomBytes(8).toString('hex'); } while (items.some(item => item.id === id));
    const item = { id, name: cleanMediaName(url.searchParams.get('name')), alt: '', width: info.width, height: info.height,
      bytes: buffer.length, type: info.type, ext: info.ext, variants: [], variantTypes: {}, variantBytes: {},
      focal: { x: 0.5, y: 0.5 }, uploadedAt: new Date().toISOString() };
    try {
      writeBufferAtomic(mediaPath(item), buffer);
      items.push(item); saveMedia(items);
    } catch (e) {
      try { fs.rmSync(mediaPath(item), { force: true }); } catch (ignore) {}
      throw e;
    }
    return json(res, 201, { ok: true, item: mediaRecordForClient(item) });
  }
  const mediaVariant = p.match(/^\/media\/([a-f0-9]{16})\/variant$/);
  if (mediaVariant && method === 'POST'){
    if (!mediaUploadLimiter(clientIp(req))) return json(res, 429, { error: 'Too many uploads. Wait 10 minutes.' });
    const width = Number(url.searchParams.get('w'));
    if (!MEDIA_WIDTHS.includes(width)) return json(res, 400, { error: 'Variant width must be 480, 960 or 1600.' });
    const items = loadMedia(), item = items.find(value => value.id === mediaVariant[1]);
    if (!item) return json(res, 404, { error: 'Image not found.' });
    let buffer;
    try { buffer = await readRawBody(req, MAX_MEDIA_VARIANT); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
    const info = imageInfo(buffer);
    if (!info || !['image/webp', 'image/jpeg'].includes(info.type)) return json(res, 400, { error: 'Variants must be valid WebP or JPEG images.' });
    const file = variantPath(item.id, width);
    let replacing = 0; try { replacing = fs.statSync(file).size; } catch (e) {}
    if (!mediaQuotaAllows(buffer.length, replacing)) return json(res, 409, { error: 'The 500 MB media-library limit would be exceeded.' });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    writeBufferAtomic(file, buffer);
    if (!item.variants.includes(width)) item.variants.push(width);
    item.variants.sort((a, b) => a - b);
    item.variantTypes[String(width)] = info.type;
    item.variantBytes[String(width)] = buffer.length;
    saveMedia(items);
    return json(res, 200, { ok: true, item: mediaRecordForClient(item) });
  }
  const mediaItem = p.match(/^\/media\/([a-f0-9]{16})$/);
  if (mediaItem && method === 'PATCH'){
    const items = loadMedia(), item = items.find(value => value.id === mediaItem[1]);
    if (!item) return json(res, 404, { error: 'Image not found.' });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (!isPlain(body) || !['alt', 'name', 'focal'].some(key => key in body)) return json(res, 400, { error: 'Provide alt text, a name or a focal point.' });
    if ('alt' in body){ if (typeof body.alt !== 'string') return json(res, 400, { error: 'Alt text must be text.' }); item.alt = body.alt.trim().slice(0, 500); }
    if ('name' in body){ if (typeof body.name !== 'string') return json(res, 400, { error: 'Image name must be text.' }); item.name = cleanMediaName(body.name); }
    if ('focal' in body){
      if (!isPlain(body.focal) || !Number.isFinite(Number(body.focal.x)) || !Number.isFinite(Number(body.focal.y)) || Number(body.focal.x) < 0 || Number(body.focal.x) > 1 || Number(body.focal.y) < 0 || Number(body.focal.y) > 1){
        return json(res, 400, { error: 'Focal point coordinates must be between 0 and 1.' });
      }
      item.focal = cleanFocal(body.focal);
    }
    saveMedia(items);
    return json(res, 200, { ok: true, item: mediaRecordForClient(item) });
  }
  if (mediaItem && method === 'DELETE'){
    const items = loadMedia(), index = items.findIndex(value => value.id === mediaItem[1]);
    if (index < 0) return json(res, 404, { error: 'Image not found.' });
    const references = mediaReferences(mediaItem[1]);
    if (references.length) return json(res, 409, { error: 'This image is still in use.', references });
    const item = items[index];
    fs.rmSync(mediaPath(item), { force: true });
    MEDIA_WIDTHS.forEach(width => fs.rmSync(variantPath(item.id, width), { force: true }));
    items.splice(index, 1); saveMedia(items);
    return json(res, 200, { ok: true });
  }

  if (p === '/site' && method === 'PUT'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    /* the on-page editor may hold an unpublished draft; a direct save from the
       advanced dashboard would later be overwritten by it — make that explicit */
    const pending = readDraft();
    if (pending && body.force !== true) return json(res, 409, { error: 'An unpublished draft exists in the on-page editor.', code: 'draft-exists', savedAt: pending.savedAt });
    let site;
    try { site = validateSite(body); } catch (e) { return json(res, 400, { error: e.message }); }
    saveSite(site);
    return json(res, 200, { ok: true, site });
  }
  if (p === '/draft' && method === 'GET'){
    const record = readDraft();
    return json(res, 200, { draft: record ? record.draft : null, savedAt: record ? record.savedAt : null,
      baseUpdatedAt: record ? record.baseUpdatedAt : null, restoredFrom: record ? record.restoredFrom : null, live: loadSite() });
  }
  if (p === '/draft' && method === 'PUT'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    let draft;
    try { draft = validateSite(body); } catch (e) { return json(res, 400, { error: e.message }); }
    const savedAt = new Date().toISOString();
    /* remember which live version this draft was started from, so publish
       can refuse to silently overwrite a change made elsewhere meanwhile */
    const existing = readDraft();
    /* once a draft exists its base is fixed — a client reloading later must
       not be able to "refresh" it and hide a conflict */
    const baseUpdatedAt = (existing && existing.baseUpdatedAt)
      || (typeof body.baseUpdatedAt === 'string' ? body.baseUpdatedAt.slice(0, 40) : null)
      || loadSite().updatedAt || null;
    writeJsonAtomic(DRAFT_JSON, { savedAt, baseUpdatedAt, draft, restoredFrom: existing ? existing.restoredFrom : null });
    return json(res, 200, { ok: true, savedAt, baseUpdatedAt });
  }
  if (p === '/draft' && method === 'DELETE'){
    removeDraft();
    return json(res, 200, { ok: true });
  }
  if (p === '/publish' && method === 'POST'){
    let body = {};
    try { body = await readBody(req); } catch (e) { body = {}; }
    const record = readDraft();
    if (!record) return json(res, 409, { error: 'No draft to publish.', code: 'no-draft' });
    const live = loadSite();
    if (body.force !== true && record.baseUpdatedAt && live.updatedAt && record.baseUpdatedAt !== live.updatedAt){
      return json(res, 409, { error: 'The live site changed after this draft was started.', code: 'stale', baseUpdatedAt: record.baseUpdatedAt, liveUpdatedAt: live.updatedAt });
    }
    let site;
    try { site = validateSite(record.draft); } catch (e) { return json(res, 400, { error: e.message }); }
    const summary = publishSummary(live, site);
    saveSite(site);
    removeDraft();
    return json(res, 200, { ok: true, site, summary });
  }
  /* published-version history: list, and restore one INTO THE DRAFT (never
     straight to live — the owner reviews and publishes) */
  if (p === '/history' && method === 'GET'){
    const live = loadSite();
    return json(res, 200, listHistory().map(h => ({ id: h.id, archivedAt: h.archivedAt, publishedAt: h.publishedAt, changes: diffCount(live, h.site) })));
  }
  const restore = p.match(/^\/history\/([0-9TZ-]{10,40})\/restore$/);
  if (restore && method === 'POST'){
    const rec = listHistory().find(h => h.id === restore[1]);
    if (!rec) return json(res, 404, { error: 'No such version.' });
    let draft;
    try { draft = validateSite(rec.site); } catch (e) { return json(res, 400, { error: e.message }); }
    const savedAt = new Date().toISOString();
    writeJsonAtomic(DRAFT_JSON, { savedAt, baseUpdatedAt: loadSite().updatedAt || null, draft, restoredFrom: rec.id });
    return json(res, 200, { ok: true, savedAt, draft, restoredFrom: rec.id });
  }
  if (p === '/status' && method === 'GET'){
    return json(res, 200, { notifications: notifyConfig(), recovery: { emailSet: !!ADMIN.recoveryEmail, resendConfigured: !!process.env.RESEND_API_KEY },
      trustProxy: TRUST_PROXY, secure: isSecure(req), node: process.version });
  }
  if (p === '/account/recovery-email' && method === 'GET') return json(res, 200, { email: ADMIN.recoveryEmail || '', resendConfigured: !!process.env.RESEND_API_KEY });
  if (p === '/account/recovery-email' && method === 'POST'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (!verifyPassword(body.current || '', ADMIN)) return json(res, 401, { error: 'Current password is wrong.' });
    const email = String(body.email || '').trim().toLowerCase();
    if (email && !isEmail(email)) return json(res, 400, { error: 'Enter a valid recovery email.' });
    saveAdmin(Object.assign({}, ADMIN, { recoveryEmail: email, recovery: null }));
    return json(res, 200, { ok: true, email });
  }
  if (p === '/account/notifications' && method === 'GET'){
    const recipients = notificationRecipients();
    return json(res, 200, { emails: recipients.emails, source: recipients.source, resendConfigured: !!process.env.RESEND_API_KEY,
      webhookConfigured: /^https:\/\//i.test(process.env.NOTIFY_WEBHOOK_URL || '') });
  }
  if (p === '/account/notifications' && method === 'PUT'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (!Array.isArray(body.emails) || body.emails.length > 10) return json(res, 400, { error: 'Use a list of up to 10 email addresses.' });
    const raw = body.emails.map(value => String(value || '').trim().toLowerCase());
    if (raw.some(value => !isEmail(value))) return json(res, 400, { error: 'Every notification recipient must be a valid email address.' });
    saveAdmin(Object.assign({}, ADMIN, { notifyEmails: Array.from(new Set(raw)) }));
    const recipients = notificationRecipients();
    return json(res, 200, { ok: true, emails: recipients.emails, source: recipients.source, resendConfigured: !!process.env.RESEND_API_KEY,
      webhookConfigured: /^https:\/\//i.test(process.env.NOTIFY_WEBHOOK_URL || '') });
  }
  if (p === '/notify/test' && method === 'POST'){
    if (!notifyTestLimiter(clientIp(req))) return json(res, 429, { error: 'Too many test emails. Wait 10 minutes.' });
    const now = new Date().toISOString();
    const sample = { id: crypto.randomBytes(8).toString('hex'), form: 'test lead', at: now, page: '/admin', lang: 'en',
      fields: { name: 'OmniMark test lead', email: (loadSite().settings && loadSite().settings.email) || 'hello@example.test', company: 'Notification test', message: 'This is a test from the website editor. No action is needed.' } };
    try {
      const result = await sendLeadEmail(sample, loadSite());
      if (!result.ok) return json(res, 409, { error: 'Email notifications are not configured.' });
      return json(res, 200, { ok: true, delivered: true, recipients: result.recipients, source: result.source });
    } catch (e) {
      console.error('[notify] test email failed:', e.message);
      return json(res, 502, { error: 'The test email could not be delivered.' });
    }
  }
  if (p === '/pages' && method === 'GET'){
    return json(res, 200, listPages().map(pageInfo));
  }
  if (p === '/submissions' && method === 'GET'){
    return json(res, 200, readJson(SUBS_JSON, []).slice().reverse());
  }
  const del = p.match(/^\/submissions\/([a-f0-9]{16})$/);
  if (del && method === 'PATCH'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (typeof body.read !== 'boolean') return json(res, 400, { error: 'read must be true or false' });
    const subs = readJson(SUBS_JSON, []);
    const sub = subs.find(s => s.id === del[1]);
    if (!sub) return json(res, 404, { error: 'Submission not found.' });
    sub.read = body.read;
    writeJsonAtomic(SUBS_JSON, subs);
    return json(res, 200, { ok: true, submission: sub });
  }
  if (del && method === 'DELETE'){
    const subs = readJson(SUBS_JSON, []);
    const next = subs.filter(s => s.id !== del[1]);
    writeJsonAtomic(SUBS_JSON, next);
    return json(res, 200, { ok: true, removed: subs.length - next.length });
  }
  if (p === '/submissions' && method === 'DELETE'){
    writeJsonAtomic(SUBS_JSON, []);
    return json(res, 200, { ok: true });
  }
  if (p === '/password' && method === 'POST'){
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: e.message }); }
    if (!verifyPassword(body.current || '', ADMIN)) return json(res, 401, { error: 'Current password is wrong.' });
    const next = String(body.next || '');
    if (next.length < 8 || next.length > 200) return json(res, 400, { error: 'New password must be 8–200 characters.' });
    saveAdmin(Object.assign({}, ADMIN, hashPassword(next), { secret: crypto.randomBytes(32).toString('hex'), createdAt: new Date().toISOString(), recovery: null }));
    const tok = sign({ exp: Date.now() + SESSION_TTL, v: ADMIN.createdAt, n: crypto.randomBytes(6).toString('hex') });
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(tok, SESSION_TTL / 1000, isSecure(req)) });
  }
  return json(res, 404, { error: 'no such endpoint' });
}

/* ---------- public media + static files ---------- */
function serveMedia(req, res, url, rawUrl){
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  const rawPath = String(rawUrl || '').split('?')[0];
  if (/\.{2}|%2e|%2f|%5c/i.test(rawPath)) return send(res, 404, 'Not found');
  const match = url.pathname.match(/^\/media\/([a-f0-9]{16})(?:-(480|960|1600)\.webp|\.(png|jpg|webp))$/);
  if (!match) return send(res, 404, 'Not found');
  const item = loadMedia().find(value => value.id === match[1]);
  if (!item) return send(res, 404, 'Not found');
  let file, type;
  if (match[2]){
    const width = Number(match[2]);
    if (!item.variants.includes(width)) return send(res, 404, 'Not found');
    file = variantPath(item.id, width); type = item.variantTypes[String(width)] || 'image/webp';
  } else {
    if (match[3] !== item.ext) return send(res, 404, 'Not found');
    file = mediaPath(item); type = item.type;
  }
  let buffer;
  try { buffer = fs.readFileSync(file); } catch (e) { return send(res, 404, 'Not found'); }
  const headers = { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': buffer.length };
  return send(res, 200, req.method === 'HEAD' ? '' : buffer, headers);
}

function collectionRoute(pathname){
  const match = pathname.match(/^\/(work|insights|careers)\/([a-z0-9-]{2,60})\/?$/);
  if (!match) return null;
  const map = {
    work: { type: 'cases', template: 'case-study.html', key: 'case-study' },
    insights: { type: 'articles', template: 'article.html', key: 'article' },
    careers: { type: 'jobs', template: 'role-detail.html', key: 'role-detail' }
  };
  return Object.assign({ slug: match[2], path: '/' + match[1] + '/' + match[2] }, map[match[1]]);
}
function collectionTemplate(key){
  return { 'case-study': 'cases', article: 'articles', 'role-detail': 'jobs' }[key] || '';
}
function injectItemContext(html, context, cleanRoute){
  if (!context) return html;
  const payload = jsonLd({ type: context.type, item: context.item, templateKey: context.key, path: context.path });
  const script = '<script>window.OMNI_ITEM=' + payload + ';</script>\n';
  html = html.replace(/<script\s+src="data\/site\.js"><\/script>/i, script + '$&');
  if (cleanRoute && !/<base\s/i.test(html)) html = html.replace(/<head>/i, '<head>\n<base href="/">');
  return html;
}

function serveStatic(req, res, url){
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request'); }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/sitemap.xml' && !fs.existsSync(path.join(ROOT, 'sitemap.xml'))) writeSeoFiles(loadSite());

  const wantsEditor = url.searchParams.get('edit') === '1' && isAuthed(req);
  const draftRecord = wantsEditor ? readDraft() : null;
  let pageSite = draftRecord ? draftRecord.draft : loadSite();
  let itemContext = collectionRoute(pathname);
  const cleanItemRoute = !!itemContext;
  if (itemContext){
    const item = (effectiveCollections(pageSite)[itemContext.type] || []).find(value => value.slug === itemContext.slug);
    if (!item || (!item.published && !wantsEditor)){
      const nf = path.join(ROOT, '404.html');
      return send(res, 404, fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found', { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    }
    itemContext.item = item;
    pathname = '/' + itemContext.template;
  }

  let file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'Forbidden');
  const rel = path.relative(ROOT, file).split(path.sep);
  if (rel[0] === 'data' && (PRIVATE_FILES.has(rel[1]) || rel[1] === 'history' || rel[1] === 'media')) return send(res, 403, 'Forbidden');
  if (rel[0].startsWith('.') || rel[0] === 'node_modules' || rel[0] === 'server.js' || rel[0] === 'package.json') return send(res, 404, 'Not found');

  /* clean URLs: /about -> about.html */
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + '.html')) file += '.html';

  let stat;
  try { stat = fs.statSync(file); } catch (e) { stat = null; }
  if (stat && stat.isDirectory()){ file = path.join(file, 'index.html'); try { stat = fs.statSync(file); } catch (e) { stat = null; } }
  if (!stat){
    const nf = path.join(ROOT, '404.html');
    if (fs.existsSync(nf)) return send(res, 404, fs.readFileSync(nf), { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    return send(res, 404, 'Not found');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  if (ext === '.html'){
    const key = path.basename(file, '.html');
    if (!itemContext){
      const type = collectionTemplate(key);
      if (type){
        const items = effectiveCollections(pageSite)[type] || [];
        const slug = String(url.searchParams.get('item') || '');
        const item = slug ? items.find(value => value.slug === slug) : items.find(value => value.published) || (wantsEditor ? items[0] : null);
        if (slug && (!item || (!item.published && !wantsEditor))){
          const nf = path.join(ROOT, '404.html');
          return send(res, 404, fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found', { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        }
        if (item) itemContext = { type, item, key, path: collectionPath(type, item.slug) };
      }
    }
    let html = fs.readFileSync(file, 'utf8');
    html = injectItemContext(html, itemContext, cleanItemRoute);
    html = injectMeta(html, key, pageSite, itemContext);
    if (wantsEditor && !['admin', 'admin-advanced', '404'].includes(key)){
      html = html.replace(/<\/body>/i,
        '<link rel="stylesheet" href="css/editor.css">\n<script src="js/editor.js" defer></script>\n</body>');
    }
    return send(res, 200, html, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  }
  const cache = (rel[0] === 'data') ? 'no-cache' : 'public, max-age=300';
  send(res, 200, fs.readFileSync(file), { 'Content-Type': type, 'Cache-Control': cache });
}

/* ---------- boot ---------- */
function main(){
  fs.mkdirSync(DATA, { recursive: true });
  const boot = loadAdmin();
  ADMIN = boot.admin;
  if (!fs.existsSync(SITE_JSON)) saveSite(loadSite());
  else if (!fs.existsSync(SITE_JS)) fs.writeFileSync(SITE_JS, siteToJs(loadSite()));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (isSecure(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (url.pathname.startsWith('/api/') || url.pathname === '/api'){
      api(req, res, url).catch(err => { console.error(err); json(res, 500, { error: 'server error' }); });
      return;
    }
    const rawPath = String(req.url || '').split('?')[0];
    if (/^\/media(?:\/|$|%)/i.test(rawPath)) return serveMedia(req, res, url, req.url);
    try { serveStatic(req, res, url); } catch (err) { console.error(err); send(res, 500, 'Server error'); }
  });
  server.listen(PORT, HOST, () => {
    const base = 'http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT;
    console.log('OmniMark site   →  ' + base + '/');
    console.log('Admin dashboard →  ' + base + '/admin');
    const n = notifyConfig();
    const emailHint = n.emailSource === 'settings' ? 'set RESEND_API_KEY' : 'add recipients in Settings or set RESEND_API_KEY + NOTIFY_EMAIL_TO';
    console.log('Notifications   →  email ' + (n.email ? 'on' : 'off') + ' (' + n.emailSource + '), webhook ' + (n.webhook ? 'on' : 'off') + ', visitor acknowledgement ' + (n.autoReply ? 'on' : 'off') +
      (n.email || n.webhook ? '' : '   (' + emailHint + ' and/or NOTIFY_WEBHOOK_URL)'));
    if (boot.generated){
      console.log('\nFirst run: generated admin password  →  ' + boot.generated);
      console.log('Change it from Admin → Account. (Stored hashed in data/admin.json.)\n');
    }
  });
}
if (require.main === module) main();
module.exports = { validateSite, siteToJs, injectMeta, pageInfo };
