/* Runtime site configuration — applies whatever the admin dashboard saved.
   Loaded in <head> right after data/site.js (which sets window.OMNI_SITE)
   so design tokens land before first paint. Three stages:
     1. applyDesign()  — immediately: CSS tokens, fonts, custom CSS,
                         hidden sections, motion flags.
     2. applyData()    — called by partials.js once data.js and
                         i18n-data.js exist: swaps the service catalogue /
                         industries and merges copy overrides into OM_I18N.
     3. applyPageMeta()— at DOMContentLoaded: title / description overrides
                         for static hosting (server.js also injects these
                         server-side when it serves the page).
   The admin's live preview posts a draft config with postMessage and we
   re-run stage 1 on it. */
(function(){
  'use strict';
  var site = window.OMNI_SITE || {};

  var DEFAULT_FONTS = { display: 'Bricolage Grotesque', body: 'Inter', mono: 'JetBrains Mono' };
  var FALLBACKS = {
    display: '"Trebuchet MS",system-ui,sans-serif',
    body: '"Helvetica Neue",Arial,sans-serif',
    mono: '"SFMono-Regular",Consolas,monospace'
  };
  /* Google Fonts axis strings for the fonts the admin can pick from. */
  var FONT_CATALOG = {
    'Bricolage Grotesque': 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800',
    'Inter': 'Inter:wght@400;500;600;700',
    'JetBrains Mono': 'JetBrains+Mono:wght@400;500',
    'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
    'DM Sans': 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700',
    'Manrope': 'Manrope:wght@400;500;600;700;800',
    'Sora': 'Sora:wght@400;500;600;700;800',
    'Syne': 'Syne:wght@400;500;600;700;800',
    'Outfit': 'Outfit:wght@400;500;600;700;800',
    'Archivo': 'Archivo:wght@400;500;600;700;800',
    'Instrument Sans': 'Instrument+Sans:wght@400;500;600;700',
    'Work Sans': 'Work+Sans:wght@400;500;600;700;800',
    'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
    'Poppins': 'Poppins:wght@400;500;600;700;800',
    'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800',
    'Fira Code': 'Fira+Code:wght@400;500',
    'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500',
    'Space Mono': 'Space+Mono:wght@400;700'
  };
  var DEFAULT_FLAGS = {
    langSwitch: true, newsletter: true, cookieBanner: true, careersButton: true, showVerifiedProof: false,
    customCursor: true, magneticButtons: true, kineticHeadlines: true,
    marquee: true, countUp: true, reveal: true
  };

  function styleTag(id){
    var el = document.getElementById(id);
    if (!el){
      el = document.createElement('style'); el.id = id;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }
  function cssEscapeAttr(s){ return String(s).replace(/["\\]/g, '\\$&'); }

  function flags(cfg){
    cfg = cfg || site;
    var out = {}, f = cfg.features || {};
    for (var k in DEFAULT_FLAGS) out[k] = (k in f) ? !!f[k] : DEFAULT_FLAGS[k];
    return out;
  }

  function applyDesign(cfg){
    cfg = cfg || site;
    var root = document.documentElement;
    var design = cfg.design || {};
    var tokens = design.tokens || {};

    /* 1. tokens — every --var from :root in style.css can be overridden */
    var tokenCss = '';
    for (var k in tokens){
      if (!/^--[a-z0-9-]+$/i.test(k)) continue;
      var v = String(tokens[k]).replace(/[;{}]/g, '');
      if (v) tokenCss += k + ':' + v + ';';
    }
    /* Colours that style.css derives by hand from a token, kept in step */
    styleTag('omni-tokens').textContent = tokenCss ? ':root{' + tokenCss + '}' : '';

    /* 2. fonts */
    var fontCss = '', links = [];
    ['display', 'body', 'mono'].forEach(function(slot){
      var name = design['font' + slot.charAt(0).toUpperCase() + slot.slice(1)];
      if (!name || name === DEFAULT_FONTS[slot]) return;
      fontCss += '--font-' + slot + ':"' + cssEscapeAttr(name) + '",' + FALLBACKS[slot] + ';';
      if (FONT_CATALOG[name]) links.push(FONT_CATALOG[name]);
    });
    styleTag('omni-fonts').textContent = fontCss ? ':root{' + fontCss + '}' : '';
    var linkEl = document.getElementById('omni-font-link');
    if (links.length){
      var href = 'https://fonts.googleapis.com/css2?family=' + links.join('&family=') + '&display=swap';
      if (!linkEl){
        linkEl = document.createElement('link'); linkEl.id = 'omni-font-link'; linkEl.rel = 'stylesheet';
        (document.head || document.documentElement).appendChild(linkEl);
      }
      if (linkEl.getAttribute('href') !== href) linkEl.setAttribute('href', href);
    } else if (linkEl){ linkEl.parentNode.removeChild(linkEl); }

    /* 3. hidden sections — <section data-section="home.s3"> */
    var hidden = cfg.hiddenSections || [];
    styleTag('omni-hidden').textContent = hidden.map(function(key){
      return '[data-section="' + cssEscapeAttr(key) + '"]{display:none!important}';
    }).join('');

    /* 4. motion flags that CSS needs to know about */
    var f = flags(cfg);
    root.classList.toggle('no-reveal', !f.reveal);
    root.classList.toggle('no-kinetic', !f.kineticHeadlines);
    root.classList.toggle('no-marquee', !f.marquee);
    root.classList.toggle('show-verified-proof', f.showVerifiedProof);

    /* 5. free-form CSS — last, so it wins */
    styleTag('omni-custom-css').textContent = design.customCss || '';
  }

  function applyLayout(cfg){
    cfg = cfg || site;
    if (!document.body) return;
    var page = pageKey();
    var sectionOrder = (cfg.sectionOrder && cfg.sectionOrder[page]) || [];
    var main = document.querySelector('main');
    if (main){
      var sections = Array.prototype.slice.call(main.children).filter(function(el){ return el.hasAttribute('data-section'); });
      var byKey = {};
      sections.forEach(function(el){ byKey[el.getAttribute('data-section')] = el; });
      var ordered = [];
      sectionOrder.forEach(function(key){ if (byKey[key] && ordered.indexOf(byKey[key]) < 0) ordered.push(byKey[key]); });
      sections.forEach(function(el){ if (ordered.indexOf(el) < 0) ordered.push(el); });
      ordered.forEach(function(el){ main.appendChild(el); });
    }

    var accents = cfg.sectionAccent || {};
    document.querySelectorAll('[data-section]').forEach(function(el){
      var n = accents[el.getAttribute('data-section')];
      if (n >= 1 && n <= 5){
        el.style.setProperty('--acc', 'var(--c' + n + ')');
        el.setAttribute('data-section-accent', String(n));
      } else {
        el.style.removeProperty('--acc');
        el.removeAttribute('data-section-accent');
      }
    });

    var itemOrder = cfg.itemOrder || {};
    var hiddenItems = cfg.hiddenItems || [];
    document.querySelectorAll('[data-list]').forEach(function(list){
      var listKey = list.getAttribute('data-list');
      var items = Array.prototype.slice.call(list.children).filter(function(el){ return el.hasAttribute('data-item'); });
      var itemById = {};
      items.forEach(function(el){ itemById[el.getAttribute('data-item')] = el; });
      var order = itemOrder[listKey] || [];
      var next = [];
      order.forEach(function(id){ if (itemById[id] && next.indexOf(itemById[id]) < 0) next.push(itemById[id]); });
      items.forEach(function(el){ if (next.indexOf(el) < 0) next.push(el); });
      next.forEach(function(el){ list.appendChild(el); });
      items.forEach(function(el){
        var hidden = hiddenItems.indexOf(listKey + ':' + el.getAttribute('data-item')) >= 0;
        el.hidden = hidden;
        if (hidden) el.setAttribute('data-omni-hidden-item', 'true');
        else el.removeAttribute('data-omni-hidden-item');
      });
    });
  }

  /* Rebuilds OM_I18N.<lang>.engines.eN from a data.js-shaped engine array so
     every data-i18n key the partials emit has a matching entry. */
  function syncEngineDict(dict, engines){
    if (!dict || !engines) return;
    dict.engines = dict.engines || {};
    engines.forEach(function(e, i){
      dict.engines['e' + (i + 1)] = {
        name: e.name, promise: e.promise,
        groups: (e.groups || []).map(function(g){ return { title: g.title, items: (g.items || []).slice() }; })
      };
    });
  }
  function setPath(obj, path, val){
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++){
      var p = parts[i];
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }

  var dataApplied = false;
  function applyData(){
    if (dataApplied) return; dataApplied = true;
    if (Array.isArray(site.engines) && site.engines.length) window.OMNI_ENGINES = site.engines;
    if (Array.isArray(site.industries) && site.industries.length) window.OMNI_INDUSTRIES = site.industries;
    var I = window.OM_I18N;
    if (!I) return;
    I.en = I.en || {}; I.az = I.az || {};
    if (Array.isArray(site.engines) && site.engines.length){
      syncEngineDict(I.en, site.engines);
      syncEngineDict(I.az, (site.enginesAz && site.enginesAz.length === site.engines.length) ? site.enginesAz : site.engines);
    }
    if (Array.isArray(site.industries) && site.industries.length){
      I.en.industries = site.industries.slice();
      I.az.industries = (site.industriesAz && site.industriesAz.length === site.industries.length) ? site.industriesAz.slice() : site.industries.slice();
    }
    var ov = site.i18n || {};
    ['en', 'az'].forEach(function(lang){
      var flat = ov[lang] || {};
      for (var key in flat) if (typeof flat[key] === 'string') setPath(I[lang], key, flat[key]);
    });
  }

  function pageKey(){
    var p = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '');
    return p || 'index';
  }
  function setMeta(sel, attr, val, create){
    var el = document.querySelector(sel);
    if (!el && create){
      el = document.createElement('meta');
      var m = sel.match(/\[(name|property)="([^"]+)"\]/);
      if (m) el.setAttribute(m[1], m[2]);
      document.head.appendChild(el);
    }
    if (el) el.setAttribute(attr, val);
  }
  function applyPageMeta(){
    var pages = site.pages || {}, pg = pages[pageKey()];
    if (!pg) return;
    if (pg.title){ document.title = pg.title; setMeta('meta[property="og:title"]', 'content', pg.title, true); }
    if (pg.description){
      setMeta('meta[name="description"]', 'content', pg.description, true);
      setMeta('meta[property="og:description"]', 'content', pg.description, true);
    }
  }

  window.OmniSite = {
    get: function(){ return site; },
    flags: function(){ return flags(site); },
    applyDesign: applyDesign,
    applyLayout: applyLayout,
    applyData: applyData,
    applyPageMeta: applyPageMeta,
    fontCatalog: FONT_CATALOG,
    defaultFonts: DEFAULT_FONTS,
    defaultFlags: DEFAULT_FLAGS
  };

  /* The admin dashboard loads this file for the font catalogue / defaults
     only — it must not restyle itself with the site's tokens. */
  var isAdmin = document.documentElement.hasAttribute('data-omni-admin');
  if (!isAdmin){
    applyDesign(site);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ applyPageMeta(); applyLayout(site); });
    else { applyPageMeta(); applyLayout(site); }
    document.addEventListener('omni:partials-ready', function(){ applyLayout(site); });
  }

  /* live preview from the admin dashboard (same origin only) */
  window.addEventListener('message', function(e){
    if (e.origin !== location.origin) return;
    var m = e.data;
    if (!m || m.type !== 'omni:preview' || !m.site || typeof m.site !== 'object') return;
    applyDesign(m.site);
  });
})();
