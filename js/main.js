/* Shared interaction layer: nav, drawer, accordions, forms, filters,
   testimonial nav, cookie banner, reveal-on-scroll. Loaded after
   partials.js on every page. Respects prefers-reduced-motion throughout. */
(function(){
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* feature flags + settings saved from the admin dashboard (js/site-config.js) */
  var flags = (window.OmniSite && window.OmniSite.flags()) || {};
  var siteCfg = (window.OmniSite && window.OmniSite.get()) || {};
  function on(flag){ return flags[flag] !== false; }
  function editing(){ return document.documentElement.classList.contains('omni-editing'); }
  function t(key, fallback){ var v = window.OmniI18n && window.OmniI18n.t(key); return v == null ? fallback : v; }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function postJSON(url, data){
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(j){
          if(!r.ok){
            var err = new Error(j.error || ('HTTP ' + r.status));
            err.fields = j.fields || null;
            throw err;
          }
          return j;
        });
      });
  }

  function init(){
    initNavToggles();
    initDrawer();
    initAccordions();
    initFaq();
    initTestimonials();
    initForms();
    initScheduler();
    initShare();
    initFilters();
    initCookieBanner();
    initStagger();
    initReveal();
    initProcessLine();
    initSideNav();
    initCursor();
    initMagnetic();
    initKinetic();
    initMarquee();
    initCountUp();
  }

  /* ---------- desktop nav-item toggles (mega menu / industries dropdown) ---------- */
  function initNavToggles(){
    var items = document.querySelectorAll('.nav-item');
    if(!items.length) return;
    function closeAll(except){
      items.forEach(function(it){
        if(it===except) return;
        it.classList.remove('open');
        var a = it.querySelector(':scope > a[aria-haspopup]');
        if(a) a.setAttribute('aria-expanded','false');
      });
    }
    items.forEach(function(item){
      var trigger = item.querySelector(':scope > a');
      if(!trigger) return;
      trigger.addEventListener('click', function(e){
        var panel = item.querySelector('.mega, .dropdown');
        if(!panel) return; // plain link, let it navigate
        e.preventDefault();
        var willOpen = !item.classList.contains('open');
        closeAll();
        item.classList.toggle('open', willOpen);
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.nav-item')) closeAll();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') closeAll();
    });
  }

  /* ---------- mobile drawer ---------- */
  function initDrawer(){
    var btn = document.getElementById('hamburgerBtn');
    var drawer = document.getElementById('mobileDrawer');
    var scrim = document.getElementById('drawerScrim');
    var closeBtn = document.getElementById('drawerClose');
    if(!btn || !drawer) return;
    var lastFocus = null;
    var inertState = [];
    function setBackgroundInert(makeInert){
      if(makeInert){
        inertState = [];
        var targets = Array.prototype.slice.call(document.querySelectorAll('body > :not(#site-header):not(script):not(style):not(noscript), #site-header .topnav'));
        targets.forEach(function(node){
          inertState.push({ node: node, inert: node.inert });
          node.inert = true;
        });
      } else {
        inertState.forEach(function(entry){ entry.node.inert = entry.inert; });
        inertState = [];
      }
    }
    function focusables(){
      return Array.prototype.filter.call(drawer.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'), function(el){ return el.offsetParent !== null; });
    }
    function open(){
      lastFocus = document.activeElement;
      drawer.inert = false;
      setBackgroundInert(true);
      drawer.classList.add('open'); scrim.classList.add('open');
      btn.setAttribute('aria-expanded','true'); drawer.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
      var f = focusables();
      if(f.length) setTimeout(function(){ f[0].focus(); }, 30);
    }
    function close(){
      if(!drawer.classList.contains('open')) return;
      drawer.classList.remove('open'); scrim.classList.remove('open');
      btn.setAttribute('aria-expanded','false'); drawer.setAttribute('aria-hidden','true');
      drawer.inert = true;
      setBackgroundInert(false);
      document.body.style.overflow = '';
      if(lastFocus && lastFocus.focus) lastFocus.focus();
    }
    /* keep Tab inside the open drawer (it is a modal dialog) */
    drawer.addEventListener('keydown', function(e){
      if(e.key !== 'Tab') return;
      var f = focusables(); if(!f.length) return;
      var first = f[0], last = f[f.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    btn.addEventListener('click', function(){ drawer.classList.contains('open') ? close() : open(); });
    if(closeBtn) closeBtn.addEventListener('click', close);
    if(scrim) scrim.addEventListener('click', close);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
    drawer.querySelectorAll('[data-toggle]').forEach(function(t){
      t.addEventListener('click', function(){
        var target = document.getElementById(t.getAttribute('data-toggle'));
        if(!target) return;
        var open2 = target.classList.toggle('open');
        t.setAttribute('aria-expanded', open2 ? 'true':'false');
        target.inert = !open2;
      });
    });
  }

  /* ---------- services accordion (engine rows) ---------- */
  function initAccordions(){
    /* keeps the class and the button's aria-expanded in step */
    function setOpen(row, open){
      row.classList.toggle('open', open);
      var head = row.querySelector('.eng-head');
      if(head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
      var panel = row.querySelector('.eng-panel');
      if(panel){ panel.setAttribute('aria-hidden', open ? 'false' : 'true'); panel.inert = !open; }
    }
    function openOnly(target){
      target.parentElement.querySelectorAll('.eng-row').forEach(function(r){ setOpen(r, r === target); });
    }
    document.querySelectorAll('.eng-row').forEach(function(row){
      var head = row.querySelector('.eng-head');
      if(!head) return;
      setOpen(row, row.classList.contains('open'));
      head.addEventListener('click', function(){
        var willOpen = !row.classList.contains('open');
        if(willOpen) openOnly(row); else setOpen(row, false);
      });
    });
    var hash = location.hash.replace('#','');
    if(hash){
      var target = document.getElementById(hash);
      if(target && target.classList.contains('eng-row')){
        openOnly(target);
        setTimeout(function(){ target.scrollIntoView({block:'start'}); }, 50);
      }
    }
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq(){
    document.querySelectorAll('.faq-item').forEach(function(item, i){
      var q = item.querySelector('.faq-q');
      if(!q||q.hasAttribute('data-faq-bound')) return;q.setAttribute('data-faq-bound','');
      var a = item.querySelector('.faq-a');
      if(a){
        if(!a.id){var serial=i+1;while(document.getElementById('faq-a-'+serial))serial++;a.id='faq-a-'+serial;}
        q.setAttribute('aria-controls', a.id);
        a.setAttribute('aria-hidden', item.classList.contains('open') ? 'false' : 'true');
        a.inert = !item.classList.contains('open');
      }
      q.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
      q.addEventListener('click', function(){
        var open = item.classList.toggle('open');
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(a){ a.setAttribute('aria-hidden', open ? 'false' : 'true'); a.inert = !open; }
      });
    });
  }

  /* ---------- testimonial manual nav (no autoplay) ---------- */
  function initTestimonials(){
    var wrap = document.querySelector('[data-testi]');
    if(!wrap || wrap.getAttribute('data-testi-bound')==='true') return;
    wrap.setAttribute('data-testi-bound','true');
    var slides = Array.prototype.slice.call(wrap.querySelectorAll('.testi-slide'));
    if(slides.length < 2) return;
    var idx = 0;
    function show(n){
      idx = (n + slides.length) % slides.length;
      slides.forEach(function(s,i){ s.style.display = i===idx ? '' : 'none'; });
    }
    show(0);
    var prev = wrap.querySelector('[data-testi-prev]');
    var next = wrap.querySelector('[data-testi-next]');
    if(prev) prev.addEventListener('click', function(){ show(idx-1); });
    if(next) next.addEventListener('click', function(){ show(idx+1); });
  }

  /* ---------- forms: validation + inline success, no redirect ---------- */
  function initForms(){
    document.querySelectorAll('form.validate-form').forEach(function(form){
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var valid = true, firstBad = null;
        form.querySelectorAll('[required]').forEach(function(input){
          var field = input.closest('.field') || input.parentElement;
          if (field.closest('[data-omni-hidden-element]')) {field.classList.remove('error');input.removeAttribute('aria-invalid');return;}
          var ok = input.type === 'checkbox' ? input.checked : input.value.trim().length > 0;
          if(input.type === 'email' && ok){ ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value); }
          field.classList.toggle('error', !ok);
          input.setAttribute('aria-invalid', ok ? 'false' : 'true');
          var msg = field.querySelector('.err-msg');
          if(msg){
            if(!msg.id) msg.id = (input.id || input.name || 'field') + '-err';
            if(ok) input.removeAttribute('aria-describedby'); else input.setAttribute('aria-describedby', msg.id);
          }
          if(!ok){ valid = false; if(!firstBad) firstBad = input; }
        });
        if(!valid){ if(firstBad) firstBad.focus(); return; }
        var btn = form.querySelector('button[type="submit"]');
        var successId = form.getAttribute('data-success');
        var success = successId ? document.getElementById(successId) : null;
        var errEl = form.querySelector('.form-error');
        if(!errEl){ errEl = document.createElement('p'); errEl.className = 'form-error'; errEl.setAttribute('role','alert'); form.appendChild(errEl); }
        errEl.classList.remove('show');
        /* POST to server.js → data/submissions.json, visible in the admin */
        var payload = {
          form: form.getAttribute('data-form') || (successId || 'form').replace(/Success$/, ''),
          lang: document.documentElement.lang || 'en',
          page: location.pathname
        };
        Array.prototype.forEach.call(form.elements, function(el){
          if(!el.name || el.disabled || el.closest('[data-omni-hidden-element]')) return;
          payload[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        });
        if(btn){ btn.classList.add('btn-loading'); btn.disabled = true; }
        postJSON('api/submit', payload).then(function(){
          if(btn){ btn.classList.remove('btn-loading'); btn.disabled = false; }
          if(success){
            form.style.display = 'none';
            success.classList.add('show');
            success.setAttribute('tabindex','-1');
            success.focus();
          } else {
            form.reset();
          }
        }).catch(function(err){
          if(btn){ btn.classList.remove('btn-loading'); btn.disabled = false; }
          if(err.fields){
            var firstServerBad = null;
            Object.keys(err.fields).forEach(function(name){
              var input = form.elements.namedItem(name);
              if(!input || !input.closest) return;
              var field = input.closest('.field') || input.parentElement;
              field.classList.add('error'); input.setAttribute('aria-invalid', 'true');
              var msg = field.querySelector('.err-msg');
              if(msg){ if(!msg.id) msg.id = (input.id || name) + '-err'; input.setAttribute('aria-describedby', msg.id); }
              if(!firstServerBad) firstServerBad = input;
            });
            if(firstServerBad) firstServerBad.focus();
            return;
          }
          var email = (siteCfg.settings && siteCfg.settings.email) || 'hello@omnimark.com';
          errEl.textContent = t('forms.error', 'We could not send that. Please try again, or email us at') + ' ' + email + '.';
          errEl.classList.add('show');
        });
      });
      form.querySelectorAll('[required]').forEach(function(input){
        input.addEventListener('input', function(){
          var field = input.closest('.field') || input.parentElement;
          field.classList.remove('error');
          input.setAttribute('aria-invalid', 'false');
          input.removeAttribute('aria-describedby');
        });
      });
    });
  }

  /* ---------- meeting scheduler (contact page) — iframe from Settings, or the
     whole block is removed rather than showing a placeholder ---------- */
  function initScheduler(){
    var box = document.querySelector('[data-scheduler]');
    if(!box) return;
    var url = (siteCfg.settings && siteCfg.settings.schedulerUrl) || '';
    if(/^https:\/\//i.test(url)){
      box.innerHTML = '';
      var f = document.createElement('iframe');
      f.src = url; f.loading = 'lazy'; f.title = 'Meeting scheduler';
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      box.appendChild(f);
      document.querySelectorAll('[data-scheduler-hidden]').forEach(function(el){ el.parentNode.removeChild(el); });
    } else {
      document.querySelectorAll('[data-scheduler-only]').forEach(function(el){ el.parentNode.removeChild(el); });
      box.parentNode.removeChild(box);
    }
  }

  /* ---------- article sharing ---------- */
  function initShare(){
    var linkedIn = document.querySelector('[data-share="linkedin"]');
    var x = document.querySelector('[data-share="x"]');
    var copy = document.querySelector('[data-share="copy"]');
    if(!linkedIn && !x && !copy) return;
    var canonical = document.querySelector('link[rel="canonical"]');
    var url = (canonical && canonical.href) || location.href;
    if(linkedIn) linkedIn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
    if(x) x.href = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(document.title);
    if(copy) copy.addEventListener('click', function(){
      function done(){
        var status = document.getElementById('copyStatus');
        if(status) status.textContent = t('article.linkCopied', 'Article link copied.');
      }
      function fallback(){
        var field = document.createElement('textarea');
        field.value = url; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.appendChild(field); field.select();
        try { document.execCommand('copy'); done(); } catch(e) {}
        document.body.removeChild(field);
      }
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(fallback); }
      else fallback();
    });
  }

  /* ---------- filter chips (work index, industries) ---------- */
  function initFilters(){
    var bar = document.querySelector('.filters');
    if(!bar) return;
    var buttons = Array.prototype.slice.call(bar.querySelectorAll('button'));
    buttons.forEach(function(b){
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
      if(b.getAttribute('data-filter-bound')==='true')return;b.setAttribute('data-filter-bound','true');
      b.addEventListener('click', function(){
        var cards = document.querySelectorAll('[data-industry]');
        buttons.forEach(function(x){ x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
        b.classList.add('active'); b.setAttribute('aria-pressed','true');
        var f = b.getAttribute('data-filter');
        cards.forEach(function(c){
          var show = f === 'all' || c.getAttribute('data-industry') === f;
          c.classList.toggle('hide', !show);
        });
        var empty = document.getElementById('workEmpty');
        if(empty){
          var anyVisible = Array.prototype.some.call(cards, function(c){ return !c.classList.contains('hide'); });
          empty.classList.toggle('hide', anyVisible);
        }
      });
    });
  }

  /* ---------- cookie consent banner ---------- */
  /* analytics is only ever loaded here — after consent, or when the owner
     has switched the banner off in the admin (their call, documented there) */
  var analyticsLoaded = false;
  function loadAnalytics(){
    if(analyticsLoaded) return;
    var a = siteCfg.analytics || {};
    if(!a.gaId && !a.consentScript) return;
    analyticsLoaded = true;
    if(a.gaId && /^(G|UA|AW)-[A-Z0-9-]+$/i.test(a.gaId)){
      var s = document.createElement('script');
      s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(a.gaId);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', a.gaId, { anonymize_ip: true });
    }
    if(a.consentScript){
      /* owner-pasted snippet (GTM, Meta pixel, …) — scripts set via innerHTML
         don't execute, so re-create each one */
      var tmp = document.createElement('div'); tmp.innerHTML = a.consentScript;
      Array.prototype.forEach.call(tmp.querySelectorAll('script'), function(old){
        var sc = document.createElement('script');
        Array.prototype.forEach.call(old.attributes, function(at){ sc.setAttribute(at.name, at.value); });
        sc.text = old.textContent;
        document.head.appendChild(sc);
      });
    }
  }
  function initCookieBanner(){
    var banner = document.getElementById('cookieBanner');
    var KEY = 'om-consent';
    if(!on('cookieBanner')){
      if(banner) banner.parentNode.removeChild(banner);
      loadAnalytics();
      return;
    }
    if(!banner) return;
    function reopen(){
      banner.classList.add('show');
    }
    try{
      var existing = localStorage.getItem(KEY);
      if(existing === 'granted') loadAnalytics();
      if(!existing) setTimeout(function(){ banner.classList.add('show'); }, 900);
    }catch(e){ banner.classList.add('show'); }
    var accept = banner.querySelector('[data-consent-accept]');
    var reject = banner.querySelector('[data-consent-reject]');
    function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} banner.classList.remove('show'); }
    if(accept) accept.addEventListener('click', function(){ set('granted'); loadAnalytics(); });
    if(reject) reject.addEventListener('click', function(){ set('denied'); });
    document.addEventListener('click', function(e){
      if(e.target && e.target.id === 'cookiePrefsLink'){ e.preventDefault(); reopen(); }
    });
  }

  /* ---------- reveal-on-scroll ---------- */
  function initReveal(){
    if(editing()) return;
    var els = document.querySelectorAll('.reveal');
    if(!els.length) return;
    if(reduceMotion || !on('reveal') || !('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  /* ---------- process connecting line ---------- */
  function initProcessLine(){
    if(editing()) return;
    var track = document.querySelector('.process-track');
    var line = document.querySelector('.process-line');
    if(!track || !line) return;
    if(reduceMotion){
      var isVert = window.innerWidth <= 820;
      if(isVert) line.style.height = '100%'; else line.style.width = '88%';
      return;
    }
    var done = false;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting && !done){
          done = true;
          var isVertical = window.innerWidth <= 820;
          if(isVertical) line.style.height = '100%'; else line.style.width = '88%';
        }
      });
    }, { threshold: .3 });
    io.observe(track);
  }

  /* ---------- sticky side-nav scrollspy (service detail pages) ---------- */
  function initSideNav(){
    var nav = document.querySelector('.side-nav');
    if(!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
    var targets = links.map(function(l){ return document.querySelector(l.getAttribute('href')); }).filter(Boolean);
    if(!targets.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          links.forEach(function(l){ l.classList.remove('on'); });
          var m = links.filter(function(l){ return l.getAttribute('href') === '#'+en.target.id; })[0];
          if(m) m.classList.add('on');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    targets.forEach(function(t){ io.observe(t); });
  }

  /* ---------- stagger — assigns --i to children of .stagger containers
     so .reveal's transition-delay fans siblings out instead of firing
     as one flat block ---------- */
  function initStagger(){
    document.querySelectorAll('.stagger').forEach(function(group){
      Array.prototype.forEach.call(group.children, function(child, i){
        child.style.setProperty('--i', i);
      });
    });
  }

  /* ---------- custom magnetic cursor (fine pointer + hover only) ---------- */
  function initCursor(){
    if(editing()) return;
    if(reduceMotion || !on('customCursor')) return;
    if(!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var dot = document.createElement('div'); dot.id = 'cursorDot';
    var ring = document.createElement('div'); ring.id = 'cursorRing';
    document.body.appendChild(dot); document.body.appendChild(ring);
    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', function(e){
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate('+mx+'px,'+my+'px) translate(-50%,-50%)';
    }, { passive: true });
    (function raf(){
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = 'translate('+rx+'px,'+ry+'px) translate(-50%,-50%)';
      requestAnimationFrame(raf);
    })();
    var big = 'a, button, .chip, .card, .case-card, .cross-card, .team-card, .eng-head, [role="button"]';
    document.addEventListener('mouseover', function(e){
      if(e.target.closest(big)) ring.classList.add('big');
    });
    document.addEventListener('mouseout', function(e){
      if(e.target.closest(big)) ring.classList.remove('big');
    });
    document.addEventListener('mouseleave', function(){ ring.style.opacity = '0'; dot.style.opacity = '0'; });
    document.addEventListener('mouseenter', function(){ ring.style.opacity = '1'; dot.style.opacity = '1'; });
  }

  /* ---------- magnetic buttons — pull toward the cursor within bounds ---------- */
  function initMagnetic(){
    if(editing()) return;
    if(reduceMotion || !on('magneticButtons')) return;
    if(!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    document.querySelectorAll('.btn-primary, .btn-shine').forEach(function(el){
      if(el.classList.contains('btn-block')) return; // full-width buttons shouldn't drift
      el.classList.add('magnetic');
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width/2, y = e.clientY - r.top - r.height/2;
        el.style.transform = 'translate('+(x*0.22)+'px,'+(y*0.32)+'px)';
      });
      el.addEventListener('mouseleave', function(){ el.style.transform = ''; });
    });
  }

  /* ---------- kinetic headline — splits .kinetic text into staggered word spans ---------- */
  function initKinetic(){
    if(editing()) return;
    if(!on('kineticHeadlines')) return;
    document.querySelectorAll('.kinetic').forEach(function(el){
      if(el.dataset.kineticDone) return;
      el.dataset.kineticDone = '1';
      var words = el.textContent.split(' ');
      el.innerHTML = words.map(function(w, i){
        return '<span class="kw" style="--i:'+i+'">'+escapeHtml(w)+(i < words.length-1 ? '&nbsp;' : '')+'</span>';
      }).join('');
    });
  }

  /* ---------- marquee — duplicates track content once for a seamless loop ---------- */
  function initMarquee(){
    if(editing()) return;
    if(!on('marquee')) return;
    document.querySelectorAll('.marquee-track').forEach(function(track){
      if(track.dataset.marqueeDone) return;
      track.dataset.marqueeDone = '1';
      track.innerHTML += track.innerHTML;
    });
  }

  /* ---------- count-up stats — animates .stat-fig from 0 up to whatever
     number is already in the markup, so a no-JS or reduced-motion visitor
     just sees the static final figure exactly as authored ---------- */
  function initCountUp(){
    if(editing()) return;
    var figs = document.querySelectorAll('.stat-fig');
    if(!figs.length || reduceMotion || !on('countUp') || !('IntersectionObserver' in window)) return;
    function animate(el){
      var target = el.textContent.trim();
      var num = parseFloat(target.replace(/[^0-9.]/g, ''));
      if(isNaN(num)) return;
      var prefix = target.match(/^[^0-9]*/)[0];
      var suffix = target.match(/[0-9.]*([^0-9]*)$/)[1];
      var start = performance.now(), dur = 1200;
      function step(now){
        var p = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = Math.round(num * eased);
        el.textContent = prefix + val + suffix;
        if(p < 1) requestAnimationFrame(step); else el.textContent = target;
      }
      requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ animate(en.target); io.unobserve(en.target); }
      });
    }, { threshold: .5 });
    figs.forEach(function(el){ io.observe(el); });
  }

  /* newsletter form in footer is injected after partials load */
  document.addEventListener('omni:partials-ready', function(){
    var nl = document.getElementById('newsletterForm');
    if(!nl) return;
    var input = document.getElementById('nl-email');
    var validation = document.getElementById('nlValidation');
    input.addEventListener('input', function(){ input.setAttribute('aria-invalid', 'false'); if(validation) validation.style.display = 'none'; });
    nl.addEventListener('submit', function(e){
      e.preventDefault();
      if(!input.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        input.setAttribute('aria-invalid', 'true');
        if(validation) validation.style.display = 'block';
        input.focus(); return;
      }
      var ok = document.getElementById('nlSuccess');
      var err = document.getElementById('nlError');
      var btn = nl.querySelector('button[type="submit"]');
      input.setAttribute('aria-invalid', 'false');
      if(validation) validation.style.display = 'none';
      if(err) err.style.display = 'none';
      if(btn){ btn.classList.add('btn-loading'); btn.disabled = true; }
      postJSON('api/submit', { form: 'newsletter', email: input.value, lang: document.documentElement.lang || 'en', page: location.pathname })
        .then(function(){
          nl.style.display = 'none';
          if(ok) ok.style.display = 'block';
        })
        .catch(function(failure){
          if(btn){ btn.classList.remove('btn-loading'); btn.disabled = false; }
          if(failure.fields && failure.fields.email){ input.setAttribute('aria-invalid', 'true'); if(validation) validation.style.display = 'block'; }
          else if(err) err.style.display = 'block';
        });
    });
  });

  /* a language switch rewrites every headline (i18n sets textContent),
     which wipes the kinetic word spans — split them again */
  document.addEventListener('omni:lang-changed', function(){
    document.querySelectorAll('.kinetic').forEach(function(el){ delete el.dataset.kineticDone; });
    initKinetic();
  });
  document.addEventListener('omni:additions-ready', initFaq);
  document.addEventListener('omni:collections-ready', function(){ initFilters();initTestimonials();initReveal(); });

  /* partials.js (loaded before this file) injects header/footer on its own
     DOMContentLoaded listener, which — registered first — runs before this
     one, so the DOM is already complete by the time init() binds events. */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
