/* Injects the shared header (nav + mega-menu + mobile drawer) and footer.
   Reads window.OMNI_ENGINES / OMNI_INDUSTRIES from data.js. Include this
   script after data.js and before main.js on every page, with
   <div id="site-header"></div> and <div id="site-footer"></div> in place. */
(function(){
  var engines = window.OMNI_ENGINES || [];
  var industries = window.OMNI_INDUSTRIES || [];
  var page = document.body.getAttribute('data-page') || '';

  function isOn(key){ return page === key ? ' class="nav-link on"' : ' class="nav-link"'; }

  /* Flattens an engine's grouped sub-services into an ordered list while
     keeping each item's (group, index) so it can carry the same
     data-i18n key the accordions use — one dictionary entry, three
     renderings (mega-menu, drawer, accordion). */
  function flattenItems(e, limit){
    var out = [];
    e.groups.forEach(function(g, gi){
      g.items.forEach(function(item, ii){
        out.push({ text: item, key: 'engines.e' + e.num.replace(/^0/, '') + '.groups.' + gi + '.items.' + ii });
      });
    });
    return limit ? out.slice(0, limit) : out;
  }

  function megaMenu(){
    var cols = engines.map(function(e, idx){
      var n = idx + 1;
      var items = flattenItems(e, 7);
      var li = items.map(function(it){ return '<li><a href="sub-service.html" data-i18n="'+it.key+'">'+it.text+'</a></li>'; }).join('');
      return '<div class="mega-col" data-n="'+n+'">'+
        '<span class="num">'+e.num+'</span>'+
        '<h5 data-i18n="engines.e'+n+'.name">'+e.name+'</h5>'+
        '<p class="promise" data-i18n="engines.e'+n+'.promise">'+e.promise+'</p>'+
        '<ul>'+li+'</ul>'+
        '<a class="view-all" href="'+e.href+'" data-i18n="mega.viewAll" data-i18n-html>View all &rarr;</a>'+
      '</div>';
    }).join('');
    return '<div class="mega" role="menu" aria-label="Services">'+
      '<div class="mega-grid">'+cols+'</div>'+
      '<div class="mega-rail">'+
        '<div class="thumb" aria-hidden="true"></div>'+
        '<div class="txt"><span class="tag" data-i18n="mega.featuredCase">Featured case</span><h6 data-i18n="mega.featuredHeadline" data-i18n-html>3.4&times; qualified pipeline in two quarters</h6><p><span data-i18n="mega.featuredSub">B2B SaaS · Series B</span> &middot; <a href="case-study.html" style="color:inherit;text-decoration:underline" data-i18n="mega.readCase" data-i18n-html>Read the case &rarr;</a></p></div>'+
      '</div>'+
    '</div>';
  }

  function industryDropdown(){
    var links = industries.map(function(i, idx){
      return '<a href="industry.html" data-i18n="industries.'+idx+'">'+i+'</a>';
    }).join('');
    return '<div class="dropdown" role="menu" aria-label="Industries">'+links+'</div>';
  }

  function drawerServices(){
    return engines.map(function(e, idx){
      var n = idx + 1;
      var items = flattenItems(e, 6);
      var li = items.map(function(it){ return '<a href="sub-service.html" data-i18n="'+it.key+'">'+it.text+'</a>'; }).join('');
      var subId = 'd-eng-'+e.id;
      return '<div class="d-engine-block">'+
        '<button class="d-engine" data-toggle="'+subId+'" aria-expanded="false">'+e.num+' &middot; <span data-i18n="engines.e'+n+'.name">'+e.name+'</span>'+
          ' <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'+
        '<div class="d-sub" id="'+subId+'">'+
          li + '<a href="'+e.href+'" style="font-weight:600;color:var(--violet)" data-i18n="drawer.viewEngine" data-i18n-html>View engine &rarr;</a>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  var header =
  '<div class="drawer-scrim" id="drawerScrim"></div>'+
  '<nav class="topnav" aria-label="Primary">'+
    '<div class="inner">'+
      '<a href="index.html" class="mark">Omni<span>Mark</span></a>'+
      '<ul class="primary-nav">'+
        '<li class="nav-item"><a href="services.html"'+isOn('services')+'><span data-i18n="nav.services">Services</span> <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'+megaMenu()+'</li>'+
        '<li class="nav-item"><a href="work.html"'+isOn('work')+' data-i18n="nav.work">Work</a></li>'+
        '<li class="nav-item"><a href="industry.html"'+isOn('industries')+'><span data-i18n="nav.industries">Industries</span> <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'+industryDropdown()+'</li>'+
        '<li class="nav-item"><a href="about.html"'+isOn('about')+' data-i18n="nav.about">About</a></li>'+
        '<li class="nav-item"><a href="insights.html"'+isOn('insights')+' data-i18n="nav.insights">Insights</a></li>'+
      '</ul>'+
      '<div class="nav-actions">'+
        '<div class="lang-switch" role="group" aria-label="Language">'+
          '<button data-lang="en" aria-pressed="true">EN</button>'+
          '<button data-lang="az" aria-pressed="false">AZE</button>'+
        '</div>'+
        '<a href="careers.html" class="btn btn-ghost" style="padding:10px 16px" data-i18n="nav.careers">Careers</a>'+
        '<a href="contact.html" class="btn btn-primary" style="padding:10px 18px" data-i18n="nav.contact">Contact</a>'+
        '<button class="hamburger" id="hamburgerBtn" aria-expanded="false" aria-label="Open menu" aria-controls="mobileDrawer"><span></span></button>'+
      '</div>'+
    '</div>'+
  '</nav>'+
  '<aside class="drawer" id="mobileDrawer" aria-hidden="true">'+
    '<div class="drawer-top"><span class="mark">Omni<span>Mark</span></span><button class="drawer-close" id="drawerClose" aria-label="Close menu">&times;</button></div>'+
    '<nav>'+
      '<ul>'+
        '<li><button class="d-link" data-toggle="d-services" aria-expanded="false"><span data-i18n="nav.services">Services</span> <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'+
          '<div class="d-sub" id="d-services">'+drawerServices()+'</div>'+
        '</li>'+
        '<li><a class="d-link" href="work.html" data-i18n="nav.work">Work</a></li>'+
        '<li><a class="d-link" href="industry.html" data-i18n="nav.industries">Industries</a></li>'+
        '<li><a class="d-link" href="about.html" data-i18n="nav.about">About</a></li>'+
        '<li><a class="d-link" href="insights.html" data-i18n="nav.insights">Insights</a></li>'+
        '<li><a class="d-link" href="careers.html" data-i18n="nav.careers">Careers</a></li>'+
      '</ul>'+
    '</nav>'+
    '<a href="contact.html" class="btn btn-primary btn-block" style="margin-top:22px" data-i18n="nav.contact">Contact</a>'+
    '<div class="lang-switch" role="group" aria-label="Language">'+
      '<button data-lang="en" aria-pressed="true">English</button>'+
      '<button data-lang="az" aria-pressed="false">Azərbaycan</button>'+
    '</div>'+
  '</aside>';

  var yearNow = new Date().getFullYear();
  var footer =
  '<div class="wrap">'+
    '<div class="footer-top">'+
      '<div class="newsletter-block">'+
        '<div class="mark" style="color:#fff;margin-bottom:14px">Omni<span>Mark</span></div>'+
        '<p style="max-width:32ch;font-size:14px" data-i18n="footer.blurb">One accountable team across the whole path to purchase — brand, media, platforms and sales.</p>'+
        '<div class="nb-title" style="margin-top:22px" data-i18n="footer.signalTitle">The Signal</div>'+
        '<p style="font-size:13px;margin-bottom:0" data-i18n="footer.signalDesc">One email every other Tuesday on what\'s actually working in B2B demand.</p>'+
        '<form class="nl-row" id="newsletterForm" novalidate>'+
          '<label class="visually-hidden" for="nl-email" style="position:absolute;left:-9999px">Email address</label>'+
          '<input type="email" id="nl-email" placeholder="you@company.com" data-i18n="footer.emailPlaceholder" data-i18n-attr="placeholder" required>'+
          '<button type="submit" class="btn btn-primary" data-i18n="footer.subscribe">Subscribe</button>'+
        '</form>'+
        '<p id="nlSuccess" style="display:none;color:var(--signal);font-size:13px;margin-top:10px" data-i18n="footer.subscribed">Subscribed. Watch your inbox.</p>'+
      '</div>'+
      '<div><h6 data-i18n="footer.colServices">Services</h6><ul>'+
        engines.map(function(e, idx){ return '<li><a href="'+e.href+'" data-i18n="engines.e'+(idx+1)+'.name">'+e.name+'</a></li>'; }).join('')+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colCompany">Company</h6><ul>'+
        '<li><a href="about.html" data-i18n="footer.about">About</a></li>'+
        '<li><a href="work.html" data-i18n="footer.work">Work</a></li>'+
        '<li><a href="careers.html" data-i18n="footer.careers">Careers</a></li>'+
        '<li><a href="contact.html" data-i18n="footer.contact">Contact</a></li>'+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colResources">Resources</h6><ul>'+
        '<li><a href="insights.html" data-i18n="footer.insights">Insights</a></li>'+
        '<li><a href="industry.html" data-i18n="footer.industries">Industries</a></li>'+
        '<li><a href="geo.html" data-i18n="footer.markets">Markets</a></li>'+
        '<li><a href="services.html" data-i18n="footer.allServices">All services</a></li>'+
      '</ul></div>'+
      '<div><h6 data-i18n="footer.colConnect">Connect</h6><ul>'+
        '<li><a href="mailto:hello@omnimark.com">hello@omnimark.com</a></li>'+
        '<li><a href="tel:+18005551234">+1 (800) 555-1234</a></li>'+
        '<li><a href="https://www.linkedin.com" target="_blank" rel="noopener">LinkedIn</a></li>'+
        '<li style="color:var(--panel-muted)">400 Commerce St, Austin, TX</li>'+
      '</ul></div>'+
    '</div>'+
    '<div class="footer-legal">'+
      '<span>&copy; '+yearNow+' OmniMark. <span data-i18n="footer.rights">All rights reserved.</span></span>'+
      '<div class="links">'+
        '<a href="#" style="color:var(--panel-muted)" data-i18n="footer.privacy">Privacy Policy</a>'+
        '<a href="#" style="color:var(--panel-muted)" data-i18n="footer.terms">Terms</a>'+
        '<a href="#" id="cookiePrefsLink" style="color:var(--panel-muted)" data-i18n="footer.cookiePrefs">Cookie Preferences</a>'+
      '</div>'+
    '</div>'+
    '<div class="footer-word" aria-hidden="true">OmniMark</div>'+
  '</div>';

  document.addEventListener('DOMContentLoaded', function(){
    var h = document.getElementById('site-header');
    var f = document.getElementById('site-footer');
    if (h) h.innerHTML = header;
    if (f) { f.innerHTML = footer; f.className = (f.className + ' site-footer').trim(); }
    document.dispatchEvent(new CustomEvent('omni:partials-ready'));
  });
})();
