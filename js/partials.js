/* Injects the shared header (nav + mega-menu + mobile drawer), footer and
   the two service accordions (home + services index). Reads
   window.OMNI_ENGINES / OMNI_INDUSTRIES from data.js and the runtime
   overrides from data/site.js (via js/site-config.js). Include this script
   after data.js + i18n-data.js and before main.js on every page, with
   <div id="site-header"></div> and <div id="site-footer"></div> in place.
   Optional mounts: <div class="accordion" data-accordion="home|services">. */
(function(){
  /* Let the admin-saved config replace the catalogue / dictionaries before
     anything below reads them. */
  if (window.OmniSite && window.OmniSite.applyData) window.OmniSite.applyData();

  var engines = window.OMNI_ENGINES || [];
  var industries = window.OMNI_INDUSTRIES || [];
  var site = (window.OmniSite && window.OmniSite.get()) || {};
  var settings = site.settings || {};
  var features = (window.OmniSite && window.OmniSite.flags()) || {};
  var page = document.body.getAttribute('data-page') || '';
  var megaMenuLinkLimit = parseInt(settings.megaMenuLinkLimit, 10);
  if(!isFinite(megaMenuLinkLimit)) megaMenuLinkLimit = 4;
  megaMenuLinkLimit = Math.max(1, Math.min(12, megaMenuLinkLimit));

  /* Everything that comes from data.js / site.js is dropped into innerHTML,
     so escape it — the admin dashboard can put anything in those strings. */
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function isOn(key){ return page === key ? ' class="nav-link on" aria-current="page"' : ' class="nav-link"'; }
  /* wordmark — keeps the two-tone "OmniMark" styling for the default name */
  var siteName = settings.siteName || 'OmniMark';
  function markInner(){ return siteName === 'OmniMark' ? 'Omni<span>Mark</span>' : esc(siteName); }
  function engineKey(e, idx){ return 'engines.e' + (idx + 1); }
  function engineAnchor(e, idx){ return 'services.html#engine-' + (e.num || ('0' + (idx + 1))); }

  var CARET = '<svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Flattens an engine's grouped sub-services into an ordered list while
     keeping each item's (group, index) so it can carry the same
     data-i18n key the accordions use — one dictionary entry, four
     renderings (mega-menu, drawer, home accordion, services accordion). */
  function flattenItems(e, idx, limit){
    var out = [];
    (e.groups || []).forEach(function(g, gi){
      (g.items || []).forEach(function(item, ii){
        out.push({ text: item, key: engineKey(e, idx) + '.groups.' + gi + '.items.' + ii });
      });
    });
    return limit ? out.slice(0, limit) : out;
  }

  function megaMenu(){
    var cols = engines.map(function(e, idx){
      var n = idx + 1, k = engineKey(e, idx);
      var items = flattenItems(e, idx, megaMenuLinkLimit);
      var parentAnchor = esc(engineAnchor(e, idx));
      var li = items.map(function(it){ return '<li><a href="'+parentAnchor+'" data-i18n="'+it.key+'">'+esc(it.text)+'</a></li>'; }).join('');
      return '<div class="mega-col" data-n="'+n+'">'+
        '<span class="num">'+esc(e.num)+'</span>'+
        '<h5 data-i18n="'+k+'.name">'+esc(e.name)+'</h5>'+
        '<p class="promise" data-i18n="'+k+'.promise">'+esc(e.promise)+'</p>'+
        '<ul>'+li+'</ul>'+
        '<a class="view-all" href="'+parentAnchor+'" data-i18n="mega.viewAll" data-i18n-html>View all &rarr;</a>'+
      '</div>';
    }).join('');
    return '<div class="mega" role="group" aria-label="Services">'+
      '<div class="mega-grid">'+cols+'</div>'+
      '<div class="mega-rail">'+
        '<div class="thumb" aria-hidden="true"></div>'+
        '<div class="txt"><span class="tag" data-i18n="mega.featuredCase">Featured case</span><h6 data-i18n="mega.featuredHeadline" data-i18n-html>3.4&times; qualified pipeline in two quarters</h6><p><span data-i18n="mega.featuredSub">B2B SaaS · Series B</span> &middot; <a href="case-study.html" style="color:inherit;text-decoration:underline" data-i18n="mega.readCase" data-i18n-html>Read the case &rarr;</a></p></div>'+
        '<a class="btn btn-ghost all-services" href="services.html" data-i18n="mega.allServices" data-i18n-html>All services &rarr;</a>'+
      '</div>'+
    '</div>';
  }

  function industryDropdown(){
    var links = industries.map(function(i, idx){
      if(idx === 0) return '<a href="industry.html" data-i18n="industries.'+idx+'">'+esc(i)+'</a>';
      return '<div class="dropdown-static"><span data-i18n="industries.'+idx+'">'+esc(i)+'</span><small data-i18n="availability.pageSoon">Page coming soon</small></div>';
    }).join('');
    return '<div class="dropdown" role="group" aria-label="Industries">'+links+'</div>';
  }

  function industryStrip(list){
    if(!list) return;
    list.innerHTML = industries.map(function(item, idx){
      if(idx === 0) return '<a href="industry.html" class="chip" data-item="i1" data-i18n="industries.0">'+esc(item)+'</a>';
      return '<span class="chip is-coming" data-item="i'+(idx+1)+'"><span data-i18n="industries.'+idx+'">'+esc(item)+'</span><small data-i18n="availability.pageSoon">Page coming soon</small></span>';
    }).join('');
  }

  function drawerServices(){
    return engines.map(function(e, idx){
      var k = engineKey(e, idx);
      var items = flattenItems(e, idx, 6);
      var parentAnchor = esc(engineAnchor(e, idx));
      var li = items.map(function(it){ return '<a href="'+parentAnchor+'" data-i18n="'+it.key+'">'+esc(it.text)+'</a>'; }).join('');
      var subId = 'd-eng-'+esc(e.id);
      return '<div class="d-engine-block">'+
        '<button class="d-engine" data-toggle="'+subId+'" aria-expanded="false" aria-controls="'+subId+'">'+esc(e.num)+' &middot; <span data-i18n="'+k+'.name">'+esc(e.name)+'</span> '+CARET+'</button>'+
        '<div class="d-sub" id="'+subId+'" inert>'+
          li + '<a href="'+parentAnchor+'" style="font-weight:600;color:var(--violet)" data-i18n="drawer.viewEngine" data-i18n-html>View engine &rarr;</a>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  /* ---------- service accordion (home + services index) ---------- */
  function accordion(mode){
    return engines.map(function(e, idx){
      var n = idx + 1, k = engineKey(e, idx);
      var id = 'engine-' + esc(e.num || ('0' + n));
      var open = idx === 0;
      var promise = mode === 'services'
        ? '<span class="en-promise"><span class="codename" style="margin-right:8px">'+esc(e.codename)+'</span><span data-i18n="'+k+'.promise">'+esc(e.promise)+'</span></span>'
        : '<span class="en-promise" data-i18n="'+k+'.promise">'+esc(e.promise)+'</span>';
      var cols = (e.groups || []).map(function(g, gi){
        var li = (g.items || []).map(function(item, ii){
          return '<li data-i18n="'+k+'.groups.'+gi+'.items.'+ii+'">'+esc(item)+'</li>';
        }).join('');
        return '<div><h6 data-i18n="'+k+'.groups.'+gi+'.title">'+esc(g.title)+'</h6><ul>'+li+'</ul></div>';
      }).join('');
      var explore = idx === 0 ? (e.detail || e.href) : engineAnchor(e, idx);
      return '<div class="eng-row'+(open?' open':'')+'" id="'+id+'" data-n="'+n+'">'+
        '<button class="eng-head" aria-expanded="'+(open?'true':'false')+'" aria-controls="'+id+'-panel">'+
          '<span class="num">'+esc(e.num)+'</span>'+
          '<span class="en-name" data-i18n="'+k+'.name">'+esc(e.name)+'</span>'+
          promise+
          '<svg class="en-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
        '</button>'+
        '<div class="eng-panel" id="'+id+'-panel" aria-hidden="'+(open?'false':'true')+'"'+(open?'':' inert')+'><div class="eng-panel-in">'+
          '<div class="eng-cols">'+cols+'</div>'+
          '<div class="eng-panel-foot"><a href="'+esc(explore)+'" class="btn-text" data-i18n="engines.explore" data-i18n-html>Explore the engine &rarr;</a></div>'+
        '</div></div>'+
      '</div>';
    }).join('');
  }

  function langSwitch(long){
    if (features.langSwitch === false) return '';
    return '<div class="lang-switch" role="group" aria-label="Language">'+
      '<button data-lang="en" aria-pressed="true">'+(long?'English':'EN')+'</button>'+
      '<button data-lang="az" aria-pressed="false">'+(long?'Azərbaycan':'AZE')+'</button>'+
    '</div>';
  }

  var header =
  '<a class="skip-link" href="#main" data-i18n="nav.skip">Skip to content</a>'+
  '<div class="drawer-scrim" id="drawerScrim"></div>'+
  '<nav class="topnav" aria-label="Primary">'+
    '<div class="inner">'+
      '<a href="index.html" class="mark">'+markInner()+'</a>'+
      '<ul class="primary-nav">'+
        '<li class="nav-item has-mega"><a href="services.html"'+isOn('services')+' aria-haspopup="true" aria-expanded="false"><span data-i18n="nav.services">Services</span> '+CARET+'</a>'+megaMenu()+'</li>'+
        '<li class="nav-item"><a href="work.html"'+isOn('work')+' data-i18n="nav.work">Work</a></li>'+
        '<li class="nav-item"><a href="index.html#industries"'+isOn('industries')+' aria-haspopup="true" aria-expanded="false"><span data-i18n="nav.industries">Industries</span> '+CARET+'</a>'+industryDropdown()+'</li>'+
        '<li class="nav-item"><a href="about.html"'+isOn('about')+' data-i18n="nav.about">About</a></li>'+
        '<li class="nav-item"><a href="insights.html"'+isOn('insights')+' data-i18n="nav.insights">Insights</a></li>'+
      '</ul>'+
      '<div class="nav-actions">'+
        langSwitch(false)+
        (features.careersButton === false ? '' : '<a href="careers.html" class="btn btn-ghost" style="padding:10px 16px" data-i18n="nav.careers">Careers</a>')+
        '<a href="contact.html" class="btn btn-primary" style="padding:10px 18px" data-i18n="nav.contact">Contact</a>'+
        '<button class="hamburger" id="hamburgerBtn" aria-expanded="false" aria-label="Open menu" aria-controls="mobileDrawer"><span></span></button>'+
      '</div>'+
    '</div>'+
  '</nav>'+
  '<aside class="drawer" id="mobileDrawer" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden="true" inert>'+
    '<div class="drawer-top"><span class="mark">'+markInner()+'</span><button class="drawer-close" id="drawerClose" aria-label="Close menu">&times;</button></div>'+
    '<nav>'+
      '<ul>'+
        '<li><button class="d-link" data-toggle="d-services" aria-expanded="false" aria-controls="d-services"><span data-i18n="nav.services">Services</span> '+CARET+'</button>'+
          '<div class="d-sub" id="d-services" inert>'+drawerServices()+'</div>'+
        '</li>'+
        '<li><a class="d-link" href="work.html" data-i18n="nav.work">Work</a></li>'+
        '<li><a class="d-link" href="index.html#industries" data-i18n="nav.industries">Industries</a></li>'+
        '<li><a class="d-link" href="about.html" data-i18n="nav.about">About</a></li>'+
        '<li><a class="d-link" href="insights.html" data-i18n="nav.insights">Insights</a></li>'+
        (features.careersButton === false ? '' : '<li><a class="d-link" href="careers.html" data-i18n="nav.careers">Careers</a></li>')+
      '</ul>'+
    '</nav>'+
    '<a href="contact.html" class="btn btn-primary btn-block" style="margin-top:22px" data-i18n="nav.contact">Contact</a>'+
    langSwitch(true)+
  '</aside>';

  var email = settings.email || 'hello@omnimark.com';
  var phone = settings.phone || '+1 (800) 555-1234';
  var phoneHref = settings.phoneHref || phone.replace(/[^0-9+]/g, '');
  var address = settings.address || '400 Commerce St, Austin, TX';
  var linkedin = settings.linkedin || 'https://www.linkedin.com';
  var yearNow = new Date().getFullYear();
  function legalItem(url, key, label){
    return url
      ? '<a href="'+esc(url)+'" style="color:var(--panel-muted)" data-i18n="'+key+'">'+label+'</a>'
      : '<span class="legal-missing" aria-disabled="true" data-i18n="'+key+'">'+label+'</span>';
  }

  var newsletter = features.newsletter === false ? '' :
    '<div class="nb-title" style="margin-top:22px" data-i18n="footer.signalTitle">The Signal</div>'+
    '<p style="font-size:13px;margin-bottom:0" data-i18n="footer.signalDesc">One email every other Tuesday on what\'s actually working in B2B demand.</p>'+
    '<form class="nl-row" id="newsletterForm" novalidate>'+
      '<label class="visually-hidden" for="nl-email" style="position:absolute;left:-9999px">Email address</label>'+
      '<input type="email" id="nl-email" name="email" autocomplete="email" placeholder="you@company.com" data-i18n="footer.emailPlaceholder" data-i18n-attr="placeholder" aria-describedby="nlValidation" aria-invalid="false" required>'+
      '<button type="submit" class="btn btn-primary" data-i18n="footer.subscribe">Subscribe</button>'+
    '</form>'+
    '<p id="nlValidation" class="newsletter-message" role="alert" data-i18n="forms.emailInvalid">Enter a valid email address.</p>'+
    '<p id="nlSuccess" style="display:none;color:var(--signal);font-size:13px;margin-top:10px" data-i18n="footer.subscribed">Subscribed. Watch your inbox.</p>'+
    '<p id="nlError" class="newsletter-message" role="alert" data-i18n="forms.subscribeError">Could not subscribe right now. Please try again.</p>';

  var footer =
  '<div class="wrap">'+
    '<div class="footer-top">'+
      '<div class="newsletter-block">'+
        '<div class="mark" style="color:#fff;margin-bottom:14px">'+markInner()+'</div>'+
        '<p style="max-width:32ch;font-size:14px" data-i18n="footer.blurb">One accountable team across the whole path to purchase — brand, media, platforms and sales.</p>'+
        newsletter+
      '</div>'+
      '<div><h6 data-i18n="footer.colServices">Services</h6><ul>'+
        engines.map(function(e, idx){ return '<li><a href="'+esc(e.href)+'" data-i18n="'+engineKey(e, idx)+'.name">'+esc(e.name)+'</a></li>'; }).join('')+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colCompany">Company</h6><ul>'+
        '<li><a href="about.html" data-i18n="footer.about">About</a></li>'+
        '<li><a href="work.html" data-i18n="footer.work">Work</a></li>'+
        '<li><a href="careers.html" data-i18n="footer.careers">Careers</a></li>'+
        '<li><a href="contact.html" data-i18n="footer.contact">Contact</a></li>'+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colResources">Resources</h6><ul>'+
        '<li><a href="insights.html" data-i18n="footer.insights">Insights</a></li>'+
        '<li><a href="index.html#industries" data-i18n="footer.industries">Industries</a></li>'+
        '<li><a href="geo.html" data-i18n="footer.markets">Markets</a></li>'+
        '<li><a href="services.html" data-i18n="footer.allServices">All services</a></li>'+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colConnect">Connect</h6><ul>'+
        '<li><a href="mailto:'+esc(email)+'" data-site="email">'+esc(email)+'</a></li>'+
        '<li><a href="tel:'+esc(phoneHref)+'" data-site="phone">'+esc(phone)+'</a></li>'+
        '<li><a href="'+esc(linkedin)+'" target="_blank" rel="noopener">LinkedIn</a></li>'+
        '<li style="color:var(--panel-muted)" data-site="address">'+esc(address)+'</li>'+
      '</ul></div>'+
    '</div>'+
    '<div class="footer-legal">'+
      '<span>&copy; '+yearNow+' '+esc(settings.siteName || 'OmniMark')+'. <span data-i18n="footer.rights">All rights reserved.</span></span>'+
      '<div class="links">'+
        legalItem(settings.privacyUrl, 'footer.privacy', 'Privacy Policy')+
        legalItem(settings.termsUrl, 'footer.terms', 'Terms')+
        (features.cookieBanner === false ? '' : '<button type="button" id="cookiePrefsLink" data-i18n="footer.cookiePrefs">Cookie Preferences</button>')+
      '</div>'+
    '</div>'+
    '<div class="footer-word" aria-hidden="true">'+esc(settings.siteName || 'OmniMark')+'</div>'+
  '</div>';

  /* In-page contact details: <a data-site="email">, <span data-site="phone">,
     <span data-site="address"> … — swapped for the admin-configured values. */
  function bindSiteFields(root){
    var map = {
      email: { text: email, href: 'mailto:' + email },
      phone: { text: phone, href: 'tel:' + phoneHref },
      address: { text: address },
      addressLine1: { text: settings.addressLine1 },
      addressLine2: { text: settings.addressLine2 },
      geoEmail: { text: settings.geoEmail || email, href: 'mailto:' + (settings.geoEmail || email) },
      siteName: { text: settings.siteName }
    };
    var nodes = root.querySelectorAll('[data-site]');
    for (var i = 0; i < nodes.length; i++){
      var el = nodes[i], v = map[el.getAttribute('data-site')];
      if (!v || v.text == null) continue;
      el.textContent = v.text;
      if (v.href && el.tagName === 'A') el.setAttribute('href', v.href);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    var h = document.getElementById('site-header');
    var f = document.getElementById('site-footer');
    if (h) h.innerHTML = header;
    if (f) { f.innerHTML = footer; f.className = (f.className + ' site-footer').trim(); }
    var mounts = document.querySelectorAll('[data-accordion]');
    for (var i = 0; i < mounts.length; i++) mounts[i].innerHTML = accordion(mounts[i].getAttribute('data-accordion'));
    industryStrip(document.querySelector('[data-list="industry.strip"]'));
    bindSiteFields(document);
    /* skip-link target */
    var m = document.querySelector('main');
    if (m && !m.id) m.id = 'main';
    /* cookie consent — shared, so "Cookie Preferences" in the footer and the
       consent-gated analytics work on every page, not just the homepage */
    if (features.cookieBanner !== false && !document.getElementById('cookieBanner')){
      document.body.insertAdjacentHTML('beforeend',
        '<div class="cookie-banner" id="cookieBanner" role="dialog" aria-label="Cookie preferences">'+
          '<p data-i18n="cookie.text">We use cookies for analytics and to improve the site. Non-essential cookies stay off until you say yes.</p>'+
          '<div class="row">'+
            '<button class="btn btn-secondary" data-consent-reject style="padding:9px 14px" data-i18n="cookie.reject">Reject</button>'+
            '<button class="btn btn-primary" data-consent-accept style="padding:9px 14px" data-i18n="cookie.accept">Accept</button>'+
          '</div>'+
        '</div>');
    }
    document.dispatchEvent(new CustomEvent('omni:partials-ready'));
  });
  /* i18n.js rewrites text after us (on boot and on every language change) */
  document.addEventListener('omni:i18n-applied', function(){ bindSiteFields(document); });
})();
