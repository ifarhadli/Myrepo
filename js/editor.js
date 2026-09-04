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
  var state = { live:null, draft:null, savedAt:null, lang:'en', undo:[], redo:[], activeEdit:null, saveTimer:null, saveSeq:0, saving:false, defaults:null, draggedSection:null };

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
    mergeDraftDict();if(window.OmniI18n)window.OmniI18n.applyI18n();decorateSections();updateBar();
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
    section.addEventListener('dragover',function(e){if(!state.draggedSection||state.draggedSection===section||section.parentElement.tagName!=='MAIN')return;e.preventDefault();clearDrop();var before=e.clientY<section.getBoundingClientRect().top+section.offsetHeight/2;section.classList.add(before?'omni-drop-before':'omni-drop-after');});
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

  function trapDialog(dialog){
    dialog.addEventListener('keydown',function(e){if(e.key!=='Tab')return;var f=$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]',dialog).filter(function(el){return !el.hidden;});if(!f.length)return;var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
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
    finishEdit(false);if(!totalChanges())return;openDialog({title:'Discard this draft?',message:'All unpublished edits will be removed. The live site will not change.',confirm:'Discard draft',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/draft').then(function(){clearLocal();state.draft=clone(state.live);state.undo=[];state.redo=[];dialog.close('discarded');location.reload();}).catch(function(error){button.disabled=false;toast(error.message||'Could not discard the draft.','error');});}});
  }

  function buildBar(){
    var bar=document.createElement('div');bar.className='omni-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','On-page editor');
    var options=PAGE_FILES.map(function(key){return'<option value="'+key+'"'+(key===pageKey()?' selected':'')+'>'+PAGE_LABELS[key]+'</option>';}).join('');
    bar.innerHTML='<div class="omni-bar__brand"><span class="omni-bar__dot"></span>Edit mode</div><div class="omni-bar__group"><label class="omni-sr" for="omniPageSelect">Page</label><select id="omniPageSelect" aria-label="Page">'+options+'</select></div><div class="omni-bar__group"><button type="button" data-editor-lang="en">EN</button><button type="button" data-editor-lang="az">AZ</button></div><div class="omni-bar__group"><button type="button" data-editor-phone aria-pressed="false" aria-label="Phone preview">Phone</button><button type="button" data-editor-undo aria-label="Undo" title="Undo">↶</button><button type="button" data-editor-redo aria-label="Redo" title="Redo">↷</button></div><div class="omni-bar__group"><button type="button" data-editor-design>Design</button><button type="button" data-editor-inbox>Inbox <span data-unread></span></button><button type="button" data-editor-settings>Settings</button></div><span class="omni-bar__spacer"></span><span class="omni-bar__status" data-editor-status aria-live="polite">Draft ready</span><div class="omni-bar__group"><button type="button" data-editor-discard>Discard</button><button type="button" class="omni-bar__publish" data-editor-publish>Publish (0)</button></div>';
    document.body.prepend(bar);var toastEl=document.createElement('div');toastEl.className='omni-toast';toastEl.setAttribute('role','status');toastEl.setAttribute('aria-live','polite');document.body.appendChild(toastEl);
    $('#omniPageSelect').addEventListener('change',function(){var file=this.value==='index'?'index.html':this.value+'.html';location.href=file+'?edit=1';});
    $$('[data-editor-lang]').forEach(function(button){button.addEventListener('click',function(){finishEdit(true);state.lang=button.getAttribute('data-editor-lang');window.OmniI18n.setLang(state.lang);applyDraft();});});
    $('[data-editor-undo]').addEventListener('click',undo);$('[data-editor-redo]').addEventListener('click',redo);$('[data-editor-publish]').addEventListener('click',publish);$('[data-editor-discard]').addEventListener('click',discard);
    $('[data-editor-design]').addEventListener('click',function(){toast('Design controls arrive in the next editor phase.');});$('[data-editor-inbox]').addEventListener('click',function(){toast('Inbox controls arrive in the handover phase.');});$('[data-editor-settings]').addEventListener('click',function(){toast('Settings controls arrive in the handover phase.');});$('[data-editor-phone]').addEventListener('click',function(){toast('Phone preview arrives in the next editor phase.');});
  }
  function rewriteLinks(){
    $$('a[href]').forEach(function(link){if(link.closest('.omni-bar,.omni-panel,.omni-dialog'))return;var raw=link.getAttribute('href');if(!raw||/^(https?:|mailto:|tel:|#)/i.test(raw)||raw.indexOf('admin')===0)return;try{var url=new URL(raw,location.href);if(url.origin===location.origin){url.searchParams.set('edit','1');link.setAttribute('href',url.pathname.replace(/^\//,'')+url.search+url.hash);}}catch(e){}});
  }
  function bindEvents(){
    document.addEventListener('click',function(e){var el=editableTarget(e.target);if(!el)return;e.preventDefault();e.stopPropagation();beginEdit(el);},true);
    document.addEventListener('keydown',function(e){
      if(state.activeEdit){if(e.key==='Escape'){e.preventDefault();finishEdit(false);return;}if(e.key==='Enter'&&!(e.shiftKey&&state.activeEdit.rich&&/<br\s*\/?\s*>/i.test(state.activeEdit.original))){e.preventDefault();finishEdit(true);return;}}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();publish();}
    });
    document.addEventListener('paste',function(e){if(!state.activeEdit)return;e.preventDefault();var text=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,text);});
    document.addEventListener('submit',function(e){if(!e.target.closest('.omni-dialog,.omni-panel')){e.preventDefault();toast('Forms are disabled in edit mode.');}},true);
    window.addEventListener('resize',positionMiniTools);window.addEventListener('scroll',positionMiniTools,true);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&state.draft&&totalChanges())saveDraft(true).catch(function(){});});
    window.addEventListener('beforeunload',function(e){if(state.draft&&totalChanges()){flushSync();e.preventDefault();e.returnValue='';}});
  }

  function boot(){
    api('GET','/api/me').then(function(me){if(!me.authed){location.replace('admin.html');throw new Error('Not signed in');}return api('GET','/api/draft');}).then(function(data){
      state.live=clone(data.live);var local=readLocal(),serverAt=data.savedAt?Date.parse(data.savedAt):0,localAt=local&&local.savedAt?Date.parse(local.savedAt):0;
      state.draft=clone(local&&local.draft&&localAt>serverAt?local.draft:(data.draft||data.live));state.savedAt=localAt>serverAt?local.savedAt:data.savedAt;
      state.lang=(window.OmniI18n&&window.OmniI18n.getLang())||'en';state.defaults=(window.OmniSite&&window.OmniSite.getDefaults())||{engines:clone(window.OMNI_ENGINES||[]),industries:clone(window.OMNI_INDUSTRIES||[]),i18n:clone(window.OM_I18N||{en:{},az:{}})};
      buildBar();mergeDraftDict();if(window.OmniI18n)window.OmniI18n.setLang(state.lang);applyDraft();rewriteLinks();bindEvents();setSaveStatus(state.savedAt?'Draft restored':'Draft ready');
      document.dispatchEvent(new CustomEvent('omni:editor-ready'));
    }).catch(function(error){if(error.status===401)location.replace('admin.html');else if(error.message!=='Not signed in'){document.documentElement.classList.remove('omni-editing');console.error(error);}});
  }
  window.OmniEditor={getState:function(){return state;},commit:commit,undo:undo,redo:redo,publish:publish,discard:discard};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
