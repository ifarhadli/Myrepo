/* Injects the shared header (nav + mega-menu + mobile drawer) and footer.
   Reads window.OMNI_ENGINES / OMNI_INDUSTRIES from data.js. Include this
   script after data.js and before main.js on every page, with
   <div id="site-header"></div> and <div id="site-footer"></div> in place. */
(function(){
  var engines = window.OMNI_ENGINES || [];
  var industries = window.OMNI_INDUSTRIES || [];
  var page = document.body.getAttribute('data-page') || '';

  function isOn(key){ return page === key ? ' class="nav-link on"' : ' class="nav-link"'; }

  function megaMenu(){
    var cols = engines.map(function(e, idx){
      var items = e.groups.reduce(function(a,g){ return a.concat(g.items); }, []).slice(0,7);
      var li = items.map(function(t){ return '<li><a href="sub-service.html">'+t+'</a></li>'; }).join('');
      return '<div class="mega-col" data-n="'+(idx+1)+'">'+
        '<span class="num">'+e.num+'</span>'+
        '<h5>'+e.name+'</h5>'+
        '<p class="promise">'+e.promise+'</p>'+
        '<ul>'+li+'</ul>'+
        '<a class="view-all" href="'+e.href+'">View all &rarr;</a>'+
      '</div>';
    }).join('');
    return '<div class="mega" role="menu" aria-label="Services">'+
      '<div class="mega-grid">'+cols+'</div>'+
      '<div class="mega-rail">'+
        '<div class="thumb" aria-hidden="true"></div>'+
        '<div class="txt"><span class="tag">Featured case</span><h6>3.4&times; qualified pipeline in two quarters</h6><p>B2B SaaS · Series B &middot; <a href="case-study.html" style="color:inherit;text-decoration:underline">Read the case &rarr;</a></p></div>'+
      '</div>'+
    '</div>';
  }

  function industryDropdown(){
    var links = industries.map(function(i){
      return '<a href="industry.html">'+i+'</a>';
    }).join('');
    return '<div class="dropdown" role="menu" aria-label="Industries">'+links+'</div>';
  }

  function drawerServices(){
    return engines.map(function(e){
      var items = e.groups.reduce(function(a,g){ return a.concat(g.items); }, []).slice(0,6);
      var li = items.map(function(t){ return '<a href="sub-service.html">'+t+'</a>'; }).join('');
      var subId = 'd-eng-'+e.id;
      return '<div class="d-engine-block">'+
        '<button class="d-engine" data-toggle="'+subId+'" aria-expanded="false">'+e.num+' &middot; '+e.name+
          ' <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'+
        '<div class="d-sub" id="'+subId+'">'+
          li + '<a href="'+e.href+'" style="font-weight:600;color:var(--violet)">View engine &rarr;</a>'+
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
        '<li class="nav-item"><a href="services.html"'+isOn('services')+'>Services <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'+megaMenu()+'</li>'+
        '<li class="nav-item"><a href="work.html"'+isOn('work')+'>Work</a></li>'+
        '<li class="nav-item"><a href="industry.html"'+isOn('industries')+'>Industries <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'+industryDropdown()+'</li>'+
        '<li class="nav-item"><a href="about.html"'+isOn('about')+'>About</a></li>'+
        '<li class="nav-item"><a href="insights.html"'+isOn('insights')+'>Insights</a></li>'+
      '</ul>'+
      '<div class="nav-actions">'+
        '<a href="careers.html" class="btn btn-ghost" style="padding:10px 16px">Careers</a>'+
        '<a href="contact.html" class="btn btn-primary" style="padding:10px 18px">Contact</a>'+
        '<button class="hamburger" id="hamburgerBtn" aria-expanded="false" aria-label="Open menu" aria-controls="mobileDrawer"><span></span></button>'+
      '</div>'+
    '</div>'+
  '</nav>'+
  '<aside class="drawer" id="mobileDrawer" aria-hidden="true">'+
    '<div class="drawer-top"><span class="mark">Omni<span>Mark</span></span><button class="drawer-close" id="drawerClose" aria-label="Close menu">&times;</button></div>'+
    '<nav>'+
      '<ul>'+
        '<li><button class="d-link" data-toggle="d-services" aria-expanded="false">Services <svg class="nav-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'+
          '<div class="d-sub" id="d-services">'+drawerServices()+'</div>'+
        '</li>'+
        '<li><a class="d-link" href="work.html">Work</a></li>'+
        '<li><a class="d-link" href="industry.html">Industries</a></li>'+
        '<li><a class="d-link" href="about.html">About</a></li>'+
        '<li><a class="d-link" href="insights.html">Insights</a></li>'+
        '<li><a class="d-link" href="careers.html">Careers</a></li>'+
      '</ul>'+
    '</nav>'+
    '<a href="contact.html" class="btn btn-primary btn-block" style="margin-top:22px">Contact</a>'+
  '</aside>';

  var yearNow = new Date().getFullYear();
  var footer =
  '<div class="wrap">'+
    '<div class="footer-top">'+
      '<div class="newsletter-block">'+
        '<div class="mark" style="color:#fff;margin-bottom:14px">Omni<span>Mark</span></div>'+
        '<p style="max-width:32ch;font-size:14px">One accountable team across the whole path to purchase — brand, media, platforms and sales.</p>'+
        '<div class="nb-title" style="margin-top:22px">The Signal</div>'+
        '<p style="font-size:13px;margin-bottom:0">One email every other Tuesday on what\'s actually working in B2B demand.</p>'+
        '<form class="nl-row" id="newsletterForm" novalidate>'+
          '<label class="visually-hidden" for="nl-email" style="position:absolute;left:-9999px">Email address</label>'+
          '<input type="email" id="nl-email" placeholder="you@company.com" required>'+
          '<button type="submit" class="btn btn-primary">Subscribe</button>'+
        '</form>'+
        '<p id="nlSuccess" style="display:none;color:var(--signal);font-size:13px;margin-top:10px">Subscribed. Watch your inbox.</p>'+
      '</div>'+
      '<div><h6>Services</h6><ul>'+
        engines.map(function(e){ return '<li><a href="'+e.href+'">'+e.name+'</a></li>'; }).join('')+
      '</ul></div>'+
      '<div><h6>Company</h6><ul>'+
        '<li><a href="about.html">About</a></li>'+
        '<li><a href="work.html">Work</a></li>'+
        '<li><a href="careers.html">Careers</a></li>'+
        '<li><a href="contact.html">Contact</a></li>'+
      '</ul></div>'+
      '<div><h6>Resources</h6><ul>'+
        '<li><a href="insights.html">Insights</a></li>'+
        '<li><a href="industry.html">Industries</a></li>'+
        '<li><a href="geo.html">Markets</a></li>'+
        '<li><a href="services.html">All services</a></li>'+
      '</ul></div>'+
      '<div><h6>Connect</h6><ul>'+
        '<li><a href="mailto:hello@omnimark.com">hello@omnimark.com</a></li>'+
        '<li><a href="tel:+18005551234">+1 (800) 555-1234</a></li>'+
        '<li><a href="https://www.linkedin.com" target="_blank" rel="noopener">LinkedIn</a></li>'+
        '<li style="color:var(--panel-muted)">400 Commerce St, Austin, TX</li>'+
      '</ul></div>'+
    '</div>'+
    '<div class="footer-legal">'+
      '<span>&copy; '+yearNow+' OmniMark. All rights reserved.</span>'+
      '<div class="links">'+
        '<a href="#" style="color:var(--panel-muted)">Privacy Policy</a>'+
        '<a href="#" style="color:var(--panel-muted)">Terms</a>'+
        '<a href="#" id="cookiePrefsLink" style="color:var(--panel-muted)">Cookie Preferences</a>'+
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
