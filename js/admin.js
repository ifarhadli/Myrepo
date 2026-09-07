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
        if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.data = j; throw e; }
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
  var state = { site: null, saved: null, pages: [], subs: null, tab: 'overview', openEngines: {}, publishing: false };

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
    $('#saveBtn').disabled = !d || state.publishing;
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
        var key=el.getAttribute('data-bind');if(key==='settings.phone')state.site.settings.phoneHref=el.value.replace(/[^+0-9]/g,'');if(key==='settings.email')state.site.settings.geoEmail=el.value;if(key==='settings.addressLine1'||key==='settings.addressLine2')state.site.settings.address=[state.site.settings.addressLine1,state.site.settings.addressLine2].filter(Boolean).join(', ');el.removeAttribute('aria-invalid');
        markDirty();
      });
    });
  }

  /* ---------- programmatic labels for every control in a rendered panel:
     .field label → for/id; otherwise an aria-label built from the key,
     language and context so screen readers get more than a placeholder ---------- */
  var uid = 0;
  function labelize(root){
    if(window.OmniFieldHelp)window.OmniFieldHelp.enhance(root);
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
    submissions: { title: 'Enquiries', render: renderSubmissions },
    account: { title: 'Account & export', render: renderAccount }
  };
  function clearPanelListeners(panel){ (panel.omniListeners||[]).forEach(function(x){panel.removeEventListener(x[0],x[1],x[2]);});panel.omniListeners=[]; }
  function onPanel(panel,type,handler,options){panel.omniListeners=panel.omniListeners||[];panel.omniListeners.push([type,handler,options]);panel.addEventListener(type,handler,options);}
  function showTab(id){
    if (!TABS[id]) id = 'overview';
    state.tab = id;
    $$('.side nav button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-tab') === id); });
    $('#tabTitle').textContent = TABS[id].title;
    var panel = $('#panel'); clearPanelListeners(panel); panel.innerHTML = '';
    TABS[id].render(panel);
    labelize(panel);
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    window.scrollTo(0, 0);
  }

  /* ---------- overview ---------- */
  function renderOverview(panel){
    var settings=state.site.settings,todo=[];
    if(!settings.email)todo.push('Add your contact email.');
    if(/555-1234/.test(settings.phone||''))todo.push('Replace the example phone number.');
    if(!settings.privacyUrl||settings.privacyUrl==='#'||!settings.termsUrl||settings.termsUrl==='#')todo.push('Add your Privacy Policy and Terms links.');
    panel.innerHTML='<div class="grid3"><div class="stat"><div class="n" id="ovSubs">…</div><div class="l">Unread enquiries</div></div><div class="stat"><div class="n" id="ovDraft">Checking…</div><div class="l">Website draft</div></div><div class="stat"><div class="n" style="font-size:16px">'+esc(fmtDate(state.site.updatedAt))+'</div><div class="l">Last published</div></div></div><div class="card" style="margin-top:20px"><h2>Manage your website</h2><p class="muted">Edit words and images directly on the page, then review and publish when you are ready.</p><div class="overview-actions"><a class="btn primary" href="index.html?edit=1">Edit website</a><button class="btn" data-goto="submissions">Read enquiries</button><a class="btn" href="index.html" target="_blank" rel="noopener">View live website ↗</a></div></div><div class="card"><h2>Website details</h2>'+(todo.length?'<ul>'+todo.map(function(text){return '<li>'+esc(text)+'</li>';}).join('')+'</ul><button class="btn" data-goto="settings">Update website details</button>':'<p class="muted">Your main contact details and links are in place.</p>')+'</div><div class="card"><h2>Enquiry notifications</h2><p id="ovNotify" class="muted">Checking connection…</p><a class="btn" href="index.html?edit=1&panel=settings">Manage enquiry emails</a></div>';
    api('GET','api/submissions?limit=1').then(function(data){if(!panel.isConnected||!$('#ovSubs',panel))return;$('#ovSubs',panel).textContent=data.unread;updateSubsPill(data.unread);}).catch(function(){if($('#ovSubs',panel))$('#ovSubs',panel).textContent='Unavailable';});
    api('GET','api/draft').then(function(data){var el=$('#ovDraft',panel);if(el)el.textContent=data.draft?'Unpublished changes':'Up to date';}).catch(function(){var el=$('#ovDraft',panel);if(el)el.textContent='Unavailable';});
    api('GET','api/status').then(function(data){var el=$('#ovNotify',panel);if(!el)return;var n=data.notifications||{};el.textContent=n.email||n.webhook?'Notifications are connected. Check each enquiry for its email delivery status.':'Notifications need setup. New enquiries are still stored in your inbox.';}).catch(function(){var el=$('#ovNotify',panel);if(el)el.textContent='Could not check notifications. Try again later.';});
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
    clearPanelListeners(panel);var shown=TOKENS.filter(function(t){return ['--ink','--paper','--signal','--violet'].indexOf(t.k)>=0;});
    panel.innerHTML='<div class="grid2"><div class="card"><h2>Brand colours</h2><p class="muted">Change your main colours. Use the page editor to preview the full design.</p><div class="tokens">'+shown.map(function(t){return tokenCard(t,true);}).join('')+'</div><a class="btn" href="index.html?edit=1" style="margin-top:18px">Open page editor</a></div><div class="preview-wrap"><div class="preview-bar"><select id="previewPage" aria-label="Preview page">'+state.pages.map(function(p){return '<option value="'+esc(p.file)+'"'+(p.file==='index.html'?' selected':'')+'>'+esc(p.title||p.file)+'</option>';}).join('')+'</select><button class="btn" id="previewReload">Reload</button></div><iframe id="preview" class="preview" src="index.html" title="Website preview"></iframe></div></div>';
    onPanel(panel,'input',function(e){var el=e.target,key=el.getAttribute('data-token-color')||el.getAttribute('data-token-text');if(!key)return;if(el.value.trim())state.site.design.tokens[key]=el.value.trim();else delete state.site.design.tokens[key];$('[data-token-text="'+key+'"]',panel).value=el.value;var picker=$('[data-token-color="'+key+'"]',panel);if(isHex(el.value))picker.value=el.value;markDirty();});
    onPanel(panel,'click',function(e){var b=e.target.closest('[data-token-reset]');if(!b)return;delete state.site.design.tokens[b.getAttribute('data-token-reset')];markDirty();renderDesign(panel);});
    var frame=$('#preview',panel);frame.addEventListener('load',previewPush);$('#previewPage',panel).addEventListener('change',function(){frame.src=this.value;});$('#previewReload',panel).addEventListener('click',function(){frame.src=$('#previewPage',panel).value;});
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
    clearPanelListeners(panel);
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

    onPanel(panel,'toggle', function(e){
      var d = e.target.closest && e.target.closest('details.eng');
      if (d) state.openEngines[d.getAttribute('data-eng-idx')] = d.open;
    }, true);
    onPanel(panel,'input', function(e){
      var el = e.target, p;
      if ((p = el.getAttribute('data-eng'))){ ensureEngines(); setPath(state.site.engines, p, el.value); }
      else if ((p = el.getAttribute('data-engaz'))){ ensureEngines(); setPath(state.site.enginesAz, p, el.value); }
      else return;
      markDirty();
    });
    onPanel(panel,'click', async function(e){
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
    clearPanelListeners(panel);
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
    onPanel(panel,'input', function(e){
      var el = e.target, i;
      if ((i = el.getAttribute('data-ind')) != null){ ensureIndustries(); state.site.industries[+i] = el.value; }
      else if ((i = el.getAttribute('data-indaz')) != null){ ensureIndustries(); state.site.industriesAz[+i] = el.value; }
      else return;
      markDirty();
    });
    onPanel(panel,'click', async function(e){
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
    clearPanelListeners(panel);
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
    onPanel(panel,'input', function(e){
      var el = e.target, p = el.getAttribute('data-page');
      if (!p) return;
      var i = p.indexOf('.'), key = p.slice(0, i), field = p.slice(i + 1);
      state.site.pages[key] = state.site.pages[key] || {};
      if (el.value.trim()) state.site.pages[key][field] = el.value; else delete state.site.pages[key][field];
      if (!Object.keys(state.site.pages[key]).length) delete state.site.pages[key];
      markDirty();
    });
    onPanel(panel,'change', function(e){
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
    var main=['siteName','email','phone','addressLine1','addressLine2','linkedin'];
    var links=['privacyUrl','termsUrl','schedulerUrl'];
    function fields(keys){return SETTINGS_FIELDS.filter(function(f){return keys.indexOf(f[0])>=0;}).map(function(f){return '<div class="field"><label>'+esc(f[1].replace('Phone (display)','Phone').replace('Address line 1','Street address').replace('Address line 2','City and country'))+'</label><input type="'+f[2]+'" data-bind="settings.'+f[0]+'"></div>';}).join('');}
    panel.innerHTML='<div class="settings-simple"><div class="notice">These are the details visitors see on your website. Publish to make changes live.</div><div class="card"><h2>Website details</h2>'+fields(main)+'<div class="field"><label>Website language</label><select data-bind="settings.defaultLang"><option value="en">English</option><option value="az">Azərbaycanca</option></select></div></div><details class="card"><summary>Website links</summary><p class="muted">Privacy policy, terms and appointment booking.</p>'+fields(links)+'</details><div class="card"><h2>Enquiry emails and your account</h2><p class="muted">Manage notification recipients, your password and your team in the page editor.</p><a class="btn" href="index.html?edit=1&panel=settings">Open settings in editor</a></div></div>';
    bindInputs(panel);
  }

  /* ---------- submissions ---------- */
  function csvText(value){var text=String(value==null?'':value);return /^[\s]*[=+@-]|^[\t\r\n]/.test(text)?"'"+text:text;}
  function updateSubsPill(n){ var p = $('#subsPill'); p.textContent = n; p.hidden = !n; }
  function renderSubmissions(panel){
    clearPanelListeners(panel);var page=1,request=0,data=null,query=state.enquiryQuery||'',form=state.enquiryForm||'';
    panel.innerHTML='<div class="toolbar"><input id="subSearch" type="search" aria-label="Search enquiries" placeholder="Search name, email or company"><button type="button" class="btn" id="subSearchClear" aria-label="Clear enquiry search">Clear</button><select id="subForm" aria-label="Form type"><option value="">All forms</option><option value="contact">Contact</option><option value="teardown">Teardown</option><option value="newsletter">Newsletter</option></select><button class="btn" id="subRefresh">Refresh</button><button class="btn" id="subCsv" disabled>Export CSV</button></div><p id="subCount" role="status">Loading enquiries…</p><div id="subList" class="tw"></div><div class="toolbar"><button class="btn" id="subPrev">Previous</button><span id="subPage"></span><button class="btn" id="subNext">Next</button></div><details class="card"><summary>Manage all enquiries</summary><p class="muted">Export a copy before removing records. Deleting is permanent.</p><button class="btn danger" id="subClear" disabled>Delete all enquiries</button></details>';
    $('#subSearch').value=query;$('#subForm').value=form;
    function queryString(){return 'form='+encodeURIComponent(form)+'&q='+encodeURIComponent(query);}
    function load(){var id=++request;$('#subSearchClear').hidden=!query;return api('GET','api/submissions?limit=25&page='+page+'&'+queryString()).then(function(result){if(id!==request||state.tab!=='submissions')return;data=result;page=result.page;state.subs=result.items;updateSubsPill(result.unread);$('#subCount').textContent=result.total+' matching enquiries · '+result.unread+' unread overall';$('#subCsv').textContent=form||query?'Export matching CSV':'Export all CSV';$('#subCsv').disabled=!result.total;$('#subClear').disabled=!result.allTotal;$('#subPrev').disabled=page<=1;$('#subNext').disabled=page>=result.pages;$('#subPage').textContent='Page '+page+' of '+result.pages;
      $('#subList').innerHTML=result.items.length?'<table><thead><tr><th>Received</th><th>Enquiry</th><th>Details</th><th>Email notification</th><th>Action</th></tr></thead><tbody>'+result.items.map(function(item){return '<tr><td>'+esc(fmtDate(item.at))+'</td><td>'+esc(item.form)+'<br>'+(item.read===true?'Read':'Unread')+'</td><td>'+Object.keys(item.fields).map(function(k){return '<div class="kv"><b>'+esc(k)+':</b> '+esc(item.fields[k])+'</div>';}).join('')+'</td><td>'+esc(deliveryLabel(item))+'</td><td><button class="btn danger" data-del-sub="'+esc(item.id)+'" aria-label="Delete enquiry from '+esc(item.fields.name||item.fields.email||'visitor')+'">Delete</button></td></tr>';}).join('')+'</tbody></table>':'<div class="empty">'+(form||query?'No enquiries match. Clear the search or choose All forms.':'No enquiries yet. New enquiries will appear here.')+'</div>';
    }).catch(function(error){if(id===request&&state.tab==='submissions')$('#subList').innerHTML='<div class="empty">'+esc(error.message)+' — use Refresh to try again.</div>';});}
    var runSearch=debounce(function(){query=$('#subSearch').value.trim();state.enquiryQuery=query;page=1;load();},300);
    $('#subSearch').addEventListener('input',function(e){if(!e.isComposing)runSearch();});$('#subSearch').addEventListener('compositionend',runSearch);
    $('#subSearchClear').addEventListener('click',function(){query='';state.enquiryQuery='';$('#subSearch').value='';page=1;load();$('#subSearch').focus();});
    $('#subForm').addEventListener('change',function(){form=this.value;state.enquiryForm=form;page=1;load();});$('#subRefresh').addEventListener('click',load);$('#subPrev').addEventListener('click',function(){page--;load();});$('#subNext').addEventListener('click',function(){page++;load();});
    $('#subCsv').addEventListener('click',function(){var button=this;button.disabled=true;api('GET','api/submissions?'+queryString()).then(function(rows){var keys={};rows.forEach(function(item){Object.keys(item.fields).forEach(function(k){keys[k]=true;});});var cols=['at','form','lang','page'].concat(Object.keys(keys));var csv=[cols.map(function(x){return '"'+csvText(x).replace(/"/g,'""')+'"';}).join(',')].concat(rows.map(function(item){return cols.map(function(k){return '"'+csvText(k in item?item[k]:item.fields[k]).replace(/"/g,'""')+'"';}).join(',');})).join('\r\n');var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='enquiries.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}).catch(function(error){toast(error.message,'err');}).finally(function(){button.disabled=!data||!data.total;});});
    $('#subClear').addEventListener('click',async function(){var button=this;if(!await confirmAction('Delete all '+data.allTotal+' enquiries, including records hidden by filters? This cannot be undone.','Delete all enquiries'))return;button.disabled=true;api('DELETE','api/submissions').then(function(){page=1;load();toast('All enquiries deleted.','ok');}).catch(function(error){button.disabled=false;toast(error.message,'err');});});
    onPanel(panel,'click',async function(e){var button=e.target.closest('[data-del-sub]');if(!button||button.disabled)return;var item=data.items.find(function(x){return x.id===button.getAttribute('data-del-sub');});if(!await confirmAction('Permanently delete the enquiry from '+(item.fields.name||item.fields.email)+'?','Delete enquiry'))return;button.disabled=true;api('DELETE','api/submissions/'+item.id).then(function(){load();$('#subForm').focus();toast('Enquiry deleted.','ok');}).catch(function(error){button.disabled=false;toast(error.message,'err');});});load();
  }
  function deliveryLabel(item){var status=item.delivery&&item.delivery.email;return ({accepted:'Email accepted for delivery',pending:'Sending email',retrying:'Retrying email',failed:'Email failed — check delivery setup',unconfirmed:'Delivery unconfirmed','not-configured':'Email not connected'})[status]||'Not recorded';}

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
          '<div class="card"><h2>Site configuration</h2><p class="muted small">Export website settings and content as JSON. This does not include image files, enquiries, accounts or history. A complete backup must include the entire data folder.</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exportBtn">Export JSON</button><button type="button" class="btn" id="importBtn">Import configuration</button><input type="file" id="importFile" accept="application/json" hidden></div></div>' +
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
    $('#importBtn').addEventListener('click', function(){ $('#importFile').click(); });
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
    if (!isDirty() || state.publishing) return;
    var submitted=clone(state.site);state.publishing=true;
    var btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'Publishing…';
    /* the on-page editor may hold an unpublished draft — the server says so
       with 409; make the owner choose rather than overwrite silently */
    var put = function(force){ return api('PUT', 'api/site', Object.assign({}, submitted, { baseUpdatedAt:state.saved.updatedAt||null, force:!!force })); };
    put(false).catch(function(e){
      if (e.status === 409 && /draft/i.test(e.message || '')){
        return confirmAction('The on-page editor has an unpublished draft. Saving here works, but publishing that draft later will overwrite what you save now.', 'Save anyway')
          .then(function(ok){ if (ok) return put(true); throw e; });
      }
      throw e;
    }).then(function(r){
      var unchanged=same(state.site,submitted);state.saved = normalize(r.site); if(unchanged)state.site = normalize(r.site);else state.site.updatedAt=r.site.updatedAt;
      markDirty(); toast('Published. The live site is updated.', 'ok');
      var f = $('#preview'); if (f) f.src = f.src;
      if (state.tab === 'overview') showTab('overview');
    }).catch(function(e){
      toast('Not published: ' + e.message, 'err');
      if(e.data&&e.data.field){var input=$('[data-bind="'+e.data.field+'"]');if(input){input.setAttribute('aria-invalid','true');var message=document.createElement('p');message.className='err';message.id='saveFieldError';var previous=$('#saveFieldError');if(previous)previous.remove();message.textContent=e.message;input.insertAdjacentElement('afterend',message);input.setAttribute('aria-describedby',message.id);input.focus();}}
      if (e.status === 401){ $('#app').hidden = true; $('#login').hidden = false; }
    }).then(function(){ state.publishing=false;btn.textContent = 'Save & publish'; btn.disabled = !isDirty(); });
  }
  async function discard(){
    if (!isDirty() || !await confirmAction('Throw away unsaved changes?', 'Discard changes')) return;
    state.site = clone(state.saved); markDirty(); showTab(state.tab);
  }

  /* ---------- boot ---------- */
  function load(){
    var retainEdits=state.site&&isDirty();
    return Promise.all([api('GET', 'api/site'), api('GET', 'api/pages'), api('GET', 'api/submissions?limit=1').catch(function(){ return {items:[],unread:0}; })])
      .then(function(res){
        if(!retainEdits){state.site = normalize(res[0]); state.saved = clone(state.site);} state.pages = res[1]; state.subs = res[2].items;
        updateSubsPill(res[2].unread);
        $('#login').hidden = true; $('#noServer').hidden = true; $('#app').hidden = false;
        markDirty();
        showTab((location.hash || '#overview').slice(1));
      });
  }
  function boot(){
    api('GET', 'api/me').then(function(me){
      if (me.authed && me.user && me.user.role === 'admin') return load();
      if (me.authed){ location.replace('index.html?edit=1'); return; }
      return api('GET', 'api/auth').then(function(info){ $('#advancedEmailField').hidden = !info.emailRequired; $('#loginEmail').required = !!info.emailRequired; $('#login').hidden = false; });
    }).catch(function(){ $('#noServer').hidden = false; });
  }
  $('#loginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var err = $('#loginErr'), input = $('#loginPw'), email = $('#loginEmail'), submit = e.target.querySelector('[type="submit"]');
    err.hidden = true; input.setAttribute('aria-invalid', 'false'); email.setAttribute('aria-invalid', 'false');
    if (!$('#advancedEmailField').hidden && (!email.value || !email.checkValidity())){ err.textContent = 'Enter your account email.'; err.hidden = false; email.setAttribute('aria-invalid', 'true'); email.focus(); return; }
    if (!input.value){ err.textContent = 'Enter your password.'; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    submit.disabled = true; submit.textContent = 'Signing in…';
    api('POST', 'api/login', { email: email.value, password: input.value }).then(function(result){ if(result.user&&result.user.role!=='admin'){ location.replace('index.html?edit=1'); return; } return load(); }).catch(function(ex){ err.textContent = ex.message; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); })
      .then(function(){ submit.disabled = false; submit.textContent = 'Sign in'; });
  });
  $('#loginPw').addEventListener('input', function(){ this.setAttribute('aria-invalid', 'false'); $('#loginErr').hidden = true; });
  $('#loginEmail').addEventListener('input', function(){ this.setAttribute('aria-invalid', 'false'); $('#loginErr').hidden = true; });
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
  var navToggle=$('.side-menu-toggle'),nav=$('#adminNavigation');
  function updateNavigation(){var narrow=window.matchMedia('(max-width:820px)').matches;nav.hidden=narrow&&navToggle.getAttribute('aria-expanded')!=='true';}
  navToggle.addEventListener('click',function(){navToggle.setAttribute('aria-expanded',String(navToggle.getAttribute('aria-expanded')!=='true'));updateNavigation();});window.addEventListener('resize',updateNavigation);updateNavigation();
  bindPasswordToggles(document);
  boot();
})();
