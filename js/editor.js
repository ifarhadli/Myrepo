/* Authenticated on-page editor. Loaded by server.js only for a valid session
   on public pages requested with ?edit=1. Zero dependencies. */
(function(){
  'use strict';
  document.documentElement.classList.add('omni-editing');

  var $ = function(selector, root){ return (root || document).querySelector(selector); };
  var $$ = function(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var clone = function(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); };
  var same = function(a, b){ return JSON.stringify(a) === JSON.stringify(b); };
  var STORAGE_KEY = 'omni-editor-draft';
  var PAGE_FILES = ['index','services','work','case-study','industry','about','insights','article','careers','role-detail','contact','geo','service-brand-launch','sub-service'];
  var PAGE_LABELS = {'index':'Home','services':'Services','work':'Work','case-study':'Case study','industry':'Industry','about':'About','insights':'Insights','article':'Article','careers':'Careers','role-detail':'Role detail','contact':'Contact','geo':'Markets','service-brand-launch':'Brand launch','sub-service':'Sub-service'};
  var state = { live:null, draft:null, savedAt:null, lang:'en', undo:[], redo:[], activeEdit:null, saveTimer:null, saveSeq:0, saving:false, defaults:null, draggedSection:null, draggedItem:null, panelReturnFocus:null, allowNavigate:false, submissions:null };
  var COLOR_TOKENS = [
    ['--c1','Engine 01','#4634F0'],['--c2','Engine 02','#FF5B35'],['--c3','Engine 03','#C6F24E'],['--c4','Engine 04','#12D6C4'],['--c5','Engine 05','#FF3E88'],
    ['--ink','Ink','#0B0C10'],['--paper','Paper','#F4F1EA'],['--signal','Signal','#C6F24E']
  ];
  var FONT_PRESETS = {
    'bricolage-inter':['Bricolage Grotesque','Inter','JetBrains Mono'],
    'sora-dmsans':['Sora','DM Sans','Fira Code'],
    'syne-manrope':['Syne','Manrope','IBM Plex Mono'],
    'playfair-worksans':['Playfair Display','Work Sans','Space Mono']
  };
  var MOTION_FLAGS=['customCursor','magneticButtons','kineticHeadlines','marquee','countUp','reveal'];

  function pageKey(){ return ((location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '') || 'index'); }
  function getPath(obj, path){ return path.split('.').reduce(function(cur, part){ return cur == null ? undefined : cur[part]; }, obj); }
  function setPath(obj, path, value){
    var parts = path.split('.'), cur = obj;
    for (var i=0;i<parts.length-1;i++){
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = /^\d+$/.test(parts[i+1]) ? [] : {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length-1]] = value;
  }
  function delPath(obj, path){
    var parts=path.split('.'), cur=obj;
    for(var i=0;i<parts.length-1;i++){ cur=cur && cur[parts[i]]; if(!cur) return; }
    delete cur[parts[parts.length-1]];
  }
  function api(method, path, body, keepalive){
    return fetch(path, { method:method, credentials:'same-origin', keepalive:!!keepalive,
      headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},
      body:body === undefined ? undefined : JSON.stringify(body) }).then(function(response){
      return response.json().catch(function(){ return {}; }).then(function(data){
        if(!response.ok){ var error=new Error(data.error || ('HTTP '+response.status)); error.status=response.status; throw error; }
        return data;
      });
    });
  }
  function flatten(value, prefix, out){
    out=out||{}; prefix=prefix||'';
    if(Array.isArray(value) || value == null || typeof value !== 'object'){ out[prefix]=JSON.stringify(value); return out; }
    var keys=Object.keys(value); if(!keys.length) out[prefix]='{}';
    keys.forEach(function(key){ flatten(value[key],prefix?prefix+'.'+key:key,out); });
    return out;
  }
  function diffCount(a,b){
    var aa=flatten(a),bb=flatten(b),keys={}; Object.keys(aa).concat(Object.keys(bb)).forEach(function(k){keys[k]=1;});
    return Object.keys(keys).filter(function(k){return aa[k]!==bb[k];}).length;
  }
  function summaryCounts(){
    var a=state.live||{},b=state.draft||{};
    return {
      texts:diffCount(a.i18n||{},b.i18n||{}),
      sections:diffCount({order:a.sectionOrder||{},hidden:a.hiddenSections||[],accent:a.sectionAccent||{}},{order:b.sectionOrder||{},hidden:b.hiddenSections||[],accent:b.sectionAccent||{}}),
      items:diffCount({order:a.itemOrder||{},hidden:a.hiddenItems||[]},{order:b.itemOrder||{},hidden:b.hiddenItems||[]}),
      catalogue:diffCount({engines:a.engines,enginesAz:a.enginesAz,industries:a.industries,industriesAz:a.industriesAz},{engines:b.engines,enginesAz:b.enginesAz,industries:b.industries,industriesAz:b.industriesAz}),
      design:diffCount(a.design||{},b.design||{}),
      settings:diffCount({settings:a.settings||{},features:a.features||{},analytics:a.analytics||{},structured:a.structured||{}},{settings:b.settings||{},features:b.features||{},analytics:b.analytics||{},structured:b.structured||{}})
    };
  }
  function totalChanges(){ var s=summaryCounts(); return Object.keys(s).reduce(function(n,k){return n+s[k];},0); }
  function setSaveStatus(textValue,status){ var el=$('[data-editor-status]'); if(el){el.textContent=textValue;el.setAttribute('data-state',status||'');} }
  function updateBar(){
    var n=totalChanges(),publish=$('[data-editor-publish]');
    if(publish){ publish.disabled=!n || state.saving; publish.textContent='Publish ('+n+')'; }
    var undo=$('[data-editor-undo]'),redo=$('[data-editor-redo]'); if(undo)undo.disabled=!state.undo.length;if(redo)redo.disabled=!state.redo.length;
    $$('[data-editor-lang]').forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-editor-lang')===state.lang));});
  }
  var toastTimer;
  function toast(message,kind){
    var el=$('.omni-toast'); if(!el)return; el.textContent=message;el.className='omni-toast is-on'+(kind==='error'?' is-error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='omni-toast';},4200);
  }
  function saveLocal(){
    try{ var at=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify({savedAt:at,draft:state.draft}));state.savedAt=at; }catch(e){}
  }
  function clearLocal(){ try{localStorage.removeItem(STORAGE_KEY);}catch(e){} }
  function readLocal(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch(e){return null;} }
  function scheduleSave(){ clearTimeout(state.saveTimer);setSaveStatus('Saving…');state.saveTimer=setTimeout(function(){saveDraft();},1500); }
  function saveDraft(keepalive){
    clearTimeout(state.saveTimer);
    var changed=totalChanges();
    if(!changed){
      return api('DELETE','/api/draft',undefined,keepalive).then(function(){clearLocal();setSaveStatus('All changes published');}).catch(handleSaveError);
    }
    var snapshot=JSON.stringify(state.draft),seq=++state.saveSeq;state.saving=true;updateBar();setSaveStatus('Saving…');
    return api('PUT','/api/draft',state.draft,keepalive).then(function(result){
      if(seq!==state.saveSeq)return result; state.saving=false;
      if(snapshot===JSON.stringify(state.draft)){state.savedAt=result.savedAt;setSaveStatus('Saved · '+new Date(result.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));}
      else scheduleSave(); updateBar(); return result;
    }).catch(function(error){state.saving=false;updateBar();handleSaveError(error);throw error;});
  }
  function handleSaveError(error){
    if(error && error.status===401){location.replace('admin.html');return;}
    setSaveStatus('Offline — changes kept locally','offline');
  }
  function flushSync(){
    if(!state.draft || !totalChanges())return;
    try{var xhr=new XMLHttpRequest();xhr.open('PUT','/api/draft',false);xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('X-Requested-With','OmniAdmin');xhr.send(JSON.stringify(state.draft));}catch(e){}
  }

  function defaultEnginesAz(){
    var defs=state.defaults||{},engines=clone(defs.engines||[]),az=(defs.i18n&&defs.i18n.az&&defs.i18n.az.engines)||{};
    return engines.map(function(engine,index){
      var d=az['e'+(index+1)]||{};return Object.assign({},engine,{name:d.name||engine.name,promise:d.promise||engine.promise,
        groups:(engine.groups||[]).map(function(group,gi){var dg=(d.groups||[])[gi]||{};return {title:dg.title||group.title,items:(group.items||[]).map(function(item,ii){return(dg.items||[])[ii]||item;})};})});
    });
  }
  function syncEngineDict(dict,engines){
    dict.engines=dict.engines||{};(engines||[]).forEach(function(engine,index){dict.engines['e'+(index+1)]={name:engine.name,promise:engine.promise,groups:(engine.groups||[]).map(function(group){return{title:group.title,items:(group.items||[]).slice()};})};});
  }
  function mergeDraftDict(){
    var defs=state.defaults||{},base=clone(defs.i18n||window.OM_I18N||{en:{},az:{}});base.en=base.en||{};base.az=base.az||{};
    var enEngines=state.draft.engines||defs.engines||[],azEngines=state.draft.enginesAz||defaultEnginesAz();syncEngineDict(base.en,enEngines);syncEngineDict(base.az,azEngines);
    if(Array.isArray(state.draft.industries)){base.en.industries=state.draft.industries.slice();base.az.industries=(state.draft.industriesAz||state.draft.industries).slice();}
    ['en','az'].forEach(function(lang){var overrides=(state.draft.i18n&&state.draft.i18n[lang])||{};Object.keys(overrides).forEach(function(key){setPath(base[lang],key,overrides[key]);});});
    window.OM_I18N=base;window.OMNI_ENGINES=enEngines;window.OMNI_INDUSTRIES=state.draft.industries||defs.industries||[];
  }
  function applyDraft(){
    if(window.OmniSite){window.OmniSite.applyDesign(state.draft);window.OmniSite.applyLayout(state.draft);}
    mergeDraftDict();if(window.OmniI18n)window.OmniI18n.applyI18n();renderCatalogueLists();renderIndustryStrip();applyDraftSettings();decorateSections();decorateItems();syncDesignPanel();updateBar();
  }
  function commit(mutator,label){
    finishEdit(true);var before=clone(state.draft);mutator(state.draft);if(same(before,state.draft))return;
    state.undo.push({before:before,after:clone(state.draft),label:label||'Change'});if(state.undo.length>100)state.undo.shift();state.redo=[];
    saveLocal();applyDraft();scheduleSave();
  }
  function undo(){
    finishEdit(false);var entry=state.undo.pop();if(!entry)return;state.redo.push(entry);state.draft=clone(entry.before);saveLocal();applyDraft();scheduleSave();toast('Undid: '+entry.label);
  }
  function redo(){
    finishEdit(false);var entry=state.redo.pop();if(!entry)return;state.undo.push(entry);state.draft=clone(entry.after);saveLocal();applyDraft();scheduleSave();toast('Redid: '+entry.label);
  }

  function editableTarget(target){
    if(target.closest&&target.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-section-tools,.omni-item-tools,.omni-catalogue-add'))return null;
    var el=target.closest&&target.closest('[data-i18n]');
    if(!el || el.hasAttribute('data-i18n-attr') || el.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-section-tools') || el.classList.contains('mark') || el.closest('.mark'))return null;
    return el;
  }
  function defaultText(lang,key){return getPath((state.defaults&&state.defaults.i18n&&state.defaults.i18n[lang])||{},key);}
  function catalogueValue(lang,key,value,remove){
    var industry=key.match(/^industries\.(\d+)$/);if(industry){
      var prop=lang==='az'?'industriesAz':'industries';if(!state.draft.industries)state.draft.industries=clone(state.defaults.industries||[]);if(!state.draft.industriesAz)state.draft.industriesAz=clone(getPath(state.defaults,'i18n.az.industries')||state.draft.industries);
      state.draft[prop][Number(industry[1])]=remove?defaultText(lang,key):value;return true;
    }
    var engine=key.match(/^engines\.e(\d+)\.(.+)$/);if(!engine)return false;
    if(!state.draft.engines)state.draft.engines=clone(state.defaults.engines||[]);if(!state.draft.enginesAz)state.draft.enginesAz=defaultEnginesAz();
    var list=lang==='az'?state.draft.enginesAz:state.draft.engines,index=Number(engine[1])-1;if(!list[index])return false;
    setPath(list[index],engine[2],remove?defaultText(lang,key):value);return true;
  }
  function writeText(lang,key,value){
    var remove=!value || value===defaultText(lang,key);if(catalogueValue(lang,key,value,remove))return;
    state.draft.i18n=state.draft.i18n||{en:{},az:{}};state.draft.i18n[lang]=state.draft.i18n[lang]||{};
    if(remove)delete state.draft.i18n[lang][key];else state.draft.i18n[lang][key]=value;
  }
  function sanitizeHtml(html){
    var template=document.createElement('template');template.innerHTML=html;var allowed={B:1,STRONG:1,EM:1,I:1,A:1,BR:1};
    Array.prototype.slice.call(template.content.querySelectorAll('*')).forEach(function(node){
      if(!allowed[node.tagName]){node.replaceWith.apply(node,Array.prototype.slice.call(node.childNodes));return;}
      Array.prototype.slice.call(node.attributes).forEach(function(attr){if(!(node.tagName==='A'&&attr.name==='href'))node.removeAttribute(attr.name);});
      if(node.tagName==='A'){var href=(node.getAttribute('href')||'').trim();if(!/^(https?:|mailto:|tel:|\/|#|[a-z0-9-]+\.html)/i.test(href))node.removeAttribute('href');}
    });
    return template.innerHTML.replace(/<div>/gi,'<br>').replace(/<\/div>/gi,'').trim();
  }
  function positionMiniTools(){
    if(!state.activeEdit)return;var tools=$('.omni-mini-tools'),rect=state.activeEdit.el.getBoundingClientRect();if(!tools)return;
    var top=Math.max(54,rect.top-tools.offsetHeight-8),left=Math.min(window.innerWidth-tools.offsetWidth-8,Math.max(8,rect.left));tools.style.top=top+'px';tools.style.left=left+'px';
  }
  function makeMiniTools(){
    var tools=document.createElement('div');tools.className='omni-mini-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Text formatting');
    tools.innerHTML='<button type="button" data-format="bold" aria-label="Bold"><b>B</b></button><button type="button" data-format="link">Link</button><button type="button" data-format="clear">Clear</button>';
    tools.addEventListener('pointerdown',function(e){e.preventDefault();});
    tools.addEventListener('click',function(e){
      var button=e.target.closest('[data-format]');if(!button||!state.activeEdit)return;var action=button.getAttribute('data-format');state.activeEdit.el.focus();
      if(action==='bold')document.execCommand('bold',false,null);
      if(action==='clear'){document.execCommand('removeFormat',false,null);document.execCommand('unlink',false,null);}
      if(action==='link')showLinkInput(tools);
    });document.body.appendChild(tools);positionMiniTools();
  }
  function showLinkInput(tools){
    if($('.omni-link-pop',tools))return;var pop=document.createElement('span');pop.className='omni-link-pop';pop.innerHTML='<label class="omni-sr" for="omniLinkUrl">Link URL</label><input id="omniLinkUrl" type="url" value="https://" inputmode="url"><button type="button">Apply</button>';
    tools.appendChild(pop);var input=$('input',pop);input.focus();$('button',pop).addEventListener('click',function(){var url=input.value.trim();if(/^(https?:|mailto:|tel:|\/|#)/i.test(url))document.execCommand('createLink',false,url);pop.remove();state.activeEdit.el.focus();});positionMiniTools();
  }
  function beginEdit(el){
    if(state.activeEdit&&state.activeEdit.el===el)return;finishEdit(true);var rich=el.hasAttribute('data-i18n-html');
    state.activeEdit={el:el,key:el.getAttribute('data-i18n'),rich:rich,original:rich?el.innerHTML:el.textContent};
    el.setAttribute('contenteditable',rich?'true':'plaintext-only');el.setAttribute('role','textbox');el.setAttribute('aria-multiline',String(rich&&/<br\s*\/?\s*>/i.test(state.activeEdit.original)));el.focus();
    var selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);if(rich)makeMiniTools();
  }
  function finishEdit(commitValue){
    var active=state.activeEdit;if(!active)return;state.activeEdit=null;var tools=$('.omni-mini-tools');if(tools)tools.remove();
    active.el.removeAttribute('contenteditable');active.el.removeAttribute('role');active.el.removeAttribute('aria-multiline');
    if(!commitValue){if(active.rich)active.el.innerHTML=active.original;else active.el.textContent=active.original;return;}
    var value=active.rich?sanitizeHtml(active.el.innerHTML):active.el.textContent.trim();
    active.el[active.rich?'innerHTML':'textContent']=value||active.original;
    var before=clone(state.draft);writeText(state.lang,active.key,value);if(same(before,state.draft)){applyDraft();return;}
    state.undo.push({before:before,after:clone(state.draft),label:'Edit '+active.key});if(state.undo.length>100)state.undo.shift();state.redo=[];saveLocal();applyDraft();scheduleSave();
  }

  function sectionOrder(){return $$('main > [data-section]').map(function(el){return el.getAttribute('data-section');});}
  function moveSection(section,direction){
    if(!section || section.parentElement.tagName!=='MAIN')return;var items=$$('main > [data-section]'),index=items.indexOf(section),next=index+direction;if(next<0||next>=items.length)return;
    commit(function(draft){if(direction<0)section.parentElement.insertBefore(section,items[next]);else section.parentElement.insertBefore(items[next],section);draft.sectionOrder=draft.sectionOrder||{};draft.sectionOrder[pageKey()]=sectionOrder();},'Move section');
  }
  function toggleSection(section){
    var key=section.getAttribute('data-section');commit(function(draft){draft.hiddenSections=draft.hiddenSections||[];var i=draft.hiddenSections.indexOf(key);if(i>=0)draft.hiddenSections.splice(i,1);else draft.hiddenSections.push(key);},'Toggle section visibility');
  }
  function cycleAccent(section){
    var key=section.getAttribute('data-section');commit(function(draft){draft.sectionAccent=draft.sectionAccent||{};var next=(draft.sectionAccent[key]||0)+1;if(next>5)delete draft.sectionAccent[key];else draft.sectionAccent[key]=next;},'Change section accent');
  }
  function makeSectionTools(section){
    var tools=document.createElement('div');tools.className='omni-section-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Section controls');
    tools.innerHTML='<button type="button" class="omni-drag" draggable="true" aria-label="Drag section" title="Drag section">⋮⋮</button><button type="button" data-section-hide aria-label="Hide section" title="Hide or show section">◉</button><button type="button" class="omni-accent" data-section-accent-button aria-label="Cycle accent colour" title="Cycle accent colour">●</button><button type="button" data-section-up aria-label="Move section up" title="Move up">▲</button><button type="button" data-section-down aria-label="Move section down" title="Move down">▼</button>';
    tools.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-section-hide'))toggleSection(section);if(b.hasAttribute('data-section-accent-button'))cycleAccent(section);if(b.hasAttribute('data-section-up'))moveSection(section,-1);if(b.hasAttribute('data-section-down'))moveSection(section,1);});
    var handle=$('.omni-drag',tools);handle.addEventListener('dragstart',function(e){state.draggedSection=section;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',section.getAttribute('data-section'));});handle.addEventListener('dragend',clearDrop);
    section.addEventListener('dragover',function(e){if(!state.draggedSection||state.draggedSection===section||section.parentElement.tagName!=='MAIN')return;e.preventDefault();var source=state.draggedSection;clearDrop();state.draggedSection=source;var before=e.clientY<section.getBoundingClientRect().top+section.offsetHeight/2;section.classList.add(before?'omni-drop-before':'omni-drop-after');});
    section.addEventListener('drop',function(e){if(!state.draggedSection||state.draggedSection===section)return;e.preventDefault();var dragged=state.draggedSection,before=section.classList.contains('omni-drop-before');clearDrop();commit(function(draft){section.parentElement.insertBefore(dragged,before?section:section.nextSibling);draft.sectionOrder=draft.sectionOrder||{};draft.sectionOrder[pageKey()]=sectionOrder();},'Reorder sections');});
    section.appendChild(tools);
  }
  function clearDrop(){state.draggedSection=null;$$('.omni-drop-before,.omni-drop-after').forEach(function(el){el.classList.remove('omni-drop-before','omni-drop-after');});}
  function decorateSections(){
    var hidden=state.draft.hiddenSections||[],proof=!!(state.draft.features&&state.draft.features.showVerifiedProof);
    $$('[data-section]').forEach(function(section){
      if(!$('.omni-section-tools',section))makeSectionTools(section);var key=section.getAttribute('data-section'),isHidden=hidden.indexOf(key)>=0;section.setAttribute('data-editor-hidden',String(isHidden));
      var badge=$(':scope > .omni-section-badge',section);if(isHidden&&!badge){badge=document.createElement('span');badge.className='omni-section-badge';section.appendChild(badge);}if(badge){badge.textContent='Hidden';badge.hidden=!isHidden;}
      var proofBadge=$(':scope > .omni-section-badge--proof',section);if(section.hasAttribute('data-proof')&&!proof&&!proofBadge){proofBadge=document.createElement('span');proofBadge.className='omni-section-badge omni-section-badge--proof';proofBadge.textContent='Proof gated';section.appendChild(proofBadge);}if(proofBadge)proofBadge.hidden=proof;
      var top=section.parentElement&&section.parentElement.tagName==='MAIN';var items=top?$$('main > [data-section]'):[],index=items.indexOf(section);var up=$('[data-section-up]',section),down=$('[data-section-down]',section),drag=$('.omni-drag',section);if(up)up.disabled=!top||index===0;if(down)down.disabled=!top||index===items.length-1;if(drag)drag.hidden=!top;
      var hide=$('[data-section-hide]',section);if(hide){hide.setAttribute('aria-label',isHidden?'Show section':'Hide section');hide.textContent=isHidden?'○':'◉';}
    });
  }

  function ensureCatalogue(){
    if(!state.draft.engines)state.draft.engines=clone(state.defaults.engines||[]);
    if(!state.draft.enginesAz)state.draft.enginesAz=defaultEnginesAz();
    if(!state.draft.industries)state.draft.industries=clone(state.defaults.industries||[]);
    if(!state.draft.industriesAz)state.draft.industriesAz=clone(getPath(state.defaults,'i18n.az.industries')||state.draft.industries);
  }
  function currentEngines(){return state.lang==='az'?(state.draft.enginesAz||defaultEnginesAz()):(state.draft.engines||state.defaults.engines||[]);}
  function createCatalogueItem(textValue,key){
    var li=document.createElement('li');li.setAttribute('data-i18n',key);li.setAttribute('data-catalogue-item','');li.textContent=textValue;return li;
  }
  function renderCatalogueLists(){
    var engines=currentEngines();$$('.eng-row[data-n]').forEach(function(row){
      var ei=Number(row.getAttribute('data-n'))-1,engine=engines[ei];if(!engine)return;
      $$('.eng-cols > div',row).forEach(function(column,gi){
        var group=(engine.groups||[])[gi],ul=$('ul',column);if(!group||!ul)return;
        ul.textContent='';(group.items||[]).forEach(function(item,ii){ul.appendChild(createCatalogueItem(item,'engines.e'+(ei+1)+'.groups.'+gi+'.items.'+ii));});
        var add=$(':scope > .omni-catalogue-add',column);if(!add){add=document.createElement('button');add.type='button';add.className='omni-catalogue-add';add.textContent='+ Add service';add.setAttribute('data-add-service',ei+':'+gi);column.appendChild(add);}
      });
    });
  }
  function renderIndustryStrip(){
    var list=$('[data-list="industry.strip"]');if(!list)return;var industries=state.lang==='az'?(state.draft.industriesAz||getPath(state.defaults,'i18n.az.industries')||[]):(state.draft.industries||state.defaults.industries||[]);
    list.textContent='';industries.forEach(function(item,index){
      var el=index===0?document.createElement('a'):document.createElement('span');el.className='chip'+(index?' is-coming':'');el.setAttribute('data-item','i'+(index+1));
      if(index===0)el.href='industry.html?edit=1';var text=document.createElement('span');text.setAttribute('data-i18n','industries.'+index);text.textContent=item;el.appendChild(text);
      if(index){var small=document.createElement('small');small.setAttribute('data-i18n','availability.pageSoon');small.textContent='Page coming soon';el.appendChild(small);}list.appendChild(el);
    });
    var add=document.createElement('button');add.type='button';add.className='omni-catalogue-add';add.setAttribute('data-add-industry','');add.textContent='+ Add industry';list.appendChild(add);
    if(window.OmniI18n)window.OmniI18n.applyI18n();
  }
  function parseServiceKey(key){var match=String(key||'').match(/^engines\.e(\d+)\.groups\.(\d+)\.items\.(\d+)$/);return match?{engine:Number(match[1])-1,group:Number(match[2]),item:Number(match[3])}:null;}
  function removeServiceItem(item){
    var parsed=parseServiceKey(item.getAttribute('data-i18n'));if(!parsed)return;commit(function(draft){ensureCatalogue();['engines','enginesAz'].forEach(function(prop){var group=draft[prop][parsed.engine]&&draft[prop][parsed.engine].groups[parsed.group];if(group&&Array.isArray(group.items))group.items.splice(parsed.item,1);});},'Remove catalogue service');
  }
  function addService(button){
    var parts=button.getAttribute('data-add-service').split(':'),ei=Number(parts[0]),gi=Number(parts[1]);commit(function(draft){ensureCatalogue();draft.engines[ei].groups[gi].items.push('New service');draft.enginesAz[ei].groups[gi].items.push('Yeni xidmət');},'Add catalogue service');
    setTimeout(function(){var items=$$('.eng-row[data-n="'+(ei+1)+'"] .eng-cols > div:nth-child('+(gi+1)+') li');if(items.length)beginEdit(items[items.length-1]);},0);
  }
  function removeIndustry(item){
    var index=Number(item.getAttribute('data-item').slice(1))-1;commit(function(draft){ensureCatalogue();draft.industries.splice(index,1);draft.industriesAz.splice(index,1);},'Remove industry');
  }
  function addIndustry(){
    commit(function(draft){ensureCatalogue();draft.industries.push('New industry');draft.industriesAz.push('Yeni sahə');},'Add industry');
    setTimeout(function(){var items=$$('[data-list="industry.strip"]>[data-item]');if(items.length){var text=$('[data-i18n]',items[items.length-1]);if(text)beginEdit(text);}},0);
  }
  function reorderService(source,target,before){
    var a=parseServiceKey(source.getAttribute('data-i18n')),b=parseServiceKey(target.getAttribute('data-i18n'));if(!a||!b||a.engine!==b.engine||a.group!==b.group)return;
    commit(function(draft){ensureCatalogue();['engines','enginesAz'].forEach(function(prop){var items=draft[prop][a.engine].groups[a.group].items,moved=items.splice(a.item,1)[0],to=b.item;if(a.item<to)to--;if(!before)to++;items.splice(to,0,moved);});},'Reorder catalogue services');
  }
  function reorderIndustry(source,target,before){
    var from=Number(source.getAttribute('data-item').slice(1))-1,to=Number(target.getAttribute('data-item').slice(1))-1;
    commit(function(draft){ensureCatalogue();['industries','industriesAz'].forEach(function(prop){var moved=draft[prop].splice(from,1)[0],index=to;if(from<index)index--;if(!before)index++;draft[prop].splice(index,0,moved);});},'Reorder industries');
  }
  function genericItemOrder(list){return $$(':scope > [data-item]',list).map(function(el){return el.getAttribute('data-item');});}
  function toggleItem(item){
    var list=item.parentElement,key=list.getAttribute('data-list')+':'+item.getAttribute('data-item');commit(function(draft){draft.hiddenItems=draft.hiddenItems||[];var i=draft.hiddenItems.indexOf(key);if(i>=0)draft.hiddenItems.splice(i,1);else draft.hiddenItems.push(key);},'Toggle item visibility');
  }
  function clearItemDrop(){state.draggedItem=null;$$('.omni-item-drop-before,.omni-item-drop-after').forEach(function(el){el.classList.remove('omni-item-drop-before','omni-item-drop-after');});}
  function makeItemTools(item){
    var catalogue=item.hasAttribute('data-catalogue-item'),industries=item.parentElement.getAttribute('data-list')==='industry.strip';var tools=document.createElement('div');tools.className='omni-item-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Item controls');
    tools.innerHTML='<button type="button" class="omni-item-drag" draggable="true" aria-label="Drag item" title="Drag item">⋮⋮</button><button type="button" class="omni-item-remove" aria-label="Remove item" title="Remove item">×</button>';
    tools.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var button=e.target.closest('.omni-item-remove');if(!button)return;if(catalogue)removeServiceItem(item);else if(industries)removeIndustry(item);else toggleItem(item);});
    var handle=$('.omni-item-drag',tools);handle.addEventListener('dragstart',function(e){state.draggedItem=item;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.getAttribute('data-item')||item.getAttribute('data-i18n'));});handle.addEventListener('dragend',clearItemDrop);
    item.addEventListener('dragover',function(e){if(!state.draggedItem||state.draggedItem===item||state.draggedItem.parentElement!==item.parentElement)return;e.preventDefault();var source=state.draggedItem;clearItemDrop();state.draggedItem=source;var before=e.clientY<item.getBoundingClientRect().top+item.offsetHeight/2;item.classList.add(before?'omni-item-drop-before':'omni-item-drop-after');});
    item.addEventListener('drop',function(e){var source=state.draggedItem;if(!source||source===item||source.parentElement!==item.parentElement)return;e.preventDefault();var before=item.classList.contains('omni-item-drop-before'),list=item.parentElement;clearItemDrop();if(catalogue)return reorderService(source,item,before);if(industries)return reorderIndustry(source,item,before);commit(function(draft){list.insertBefore(source,before?item:item.nextSibling);draft.itemOrder=draft.itemOrder||{};draft.itemOrder[list.getAttribute('data-list')]=genericItemOrder(list);},'Reorder items');});item.appendChild(tools);
  }
  function decorateItems(){
    $$('[data-list]>[data-item],.eng-cols li[data-catalogue-item]').forEach(function(item){if(!$('.omni-item-tools',item))makeItemTools(item);var tools=$('.omni-item-tools',item),remove=$('.omni-item-remove',tools);if(remove&&!item.hasAttribute('data-catalogue-item')&&item.parentElement.getAttribute('data-list')!=='industry.strip'){var hidden=item.getAttribute('data-omni-hidden-item')==='true';remove.textContent=hidden?'↺':'×';remove.setAttribute('aria-label',hidden?'Restore item':'Remove item');}});
  }

  function applyDraftSettings(){
    var settings=state.draft.settings||{},map={email:{text:settings.email,href:'mailto:'+settings.email},phone:{text:settings.phone,href:'tel:'+(settings.phoneHref||'')},address:{text:settings.address},addressLine1:{text:settings.addressLine1},addressLine2:{text:settings.addressLine2},geoEmail:{text:settings.geoEmail,href:'mailto:'+settings.geoEmail},siteName:{text:settings.siteName}};
    $$('[data-site]').forEach(function(el){var value=map[el.getAttribute('data-site')];if(!value||value.text==null)return;el.textContent=value.text;if(value.href&&el.tagName==='A')el.setAttribute('href',value.href);});
    $$('.mark').forEach(function(mark){if(settings.siteName==='OmniMark')mark.innerHTML='Omni<span>Mark</span>';else mark.textContent=settings.siteName||'OmniMark';});
    var footer=$('.footer-word');if(footer)footer.textContent=settings.siteName||'OmniMark';
  }

  function unreadCount(){return(state.submissions||[]).filter(function(sub){return sub.read!==true;}).length;}
  function updateUnread(){var el=$('[data-unread]'),count=unreadCount();if(el)el.textContent=count?'('+count+')':'';}
  function loadUnread(){api('GET','/api/submissions').then(function(submissions){state.submissions=submissions;updateUnread();}).catch(function(){});}
  function fmtDate(iso){var date=new Date(iso);return isNaN(date)?String(iso||'—'):date.toLocaleString();}
  function csvCell(value){var text=String(value==null?'':value);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
  function exportSubmissions(){
    var fields={};(state.submissions||[]).forEach(function(sub){Object.keys(sub.fields||{}).forEach(function(key){fields[key]=1;});});var keys=Object.keys(fields),head=['id','form','at','lang','page','read'].concat(keys),rows=[head.map(csvCell).join(',')];
    (state.submissions||[]).forEach(function(sub){rows.push([sub.id,sub.form,sub.at,sub.lang,sub.page,sub.read===true].concat(keys.map(function(key){return(sub.fields||{})[key]||'';})).map(csvCell).join(','));});
    var url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='omnimark-submissions-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function renderInbox(root){
    root.textContent='';var toolbar=document.createElement('div');toolbar.className='omni-panel-toolbar';var status=document.createElement('p');status.textContent=(state.submissions||[]).length+' submissions · '+unreadCount()+' unread';var exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Export CSV';exportButton.disabled=!(state.submissions||[]).length;exportButton.addEventListener('click',exportSubmissions);toolbar.append(status,exportButton);root.appendChild(toolbar);
    if(!state.submissions||!state.submissions.length){var empty=document.createElement('div');empty.className='omni-panel-state';empty.textContent='No submissions yet. New enquiries will appear here.';root.appendChild(empty);return;}
    var list=document.createElement('div');list.className='omni-lead-list';state.submissions.forEach(function(sub){
      var card=document.createElement('article');card.className='omni-lead'+(sub.read===true?'':' is-unread');card.setAttribute('data-submission-id',sub.id);var summary=document.createElement('button');summary.type='button';summary.className='omni-lead__summary';summary.setAttribute('aria-expanded','false');var who=(sub.fields&&sub.fields.name)||(sub.fields&&sub.fields.email)||'Anonymous';var label=document.createElement('span');label.textContent=who;var small=document.createElement('small');small.textContent=sub.form+' · '+((sub.fields&&sub.fields.company)||sub.lang||'');label.appendChild(small);var time=document.createElement('time');time.dateTime=sub.at;time.textContent=fmtDate(sub.at);summary.append(label,time);
      var detail=document.createElement('div');detail.className='omni-lead__detail';detail.hidden=true;var dl=document.createElement('dl');Object.keys(sub.fields||{}).forEach(function(key){var dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=sub.fields[key];dl.append(dt,dd);});detail.appendChild(dl);var actions=document.createElement('div');actions.className='omni-inline-actions';var email=sub.fields&&sub.fields.email;if(email){var reply=document.createElement('a');reply.href='mailto:'+email+'?subject='+encodeURIComponent('Re: your '+sub.form+' enquiry');reply.textContent='Reply';actions.appendChild(reply);}var readButton=document.createElement('button');readButton.type='button';readButton.textContent=sub.read===true?'Mark unread':'Mark read';readButton.addEventListener('click',function(){api('PATCH','/api/submissions/'+sub.id,{read:sub.read!==true}).then(function(result){sub.read=result.submission.read;updateUnread();renderInbox(root);}).catch(function(error){toast(error.message||'Could not update the submission.','error');});});var deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.setAttribute('data-danger','');deleteButton.textContent='Delete';deleteButton.addEventListener('click',function(){openDialog({title:'Delete this submission?',message:'This removes the stored lead permanently. Export it first if you need a record.',confirm:'Delete',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/submissions/'+sub.id).then(function(){dialog.close('deleted');state.submissions=state.submissions.filter(function(item){return item.id!==sub.id;});updateUnread();renderInbox(root);toast('Submission deleted.');}).catch(function(error){button.disabled=false;toast(error.message||'Could not delete the submission.','error');});}});});actions.append(readButton,deleteButton);detail.appendChild(actions);summary.addEventListener('click',function(){var open=detail.hidden;detail.hidden=!open;summary.setAttribute('aria-expanded',String(open));});card.append(summary,detail);list.appendChild(card);
    });root.appendChild(list);
  }
  function openInbox(){
    var panel=openPanel('Inbox','right',function(root){var loading=document.createElement('div');loading.className='omni-panel-state';loading.textContent='Loading submissions…';root.appendChild(loading);});var root=$('.omni-panel__body',panel);api('GET','/api/submissions').then(function(submissions){state.submissions=submissions;updateUnread();renderInbox(root);}).catch(function(error){root.innerHTML='<div class="omni-panel-state">Could not load submissions.<br><button type="button">Try again</button></div>';$('button',root).addEventListener('click',openInbox);toast(error.message||'Could not load submissions.','error');});
  }

  function settingField(root,options){
    var wrap=document.createElement('div');wrap.className='omni-field';var id='omni-setting-'+options.path.replace(/[^a-z0-9]/gi,'-'),label=document.createElement('label');label.htmlFor=id;label.textContent=options.label;var input=options.type==='textarea'?document.createElement('textarea'):options.type==='select'?document.createElement('select'):document.createElement('input');input.id=id;
    if(options.type==='select'){options.options.forEach(function(option){var el=document.createElement('option');el.value=option[0];el.textContent=option[1];input.appendChild(el);});}else if(options.type!=='textarea')input.type=options.type||'text';
    if(options.min)input.min=options.min;if(options.max)input.max=options.max;input.value=getPath(state.draft,options.path)==null?'':getPath(state.draft,options.path);input.addEventListener('change',function(){var value=input.type==='number'?Number(input.value):input.value;commit(function(draft){setPath(draft,options.path,value);},'Update '+options.label);});wrap.append(label,input);if(options.help){var small=document.createElement('small');small.textContent=options.help;wrap.appendChild(small);}root.appendChild(wrap);return input;
  }
  function renderSettings(root){
    root.innerHTML='<div class="omni-settings"></div>';var form=$('.omni-settings',root);
    var heading=function(textValue){var h=document.createElement('h3');h.textContent=textValue;form.appendChild(h);};
    heading('Contact');[['settings.email','Email','email'],['settings.phone','Phone (display)','text'],['settings.phoneHref','Phone (dial)','text'],['settings.addressLine1','Address line 1','text'],['settings.addressLine2','Address line 2','text'],['settings.address','Address (one line)','text'],['settings.geoEmail','Local office email','email'],['settings.linkedin','LinkedIn URL','url']].forEach(function(field){settingField(form,{path:field[0],label:field[1],type:field[2]});});
    heading('Site');settingField(form,{path:'settings.siteName',label:'Site name'});settingField(form,{path:'settings.siteUrl',label:'Public URL',type:'url'});settingField(form,{path:'settings.defaultLang',label:'Default language',type:'select',options:[['en','English'],['az','Azerbaijani']]});settingField(form,{path:'settings.privacyUrl',label:'Privacy URL',type:'url'});settingField(form,{path:'settings.termsUrl',label:'Terms URL',type:'url'});settingField(form,{path:'settings.ogImage',label:'Social image URL',type:'url',help:'Recommended: 1200 × 630 px over HTTPS.'});settingField(form,{path:'settings.megaMenuLinkLimit',label:'Mega-menu links per engine',type:'number',min:'1',max:'12'});
    heading('Tools');settingField(form,{path:'settings.schedulerUrl',label:'Meeting scheduler URL',type:'url'});settingField(form,{path:'analytics.gaId',label:'Google Analytics ID'});settingField(form,{path:'analytics.consentScript',label:'Tag snippet — advanced',type:'textarea',help:'Runs only after analytics consent. Admin access is a code-execution privilege.'});
    heading('Proof');var proof=document.createElement('label');proof.className='omni-switch';proof.innerHTML='<input type="checkbox"><span><strong>Show verified proof</strong><small>Keep off until every logo, statistic, testimonial and team profile has written owner approval.</small></span>';var proofInput=$('input',proof);proofInput.checked=!!getPath(state.draft,'features.showVerifiedProof');proofInput.addEventListener('change',function(){commit(function(draft){setPath(draft,'features.showVerifiedProof',proofInput.checked);},'Change proof visibility');});form.appendChild(proof);
    heading('Notifications');var notify=document.createElement('div');notify.className='omni-notify';notify.textContent='Checking server configuration…';form.appendChild(notify);api('GET','/api/status').then(function(status){var ready=status.notifications&&(status.notifications.email||status.notifications.webhook);notify.setAttribute('data-ready',String(!!ready));notify.textContent=ready?'Configured — new submissions are forwarded.':'Not configured — set RESEND_API_KEY + NOTIFY_EMAIL_TO and/or NOTIFY_WEBHOOK_URL in the server environment.';}).catch(function(){notify.setAttribute('data-ready','false');notify.textContent='Could not read notification status.';});
  }
  function openSettings(){openPanel('Settings','right',renderSettings);}

  function closePanel(){var panel=$('.omni-panel');if(!panel)return;panel.remove();if(state.panelReturnFocus&&state.panelReturnFocus.isConnected)state.panelReturnFocus.focus();state.panelReturnFocus=null;}
  function openPanel(title,side,render){
    closePanel();state.panelReturnFocus=document.activeElement;var panel=document.createElement('aside');panel.className='omni-panel omni-panel--'+side;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','omniPanelTitle');panel.innerHTML='<header class="omni-panel__head"><h2 id="omniPanelTitle"></h2><button type="button" class="omni-panel__close" aria-label="Close panel">×</button></header><div class="omni-panel__body"></div>';$('#omniPanelTitle',panel).textContent=title;$('.omni-panel__close',panel).addEventListener('click',closePanel);document.body.appendChild(panel);render($('.omni-panel__body',panel));$('.omni-panel__close',panel).focus();return panel;
  }
  function tokenValue(key,fallback){return(state.draft.design&&state.draft.design.tokens&&state.draft.design.tokens[key])||fallback;}
  function setToken(key,value,label){commit(function(draft){draft.design=draft.design||{};draft.design.tokens=draft.design.tokens||{};if(value)draft.design.tokens[key]=value;else delete draft.design.tokens[key];},label||'Change colour');}
  function renderDesignPanel(root){
    root.innerHTML='<h3>Colours</h3><p class="omni-panel__hint">Brand colours stay expressive; editor chrome stays neutral and readable.</p><div class="omni-colour-list"></div><h3>Font pairing</h3><div class="omni-font-list"></div><h3>Motion</h3><div class="omni-segments" role="group" aria-label="Motion mode"></div><a class="omni-panel-link" href="admin-advanced.html#design">Advanced design settings →</a>';
    var colours=$('.omni-colour-list',root);COLOR_TOKENS.forEach(function(token,index){var row=document.createElement('div');row.className='omni-colour-row';var raw=tokenValue(token[0],token[2]),value=/^#[0-9a-f]{6}$/i.test(raw)?raw:token[2];row.innerHTML='<input type="color" id="omniColour'+index+'" value="'+value+'"><label for="omniHex'+index+'">'+token[1]+'</label><input type="text" id="omniHex'+index+'" value="'+value+'" maxlength="7" aria-label="'+token[1]+' hex value"><button type="button">Reset</button>';var picker=$('input[type="color"]',row),hex=$('input[type="text"]',row);picker.addEventListener('input',function(){hex.value=picker.value.toUpperCase();setToken(token[0],picker.value.toUpperCase(),'Change '+token[1]+' colour');});hex.addEventListener('change',function(){var value=hex.value.trim().toUpperCase();if(!/^#[0-9A-F]{6}$/.test(value)){hex.setAttribute('aria-invalid','true');toast('Use a six-digit hex colour, for example #4634F0.','error');return;}hex.removeAttribute('aria-invalid');picker.value=value;setToken(token[0],value,'Change '+token[1]+' colour');});$('button',row).addEventListener('click',function(){picker.value=token[2];hex.value=token[2];setToken(token[0],null,'Reset '+token[1]+' colour');});colours.appendChild(row);});
    var fonts=$('.omni-font-list',root),current=(state.draft.design&&state.draft.design.fontPreset)||'bricolage-inter';Object.keys(FONT_PRESETS).forEach(function(id){var preset=FONT_PRESETS[id],button=document.createElement('button');button.type='button';button.className='omni-font-card';button.setAttribute('aria-pressed',String(id===current));button.style.fontFamily='"'+preset[0]+'",sans-serif';button.innerHTML='<strong>'+preset[0]+'</strong><span>'+preset[1]+' · '+preset[2]+'</span>';button.addEventListener('click',function(){commit(function(draft){draft.design=draft.design||{};draft.design.fontPreset=id;draft.design.fontDisplay=preset[0];draft.design.fontBody=preset[1];draft.design.fontMono=preset[2];},'Change font pairing');});fonts.appendChild(button);});
    var motion=$('.omni-segments',root),currentMotion=(state.draft.design&&state.draft.design.motion)||'on';['on','calm','off'].forEach(function(mode){var button=document.createElement('button');button.type='button';button.textContent=mode.charAt(0).toUpperCase()+mode.slice(1);button.setAttribute('data-motion',mode);button.setAttribute('aria-pressed',String(mode===currentMotion));button.addEventListener('click',function(){commit(function(draft){draft.design=draft.design||{};draft.features=draft.features||{};draft.design.motion=mode;MOTION_FLAGS.forEach(function(flag){draft.features[flag]=mode==='on';});if(mode==='calm'){draft.features.countUp=true;draft.features.reveal=true;}},'Change motion mode');});motion.appendChild(button);});
  }
  function syncDesignPanel(){
    var panel=$('.omni-panel');if(!panel||$('#omniPanelTitle',panel).textContent!=='Design')return;$$('.omni-font-card',panel).forEach(function(button){var id=Object.keys(FONT_PRESETS).find(function(key){return FONT_PRESETS[key][0]===button.querySelector('strong').textContent;});button.setAttribute('aria-pressed',String(id===state.draft.design.fontPreset));});$$('[data-motion]',panel).forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-motion')===state.draft.design.motion));});
  }
  function buildPageFrame(){
    var frame=document.createElement('div');frame.className='omni-page-frame';frame.id='omniPageFrame';var nodes=$$('body > #site-header, body > header, body > main, body > #site-footer, body > #cookieBanner');nodes.forEach(function(node){frame.appendChild(node);});document.body.insertBefore(frame,$('.omni-toast'));return frame;
  }
  function togglePhone(){var on=document.documentElement.classList.toggle('omni-phone');var button=$('[data-editor-phone]');button.setAttribute('aria-pressed',String(on));button.textContent=on?'Desktop':'Phone';}

  function trapDialog(dialog){
    dialog.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();dialog.close('cancel');return;}if(e.key!=='Tab')return;var f=$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]',dialog).filter(function(el){return !el.hidden;});if(!f.length)return;var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  }
  function closeDialog(value){var dialog=$('.omni-dialog');if(dialog&&dialog.open)dialog.close(value||'cancel');}
  function openDialog(options){
    closeDialog();var returnFocus=document.activeElement,dialog=document.createElement('dialog');dialog.className='omni-dialog';dialog.setAttribute('aria-labelledby','omniDialogTitle');
    dialog.innerHTML='<div class="omni-dialog__body"><h2 id="omniDialogTitle"></h2><div data-dialog-content></div></div><div class="omni-dialog__actions"><button type="button" data-dialog-cancel>Cancel</button><button type="button" data-dialog-confirm></button></div>';
    $('#omniDialogTitle',dialog).textContent=options.title;var content=$('[data-dialog-content]',dialog);if(options.html)content.innerHTML=options.html;else{var p=document.createElement('p');p.textContent=options.message;content.appendChild(p);}
    var confirm=$('[data-dialog-confirm]',dialog);confirm.textContent=options.confirm||'Continue';confirm.toggleAttribute('data-danger',!!options.danger);confirm.toggleAttribute('data-primary',!options.danger);
    $('[data-dialog-cancel]',dialog).addEventListener('click',function(){dialog.close('cancel');});confirm.addEventListener('click',function(){options.action(confirm,dialog);});
    dialog.addEventListener('cancel',function(e){e.preventDefault();dialog.close('cancel');});dialog.addEventListener('close',function(){dialog.remove();if(returnFocus&&returnFocus.isConnected)returnFocus.focus();});trapDialog(dialog);document.body.appendChild(dialog);dialog.showModal();$('[data-dialog-cancel]',dialog).focus();return dialog;
  }
  function publish(){
    finishEdit(true);if(!totalChanges())return;var counts=summaryCounts(),labels={texts:'Texts',sections:'Sections',items:'Items',catalogue:'Catalogue',design:'Design',settings:'Settings'};
    var html='<p>Review the scope of this publish. The live site will update immediately.</p><ul class="omni-summary">'+Object.keys(labels).map(function(key){return'<li><strong>'+counts[key]+'</strong>'+labels[key]+'</li>';}).join('')+'</ul>';
    openDialog({title:'Publish changes?',html:html,confirm:'Publish',action:function(button,dialog){button.disabled=true;button.textContent='Publishing…';saveDraft().then(function(){return api('POST','/api/publish');}).then(function(result){state.live=clone(result.site);state.draft=clone(result.site);state.undo=[];state.redo=[];clearLocal();dialog.close('published');applyDraft();setSaveStatus('Published just now');toast('Published successfully.');}).catch(function(error){button.disabled=false;button.textContent='Publish';toast(error.message||'Publish failed. Your draft is safe.','error');});}});
  }
  function discard(){
    finishEdit(false);if(!totalChanges())return;openDialog({title:'Discard this draft?',message:'All unpublished edits will be removed. The live site will not change.',confirm:'Discard draft',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/draft').then(function(){clearLocal();state.draft=clone(state.live);state.undo=[];state.redo=[];state.allowNavigate=true;dialog.close('discarded');location.reload();}).catch(function(error){button.disabled=false;toast(error.message||'Could not discard the draft.','error');});}});
  }

  function buildBar(){
    var bar=document.createElement('div');bar.className='omni-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','On-page editor');
    var options=PAGE_FILES.map(function(key){return'<option value="'+key+'"'+(key===pageKey()?' selected':'')+'>'+PAGE_LABELS[key]+'</option>';}).join('');
    bar.innerHTML='<div class="omni-bar__brand"><span class="omni-bar__dot"></span>Edit mode</div><div class="omni-bar__group"><label class="omni-sr" for="omniPageSelect">Page</label><select id="omniPageSelect" aria-label="Page">'+options+'</select></div><div class="omni-bar__group"><button type="button" data-editor-lang="en">EN</button><button type="button" data-editor-lang="az">AZ</button></div><div class="omni-bar__group"><button type="button" data-editor-phone aria-pressed="false" aria-label="Phone preview">Phone</button><button type="button" data-editor-undo aria-label="Undo" title="Undo">↶</button><button type="button" data-editor-redo aria-label="Redo" title="Redo">↷</button></div><div class="omni-bar__group"><button type="button" data-editor-design>Design</button><button type="button" data-editor-inbox>Inbox <span data-unread></span></button><button type="button" data-editor-settings>Settings</button></div><span class="omni-bar__spacer"></span><span class="omni-bar__status" data-editor-status aria-live="polite">Draft ready</span><div class="omni-bar__group"><button type="button" data-editor-discard>Discard</button><button type="button" class="omni-bar__publish" data-editor-publish>Publish (0)</button></div>';
    document.body.prepend(bar);var toastEl=document.createElement('div');toastEl.className='omni-toast';toastEl.setAttribute('role','status');toastEl.setAttribute('aria-live','polite');document.body.appendChild(toastEl);
    $('#omniPageSelect').addEventListener('change',function(){var file=this.value==='index'?'index.html':this.value+'.html';finishEdit(true);saveDraft(true).catch(function(){}).then(function(){state.allowNavigate=true;location.href=file+'?edit=1';});});
    $$('[data-editor-lang]').forEach(function(button){button.addEventListener('click',function(){finishEdit(true);state.lang=button.getAttribute('data-editor-lang');window.OmniI18n.setLang(state.lang);applyDraft();});});
    $('[data-editor-undo]').addEventListener('click',undo);$('[data-editor-redo]').addEventListener('click',redo);$('[data-editor-publish]').addEventListener('click',publish);$('[data-editor-discard]').addEventListener('click',discard);
    $('[data-editor-design]').addEventListener('click',function(){openPanel('Design','left',renderDesignPanel);});$('[data-editor-inbox]').addEventListener('click',openInbox);$('[data-editor-settings]').addEventListener('click',openSettings);$('[data-editor-phone]').addEventListener('click',togglePhone);
  }
  function rewriteLinks(){
    $$('a[href]').forEach(function(link){if(link.closest('.omni-bar,.omni-panel,.omni-dialog'))return;var raw=link.getAttribute('href');if(!raw||/^(https?:|mailto:|tel:|#)/i.test(raw)||raw.indexOf('admin')===0)return;try{var url=new URL(raw,location.href);if(url.origin===location.origin){url.searchParams.set('edit','1');link.setAttribute('href',url.pathname.replace(/^\//,'')+url.search+url.hash);}}catch(e){}});
  }
  function bindEvents(){
    document.addEventListener('click',function(e){var el=editableTarget(e.target);if(!el)return;e.preventDefault();e.stopPropagation();beginEdit(el);},true);
    document.addEventListener('click',function(e){var service=e.target.closest('[data-add-service]');if(service){e.preventDefault();addService(service);return;}var industry=e.target.closest('[data-add-industry]');if(industry){e.preventDefault();addIndustry();}},true);
    document.addEventListener('click',function(e){var link=e.target.closest('a[href]');if(!link||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||/^((mailto|tel):|#)/i.test(link.getAttribute('href')))return;var url;try{url=new URL(link.href,location.href);}catch(error){return;}if(url.origin!==location.origin)return;e.preventDefault();finishEdit(true);saveDraft(true).catch(function(){}).then(function(){state.allowNavigate=true;location.href=url.href;});});
    document.addEventListener('keydown',function(e){
      if(state.activeEdit){if(e.key==='Escape'){e.preventDefault();finishEdit(false);return;}if(e.key==='Enter'&&!(e.shiftKey&&state.activeEdit.rich&&/<br\s*\/?\s*>/i.test(state.activeEdit.original))){e.preventDefault();finishEdit(true);return;}}
      if(e.key==='Escape'&&$('.omni-panel')){e.preventDefault();closePanel();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();publish();}
    });
    document.addEventListener('paste',function(e){if(!state.activeEdit)return;e.preventDefault();var text=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,text);});
    document.addEventListener('submit',function(e){if(!e.target.closest('.omni-dialog,.omni-panel')){e.preventDefault();toast('Forms are disabled in edit mode.');}},true);
    window.addEventListener('resize',positionMiniTools);window.addEventListener('scroll',positionMiniTools,true);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&state.draft&&totalChanges())saveDraft(true).catch(function(){});});
    window.addEventListener('beforeunload',function(e){if(!state.allowNavigate&&state.draft&&totalChanges()){flushSync();e.preventDefault();e.returnValue='';}});
  }

  function boot(){
    api('GET','/api/me').then(function(me){if(!me.authed){location.replace('admin.html');throw new Error('Not signed in');}return api('GET','/api/draft');}).then(function(data){
      state.live=clone(data.live);var local=readLocal(),serverAt=data.savedAt?Date.parse(data.savedAt):0,localAt=local&&local.savedAt?Date.parse(local.savedAt):0;
      state.draft=clone(local&&local.draft&&localAt>serverAt?local.draft:(data.draft||data.live));state.savedAt=localAt>serverAt?local.savedAt:data.savedAt;
      state.lang=(window.OmniI18n&&window.OmniI18n.getLang())||'en';state.defaults=(window.OmniSite&&window.OmniSite.getDefaults())||{engines:clone(window.OMNI_ENGINES||[]),industries:clone(window.OMNI_INDUSTRIES||[]),i18n:clone(window.OM_I18N||{en:{},az:{}})};
      buildBar();buildPageFrame();mergeDraftDict();if(window.OmniI18n)window.OmniI18n.setLang(state.lang);applyDraft();rewriteLinks();bindEvents();loadUnread();setSaveStatus(state.savedAt?'Draft restored':'Draft ready');
      document.dispatchEvent(new CustomEvent('omni:editor-ready'));
    }).catch(function(error){if(error.status===401)location.replace('admin.html');else if(error.message!=='Not signed in'){document.documentElement.classList.remove('omni-editing');console.error(error);}});
  }
  window.OmniEditor={getState:function(){return state;},commit:commit,undo:undo,redo:redo,publish:publish,discard:discard};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
