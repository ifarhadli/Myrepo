/* OmniMark admin dashboard. Talks to server.js (/api/*). Holds one draft
   copy of the site config (state.site) and diffs it against the last
   saved copy (state.saved); "Save & publish" PUTs the whole draft.
   Defaults come straight from data.js + i18n-data.js (loaded before this
   file) so the editor always shows real current values, and an untouched
   field stays "inherit from code" rather than becoming an override. */
(function(){
  'use strict';

  /* ---------- tiny helpers ---------- */
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function same(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function debounce(fn, ms){ var t; return function(){ var a = arguments; clearTimeout(t); t = setTimeout(function(){ fn.apply(null, a); }, ms); }; }
  function getPath(o, p){ return p.split('.').reduce(function(c, k){ return c == null ? undefined : c[k]; }, o); }
  function setPath(o, p, v){
    var parts = p.split('.'), cur = o;
    for (var i = 0; i < parts.length - 1; i++){
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  function delPath(o, p){
    var parts = p.split('.'), cur = o;
    for (var i = 0; i < parts.length - 1; i++){ cur = cur && cur[parts[i]]; if (!cur) return; }
    delete cur[parts[parts.length - 1]];
  }
  function flatten(o, prefix, out){
    out = out || {};
    for (var k in o){
      var v = o[k], key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object') flatten(v, key, out); else out[key] = v;
    }
    return out;
  }
  function fmtDate(iso){ if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString(); }
  var toastT;
  function toast(msg, kind){
    var el = $('#toast'); el.textContent = msg; el.className = 'toast show ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(function(){ el.className = 'toast'; }, 3200);
  }
  var confirmResolve = null, confirmReturnFocus = null;
  function confirmAction(message, actionLabel){
    var dialog = $('#confirmDialog');
    confirmReturnFocus = document.activeElement;
    $('#confirmMessage').textContent = message;
    $('#confirmProceed').textContent = actionLabel || 'Continue';
    if (dialog.open) dialog.close('cancel');
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise(function(resolve){ confirmResolve = resolve; });
  }
  $('#confirmDialog').addEventListener('close', function(){
    if (!confirmResolve) return;
    var resolve = confirmResolve; confirmResolve = null;
    var returnFocus = confirmReturnFocus; confirmReturnFocus = null;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    resolve(this.returnValue === 'confirm');
  });
  function bindPasswordToggles(root){
    $$('[data-password-toggle]', root || document).forEach(function(button){
      if (button.getAttribute('data-bound')) return;
      button.setAttribute('data-bound', '1');
      button.addEventListener('click', function(){
        var input = document.getElementById(button.getAttribute('data-password-toggle'));
        if (!input) return;
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.textContent = showing ? 'Show' : 'Hide';
        button.setAttribute('aria-pressed', String(!showing));
      });
    });
  }
  function api(method, path, body){
    return fetch(path, {
      method: method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'OmniAdmin' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* ---------- defaults from the code ---------- */
  var DEF = {
    engines: clone(window.OMNI_ENGINES || []),
    industries: clone(window.OMNI_INDUSTRIES || []),
    dict: window.OM_I18N || { en: {}, az: {} }
  };
  var FLAT_EN = flatten(DEF.dict.en || {});
  var FLAT_AZ = flatten(DEF.dict.az || {});
  var COPY_KEYS = Object.keys(FLAT_EN).filter(function(k){ return !/^(engines|industries)\./.test(k); });
  /* keys whose EN text contains markup — rendered with innerHTML on the site */
  var HTML_KEYS = {};
  COPY_KEYS.forEach(function(k){ if (/<[a-z][^>]*>|&[a-z]+;/i.test(FLAT_EN[k] || '')) HTML_KEYS[k] = true; });

  function enginesAzDefaults(){
    var azE = (DEF.dict.az && DEF.dict.az.engines) || {};
    return DEF.engines.map(function(e, i){
      var d = azE['e' + (i + 1)] || {};
      return {
        name: d.name || e.name, promise: d.promise || e.promise,
        groups: (e.groups || []).map(function(g, gi){
          var dg = (d.groups || [])[gi] || {};
          return { title: dg.title || g.title, items: (g.items || []).map(function(it, ii){ return (dg.items || [])[ii] || it; }) };
        })
      };
    });
  }
  function industriesAzDefaults(){
    var az = (DEF.dict.az && DEF.dict.az.industries) || [];
    return DEF.industries.map(function(x, i){ return az[i] || x; });
  }

  var DEFAULT_SITE = {
    version: 1, updatedAt: null,
    settings: { siteName: 'OmniMark', siteUrl: 'https://www.omnimark.com', defaultLang: 'en', email: 'hello@omnimark.com',
      phone: '+1 (800) 555-1234', phoneHref: '+18005551234', address: '400 Commerce St, Austin, TX 78701',
      addressLine1: '400 Commerce St', addressLine2: 'Austin, TX 78701', geoEmail: 'austin@omnimark.com',
      linkedin: 'https://www.linkedin.com', privacyUrl: '', termsUrl: '', schedulerUrl: '', ogImage: '', megaMenuLinkLimit: 4 },
    features: { langSwitch: true, newsletter: true, cookieBanner: true, careersButton: true, showVerifiedProof: false, customCursor: true,
      magneticButtons: true, kineticHeadlines: true, marquee: true, countUp: true, reveal: true },
    design: { tokens: {}, fontDisplay: 'Bricolage Grotesque', fontBody: 'Inter', fontMono: 'JetBrains Mono', customCss: '' },
    analytics: { gaId: '', consentScript: '' },
    structured: { orgLegalName: '', orgLogoUrl: '', articleAuthor: '', articleDatePublished: '', articleDateModified: '',
      jobTitle: '', jobDescription: '', jobDatePosted: '', jobValidThrough: '', jobEmploymentType: '', jobLocation: '', jobRemote: false, jobApplyUrl: '' },
    hiddenSections: [], pages: {}, i18n: { en: {}, az: {} },
    engines: null, enginesAz: null, industries: null, industriesAz: null
  };

  var TOKENS = [
    { k: '--ink', l: 'Ink — text, dark panels', d: '#0B0C10' },
    { k: '--paper', l: 'Paper — page background', d: '#F4F1EA' },
    { k: '--signal', l: 'Signal — primary buttons, highlights', d: '#C6F24E' },
    { k: '--signal-ink', l: 'Text on Signal', d: '#0B0C10' },
    { k: '--violet', l: 'Violet — links, focus, engine 01', d: '#4634F0' },
    { k: '--graphite', l: 'Graphite — muted text', d: '#5B616E' },
    { k: '--alert', l: 'Alert — errors', d: '#E2574C' },
    { k: '--c1', l: 'Engine 01 accent', d: '#4634F0' },
    { k: '--c2', l: 'Engine 02 accent', d: '#FF5B35' },
    { k: '--c3', l: 'Engine 03 accent', d: '#C6F24E' },
    { k: '--c4', l: 'Engine 04 accent', d: '#12D6C4' },
    { k: '--c5', l: 'Engine 05 accent', d: '#FF3E88' },
    { k: '--c1-on-light', l: 'Engine 01 text on light surfaces', d: '#4634F0' },
    { k: '--c2-on-light', l: 'Engine 02 text on light surfaces', d: '#A63218' },
    { k: '--c3-on-light', l: 'Engine 03 text on light surfaces', d: '#4D6500' },
    { k: '--c4-on-light', l: 'Engine 04 text on light surfaces', d: '#006F66' },
    { k: '--c5-on-light', l: 'Engine 05 text on light surfaces', d: '#B51457' },
    { k: '--c1-on-dark', l: 'Engine 01 text on dark surfaces', d: '#9A8CFF' },
    { k: '--alert-on-light', l: 'Error text on light surfaces', d: '#98291F' },
    { k: '--alert-on-dark', l: 'Error text on dark surfaces', d: '#FF8B82' },
    { k: '--surface', l: 'Cards / inputs', d: '#FFFFFF' },
    { k: '--surface-2', l: 'Secondary surface', d: '#EAE6DC' },
    { k: '--panel', l: 'Footer / dark panel background', d: '#0B0C10' },
    { k: '--panel-text', l: 'Dark panel text', d: '#F2EFE8' },
    { k: '--panel-muted', l: 'Dark panel muted text', d: '#9AA0AC' }
  ];
  var LAYOUT_TOKENS = [
    { k: '--radius', l: 'Card radius', d: '14px' },
    { k: '--radius-sm', l: 'Small radius', d: '8px' },
    { k: '--maxw', l: 'Content max width', d: '1280px' },
    { k: '--rhythm', l: 'Section spacing', d: '128px' },
    { k: '--dur', l: 'Transition duration', d: '260ms' }
  ];
  var FEATURES = [
    ['langSwitch', 'Language switcher (EN / AZ)', 'Hide it to run the site in the default language only.'],
    ['newsletter', 'Newsletter block in the footer', 'Sign-ups land in Submissions.'],
    ['cookieBanner', 'Cookie consent banner', 'Off = analytics loads for every visitor without asking. Your call, check local law.'],
    ['careersButton', '"Careers" button in the header', ''],
    ['showVerifiedProof', 'Show verified proof content', 'Keep off until every logo, statistic, testimonial and team profile has written owner approval.'],
    ['customCursor', 'Custom cursor dot + ring (desktop)', ''],
    ['magneticButtons', 'Magnetic pull on primary buttons', ''],
    ['kineticHeadlines', 'Word-by-word headline animation', ''],
    ['marquee', 'Scrolling client logo strip', ''],
    ['countUp', 'Animated statistics counters', ''],
    ['reveal', 'Fade-up on scroll', '']
  ];
  var SETTINGS_FIELDS = [
    ['siteName', 'Site name', 'text', 'Footer copyright and wordmark.'],
    ['siteUrl', 'Public site URL', 'url', 'Used for sitemap.xml and robots.txt. No trailing slash.'],
    ['email', 'Contact email', 'email', 'Footer, contact page, form error message.'],
    ['phone', 'Phone (display)', 'text', 'e.g. +1 (800) 555-1234'],
    ['phoneHref', 'Phone (dial)', 'text', 'Digits only, with country code: +18005551234'],
    ['address', 'Address (one line)', 'text', 'Footer and Markets page.'],
    ['addressLine1', 'Address line 1', 'text', 'Contact page.'],
    ['addressLine2', 'Address line 2', 'text', 'Contact page.'],
    ['geoEmail', 'Local office email', 'email', 'Markets page.'],
    ['linkedin', 'LinkedIn URL', 'url', ''],
    ['privacyUrl', 'Privacy policy URL', 'text', 'Footer link.'],
    ['termsUrl', 'Terms URL', 'text', 'Footer link.'],
    ['schedulerUrl', 'Meeting scheduler embed URL', 'url', 'Calendly / HubSpot Meetings / Chili Piper embed link (https). Leave empty and the scheduler block disappears from the contact page.'],
    ['megaMenuLinkLimit', 'Mega-menu links per engine', 'number', 'Show 1–12 sub-services in each desktop mega-menu column.', ' min="1" max="12" step="1"'],
    ['ogImage', 'Social share image URL or media ID', 'text', 'Shown when a page is shared on LinkedIn, Slack or WhatsApp. Use an https URL, or pick an image in the on-page editor.']
  ];

  /* ---------- state ---------- */
  var state = { site: null, saved: null, pages: [], subs: null, tab: 'overview', openEngines: {} };

  function normalize(site){
    site = Object.assign(clone(DEFAULT_SITE), site || {});
    site.settings = Object.assign(clone(DEFAULT_SITE.settings), site.settings || {});
    site.features = Object.assign(clone(DEFAULT_SITE.features), site.features || {});
    site.design = Object.assign(clone(DEFAULT_SITE.design), site.design || {});
    site.design.tokens = site.design.tokens || {};
    site.analytics = Object.assign(clone(DEFAULT_SITE.analytics), site.analytics || {});
    site.structured = Object.assign(clone(DEFAULT_SITE.structured), site.structured || {});
    site.hiddenSections = site.hiddenSections || [];
    site.pages = site.pages || {};
    site.i18n = site.i18n || {}; site.i18n.en = site.i18n.en || {}; site.i18n.az = site.i18n.az || {};
    return site;
  }
  function isDirty(){ return !same(state.site, state.saved); }
  var previewPush = debounce(function(){
    var f = $('#preview');
    if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'omni:preview', site: state.site }, location.origin);
  }, 120);
  function markDirty(){
    var d = isDirty();
    $('#dirty').textContent = d ? 'Unsaved changes' : '';
    $('#saveBtn').disabled = !d;
    $('#discardBtn').hidden = !d;
    previewPush();
  }

  /* engines / industries are "inherit from code" until first touched */
  function engines(){ return state.site.engines || DEF.engines; }
  function enginesAz(){ return state.site.enginesAz || enginesAzDefaults(); }
  function ensureEngines(){
    if (!state.site.engines){ state.site.engines = clone(DEF.engines); state.site.enginesAz = enginesAzDefaults(); }
    if (!state.site.enginesAz) state.site.enginesAz = enginesAzDefaults();
  }
  function industries(){ return state.site.industries || DEF.industries; }
  function industriesAz(){ return state.site.industriesAz || industriesAzDefaults(); }
  function ensureIndustries(){
    if (!state.site.industries){ state.site.industries = clone(DEF.industries); state.site.industriesAz = industriesAzDefaults(); }
    if (!state.site.industriesAz) state.site.industriesAz = industriesAzDefaults();
  }

  /* ---------- generic input binding: [data-bind="a.b.c"] ---------- */
  function bindInputs(root){
    $$('[data-bind]', root).forEach(function(el){
      var v = getPath(state.site, el.getAttribute('data-bind'));
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
      el.addEventListener('input', function(){
        setPath(state.site, el.getAttribute('data-bind'), el.type === 'checkbox' ? el.checked : el.value);
        markDirty();
      });
    });
  }

  /* ---------- programmatic labels for every control in a rendered panel:
     .field label → for/id; otherwise an aria-label built from the key,
     language and context so screen readers get more than a placeholder ---------- */
  var uid = 0;
  function labelize(root){
    $$('input,select,textarea', root).forEach(function(el){
      if (el.type === 'hidden' || el.type === 'file') return;
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')) return;
      if (el.id && root.querySelector('label[for="' + el.id + '"]')) return;
      var field = el.closest('.field'), lab = field && field.querySelector('label');
      if (lab && !lab.getAttribute('for')){
        if (!el.id) el.id = 'ctl-' + (++uid);
        lab.setAttribute('for', el.id);
        return;
      }
      var text = '', lang = el.getAttribute('data-lang') === 'az' ? 'Azerbaijani' : 'English';
      var key = el.getAttribute('data-key');
      if (key) text = key + ' (' + lang + ')';
      else if (el.hasAttribute('data-ind')) text = 'Industry ' + (+el.getAttribute('data-ind') + 1) + ' (English)';
      else if (el.hasAttribute('data-indaz')) text = 'Industry ' + (+el.getAttribute('data-indaz') + 1) + ' (Azerbaijani)';
      else {
        var d = el.closest('details'), sum = d && d.querySelector('summary');
        text = (sum ? sum.textContent.replace(/\s+/g, ' ').trim() + ' — ' : '') + (el.getAttribute('placeholder') || el.name || 'value');
      }
      el.setAttribute('aria-label', text);
    });
  }

  /* ================= TABS ================= */
  var TABS = {
    overview: { title: 'Overview', render: renderOverview },
    design: { title: 'Design', render: renderDesign },
    content: { title: 'Copy & translations', render: renderContent },
    services: { title: 'Services catalogue', render: renderServices },
    industries: { title: 'Industries', render: renderIndustries },
    pages: { title: 'Pages & SEO', render: renderPages },
    settings: { title: 'Settings', render: renderSettings },
    submissions: { title: 'Submissions', render: renderSubmissions },
    account: { title: 'Account & backup', render: renderAccount }
  };
  function showTab(id){
    if (!TABS[id]) id = 'overview';
    state.tab = id;
    $$('.side nav button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-tab') === id); });
    $('#tabTitle').textContent = TABS[id].title;
    var panel = $('#panel'); panel.innerHTML = '';
    TABS[id].render(panel);
    labelize(panel);
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    window.scrollTo(0, 0);
  }

  /* ---------- overview ---------- */
  function renderOverview(panel){
    var s = state.site, todo = [];
    if (!s.settings.siteUrl || /omnimark\.com/.test(s.settings.siteUrl)) todo.push(['settings', 'Set the real public site URL (sitemap + robots use it).']);
    if (/555-1234/.test(s.settings.phone || '')) todo.push(['settings', 'Replace the placeholder phone number.']);
    if (s.settings.privacyUrl === '#' || s.settings.termsUrl === '#') todo.push(['settings', 'Link a real Privacy Policy and Terms page.']);
    if (!s.analytics.gaId && !s.analytics.consentScript) todo.push(['settings', 'Add a Google Analytics ID (optional).']);
    if (!s.features.showVerifiedProof) todo.push(['settings', 'Verify logos, statistics, testimonials and team profiles, then enable “Show verified proof content”.']);
    if (!s.structured.articleAuthor || !s.structured.articleDatePublished) todo.push(['settings', 'Add the published article author and date to enable Article structured data.']);
    var jobKeys = ['jobTitle', 'jobDescription', 'jobDatePosted', 'jobValidThrough', 'jobEmploymentType', 'jobLocation', 'jobApplyUrl'];
    var anyJob = jobKeys.some(function(k){ return !!s.structured[k]; });
    if (anyJob && !jobKeys.every(function(k){ return !!s.structured[k]; })) todo.push(['settings', 'Finish every job schema field, or clear the draft fields; partial JobPosting data is not published.']);
    var overrides = Object.keys(s.i18n.en).length + Object.keys(s.i18n.az).length;
    panel.innerHTML =
      '<div class="grid3">' +
        '<div class="stat"><div class="n" id="ovSubs">…</div><div class="l">Form submissions</div></div>' +
        '<div class="stat"><div class="n">' + overrides + '</div><div class="l">Copy overrides</div></div>' +
        '<div class="stat"><div class="n" style="font-size:16px;margin-top:6px">' + esc(fmtDate(s.updatedAt)) + '</div><div class="l">Last published</div></div>' +
      '</div>' +
      '<div class="grid2" style="margin-top:18px">' +
        '<div class="card"><h2>How this works</h2>' +
          '<p class="muted">Everything you change here is a draft until you press <b>Save &amp; publish</b>. Publishing writes <code>data/site.json</code> and <code>data/site.js</code>; every page loads that file and applies your design, copy and settings on top of the code defaults.</p>' +
          '<p class="muted">Fields left untouched keep inheriting from the code, so a developer can still change defaults without fighting the dashboard.</p>' +
          '<ul class="muted small"><li><b>Design</b> — colours, fonts, spacing, motion, custom CSS, with live preview.</li><li><b>Copy &amp; translations</b> — every dictionary string in English and Azerbaijani (a handful of figures, names and logos still live in the page HTML).</li><li><b>Services catalogue</b> — the five engines and their sub-services (mega-menu, drawer, footer and both accordions all follow).</li><li><b>Pages &amp; SEO</b> — titles, descriptions, show/hide sections.</li><li><b>Submissions</b> — contact, teardown and newsletter forms.</li></ul>' +
        '</div>' +
        '<div class="card"><h2>Launch checklist</h2>' + (todo.length ?
          '<ul>' + todo.map(function(t){ return '<li><button type="button" class="link-button" data-goto="' + t[0] + '">' + esc(t[1]) + '</button></li>'; }).join('') + '</ul>' :
          '<p class="muted">Nothing outstanding.</p>') +
          '<h2 style="margin-top:18px">Deploy</h2><p class="muted small">Run <code>node server.js</code> on the host to serve the site with this admin. Or copy the folder to any static host — the last published <code>data/site.js</code> ships with it (forms then need the server to be reachable).</p>' +
          '<h2 style="margin-top:18px">Form notifications</h2><p class="muted small" id="ovNotify">Checking…</p>' +
        '</div>' +
      '</div>';
    api('GET', 'api/submissions').then(function(list){ $('#ovSubs').textContent = list.length; updateSubsPill(list.length); }).catch(function(){ $('#ovSubs').textContent = '—'; });
    api('GET', 'api/status').then(function(st){
      var n = st.notifications || {}, el = $('#ovNotify');
      if (!el) return;
      if (n.email || n.webhook){
        var source = n.emailSource === 'settings' ? 'private editor settings' : n.emailSource === 'env' ? '<code>NOTIFY_EMAIL_TO</code>' : 'none';
        el.innerHTML = 'Every submission is forwarded: <b>email ' + (n.email ? 'on' : 'off') + '</b> (source: ' + source + '), <b>webhook ' + (n.webhook ? 'on' : 'off') + '</b>. Visitor acknowledgements: <b>' + (n.autoReply ? 'on' : 'off') + '</b>. Submissions are also kept in the dashboard.';
      } else {
        var emailSetup = n.emailSource === 'settings' ? 'Set <code>RESEND_API_KEY</code> to activate the private recipient list' : 'add recipients in editor Settings or set <code>RESEND_API_KEY</code> + <code>NOTIFY_EMAIL_TO</code>';
        el.innerHTML = '<span style="color:var(--a-alert);font-weight:600">Not configured</span> — nobody is notified when a form comes in; you must check the Submissions tab. For email, ' + emailSetup + '; for Slack / Zapier / CRM, set <code>NOTIFY_WEBHOOK_URL</code>. Visitor acknowledgements are <b>' + (n.autoReply ? 'on' : 'off') + '</b>.';
      }
    }).catch(function(){});
  }

  /* ---------- design ---------- */
  function isHex(v){ return /^#[0-9a-f]{6}$/i.test(v || ''); }
  function tokenCard(tk, color){
    var val = state.site.design.tokens[tk.k] || '';
    var hex = isHex(val) ? val : (isHex(tk.d) ? tk.d : '#000000');
    return '<div class="token' + (val ? ' changed' : '') + '" data-token-card="' + tk.k + '">' +
      '<span class="lbl">' + esc(tk.l) + ' <code>' + tk.k + '</code></span>' +
      '<div class="row">' +
        (color ? '<input type="color" value="' + hex + '" data-token-color="' + tk.k + '" aria-label="' + esc(tk.l) + ' colour">' : '') +
        '<input type="text" value="' + esc(val) + '" placeholder="' + esc(tk.d) + '" data-token-text="' + tk.k + '" aria-label="' + esc(tk.l) + '">' +
        '<button class="btn icon" title="Reset to default" data-token-reset="' + tk.k + '">↺</button>' +
      '</div></div>';
  }
  function renderDesign(panel){
    var fonts = Object.keys((window.OmniSite && window.OmniSite.fontCatalog) || {});
    function fontSel(bind, label){
      var cur = getPath(state.site, bind);
      return '<div class="field"><label>' + label + '</label><select data-bind="' + bind + '">' +
        fonts.map(function(f){ return '<option' + (f === cur ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select></div>';
    }
    panel.innerHTML =
      '<div class="grid2">' +
        '<div>' +
          '<div class="card"><h2>Colours</h2><p class="muted small">Leave a field empty to keep the default. Hex, rgb() or any CSS colour works.</p>' +
            '<div class="tokens">' + TOKENS.map(function(t){ return tokenCard(t, true); }).join('') + '</div></div>' +
          '<div class="card"><h2>Layout &amp; timing</h2><div class="tokens">' + LAYOUT_TOKENS.map(function(t){ return tokenCard(t, false); }).join('') + '</div></div>' +
          '<div class="card"><h2>Fonts</h2><div class="grid3">' +
            fontSel('design.fontDisplay', 'Headlines') + fontSel('design.fontBody', 'Body') + fontSel('design.fontMono', 'Labels / mono') +
          '</div><p class="muted small">Loaded from Google Fonts. Default: Bricolage Grotesque / Inter / JetBrains Mono.</p></div>' +
          '<div class="card"><h2>Motion &amp; effects</h2><div class="switch-list">' +
            FEATURES.filter(function(f){ return ['customCursor', 'magneticButtons', 'kineticHeadlines', 'marquee', 'countUp', 'reveal'].indexOf(f[0]) >= 0; })
              .map(function(f){ return '<label class="check"><input type="checkbox" data-bind="features.' + f[0] + '"><span>' + esc(f[1]) + (f[2] ? '<div class="d">' + esc(f[2]) + '</div>' : '') + '</span></label>'; }).join('') +
          '</div></div>' +
          '<div class="card"><h2>Custom CSS</h2><p class="muted small">Injected last on every page, so it beats everything in <code>style.css</code>. Use the site\'s class names, e.g. <code>.hero h1{font-size:72px}</code>.</p>' +
            '<div class="field"><textarea class="code resize-none" data-bind="design.customCss" spellcheck="false" placeholder="/* your CSS */"></textarea></div></div>' +
        '</div>' +
        '<div class="preview-wrap">' +
          '<div class="preview-bar"><select id="previewPage" aria-label="Preview page">' +
            (state.pages.length ? state.pages : [{ file: 'index.html', title: 'Home' }]).map(function(p){ return '<option value="' + esc(p.file) + '">' + esc(p.title || p.file) + '</option>'; }).join('') +
          '</select><button class="btn sm" id="previewReload">Reload</button></div>' +
          '<iframe id="preview" class="preview" src="index.html" title="Live preview"></iframe>' +
          '<p class="muted small" style="margin-top:8px">Colours, fonts, hidden sections and custom CSS preview instantly. Copy and catalogue changes show after you save and reload.</p>' +
        '</div>' +
      '</div>';
    bindInputs(panel);
    panel.addEventListener('input', function(e){
      var el = e.target, k;
      if ((k = el.getAttribute('data-token-color'))){
        state.site.design.tokens[k] = el.value;
        $('[data-token-text="' + k + '"]', panel).value = el.value;
      } else if ((k = el.getAttribute('data-token-text'))){
        if (el.value.trim()) state.site.design.tokens[k] = el.value.trim(); else delete state.site.design.tokens[k];
        var c = $('[data-token-color="' + k + '"]', panel);
        if (c && isHex(el.value.trim())) c.value = el.value.trim();
      } else return;
      $('[data-token-card="' + k + '"]', panel).classList.toggle('changed', !!state.site.design.tokens[k]);
      markDirty();
    });
    panel.addEventListener('click', function(e){
      var b = e.target.closest('[data-token-reset]');
      if (!b) return;
      var k = b.getAttribute('data-token-reset');
      delete state.site.design.tokens[k];
      $('[data-token-text="' + k + '"]', panel).value = '';
      var tk = TOKENS.concat(LAYOUT_TOKENS).filter(function(t){ return t.k === k; })[0];
      var c = $('[data-token-color="' + k + '"]', panel);
      if (c && tk && isHex(tk.d)) c.value = tk.d;
      $('[data-token-card="' + k + '"]', panel).classList.remove('changed');
      markDirty();
    });
    var frame = $('#preview');
    frame.addEventListener('load', function(){ previewPush(); });
    $('#previewPage').addEventListener('change', function(){ frame.src = this.value; });
    $('#previewReload').addEventListener('click', function(){ frame.src = frame.src; });
  }

  /* ---------- copy & translations ---------- */
  function renderContent(panel){
    var namespaces = [];
    COPY_KEYS.forEach(function(k){ var ns = k.split('.')[0]; if (namespaces.indexOf(ns) < 0) namespaces.push(ns); });
    panel.innerHTML =
      '<div class="notice">Every string on the site, in both languages. Empty a field to fall back to the code default. Strings marked <span class="tag">html</span> may contain links or line breaks — keep the tags intact.</div>' +
      '<div class="toolbar"><input type="search" id="copySearch" placeholder="Search keys or text…">' +
        '<select id="copyNs" aria-label="Section"><option value="">All sections</option>' + namespaces.map(function(n){ return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select>' +
        '<label class="small"><input type="checkbox" id="copyChanged"> Only changed</label><span class="muted small" id="copyCount"></span></div>' +
      '<div class="head-i18n"><span class="lbl">Key</span><span class="lbl">English</span><span class="lbl">Azərbaycan</span></div>' +
      '<div id="copyList"></div>';
    var list = $('#copyList');
    function rowHtml(k){
      var ov = state.site.i18n, en = ov.en[k], az = ov.az[k];
      var changed = en != null || az != null;
      return '<div class="row-i18n' + (changed ? ' changed' : '') + '" data-row="' + esc(k) + '">' +
        '<div class="key"><span>' + esc(k) + '</span>' + (HTML_KEYS[k] ? '<span class="html">html</span>' : '') + (changed ? '<button class="btn icon" data-reset-row="' + esc(k) + '">↺ reset</button>' : '') + '</div>' +
        '<textarea class="resize-none" data-lang="en" data-key="' + esc(k) + '" placeholder="' + esc(FLAT_EN[k] || '') + '">' + esc(en != null ? en : (FLAT_EN[k] || '')) + '</textarea>' +
        '<textarea class="resize-none" data-lang="az" data-key="' + esc(k) + '" placeholder="' + esc(FLAT_AZ[k] || '') + '">' + esc(az != null ? az : (FLAT_AZ[k] || '')) + '</textarea>' +
      '</div>';
    }
    function draw(){
      var q = ($('#copySearch').value || '').toLowerCase(), ns = $('#copyNs').value, only = $('#copyChanged').checked;
      var rows = COPY_KEYS.filter(function(k){
        if (ns && k.split('.')[0] !== ns) return false;
        if (only && state.site.i18n.en[k] == null && state.site.i18n.az[k] == null) return false;
        if (!q) return true;
        var en = state.site.i18n.en[k] != null ? state.site.i18n.en[k] : FLAT_EN[k];
        var az = state.site.i18n.az[k] != null ? state.site.i18n.az[k] : FLAT_AZ[k];
        return k.toLowerCase().indexOf(q) >= 0 || String(en).toLowerCase().indexOf(q) >= 0 || String(az).toLowerCase().indexOf(q) >= 0;
      });
      var html = '', lastNs = '';
      rows.slice(0, 600).forEach(function(k){
        var n = k.split('.')[0];
        if (n !== lastNs){ html += '<div class="ns-title">' + esc(n) + '</div>'; lastNs = n; }
        html += rowHtml(k);
      });
      list.innerHTML = html || '<div class="empty">No strings match.</div>';
      $('#copyCount').textContent = rows.length + ' of ' + COPY_KEYS.length + (rows.length > 600 ? ' (showing first 600 — narrow the search)' : '');
      labelize(list);
    }
    draw();
    ['input', 'change'].forEach(function(ev){ $('#copySearch').addEventListener(ev, debounce(draw, 150)); });
    $('#copyNs').addEventListener('change', draw);
    $('#copyChanged').addEventListener('change', draw);
    list.addEventListener('input', function(e){
      var ta = e.target;
      if (!ta.matches('textarea[data-key]')) return;
      var k = ta.getAttribute('data-key'), lang = ta.getAttribute('data-lang');
      var def = lang === 'en' ? FLAT_EN[k] : FLAT_AZ[k];
      if (ta.value === def || ta.value === '') delete state.site.i18n[lang][k]; else state.site.i18n[lang][k] = ta.value;
      var row = ta.closest('.row-i18n');
      var changed = state.site.i18n.en[k] != null || state.site.i18n.az[k] != null;
      row.classList.toggle('changed', changed);
      markDirty();
    });
    list.addEventListener('click', function(e){
      var b = e.target.closest('[data-reset-row]');
      if (!b) return;
      var k = b.getAttribute('data-reset-row');
      delete state.site.i18n.en[k]; delete state.site.i18n.az[k];
      b.closest('.row-i18n').outerHTML = rowHtml(k);
      labelize(list);
      markDirty();
    });
  }

  /* ---------- services catalogue ---------- */
  var ENGINE_COLORS = ['#4634F0', '#FF5B35', '#C6F24E', '#12D6C4', '#FF3E88', '#999', '#999', '#999'];
  function renderServices(panel){
    var en = engines(), az = enginesAz();
    var html = '<div class="notice">One catalogue feeds the mega-menu, mobile drawer, footer, the home accordion and the services page. <b>Explore page</b> is where the accordion\'s "Explore the engine" link goes; <b>View-all link</b> is used by the mega-menu and footer.</div>';
    en.forEach(function(e, i){
      var a = az[i] || {};
      var open = state.openEngines[i] || (i === 0 && !Object.keys(state.openEngines).length);
      html += '<details class="eng" data-eng-idx="' + i + '"' + (open ? ' open' : '') + '><summary><span class="sw" style="background:' + ENGINE_COLORS[i] + '"></span><span class="num">' + esc(e.num) + '</span>' + esc(e.name) + '<span class="muted" style="font-weight:400;margin-left:auto">' + esc(e.codename || '') + '</span></summary><div class="body">' +
        '<div class="g2">' +
          '<div class="field"><label>Name (EN)</label><input data-eng="' + i + '.name" value="' + esc(e.name) + '"></div>' +
          '<div class="field"><label>Name (AZ)</label><input data-engaz="' + i + '.name" value="' + esc(a.name || '') + '"></div>' +
          '<div class="field"><label>Promise (EN)</label><textarea class="resize-none" data-eng="' + i + '.promise">' + esc(e.promise) + '</textarea></div>' +
          '<div class="field"><label>Promise (AZ)</label><textarea class="resize-none" data-engaz="' + i + '.promise">' + esc(a.promise || '') + '</textarea></div>' +
          '<div class="field"><label>Codename</label><input data-eng="' + i + '.codename" value="' + esc(e.codename || '') + '"></div>' +
          '<div class="field"><label>Number</label><input data-eng="' + i + '.num" value="' + esc(e.num) + '"></div>' +
          '<div class="field"><label>View-all link</label><input data-eng="' + i + '.href" value="' + esc(e.href) + '"><div class="hint">e.g. services.html#engine-02</div></div>' +
          '<div class="field"><label>Explore page</label><input data-eng="' + i + '.detail" value="' + esc(e.detail || '') + '"><div class="hint">e.g. sub-service.html</div></div>' +
        '</div>';
      (e.groups || []).forEach(function(g, gi){
        var ag = (a.groups || [])[gi] || {};
        html += '<div class="group"><div class="grow">' +
          '<input data-eng="' + i + '.groups.' + gi + '.title" value="' + esc(g.title) + '" placeholder="Group title (EN)">' +
          '<input data-engaz="' + i + '.groups.' + gi + '.title" value="' + esc(ag.title || '') + '" placeholder="Qrup adı (AZ)">' +
          '<div class="acts"><button class="btn icon danger" data-del-group="' + i + '.' + gi + '" title="Remove group">✕</button></div></div>';
        (g.items || []).forEach(function(it, ii){
          html += '<div class="item">' +
            '<input data-eng="' + i + '.groups.' + gi + '.items.' + ii + '" value="' + esc(it) + '" placeholder="Service (EN)">' +
            '<input data-engaz="' + i + '.groups.' + gi + '.items.' + ii + '" value="' + esc((ag.items || [])[ii] || '') + '" placeholder="Xidmət (AZ)">' +
            '<div class="acts"><button class="btn icon" data-move="' + i + '.' + gi + '.' + ii + '.-1" title="Move up">↑</button><button class="btn icon" data-move="' + i + '.' + gi + '.' + ii + '.1" title="Move down">↓</button><button class="btn icon danger" data-del-item="' + i + '.' + gi + '.' + ii + '" title="Remove">✕</button></div></div>';
        });
        html += '<button class="btn sm" data-add-item="' + i + '.' + gi + '">+ Add service</button></div>';
      });
      html += '<div style="margin-top:12px"><button class="btn sm" data-add-group="' + i + '">+ Add group</button></div></div></details>';
    });
    html += '<div class="card tight" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span class="muted small">' + (state.site.engines ? 'Catalogue is customised.' : 'Catalogue is inheriting the code defaults.') + '</span><button class="btn danger sm" id="resetEngines"' + (state.site.engines ? '' : ' disabled') + '>Reset catalogue to defaults</button></div>';
    panel.innerHTML = html;
    labelize(panel);

    panel.addEventListener('toggle', function(e){
      var d = e.target.closest && e.target.closest('details.eng');
      if (d) state.openEngines[d.getAttribute('data-eng-idx')] = d.open;
    }, true);
    panel.addEventListener('input', function(e){
      var el = e.target, p;
      if ((p = el.getAttribute('data-eng'))){ ensureEngines(); setPath(state.site.engines, p, el.value); }
      else if ((p = el.getAttribute('data-engaz'))){ ensureEngines(); setPath(state.site.enginesAz, p, el.value); }
      else return;
      markDirty();
    });
    panel.addEventListener('click', async function(e){
      var b = e.target.closest('button'); if (!b) return;
      var v, parts;
      if (b.id === 'resetEngines'){
        if (!await confirmAction('Discard all catalogue edits and go back to the code defaults?', 'Discard edits')) return;
        state.site.engines = null; state.site.enginesAz = null;
      } else if ((v = b.getAttribute('data-add-item'))){
        ensureEngines(); parts = v.split('.').map(Number);
        state.site.engines[parts[0]].groups[parts[1]].items.push('New service');
        state.site.enginesAz[parts[0]].groups[parts[1]].items.push('Yeni xidmət');
      } else if ((v = b.getAttribute('data-del-item'))){
        ensureEngines(); parts = v.split('.').map(Number);
        state.site.engines[parts[0]].groups[parts[1]].items.splice(parts[2], 1);
        state.site.enginesAz[parts[0]].groups[parts[1]].items.splice(parts[2], 1);
      } else if ((v = b.getAttribute('data-move'))){
        ensureEngines(); parts = v.split('.').map(Number);
        var to = parts[2] + parts[3];
        [state.site.engines, state.site.enginesAz].forEach(function(arr){
          var items = arr[parts[0]].groups[parts[1]].items;
          if (to < 0 || to >= items.length) return;
          var tmp = items[parts[2]]; items[parts[2]] = items[to]; items[to] = tmp;
        });
      } else if ((v = b.getAttribute('data-add-group'))){
        ensureEngines();
        state.site.engines[+v].groups.push({ title: 'New group', items: [] });
        state.site.enginesAz[+v].groups.push({ title: 'Yeni qrup', items: [] });
      } else if ((v = b.getAttribute('data-del-group'))){
        if (!await confirmAction('Remove this group and its services?', 'Remove group')) return;
        ensureEngines(); parts = v.split('.').map(Number);
        state.site.engines[parts[0]].groups.splice(parts[1], 1);
        state.site.enginesAz[parts[0]].groups.splice(parts[1], 1);
      } else return;
      markDirty();
      renderServices(panel);
    });
  }

  /* ---------- industries ---------- */
  function renderIndustries(panel){
    var en = industries(), az = industriesAz();
    panel.innerHTML =
      '<div class="notice">Shown in the header dropdown, the mobile drawer and the industries strip. Every entry links to <code>industry.html</code>.</div>' +
      '<div class="card">' + en.map(function(x, i){
        return '<div class="ind"><span class="idx">' + (i + 1) + '</span><input data-ind="' + i + '" value="' + esc(x) + '" placeholder="EN"><input data-indaz="' + i + '" value="' + esc(az[i] || '') + '" placeholder="AZ">' +
          '<div class="acts"><button class="btn icon" data-imove="' + i + '.-1">↑</button><button class="btn icon" data-imove="' + i + '.1">↓</button><button class="btn icon danger" data-idel="' + i + '">✕</button></div></div>';
      }).join('') +
      '<button class="btn sm" id="addInd" style="margin-top:8px">+ Add industry</button></div>' +
      '<div class="card tight" style="display:flex;justify-content:space-between;align-items:center"><span class="muted small">' + (state.site.industries ? 'List is customised.' : 'List is inheriting the code defaults.') + '</span><button class="btn danger sm" id="resetInd"' + (state.site.industries ? '' : ' disabled') + '>Reset to defaults</button></div>';
    labelize(panel);
    panel.addEventListener('input', function(e){
      var el = e.target, i;
      if ((i = el.getAttribute('data-ind')) != null){ ensureIndustries(); state.site.industries[+i] = el.value; }
      else if ((i = el.getAttribute('data-indaz')) != null){ ensureIndustries(); state.site.industriesAz[+i] = el.value; }
      else return;
      markDirty();
    });
    panel.addEventListener('click', async function(e){
      var b = e.target.closest('button'); if (!b) return;
      var v;
      if (b.id === 'addInd'){ ensureIndustries(); state.site.industries.push('New industry'); state.site.industriesAz.push('Yeni sahə'); }
      else if (b.id === 'resetInd'){ if (!await confirmAction('Discard industry edits?', 'Discard edits')) return; state.site.industries = null; state.site.industriesAz = null; }
      else if ((v = b.getAttribute('data-idel')) != null){ ensureIndustries(); state.site.industries.splice(+v, 1); state.site.industriesAz.splice(+v, 1); }
      else if ((v = b.getAttribute('data-imove'))){
        ensureIndustries(); var p = v.split('.').map(Number), to = p[0] + p[1];
        [state.site.industries, state.site.industriesAz].forEach(function(arr){ if (to < 0 || to >= arr.length) return; var t = arr[p[0]]; arr[p[0]] = arr[to]; arr[to] = t; });
      } else return;
      markDirty(); renderIndustries(panel);
    });
  }

  /* ---------- pages & SEO ---------- */
  function renderPages(panel){
    if (!state.pages.length){ panel.innerHTML = '<div class="empty">Could not load the page list from the server.</div>'; return; }
    panel.innerHTML = '<div class="notice">Titles and descriptions are injected server-side (and by JS on static hosts). Untick a section to hide it — the markup stays in the file, so it is one click to bring back.</div>' +
      state.pages.map(function(p){
        var ov = state.site.pages[p.key] || {};
        return '<div class="card page-card"><h2>' + esc(p.title || p.key) + ' <code>' + esc(p.file) + '</code> <a class="small" href="' + esc(p.file) + '" target="_blank" rel="noopener">open ↗</a></h2>' +
          '<div class="g2 grid2">' +
            '<div class="field"><label>Browser / search title</label><input type="text" data-page="' + esc(p.key) + '.title" value="' + esc(ov.title || '') + '" placeholder="' + esc(p.title) + '"></div>' +
            '<div class="field"><label>Meta description</label><textarea class="resize-none" data-page="' + esc(p.key) + '.description" placeholder="' + esc(p.description) + '">' + esc(ov.description || '') + '</textarea></div>' +
          '</div>' +
          (p.sections.length ? '<h3>Sections</h3><div class="sections">' + p.sections.map(function(s){
            var hidden = state.site.hiddenSections.indexOf(s.key) >= 0;
            return '<label class="check"><input type="checkbox" data-section="' + esc(s.key) + '"' + (hidden ? '' : ' checked') + '><span>' + esc(s.label) + ' <span class="muted small">' + esc(s.key) + '</span></span></label>';
          }).join('') + '</div>' : '') +
        '</div>';
      }).join('');
    panel.addEventListener('input', function(e){
      var el = e.target, p = el.getAttribute('data-page');
      if (!p) return;
      var i = p.indexOf('.'), key = p.slice(0, i), field = p.slice(i + 1);
      state.site.pages[key] = state.site.pages[key] || {};
      if (el.value.trim()) state.site.pages[key][field] = el.value; else delete state.site.pages[key][field];
      if (!Object.keys(state.site.pages[key]).length) delete state.site.pages[key];
      markDirty();
    });
    panel.addEventListener('change', function(e){
      var el = e.target, s = el.getAttribute('data-section');
      if (!s) return;
      var list = state.site.hiddenSections, i = list.indexOf(s);
      if (el.checked && i >= 0) list.splice(i, 1);
      if (!el.checked && i < 0) list.push(s);
      markDirty();
    });
  }

  /* ---------- settings ---------- */
  function renderSettings(panel){
    panel.innerHTML =
      '<div class="grid2">' +
        '<div><div class="card"><h2>Contact &amp; links</h2>' +
          SETTINGS_FIELDS.map(function(f){ return '<div class="field"><label>' + esc(f[1]) + '</label><input type="' + f[2] + '" data-bind="settings.' + f[0] + '"' + (f[4] || '') + '>' + (f[3] ? '<div class="hint">' + esc(f[3]) + '</div>' : '') + '</div>'; }).join('') +
          '<div class="field"><label>Default language</label><select data-bind="settings.defaultLang"><option value="en">English</option><option value="az">Azərbaycan</option></select><div class="hint">What first-time visitors see. Their own choice is remembered after that.</div></div>' +
        '</div>' +
        '<div class="card"><h2>Organization &amp; article schema</h2><p class="muted small">Organization data is generated on every page from Site name, URL and contact settings. These fields add optional legal and publishing details.</p>' +
          '<div class="field"><label>Legal organization name</label><input type="text" data-bind="structured.orgLegalName"></div>' +
          '<div class="field"><label>Organization logo URL</label><input type="url" data-bind="structured.orgLogoUrl" placeholder="https://example.com/logo.png"><div class="hint">Use an absolute http(s) image URL.</div></div>' +
          '<div class="field"><label>Article author</label><input type="text" data-bind="structured.articleAuthor"><div class="hint">Must match the visible byline on article.html.</div></div>' +
          '<div class="field"><label>Article published date</label><input type="text" inputmode="numeric" data-bind="structured.articleDatePublished" placeholder="YYYY-MM-DD"></div>' +
          '<div class="field"><label>Article modified date</label><input type="text" inputmode="numeric" data-bind="structured.articleDateModified" placeholder="YYYY-MM-DD"><div class="hint">Optional. Leave blank unless the article was materially updated.</div></div>' +
        '</div></div>' +
        '<div>' +
          '<div class="card"><h2>Site features</h2><div class="switch-list">' +
            FEATURES.filter(function(f){ return ['langSwitch', 'newsletter', 'cookieBanner', 'careersButton', 'showVerifiedProof'].indexOf(f[0]) >= 0; })
              .map(function(f){ return '<label class="check"><input type="checkbox" data-bind="features.' + f[0] + '"><span>' + esc(f[1]) + (f[2] ? '<div class="d">' + esc(f[2]) + '</div>' : '') + '</span></label>'; }).join('') +
          '</div></div>' +
          '<div class="card"><h2>JobPosting schema</h2><p class="muted small">Published only when every required field is complete. Keep this empty until it exactly matches the visible role page.</p>' +
            '<div class="field"><label>Job title</label><input type="text" data-bind="structured.jobTitle"></div>' +
            '<div class="field"><label>Job description</label><textarea class="resize-none" data-bind="structured.jobDescription"></textarea></div>' +
            '<div class="grid2"><div class="field"><label>Date posted</label><input type="text" inputmode="numeric" data-bind="structured.jobDatePosted" placeholder="YYYY-MM-DD"></div><div class="field"><label>Valid through</label><input type="text" inputmode="numeric" data-bind="structured.jobValidThrough" placeholder="YYYY-MM-DD"></div></div>' +
            '<div class="field"><label>Employment type</label><select data-bind="structured.jobEmploymentType"><option value="">Select…</option><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACTOR">Contractor</option><option value="TEMPORARY">Temporary</option><option value="INTERN">Intern</option><option value="OTHER">Other</option></select></div>' +
            '<div class="field"><label>Location</label><input type="text" data-bind="structured.jobLocation" placeholder="Austin, TX, US"></div>' +
            '<label class="check"><input type="checkbox" data-bind="structured.jobRemote"><span>Remote or hybrid role<div class="d">Adds TELECOMMUTE while retaining the stated location.</div></span></label>' +
            '<div class="field" style="margin-top:14px"><label>Application URL</label><input type="url" data-bind="structured.jobApplyUrl" placeholder="https://example.com/apply"></div>' +
          '</div>' +
          '<div class="card"><h2>Analytics</h2><p class="muted small">Loaded only after a visitor accepts cookies (or always, if the banner is off).</p>' +
            '<div class="field"><label>Google Analytics measurement ID</label><input type="text" data-bind="analytics.gaId" placeholder="G-XXXXXXXXXX"></div>' +
            '<div class="field"><label>Other tag snippets (GTM, Meta pixel, …)</label><textarea class="code resize-none" data-bind="analytics.consentScript" spellcheck="false" placeholder="<script>…</script>"></textarea><div class="hint">Paste the full snippet including &lt;script&gt; tags.</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    bindInputs(panel);
  }

  /* ---------- submissions ---------- */
  function updateSubsPill(n){ var p = $('#subsPill'); p.textContent = n; p.hidden = !n; }
  function renderSubmissions(panel){
    panel.innerHTML = '<div class="toolbar"><select id="subForm" aria-label="Form type"><option value="">All forms</option><option>contact</option><option>teardown</option><option>newsletter</option></select><span class="muted small" id="subCount"></span><span style="flex:1"></span><button class="btn sm" id="subCsv">Export CSV</button><button class="btn sm danger" id="subClear">Delete all</button></div><div id="subList" class="tw"><div class="empty">Loading…</div></div>';
    function draw(){
      var f = $('#subForm').value;
      var rows = (state.subs || []).filter(function(s){ return !f || s.form === f; });
      $('#subCount').textContent = rows.length + ' submission' + (rows.length === 1 ? '' : 's');
      if (!rows.length){ $('#subList').innerHTML = '<div class="empty">Nothing here yet. Submissions from the contact form, the funnel-teardown form and the newsletter box appear here.</div>'; return; }
      $('#subList').innerHTML = '<table><thead><tr><th>When</th><th>Form</th><th>Details</th><th>Lang</th><th></th></tr></thead><tbody>' +
        rows.map(function(s){
          var kv = Object.keys(s.fields).map(function(k){ return '<div class="kv"><b>' + esc(k) + '</b>: ' + esc(s.fields[k]) + '</div>'; }).join('');
          return '<tr><td style="white-space:nowrap">' + esc(fmtDate(s.at)) + '</td><td><span class="tag">' + esc(s.form) + '</span></td><td>' + kv + '</td><td>' + esc(s.lang || '') + '</td><td><button class="btn icon danger" data-del-sub="' + esc(s.id) + '">✕</button></td></tr>';
        }).join('') + '</tbody></table>';
    }
    function load(){
      api('GET', 'api/submissions').then(function(list){ state.subs = list; updateSubsPill(list.length); draw(); })
        .catch(function(e){ $('#subList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    load();
    $('#subForm').addEventListener('change', draw);
    $('#subCsv').addEventListener('click', function(){
      var rows = state.subs || [], keys = {};
      rows.forEach(function(s){ Object.keys(s.fields).forEach(function(k){ keys[k] = 1; }); });
      var cols = ['at', 'form', 'lang', 'page'].concat(Object.keys(keys));
      var csv = cols.join(',') + '\n' + rows.map(function(s){
        return cols.map(function(c){ var v = c in s ? s[c] : s.fields[c]; return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'submissions-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('#subClear').addEventListener('click', async function(){
      if (!await confirmAction('Delete every submission? This cannot be undone.', 'Delete all')) return;
      api('DELETE', 'api/submissions').then(load).catch(function(e){ toast(e.message, 'err'); });
    });
    panel.addEventListener('click', function(e){
      var b = e.target.closest('[data-del-sub]'); if (!b) return;
      api('DELETE', 'api/submissions/' + b.getAttribute('data-del-sub')).then(load).catch(function(err){ toast(err.message, 'err'); });
    });
  }

  /* ---------- account & backup ---------- */
  function renderAccount(panel){
    panel.innerHTML =
      '<div class="grid2">' +
        '<div class="card"><h2>Change password</h2><form id="pwForm" novalidate>' +
          '<div class="field"><label>Current password</label><div class="password-row"><input type="password" id="pwCur" autocomplete="current-password" required><button type="button" class="password-toggle" data-password-toggle="pwCur" aria-pressed="false">Show</button></div></div>' +
          '<div class="field"><label>New password (8+ characters)</label><div class="password-row"><input type="password" id="pwNew" autocomplete="new-password" minlength="8" required><button type="button" class="password-toggle" data-password-toggle="pwNew" aria-pressed="false">Show</button></div></div>' +
          '<div class="field"><label>Repeat new password</label><div class="password-row"><input type="password" id="pwNew2" autocomplete="new-password" required><button type="button" class="password-toggle" data-password-toggle="pwNew2" aria-pressed="false">Show</button></div></div>' +
          '<p class="err" id="pwErr" role="alert" hidden></p>' +
          '<button class="btn primary" type="submit">Update password</button></form></div>' +
        '<div>' +
          '<div class="card"><h2>Backup &amp; restore</h2><p class="muted small">The whole configuration is one JSON file. Export before big changes; import to restore or to move settings to another install.</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exportBtn">Export JSON</button><label class="btn">Import JSON <input type="file" id="importFile" accept="application/json" hidden></label></div></div>' +
          '<div class="card"><h2>Reset</h2><p class="muted small">Puts every setting, colour, string and catalogue back to the code defaults. Submissions and your password are kept. You still need to Save &amp; publish.</p><button class="btn danger" id="resetAll">Reset everything to defaults</button></div>' +
        '</div>' +
      '</div>';
    bindPasswordToggles(panel);
    $('#pwForm').addEventListener('input', function(e){
      if (!e.target.matches('input[type="password"]')) return;
      e.target.setAttribute('aria-invalid', 'false'); e.target.removeAttribute('aria-describedby'); $('#pwErr').hidden = true;
    });
    $('#pwForm').addEventListener('submit', function(e){
      e.preventDefault();
      var err = $('#pwErr'), current = $('#pwCur'), next = $('#pwNew'), repeat = $('#pwNew2');
      [current, next, repeat].forEach(function(input){ input.setAttribute('aria-invalid', 'false'); input.removeAttribute('aria-describedby'); });
      function invalid(input, message){ err.textContent = message; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'pwErr'); input.focus(); }
      if (!current.value) return invalid(current, 'Enter your current password.');
      if (next.value.length < 8) return invalid(next, 'Use at least 8 characters for the new password.');
      if (next.value !== repeat.value) return invalid(repeat, 'New passwords do not match.');
      err.hidden = true;
      var submit = e.target.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Updating…';
      api('POST', 'api/password', { current: $('#pwCur').value, next: $('#pwNew').value })
        .then(function(){ toast('Password updated.', 'ok'); e.target.reset(); })
        .catch(function(ex){ err.textContent = ex.message; err.hidden = false; })
        .then(function(){ submit.disabled = false; submit.textContent = 'Update password'; });
    });
    $('#exportBtn').addEventListener('click', function(){
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state.site, null, 2)], { type: 'application/json' }));
      a.download = 'omnimark-site-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('#importFile').addEventListener('change', function(){
      var f = this.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function(){
        try {
          var obj = JSON.parse(r.result);
          if (!obj || typeof obj !== 'object' || !obj.settings) throw new Error('Not a site configuration file.');
          state.site = normalize(obj); markDirty(); toast('Imported — review, then Save & publish.', 'ok'); showTab('overview');
        } catch (err) { toast(err.message, 'err'); }
      };
      r.readAsText(f);
    });
    $('#resetAll').addEventListener('click', async function(){
      if (!await confirmAction('Reset every setting to the code defaults? It will not take effect until you publish.', 'Reset defaults')) return;
      state.site = normalize(clone(DEFAULT_SITE)); markDirty(); toast('Reset to defaults — Save & publish to apply.', 'ok'); showTab('overview');
    });
  }

  /* ---------- save / discard ---------- */
  function save(){
    if (!isDirty()) return;
    var btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'Publishing…';
    /* the on-page editor may hold an unpublished draft — the server says so
       with 409; make the owner choose rather than overwrite silently */
    var put = function(force){ return api('PUT', 'api/site', force ? Object.assign({}, state.site, { force: true }) : state.site); };
    put(false).catch(function(e){
      if (e.status === 409 && /draft/i.test(e.message || '')){
        if (confirm('The on-page editor has an unpublished draft. Saving here works, but publishing that draft later will overwrite what you save now.\n\nSave anyway?')) return put(true);
      }
      throw e;
    }).then(function(r){
      state.saved = normalize(r.site); state.site = normalize(r.site);
      markDirty(); toast('Published. The live site is updated.', 'ok');
      var f = $('#preview'); if (f) f.src = f.src;
      if (state.tab === 'overview') showTab('overview');
    }).catch(function(e){
      toast('Save failed: ' + e.message, 'err');
      if (e.status === 401){ $('#app').hidden = true; $('#login').hidden = false; }
    }).then(function(){ btn.textContent = 'Save & publish'; btn.disabled = !isDirty(); });
  }
  async function discard(){
    if (!isDirty() || !await confirmAction('Throw away unsaved changes?', 'Discard changes')) return;
    state.site = clone(state.saved); markDirty(); showTab(state.tab);
  }

  /* ---------- boot ---------- */
  function load(){
    return Promise.all([api('GET', 'api/site'), api('GET', 'api/pages'), api('GET', 'api/submissions').catch(function(){ return []; })])
      .then(function(res){
        state.site = normalize(res[0]); state.saved = clone(state.site); state.pages = res[1]; state.subs = res[2];
        updateSubsPill(res[2].length);
        $('#login').hidden = true; $('#noServer').hidden = true; $('#app').hidden = false;
        markDirty();
        showTab((location.hash || '#overview').slice(1));
      });
  }
  function boot(){
    api('GET', 'api/me').then(function(me){
      if (me.authed) return load();
      $('#login').hidden = false;
    }).catch(function(){ $('#noServer').hidden = false; });
  }
  $('#loginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var err = $('#loginErr'), input = $('#loginPw'), submit = e.target.querySelector('[type="submit"]');
    err.hidden = true; input.setAttribute('aria-invalid', 'false');
    if (!input.value){ err.textContent = 'Enter your password.'; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    submit.disabled = true; submit.textContent = 'Signing in…';
    api('POST', 'api/login', { password: input.value }).then(load).catch(function(ex){ err.textContent = ex.message; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); })
      .then(function(){ submit.disabled = false; submit.textContent = 'Sign in'; });
  });
  $('#loginPw').addEventListener('input', function(){ this.setAttribute('aria-invalid', 'false'); $('#loginErr').hidden = true; });
  $('#logoutBtn').addEventListener('click', async function(){
    if (isDirty() && !await confirmAction('You have unsaved changes. Sign out anyway?', 'Sign out')) return;
    api('POST', 'api/logout').then(function(){ location.reload(); });
  });
  $('#saveBtn').addEventListener('click', save);
  $('#discardBtn').addEventListener('click', discard);
  $$('.side nav button').forEach(function(b){ b.addEventListener('click', function(){ showTab(b.getAttribute('data-tab')); }); });
  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-goto]'); if (!a) return;
    e.preventDefault(); showTab(a.getAttribute('data-goto'));
  });
  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', function(e){ if (isDirty()){ e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', function(){ var id = location.hash.slice(1); if (id && id !== state.tab && state.site) showTab(id); });
  bindPasswordToggles(document);
  boot();
})();
