/* Shared interaction layer: nav, drawer, accordions, forms, filters,
   testimonial nav, cookie banner, reveal-on-scroll. Loaded after
   partials.js on every page. Respects prefers-reduced-motion throughout. */
(function(){
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(){
    initNavToggles();
    initDrawer();
    initAccordions();
    initFaq();
    initTestimonials();
    initForms();
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
      items.forEach(function(it){ if(it!==except) it.classList.remove('open'); });
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
        if(willOpen) item.classList.add('open');
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
    function open(){
      drawer.classList.add('open'); scrim.classList.add('open');
      btn.setAttribute('aria-expanded','true'); drawer.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    }
    function close(){
      drawer.classList.remove('open'); scrim.classList.remove('open');
      btn.setAttribute('aria-expanded','false'); drawer.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    }
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
      });
    });
  }

  /* ---------- services accordion (engine rows) ---------- */
  function initAccordions(){
    document.querySelectorAll('.eng-row').forEach(function(row){
      var head = row.querySelector('.eng-head');
      if(!head) return;
      head.addEventListener('click', function(){
        var willOpen = !row.classList.contains('open');
        row.parentElement.querySelectorAll('.eng-row').forEach(function(r){ r.classList.remove('open'); });
        if(willOpen) row.classList.add('open');
      });
    });
    var hash = location.hash.replace('#','');
    if(hash){
      var target = document.getElementById(hash);
      if(target && target.classList.contains('eng-row')){
        target.parentElement.querySelectorAll('.eng-row').forEach(function(r){ r.classList.remove('open'); });
        target.classList.add('open');
        setTimeout(function(){ target.scrollIntoView({block:'start'}); }, 50);
      }
    }
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq(){
    document.querySelectorAll('.faq-item').forEach(function(item){
      var q = item.querySelector('.faq-q');
      if(!q) return;
      q.addEventListener('click', function(){ item.classList.toggle('open'); });
    });
  }

  /* ---------- testimonial manual nav (no autoplay) ---------- */
  function initTestimonials(){
    var wrap = document.querySelector('[data-testi]');
    if(!wrap) return;
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
        var valid = true;
        form.querySelectorAll('[required]').forEach(function(input){
          var field = input.closest('.field') || input.parentElement;
          var ok = input.type === 'checkbox' ? input.checked : input.value.trim().length > 0;
          if(input.type === 'email' && ok){ ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value); }
          field.classList.toggle('error', !ok);
          if(!ok) valid = false;
        });
        if(!valid) return;
        var btn = form.querySelector('button[type="submit"]');
        var successId = form.getAttribute('data-success');
        var success = successId ? document.getElementById(successId) : null;
        if(btn){ btn.classList.add('btn-loading'); btn.disabled = true; }
        setTimeout(function(){
          if(btn){ btn.classList.remove('btn-loading'); btn.disabled = false; }
          if(success){
            form.style.display = 'none';
            success.classList.add('show');
            success.setAttribute('tabindex','-1');
            success.focus();
          } else {
            form.reset();
          }
        }, 700);
      });
      form.querySelectorAll('[required]').forEach(function(input){
        input.addEventListener('input', function(){
          var field = input.closest('.field') || input.parentElement;
          field.classList.remove('error');
        });
      });
    });
  }

  /* ---------- filter chips (work index, industries) ---------- */
  function initFilters(){
    var bar = document.querySelector('.filters');
    if(!bar) return;
    var buttons = Array.prototype.slice.call(bar.querySelectorAll('button'));
    var cards = document.querySelectorAll('[data-industry]');
    buttons.forEach(function(b){
      b.addEventListener('click', function(){
        buttons.forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
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
  function initCookieBanner(){
    var banner = document.getElementById('cookieBanner');
    if(!banner) return;
    var KEY = 'om-consent';
    function reopen(){
      banner.classList.add('show');
    }
    try{
      if(!localStorage.getItem(KEY)) setTimeout(function(){ banner.classList.add('show'); }, 900);
    }catch(e){ banner.classList.add('show'); }
    var accept = banner.querySelector('[data-consent-accept]');
    var reject = banner.querySelector('[data-consent-reject]');
    function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} banner.classList.remove('show'); }
    if(accept) accept.addEventListener('click', function(){ set('granted'); });
    if(reject) reject.addEventListener('click', function(){ set('denied'); });
    document.addEventListener('click', function(e){
      if(e.target && e.target.id === 'cookiePrefsLink'){ e.preventDefault(); reopen(); }
    });
  }

  /* ---------- reveal-on-scroll ---------- */
  function initReveal(){
    var els = document.querySelectorAll('.reveal');
    if(!els.length) return;
    if(reduceMotion || !('IntersectionObserver' in window)){
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
    if(reduceMotion) return;
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
    if(reduceMotion) return;
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
    document.querySelectorAll('.kinetic').forEach(function(el){
      if(el.dataset.kineticDone) return;
      el.dataset.kineticDone = '1';
      var words = el.textContent.split(' ');
      el.innerHTML = words.map(function(w, i){
        return '<span class="kw" style="--i:'+i+'">'+w+(i < words.length-1 ? '&nbsp;' : '')+'</span>';
      }).join('');
    });
  }

  /* ---------- marquee — duplicates track content once for a seamless loop ---------- */
  function initMarquee(){
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
    var figs = document.querySelectorAll('.stat-fig');
    if(!figs.length || reduceMotion || !('IntersectionObserver' in window)) return;
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
    nl.addEventListener('submit', function(e){
      e.preventDefault();
      var input = document.getElementById('nl-email');
      if(!input.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { input.focus(); return; }
      var ok = document.getElementById('nlSuccess');
      nl.style.display = 'none';
      if(ok) ok.style.display = 'block';
    });
  });

  /* partials.js (loaded before this file) injects header/footer on its own
     DOMContentLoaded listener, which — registered first — runs before this
     one, so the DOM is already complete by the time init() binds events. */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
