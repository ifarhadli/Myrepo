/* Lightweight i18n engine — EN / AZ.
   Reads window.OM_I18N (set by js/i18n-data.js) and swaps text on any
   element carrying data-i18n="dot.path.key". Choice persists in
   localStorage and survives normal page navigation since this is a
   static multi-page site (no SPA routing needed). */
(function(){
  'use strict';
  var LS_KEY = 'om-lang';
  var SUPPORTED = ['en', 'az'];

  function getLang(){
    try{
      var v = localStorage.getItem(LS_KEY);
      if (v && SUPPORTED.indexOf(v) !== -1) return v;
    }catch(e){}
    return 'en';
  }

  function resolve(dict, path){
    var parts = path.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++){
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function t(path){
    var lang = getLang();
    var root = window.OM_I18N || {};
    var val = resolve(root[lang] || {}, path);
    if (val === undefined && lang !== 'en') val = resolve(root.en || {}, path);
    return val;
  }

  function applyI18n(root){
    root = root || document;
    var lang = getLang();
    try{ document.documentElement.setAttribute('lang', lang); }catch(e){}
    document.documentElement.classList.toggle('lang-az', lang === 'az');

    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++){
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val == null) continue; // no translation for this key — leave authored text as-is
      var attr = el.getAttribute('data-i18n-attr');
      if (attr){
        el.setAttribute(attr, val);
      } else if (el.hasAttribute('data-i18n-html')){
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }

    var switches = document.querySelectorAll('.lang-switch [data-lang]');
    for (var j = 0; j < switches.length; j++){
      switches[j].setAttribute('aria-pressed', switches[j].getAttribute('data-lang') === lang ? 'true' : 'false');
    }
  }

  function setLang(lang){
    if (SUPPORTED.indexOf(lang) === -1) return;
    try{ localStorage.setItem(LS_KEY, lang); }catch(e){}
    applyI18n();
    document.dispatchEvent(new CustomEvent('omni:lang-changed', { detail: { lang: lang } }));
  }

  window.OmniI18n = { t: t, applyI18n: applyI18n, setLang: setLang, getLang: getLang };

  document.addEventListener('click', function(e){
    var btn = e.target.closest('.lang-switch [data-lang]');
    if (!btn) return;
    setLang(btn.getAttribute('data-lang'));
  });

  // static, already-in-the-HTML content
  function boot(){ applyI18n(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // header/footer/mega-menu, injected later by partials.js
  document.addEventListener('omni:partials-ready', function(){ applyI18n(); });
})();
