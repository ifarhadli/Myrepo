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
    }
    /* Moving an existing tag to the end keeps runtime overrides after the
       page stylesheet once the document has finished parsing. */
    (document.head || document.documentElement).appendChild(el);
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

  var sharedElements = '#site-header, #site-footer, #cookieBanner, .mega, .drawer';
  var editorChrome = '.omni-bar,.omni-panel,.omni-dialog,.omni-action-sheet,.omni-mini-tools,.omni-element-tools,.omni-section-tools,.omni-item-tools,.omni-collection-tools,.omni-touch-menu,.omni-image-action,.omni-item-toolbar';
  var blockContainers='.wrap,.wrap > div,.split > div,.eng-panel-in,.article-body,.rich-copy,.cta-grid > div';
  var ALLOWED_DROPS={paragraph:blockContainers,block:blockContainers,button:'.btn-row,'+blockContainers,bullet:'ul,ol',stat:'.stat-row',faq:'.faq-list',step:'.process-track',card:'.grid-2,.grid-3,.claim-cards'};
  var elementBaselines=new Map();
  function elementKind(target){
    if(target.matches('.btn,.btn-text'))return 'button';
    if(target.matches('li'))return 'bullet';
    if(target.matches('.stat,.stat-row > div'))return 'stat';
    if(target.matches('.faq-item'))return 'faq';if(target.matches('.pstep'))return 'step';
    if(target.matches('.card'))return 'card';return 'block';
  }
  function allowedContainer(kind,container){
    return !!container&&!!ALLOWED_DROPS[kind]&&container.matches(ALLOWED_DROPS[kind])&&!container.closest('form,.field,.checkfield,#site-header,#site-footer,#cookieBanner,.mega,.drawer,'+editorChrome)&&!!container.closest('[data-section],.article-body');
  }
  function findElements(address){
    if(!window.OmniElementRules.address(address))return [];
    var key=address.slice(address.indexOf(':')+1),out=[];
    document.querySelectorAll('[data-i18n],[data-hide-key]').forEach(function(el){
      if(el.getAttribute('data-i18n')!==key&&el.getAttribute('data-hide-key')!==key)return;
      var info=elementRemovalInfo(el);if(info&&info.id===address&&out.indexOf(info.target)<0)out.push(info.target);
    });return out;
  }
  function elementLinkTarget(target){return target&&(target.matches('a')?target:target.querySelector('a'));}
  function canChangeElement(target){return !!target&&!removalProtection(target)&&!target.closest('form,.field,.checkfield,'+editorChrome);}
  function elementTemplate(kind,scope,id){
    var key='added.'+id,el=document.createElement(kind==='paragraph'?'p':kind==='bullet'?'li':kind==='button'?'a':'div');
    var templates={stat:'<div class="stat-fig" data-hide-key="'+key+'.fig" data-i18n="'+key+'.fig">0</div><div class="stat-lab" data-i18n="'+key+'"></div>',faq:'<button type="button" class="faq-q"><span data-i18n="'+key+'.q"></span><span aria-hidden="true">+</span></button><div class="faq-a"><div class="faq-a-in" data-i18n="'+key+'.a"></div></div>',step:'<span class="dot" aria-hidden="true">+</span><h4 data-i18n="'+key+'.t"></h4><p data-i18n="'+key+'.d"></p>',card:'<span class="tag" data-i18n="'+key+'.t"></span><p data-i18n="'+key+'"></p>'};
    if(kind==='button'){el.className='btn btn-primary';el.setAttribute('href','#');}
    if(templates[kind]){el.className={stat:'stat',faq:'faq-item open',step:'pstep',card:'card'}[kind];el.innerHTML=templates[kind];el.setAttribute('data-hide-key',key);}else el.setAttribute('data-i18n',key);
    return el;
  }
  function cloneElement(source,id){
    var copy=source.cloneNode(true),mapping=[],key='added.'+id,index=0;
    copy.querySelectorAll('script,style,iframe,object,embed,input,select,textarea,form,img[hidden]').forEach(function(el){el.remove();});
    Array.prototype.slice.call(copy.querySelectorAll('*')).forEach(function(el){if(Array.prototype.some.call(el.classList,function(c){return c.indexOf('omni-')===0;}))el.remove();});
    [copy].concat(Array.prototype.slice.call(copy.querySelectorAll('*'))).forEach(function(el){
      var oldKey=el.getAttribute('data-i18n'),hideKey=el.getAttribute('data-hide-key');
      if(oldKey){var next=el===copy?key:key+'.'+(index++);mapping.push({oldKey:oldKey,key:next,text:el.hasAttribute('data-i18n-html')?el.innerHTML:el.textContent});el.setAttribute('data-i18n',next);}
      if(hideKey)el.setAttribute('data-hide-key',el===copy?key:(el.getAttribute('data-i18n')||key+'.'+(index++)));
      Array.prototype.slice.call(el.attributes).forEach(function(attr){if(attr.name==='id'||attr.name==='hidden'||attr.name==='inert'||attr.name==='contenteditable'||attr.name==='draggable'||attr.name==='role'&&attr.value==='textbox'||/^on/i.test(attr.name)||/^data-(?:image|item|collection|catalogue|section|omni|faq-bound|kinetic|count)/.test(attr.name)||/^aria-(?:controls|labelledby|describedby|expanded|hidden|multiline)$/.test(attr.name))el.removeAttribute(attr.name);});
      Array.prototype.slice.call(el.classList).forEach(function(c){if(c.indexOf('omni-')===0||['reveal','stagger','kinetic'].indexOf(c)>=0)el.classList.remove(c);});
      el.style.removeProperty('--omni-element-display');if(el.matches('a')&&!window.OmniElementRules.link(el.getAttribute('href')||''))el.setAttribute('href','#');
    });
    if(!copy.hasAttribute('data-i18n'))copy.setAttribute('data-hide-key',key);
    return {node:copy,mapping:mapping};
  }
  function applyAdditions(cfg){
    if(!document.body)return;cfg=cfg||site;
    elementBaselines.forEach(function(original,el){if(!el.isConnected){elementBaselines.delete(el);return;}if(original.href===null)el.removeAttribute('href');else el.setAttribute('href',original.href);el.className=original.className;});
    document.querySelectorAll('[data-omni-added],[data-omni-added-row]').forEach(function(el){el.remove();});
    (cfg.addedElements||[]).forEach(function(record){
      if(record.scope!=='*'&&record.scope!==pageKey())return;
      var anchors=findElements(record.anchor),sources=record.cloneOf?findElements(record.scope+':'+record.cloneOf):[];
      anchors.forEach(function(anchor){
        var source=sources.find(function(el){return el.closest('[data-section]')===anchor.closest('[data-section]');})||sources[0];
        if(record.kind==='copy'&&(!source||!canChangeElement(source)))return;
        var kind=record.kind==='copy'?elementKind(source):record.kind,container=record.position==='into'?anchor:anchor.parentElement;
        if(!allowedContainer(kind,container))return;
        var node=record.kind==='copy'?cloneElement(source,record.id).node:elementTemplate(record.kind,record.scope,record.id);
        node.setAttribute('data-omni-added',record.id);node.setAttribute('data-omni-added-scope',record.scope);
        var inserted=node;if(kind==='button'&&!container.matches('.btn-row')){inserted=document.createElement('div');inserted.className='btn-row';inserted.setAttribute('data-omni-added-row',record.id);inserted.appendChild(node);}
        if(record.position==='into')container.appendChild(inserted);else container.insertBefore(inserted,record.position==='before'?anchor:anchor.nextSibling);
        var lang=(window.OmniI18n&&window.OmniI18n.getLang())||'en';
        [node].concat(Array.prototype.slice.call(node.querySelectorAll('[data-i18n]'))).forEach(function(el){var key=el.getAttribute('data-i18n');if(!key)return;var text=cfg.i18n&&cfg.i18n[lang]&&cfg.i18n[lang][key];if(!text)text=(((window.OM_I18N||{})[lang]||{}).editor||{}).newText||(lang==='az'?'Yeni mətn':'New text');if(el.hasAttribute('data-i18n-html'))el.innerHTML=safeRichHtml(text);else el.textContent=text;});
      });
    });
    function baseline(el){if(!elementBaselines.has(el))elementBaselines.set(el,{href:el.getAttribute('href'),className:Array.from(el.classList).filter(function(c){return c.indexOf('omni-')!==0;}).join(' ')});}
    Object.keys(cfg.elementLinks||{}).forEach(function(key){var value=cfg.elementLinks[key];if(!window.OmniElementRules.link(value))return;findElements(key).forEach(function(target){if(!canChangeElement(target))return;var a=elementLinkTarget(target);if(a){baseline(a);a.setAttribute('href',value);}});});
    Object.keys(cfg.elementStyles||{}).forEach(function(key){var style=cfg.elementStyles[key];if(window.OmniElementRules.styles.indexOf(style)<0)return;findElements(key).forEach(function(target){if(!canChangeElement(target))return;var a=elementLinkTarget(target);if(!a||!a.matches('.btn,.btn-text'))return;baseline(a);a.className=style==='text'?'btn-text':'btn btn-'+style+(style==='secondary'&&!a.closest('.on-dark,.hero,.cta-band,.numbers-band')?' on-light':'');});});
    document.dispatchEvent(new CustomEvent('omni:additions-ready'));
  }
  function hideTargetFor(el){
    if (!el || el.matches('main') || el.closest(editorChrome)) return null;
    var field = el.closest('.field,.checkfield');
    if (field) return field;
    var link = el.closest('a');
    if (link && link.parentElement.matches('li')) return link.parentElement;
    if (el.closest('.faq-q')) return el.closest('.faq-item') || el.closest('.faq-q');
    if (el.closest('.dropdown-static')) return el.closest('.dropdown-static');
    if (el.matches('.stat-fig,.stat-lab')) return el.closest('.stat') || el.parentElement;
    var target = el.closest('.btn,button,a,li,.stat,.card,.chip,figure,.pstep,dt,dd,.faq-item,p,h1,h2,h3,h4,h5,h6,.eyebrow,.label,.footnote,.micro,.breadcrumb,[data-image-shell]') || el;
    // Containers with independent copy must not swallow their other contents.
    if (target !== el && target.matches('.card,.pstep,.faq-item,p,.breadcrumb') &&
        Array.prototype.some.call(target.querySelectorAll('[data-i18n],[data-hide-key]'), function(other){return other !== el && !el.contains(other);})) return el;
    return target;
  }
  function removalProtection(el){
    if (!el) return 'This element is part of the editor';
    function includes(selector){return el.matches(selector) || !!el.closest(selector) || !!el.querySelector(selector);}
    if (includes('.mark')) return 'The site name links home';
    if (includes('h1')) return 'Every page needs a headline — edit it instead';
    if (includes('.lang-switch,[data-lang]')) return 'Visitors need it to change language';
    if (includes('#cookieBanner button,#cookiePrefsLink,[data-cookie-prefs]')) return 'Required by the consent setting';
    if (includes('form input[name="name"],form input[name="email"],form input[name="consent"],form button[type="submit"]')) return 'Required to receive enquiries';
    return '';
  }
  function elementRemovalInfo(el){
    if (!el || el.closest(editorChrome)) return null;
    var source = el.closest('[data-i18n],[data-hide-key]');
    if (!source || source.matches('input,select,option,textarea,main')) return null;
    var field = source.closest('.field');
    if (field) source = field.querySelector('label [data-i18n],label[data-i18n]') || source;
    var chip = source.closest('.chip,.dropdown-static');
    if (chip && source.getAttribute('data-i18n') === 'availability.pageSoon') source = chip.querySelector('[data-i18n^="industries."]') || source;
    var key = source.getAttribute('data-hide-key') || source.getAttribute('data-i18n');
    var shared = !!source.closest(sharedElements) || /^(engines\.|industries\.)/.test(key);
    var target = hideTargetFor(source);
    var added=source.closest('[data-omni-added-scope]');
    return target ? {source:source,target:target,id:(added?added.getAttribute('data-omni-added-scope'):shared?'*':pageKey())+':'+key,reason:removalProtection(target)} : null;
  }
  function applyHiddenElements(cfg){
    cfg = cfg || site;
    if (!document.body) return;
    // Collection fields are rendered from data, so assign their stable keys here.
    document.querySelectorAll('[data-field],[data-field-plain],[data-collection-field],[data-collection-plain],[data-item-image],[data-item-meta]').forEach(function(el){
      var item=el.closest('[data-collection-id]'),context=window.OMNI_ITEM;
      var id=item?item.getAttribute('data-collection-id'):context&&context.item.id;
      var type=item?item.getAttribute('data-collection-type'):context&&context.type;
      if(!id||!type)return;
      var field=el.getAttribute('data-field')||el.getAttribute('data-field-plain')||el.getAttribute('data-collection-field')||el.getAttribute('data-collection-plain')||(el.hasAttribute('data-item-image')?'image':'meta');
      var target=el.hasAttribute('data-item-image')?(el.closest('[data-image-shell]')||el):el;
      target.setAttribute('data-hide-key','collection.'+type+'.'+id+'.'+field);
    });
    applyAdditions(cfg);
    document.querySelectorAll('[data-omni-hidden-element]').forEach(function(el){el.removeAttribute('data-omni-hidden-element');el.removeAttribute('data-omni-removed-label');});
    var hidden = cfg.hiddenElements || [];
    document.querySelectorAll('[data-i18n],[data-hide-key]').forEach(function(el){
      var info = elementRemovalInfo(el);
      if (!info || info.reason || hidden.indexOf(info.id)<0) return;
      var target = info.target;
      if (!target.hasAttribute('data-omni-hidden-element')) {
        var display = getComputedStyle(target).display;
        target.style.setProperty('--omni-element-display', display === 'none' ? 'block' : display);
      }
      target.setAttribute('data-omni-hidden-element',info.id);
      target.setAttribute('data-omni-removed-label','Removed · click ↺ to restore'+(info.id.charAt(0)==='*'?' · on every page':''));
    });
  }

  function applyLayout(cfg){
    cfg = cfg || site;
    if (!document.body) return;
    applyHiddenElements(cfg);
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
      var marker = Array.prototype.slice.call(list.children).find(function(el){ return !el.hasAttribute('data-item'); });
      next.forEach(function(el){ list.insertBefore(el, marker || null); });
      items.forEach(function(el){
        var hidden = hiddenItems.indexOf(listKey + ':' + el.getAttribute('data-item')) >= 0;
        el.hidden = hidden && !document.documentElement.classList.contains('omni-editing');
        if (hidden) el.setAttribute('data-omni-hidden-item', 'true');
        else el.removeAttribute('data-omni-hidden-item');
      });
    });
  }

  function applyImages(cfg){
    cfg = cfg || site;
    if (!document.body) return;
    var images = cfg.images || {};
    document.querySelectorAll('[data-image]').forEach(function(el){
      var key = el.getAttribute('data-image'), value = images[key], shell = el.closest('[data-image-shell]') || el.parentElement;
      if (!document.documentElement.classList.contains('omni-editing') && shell && shell.closest('[data-proof]') && !flags(cfg).showVerifiedProof) value = null;
      if (!value || !/^[a-f0-9]{16}$/.test(value.id || '')){
        el.hidden = true;
        el.removeAttribute('src'); el.removeAttribute('srcset'); el.removeAttribute('fetchpriority');
        el.style.removeProperty('object-position'); el.removeAttribute('data-image-loaded');
        if (shell) shell.classList.remove('has-slot-image');
        return;
      }
      var base = '/media/' + value.id;
      el.src = base + '-960.webp';
      el.srcset = base + '-480.webp 480w, ' + base + '-960.webp 960w, ' + base + '-1600.webp 1600w';
      el.sizes = el.getAttribute('data-sizes') || '(max-width: 760px) 100vw, 50vw';
      el.alt = typeof value.alt === 'string' ? value.alt : (el.getAttribute('data-default-alt') || '');
      var focal = value.focal || { x: 0.5, y: 0.5 };
      var x = Math.max(0, Math.min(1, Number(focal.x))), y = Math.max(0, Math.min(1, Number(focal.y)));
      el.style.objectPosition = (isFinite(x) ? x * 100 : 50) + '% ' + (isFinite(y) ? y * 100 : 50) + '%';
      var hero = key === 'index.hero';
      el.loading = hero ? 'eager' : 'lazy';
      if (hero) el.setAttribute('fetchpriority', 'high'); else el.removeAttribute('fetchpriority');
      el.hidden = false; el.setAttribute('data-image-loaded', 'true');
      if (shell) shell.classList.add('has-slot-image');
      if (!el.hasAttribute('data-image-error-bound')){
        el.setAttribute('data-image-error-bound', 'true');
        el.addEventListener('error', function(){ el.hidden = true; if (shell) shell.classList.remove('has-slot-image'); });
        el.addEventListener('load', function(){ el.hidden = false; if (shell) shell.classList.add('has-slot-image'); });
      }
    });
  }

  function collectionLang(){
    return (window.OmniI18n && window.OmniI18n.getLang && window.OmniI18n.getLang()) || document.documentElement.lang || 'en';
  }
  function collectionText(item, key, lang){
    var value=item&&item.fields&&item.fields[key];
    if(value&&typeof value==='object')return String(value[lang]||value.en||value.az||'');
    return value==null?'':String(value);
  }
  function collectionLabel(value){return{b2b:'B2B SaaS',dtc:'DTC / Home',fintech:'Fintech',retail:'Retail & FMCG',demand:'Demand',revops:'RevOps',sales:'Sales',brand:'Brand'}[value]||String(value||'').replace(/-/g,' ').replace(/\b\w/g,function(letter){return letter.toUpperCase();});}
  function safeRichHtml(html){
    var template=document.createElement('template');template.innerHTML=String(html||'');
    var allowed={P:1,H2:1,H3:1,UL:1,OL:1,LI:1,BLOCKQUOTE:1,B:1,STRONG:1,EM:1,I:1,A:1,BR:1};
    Array.prototype.slice.call(template.content.querySelectorAll('*')).forEach(function(node){
      if(!allowed[node.tagName]){node.replaceWith.apply(node,Array.prototype.slice.call(node.childNodes));return;}
      Array.prototype.slice.call(node.attributes).forEach(function(attr){if(!(node.tagName==='A'&&attr.name==='href'))node.removeAttribute(attr.name);});
      if(node.tagName==='A'&&!/^(https?:|mailto:|tel:|\/|#|[a-z0-9-]+\.html)/i.test((node.getAttribute('href')||'').trim()))node.removeAttribute('href');
    });
    return template.innerHTML;
  }
  function collectionsFor(cfg){
    return (cfg&&cfg.collections&&typeof cfg.collections==='object')?cfg.collections:((dataDefaults&&dataDefaults.collections)||window.OMNI_COLLECTIONS||{});
  }
  function ensureItemContext(cfg){
    if(window.OMNI_ITEM&&window.OMNI_ITEM.type&&window.OMNI_ITEM.item)return window.OMNI_ITEM;
    var key=pageKey(),type={'case-study':'cases',article:'articles','role-detail':'jobs'}[key];if(!type)return null;
    var items=collectionsFor(cfg)[type]||[],slug='';try{slug=new URLSearchParams(location.search).get('item')||'';}catch(error){}
    var item=slug?items.filter(function(value){return value.slug===slug;})[0]:items.filter(function(value){return value.published;})[0];if(!item)return null;
    window.OMNI_ITEM={type:type,item:item,templateKey:key,path:({cases:'/work/',articles:'/insights/',jobs:'/careers/'}[type]||'/')+item.slug};return window.OMNI_ITEM;
  }
  function currentItem(cfg){
    var context=ensureItemContext(cfg);if(!context)return null;
    var items=collectionsFor(cfg)[context.type]||[],id=context.item.id;
    return items.filter(function(item){return item.id===id;})[0]||context.item;
  }
  function applyItem(cfg){
    if(!document.body||!ensureItemContext(cfg||site))return;
    var item=currentItem(cfg||site);if(!item)return;window.OMNI_ITEM.item=item;
    var lang=collectionLang();document.body.setAttribute('data-collection-type',window.OMNI_ITEM.type);document.body.setAttribute('data-collection-id',item.id);
    document.querySelectorAll('[data-field]').forEach(function(el){
      var key=el.getAttribute('data-field'),value=collectionText(item,key,lang);
      if(el.hasAttribute('data-field-rich'))el.innerHTML=safeRichHtml(value);else el.textContent=value;
    });
    document.querySelectorAll('[data-field-plain]').forEach(function(el){var key=el.getAttribute('data-field-plain'),value=item[key]==null?'':String(item[key]);el.textContent=(key==='sector'||key==='category')?collectionLabel(value):value;});
    document.querySelectorAll('[data-item-meta]').forEach(function(el){
      var bits=[];
      if(window.OMNI_ITEM.type==='articles')bits=[item.author,item.readingMinutes?item.readingMinutes+' min read':'',item.date];
      else if(window.OMNI_ITEM.type==='jobs')bits=[item.location,item.remote?'Remote':'Hybrid',String(item.type||'').replace('-', ' ')];
      else bits=[item.client,collectionLabel(item.sector),item.year];
      el.textContent=bits.filter(Boolean).join(' · ');
    });
    document.querySelectorAll('[data-field-metrics]').forEach(function(el){
      el.textContent='';(item.fields.metrics||[]).forEach(function(metric){var cell=document.createElement('div');cell.className='collection-metric';var value=document.createElement('strong'),label=document.createElement('span');value.textContent=metric.value||'';label.textContent=(metric.label&& (metric.label[lang]||metric.label.en||metric.label.az))||'';cell.append(value,label);el.appendChild(cell);});
    });
    document.querySelectorAll('[data-item-apply]').forEach(function(link){link.href=item.applyUrl||'contact.html';});
    document.querySelectorAll('[data-item-image]').forEach(function(img){
      var shell=img.closest('[data-image-shell]')||img.parentElement,value=item.image;
      if(!value||!/^[a-f0-9]{16}$/.test(value.id||'')){img.hidden=true;img.removeAttribute('src');img.removeAttribute('srcset');if(shell)shell.classList.remove('has-slot-image');return;}
      var base='/media/'+value.id;img.src=base+'-960.webp';img.srcset=base+'-480.webp 480w, '+base+'-960.webp 960w, '+base+'-1600.webp 1600w';img.sizes=img.getAttribute('data-sizes')||'(max-width:760px) 100vw, 760px';img.alt=value.alt||'';
      var focal=value.focal||{x:.5,y:.5};img.style.objectPosition=(Number(focal.x)*100)+'% '+(Number(focal.y)*100)+'%';img.hidden=false;if(shell)shell.classList.add('has-slot-image');
    });
  }
  function applyCollections(cfg){
    ensureItemContext(cfg||site);
    if(window.OmniPartials&&window.OmniPartials.renderCollections)window.OmniPartials.renderCollections(collectionsFor(cfg||site),cfg||site);
    applyItem(cfg||site);
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
  var dataDefaults = null;
  function applyData(){
    if (dataApplied) return; dataApplied = true;
    dataDefaults = {
      engines: JSON.parse(JSON.stringify(window.OMNI_ENGINES || [])),
      industries: JSON.parse(JSON.stringify(window.OMNI_INDUSTRIES || [])),
      collections: JSON.parse(JSON.stringify(window.OMNI_COLLECTIONS || {})),
      i18n: JSON.parse(JSON.stringify(window.OM_I18N || { en: {}, az: {} }))
    };
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
    if(window.OMNI_ITEM&&window.OMNI_ITEM.templateKey)return window.OMNI_ITEM.templateKey;
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
    applyAdditions: applyAdditions,
    elementTemplate: elementTemplate,
    cloneElement: cloneElement,
    elementKind: elementKind,
    allowedContainer: allowedContainer,
    ALLOWED_DROPS: ALLOWED_DROPS,
    findElements: findElements,
    elementLinkTarget: elementLinkTarget,
    canChangeElement: canChangeElement,
    applyHiddenElements: applyHiddenElements,
    hideTargetFor: hideTargetFor,
    elementRemovalInfo: elementRemovalInfo,
    applyImages: applyImages,
    applyCollections: applyCollections,
    applyItem: applyItem,
    applyData: applyData,
    applyPageMeta: applyPageMeta,
    fontCatalog: FONT_CATALOG,
    defaultFonts: DEFAULT_FONTS,
    defaultFlags: DEFAULT_FLAGS,
    getDefaults: function(){ return dataDefaults ? JSON.parse(JSON.stringify(dataDefaults)) : null; }
  };

  /* The admin dashboard loads this file for the font catalogue / defaults
     only — it must not restyle itself with the site's tokens. */
  var isAdmin = document.documentElement.hasAttribute('data-omni-admin');
  if (!isAdmin){
    applyDesign(site);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ applyDesign(site); applyPageMeta(); applyCollections(site); applyLayout(site); applyImages(site); });
    else { applyDesign(site); applyPageMeta(); applyCollections(site); applyLayout(site); applyImages(site); }
    document.addEventListener('omni:partials-ready', function(){ applyCollections(site);applyLayout(site);applyImages(site); });
    document.addEventListener('omni:i18n-applied', function(){ applyCollections(site);applyImages(site);applyHiddenElements(site); });
  }

  /* live preview from the admin dashboard (same origin only) */
  window.addEventListener('message', function(e){
    if (e.origin !== location.origin) return;
    var m = e.data;
    if (!m || m.type !== 'omni:preview' || !m.site || typeof m.site !== 'object') return;
    applyDesign(m.site);
  });
})();
