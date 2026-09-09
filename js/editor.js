/* Authenticated on-page editor. Loaded by server.js only for a valid session
   on public pages requested with ?edit=1. Zero dependencies. */
(function(){
  'use strict';
  document.documentElement.classList.add('omni-editing');

  var $ = function(selector, root){ return (root || document).querySelector(selector); };
  var $$ = function(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var clone = function(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); };
  var same = function(a, b){ return JSON.stringify(a) === JSON.stringify(b); };
  var escapeHtml = function(value){ return String(value).replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];}); };
  var STORAGE_KEY = 'omni-editor-draft';
  var PAGE_FILES = ['index','services','work','case-study','industry','about','insights','article','careers','role-detail','contact','geo','service-brand-launch','sub-service'];
  var PAGE_LABELS = {'index':'Home','services':'Services','work':'Work','case-study':'Case study','industry':'Industry','about':'About','insights':'Insights','article':'Article','careers':'Careers','role-detail':'Role detail','contact':'Contact','geo':'Markets','service-brand-launch':'Brand launch','sub-service':'Sub-service'};
  var state = { live:null, draft:null, savedAt:null, baseUpdatedAt:null, draftRevision:0, savedBy:null, user:null, permissions:{}, draftConflictOpen:false, lang:'en', undo:[], redo:[], activeEdit:null, saveTimer:null, saveSeq:0, saving:false, defaults:null, draggedSection:null, draggedItem:null, draggedCollection:null, panelReturnFocus:null, allowNavigate:false, submissions:null, pagesInfo:null, media:null, mediaContext:null, mediaSearch:'', mediaSelected:null, uploads:[] };
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

  function pageKey(){ return window.OMNI_ITEM&&window.OMNI_ITEM.templateKey?window.OMNI_ITEM.templateKey:((location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '') || 'index'); }
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
        if(!response.ok){ var error=new Error(data.error || ('HTTP '+response.status)); error.status=response.status; error.data=data; throw error; }
        return data;
      });
    });
  }
  function uploadRaw(path, blob, onProgress){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();xhr.open('POST',path);xhr.responseType='json';xhr.setRequestHeader('Content-Type',blob.type||'application/octet-stream');xhr.setRequestHeader('X-Requested-With','OmniAdmin');
      xhr.upload.addEventListener('progress',function(event){if(event.lengthComputable&&onProgress)onProgress(event.loaded/event.total);});
      xhr.addEventListener('load',function(){var data=xhr.response||{};if(xhr.status>=200&&xhr.status<300)return resolve(data);var error=new Error(data.error||('HTTP '+xhr.status));error.status=xhr.status;reject(error);});
      xhr.addEventListener('error',function(){reject(new Error('The upload was interrupted. Check your connection and retry.'));});xhr.addEventListener('abort',function(){reject(new Error('Upload cancelled.'));});xhr.send(blob);
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
    var details=window.OmniElementRules.changes(a,b),addedChanges=Object.keys(details).reduce(function(n,k){return n+details[k];},0);
    return {
      texts:diffCount(a.i18n||{},b.i18n||{}),
      elements:(a.hiddenElements||[]).filter(function(key){return(b.hiddenElements||[]).indexOf(key)<0;}).length+(b.hiddenElements||[]).filter(function(key){return(a.hiddenElements||[]).indexOf(key)<0;}).length+addedChanges,
      sections:diffCount({order:a.sectionOrder||{},hidden:a.hiddenSections||[],accent:a.sectionAccent||{}},{order:b.sectionOrder||{},hidden:b.hiddenSections||[],accent:b.sectionAccent||{}}),
      items:diffCount({order:a.itemOrder||{},hidden:a.hiddenItems||[],collections:a.collections},{order:b.itemOrder||{},hidden:b.hiddenItems||[],collections:b.collections}),
      catalogue:diffCount({engines:a.engines,enginesAz:a.enginesAz,industries:a.industries,industriesAz:a.industriesAz},{engines:b.engines,enginesAz:b.enginesAz,industries:b.industries,industriesAz:b.industriesAz}),
      images:diffCount(a.images||{},b.images||{}),
      design:diffCount(a.design||{},b.design||{}),
      settings:diffCount({settings:a.settings||{},features:a.features||{},analytics:a.analytics||{},structured:a.structured||{},pages:a.pages||{}},{settings:b.settings||{},features:b.features||{},analytics:b.analytics||{},structured:b.structured||{},pages:b.pages||{}})
    };
  }
  function totalChanges(){ var s=summaryCounts(); return Object.keys(s).reduce(function(n,k){return n+s[k];},0); }
  function isMobileEditor(){return window.matchMedia&&window.matchMedia('(max-width: 700px)').matches;}
  function setSaveStatus(textValue,status){ $$('[data-editor-status]').forEach(function(el){el.textContent=textValue.replace(/^Saved ·/,'Draft saved ·').replace('All changes published','Live website up to date');el.setAttribute('data-state',status||'');}); }
  function updateBar(){
    var n=totalChanges();
    $$('[data-editor-publish],[data-editor-mobile-publish]').forEach(function(publish){publish.disabled=!n||state.saving;publish.textContent=n?'Review changes':'Up to date';});
    $$('[data-editor-undo],[data-editor-mobile-undo]').forEach(function(button){button.disabled=!state.undo.length;});var redo=$('[data-editor-redo]');if(redo)redo.disabled=!state.redo.length;
    $$('[data-editor-lang]').forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-editor-lang')===state.lang));});
    $$('[data-mobile-lang]').forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-mobile-lang')===state.lang));});
  }
  var toastTimer;
  function toast(message,kind){
    var el=$('.omni-toast'); if(!el)return; el.textContent=message;el.className='omni-toast is-on'+(kind==='error'?' is-error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='omni-toast';},4200);
  }
  function localKey(){return STORAGE_KEY+'-'+((state.user&&state.user.id)||'legacy');}
  function saveLocal(){
    try{ var at=new Date().toISOString();localStorage.setItem(localKey(),JSON.stringify({savedAt:at,draft:state.draft,draftRevision:state.draftRevision,baseUpdatedAt:state.baseUpdatedAt}));state.savedAt=at; }catch(e){}
  }
  function clearLocal(){ try{localStorage.removeItem(localKey());}catch(e){} }
  function readLocal(){ try{return JSON.parse(localStorage.getItem(localKey())||'null');}catch(e){return null;} }
  function scheduleSave(){ clearTimeout(state.saveTimer);setSaveStatus('Saving…');state.saveTimer=setTimeout(function(){saveDraft().catch(function(){});},1500); }
  function saveDraft(keepalive){
    if(state.recoveryConflict){var conflict=new Error('Resolve the shared draft conflict before saving.');conflict.status=409;conflict.data={code:'draft-stale'};showDraftConflict(conflict.data);return Promise.reject(conflict);}
    if(state.savePromise)return state.savePromise.then(function(){return saveDraft(keepalive);});
    state.savePromise=saveDraftRequest(keepalive).finally(function(){state.savePromise=null;});return state.savePromise;
  }
  function saveDraftRequest(keepalive){
    clearTimeout(state.saveTimer);
    var changed=totalChanges();
    if(!changed){
      if(!state.draftRevision){clearLocal();setSaveStatus('All changes published');return Promise.resolve({revision:0});}
      return api('DELETE','/api/draft',{draftRevision:state.draftRevision},keepalive).then(function(){state.draftRevision=0;clearLocal();setSaveStatus('All changes published');}).catch(function(error){handleSaveError(error);throw error;});
    }
    var snapshot=JSON.stringify(state.draft),seq=++state.saveSeq;state.saving=true;updateBar();setSaveStatus('Saving…');
    return api('PUT','/api/draft',draftPayload(),keepalive).then(function(result){
      if(seq!==state.saveSeq)return result; state.saving=false;state.draftRevision=result.revision||state.draftRevision;state.savedBy=result.savedBy||state.savedBy;saveLocal();
      if(snapshot===JSON.stringify(state.draft)){state.savedAt=result.savedAt;setSaveStatus('Saved · '+new Date(result.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));}
      else scheduleSave(); updateBar(); return result;
    }).catch(function(error){state.saving=false;updateBar();handleSaveError(error);throw error;});
  }
  function handleSaveError(error){
    if(error && error.status===401){location.replace('admin.html');return;}
    if(error&&error.status===409&&error.data&&error.data.code==='draft-stale'){showDraftConflict(error.data);return;}
    if(error&&error.status){setSaveStatus('Not saved — '+(error.message||'try again'),'error');toast(error.message||'Could not save. Your edits are kept on this device.','error');}else setSaveStatus('Offline — changes kept locally','offline');
  }
  function showDraftConflict(info){
    state.recoveryConflict=true;setSaveStatus('Review conflicting changes','error');if(state.draftConflictOpen)return;state.draftConflictOpen=true;
    var who=info&&info.savedBy&&info.savedBy.name?' by '+info.savedBy.name:'';
    openDialog({title:'The shared draft changed'+who,message:'Your local edits are still on this device. Load the latest shared draft before making more changes so one person does not silently overwrite another.',confirm:'Load latest draft',cancel:'Keep local copy',action:function(button,dialog){button.disabled=true;api('GET','/api/draft').then(function(data){state.recoveryConflict=false;clearLocal();state.draft=clone(data.draft||data.live);state.live=clone(data.live);state.savedAt=data.savedAt;state.baseUpdatedAt=data.baseUpdatedAt||(data.live&&data.live.updatedAt)||null;state.draftRevision=data.revision||0;state.savedBy=data.savedBy||null;state.undo=[];state.redo=[];dialog.close('loaded');applyDraft();setSaveStatus('Latest draft loaded');toast('Loaded the latest shared draft.');}).catch(function(error){button.disabled=false;toast(error.message||'Could not load the latest draft.','error');});}});
    var dialog=$('.omni-dialog');if(dialog){var exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Download my edits';exportButton.addEventListener('click',function(){downloadDraft();});dialog.querySelector('.omni-dialog__body').appendChild(exportButton);dialog.addEventListener('close',function(){state.draftConflictOpen=false;},{once:true});}
  }
  /* the draft travels with the live version it was started from, so the server
     can refuse to publish over a change made elsewhere (advanced dashboard) */
  function draftPayload(){ return Object.assign({}, state.draft, { baseUpdatedAt: state.baseUpdatedAt || (state.live && state.live.updatedAt) || null, draftRevision:state.draftRevision }); }
  function flushSync(){
    if(!state.draft || !totalChanges() || state.recoveryConflict || state.savePromise)return;
    try{var xhr=new XMLHttpRequest();xhr.open('PUT','/api/draft',false);xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('X-Requested-With','OmniAdmin');xhr.send(JSON.stringify(draftPayload()));}catch(e){}
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
  function syncCollectionAddress(){var context=window.OMNI_ITEM;if(!context||!context.item)return;var item=currentCollectionItem&&currentCollectionItem();if(!item)return;var next=collectionHref(context.type,item.slug),url=new URL(next,location.origin);context.path=url.pathname;if(location.pathname!==url.pathname||location.search!==url.search)history.replaceState(null,'',url.pathname+url.search);}
  function applyDraft(){
    if(window.OmniSite)window.OmniSite.applyDesign(state.draft);
    mergeDraftDict();if(window.OmniI18n)window.OmniI18n.applyI18n();if(window.OmniSite){window.OmniSite.applyCollections(state.draft);window.OmniSite.applyLayout(state.draft);window.OmniSite.applyImages(state.draft);window.OmniSite.applyItem(state.draft);}renderCatalogueLists();renderIndustryStrip();if(window.OmniSite)window.OmniSite.applyHiddenElements(state.draft);applyDraftSettings();decorateSections();decorateItems();decorateCollections();decorateImageSlots();buildItemToolbar();if(window.OmniSite)window.OmniSite.applyHiddenElements(state.draft);syncCollectionAddress();syncDesignPanel();updateBar();restoreSelection();
    /* Collection and language listeners may replace authored nodes during the
       same turn. Re-apply image state once the replacement DOM is settled. */
    syncPageSections();
    requestAnimationFrame(function(){if(window.OmniSite&&state.draft){window.OmniSite.applyImages(state.draft);window.OmniSite.applyItem(state.draft);window.OmniSite.applyHiddenElements(state.draft);restoreSelection();}});
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
    if(target.closest('.omni-element-tools,.omni-mini-tools'))return null;
    if(target.closest&&target.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-action-sheet,.omni-section-tools,.omni-item-tools,.omni-collection-tools,.omni-item-toolbar,.omni-touch-menu,.omni-catalogue-add,.omni-image-action,.omni-collection-add'))return null;
    var el=target.closest&&target.closest('[data-field],[data-collection-field],[data-collection-plain],[data-i18n]');
    if(!el || el.hasAttribute('data-field-plain') || el.hasAttribute('data-i18n-attr') || el.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-section-tools') || el.classList.contains('mark') || el.closest('.mark'))return null;
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
  function sanitizeHtml(html,collectionRich){
    var template=document.createElement('template');template.innerHTML=html;var allowed={B:1,STRONG:1,EM:1,I:1,A:1,BR:1};
    if(collectionRich){['P','H2','H3','UL','OL','LI','BLOCKQUOTE'].forEach(function(tag){allowed[tag]=1;});}
    Array.prototype.slice.call(template.content.querySelectorAll('*')).forEach(function(node){
      if(!allowed[node.tagName]){node.replaceWith.apply(node,Array.prototype.slice.call(node.childNodes));return;}
      Array.prototype.slice.call(node.attributes).forEach(function(attr){if(!(node.tagName==='A'&&attr.name==='href'))node.removeAttribute(attr.name);});
      if(node.tagName==='A'){var href=(node.getAttribute('href')||'').trim();if(!/^(https?:|mailto:|tel:|\/|#|[a-z0-9-]+\.html)/i.test(href))node.removeAttribute('href');}
    });
    return template.innerHTML.replace(/<div>/gi,'<br>').replace(/<\/div>/gi,'').trim();
  }
  function positionMiniTools(){
    if(!state.activeEdit)return;var tools=$('.omni-mini-tools'),rect=state.activeEdit.el.getBoundingClientRect();if(!tools)return;
    if(isMobileEditor()){
      var viewport=window.visualViewport,keyboard=viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
      tools.style.top='auto';tools.style.left='max(8px, env(safe-area-inset-left))';tools.style.right='max(8px, env(safe-area-inset-right))';tools.style.bottom=keyboard+'px';
      if(viewport){var visibleTop=viewport.offsetTop+8,visibleBottom=viewport.offsetTop+viewport.height-tools.offsetHeight-12,available=visibleBottom-visibleTop;if((rect.height<=available&&(rect.top<visibleTop||rect.bottom>visibleBottom))||rect.top>visibleBottom||rect.bottom<visibleTop)state.activeEdit.el.scrollIntoView({block:'center',behavior:'smooth'});}return;
    }
    tools.style.right='auto';tools.style.bottom='auto';
    var top=Math.max(54,rect.top-tools.offsetHeight-8),left=Math.min(window.innerWidth-tools.offsetWidth-8,Math.max(8,rect.left));tools.style.top=top+'px';tools.style.left=left+'px';
  }
  function makeMiniTools(collectionRich){
    var tools=document.createElement('div');tools.className='omni-mini-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Text formatting');
    var rich=state.activeEdit&&state.activeEdit.rich;
    tools.innerHTML=(rich&&collectionRich?'<button type="button" data-format="p">Paragraph</button><button type="button" data-format="h2">Heading</button><button type="button" data-format="list">List</button><button type="button" data-format="quote">Quote</button>':'')+(rich?'<button type="button" data-format="bold" aria-label="Bold"><b>B</b></button><button type="button" data-format="link">Link</button><button type="button" data-format="clear">Clear</button>':'')+(isMobileEditor()||collectionRich?'<button type="button" data-format="done">Done</button>':'');
    tools.addEventListener('pointerdown',function(e){e.preventDefault();});
    tools.addEventListener('click',function(e){
      var button=e.target.closest('[data-format]');if(!button||!state.activeEdit)return;var action=button.getAttribute('data-format');state.activeEdit.el.focus();
      if(action==='bold')document.execCommand('bold',false,null);
      if(action==='p')document.execCommand('formatBlock',false,'p');
      if(action==='h2')document.execCommand('formatBlock',false,'h2');
      if(action==='list')document.execCommand('insertUnorderedList',false,null);
      if(action==='quote')document.execCommand('formatBlock',false,'blockquote');
      if(action==='clear'){document.execCommand('removeFormat',false,null);document.execCommand('unlink',false,null);}
      if(action==='link')showLinkInput(tools);
      if(action==='done')finishEdit(true);
    });if(state.activeEdit){var info=removalInfo(state.activeEdit.el);if(info)tools.appendChild(removalButton(info));}document.body.appendChild(tools);positionMiniTools();
  }
  function showLinkInput(tools){
    if($('.omni-link-pop',tools))return;var pop=document.createElement('span');pop.className='omni-link-pop';pop.innerHTML='<label class="omni-sr" for="omniLinkUrl">Link URL</label><input id="omniLinkUrl" type="url" value="https://" inputmode="url"><button type="button">Apply</button>';
    tools.appendChild(pop);var input=$('input',pop);input.focus();$('button',pop).addEventListener('click',function(){var url=input.value.trim();if(/^(https?:|mailto:|tel:|\/|#)/i.test(url))document.execCommand('createLink',false,url);pop.remove();state.activeEdit.el.focus();});positionMiniTools();
  }
  function beginEdit(el){
    if(state.activeEdit&&state.activeEdit.el===el)return;finishEdit(true);var collectionNode=el.closest('[data-collection-id]'),context=window.OMNI_ITEM;
    var collection=el.hasAttribute('data-field')||el.hasAttribute('data-collection-field')||el.hasAttribute('data-collection-plain');
    var rich=el.hasAttribute('data-i18n-html')||el.hasAttribute('data-field-rich'),field=el.getAttribute('data-field')||el.getAttribute('data-collection-field')||el.getAttribute('data-collection-plain');
    var type=collectionNode?collectionNode.getAttribute('data-collection-type'):(context&&context.type),id=collectionNode?collectionNode.getAttribute('data-collection-id'):(context&&context.item&&context.item.id);
    state.activeEdit={el:el,key:el.getAttribute('data-i18n'),rich:rich,collection:collection,type:type,id:id,field:field,plain:el.hasAttribute('data-collection-plain'),original:rich?el.innerHTML:el.textContent};
    el.setAttribute('contenteditable',rich?'true':'plaintext-only');el.setAttribute('role','textbox');el.setAttribute('aria-multiline',String(rich&&/<br\s*\/?\s*>/i.test(state.activeEdit.original)));el.focus();
    var selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);makeMiniTools(collection&&rich);var elementTools=$('.omni-element-tools');if(elementTools)elementTools.remove();
  }
  function finishEdit(commitValue){
    var active=state.activeEdit;if(!active)return;state.activeEdit=null;var tools=$('.omni-mini-tools');if(tools)tools.remove();
    active.el.removeAttribute('contenteditable');active.el.removeAttribute('role');active.el.removeAttribute('aria-multiline');
    if(!commitValue){if(active.rich)active.el.innerHTML=active.original;else active.el.textContent=active.original;return;}
    var value=active.rich?sanitizeHtml(active.el.innerHTML,active.collection):active.el.textContent.trim();
    active.el[active.rich?'innerHTML':'textContent']=value||active.original;
    var before=clone(state.draft);if(active.collection)writeCollectionValue(active,value);else writeText(state.lang,active.key,value);if(same(before,state.draft)){applyDraft();return;}
    state.undo.push({before:before,after:clone(state.draft),label:'Edit '+active.key});if(state.undo.length>100)state.undo.shift();state.redo=[];saveLocal();applyDraft();scheduleSave();
  }

  function closeActionSheet(value){var sheet=$('.omni-action-sheet');if(sheet&&sheet.open)sheet.close(value||'cancel');}
  function openActionSheet(title,actions,trigger){
    closeActionSheet();var sheet=document.createElement('dialog');sheet.className='omni-action-sheet';sheet.setAttribute('aria-labelledby','omniActionSheetTitle');
    sheet.innerHTML='<header><span class="omni-action-sheet__handle" aria-hidden="true"></span><h2 id="omniActionSheetTitle"></h2><button type="button" data-action-sheet-close aria-label="Close actions">×</button></header><div class="omni-action-sheet__body"></div>';
    $('#omniActionSheetTitle',sheet).textContent=title;var body=$('.omni-action-sheet__body',sheet);
    actions.forEach(function(action){var button=document.createElement('button');button.type='button';button.textContent=action.label;button.setAttribute('data-action-label',action.label);if(action.hint){var hint=document.createElement('small');hint.textContent=action.hint;button.appendChild(hint);}button.disabled=action.disabled===true;if(action.title)button.title=action.title;if(action.danger)button.setAttribute('data-danger','');button.addEventListener('click',function(){sheet.close('action');setTimeout(action.run,0);});body.appendChild(button);});
    $('[data-action-sheet-close]',sheet).addEventListener('click',function(){sheet.close('cancel');});sheet.addEventListener('cancel',function(event){event.preventDefault();sheet.close('cancel');});sheet.addEventListener('close',function(){sheet.remove();if(trigger&&trigger.isConnected)trigger.focus();});trapDialog(sheet);document.body.appendChild(sheet);sheet.showModal();var first=$('button:not([disabled])',body)||$('[data-action-sheet-close]',sheet);first.focus();return sheet;
  }
  function makeTouchMenu(owner,label,open){
    var button=document.createElement('button');button.type='button';button.className='omni-touch-menu';button.textContent='⋯';button.setAttribute('aria-label',label);button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();finishEdit(true);open(button);});owner.appendChild(button);return button;
  }

  function sectionOrder(){return $$('main > [data-section]').map(function(el){return el.getAttribute('data-section');});}
  function pageSections(){return $$('[data-section]').filter(function(section){return !section.closest('.omni-panel,.omni-dialog,#site-header,#site-footer');});}
  function sectionLabel(section){var heading=$('h1,h2,h3,.eyebrow,.mono-label,.label',section);return section.getAttribute('aria-label')||(heading?moveLabel(heading):'Page section');}
  function renderPageSections(root){
    if(!pageSections().length)return;
    var panel=document.createElement('section');panel.className='omni-page-sections';panel.setAttribute('aria-labelledby','omniPageSectionsTitle');
    panel.innerHTML='<h3 id="omniPageSectionsTitle">Page sections</h3><p class="omni-panel__hint">Choose a section to find it on the page. Reorder or hide sections in your draft; publish when ready.</p><ol data-page-sections></ol>';
    root.prepend(panel);syncPageSections();
  }
  function syncPageSections(){
    var list=$('[data-page-sections]');if(!list)return;
    var sections=pageSections(),movable=$$('main > [data-section]'),active=document.activeElement,scroll=list.closest('.omni-panel__body'),scrollTop=scroll&&scroll.scrollTop;
    sections.forEach(function(section,index){
      var key=section.getAttribute('data-section'),label=sectionLabel(section),row=Array.from(list.children).find(function(el){return el.getAttribute('data-page-section')===key;});
      if(!row){
        row=document.createElement('li');row.setAttribute('data-page-section',key);
        row.innerHTML='<button type="button" data-page-section-select></button><small data-page-section-status></small><div class="omni-page-section-actions"><button type="button" data-page-section-up>Move up</button><button type="button" data-page-section-down>Move down</button><button type="button" data-page-section-toggle></button></div>';
        row.addEventListener('click',function(event){
          var button=event.target.closest('button'),current=pageSections().find(function(el){return el.getAttribute('data-section')===key;});if(!button||button.disabled||!current)return;
          if(button.hasAttribute('data-page-section-select')){clearSelection();state.selection=selectionSelector(current);current.classList.add('omni-selected');current.scrollIntoView({block:'center',behavior:'instant'});$$('[data-page-section-select]',list).forEach(function(el){el.removeAttribute('aria-current');});button.setAttribute('aria-current','true');}
          if(button.hasAttribute('data-page-section-up')){moveSection(current,-1);toast('Moved '+sectionLabel(current)+' up.');}
          if(button.hasAttribute('data-page-section-down')){moveSection(current,1);toast('Moved '+sectionLabel(current)+' down.');}
          if(button.hasAttribute('data-page-section-toggle'))toggleSection(current);
        });
      }
      var hidden=(state.draft.hiddenSections||[]).indexOf(key)>=0,proof=section.hasAttribute('data-proof')&&!(state.draft.features&&state.draft.features.showVerifiedProof);
      $('[data-page-section-select]',row).textContent=label;
      var position=movable.indexOf(section),fixed=position<0;
      row.setAttribute('data-reorderable',String(!fixed));
      $('[data-page-section-status]',row).textContent=(fixed?'Fixed position · ':'')+(hidden?'Hidden by you'+(proof?' · Approval also required':''):proof?'Not approved for publication':'Included in draft');
      row.setAttribute('data-unavailable',String(hidden||proof));
      var up=$('[data-page-section-up]',row),down=$('[data-page-section-down]',row),toggle=$('[data-page-section-toggle]',row);
      up.disabled=fixed||position===0;down.disabled=fixed||position===movable.length-1;up.setAttribute('aria-label','Move '+label+' up');down.setAttribute('aria-label','Move '+label+' down');
      up.title=down.title=fixed?'This section has a fixed position in the page template.':'';
      toggle.textContent=hidden?'Restore':'Hide';toggle.setAttribute('aria-label',(hidden?'Restore ':'Hide ')+label);
      list.appendChild(row);
    });
    Array.from(list.children).forEach(function(row){if(!sections.some(function(section){return section.getAttribute('data-section')===row.getAttribute('data-page-section');}))row.remove();});
    if(active&&list.contains(active)){(active.disabled?$('[data-page-section-select]',active.closest('li')):active).focus({preventScroll:true});}
    if(scroll)scroll.scrollTop=scrollTop;
  }
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
  function openSectionActions(section,trigger){
    var items=$$('main > [data-section]'),index=items.indexOf(section),top=section.parentElement&&section.parentElement.tagName==='MAIN',hidden=section.getAttribute('data-editor-hidden')==='true',accent=((state.draft.sectionAccent||{})[section.getAttribute('data-section')]||0);
    openActionSheet('Section actions',[
      {label:hidden?'Show section':'Hide section',run:function(){toggleSection(section);}},
      {label:'Accent '+(accent?accent+' → '+(accent===5?'none':accent+1):'none → 1'),run:function(){cycleAccent(section);}},
      {label:'Move up',disabled:!top||index===0,run:function(){moveSection(section,-1);}},
      {label:'Move down',disabled:!top||index===items.length-1,run:function(){moveSection(section,1);}}
    ],trigger);
  }
  function makeSectionTools(section){
    var tools=document.createElement('div');tools.className='omni-section-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Section controls');
    tools.innerHTML='<button type="button" class="omni-drag" draggable="true" aria-label="Drag section" title="Drag section">⋮⋮</button><button type="button" data-section-hide aria-label="Hide section" title="Hide or show section">◉</button><button type="button" class="omni-accent" data-section-accent-button aria-label="Cycle accent colour" title="Cycle accent colour">●</button><button type="button" data-section-up aria-label="Move section up" title="Move up">↑ Move up</button><button type="button" data-section-down aria-label="Move section down" title="Move down">↓ Move down</button>';
    tools.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-section-hide'))toggleSection(section);if(b.hasAttribute('data-section-accent-button'))cycleAccent(section);if(b.hasAttribute('data-section-up'))moveSection(section,-1);if(b.hasAttribute('data-section-down'))moveSection(section,1);});
    var handle=$('.omni-drag',tools);handle.addEventListener('dragstart',function(e){state.draggedSection=section;beginDrag(section);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',section.getAttribute('data-section'));});handle.addEventListener('dragend',clearDrop);
    section.addEventListener('dragover',function(e){if(!state.draggedSection||state.draggedSection===section||section.parentElement.tagName!=='MAIN')return;e.preventDefault();var source=state.draggedSection;clearDrop();state.draggedSection=source;beginDrag(source);var before=e.clientY<section.getBoundingClientRect().top+section.offsetHeight/2;section.classList.add(before?'omni-drop-before':'omni-drop-after');});
    section.addEventListener('drop',function(e){if(!state.draggedSection||state.draggedSection===section)return;e.preventDefault();var dragged=state.draggedSection,before=section.classList.contains('omni-drop-before');clearDrop();commit(function(draft){section.parentElement.insertBefore(dragged,before?section:section.nextSibling);draft.sectionOrder=draft.sectionOrder||{};draft.sectionOrder[pageKey()]=sectionOrder();},'Reorder sections');});
    section.appendChild(tools);makeTouchMenu(section,'Open section actions',function(trigger){openSectionActions(section,trigger);});
  }
  /* the drag handles sit in hover-only toolbars; without this the source hides
     as soon as the pointer leaves it and the browser cancels the drag */
  function beginDrag(node){document.documentElement.classList.add('omni-dragging');if(node)node.classList.add('omni-drag-source');}
  function endDrag(){document.documentElement.classList.remove('omni-dragging');$$('.omni-drag-source').forEach(function(el){el.classList.remove('omni-drag-source');});}
  function clearDrop(){state.draggedSection=null;endDrag();$$('.omni-drop-before,.omni-drop-after').forEach(function(el){el.classList.remove('omni-drop-before','omni-drop-after');});}
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
  function removeServiceItem(item){toggleElement(removalInfo(item));}

  function addService(button){
    var parts=button.getAttribute('data-add-service').split(':'),ei=Number(parts[0]),gi=Number(parts[1]);commit(function(draft){ensureCatalogue();draft.engines[ei].groups[gi].items.push('New service');draft.enginesAz[ei].groups[gi].items.push('Yeni xidmət');},'Add catalogue service');
    setTimeout(function(){var items=$$('.eng-row[data-n="'+(ei+1)+'"] .eng-cols > div:nth-child('+(gi+1)+') li');if(items.length)beginEdit(items[items.length-1]);},0);
  }
  function removeIndustry(item){toggleElement(removalInfo(item.querySelector('[data-i18n]')||item));}

  function addIndustry(){
    commit(function(draft){ensureCatalogue();draft.industries.push('New industry');draft.industriesAz.push('Yeni sahə');},'Add industry');
    setTimeout(function(){var items=$$('[data-list="industry.strip"]>[data-item]');if(items.length){var text=$('[data-i18n]',items[items.length-1]);if(text)beginEdit(text);}},0);
  }
  function remapRemovedItems(draft,prefix,from,to,length){
    window.OmniElementRules.remapRemovedItems(draft,prefix,from,to,length);
  }
  function reorderService(source,target,before){
    var a=parseServiceKey(source.getAttribute('data-i18n')),b=parseServiceKey(target.getAttribute('data-i18n'));if(!a||!b||a.engine!==b.engine||a.group!==b.group)return;
    var selection=selectedElement(),follow=selection&&selection.target===source;
    commit(function(draft){ensureCatalogue();var to=b.item;if(a.item<to)to--;if(!before)to++;var prefix='engines.e'+(a.engine+1)+'.groups.'+a.group+'.items.';remapRemovedItems(draft,prefix,a.item,to,draft.engines[a.engine].groups[a.group].items.length);['engines','enginesAz'].forEach(function(prop){var items=draft[prop][a.engine].groups[a.group].items,moved=items.splice(a.item,1)[0];items.splice(to,0,moved);});if(follow)state.elementSelection='main [data-i18n="'+prefix+to+'"]';},'Reorder catalogue services');
  }
  function reorderIndustry(source,target,before){
    var from=Number(source.getAttribute('data-item').slice(1))-1,to=Number(target.getAttribute('data-item').slice(1))-1;
    var selection=selectedElement(),follow=selection&&selection.target===source;
    commit(function(draft){ensureCatalogue();var index=to;if(from<index)index--;if(!before)index++;remapRemovedItems(draft,'industries.',from,index,draft.industries.length);['industries','industriesAz'].forEach(function(prop){var moved=draft[prop].splice(from,1)[0];draft[prop].splice(index,0,moved);});if(follow)state.elementSelection='main [data-i18n="industries.'+index+'"]';},'Reorder industries');
  }
  function genericItemOrder(list){return $$(':scope > [data-item]',list).map(function(el){return el.getAttribute('data-item');});}
  function toggleItem(item){
    var list=item.parentElement,key=list.getAttribute('data-list')+':'+item.getAttribute('data-item');commit(function(draft){draft.hiddenItems=draft.hiddenItems||[];var i=draft.hiddenItems.indexOf(key);if(i>=0)draft.hiddenItems.splice(i,1);else draft.hiddenItems.push(key);},'Toggle item visibility');
  }
  function moveItem(item,direction){
    var siblings=$$(':scope > [data-item],:scope > li[data-catalogue-item]',item.parentElement),index=siblings.indexOf(item),target=siblings[index+direction];if(!target)return;
    if(item.hasAttribute('data-catalogue-item'))return reorderService(item,target,direction<0);
    if(item.parentElement.getAttribute('data-list')==='industry.strip')return reorderIndustry(item,target,direction<0);
    var list=item.parentElement;commit(function(draft){if(direction<0)list.insertBefore(item,target);else list.insertBefore(target,item);draft.itemOrder=draft.itemOrder||{};draft.itemOrder[list.getAttribute('data-list')]=genericItemOrder(list);},'Reorder items');
  }
  function openItemActions(item,trigger){
    var siblings=$$(':scope > [data-item],:scope > li[data-catalogue-item]',item.parentElement),index=siblings.indexOf(item),catalogue=item.hasAttribute('data-catalogue-item'),industries=item.parentElement.getAttribute('data-list')==='industry.strip',hidden=item.hasAttribute('data-omni-hidden-element')||item.getAttribute('data-omni-hidden-item')==='true';
    openActionSheet('Item actions',[
      {label:'Move up',disabled:index<=0,run:function(){moveItem(item,-1);}},
      {label:'Move down',disabled:index<0||index===siblings.length-1,run:function(){moveItem(item,1);}},
      {label:hidden?'Restore item':'Remove item',danger:catalogue||industries||!hidden,run:function(){if(catalogue)removeServiceItem(item);else if(industries)removeIndustry(item);else toggleItem(item);}}
    ],trigger);
  }
  function clearItemDrop(){state.draggedItem=null;endDrag();$$('.omni-item-drop-before,.omni-item-drop-after').forEach(function(el){el.classList.remove('omni-item-drop-before','omni-item-drop-after');});}
  function makeItemTools(item){
    var catalogue=item.hasAttribute('data-catalogue-item'),industries=item.parentElement.getAttribute('data-list')==='industry.strip';var tools=document.createElement('div');tools.className='omni-item-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Item controls');
    tools.innerHTML='<button type="button" class="omni-item-drag" draggable="true" aria-label="Drag item" title="Drag item">⋮⋮</button><button type="button" data-item-up aria-label="Move item up" title="Move up">↑ Move up</button><button type="button" data-item-down aria-label="Move item down" title="Move down">↓ Move down</button><button type="button" class="omni-item-remove" aria-label="Remove item" title="Remove item">×</button>';
    tools.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var button=e.target.closest('button');if(!button)return;if(button.hasAttribute('data-item-up'))moveItem(item,-1);if(button.hasAttribute('data-item-down'))moveItem(item,1);if(button.classList.contains('omni-item-remove')){if(catalogue)removeServiceItem(item);else if(industries)removeIndustry(item);else toggleItem(item);}});
    var handle=$('.omni-item-drag',tools);handle.addEventListener('dragstart',function(e){state.draggedItem=item;beginDrag(item);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.getAttribute('data-item')||item.getAttribute('data-i18n'));});handle.addEventListener('dragend',clearItemDrop);
    item.addEventListener('dragover',function(e){if(!state.draggedItem||state.draggedItem===item||state.draggedItem.parentElement!==item.parentElement)return;e.preventDefault();var source=state.draggedItem;clearItemDrop();state.draggedItem=source;beginDrag(source);var before=e.clientY<item.getBoundingClientRect().top+item.offsetHeight/2;item.classList.add(before?'omni-item-drop-before':'omni-item-drop-after');});
    item.addEventListener('drop',function(e){var source=state.draggedItem;if(!source||source===item||source.parentElement!==item.parentElement)return;e.preventDefault();var before=item.classList.contains('omni-item-drop-before'),list=item.parentElement;clearItemDrop();if(catalogue)return reorderService(source,item,before);if(industries)return reorderIndustry(source,item,before);commit(function(draft){list.insertBefore(source,before?item:item.nextSibling);draft.itemOrder=draft.itemOrder||{};draft.itemOrder[list.getAttribute('data-list')]=genericItemOrder(list);},'Reorder items');});item.appendChild(tools);makeTouchMenu(item,'Open item actions',function(trigger){openItemActions(item,trigger);});
  }
  function decorateItems(){
    $$('[data-list]>[data-item]:not([data-collection-id]),.eng-cols li[data-catalogue-item]').forEach(function(item){if(!$('.omni-item-tools',item))makeItemTools(item);var tools=$('.omni-item-tools',item),remove=$('.omni-item-remove',tools),siblings=$$(':scope > [data-item]:not([data-collection-id]),:scope > li[data-catalogue-item]',item.parentElement),index=siblings.indexOf(item),up=$('[data-item-up]',tools),down=$('[data-item-down]',tools);if(up)up.disabled=index<=0;if(down)down.disabled=index<0||index===siblings.length-1;if(remove){var hidden=item.hasAttribute('data-omni-hidden-element')||item.getAttribute('data-omni-hidden-item')==='true';remove.textContent=hidden?'↺':'×';remove.setAttribute('aria-label',hidden?'Restore item':'Remove item');}});
  }

  /* ---------- Collections: cases, articles, jobs, team, testimonials ---------- */
  function defaultCollections(){return(state.defaults&&state.defaults.collections)||window.OMNI_COLLECTIONS||{cases:[],articles:[],jobs:[],team:[],testimonials:[]};}
  /* write path — only inside commit(): materialises the defaults into the draft */
  function ensureCollections(draft){draft=draft||state.draft;if(!draft.collections)draft.collections=clone(defaultCollections());return draft.collections;}
  /* read path — never mutates, so simply opening a page cannot invent changes */
  function viewCollections(draft){draft=draft||state.draft;return draft.collections||defaultCollections();}
  /* pass a draft (always from inside commit()) to get a writable item; omit it to
     read for display, which must never materialise defaults into the draft */
  function collectionItem(type,id,draft){var list=((draft?ensureCollections(draft):viewCollections(state.draft))[type]||[]);return list.find(function(item){return item.id===id;});}
  function currentCollectionItem(draft){var context=window.OMNI_ITEM;return context&&context.item?collectionItem(context.type,context.item.id,draft):null;}
  function writeCollectionValue(active,value){var item=collectionItem(active.type,active.id,state.draft);if(!item)return;if(active.plain)item[active.field]=value;else{item.fields=item.fields||{};item.fields[active.field]=item.fields[active.field]||{en:'',az:''};item.fields[active.field][state.lang]=value;}item.updatedAt=new Date().toISOString();}
  function randomCollectionId(){var bytes=new Uint8Array(8);crypto.getRandomValues(bytes);return Array.prototype.map.call(bytes,function(value){return value.toString(16).padStart(2,'0');}).join('');}
  function slugify(value){return String(value||'untitled').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'untitled';}
  function uniqueSlug(type,value,exceptId,draft){var base=slugify(value),slug=base,n=2,list=(viewCollections(draft||state.draft)[type]||[]);while(list.some(function(item){return item.id!==exceptId&&item.slug===slug;}))slug=(base.slice(0,55-String(n).length)+'-'+n++);return slug;}
  function collectionLabel(type){return{cases:'case',articles:'article',jobs:'job',team:'team member',testimonials:'testimonial'}[type]||'item';}
  function collectionHref(type,slug){return({cases:'/work/',articles:'/insights/',jobs:'/careers/'}[type]||'/')+slug+'?edit=1';}
  function blankCollectionItem(type,draft){var now=new Date().toISOString(),label=collectionLabel(type),item={id:randomCollectionId(),slug:uniqueSlug(type,'untitled-'+label,null,draft),published:false,order:(ensureCollections(draft)[type]||[]).length,createdAt:now,updatedAt:now,fields:{}};
    if(type==='cases'){item.sector='b2b';item.client='';item.year=String(new Date().getFullYear());item.fields={title:{en:'Untitled case',az:'Adsız nümunə'},summary:{en:'Add a short case summary.',az:'Qısa nümunə xülasəsi əlavə edin.'},body:{en:'<p>Write the case story here.</p>',az:'<p>Nümunə hekayəsini burada yazın.</p>'},metrics:[]};}
    if(type==='articles'){item.category='demand';item.author='';item.date=new Date().toISOString().slice(0,10);item.readingMinutes=5;item.fields={title:{en:'Untitled article',az:'Adsız məqalə'},dek:{en:'Add a short article summary.',az:'Qısa məqalə xülasəsi əlavə edin.'},body:{en:'<p>Write the article here.</p>',az:'<p>Məqaləni burada yazın.</p>'}};}
    if(type==='jobs'){item.location='';item.remote=false;item.type='full-time';item.applyUrl='';item.validThrough='';item.fields={title:{en:'Untitled role',az:'Adsız vakansiya'},summary:{en:'Add a short role summary.',az:'Qısa vakansiya xülasəsi əlavə edin.'},body:{en:'<p>Describe the role here.</p>',az:'<p>Vakansiyanı burada təsvir edin.</p>'}};}
    if(type==='team'){item.name='New team member';item.linkedin='';item.fields={role:{en:'Role',az:'Vəzifə'},bio:{en:'',az:''}};}
    if(type==='testimonials'){item.name='Client name';item.company='Company';item.fields={quote:{en:'Add the client quote.',az:'Müştəri sitatını əlavə edin.'},role:{en:'Role',az:'Vəzifə'}};}
    return item;
  }
  function createCollectionItem(type){var created;commit(function(draft){var collections=ensureCollections(draft);created=blankCollectionItem(type,draft);collections[type].push(created);},'Create '+collectionLabel(type));if(['cases','articles','jobs'].includes(type)){saveDraft(true).then(function(){state.allowNavigate=true;location.href=collectionHref(type,created.slug);}).catch(function(error){toast(error.message||'The item was created, but navigation failed.','error');});}}
  function toggleCollectionPublished(type,id){commit(function(draft){var item=collectionItem(type,id,draft);if(item){item.published=!item.published;item.updatedAt=new Date().toISOString();}},'Change '+collectionLabel(type)+' status');}
  function duplicateCollectionItem(type,id){var duplicate;commit(function(draft){var collections=ensureCollections(draft),source=collectionItem(type,id,draft);if(!source)return;duplicate=clone(source);duplicate.id=randomCollectionId();duplicate.slug=uniqueSlug(type,source.slug+'-copy',null,draft);duplicate.published=false;duplicate.order=collections[type].length;duplicate.createdAt=duplicate.updatedAt=new Date().toISOString();collections[type].push(duplicate);},'Duplicate '+collectionLabel(type));return duplicate;}
  function removeCollectionItem(type,id){openDialog({title:'Delete this '+collectionLabel(type)+'?',message:'It will be removed from this draft. After publishing, the previous version remains recoverable from History.',confirm:'Delete',danger:true,action:function(button,dialog){commit(function(draft){var list=ensureCollections(draft)[type]||[],index=list.findIndex(function(item){return item.id===id;});if(index>=0)list.splice(index,1);},'Delete '+collectionLabel(type));dialog.close('deleted');if(window.OMNI_ITEM&&window.OMNI_ITEM.item.id===id){saveDraft(true).then(function(){state.allowNavigate=true;location.href=({cases:'work.html',articles:'insights.html',jobs:'careers.html'}[type]||'index.html')+'?edit=1';});}}});}
  function moveCollectionItem(type,id,direction){commit(function(draft){var list=ensureCollections(draft)[type].slice().sort(function(a,b){return(a.order||0)-(b.order||0);}),index=list.findIndex(function(item){return item.id===id;}),next=index+direction;if(index<0||next<0||next>=list.length)return;var moved=list[index];list[index]=list[next];list[next]=moved;list.forEach(function(item,i){item.order=i;});draft.collections[type]=list;},'Reorder '+collectionLabel(type));}
  function clearCollectionDrop(){endDrag();if(state.draggedCollection&&state.draggedCollection.node)state.draggedCollection.node.classList.remove('omni-item-dragging');$$('.omni-collection-drop-before,.omni-collection-drop-after').forEach(function(node){node.classList.remove('omni-collection-drop-before','omni-collection-drop-after');});state.draggedCollection=null;}
  function reorderCollectionItem(type,sourceId,targetId,before){commit(function(draft){var list=ensureCollections(draft)[type].slice().sort(function(a,b){return(a.order||0)-(b.order||0);}),from=list.findIndex(function(item){return item.id===sourceId;}),target=list.findIndex(function(item){return item.id===targetId;});if(from<0||target<0||from===target)return;var moved=list.splice(from,1)[0];target=list.findIndex(function(item){return item.id===targetId;});list.splice(target+(before?0:1),0,moved);list.forEach(function(item,index){item.order=index;});draft.collections[type]=list;},'Reorder '+collectionLabel(type));}
  function openCollectionActions(node,trigger){
    var type=node.getAttribute('data-collection-type'),id=node.getAttribute('data-collection-id'),item=collectionItem(type,id),ordered=(viewCollections()[type]||[]).slice().sort(function(a,b){return(a.order||0)-(b.order||0);}),index=ordered.findIndex(function(entry){return entry.id===id;});if(!item)return;
    var actions=[];if(['cases','articles','jobs'].includes(type))actions.push({label:'Open '+collectionLabel(type),run:function(){var link=$('.omni-collection-open',node);if(link)link.click();}});if(type==='team')actions.push({label:'Edit details',run:function(){openPanel('Team member details','right',function(root){renderListingItemDetails(root,type,id);});}});
    actions=actions.concat([
      {label:'Move up',disabled:index<=0,run:function(){moveCollectionItem(type,id,-1);}},
      {label:'Move down',disabled:index<0||index===ordered.length-1,run:function(){moveCollectionItem(type,id,1);}},
      {label:item.published?'Unpublish':'Publish',run:function(){toggleCollectionPublished(type,id);}},
      {label:'Change image',run:function(){openMedia({kind:'collection',type:type,id:id});}},
      {label:'Duplicate',run:function(){duplicateCollectionItem(type,id);}},
      {label:'Delete '+collectionLabel(type),danger:true,run:function(){removeCollectionItem(type,id);}}
    ]);openActionSheet(collectionLabel(type).replace(/^./,function(value){return value.toUpperCase();})+' actions',actions,trigger);
  }
  function collectionTools(node){var type=node.getAttribute('data-collection-type'),id=node.getAttribute('data-collection-id'),item=collectionItem(type,id);if(!item)return;var tools=document.createElement('div');tools.className='omni-collection-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label',collectionLabel(type)+' controls');tools.innerHTML=(['cases','articles','jobs'].includes(type)?'<a href="'+collectionHref(type,item.slug)+'" class="omni-collection-open">Open</a>':'')+'<button type="button" data-collection-up aria-label="Move up">↑ Move up</button><button type="button" data-collection-down aria-label="Move down">↓ Move down</button><button type="button" data-collection-status>'+(item.published?'Unpublish':'Publish')+'</button><button type="button" data-collection-image-button>Image</button><button type="button" data-collection-copy>Duplicate</button><button type="button" data-collection-delete>Delete</button>';
    var handle=document.createElement('button');handle.type='button';handle.draggable=true;handle.className='omni-collection-drag';handle.setAttribute('aria-label','Drag to reorder '+collectionLabel(type));handle.title='Drag to reorder';handle.textContent='⋮⋮';tools.prepend(handle);
    if(type==='team'){var details=document.createElement('button');details.type='button';details.setAttribute('data-collection-details','');details.textContent='Details';details.addEventListener('click',function(){openPanel('Team member details','right',function(root){renderListingItemDetails(root,type,id);});});handle.after(details);}
    tools.addEventListener('click',function(event){var button=event.target.closest('button');if(!button)return;event.preventDefault();event.stopPropagation();if(button.hasAttribute('data-collection-up'))moveCollectionItem(type,id,-1);if(button.hasAttribute('data-collection-down'))moveCollectionItem(type,id,1);if(button.hasAttribute('data-collection-status'))toggleCollectionPublished(type,id);if(button.hasAttribute('data-collection-copy'))duplicateCollectionItem(type,id);if(button.hasAttribute('data-collection-delete'))removeCollectionItem(type,id);if(button.hasAttribute('data-collection-image-button'))openMedia({kind:'collection',type:type,id:id});});
    handle.addEventListener('dragstart',function(event){state.draggedCollection={node:node,type:type,id:id};node.classList.add('omni-item-dragging');beginDrag(node);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);});handle.addEventListener('dragend',clearCollectionDrop);
    node.addEventListener('dragover',function(event){var source=state.draggedCollection;if(!source||source.node===node||source.type!==type)return;event.preventDefault();$$('.omni-collection-drop-before,.omni-collection-drop-after').forEach(function(candidate){candidate.classList.remove('omni-collection-drop-before','omni-collection-drop-after');});node.classList.add(event.clientY<node.getBoundingClientRect().top+node.offsetHeight/2?'omni-collection-drop-before':'omni-collection-drop-after');});
    node.addEventListener('drop',function(event){var source=state.draggedCollection;if(!source||source.node===node||source.type!==type)return;event.preventDefault();var before=node.classList.contains('omni-collection-drop-before'),sourceId=source.id;clearCollectionDrop();reorderCollectionItem(type,sourceId,id,before);});node.appendChild(tools);makeTouchMenu(node,'Open '+collectionLabel(type)+' actions',function(trigger){openCollectionActions(node,trigger);});}
  function decorateCollections(){
    $$('[data-collection]').forEach(function(mount){var type=mount.getAttribute('data-collection');if(!$('.omni-collection-add',mount)){var add=document.createElement('button');add.type='button';add.className='omni-collection-add';add.setAttribute('data-collection-add',type);add.textContent='+ New '+collectionLabel(type);add.addEventListener('click',function(){createCollectionItem(type);});mount.appendChild(add);}});
    $$('[data-collection-id]').forEach(function(node){var item=collectionItem(node.getAttribute('data-collection-type'),node.getAttribute('data-collection-id')),badge=$('.collection-draft',node);if(item&&!item.published&&!badge){badge=document.createElement('span');badge.className='collection-draft';badge.textContent='Draft';node.prepend(badge);}else if(item&&item.published&&badge)badge.remove();if(!$('.omni-collection-tools',node))collectionTools(node);});
  }
  function itemField(root,label,value,type,onChange){var row=document.createElement('div');row.className='omni-setting';var id='omniItem'+Math.random().toString(36).slice(2),lab=document.createElement('label');lab.htmlFor=id;lab.textContent=label;var input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');input.id=id;if(type!=='select'&&type!=='textarea')input.type=type||'text';input.value=value==null?'':value;row.append(lab,input);root.appendChild(row);input.addEventListener('change',function(){onChange(input.value,input);});return input;}
  function itemToggle(root,label,checked,onChange){var wrap=document.createElement('label');wrap.className='omni-switch';var input=document.createElement('input');input.type='checkbox';input.checked=checked===true;var copy=document.createElement('span'),strong=document.createElement('strong');strong.textContent=label;copy.appendChild(strong);wrap.append(input,copy);root.appendChild(wrap);input.addEventListener('change',function(){onChange(input.checked,input);});return input;}
  function renderListingItemDetails(root,type,id){var item=collectionItem(type,id);if(!item){root.textContent='Item not found in this draft.';return;}root.innerHTML='<p class="omni-panel__hint">Name, role and biography are edited directly on the card. This field controls the external profile link.</p>';itemField(root,'LinkedIn URL (HTTPS)',item.linkedin,'url',function(value,input){if(value&&!/^https:\/\//i.test(value)){input.setAttribute('aria-invalid','true');toast('Use a complete HTTPS URL.','error');return;}input.removeAttribute('aria-invalid');commit(function(draft){collectionItem(type,id,draft).linkedin=value.trim();},'Change team LinkedIn URL');});}
  function renderItemDetails(root){var context=window.OMNI_ITEM,item=currentCollectionItem();if(!item){root.textContent='Item not found in this draft.';return;}var type=context.type;root.innerHTML='<p class="omni-panel__hint">These fields control filtering, metadata and the item page. Text content is edited directly on the page.</p>';
    itemField(root,'Slug',item.slug,'text',function(value,input){var clean=slugify(value);if(!/^[a-z0-9-]{2,60}$/.test(clean)||uniqueSlug(type,clean,item.id)!==clean){input.setAttribute('aria-invalid','true');toast('Use a unique slug with at least two letters, numbers or hyphens.','error');return;}input.removeAttribute('aria-invalid');commit(function(draft){var target=collectionItem(type,item.id,draft);target.slug=clean;target.updatedAt=new Date().toISOString();},'Change item slug');});
    if(type==='cases'){itemField(root,'Sector key',item.sector,'text',function(v){commit(function(d){collectionItem(type,item.id,d).sector=slugify(v);},'Change case sector');});itemField(root,'Client',item.client,'text',function(v){commit(function(d){collectionItem(type,item.id,d).client=v;},'Change case client');});itemField(root,'Year',item.year,'text',function(v){commit(function(d){collectionItem(type,item.id,d).year=v;},'Change case year');});renderMetrics(root,item);}
    if(type==='articles'){var category=itemField(root,'Category',item.category,'select',function(v){commit(function(d){collectionItem(type,item.id,d).category=v;},'Change article category');});['demand','revops','sales','brand'].forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;category.appendChild(o);});category.value=item.category;itemField(root,'Author',item.author,'text',function(v){commit(function(d){collectionItem(type,item.id,d).author=v;},'Change article author');});itemField(root,'Date',item.date,'date',function(v){commit(function(d){collectionItem(type,item.id,d).date=v;},'Change article date');});itemField(root,'Reading minutes',item.readingMinutes,'number',function(v){commit(function(d){collectionItem(type,item.id,d).readingMinutes=Math.max(1,Math.min(180,parseInt(v,10)||5));},'Change reading time');});}
    if(type==='jobs'){itemField(root,'Location',item.location,'text',function(v){commit(function(d){collectionItem(type,item.id,d).location=v;},'Change job location');});itemToggle(root,'This role is remote',item.remote,function(v){commit(function(d){collectionItem(type,item.id,d).remote=v;},'Change remote status');});var kind=itemField(root,'Employment type',item.type,'select',function(v){commit(function(d){collectionItem(type,item.id,d).type=v;},'Change employment type');});['full-time','part-time','contract'].forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;kind.appendChild(o);});kind.value=item.type;itemField(root,'Apply URL (HTTPS)',item.applyUrl,'url',function(v,input){if(v&&!/^https:\/\//i.test(v)){input.setAttribute('aria-invalid','true');toast('Use a complete HTTPS URL.','error');return;}input.removeAttribute('aria-invalid');commit(function(d){collectionItem(type,item.id,d).applyUrl=v;},'Change apply URL');});itemField(root,'Valid through',item.validThrough,'date',function(v){commit(function(d){collectionItem(type,item.id,d).validThrough=v;},'Change closing date');});}
  }
  function renderMetrics(root,item){var title=document.createElement('h3');title.textContent='Metrics';root.appendChild(title);var list=document.createElement('div');list.className='omni-metric-editor';root.appendChild(list);(item.fields.metrics||[]).forEach(function(metric,index){var row=document.createElement('div');row.className='omni-metric-row';row.innerHTML='<input aria-label="Metric value" value="'+escapeHtml(metric.value||'')+'"><input aria-label="Metric label in '+state.lang.toUpperCase()+'" value="'+escapeHtml((metric.label&&metric.label[state.lang])||'')+'"><button type="button" aria-label="Delete metric">×</button>';var inputs=$$('input',row);inputs.forEach(function(input){input.addEventListener('change',function(){commit(function(d){var target=collectionItem('cases',item.id,d),m=target.fields.metrics[index];m.value=inputs[0].value;m.label=m.label||{en:'',az:''};m.label[state.lang]=inputs[1].value;},'Edit case metric');});});$('button',row).addEventListener('click',function(){commit(function(d){collectionItem('cases',item.id,d).fields.metrics.splice(index,1);},'Delete case metric');});list.appendChild(row);});var add=document.createElement('button');add.type='button';add.className='omni-panel-action';add.setAttribute('data-collection-add-metric','');add.textContent='+ Add metric';add.disabled=(item.fields.metrics||[]).length>=4;add.addEventListener('click',function(){commit(function(d){collectionItem('cases',item.id,d).fields.metrics.push({value:'0',label:{en:'New metric',az:'Yeni göstərici'}});},'Add case metric');openPanel('Item details','right',renderItemDetails);});root.appendChild(add);if(window.OmniFieldHelp)window.OmniFieldHelp.enhance(root);}
  function openCurrentItemActions(context,item,trigger){openActionSheet('Current '+collectionLabel(context.type),[
    {label:item.published?'Unpublish':'Publish',run:function(){toggleCollectionPublished(context.type,item.id);}},
    {label:'Item details',run:function(){openPanel('Item details','right',renderItemDetails);}},
    {label:'Duplicate',run:function(){var copy=duplicateCollectionItem(context.type,item.id);if(copy){saveDraft(true).then(function(){state.allowNavigate=true;location.href=collectionHref(context.type,copy.slug);});}}},
    {label:'Delete '+collectionLabel(context.type),danger:true,run:function(){removeCollectionItem(context.type,item.id);}}
  ],trigger);}
  function buildItemToolbar(){
    var context=window.OMNI_ITEM,item=currentCollectionItem();if(!context||!item)return;var bar=$('.omni-item-toolbar');if(!bar){bar=document.createElement('div');bar.className='omni-item-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Current item controls');var frame=$('.omni-page-frame');if(frame)frame.prepend(bar);else document.body.appendChild(bar);}
    bar.innerHTML='<strong>'+escapeHtml(collectionLabel(context.type))+'</strong><span>'+(item.published?'Published':'Draft')+'</span><button type="button" data-item-status>'+(item.published?'Unpublish':'Publish')+'</button><button type="button" data-item-details>Item details</button><button type="button" data-item-copy>Duplicate</button><button type="button" data-item-delete>Delete</button>';
    $('[data-item-status]',bar).addEventListener('click',function(){toggleCollectionPublished(context.type,item.id);});$('[data-item-details]',bar).addEventListener('click',function(){openPanel('Item details','right',renderItemDetails);});$('[data-item-copy]',bar).addEventListener('click',function(){var copy=duplicateCollectionItem(context.type,item.id);if(copy){saveDraft(true).then(function(){state.allowNavigate=true;location.href=collectionHref(context.type,copy.slug);});}});$('[data-item-delete]',bar).addEventListener('click',function(){removeCollectionItem(context.type,item.id);});makeTouchMenu(bar,'Open current item actions',function(trigger){openCurrentItemActions(context,item,trigger);});
  }

  /* ---------- Media: bounded library + image slots ---------- */
  function mediaUrl(id,width){return'/media/'+id+'-'+(width||480)+'.webp';}
  function mediaContextLabel(context){context=context||state.mediaContext;if(!context)return'Library';if(context.kind==='slot'){var parts=context.key.split('.'),page=PAGE_LABELS[parts.shift()]||'Shared website',position=parts.join(' ').replace(/hero/g,'main image').replace(/featured/g,'menu image').replace(/logos? /g,'client logo ').replace(/l(\d+)/g,'$1');return page+' · '+position;}if(context.kind==='collection')return collectionLabel(context.type)+' image';if(context.kind==='collection-social')return collectionLabel(context.type)+' social image';if(context.kind==='page-social')return PAGE_LABELS[context.key]+' social image';return'Site-wide social image';}
  function currentMediaValue(context){context=context||state.mediaContext;if(!context)return'';if(context.kind==='slot')return((state.draft.images||{})[context.key]||{}).id||'';if(context.kind==='collection'){var item=collectionItem(context.type,context.id);return(item&&item.image&&item.image.id)||'';}if(context.kind==='collection-social'){var social=collectionItem(context.type,context.id);return(social&&social.seo&&social.seo.ogImage)||'';}if(context.kind==='page-social')return getPath(state.draft,'pages.'+context.key+'.ogImage')||'';return getPath(state.draft,'settings.ogImage')||'';}
  function replaceMedia(item){if(!state.media)return;var index=state.media.findIndex(function(value){return value.id===item.id;});if(index>=0)state.media[index]=item;else state.media.unshift(item);}
  function formatBytes(bytes){var value=Number(bytes)||0;if(value<1024)return value+' B';if(value<1024*1024)return(value/1024).toFixed(1)+' KB';return(value/1024/1024).toFixed(1)+' MB';}
  function loadMedia(force){if(state.media&&!force)return Promise.resolve(state.media);state.media=null;return api('GET','/api/media').then(function(items){state.media=items;return items;});}
  function imageFromFile(file){
    if(window.createImageBitmap)return createImageBitmap(file).then(function(bitmap){return{source:bitmap,width:bitmap.width,height:bitmap.height,close:function(){bitmap.close();}};});
    return new Promise(function(resolve,reject){var url=URL.createObjectURL(file),img=new Image();img.onload=function(){resolve({source:img,width:img.naturalWidth,height:img.naturalHeight,close:function(){URL.revokeObjectURL(url);}});};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('This image could not be decoded.'));};img.src=url;});
  }
  function canvasBlob(image,width){
    var outWidth=Math.min(width,image.width),outHeight=Math.max(1,Math.round(image.height*outWidth/image.width)),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=outWidth;canvas.height=outHeight;ctx.drawImage(image.source,0,0,outWidth,outHeight);
    return new Promise(function(resolve,reject){canvas.toBlob(function(blob){if(blob&&blob.type==='image/webp')return resolve(blob);ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,outWidth,outHeight);canvas.toBlob(function(jpeg){if(jpeg)resolve(jpeg);else reject(new Error('The browser could not create a responsive image.'));},'image/jpeg',.86);},'image/webp',.82);});
  }
  function uploadRow(upload){return $('[data-upload-id="'+upload.id+'"]');}
  function syncUploadRow(upload){var row=uploadRow(upload);if(!row)return;var progress=$('progress',row),status=$('[data-upload-status]',row),retry=$('[data-upload-retry]',row);progress.value=upload.progress||0;status.textContent=upload.error||upload.status;status.setAttribute('data-kind',upload.error?'error':'');retry.hidden=!upload.error;}
  function uploadImage(file,assignAfter,resumeItem,targetContext){
    var target=clone(targetContext===undefined?state.mediaContext:targetContext);
    var allowed=['image/png','image/jpeg','image/webp'],upload={id:'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),file:file,status:'Checking image…',progress:resumeItem?25:0,error:'',assignAfter:!!assignAfter,target:target,item:resumeItem||null};state.uploads.unshift(upload);if(state.mediaContext)state.mediaStep='choose';refreshMediaPanel();
    if(allowed.indexOf(file.type)<0){upload.error='Use PNG, JPEG or WebP. SVG is not accepted.';syncUploadRow(upload);return Promise.reject(new Error(upload.error));}
    if(!file.size||file.size>8*1024*1024){upload.error='Images must be between 1 byte and 8 MB.';syncUploadRow(upload);return Promise.reject(new Error(upload.error));}
    upload.status='Preparing responsive sizes…';syncUploadRow(upload);
    return imageFromFile(file).then(function(image){if(!image.width||!image.height)throw new Error('This image has no usable dimensions.');return Promise.all([480,960,1600].map(function(width){return canvasBlob(image,width);})).then(function(blobs){image.close();return blobs;},function(error){image.close();throw error;});}).then(function(blobs){
      if(upload.item)return blobs;upload.status='Uploading original…';syncUploadRow(upload);return uploadRaw('/api/media?name='+encodeURIComponent(file.name),file,function(value){upload.progress=Math.round(value*25);syncUploadRow(upload);}).then(function(result){upload.item=result.item;replaceMedia(result.item);return blobs;});
    }).then(function(blobs){var chain=Promise.resolve();blobs.forEach(function(blob,index){chain=chain.then(function(){var width=[480,960,1600][index];upload.status='Uploading '+width+' px version…';syncUploadRow(upload);return uploadRaw('/api/media/'+upload.item.id+'/variant?w='+width,blob,function(value){upload.progress=25+Math.round((index+value)*25);syncUploadRow(upload);}).then(function(result){upload.item=result.item;replaceMedia(result.item);});});});return chain;}).then(function(){upload.progress=100;upload.status='Ready';upload.error='';if(same(upload.target,state.mediaContext)){state.mediaSelected=upload.item.id;state.mediaStep=state.mediaContext?'edit':'choose';refreshMediaPanel();}else syncUploadRow(upload);toast(file.name+' uploaded.');return upload.item;}).catch(function(error){upload.error=error.message||'Upload failed.';upload.status='Upload failed';syncUploadRow(upload);toast(upload.error,'error');throw error;});
  }
  function uploadFiles(files,assignAfter){var selected=Array.prototype.slice.call(files||[]);if(assignAfter&&selected.length>1){toast('Drop one image onto a position. Use Media to upload several images.','error');return;}selected.forEach(function(file){uploadImage(file,assignAfter).catch(function(){});});}
  function assignMedia(item,context){
    context=context||state.mediaContext;if(!context||!item)return;commit(function(draft){if(context.kind==='slot'){draft.images=draft.images||{};draft.images[context.key]={id:item.id,alt:item.alt||'',focal:clone(item.focal||{x:.5,y:.5})};}else if(context.kind==='collection'){var target=collectionItem(context.type,context.id,draft);if(target)target.image={id:item.id,alt:item.alt||'',focal:clone(item.focal||{x:.5,y:.5})};}else if(context.kind==='collection-social'){var social=collectionItem(context.type,context.id,draft);if(social){social.seo=social.seo||{};social.seo.ogImage=item.id;}}else if(context.kind==='page-social'){draft.pages=draft.pages||{};draft.pages[context.key]=draft.pages[context.key]||{};draft.pages[context.key].ogImage=item.id;}else{draft.settings=draft.settings||{};draft.settings.ogImage=item.id;}},'Use image for '+mediaContextLabel(context));toast('Image assigned to '+mediaContextLabel(context)+'.');
  }
  function removeMediaAssignment(){var context=state.mediaContext;if(!context)return;commit(function(draft){if(context.kind==='slot'&&draft.images)delete draft.images[context.key];else if(context.kind==='collection'){var item=collectionItem(context.type,context.id,draft);if(item)delete item.image;}else if(context.kind==='collection-social'){var social=collectionItem(context.type,context.id,draft);if(social&&social.seo)delete social.seo.ogImage;}else if(context.kind==='page-social'&&draft.pages&&draft.pages[context.key])delete draft.pages[context.key].ogImage;else if(context.kind==='site-social'&&draft.settings)delete draft.settings.ogImage;},'Remove image from '+mediaContextLabel());refreshMediaPanel('[data-media-use]');}
  function mediaUses(item){var refs=(item.usedBy||[]).filter(function(ref){return ref.indexOf('draft:')!==0;}),id=item.id,draft=state.draft||{};Object.keys(draft.images||{}).forEach(function(key){if(draft.images[key]&&draft.images[key].id===id)refs.push('draft:'+key);});if(draft.settings&&draft.settings.ogImage===id)refs.push('draft:settings.ogImage');Object.keys(draft.pages||{}).forEach(function(key){if(draft.pages[key]&&draft.pages[key].ogImage===id)refs.push('draft:pages.'+key+'.ogImage');});Object.keys(draft.collections||{}).forEach(function(type){(draft.collections[type]||[]).forEach(function(entry){if(entry.image&&entry.image.id===id)refs.push('draft:collections.'+type+'.'+entry.id+'.image');if(entry.seo&&entry.seo.ogImage===id)refs.push('draft:collections.'+type+'.'+entry.id+'.seo.ogImage');});});return refs.filter(function(ref,index){return refs.indexOf(ref)===index;});}
  function previewFocal(item,x,y,root){var value=x+'% '+y+'%';$$('[data-media-preview]',root).forEach(function(img){img.style.objectPosition=value;});if(state.mediaContext&&state.mediaContext.kind==='slot'){var slot=$('[data-image="'+state.mediaContext.key+'"]');if(slot&&currentMediaValue()===item.id)slot.style.objectPosition=value;}if(state.mediaContext&&state.mediaContext.kind==='collection'){var target=window.OMNI_ITEM&&window.OMNI_ITEM.item.id===state.mediaContext.id?$('[data-item-image]'):$('[data-collection-id="'+state.mediaContext.id+'"] [data-collection-image]');if(target&&currentMediaValue()===item.id)target.style.objectPosition=value;}$('[data-focal-x]',root).value=x;$('[data-focal-y]',root).value=y;var cross=$('.omni-focal__cross',root);if(cross){cross.style.left=x+'%';cross.style.top=y+'%';}}
  function saveMediaDetails(item,root,after){
    if(root.getAttribute('aria-busy')==='true')return;var context=clone(state.mediaContext);root.setAttribute('aria-busy','true');
    var name=$('[data-media-name]',root).value.trim(),alt=$('[data-media-alt]',root).value.trim(),x=Number($('[data-focal-x]',root).value),y=Number($('[data-focal-y]',root).value),button=$('[data-media-save]',root);button.disabled=true;button.textContent='Saving…';
    api('PATCH','/api/media/'+item.id,{name:name,alt:alt,focal:{x:x/100,y:y/100}}).then(function(result){replaceMedia(result.item);if(context&&currentMediaValue(context)===item.id&&(context.kind==='slot'||context.kind==='collection')){commit(function(draft){if(context.kind==='slot'){draft.images[context.key].alt=result.item.alt;draft.images[context.key].focal=clone(result.item.focal);}else{var target=collectionItem(context.type,context.id,draft);target.image.alt=result.item.alt;target.image.focal=clone(result.item.focal);}},'Update image details');}toast('Image details saved.');if(after)after(result.item,context);else if(same(context,state.mediaContext))refreshMediaPanel('[data-media-save]');}).catch(function(error){root.removeAttribute('aria-busy');button.disabled=false;button.textContent='Save details';toast(error.message||'Could not save image details.','error');});
  }
  function deleteMedia(item){
    var uses=(item.usedBy||[]).join(', ');if(uses){toast('Remove this image from '+uses+' before deleting it.','error');return;}
    openDialog({title:'Delete “'+item.name+'”?',message:'This permanently removes the original and every responsive size from the media library. This cannot be undone.',confirm:'Delete image',danger:true,action:function(button,dialog){button.disabled=true;saveDraft().then(function(){return api('DELETE','/api/media/'+item.id);}).then(function(){state.media=state.media.filter(function(value){return value.id!==item.id;});state.mediaSelected=null;dialog.close('deleted');refreshMediaPanel('#omniMediaSearch');toast('Image deleted permanently.');}).catch(function(error){button.disabled=false;toast(error.message||'Could not delete the image.','error');});}});
  }
  function renderUploadQueue(root){
    var list=$('[data-upload-list]',root);list.textContent='';state.uploads.slice(0,6).forEach(function(upload){var row=document.createElement('div');row.className='omni-upload';row.setAttribute('data-upload-id',upload.id);var name=document.createElement('strong');name.textContent=upload.file.name;var meta=document.createElement('span');meta.textContent=formatBytes(upload.file.size);var progress=document.createElement('progress');progress.max=100;progress.value=upload.progress||0;progress.setAttribute('aria-label','Upload progress for '+upload.file.name);var status=document.createElement('small');status.setAttribute('data-upload-status','');var retry=document.createElement('button');retry.type='button';retry.setAttribute('data-upload-retry','');retry.textContent='Retry';retry.hidden=true;retry.addEventListener('click',function(){state.uploads=state.uploads.filter(function(value){return value!==upload;});uploadImage(upload.file,upload.assignAfter,upload.item,upload.target).catch(function(){});});row.append(name,meta,progress,status,retry);list.appendChild(row);syncUploadRow(upload);});
  }
  function renderMediaDetail(root,item){
    var detail=$('[data-media-detail]',root);detail.textContent='';if(!item){detail.innerHTML='<div class="omni-panel-state">Select an image to edit its details.</div>';return;}
    var used=mediaUses(item),focal=item.focal||{x:.5,y:.5};detail.innerHTML='<h3>Selected image</h3><div class="omni-media-detail-preview"><img data-media-preview alt=""></div><div class="omni-field"><label for="omniMediaName">File name</label><input id="omniMediaName" data-media-name type="text" maxlength="120"></div><div class="omni-field"><label for="omniMediaAlt">Image description</label><input id="omniMediaAlt" data-media-alt type="text" maxlength="500" aria-describedby="omniMediaAltHelp"><small id="omniMediaAltHelp">Describe the image’s useful visual information. Required before applying. It helps people using screen readers understand this image.</small></div><fieldset class="omni-focal-field"><legend>Adjust crop</legend><p class="omni-panel__hint">Click the important point, or use the sliders with the keyboard. Crops keep this point visible.</p><button class="omni-focal" type="button" aria-label="Choose focal point on image"><img data-media-preview alt=""><span class="omni-focal__cross" aria-hidden="true"></span></button><label>Horizontal <input type="range" min="0" max="100" step="1" data-focal-x></label><label>Vertical <input type="range" min="0" max="100" step="1" data-focal-y></label></fieldset><p class="omni-media-used"></p><div class="omni-inline-actions"><button type="button" data-media-save>Save details</button><button type="button" data-media-use>Use here</button><button type="button" data-media-remove>Remove from this use</button><button type="button" data-media-delete data-danger>Delete from library</button></div>';
    $$('[data-media-preview]',detail).forEach(function(img){img.src=mediaUrl(item.id,480);img.alt='Preview of '+item.name;});$('[data-media-name]',detail).value=item.name;$('[data-media-alt]',detail).value=item.alt||'';previewFocal(item,Math.round(focal.x*100),Math.round(focal.y*100),detail);var usedText=$('.omni-media-used',detail);usedText.textContent=used.length?'Used by: '+used.join(', '):'Not used on the live site or saved draft.';
    var focalButton=$('.omni-focal',detail),xInput=$('[data-focal-x]',detail),yInput=$('[data-focal-y]',detail);focalButton.addEventListener('click',function(event){var rect=focalButton.getBoundingClientRect(),x=Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*100),y=Math.round(Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))*100);previewFocal(item,x,y,detail);});[xInput,yInput].forEach(function(input){input.addEventListener('input',function(){previewFocal(item,Number(xInput.value),Number(yInput.value),detail);});});
    $('[data-media-save]',detail).addEventListener('click',function(){saveMediaDetails(item,detail);});var use=$('[data-media-use]',detail),remove=$('[data-media-remove]',detail),assigned=currentMediaValue()===item.id;use.hidden=!state.mediaContext;remove.hidden=!assigned;use.textContent='Apply image';use.classList.add('omni-primary-action');use.addEventListener('click',function(){var alt=$('[data-media-alt]',detail).value.trim();if(!alt&&(state.mediaContext.kind==='slot'||state.mediaContext.kind==='collection')){$('[data-media-alt]',detail).setAttribute('aria-invalid','true');toast('Add an image description before applying.','error');$('[data-media-alt]',detail).focus();return;}saveMediaDetails(item,detail,function(saved,context){assignMedia(saved,context);if(same(context,state.mediaContext))closePanel();});});remove.addEventListener('click',removeMediaAssignment);var del=$('[data-media-delete]',detail),mayDelete=state.permissions.deleteMedia===true;del.disabled=used.length>0||!mayDelete;del.title=!mayDelete?'Only an Admin can delete library files.':(used.length?'In use by '+used.join(', '):'');if(!mayDelete)del.setAttribute('aria-describedby','omniMediaDeleteHelp');if(!mayDelete){var deleteHelp=document.createElement('small');deleteHelp.id='omniMediaDeleteHelp';deleteHelp.className='omni-permission-note';deleteHelp.textContent='Editors can upload, assign and update images. Permanent library deletion requires an Admin.';detail.appendChild(deleteHelp);}del.addEventListener('click',function(){if(mayDelete)deleteMedia(item);});
  }
  function renderMediaPanel(root){
    root.innerHTML='<div class="omni-media"><div class="omni-image-flow" data-image-flow></div><p class="omni-panel__hint">Target: <strong data-media-target></strong>. PNG, JPEG or WebP · 8 MB maximum. Images are resized automatically for the website.</p><div class="omni-dropzone" data-media-drop><input id="omniMediaFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><strong>Drop images here</strong><span>or</span><button type="button" class="omni-panel-action" data-media-pick>Choose images</button></div><div class="omni-upload-list" data-upload-list aria-live="polite"></div><div class="omni-field omni-media-search"><label for="omniMediaSearch">Search library</label><div class="omni-search-control"><input id="omniMediaSearch" type="search" autocomplete="off"><button type="button" aria-label="Clear media search">Clear</button></div></div><div class="omni-media-grid" data-media-grid aria-label="Media library"></div><div data-media-detail></div></div>';
    var flow=$('[data-image-flow]',root);if(state.mediaContext){flow.innerHTML='<p>Choose an image, adjust its crop, then apply it to your draft.</p><button type="button" data-image-choose>Choose another image</button>'; $('[data-image-choose]',flow).addEventListener('click',function(){state.mediaStep='choose';renderMediaGrid(root);$('[data-media-pick]',root).focus();});}else flow.innerHTML='<p>Manage your reusable image library. To change a page image, close this panel and select its Change image button.</p>';$('[data-media-target]',root).textContent=mediaContextLabel();var input=$('#omniMediaFiles',root),pick=$('[data-media-pick]',root),drop=$('[data-media-drop]',root),search=$('#omniMediaSearch',root),clear=$('.omni-search-control button',root);search.value=state.mediaSearch;clear.hidden=!state.mediaSearch;pick.addEventListener('click',function(){input.click();});input.addEventListener('change',function(){uploadFiles(input.files,false);input.value='';});['dragenter','dragover'].forEach(function(type){drop.addEventListener(type,function(event){event.preventDefault();drop.classList.add('is-over');});});['dragleave','drop'].forEach(function(type){drop.addEventListener(type,function(event){event.preventDefault();drop.classList.remove('is-over');if(type==='drop')uploadFiles(event.dataTransfer.files,false);});});function filter(){state.mediaSearch=search.value;clear.hidden=!state.mediaSearch;renderMediaGrid(root);}search.addEventListener('input',filter);clear.addEventListener('click',function(){search.value='';filter();search.focus();});renderUploadQueue(root);renderMediaGrid(root);
  }
  function renderMediaGrid(root){
    var editing=!!state.mediaContext&&state.mediaStep==='edit';root.classList.toggle('omni-image-edit',editing);var choose=$('[data-image-choose]',root);if(choose)choose.hidden=!editing;
    var grid=$('[data-media-grid]',root);if(!grid)return;grid.textContent='';if(!state.media){grid.innerHTML='<div class="omni-panel-state">Loading media…</div>';return;}var query=state.mediaSearch.trim().toLowerCase(),items=state.media.filter(function(item){return!query||item.name.toLowerCase().indexOf(query)>=0;});if(!items.length){grid.innerHTML='<div class="omni-panel-state">'+(state.media.length?'No images match this search.':'No images yet. Upload the first one above.')+'</div>';renderMediaDetail(root,null);return;}
    items.forEach(function(item){var button=document.createElement('button');button.type='button';button.className='omni-media-card';button.setAttribute('aria-pressed',String(state.mediaSelected===item.id));button.setAttribute('aria-label','Select '+item.name);var img=document.createElement('img');img.src=mediaUrl(item.id,480);img.alt='';img.loading='lazy';var text=document.createElement('span');text.textContent=item.name;var meta=document.createElement('small');meta.textContent=item.width+' × '+item.height+' · '+formatBytes(item.bytes);button.append(img,text,meta);button.addEventListener('click',function(){state.mediaSelected=item.id;state.mediaStep=state.mediaContext?'edit':'choose';renderMediaGrid(root);if(state.mediaContext){var detail=$('[data-media-detail]',root);detail.scrollIntoView({block:'start'});var alt=$('[data-media-alt]',detail);if(alt)alt.focus();}});grid.appendChild(button);});var selected=items.find(function(item){return item.id===state.mediaSelected;});renderMediaDetail(root,selected||null);var detail=$('[data-media-detail]',root);if(state.mediaContext){detail.hidden=!editing;var filename=$('[data-media-name]',detail);if(filename)filename.closest('.omni-field').hidden=true;['[data-media-save]','[data-media-delete]','.omni-media-used'].forEach(function(selector){var control=$(selector,detail);if(control)control.hidden=true;});}if(window.OmniFieldHelp)window.OmniFieldHelp.enhance(detail);
  }
  function refreshMediaPanel(focusSelector){var panel=$('.omni-panel');if(!panel||!panel.hasAttribute('data-media-panel'))return;renderMediaPanel($('.omni-panel__body',panel));if(focusSelector){var target=$(focusSelector,panel);if(target&&!target.hidden&&!target.disabled)target.focus();}}
  function openMedia(context){finishEdit(true);state.mediaContext=context||null;if(context)state.mediaSearch='';state.mediaSelected=currentMediaValue()||null;state.mediaStep=context&&state.mediaSelected?'edit':'choose';var panel=openPanel(context?'Change image':'Image library','left',renderMediaPanel),root=$('.omni-panel__body',panel);panel.setAttribute('data-media-panel','');loadMedia().then(function(){if($('.omni-panel')===panel)renderMediaPanel(root);}).catch(function(error){root.innerHTML='<div class="omni-panel-state">Could not load the media library.<br><button type="button">Try again</button></div>';$('button',root).addEventListener('click',function(){openMedia(context);});toast(error.message||'Could not load the media library.','error');});}
  function decorateImageSlots(){
    $$('[data-image]').forEach(function(img){var shell=img.closest('[data-image-shell]')||img.parentElement,key=img.getAttribute('data-image');if(!shell||shell.getAttribute('data-image-decorated')==='true')return;shell.setAttribute('data-image-decorated','true');var button=document.createElement('button');button.type='button';button.className='omni-image-action';button.setAttribute('aria-label','Change image for '+key);button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openMedia({kind:'slot',key:key});});shell.appendChild(button);['dragenter','dragover'].forEach(function(type){shell.addEventListener(type,function(event){if(!event.dataTransfer||Array.prototype.indexOf.call(event.dataTransfer.types,'Files')<0)return;event.preventDefault();event.stopPropagation();shell.classList.add('omni-image-over');});});['dragleave','drop'].forEach(function(type){shell.addEventListener(type,function(event){if(!event.dataTransfer||Array.prototype.indexOf.call(event.dataTransfer.types,'Files')<0)return;event.preventDefault();event.stopPropagation();shell.classList.remove('omni-image-over');if(type==='drop'&&event.dataTransfer.files.length){openMedia({kind:'slot',key:key});uploadFiles(event.dataTransfer.files,true);}});});});
    $$('[data-image]').forEach(function(img){var shell=img.closest('[data-image-shell]')||img.parentElement,button=$('.omni-image-action',shell),key=img.getAttribute('data-image'),filled=!!((state.draft.images||{})[key]||{}).id;if(button){
      /* a wide pill over a small slot (client logos, portraits) hides what it
         labels — those get a compact badge that expands on hover instead */
      var compact=shell.offsetWidth&&shell.offsetWidth<220;
      shell.classList.toggle('omni-image-shell--compact',!!compact);
      button.textContent=filled?'Change image':'Add image';button.setAttribute('title',(filled?'Change':'Add')+' image');button.setAttribute('aria-label',(filled?'Change':'Add')+' image for '+key);}});
    $$('[data-item-image]').forEach(function(img){var shell=img.closest('[data-image-shell]')||img.parentElement,context=window.OMNI_ITEM;if(!shell||!context)return;var existing=$('.omni-image-action',shell),filled=currentCollectionItem()&&currentCollectionItem().image;if(existing){existing.textContent=filled?'Change image':'Add image';existing.setAttribute('aria-label',(filled?'Change':'Add')+' item image');return;}shell.setAttribute('data-item-image-decorated','true');var button=document.createElement('button');button.type='button';button.className='omni-image-action';button.textContent=filled?'Change image':'Add image';button.setAttribute('aria-label',(filled?'Change':'Add')+' item image');button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openMedia({kind:'collection',type:context.type,id:context.item.id});});shell.appendChild(button);});
  }

  function applyDraftSettings(){
    var settings=state.draft.settings||{},map={email:{text:settings.email,href:'mailto:'+settings.email},phone:{text:settings.phone,href:'tel:'+(settings.phoneHref||'')},address:{text:settings.address},addressLine1:{text:settings.addressLine1},addressLine2:{text:settings.addressLine2},geoEmail:{text:settings.geoEmail,href:'mailto:'+settings.geoEmail},siteName:{text:settings.siteName}};
    $$('[data-site]').forEach(function(el){var value=map[el.getAttribute('data-site')];if(!value||value.text==null)return;el.textContent=value.text;if(value.href&&el.tagName==='A')el.setAttribute('href',value.href);});
    $$('.mark').forEach(function(mark){if(settings.siteName==='OmniMark')mark.innerHTML='Omni<span>Mark</span>';else mark.textContent=settings.siteName||'OmniMark';});
    var footer=$('.footer-word');if(footer)footer.textContent=settings.siteName||'OmniMark';
  }

  function unreadCount(){return state.inboxMeta?state.inboxMeta.unread:(state.submissions||[]).filter(function(sub){return sub.read!==true;}).length;}
  function updateUnread(){var count=unreadCount();$$('[data-unread]').forEach(function(el){el.textContent=count?'('+count+')':'';});}
  function loadUnread(){api('GET','/api/submissions?limit=1').then(function(data){state.inboxMeta=data;updateUnread();}).catch(function(){});}
  function fmtDate(iso){var date=new Date(iso);return isNaN(date)?String(iso||'—'):date.toLocaleString();}
  function csvCell(value){var text=String(value==null?'':value);if(/^[\s]*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
  function exportSubmissions(event){var button=event&&event.currentTarget;if(button)button.disabled=true;api('GET','/api/submissions?'+inboxQuery()).then(exportSubmissionRows).catch(function(error){toast(error.message,'error');}).finally(function(){if(button)button.disabled=false;});}
  function exportSubmissionRows(submissions){
    var fields={};submissions.forEach(function(sub){Object.keys(sub.fields||{}).forEach(function(key){fields[key]=1;});});var keys=Object.keys(fields),head=['id','form','at','lang','page','read'].concat(keys),rows=[head.map(csvCell).join(',')];
    submissions.forEach(function(sub){rows.push([sub.id,sub.form,sub.at,sub.lang,sub.page,sub.read===true].concat(keys.map(function(key){return(sub.fields||{})[key]||'';})).map(csvCell).join(','));});
    var url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='omnimark-submissions-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function renderInbox(root){
    root.textContent='';renderInboxFilters(root);var toolbar=document.createElement('div');toolbar.className='omni-panel-toolbar';var status=document.createElement('p');status.textContent=((state.inboxMeta&&state.inboxMeta.total)||0)+' enquiries · '+unreadCount()+' unread overall';var exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent=state.inboxSearch||state.inboxForm?'Export matching CSV':'Export all CSV';exportButton.disabled=!(state.submissions||[]).length;exportButton.addEventListener('click',exportSubmissions);toolbar.append(status,exportButton);root.appendChild(toolbar);
    if(!state.submissions||!state.submissions.length){var empty=document.createElement('div');empty.className='omni-panel-state';empty.textContent=state.inboxSearch||state.inboxForm?'No enquiries match. Clear the search or choose All forms.':'No enquiries yet. New enquiries will appear here.';root.appendChild(empty);return;}
    var list=document.createElement('div');list.className='omni-lead-list';state.submissions.forEach(function(sub){
      var card=document.createElement('article');card.className='omni-lead'+(sub.read===true?'':' is-unread');card.setAttribute('data-submission-id',sub.id);var summary=document.createElement('button');summary.type='button';summary.className='omni-lead__summary';summary.setAttribute('aria-expanded','false');var who=(sub.fields&&sub.fields.name)||(sub.fields&&sub.fields.email)||'Anonymous';var label=document.createElement('span');label.textContent=who;var small=document.createElement('small');small.textContent=sub.form+' · '+((sub.fields&&sub.fields.company)||sub.lang||'');label.appendChild(small);var time=document.createElement('time');time.dateTime=sub.at;time.textContent=fmtDate(sub.at);summary.append(label,time);
      var detail=document.createElement('div');detail.className='omni-lead__detail';detail.hidden=true;var dl=document.createElement('dl');Object.keys(sub.fields||{}).forEach(function(key){var dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=sub.fields[key];dl.append(dt,dd);});detail.appendChild(dl);var delivery=document.createElement('p');delivery.className='omni-panel__hint';delivery.textContent=({accepted:'Notification email accepted for delivery',pending:'Sending notification email',retrying:'Retrying notification email',failed:'Notification email failed — check delivery setup',unconfirmed:'Notification email delivery unconfirmed','not-configured':'Notification email is not connected'})[(sub.delivery||{}).email]||'Notification status not recorded';detail.appendChild(delivery);var actions=document.createElement('div');actions.className='omni-inline-actions';var email=sub.fields&&sub.fields.email;if(email){var reply=document.createElement('a');reply.href='mailto:'+email+'?subject='+encodeURIComponent('Re: your '+sub.form+' enquiry');reply.textContent='Reply';actions.appendChild(reply);}var readButton=document.createElement('button');readButton.type='button';readButton.textContent=sub.read===true?'Mark unread':'Mark read';readButton.addEventListener('click',function(){api('PATCH','/api/submissions/'+sub.id,{read:sub.read!==true}).then(function(result){sub.read=result.submission.read;refreshInbox(root);toast(sub.read?'Marked read.':'Marked unread.');}).catch(function(error){toast(error.message||'Could not update the submission.','error');});});var deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.setAttribute('data-danger','');deleteButton.textContent='Delete';deleteButton.addEventListener('click',function(){openDialog({title:'Delete this submission?',message:'This removes the stored lead permanently. Export it first if you need a record.',confirm:'Delete',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/submissions/'+sub.id).then(function(){dialog.close('deleted');state.submissions=state.submissions.filter(function(item){return item.id!==sub.id;});refreshInbox(root);toast('Enquiry deleted.');}).catch(function(error){button.disabled=false;toast(error.message||'Could not delete the submission.','error');});}});});actions.append(readButton,deleteButton);detail.appendChild(actions);summary.addEventListener('click',function(){var open=detail.hidden;detail.hidden=!open;summary.setAttribute('aria-expanded',String(open));});card.append(summary,detail);list.appendChild(card);
    });root.appendChild(list);
  }
  function inboxQuery(){return 'q='+encodeURIComponent(state.inboxSearch||'')+'&form='+encodeURIComponent(state.inboxForm||'')+'&unread='+(state.inboxUnread?'1':'0');}
  function renderInboxFilters(root){
    var filters=document.createElement('div');filters.className='omni-inbox-filters';filters.innerHTML='<input type="search" id="omniInboxSearch" aria-label="Search enquiries" placeholder="Search name, email or company"><button type="button" data-inbox-clear aria-label="Clear enquiry search">Clear</button><select id="omniInboxForm" aria-label="Enquiry type"><option value="">All forms</option><option value="contact">Contact</option><option value="teardown">Teardown</option><option value="newsletter">Newsletter</option></select><button type="button" data-inbox-refresh>Refresh</button>';root.appendChild(filters);var search=$('#omniInboxSearch',filters);search.value=state.inboxSearch||'';$('#omniInboxForm',filters).value=state.inboxForm||'';$('[data-inbox-clear]',filters).hidden=!search.value;
    var timer;function searchNow(){clearTimeout(timer);state.inboxRequest=(state.inboxRequest||0)+1;state.inboxSearch=search.value.trim();state.inboxPage=1;timer=setTimeout(function(){if(root.isConnected)refreshInbox(root,'omniInboxSearch');},300);}search.addEventListener('input',function(e){if(!e.isComposing)searchNow();});search.addEventListener('compositionend',searchNow);
    $('[data-inbox-clear]',filters).addEventListener('click',function(){clearTimeout(timer);state.inboxSearch='';state.inboxPage=1;refreshInbox(root,'omniInboxSearch');});$('#omniInboxForm',filters).addEventListener('change',function(){state.inboxForm=this.value;state.inboxPage=1;refreshInbox(root,'omniInboxForm');});$('[data-inbox-refresh]',filters).addEventListener('click',function(){refreshInbox(root,'omniInboxSearch');});
    var pager=document.createElement('div');pager.className='omni-inbox-pages';var meta=state.inboxMeta||{page:1,pages:1};pager.innerHTML='<button type="button" data-inbox-prev>Previous</button><span>Page '+meta.page+' of '+meta.pages+'</span><button type="button" data-inbox-next>Next</button>';root.appendChild(pager);$('[data-inbox-prev]',pager).disabled=meta.page<=1;$('[data-inbox-next]',pager).disabled=meta.page>=meta.pages;$('[data-inbox-prev]',pager).addEventListener('click',function(){state.inboxPage=meta.page-1;refreshInbox(root);});$('[data-inbox-next]',pager).addEventListener('click',function(){state.inboxPage=meta.page+1;refreshInbox(root);});
  }
  function refreshInbox(root,focus){var seq=state.inboxRequest=(state.inboxRequest||0)+1;return api('GET','/api/submissions?limit=20&page='+(state.inboxPage||1)+'&'+inboxQuery()).then(function(data){if(seq!==state.inboxRequest||!root.isConnected)return;state.submissions=data.items;state.inboxMeta=data;state.inboxPage=data.page;updateUnread();renderInbox(root);if(focus&&$('#'+focus,root))$('#'+focus,root).focus();else $('#omniInboxSearch',root).focus();}).catch(function(error){if(seq!==state.inboxRequest||!root.isConnected)return;root.innerHTML='<div class="omni-panel-state">Could not load enquiries.<br><button type="button">Try again</button></div>';$('button',root).addEventListener('click',function(){refreshInbox(root);});toast(error.message||'Could not load enquiries.','error');});}
  function openInbox(){finishEdit(true);var panel=openPanel('Inbox','right',function(root){root.innerHTML='<div class="omni-panel-state">Loading enquiries…</div>';});refreshInbox($('.omni-panel__body',panel));}

  function settingField(root,options){
    var wrap=document.createElement('div');wrap.className='omni-field';var id='omni-setting-'+options.path.replace(/[^a-z0-9]/gi,'-'),label=document.createElement('label');label.htmlFor=id;label.textContent=options.label;var input=options.type==='textarea'?document.createElement('textarea'):options.type==='select'?document.createElement('select'):document.createElement('input');input.id=id;
    if(options.type==='select'){options.options.forEach(function(option){var el=document.createElement('option');el.value=option[0];el.textContent=option[1];input.appendChild(el);});}else if(options.type!=='textarea')input.type=options.type||'text';
    if(options.min)input.min=options.min;if(options.max)input.max=options.max;input.value=getPath(state.draft,options.path)==null?'':getPath(state.draft,options.path);input.addEventListener('change',function(){var value=input.type==='number'?Number(input.value):input.value;if(input.value&&!input.checkValidity()){input.setAttribute('aria-invalid','true');error.textContent='Enter a valid '+options.label.toLowerCase()+'.';error.hidden=false;return;}input.removeAttribute('aria-invalid');error.hidden=true;commit(function(draft){setPath(draft,options.path,value);if(options.path==='settings.phone')draft.settings.phoneHref=String(value).replace(/[^+0-9]/g,'');if(options.path==='settings.email')draft.settings.geoEmail=value;if(options.path==='settings.addressLine1'||options.path==='settings.addressLine2')draft.settings.address=[draft.settings.addressLine1,draft.settings.addressLine2].filter(Boolean).join(', ');},'Update '+options.label);});var error=document.createElement('p');error.id=id+'-error';error.className='omni-form-message';error.setAttribute('role','status');error.hidden=true;input.setAttribute('aria-describedby',error.id);wrap.appendChild(error);wrap.append(label,input);if(options.help){var small=document.createElement('small');small.textContent=options.help;wrap.appendChild(small);}root.appendChild(wrap);return input;
  }
  function formMessage(form,message,kind){var node=$('.omni-form-message',form);if(!node)return;node.textContent=message||'';node.hidden=!message;node.setAttribute('data-kind',kind||'');}
  function passwordControl(form,id,label,autocomplete){
    var field=document.createElement('div');field.className='omni-field';field.innerHTML='<label for="'+id+'">'+label+'</label><div class="omni-password"><input id="'+id+'" type="password" autocomplete="'+autocomplete+'" maxlength="200" required><button type="button" aria-pressed="false" aria-label="Show '+label.toLowerCase()+'">Show</button></div>';var input=$('input',field),toggle=$('button',field);toggle.addEventListener('click',function(){var show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',(show?'Hide ':'Show ')+label.toLowerCase());input.focus();});form.appendChild(field);return input;
  }
  function renderAccountSettings(root){
    var recovery=document.createElement('form');recovery.className='omni-account-form';recovery.noValidate=true;recovery.innerHTML='<p class="omni-panel__hint">Use a recovery email so you can reset your password if you forget it.</p>';var recoveryCurrent=passwordControl(recovery,'omniRecoveryCurrent','Current password','current-password');var emailWrap=document.createElement('div');emailWrap.className='omni-field';emailWrap.innerHTML='<label for="omniRecoveryEmail">Recovery email</label><input id="omniRecoveryEmail" type="email" autocomplete="email" aria-describedby="omniRecoveryMessage"><small data-recovery-hint>Loading account status…</small>';recovery.appendChild(emailWrap);var recoveryMessage=document.createElement('p');recoveryMessage.id='omniRecoveryMessage';recoveryMessage.className='omni-form-message';recoveryMessage.setAttribute('role','status');recoveryMessage.hidden=true;recoveryCurrent.setAttribute('aria-describedby',recoveryMessage.id);var recoverySave=document.createElement('button');recoverySave.type='submit';recoverySave.className='omni-panel-action';recoverySave.textContent='Save recovery email';recovery.append(recoveryMessage,recoverySave);root.appendChild(recovery);
    api('GET','/api/account/recovery-email').then(function(info){$('#omniRecoveryEmail',recovery).value=info.email||'';$('[data-recovery-hint]',recovery).textContent=info.resendConfigured?'Password recovery is available for your saved email.':'Email delivery needs to be connected by your website administrator before reset links can be sent.';}).catch(function(error){formMessage(recovery,error.message||'Could not load recovery settings.','error');});
    recovery.addEventListener('submit',function(e){e.preventDefault();formMessage(recovery,'');recoveryCurrent.removeAttribute('aria-invalid');var email=$('#omniRecoveryEmail',recovery),value=email.value.trim();if(value&&!email.checkValidity()){email.setAttribute('aria-invalid','true');formMessage(recovery,'Enter a valid recovery email.','error');email.focus();return;}email.removeAttribute('aria-invalid');recoverySave.disabled=true;recoverySave.textContent='Saving…';api('POST','/api/account/recovery-email',{current:recoveryCurrent.value,email:value}).then(function(){recoveryCurrent.value='';formMessage(recovery,value?'Recovery email saved.':'Password recovery disabled.','success');}).catch(function(error){recoveryCurrent.setAttribute('aria-invalid','true');formMessage(recovery,error.message||'Could not save the recovery email.','error');recoveryCurrent.focus();}).finally(function(){recoverySave.disabled=false;recoverySave.textContent='Save recovery email';});});

    var password=document.createElement('form');password.className='omni-account-form';password.noValidate=true;var current=passwordControl(password,'omniPasswordCurrent','Current password','current-password'),next=passwordControl(password,'omniPasswordNext','New password (8+ characters)','new-password'),repeat=passwordControl(password,'omniPasswordRepeat','Repeat new password','new-password');var passwordMessage=document.createElement('p');passwordMessage.id='omniPasswordMessage';passwordMessage.className='omni-form-message';passwordMessage.setAttribute('role','status');passwordMessage.hidden=true;[current,next,repeat].forEach(function(input){input.setAttribute('aria-describedby',passwordMessage.id);});var save=document.createElement('button');save.type='submit';save.className='omni-panel-action';save.textContent='Change password';password.append(passwordMessage,save);root.appendChild(password);
    password.addEventListener('submit',function(e){e.preventDefault();formMessage(password,'');[current,next,repeat].forEach(function(input){input.removeAttribute('aria-invalid');});if(next.value.length<8){next.setAttribute('aria-invalid','true');formMessage(password,'Use at least 8 characters.','error');next.focus();return;}if(next.value!==repeat.value){repeat.setAttribute('aria-invalid','true');formMessage(password,'The new passwords do not match.','error');repeat.focus();return;}save.disabled=true;save.textContent='Saving…';api('POST','/api/password',{current:current.value,next:next.value}).then(function(){password.reset();formMessage(password,'Password changed. Other editor sessions have been signed out.','success');}).catch(function(error){current.setAttribute('aria-invalid','true');formMessage(password,error.message||'Could not change the password.','error');current.focus();}).finally(function(){save.disabled=false;save.textContent='Change password';});});
  }
  function renderNotificationSettings(root){
    var wrap=document.createElement('div');wrap.className='omni-notification-settings';wrap.innerHTML='<p class="omni-panel__hint">Choose who receives an email when someone contacts you. These addresses are private. Saving takes effect immediately.</p><div class="omni-field"><label for="omniNotifyEmail">Add recipient</label><div class="omni-add-row"><input id="omniNotifyEmail" type="email" autocomplete="email" placeholder="name@company.com" aria-describedby="omniNotifyMessage"><button type="button" data-add-recipient>Add</button></div></div><div class="omni-chips" aria-label="Lead notification recipients"></div><p class="omni-source" data-notify-source>Loading notification settings…</p><p class="omni-form-message" id="omniNotifyMessage" role="status" hidden></p><div class="omni-inline-actions"><button type="button" data-save-recipients>Save recipients</button><button type="button" data-test-notify>Send a test email</button></div><p class="omni-panel__hint" data-webhook-status></p>';root.appendChild(wrap);
    var input=$('#omniNotifyEmail',wrap),chips=$('.omni-chips',wrap),emails=[];
    function renderChips(){chips.textContent='';if(!emails.length){var empty=document.createElement('span');empty.className='omni-chip-empty';empty.textContent='No custom recipients. The website’s default recipients will be used, if configured.';chips.appendChild(empty);return;}emails.forEach(function(email){var chip=document.createElement('span');chip.className='omni-chip';chip.textContent=email;var remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+email);remove.addEventListener('click',function(){emails=emails.filter(function(item){return item!==email;});renderChips();});chip.appendChild(remove);chips.appendChild(chip);});}
    function addEmail(){var value=input.value.trim().toLowerCase();formMessage(wrap,'');if(!value||!input.checkValidity()){input.setAttribute('aria-invalid','true');formMessage(wrap,'Enter a valid email address.','error');input.focus();return;}if(emails.indexOf(value)<0)emails.push(value);if(emails.length>10){emails.pop();formMessage(wrap,'You can save up to 10 recipients.','error');return;}input.removeAttribute('aria-invalid');input.value='';renderChips();}
    $('[data-add-recipient]',wrap).addEventListener('click',addEmail);input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addEmail();}});
    function updateNotificationMeta(info){var ready=info.resendConfigured&&info.source!=='none';$('[data-notify-source]',wrap).textContent=ready?'Email notifications are connected.':'Email notifications need setup. Ask your website administrator to connect delivery.';$('[data-webhook-status]',wrap).textContent=info.webhookConfigured?'Enquiries are also forwarded to your connected service.':'';}
    api('GET','/api/account/notifications').then(function(info){emails=(info.emails||[]).slice();renderChips();updateNotificationMeta(info);}).catch(function(error){formMessage(wrap,error.message||'Could not load recipients.','error');renderChips();});
    $('[data-save-recipients]',wrap).addEventListener('click',function(){var button=this;button.disabled=true;api('PUT','/api/account/notifications',{emails:emails}).then(function(info){emails=(info.emails||[]).slice();renderChips();updateNotificationMeta(info);formMessage(wrap,'Notification recipients saved.','success');}).catch(function(error){formMessage(wrap,error.message||'Could not save recipients.','error');}).finally(function(){button.disabled=false;});});
    $('[data-test-notify]',wrap).addEventListener('click',function(){var button=this;button.disabled=true;button.textContent='Sending…';formMessage(wrap,'');api('POST','/api/notify/test',{}).then(function(result){var message='Test email accepted for delivery to '+result.recipients.join(', ')+'.';formMessage(wrap,message,'success');toast(message);}).catch(function(error){var message=error.message||'The test email could not be delivered.';formMessage(wrap,message,'error');toast(message,'error');}).finally(function(){button.disabled=false;button.textContent='Send a test email';});});
  }
  function settingsBack(root){var b=document.createElement('button');b.type='button';b.className='omni-panel-action';b.textContent='← Settings';b.addEventListener('click',openSettings);root.appendChild(b);}
  function renderWebsiteDetails(root){
    settingsBack(root);var hint=document.createElement('p');hint.className='omni-panel__hint';hint.textContent='These details appear on your website. Changes stay private until you publish.';root.appendChild(hint);
    var form=document.createElement('div');form.className='omni-settings';root.appendChild(form);
    [['settings.siteName','Website name'],['settings.email','Contact email','email'],['settings.phone','Phone','tel'],['settings.addressLine1','Street address'],['settings.addressLine2','City and country'],['settings.linkedin','LinkedIn page','url']].forEach(function(f){settingField(form,{path:f[0],label:f[1],type:f[2]});});
    settingField(form,{path:'settings.defaultLang',label:'Website language',type:'select',options:[['en','English'],['az','Azərbaycanca']]});
    var links=document.createElement('details');links.className='omni-settings-links';links.innerHTML='<summary>Website links</summary><p class="omni-panel__hint">Privacy policy, terms and appointment booking.</p>';form.appendChild(links);
    [['settings.privacyUrl','Privacy policy'],['settings.termsUrl','Terms'],['settings.schedulerUrl','Appointment booking']].forEach(function(f){settingField(links,{path:f[0],label:f[1],type:'url'});});
  }
  function renderSettings(root){
    root.innerHTML='<p class="omni-panel__hint">Choose what you want to update.</p><div class="omni-settings-menu"><button type="button" data-settings-view="website"><strong>Website details</strong><span>Name, contact information, language and links</span></button><button type="button" data-settings-view="notifications"><strong>Enquiry emails</strong><span>Who receives new enquiries</span></button><button type="button" data-settings-view="account"><strong>Account</strong><span>Your password, recovery email and sign out</span></button></div>';
    root.addEventListener('click',function(e){var button=e.target.closest('[data-settings-view]');if(!button)return;var view=button.getAttribute('data-settings-view');if(view==='website')openPanel('Website details','right',renderWebsiteDetails);if(view==='notifications')openPanel('Enquiry emails','right',function(body){settingsBack(body);renderNotificationSettings(body);});if(view==='account')openAccount();});
  }
  function openSettings(){if(!state.permissions.manageSettings){toast('Settings require the Admin role.','error');return;}finishEdit(true);openPanel('Settings','right',renderSettings);}
  function downloadDraft(){var url=URL.createObjectURL(new Blob([JSON.stringify(state.draft,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='my-unpublished-edits.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function signOut(){
    finishEdit(true);var leave=function(button){if(button)button.disabled=true;saveDraft(true).then(function(){return api('POST','/api/logout');}).then(function(){clearLocal();state.allowNavigate=true;location.href='/admin.html';}).catch(function(error){if(button)button.disabled=false;toast(error.message||'Could not sign out. Your edits are still here.','error');});};
    if(totalChanges())openDialog({title:'Save your draft and sign out?',message:'Your changes will stay private. They will not be published.',confirm:'Save and sign out',action:function(button){leave(button);}});else leave();
  }
  function openAccount(){finishEdit(true);openPanel('Account','right',function(root){var who=document.createElement('p');who.className='omni-panel__hint';who.textContent=((state.user&&state.user.name)||'Signed in')+' · '+((state.user&&state.user.role)||'');root.appendChild(who);if(state.permissions.manageAccount){renderAccountSettings(root);var maintenance=document.createElement('details');maintenance.className='omni-settings-links';maintenance.innerHTML='<summary>Website maintenance</summary><p class="omni-panel__hint">Use the on-page editor for normal changes. The maintenance dashboard contains configuration export and bulk catalogue tools.</p><a href="/admin-advanced.html" class="omni-panel-action">Open maintenance dashboard</a>';root.appendChild(maintenance);}var actions=document.createElement('div');actions.className='omni-account-actions';actions.innerHTML='<a class="omni-panel-action" href="/index.html" target="_blank" rel="noopener">View live website ↗</a><button type="button" class="omni-panel-action" data-account-logout>Sign out</button>';root.appendChild(actions);$('[data-account-logout]',actions).addEventListener('click',signOut);});}

  function renderPagePanel(root){
    var key=pageKey(),page=(state.draft.pages&&state.draft.pages[key])||{},fallback={title:'',description:''};
    root.innerHTML='<div class="omni-seo"><p class="omni-panel__hint">These settings affect only this page. Empty fields keep the title and description authored in the page template.</p><div class="omni-field"><div class="omni-label-row"><label for="omniSeoTitle">Browser / search title</label><span data-title-count>0 / 60</span></div><input id="omniSeoTitle" type="text"></div><div class="omni-field"><div class="omni-label-row"><label for="omniSeoDescription">Meta description</label><span data-description-count>0 / 160</span></div><textarea id="omniSeoDescription"></textarea></div><div class="omni-field"><label for="omniSeoImage">Social image URL or media ID</label><input id="omniSeoImage" type="text" inputmode="url" placeholder="https://example.com/share-image.jpg" aria-describedby="omniSeoImageHelp omniSeoMessage"><small id="omniSeoImageHelp">Recommended: 1200 × 630 px. Paste an HTTPS URL or choose from the media library.</small><button type="button" class="omni-panel-action" data-seo-media>Choose from media</button></div><label class="omni-switch"><input type="checkbox" id="omniSeoNoindex"><span><strong>Hide from search engines</strong><small>This adds noindex,nofollow and removes the page from the sitemap after Publish.</small></span></label><p class="omni-form-message" id="omniSeoMessage" role="status" hidden></p><h3>Google preview</h3><div class="omni-google-preview"><span data-google-domain></span><strong data-google-title></strong><p data-google-description></p></div><h3>LinkedIn / WhatsApp preview</h3><div class="omni-share-preview"><div class="omni-share-preview__image"><img alt="" data-share-image><span data-share-empty>No social image</span></div><div><span data-share-domain></span><strong data-share-title></strong><p data-share-description></p></div></div></div>';
    var title=$('#omniSeoTitle',root),description=$('#omniSeoDescription',root),image=$('#omniSeoImage',root),noindex=$('#omniSeoNoindex',root),previewImage=$('[data-share-image]',root),shareEmpty=$('[data-share-empty]',root);
    previewImage.addEventListener('load',function(){previewImage.hidden=false;shareEmpty.hidden=true;});previewImage.addEventListener('error',function(){previewImage.hidden=true;shareEmpty.hidden=false;shareEmpty.textContent='Image preview unavailable';});
    title.value=page.title||'';description.value=page.description||'';image.value=page.ogImage||'';noindex.checked=page.noindex===true;
    function displayTitle(){return title.value.trim()||fallback.title||PAGE_LABELS[key]||'Untitled page';}
    function displayDescription(){return description.value.trim()||fallback.description||'Add a concise description for search and social previews.';}
    function preview(){
      var titleText=displayTitle(),descriptionText=displayDescription(),siteUrl=(state.draft.settings&&state.draft.settings.siteUrl)||location.origin,domain;try{domain=new URL(siteUrl).hostname;}catch(e){domain=location.hostname;}
      var titleCount=$('[data-title-count]',root),descriptionCount=$('[data-description-count]',root);titleCount.textContent=title.value.length+' / 60';titleCount.setAttribute('data-over',String(title.value.length>60));descriptionCount.textContent=description.value.length+' / 160';descriptionCount.setAttribute('data-over',String(description.value.length>160));
      $('[data-google-domain]',root).textContent=domain;$('[data-google-title]',root).textContent=titleText;$('[data-google-description]',root).textContent=descriptionText;$('[data-share-domain]',root).textContent=domain;$('[data-share-title]',root).textContent=titleText;$('[data-share-description]',root).textContent=descriptionText;
      var src=image.value.trim()||((state.draft.settings&&state.draft.settings.ogImage)||'');if(/^[a-f0-9]{16}$/.test(src))src=mediaUrl(src,1600);if(!src){previewImage.hidden=true;shareEmpty.hidden=false;shareEmpty.textContent='No social image';}
      else{previewImage.hidden=true;shareEmpty.hidden=false;shareEmpty.textContent='Loading image preview…';if(previewImage.src!==src)previewImage.src=src;else if(previewImage.complete){if(previewImage.naturalWidth){previewImage.hidden=false;shareEmpty.hidden=true;}else shareEmpty.textContent='Image preview unavailable';}}
    }
    function write(field,value,label){commit(function(draft){draft.pages=draft.pages||{};draft.pages[key]=draft.pages[key]||{};if(value===''||value===false)delete draft.pages[key][field];else draft.pages[key][field]=value;if(!Object.keys(draft.pages[key]).length)delete draft.pages[key];},label);}
    [title,description,image].forEach(function(input){input.addEventListener('input',preview);});title.addEventListener('change',function(){write('title',title.value.trim(),'Update page title');});description.addEventListener('change',function(){write('description',description.value.trim(),'Update page description');});image.addEventListener('change',function(){var value=image.value.trim();formMessage(root,'');if(value&&!/^https?:\/\//i.test(value)&&!/^[a-f0-9]{16}$/.test(value)){image.setAttribute('aria-invalid','true');formMessage(root,'Use a complete http:// or https:// image URL, or choose an image from the library.','error');image.focus();return;}image.removeAttribute('aria-invalid');write('ogImage',value,'Update page social image');});$('[data-seo-media]',root).addEventListener('click',function(){openMedia({kind:'page-social',key:key});});noindex.addEventListener('change',function(){write('noindex',noindex.checked,'Change search visibility');preview();});
    function applyFallback(info){fallback=info||fallback;title.placeholder=fallback.title||'Template title';description.placeholder=fallback.description||'Template description';preview();}
    if(state.pagesInfo)applyFallback(state.pagesInfo.find(function(item){return item.key===key;}));else api('GET','/api/pages').then(function(items){state.pagesInfo=items;applyFallback(items.find(function(item){return item.key===key;}));}).catch(function(){applyFallback(null);});
    preview();
  }
  function renderItemPagePanel(root){var context=window.OMNI_ITEM,item=currentCollectionItem(),seo=item.seo||{},titleValue=(item.fields.title&&item.fields.title[state.lang])||'',descKey=context.type==='articles'?'dek':'summary',descriptionValue=(item.fields[descKey]&&item.fields[descKey][state.lang])||'';
    root.innerHTML='<div class="omni-seo"><p class="omni-panel__hint">The clean URL and search preview belong to this collection item. Empty SEO fields use the item title and summary.</p><div class="omni-field"><label for="omniItemSlug">URL slug</label><input id="omniItemSlug" type="text" pattern="[a-z0-9-]{2,60}"><small data-slug-url></small></div><div class="omni-field"><div class="omni-label-row"><label for="omniSeoTitle">Search title</label><span data-title-count></span></div><input id="omniSeoTitle" type="text"></div><div class="omni-field"><div class="omni-label-row"><label for="omniSeoDescription">Meta description</label><span data-description-count></span></div><textarea id="omniSeoDescription"></textarea></div><div class="omni-field"><label for="omniSeoImage">Social image URL or media ID</label><input id="omniSeoImage" type="text"><button type="button" class="omni-panel-action" data-seo-media>Choose from media</button></div><label class="omni-switch"><input type="checkbox" id="omniSeoNoindex"><span><strong>Hide from search engines</strong><small>Published items with this setting are omitted from the sitemap.</small></span></label><p class="omni-form-message" role="status" hidden></p><h3>Search and share preview</h3><div class="omni-google-preview"><span data-google-domain></span><strong data-google-title></strong><p data-google-description></p></div></div>';
    var slug=$('#omniItemSlug',root),title=$('#omniSeoTitle',root),description=$('#omniSeoDescription',root),image=$('#omniSeoImage',root),noindex=$('#omniSeoNoindex',root);slug.value=item.slug;title.value=seo.title||'';description.value=seo.description||'';image.value=seo.ogImage||'';noindex.checked=seo.noindex===true;
    function preview(){var siteUrl=(state.draft.settings&&state.draft.settings.siteUrl)||location.origin,domain;try{domain=new URL(siteUrl).hostname;}catch(e){domain=location.hostname;}$('[data-slug-url]',root).textContent=collectionHref(context.type,slug.value).replace('?edit=1','');$('[data-title-count]',root).textContent=title.value.length+' / 60';$('[data-description-count]',root).textContent=description.value.length+' / 160';$('[data-google-domain]',root).textContent=domain;$('[data-google-title]',root).textContent=title.value||titleValue;$('[data-google-description]',root).textContent=description.value||descriptionValue;}
    function write(field,value,label){commit(function(draft){var target=collectionItem(context.type,item.id,draft);target.seo=target.seo||{};if(value===''||value===false)delete target.seo[field];else target.seo[field]=value;if(!Object.keys(target.seo).length)delete target.seo;},label);}
    [slug,title,description,image].forEach(function(input){input.addEventListener('input',preview);});slug.addEventListener('change',function(){var clean=slugify(slug.value);if(!/^[a-z0-9-]{2,60}$/.test(clean)||uniqueSlug(context.type,clean,item.id)!==clean){slug.setAttribute('aria-invalid','true');formMessage(root,'Use a unique slug with at least two letters, numbers or hyphens.','error');slug.focus();return;}slug.removeAttribute('aria-invalid');commit(function(draft){collectionItem(context.type,item.id,draft).slug=clean;},'Change item slug');});title.addEventListener('change',function(){write('title',title.value.trim(),'Change item SEO title');});description.addEventListener('change',function(){write('description',description.value.trim(),'Change item SEO description');});image.addEventListener('change',function(){var value=image.value.trim();if(value&&!/^https?:\/\//i.test(value)&&!/^[a-f0-9]{16}$/.test(value)){image.setAttribute('aria-invalid','true');formMessage(root,'Use an HTTPS image URL or a media ID.','error');return;}image.removeAttribute('aria-invalid');write('ogImage',value,'Change item social image');});noindex.addEventListener('change',function(){write('noindex',noindex.checked,'Change item search visibility');});$('[data-seo-media]',root).addEventListener('click',function(){openMedia({kind:'collection-social',type:context.type,id:item.id});});preview();
  }
  function openThisPage(){finishEdit(true);openPanel('This page','right',function(root){(window.OMNI_ITEM?renderItemPagePanel:renderPagePanel)(root);if(state.permissions.manageSettings&&document.querySelector('[data-proof]')){var label=document.createElement('label');label.className='omni-switch';label.innerHTML='<input type="checkbox" data-proof-setting><span><strong>Show approved client results and team</strong><small>Applies across the website. Enable only after the results, testimonials, logos and profiles are approved for publication.</small></span>';var input=$('input',label);input.checked=!!state.draft.features.showVerifiedProof;input.addEventListener('change',function(){commit(function(d){d.features.showVerifiedProof=input.checked;},'Change approved content visibility');});root.prepend(label);}renderPageSections(root);});}

  function closePanel(){var panel=$('.omni-panel');if(!panel)return;panel.remove();$$('[data-editor-more]').forEach(function(button){button.setAttribute('aria-expanded','false');});if(window.OmniSite&&state.draft)window.OmniSite.applyImages(state.draft);if(state.panelReturnFocus&&state.panelReturnFocus.isConnected)state.panelReturnFocus.focus();state.panelReturnFocus=null;}
  /* ---------- History: the last published versions, restorable into the draft ---------- */
  function openHistory(){ finishEdit(true); openPanel('History','right',renderHistory); }
  function renderHistory(root){
    root.innerHTML='<p class="omni-panel__hint">The last 10 published versions. Restoring one loads it into your draft so you can review it and publish — the live site does not change until you do.</p><div class="omni-history" aria-live="polite">Loading…</div>';
    var list=$('.omni-history',root);
    api('GET','/api/history').then(function(items){
      list.innerHTML='';
      if(!items.length){var empty=document.createElement('p');empty.className='omni-panel-state';empty.textContent='No published versions yet. Every Publish adds one here.';list.appendChild(empty);return;}
      items.forEach(function(item,index){
        var row=document.createElement('div');row.className='omni-history__item';
        var when=document.createElement('strong');var stamp=new Date(item.publishedAt||item.archivedAt);
        when.textContent=(index===0?'Previous live · ':'')+(isNaN(stamp)?item.id:stamp.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}));
        var meta=document.createElement('span');meta.textContent=(item.changes?item.changes+' difference'+(item.changes===1?'':'s')+' from the live site':'Identical to the live site')+(item.by&&item.by.name?' · published by '+item.by.name:'');
        var button=document.createElement('button');button.type='button';button.textContent='Restore';button.disabled=!item.changes;button.setAttribute('aria-label','Restore version from '+when.textContent);
        button.addEventListener('click',function(){
          var pending=totalChanges();
          openDialog({title:'Restore this version?',message:(pending?'It replaces your current draft ('+pending+' unpublished change'+(pending===1?'':'s')+'). ':'')+'The live site stays as it is until you publish.',confirm:'Restore into draft',action:function(confirmBtn,dialog){
            confirmBtn.disabled=true;
            api('POST','/api/history/'+encodeURIComponent(item.id)+'/restore',{draftRevision:state.draftRevision}).then(function(){clearLocal();state.allowNavigate=true;dialog.close('restored');location.reload();})
              .catch(function(error){confirmBtn.disabled=false;toast(error.message||'Could not restore that version.','error');});
          }});
        });
        row.append(when,meta,button);list.appendChild(row);
      });
    }).catch(function(error){list.innerHTML='';var p=document.createElement('p');p.className='omni-panel-state';p.textContent=error.message||'Could not load history.';list.appendChild(p);});
  }
  function copyText(value){
    if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(value);
    return new Promise(function(resolve,reject){var input=document.createElement('textarea');input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();try{document.execCommand('copy')?resolve():reject(new Error('Copy failed'));}catch(error){reject(error);}input.remove();});
  }
  function previewPath(){return location.pathname||'/';}
  function renderPreview(root){
    root.innerHTML='<div class="omni-preview-panel"><p class="omni-panel__hint">Share the current saved draft without giving someone an editor account. The newest link replaces the previous one and expires after seven days.</p><div class="omni-panel-state" data-preview-status>Checking preview status…</div><div class="omni-preview-link" data-preview-link hidden><label for="omniPreviewUrl">Private preview URL</label><textarea id="omniPreviewUrl" readonly></textarea><div class="omni-inline-actions"><button type="button" data-preview-copy>Copy link</button><a data-preview-open target="_blank" rel="noopener noreferrer">Open preview</a></div></div><div class="omni-inline-actions"><button type="button" class="omni-panel-action" data-preview-create>Create preview link</button><button type="button" data-preview-revoke data-danger hidden>Revoke link</button></div><p class="omni-form-message" role="status" hidden></p></div>';
    var status=$('[data-preview-status]',root),linkBox=$('[data-preview-link]',root),urlInput=$('#omniPreviewUrl',root),create=$('[data-preview-create]',root),revoke=$('[data-preview-revoke]',root),copy=$('[data-preview-copy]',root),open=$('[data-preview-open]',root);
    function clearLink(){linkBox.hidden=true;urlInput.value='';copy.disabled=true;open.removeAttribute('href');open.setAttribute('aria-disabled','true');open.tabIndex=-1;}
    clearLink();
    function statusCopy(info){status.textContent=info.active?'A preview link is active until '+fmtDate(info.expiresAt)+(info.createdBy&&info.createdBy.name?' · created by '+info.createdBy.name:'')+'. Create a new link to replace it.':'No preview link is active.';revoke.hidden=!info.active;create.textContent=info.active?'Replace preview link':'Create preview link';}
    function showLink(result){if(!/^https?:\/\//i.test(result.url||'')){clearLink();throw new Error('Could not create a usable preview URL. Try again.');}linkBox.hidden=false;urlInput.value=result.url;open.href=result.url;copy.disabled=false;open.removeAttribute('aria-disabled');open.removeAttribute('tabindex');copy.focus();statusCopy({active:true,expiresAt:result.expiresAt,createdBy:result.createdBy});}
    api('GET','/api/preview-link').then(statusCopy).catch(function(error){status.textContent=error.message||'Could not check preview status.';});
    create.addEventListener('click',function(){create.disabled=true;create.textContent='Saving draft…';formMessage(root,'');saveDraft().then(function(){create.textContent='Creating link…';return api('POST','/api/preview-link',{path:previewPath()});}).then(function(result){showLink(result);formMessage(root,'Preview link created. Anyone with this URL can see the current draft until it expires or is revoked.','success');toast('Preview link created.');}).catch(function(error){formMessage(root,error.message||'Could not create the preview link.','error');toast(error.message||'Could not create the preview link.','error');}).finally(function(){create.disabled=false;if(!urlInput.value)create.textContent='Create preview link';});});
    copy.addEventListener('click',function(){if(copy.disabled||!urlInput.value)return;copyText(urlInput.value).then(function(){toast('Preview link copied.');copy.textContent='Copied';setTimeout(function(){copy.textContent='Copy link';},1600);}).catch(function(){urlInput.focus();urlInput.select();toast('Select and copy the link manually.','error');});});
    revoke.addEventListener('click',function(){openDialog({title:'Revoke this preview link?',message:'Anyone using the current link will immediately lose access. Your saved draft stays unchanged.',confirm:'Revoke link',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/preview-link').then(function(){dialog.close('revoked');clearLink();statusCopy({active:false});formMessage(root,'Preview link revoked.','success');toast('Preview link revoked.');}).catch(function(error){button.disabled=false;toast(error.message||'Could not revoke the link.','error');});}});});
  }
  function openPreview(){finishEdit(true);openPanel('Draft preview','right',renderPreview);}

  function renderUsers(root){
    root.innerHTML='<div class="omni-users"><p class="omni-panel__hint">Admins control accounts and server settings. Editors can change and publish content, use the inbox, and upload media; they cannot manage users, settings, accounts, or permanent media deletion.</p><form class="omni-user-invite" novalidate><h3>Invite someone</h3><div class="omni-field"><label for="omniInviteName">Name</label><input id="omniInviteName" type="text" autocomplete="name" maxlength="100" required></div><div class="omni-field"><label for="omniInviteEmail">Email</label><input id="omniInviteEmail" type="email" inputmode="email" autocomplete="email" maxlength="254" required></div><div class="omni-field"><label for="omniInviteRole">Role</label><select id="omniInviteRole"><option value="editor">Editor</option><option value="admin">Admin</option></select></div><button type="submit" class="omni-panel-action">Send invitation</button><p class="omni-form-message" role="status" hidden></p></form><div class="omni-user-list" aria-live="polite"><div class="omni-panel-state">Loading users…</div></div></div>';
    var form=$('.omni-user-invite',root),list=$('.omni-user-list',root),usersInfo=null;
    function userAction(user,patch,title,message,confirm,danger){openDialog({title:title,message:message,confirm:confirm,danger:!!danger,action:function(button,dialog){button.disabled=true;api('PATCH','/api/users/'+user.id,patch).then(function(){dialog.close('updated');toast('User access updated.');load();}).catch(function(error){button.disabled=false;toast(error.message||'Could not update this user.','error');});}});}
    function renderList(){list.textContent='';(usersInfo.users||[]).forEach(function(user){var card=document.createElement('article');card.className='omni-user-card';var head=document.createElement('div');head.className='omni-user-card__head';var title=document.createElement('strong');title.textContent=user.name;var badges=document.createElement('span');badges.textContent=user.role+' · '+user.status+(user.id===usersInfo.currentUserId?' · you':'');head.append(title,badges);var email=document.createElement('p');email.textContent=user.email||'Email not set';var meta=document.createElement('small');meta.textContent=user.status==='invited'?'Invitation expires '+fmtDate(user.inviteExpiresAt):(user.lastLoginAt?'Last signed in '+fmtDate(user.lastLoginAt):'Has not signed in yet');var actions=document.createElement('div');actions.className='omni-inline-actions';var role=document.createElement('select');role.setAttribute('aria-label','Role for '+user.name);['editor','admin'].forEach(function(value){var option=document.createElement('option');option.value=value;option.textContent=value==='admin'?'Admin':'Editor';role.appendChild(option);});role.value=user.role;role.disabled=user.id===usersInfo.currentUserId;role.addEventListener('change',function(){var next=role.value;role.value=user.role;userAction(user,{role:next},'Change '+user.name+' to '+next+'?','This changes what this person can do and signs out their existing sessions.','Change role',false);});actions.appendChild(role);
        if(user.status==='active'&&user.id!==usersInfo.currentUserId){var disable=document.createElement('button');disable.type='button';disable.setAttribute('data-danger','');disable.textContent='Disable access';disable.addEventListener('click',function(){userAction(user,{status:'disabled'},'Disable '+user.name+'?','They will be signed out and cannot sign in. Their published work and history remain intact.','Disable access',true);});actions.appendChild(disable);}
        if(user.status==='invited'&&user.id!==usersInfo.currentUserId){var cancel=document.createElement('button');cancel.type='button';cancel.setAttribute('data-user-cancel-invite',user.id);cancel.setAttribute('data-danger','');cancel.textContent='Cancel invitation';cancel.addEventListener('click',function(){userAction(user,{status:'disabled'},'Cancel invitation for '+user.name+'?','Their invitation link will stop working immediately. You can send a fresh invitation later.','Cancel invitation',true);});actions.appendChild(cancel);}
        if(user.status==='disabled'&&user.canRestore){var restore=document.createElement('button');restore.type='button';restore.textContent='Restore access';restore.addEventListener('click',function(){userAction(user,{status:'active'},'Restore '+user.name+'?','They will be able to sign in again with their existing password.','Restore access',false);});actions.appendChild(restore);}
        if(user.status!=='active'){var resend=document.createElement('button');resend.type='button';resend.textContent='Resend invitation';resend.disabled=!usersInfo.resendConfigured;resend.title=usersInfo.resendConfigured?'':'Set RESEND_API_KEY on the server first.';resend.addEventListener('click',function(){resend.disabled=true;api('POST','/api/users/'+user.id+'/resend',{}).then(function(){toast('Invitation sent to '+user.email+'.');load();}).catch(function(error){resend.disabled=!usersInfo.resendConfigured;toast(error.message||'Could not send the invitation.','error');});});actions.appendChild(resend);}
        card.append(head,email,meta,actions);list.appendChild(card);});if(!(usersInfo.users||[]).length)list.innerHTML='<div class="omni-panel-state">No users found.</div>';var submit=$('[type="submit"]',form),needsOwnerEmail=!usersInfo.currentUserEmailSet;submit.disabled=needsOwnerEmail||!usersInfo.resendConfigured||usersInfo.users.length>=usersInfo.maxUsers;submit.title=needsOwnerEmail?'Set your email in Settings → Account before inviting someone.':(!usersInfo.resendConfigured?'Set RESEND_API_KEY on the server before inviting someone.':'');if(needsOwnerEmail)formMessage(form,'Set your email in Settings → Account first. This keeps your Admin sign-in accessible after a second user joins.','error');else if(!usersInfo.resendConfigured)formMessage(form,'Email delivery is not configured. Set RESEND_API_KEY before inviting someone.','error');}
    function load(){api('GET','/api/users').then(function(info){usersInfo=info;renderList();}).catch(function(error){list.innerHTML='<div class="omni-panel-state">'+escapeHtml(error.message||'Could not load users.')+'</div>';});}
    form.addEventListener('submit',function(event){event.preventDefault();var name=$('#omniInviteName',form),email=$('#omniInviteEmail',form),role=$('#omniInviteRole',form),button=$('[type="submit"]',form);formMessage(form,'');[name,email].forEach(function(input){input.removeAttribute('aria-invalid');});if(!name.value.trim()){name.setAttribute('aria-invalid','true');formMessage(form,'Enter the person’s name.','error');name.focus();return;}if(!email.value||!email.checkValidity()){email.setAttribute('aria-invalid','true');formMessage(form,'Enter a valid email address.','error');email.focus();return;}button.disabled=true;button.textContent='Sending…';api('POST','/api/users/invite',{name:name.value.trim(),email:email.value.trim(),role:role.value}).then(function(){form.reset();formMessage(form,'Invitation sent. The link expires in 48 hours.','success');toast('Invitation sent.');load();}).catch(function(error){formMessage(form,error.message||'Could not send the invitation.','error');toast(error.message||'Could not send the invitation.','error');}).finally(function(){button.textContent='Send invitation';if(usersInfo)button.disabled=!usersInfo.currentUserEmailSet||!usersInfo.resendConfigured||usersInfo.users.length>=usersInfo.maxUsers;});});load();
  }
  function openUsers(){finishEdit(true);if(!state.permissions.manageUsers)return;openPanel('Users and roles','right',renderUsers);}
  function openPanel(title,side,render){
    closePanel();state.panelReturnFocus=document.activeElement;var panel=document.createElement('aside');panel.id='omniEditorPanel';panel.className='omni-panel omni-panel--'+side;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','omniPanelTitle');panel.innerHTML='<header class="omni-panel__head"><h2 id="omniPanelTitle"></h2><button type="button" class="omni-panel__close" aria-label="Close panel">×</button></header><div class="omni-panel__body"></div>';$('#omniPanelTitle',panel).textContent=title;$('.omni-panel__close',panel).addEventListener('click',closePanel);document.body.appendChild(panel);render($('.omni-panel__body',panel));if(window.OmniFieldHelp)window.OmniFieldHelp.enhance(panel);$('.omni-panel__close',panel).focus();return panel;
  }
  function tokenValue(key,fallback){return(state.draft.design&&state.draft.design.tokens&&state.draft.design.tokens[key])||fallback;}
  function setToken(key,value,label){commit(function(draft){draft.design=draft.design||{};draft.design.tokens=draft.design.tokens||{};if(value)draft.design.tokens[key]=value;else delete draft.design.tokens[key];},label||'Change colour');}
  var DESIGN_CHOICES=[
    {id:'original',name:'Original',description:'The original violet and lime identity.',font:'bricolage-inter',signal:'#C6F24E',accent:'#4634F0'},
    {id:'calm',name:'Calm',description:'Teal highlights with clear, modern type.',font:'sora-dmsans',signal:'#12D6C4',accent:'#4634F0'},
    {id:'editorial',name:'Editorial',description:'Expressive headings with the original brand colours.',font:'playfair-worksans',signal:'#C6F24E',accent:'#4634F0'}
  ];
  function applyDesignChoice(choice,reset){commit(function(draft){var design=draft.design=draft.design||{},fonts=FONT_PRESETS[choice.font];design.tokens=design.tokens||{};COLOR_TOKENS.forEach(function(t){if(reset)delete design.tokens[t[0]];else design.tokens[t[0]]=t[2];});if(reset){['--violet'].forEach(function(k){delete design.tokens[k];});['fontPreset','fontDisplay','fontBody','fontMono','motion'].forEach(function(k){delete design[k];});MOTION_FLAGS.forEach(function(k){delete draft.features[k];});}else{design.tokens['--signal']=choice.signal;design.tokens['--violet']=choice.accent;design.fontPreset=choice.font;design.fontDisplay=fonts[0];design.fontBody=fonts[1];design.fontMono=fonts[2];}},reset?'Reset design':'Use '+choice.name+' design');}
  function renderDesignPanel(root){root.innerHTML='<p class="omni-panel__hint">Choose a complete style for the website. Content stays in place. Changes stay in your draft until you publish, and Undo restores your previous choice.</p><div class="omni-design-presets"></div><button type="button" class="omni-panel-action" data-design-reset>Reset design</button><p class="omni-panel__hint">Reset restores the original colours, fonts and motion. Your text and images stay in place.</p>';var list=$('.omni-design-presets',root);DESIGN_CHOICES.forEach(function(choice){var button=document.createElement('button');button.type='button';button.className='omni-design-preset';button.setAttribute('data-design-preset',choice.id);button.innerHTML='<span class="omni-preset-colours" aria-hidden="true"><i style="background:'+choice.accent+'"></i><i style="background:'+choice.signal+'"></i><i style="background:#0B0C10"></i></span><strong>'+choice.name+'</strong><span>'+choice.description+'</span>';button.addEventListener('click',function(){applyDesignChoice(choice,false);});list.appendChild(button);});$('[data-design-reset]',root).addEventListener('click',function(){applyDesignChoice(DESIGN_CHOICES[0],true);});syncDesignPanel();}
  function syncDesignPanel(){var panel=$('.omni-panel');if(!panel||$('#omniPanelTitle',panel).textContent!=='Design')return;var design=state.draft.design||{};$$('[data-design-preset]',panel).forEach(function(button){var choice=DESIGN_CHOICES.find(function(c){return c.id===button.getAttribute('data-design-preset');});button.setAttribute('aria-pressed',String((design.fontPreset||'bricolage-inter')===choice.font&&tokenValue('--signal','#C6F24E')===choice.signal));});}
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
    var cancel=$('[data-dialog-cancel]',dialog);cancel.textContent=options.cancel||'Cancel';cancel.addEventListener('click',function(){dialog.close('cancel');});confirm.addEventListener('click',function(){options.action(confirm,dialog);});
    dialog.addEventListener('cancel',function(e){e.preventDefault();dialog.close('cancel');});dialog.addEventListener('close',function(){dialog.remove();if(returnFocus&&returnFocus.isConnected)returnFocus.focus();});trapDialog(dialog);document.body.appendChild(dialog);dialog.showModal();$('[data-dialog-cancel]',dialog).focus();return dialog;
  }
  function missingAltSlots(){var missing=Object.keys((state.draft&&state.draft.images)||{}).filter(function(key){var value=state.draft.images[key];return value&&value.id&&!String(value.alt||'').trim();});Object.keys((state.draft&&state.draft.collections)||{}).forEach(function(type){(state.draft.collections[type]||[]).forEach(function(item){if(item.image&&item.image.id&&!String(item.image.alt||'').trim())missing.push('collections.'+type+'.'+item.id);});});return missing;}
  function publish(){
    finishEdit(true);if(!totalChanges())return;var missing=missingAltSlots();if(missing.length){var list='<p>Every meaningful image needs alt text before it can go live. Add it for:</p><ul>'+missing.map(function(key){return'<li>'+escapeHtml(key)+'</li>';}).join('')+'</ul>';return openDialog({title:'Add missing alt text',html:list,confirm:'Open first image',action:function(button,dialog){dialog.close('media');setTimeout(function(){var parts=missing[0].split('.');openMedia(parts[0]==='collections'?{kind:'collection',type:parts[1],id:parts[2]}:{kind:'slot',key:missing[0]});},0);}});}var counts=summaryCounts(),labels={texts:'Texts',elements:'Elements',sections:'Sections',items:'Items',catalogue:'Catalogue',images:'Images',design:'Design',settings:'Settings'};
    var html='<p>Your draft is private. Preview it, then publish when you are ready. Publishing updates the live website.</p><ul class="omni-summary">'+Object.keys(labels).filter(function(key){return counts[key]>0;}).map(function(key){return'<li>'+labels[key]+' updated</li>';}).join('')+'</ul>';
    var review=openDialog({title:'Review your changes',html:html,confirm:'Publish changes',action:function(button,dialog){doPublish(button,dialog,false);}});var elementSummary=window.OmniElementRules.changes(state.live,state.draft),summaryRow=Array.from(review.querySelectorAll('.omni-summary li')).find(function(li){return li.textContent==='Elements updated';});if(summaryRow)summaryRow.title=elementSummary.added+' additions changed, '+elementSummary.moved+' placements changed, '+elementSummary.links+' links changed, '+elementSummary.styles+' styles changed; removal and restoration included.';var preview=document.createElement('button');preview.type='button';preview.textContent='Preview draft';preview.setAttribute('data-review-preview','');review.querySelector('.omni-dialog__body').appendChild(preview);preview.addEventListener('click',function(){preview.disabled=true;preview.textContent='Preparing preview…';saveDraft().then(function(){return api('POST','/api/preview-link',{path:previewPath()});}).then(function(result){var link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';link.className='omni-panel-action';link.textContent='Open draft preview ↗';preview.replaceWith(link);link.focus();}).catch(function(error){preview.disabled=false;preview.textContent='Preview draft';toast(error.message||'Could not prepare preview.','error');});});
  }
  function doPublish(button,dialog,force){
    button.disabled=true;button.textContent='Publishing…';
    saveDraft().then(function(result){return api('POST','/api/publish',{force:!!force,draftRevision:result.revision});}).then(function(result){
      state.live=clone(result.site);state.draft=clone(result.site);state.baseUpdatedAt=(result.site&&result.site.updatedAt)||null;state.draftRevision=0;state.savedBy=null;state.undo=[];state.redo=[];clearLocal();dialog.close('published');applyDraft();setSaveStatus('Published just now');toast('Published successfully.');
    }).catch(function(error){
      /* the live site moved on since this draft started (e.g. a save from the
         advanced dashboard) — never overwrite that silently */
      if(error.status===409&&error.data&&error.data.code==='stale'){
        dialog.close('cancel');
        openDialog({title:'The live site changed meanwhile',message:'Someone saved changes to the live site after this draft was started — for example from the advanced dashboard. Publishing now replaces those changes with this draft.',confirm:'Publish anyway',danger:true,action:function(b2,d2){doPublish(b2,d2,true);}});
        return;
      }
      button.disabled=false;button.textContent='Publish changes';if(error.status===409&&error.data&&error.data.code==='draft-stale'){dialog.close('conflict');showDraftConflict(error.data);return;}toast(error.message||'Publish failed. Your draft is safe.','error');
    });
  }
  function discard(){
    finishEdit(false);if(!totalChanges())return;openDialog({title:'Discard this draft?',message:'All unpublished edits will be removed. The live site will not change.',confirm:'Discard draft',danger:true,action:function(button,dialog){button.disabled=true;api('DELETE','/api/draft',{draftRevision:state.draftRevision}).then(function(){clearLocal();state.draftRevision=0;state.draft=clone(state.live);state.undo=[];state.redo=[];state.allowNavigate=true;dialog.close('discarded');location.reload();}).catch(function(error){button.disabled=false;if(error.status===409&&error.data&&error.data.code==='draft-stale'){dialog.close('conflict');showDraftConflict(error.data);return;}toast(error.message||'Could not discard the draft.','error');});}});
  }

  function navigatePage(key){var file=key==='index'?'index.html':key+'.html';finishEdit(true);saveDraft(true).then(function(){state.allowNavigate=true;location.href=file+'?edit=1';}).catch(function(error){toast(error.message||'Save your changes before leaving this page.','error');});}
  function setEditorLanguage(lang){finishEdit(true);state.lang=lang;window.OmniI18n.setLang(state.lang);applyDraft();}
  function renderMobileMenu(root){
    var options=PAGE_FILES.map(function(key){return'<option value="'+key+'"'+(key===pageKey()?' selected':'')+'>'+PAGE_LABELS[key]+'</option>';}).join('');
    root.innerHTML='<div class="omni-mobile-menu"><div class="omni-field"><label for="omniMobilePageSelect">Page</label><select id="omniMobilePageSelect">'+options+'</select></div><div class="omni-mobile-menu__language"><span>Language</span><div class="omni-segments" role="group" aria-label="Editing language"><button type="button" data-mobile-lang="en">EN</button><button type="button" data-mobile-lang="az">AZ</button></div></div><div class="omni-mobile-menu__actions"><button type="button" data-mobile-open="design">Design</button><button type="button" data-mobile-open="page">This page</button><button type="button" data-mobile-open="media">Image library</button><button type="button" data-mobile-open="history">History</button><button type="button" data-mobile-open="redo">Redo last change</button><button type="button" data-mobile-open="phone">Phone preview</button><button type="button" data-mobile-open="preview">Preview link</button><button type="button" data-mobile-open="inbox">Inbox <span data-unread></span></button><button type="button" data-mobile-open="settings">Settings</button><button type="button" data-mobile-open="users">Users</button><button type="button" data-mobile-open="account">Account</button><button type="button" data-mobile-open="discard" data-danger>Discard draft</button></div><p class="omni-mobile-menu__status" data-editor-status aria-live="polite">'+escapeHtml(state.savedAt?'Draft restored':'Draft ready')+'</p></div>';
    var phone=$('[data-mobile-open="phone"]',root);if(isMobileEditor()&&phone)phone.remove();$('[data-mobile-open="redo"]',root).disabled=!state.redo.length;if(!state.permissions.manageSettings){var mobileSettings=$('[data-mobile-open="settings"]',root);if(mobileSettings)mobileSettings.remove();}if(!state.permissions.manageUsers){var mobileUsers=$('[data-mobile-open="users"]',root);if(mobileUsers)mobileUsers.remove();}
    $('#omniMobilePageSelect',root).addEventListener('change',function(){navigatePage(this.value);});$$('[data-mobile-lang]',root).forEach(function(button){button.setAttribute('aria-pressed',String(button.getAttribute('data-mobile-lang')===state.lang));button.addEventListener('click',function(){setEditorLanguage(button.getAttribute('data-mobile-lang'));openMobileMenu();});});updateUnread();
    root.addEventListener('click',function(event){var button=event.target.closest('[data-mobile-open]');if(!button)return;var action=button.getAttribute('data-mobile-open');if(action==='redo'){redo();closePanel();}if(action==='phone'){togglePhone();closePanel();}if(action==='design')openPanel('Design','left',renderDesignPanel);if(action==='page')openThisPage();if(action==='media')openMedia(null);if(action==='history')openHistory();if(action==='preview')openPreview();if(action==='inbox')openInbox();if(action==='settings')openSettings();if(action==='users')openUsers();if(action==='account')openAccount();if(action==='discard'){closePanel();discard();}});
  }
  /* shared by the phone bar's "More ⋯" and the desktop bar's fold-away "More ⋯" */
  function openMobileMenu(){finishEdit(true);var panel=openPanel('Editor menu','right',renderMobileMenu);panel.classList.add('omni-panel--mobile-menu');$$('[data-editor-more]').forEach(function(trigger){trigger.setAttribute('aria-expanded','true');});return panel;}

  function buildBar(){
    var bar=document.createElement('div');bar.className='omni-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','On-page editor');
    var options=PAGE_FILES.map(function(key){return'<option value="'+key+'"'+(key===pageKey()?' selected':'')+'>'+PAGE_LABELS[key]+'</option>';}).join('');
    bar.innerHTML='<div class="omni-bar__desktop"><div class="omni-bar__brand"><span class="omni-bar__dot"></span>Edit mode <small>'+escapeHtml((state.user&&state.user.role)||'')+'</small></div><div class="omni-bar__group"><label class="omni-sr" for="omniPageSelect">Page</label><select id="omniPageSelect" aria-label="Page">'+options+'</select></div><div class="omni-bar__group"><button type="button" data-editor-lang="en">EN</button><button type="button" data-editor-lang="az">AZ</button></div><div class="omni-bar__group"><button type="button" data-editor-phone aria-pressed="false" aria-label="Phone preview">Phone</button><button type="button" data-editor-undo aria-label="Undo last change" title="Undo (Ctrl+Z)">↶ Undo</button><button type="button" data-editor-redo aria-label="Redo change" title="Redo (Ctrl+Shift+Z)">Redo ↷</button><button type="button" data-editor-history title="Restore a previously published version">History</button></div><div class="omni-bar__group"><button type="button" data-editor-page aria-label="Edit search and sharing settings for this page">This page</button><button type="button" data-editor-media>Image library</button><button type="button" data-editor-design>Design</button><button type="button" data-editor-preview>Preview</button><button type="button" data-editor-inbox>Inbox <span data-unread></span></button><button type="button" data-editor-settings>Settings</button><button type="button" data-editor-users>Users</button><button type="button" class="omni-bar__more" data-editor-more aria-expanded="false" aria-controls="omniEditorPanel" title="More editor controls">More ⋯</button></div><span class="omni-bar__spacer"></span><span class="omni-bar__status" data-editor-status aria-live="polite">Draft ready</span><div class="omni-bar__group"><button type="button" data-editor-discard>Discard</button><button type="button" class="omni-bar__publish" data-editor-publish>Publish (0)</button></div></div><div class="omni-bar__mobile"><button type="button" data-editor-mobile-undo aria-label="Undo last change">↶ Undo</button><button type="button" class="omni-bar__publish" data-editor-mobile-publish>Publish (0)</button><button type="button" data-editor-more aria-expanded="false" aria-controls="omniEditorPanel">More ⋯</button></div>';
    if(!state.permissions.manageSettings){var settingsButton=$('[data-editor-settings]',bar);if(settingsButton)settingsButton.remove();}if(!state.permissions.manageUsers){var usersButton=$('[data-editor-users]',bar);if(usersButton)usersButton.remove();}
    document.body.prepend(bar);var toastEl=document.createElement('div');toastEl.className='omni-toast';toastEl.setAttribute('role','status');toastEl.setAttribute('aria-live','polite');document.body.appendChild(toastEl);
    $('#omniPageSelect').addEventListener('change',function(){navigatePage(this.value);});
    $$('[data-editor-lang]').forEach(function(button){button.addEventListener('click',function(){setEditorLanguage(button.getAttribute('data-editor-lang'));});});
    $('[data-editor-undo]').addEventListener('click',undo);$('[data-editor-redo]').addEventListener('click',redo);$('[data-editor-publish]').addEventListener('click',publish);$('[data-editor-discard]').addEventListener('click',discard);
    $('[data-editor-page]').addEventListener('click',openThisPage);$('[data-editor-media]').addEventListener('click',function(){openMedia(null);});$('[data-editor-design]').addEventListener('click',function(){openPanel('Design','left',renderDesignPanel);});$('[data-editor-preview]').addEventListener('click',openPreview);$('[data-editor-inbox]').addEventListener('click',openInbox);var settingsControl=$('[data-editor-settings]');if(settingsControl)settingsControl.addEventListener('click',openSettings);var usersControl=$('[data-editor-users]');if(usersControl)usersControl.addEventListener('click',openUsers);$('[data-editor-history]').addEventListener('click',openHistory);$('[data-editor-phone]').addEventListener('click',togglePhone);
    $('[data-editor-mobile-undo]').addEventListener('click',undo);$('[data-editor-mobile-publish]').addEventListener('click',publish);$$('[data-editor-more]').forEach(function(button){button.addEventListener('click',openMobileMenu);});
  }
  function rewriteLinks(){
    $$('a[href]').forEach(function(link){if(link.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-action-sheet'))return;var raw=link.getAttribute('href');if(!raw||/^(https?:|mailto:|tel:|#)/i.test(raw)||raw.indexOf('admin')===0)return;try{var url=new URL(raw,location.href);if(url.origin===location.origin){url.searchParams.set('edit','1');link.setAttribute('href',url.pathname.replace(/^\//,'')+url.search+url.hash);}}catch(e){}});
  }
  function selectionSelector(node){if(!node)return'';var attr=['data-collection-id','data-section','data-item','data-i18n'].find(function(key){return node.hasAttribute(key);});if(!attr)return'';var selector='['+attr+'="'+CSS.escape(node.getAttribute(attr))+'"]';if(attr==='data-item'&&node.parentElement.hasAttribute('data-list'))selector='[data-list="'+CSS.escape(node.parentElement.getAttribute('data-list'))+'"]>'+selector;return selector;}
  function addChoices(info){
    if(!info||!window.OmniSite.canChangeElement(info.target))return [];
    var parent=info.target.parentElement,choices=[];
    if(window.OmniSite.allowedContainer(window.OmniSite.elementKind(info.target),parent))choices.push({kind:'copy',label:'Another like this'});
    [{kind:'paragraph',label:'Paragraph'},{kind:'bullet',label:'Bullet'},{kind:'button',label:'Button'},{kind:'stat',label:'Stat'},{kind:'faq',label:'FAQ'},{kind:'step',label:'Step'},{kind:'card',label:'Card'}].forEach(function(choice){if(window.OmniSite.allowedContainer(choice.kind,parent))choices.push(choice);});return choices;
  }
  function openAddMenu(info,trigger){
    openActionSheet('Add element',addChoices(info).map(function(choice){return {label:choice.label,hint:window.OmniFieldHelp.get(choice.label),run:function(){addElement(info,choice.kind);}};}),trigger);
  }
  function addElement(info,kind){
    finishEdit(true);if((state.draft.addedElements||[]).length>=400){toast('Remove an added element before adding another. The limit is 400.','error');return;}
    if(!addChoices(info).some(function(choice){return choice.kind===kind;}))return;
    var id;do{id='ae-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0');}while((state.draft.addedElements||[]).some(function(row){return row.id===id;}));
    var scope=info.id.split(':')[0],key='added.'+id,record={id:id,scope:scope,kind:kind,anchor:info.id,position:'after'},copied;
    if(kind==='copy'){record.cloneOf=info.id.slice(info.id.indexOf(':')+1);copied=window.OmniSite.cloneElement(info.target,id);}
    commit(function(d){d.addedElements=d.addedElements||[];d.addedElements.push(record);d.i18n=d.i18n||{};
      ['en','az'].forEach(function(lang){d.i18n[lang]=d.i18n[lang]||{};if(kind==='stat')d.i18n[lang][key+'.fig']='0';if(copied)copied.mapping.forEach(function(part){var value=((state.draft.i18n||{})[lang]||{})[part.oldKey];if(value===undefined)value=getPath((window.OM_I18N||{})[lang]||{},part.oldKey);d.i18n[lang][part.key]=typeof value==='string'?value:part.text;});});
      if(copied){var sourceLink=window.OmniSite.elementLinkTarget(info.target),dest=sourceLink&&cleanEditorDestination(sourceLink.getAttribute('href')||'');if(dest&&window.OmniElementRules.link(dest)){d.elementLinks=d.elementLinks||{};d.elementLinks[scope+':'+key]=dest;}if(sourceLink&&sourceLink.matches('.btn,.btn-text')){d.elementStyles=d.elementStyles||{};d.elementStyles[scope+':'+key]=sourceLink.matches('.btn-text')?'text':sourceLink.matches('.btn-secondary')?'secondary':'primary';}}
    },kind==='copy'?'Copy element':'Add '+kind);
    requestAnimationFrame(function(){var node=$('[data-omni-added="'+id+'"]');if(!node)return;var first=node.matches('[data-i18n]')?node:$('[data-i18n]',node);selectContent(first||node);node.scrollIntoView({block:'nearest'});if(first)beginEdit(first);});
  }
  function cleanEditorDestination(value){
    if(/^(?:https?:|mailto:|tel:|#)/i.test(value))return value;
    try{var url=new URL(value,location.origin);url.searchParams.delete('edit');return url.pathname.replace(/^\/(?=[a-z0-9-]+\.html)/,'')+url.search+url.hash;}catch(e){return value;}
  }
  function elementStyleControl(info){
    var group=document.createElement('div');group.className='omni-segments omni-element-styles';group.setAttribute('role','group');group.setAttribute('aria-label','Button style');
    var target=window.OmniSite.elementLinkTarget(info.target),current=(state.draft.elementStyles||{})[info.id]||(target&&target.matches('.btn-text')?'text':target&&target.matches('.btn-secondary')?'secondary':'primary');
    ['primary','secondary','text'].forEach(function(style){var button=document.createElement('button');button.type='button';button.textContent=style.charAt(0).toUpperCase()+style.slice(1);button.setAttribute('data-element-style',style);button.setAttribute('aria-pressed',String(current===style));button.title=window.OmniFieldHelp.get('Style');button.addEventListener('click',function(){commit(function(d){d.elementStyles=d.elementStyles||{};d.elementStyles[info.id]=style;},'Change button style');$$('[data-element-style]',group).forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-element-style')===style));});});group.appendChild(button);});return group;
  }
  function openElementLink(info){
    finishEdit(true);var target=window.OmniSite.elementLinkTarget(info.target);if(!target||!window.OmniSite.canChangeElement(info.target))return;
    var current=(state.draft.elementLinks||{})[info.id]||cleanEditorDestination(target.getAttribute('href')||''),panel;
    function render(root){
      root.innerHTML='<p class="omni-panel-state" role="status">Loading destinations…</p>';
      api('GET','/api/link-targets').then(function(data){if(!root.isConnected)return;root.textContent='';var status=document.createElement('p');status.className='omni-panel__hint';status.setAttribute('data-link-current','');root.appendChild(status);
        var options={page:data.pages.map(function(p){return {value:p.key+'.html',label:p.title+' page'};}),section:((data.sections||{})[pageKey()]||[]).map(function(s){return {value:'#'+s.id,label:s.label};}),item:[]};
        ['cases','articles','jobs'].forEach(function(type){(data.items[type]||[]).forEach(function(item){options.item.push({value:({cases:'/work/',articles:'/insights/',jobs:'/careers/'}[type])+item.slug,label:({cases:'Case: ',articles:'Article: ',jobs:'Job: '}[type])+item.title});});});
        var selected=['page','section','item'].find(function(type){return options[type].some(function(option){return option.value===current;});})||'custom';
        var matching=[].concat(options.page,options.section,options.item).find(function(option){return option.value===current;});status.textContent='Goes to: '+(matching?matching.label:current&&current!=='#'?current:'Choose a destination');
        var fields=document.createElement('fieldset');fields.className='omni-link-destinations';var legend=document.createElement('legend');legend.textContent='Destination';fields.appendChild(legend);var controls={};
        [['page','Page'],['section','Section on this page'],['item','Item'],['custom','Custom']].forEach(function(pair){var type=pair[0],wrap=document.createElement('div'),label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='omni-link-kind';radio.value=type;radio.checked=selected===type;label.append(radio,document.createTextNode(' '+pair[1]));wrap.appendChild(label);var input=document.createElement(type==='custom'?'input':'select');input.id='omni-link-'+type;input.setAttribute('aria-label',pair[1]+' destination');input.disabled=selected!==type;
          if(type==='custom'){input.type='text';input.value=selected==='custom'?current:'';input.placeholder='https://example.com, mailto:hello@example.com, tel:+123456789';}else{options[type].forEach(function(option){var el=document.createElement('option');el.value=option.value;el.textContent=option.label;input.appendChild(el);});if(selected===type)input.value=current;if(!options[type].length){var empty=document.createElement('option');empty.value='';empty.textContent='No destinations available';input.appendChild(empty);}}
          controls[type]=input;wrap.appendChild(input);fields.appendChild(wrap);radio.addEventListener('change',function(){selected=type;Object.keys(controls).forEach(function(key){controls[key].disabled=key!==type;});error.textContent='';input.focus();});});root.appendChild(fields);
        var hint=document.createElement('p');hint.className='omni-field-help';hint.textContent=window.OmniFieldHelp.get('Link');root.appendChild(hint);var error=document.createElement('p');error.id='omni-link-error';error.className='omni-form-message';error.setAttribute('role','alert');root.appendChild(error);
        if(target.matches('.btn,.btn-text')){var title=document.createElement('p');title.textContent='Button style';root.append(title,elementStyleControl(info));}
        var save=document.createElement('button');save.type='button';save.className='omni-panel-action omni-primary-action';save.textContent='Save link';save.setAttribute('data-element-link-save','');root.appendChild(save);save.addEventListener('click',function(){var input=controls[selected],value=input.value.trim();if(!window.OmniElementRules.link(value)||value==='#'){error.textContent='Choose a destination or enter a complete web address, mailto: email link or tel: phone link.';input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',error.id);input.focus();return;}commit(function(d){d.elementLinks=d.elementLinks||{};d.elementLinks[info.id]=value;},'Change element link');closePanel();toast('Link updated. Publish when you are ready.');});
      }).catch(function(){if(!root.isConnected)return;root.innerHTML='<p class="omni-panel-state">Could not load destinations.</p><button type="button">Try again</button>';$('button',root).addEventListener('click',function(){render(root);});});
    }
    panel=openPanel('Link and button style','right',render);
  }
  function moveLabel(node){
    var copy=node.cloneNode(true);$$('.omni-section-tools,.omni-item-tools,.omni-touch-menu,.omni-image-action,.omni-collection-tools',copy).forEach(function(el){el.remove();});
    return copy.textContent.replace(/\s+/g,' ').trim().slice(0,65)||({button:'Button row',bullet:'List',stat:'Number row',faq:'Questions',step:'Process',card:'Card grid'}[window.OmniSite.elementKind(node)]||'Content');
  }
  function moveSlots(info){
    info=movementInfo(info);
    var site=window.OmniSite;if(!info||!site.canMoveElement(info.target))return [];
    site.prepareElementSlots();var source=info.target,kind=site.elementKind(source),slots=[];
    function targetInfo(node){var info=removalInfo(node);if(info&&info.target===node)return info;return $$('[data-i18n],[data-hide-key]',node).map(removalInfo).find(function(info){return info&&info.target===node;});}
    function offer(anchor,position,container){
      if(anchor===source||source.contains(anchor))return;
      var address=targetInfo(anchor);if(!address)return;
      var added=source.closest('[data-omni-added]'),id=added&&added.getAttribute('data-omni-added'),dependency=address.id,seen=[];
      while(id&&dependency){var match=dependency.match(/:added\.(ae-[0-9a-f]{8})(?:\.|$)/);if(!match)break;if(match[1]===id)return;if(seen.indexOf(match[1])>=0)return;seen.push(match[1]);var record=(state.draft.addedElements||[]).find(function(row){return row.id===match[1];});dependency=record&&record.anchor;}
      var placed=source.parentElement.matches('[data-omni-placement-row],[data-omni-added-row]')?source.parentElement:source;
      if(container===placed.parentElement&&(position==='before'&&anchor===placed.nextElementSibling||position==='after'&&anchor===placed.previousElementSibling||position==='into'&&placed===container.lastElementChild))return;
      var section=container.closest('[data-section]');if(!section||section!==source.closest('[data-section]'))return;
      slots.push({anchor:address.id,position:position,container:container,reference:anchor,section:section,horizontal:isRowFlow(container),label:position==='into'?'Bottom of '+(container.matches('.btn-row')?'button row':container.matches('ul,ol')?'list':container.matches('.wrap')?'section':container.matches('.cta-grid > div,.split > div')?'text column':'content'):position==='before'?'Top — above: '+moveLabel(anchor):'Under: '+moveLabel(anchor)});
    }
    var section=source.closest('[data-section]');if(!section)return [];
    $$(site.ALLOWED_DROPS[kind]||'',section).forEach(function(container){
      if(!site.allowedContainer(kind,container)||container===source||source.contains(container)||container.closest('[data-omni-placement-row],[data-omni-added-row]'))return;
      if(source.matches('[data-item],li[data-catalogue-item]')&&container!==source.parentElement)return;
      var children=Array.from(container.children).filter(function(child){return !child.matches('.omni-section-tools,.omni-item-tools,.omni-touch-menu,.omni-collection-tools,.omni-image-action');});
      children=children.filter(function(child){return !!targetInfo(child);});
      if(children.length)offer(children[0],'before',container);
      children.forEach(function(child,index){if(index<children.length-1)offer(child,'after',container);});offer(container,'into',container);
    });return slots;
  }
  function moveElement(info,slot){
    finishEdit(true);var current=selectedElement();if(current&&current.id===info.id)info=current;
    info=movementInfo(info);
    var valid=moveSlots(info).find(function(candidate){return candidate.anchor===slot.anchor&&candidate.position===slot.position;});
    if(!valid){toast('That place is no longer available. Choose another place.','error');return;}
    if(info.target.matches('[data-item],li[data-catalogue-item]')){
      var source=info.target,list=source.parentElement,target=valid.position==='into'?$$(':scope > [data-item],:scope > li[data-catalogue-item]',list).slice(-1)[0]:valid.reference,before=valid.position==='before';
      if(!target||target===source)return;
      if(source.hasAttribute('data-catalogue-item'))reorderService(source,target,before);
      else if(list.getAttribute('data-list')==='industry.strip')reorderIndustry(source,target,before);
      else commit(function(d){list.insertBefore(source,before?target:target.nextSibling);d.itemOrder=d.itemOrder||{};d.itemOrder[list.getAttribute('data-list')]=genericItemOrder(list);},'Reorder items');
      toast('Reordered item. Undo reverses the move.');return;
    }
    var added=info.target.closest('[data-omni-added]'),id=added&&added.getAttribute('data-omni-added');
    if(!id&&(state.draft.placements||[]).length>=400&&!(state.draft.placements||[]).some(function(row){return row.key===info.id;})){toast('The limit is 400 moved elements. Undo a move before moving another.','error');return;}
    commit(function(d){if(id){var row=d.addedElements.find(function(record){return record.id===id;});row.anchor=slot.anchor;row.position=slot.position;}else{d.placements=(d.placements||[]).filter(function(row){return row.key!==info.id;});d.placements.push({key:info.id,anchor:slot.anchor,position:slot.position});}},'Move element');
    toast('Moved '+slot.label.charAt(0).toLowerCase()+slot.label.slice(1));
    requestAnimationFrame(function(){var moved=selectedElement();if(moved){moved.target.scrollIntoView({block:'nearest'});positionElementTools();}});
  }
  function openElementActions(info,trigger){
    var hidden=(state.draft.hiddenElements||[]).indexOf(info.id)>=0,actions=[];
    if(window.OmniSite.canMoveElement(info.target))[-1,1].forEach(function(direction){actions.push({label:direction<0?'Earlier':'Later',hint:'Reorder within this section. Undo reverses the move.',disabled:!elementStep(info,direction),run:function(){moveElementBy(info,direction);}});});
    actions.push({label:hidden?'Restore':'Remove',disabled:!!info.reason,title:info.reason||'Remove this element; Undo brings it back.',run:function(){toggleElement(info);}});
    openActionSheet('Element actions',actions,trigger);
  }
  function elementStep(info,direction){
    info=movementInfo(info);
    var slots=moveSlots(info);if(!slots.length)return null;
    var boundary=document.createRange();if(direction<0)boundary.setStartBefore(info.target);else boundary.setStartAfter(info.target);boundary.collapse(true);
    var candidates=slots.map(function(slot){var range=document.createRange();if(slot.position==='into')range.setStart(slot.container,slot.container.childNodes.length);else if(slot.position==='before')range.setStartBefore(slot.reference);else range.setStartAfter(slot.reference);range.collapse(true);return {slot:slot,range:range};}).filter(function(candidate){return candidate.range.compareBoundaryPoints(Range.START_TO_START,boundary)*direction>0;});
    var siblings=candidates.filter(function(candidate){return candidate.slot.container===info.target.parentElement;});if(siblings.length)candidates=siblings;
    candidates.sort(function(a,b){return a.range.compareBoundaryPoints(Range.START_TO_START,b.range)*direction;});
    return candidates.length?candidates[0].slot:null;
  }
  function moveElementBy(info,direction){
    var slot=elementStep(info,direction);if(!slot)return;
    var focused=document.activeElement,restore=focused&&focused.hasAttribute('data-element-step');moveElement(info,slot);
    if(restore)requestAnimationFrame(function(){var button=$('[data-element-step="'+direction+'"]');if(button)(button.disabled?$('[data-element-edit]')||button:button).focus({preventScroll:true});});
  }
  var elementDrag=null,elementScrollFrame=0,holdTimer=0,holdPoint=null,suppressHoldClick=false,holdTarget=null,holdClickUntil=0;
  function movementInfo(info){if(!info)return info;var added=info.target.closest('[data-omni-added]');return added?Object.assign({},info,{target:added}):info;}
  function clearElementDrag(){
    cancelAnimationFrame(elementScrollFrame);elementScrollFrame=0;elementDrag=null;var layer=$('.omni-element-dropzones');if(layer)layer.remove();endDrag();
  }
  /* Children of a row-flow container (button rows, stat rows, card grids)
     sit side by side, so their before/after slots must be vertical strips
     at each child's left/right edge — a horizontal strip at top/bottom
     would be the same band for every sibling and left/right drops could
     never change the order. */
  function isRowFlow(container){
    if(!container)return false;
    if(container.matches('.btn-row,.stat-row,.grid-2,.grid-3,.claim-cards,.eng-cols'))return true;
    var cs=getComputedStyle(container),display=cs.display;
    if(/flex/.test(display))return !/column/.test(cs.flexDirection)&&cs.flexWrap!=='wrap'||Array.prototype.some.call(container.children,function(a){var b=a.nextElementSibling;return b&&Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)<4;});
    if(/grid/.test(display))return cs.gridTemplateColumns.split(' ').filter(Boolean).length>1;
    return false;
  }
  function positionElementZones(){
    if(!elementDrag)return;elementDrag.zones.forEach(function(zone){var slot=zone.slot,rect=slot.reference.getBoundingClientRect(),into=slot.position==='into',node=zone.node;
      if(!into&&slot.horizontal){
        var x=slot.position==='before'?rect.left:rect.right;
        node.classList.add('is-vertical');
        node.style.left=(x-10)+'px';node.style.top=rect.top+'px';node.style.width='20px';node.style.height=Math.max(24,rect.height)+'px';
        node.hidden=rect.width===0||rect.height===0||rect.bottom<48||rect.top>innerHeight;
        return;
      }
      var y=slot.position==='before'?rect.top:rect.bottom;
      node.classList.remove('is-vertical');
      node.style.left=Math.max(4,rect.left)+'px';node.style.top=(into?Math.max(rect.top,y-26):y-10)+'px';node.style.width=Math.max(24,Math.min(rect.width,innerWidth-rect.left-8))+'px';node.style.height=(into?26:20)+'px';node.hidden=rect.width===0||(!into&&rect.height===0)||y<48||rect.top>innerHeight;
    });
  }
  function startElementDrag(info,event){
    info=movementInfo(info);
    if(!window.OmniSite.canMoveElement(info.target)){event.preventDefault();return;}clearElementDrag();
    var layer=document.createElement('div');layer.className='omni-element-dropzones';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);
    elementDrag={info:info,zones:[],y:innerHeight/2};beginDrag(info.target);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',info.id);
    moveSlots(info).forEach(function(slot){var zone=document.createElement('div');zone.className='omni-element-dropzone'+(slot.position==='into'?' is-container':'');zone.setAttribute('data-element-drop-anchor',slot.anchor);zone.setAttribute('data-element-drop-position',slot.position);zone.setAttribute('data-element-drop-flow',slot.horizontal?'row':'column');zone.title=slot.label;layer.appendChild(zone);elementDrag.zones.push({node:zone,slot:slot});
      zone.addEventListener('dragover',function(e){if(!elementDrag)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';elementDrag.y=e.clientY;$$('.omni-element-dropzone.is-over').forEach(function(node){node.classList.remove('is-over');});zone.classList.add('is-over');});
      zone.addEventListener('dragleave',function(){zone.classList.remove('is-over');});zone.addEventListener('drop',function(e){if(!elementDrag)return;e.preventDefault();e.stopPropagation();var source=elementDrag.info;clearElementDrag();moveElement(source,slot);});
    });positionElementZones();
    function scroll(){if(!elementDrag)return;var y=elementDrag.y,delta=y<110?-Math.ceil((110-y)/7):y>innerHeight-100?Math.ceil((y-innerHeight+100)/7):0;if(delta){window.scrollBy(0,delta);positionElementZones();}elementScrollFrame=requestAnimationFrame(scroll);}elementScrollFrame=requestAnimationFrame(scroll);
  }
  function removalInfo(el){var info=window.OmniSite&&window.OmniSite.elementRemovalInfo(el);if(info&&info.target.hasAttribute('data-omni-hidden-element'))info.id=info.target.getAttribute('data-omni-hidden-element');return info;}
  function selectedElement(){var source=state.elementSelection&&$(state.elementSelection);return source&&removalInfo(source);}
  function toggleElement(info){
    if(!info||info.reason)return;
    var added=info.target.closest('[data-omni-added]');if(added){var addedId=added.getAttribute('data-omni-added'),prefix='added.'+addedId;
      finishEdit(true);clearSelection();commit(function(d){d.addedElements=(d.addedElements||[]).filter(function(row){return row.id!==addedId;});['en','az'].forEach(function(lang){Object.keys(d.i18n&&d.i18n[lang]||{}).forEach(function(key){if(key===prefix||key.indexOf(prefix+'.')===0)delete d.i18n[lang][key];});});['elementLinks','elementStyles'].forEach(function(prop){Object.keys(d[prop]||{}).forEach(function(key){if(key.split(':')[1]===prefix||key.split(':')[1].indexOf(prefix+'.')===0)delete d[prop][key];});});d.placements=(d.placements||[]).filter(function(row){return row.key.split(':')[1]!==prefix&&row.key.split(':')[1].indexOf(prefix+'.')!==0;});d.hiddenElements=(d.hiddenElements||[]).filter(function(key){return key.split(':')[1]!==prefix&&key.split(':')[1].indexOf(prefix+'.')!==0;});},'Remove added element');toast('Added element removed. Undo brings it back.');return;}
    finishEdit(true);var hidden=(state.draft.hiddenElements||[]).indexOf(info.id)>=0;
    if(!hidden&&(state.draft.hiddenElements||[]).length>=400){toast('Restore an element before removing another. The limit is 400.','error');return;}
    commit(function(d){d.hiddenElements=d.hiddenElements||[];if(hidden)d.hiddenElements=d.hiddenElements.filter(function(key){return key!==info.id;});else d.hiddenElements.push(info.id);},hidden?'Restore element':'Remove element');
    toast(hidden?'Restored.':'Removed. Undo or Restore to bring it back.');
    var button=$('.omni-element-tools [data-element-remove]');if(button)button.focus();
  }
  function removalButton(info){
    var hidden=(state.draft.hiddenElements||[]).indexOf(info.id)>=0,button=document.createElement('button');button.type='button';button.setAttribute('data-element-remove','');button.textContent=hidden?'↺ Restore':'🗑 Remove';button.disabled=!!info.reason;
    button.title=info.reason||(info.target.closest('[data-omni-added]')?'Remove this addition. Undo brings it back.':info.id.charAt(0)==='*'?'Hidden everywhere this appears':hidden?'Show this element to visitors again.':'Hide this element for visitors. Restore it any time.');
    button.addEventListener('click',function(){toggleElement(info);});return button;
  }
  function positionElementTools(){
    if(elementDrag)return;
    var tools=$('.omni-element-tools'),info=selectedElement();if(!tools||!info)return;
    if(isMobileEditor()){tools.style.left='8px';tools.style.right='8px';tools.style.top='auto';tools.style.bottom='70px';document.documentElement.style.setProperty('--omni-element-toolbar-height',tools.offsetHeight+'px');return;}
    var rect=info.target.getBoundingClientRect();tools.style.bottom='auto';tools.style.right='auto';tools.style.left=Math.max(8,Math.min(rect.left,innerWidth-tools.offsetWidth-8))+'px';tools.style.top=Math.max(56,Math.min(rect.top-tools.offsetHeight-8,innerHeight-tools.offsetHeight-8))+'px';
  }
  function showElementTools(info){
    var old=$('.omni-element-tools');if(old)old.remove();if(!info||state.activeEdit)return;
    var tools=document.createElement('div');tools.className='omni-element-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Element actions');
    var edit=editableTarget(info.source);if(edit){var text=document.createElement('button');text.type='button';text.textContent='Edit text';text.setAttribute('data-element-edit','');text.addEventListener('click',function(){beginEdit(edit);});tools.appendChild(text);}
    tools.appendChild(removalButton(info));
    if(window.OmniSite.canMoveElement(info.target)){
      [-1,1].forEach(function(direction){var move=document.createElement('button');move.type='button';move.textContent=direction<0?'Earlier':'Later';move.setAttribute('data-element-step',direction);move.disabled=!elementStep(info,direction);move.title='Reorder within this section ('+(direction<0?'Alt+↑':'Alt+↓')+'). Undo reverses the move.';move.addEventListener('click',function(){moveElementBy(info,direction);});tools.appendChild(move);});
      if(!isMobileEditor()){var drag=document.createElement('button');drag.type='button';drag.textContent='⋮⋮';drag.draggable=true;drag.setAttribute('data-element-drag','');drag.setAttribute('aria-label','Drag element');drag.title='Drag to a highlighted place in this section';drag.addEventListener('dragstart',function(e){startElementDrag(info,e);});drag.addEventListener('dragend',clearElementDrag);tools.appendChild(drag);}
    }
    if(addChoices(info).length){var add=document.createElement('button');add.type='button';add.textContent='＋ Add';add.setAttribute('data-element-add','');add.addEventListener('click',function(){openAddMenu(info,add);});tools.appendChild(add);}
    var link=window.OmniSite.elementLinkTarget(info.target);if(link&&window.OmniSite.canChangeElement(info.target)){var editLink=document.createElement('button');editLink.type='button';editLink.textContent='Link';editLink.setAttribute('data-element-link','');editLink.addEventListener('click',function(){openElementLink(info);});tools.appendChild(editLink);if(link.matches('.btn,.btn-text'))tools.appendChild(elementStyleControl(info));}
    if(isMobileEditor()){var more=document.createElement('button');more.type='button';more.textContent='Actions';more.setAttribute('data-element-actions','');more.addEventListener('click',function(){openElementActions(info,more);});tools.appendChild(more);}
    var hintDismissed=false;try{hintDismissed=!!localStorage.getItem('omni-hint-remove');}catch(e){}
    if(!hintDismissed){var hint=document.createElement('div');hint.className='omni-remove-hint';var copy=document.createElement('span');copy.textContent=info.target.closest('[data-omni-added]')?'Remove deletes this addition; Undo brings it back.':'Remove hides this for visitors; you can restore it any time.';var dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Got it';dismiss.addEventListener('click',function(){try{localStorage.setItem('omni-hint-remove','1');}catch(e){}hint.remove();positionElementTools();});hint.append(copy,dismiss);tools.appendChild(hint);}
    document.body.appendChild(tools);positionElementTools();
  }
  function clearSelection(){state.selection='';state.elementSelection='';$$('.omni-selected').forEach(function(el){el.classList.remove('omni-selected');});var tools=$('.omni-element-tools');if(tools)tools.remove();document.documentElement.style.removeProperty('--omni-element-toolbar-height');}
  function restoreSelection(){var info=selectedElement();if(info){info.target.classList.add('omni-selected');showElementTools(info);}else if(state.selection){var node=$(state.selection);if(node)node.classList.add('omni-selected');}}
  function selectContent(target){
    if(target.closest('.omni-bar,.omni-panel,.omni-dialog,.omni-action-sheet,.omni-mini-tools,.omni-element-tools,.omni-section-tools,.omni-item-tools,.omni-touch-menu,.omni-image-action'))return;
    if(state.activeEdit&&!state.activeEdit.el.contains(target))finishEdit(true);
    var info=removalInfo(target),node=info?info.target:target.closest('[data-collection-id],[data-item],[data-catalogue-item],[data-section]');
    if(node===document.body||node&&node.matches('main'))node=null;
    clearSelection();if(info){var attr=info.source.hasAttribute('data-hide-key')?'data-hide-key':'data-i18n',region=info.source.closest('.drawer,.mega,#site-footer,#cookieBanner,#site-header,main'),prefix=region?(region.id?'#'+region.id:region.matches('main')?'main':region.matches('.drawer')?'.drawer':'.mega')+' ':'';state.elementSelection=prefix+'['+attr+'="'+CSS.escape(info.source.getAttribute(attr))+'"]';}else state.selection=selectionSelector(node);
    if(node)node.classList.add('omni-selected');showElementTools(info);
  }
  function bindEvents(){
    document.addEventListener('pointerdown',function(e){
      clearTimeout(holdTimer);holdPoint=null;if(e.pointerType!=='touch'||!isMobileEditor()||state.activeEdit)return;
      var info=removalInfo(e.target);if(!info||!window.OmniSite.canMoveElement(info.target))return;
      suppressHoldClick=false;holdPoint={x:e.clientX,y:e.clientY};holdTimer=setTimeout(function(){holdPoint=null;suppressHoldClick=true;holdTarget=info.target;holdClickUntil=Date.now()+1200;openElementActions(info,info.target);},550);
    },true);
    document.addEventListener('pointermove',function(e){if(holdPoint&&Math.hypot(e.clientX-holdPoint.x,e.clientY-holdPoint.y)>10){clearTimeout(holdTimer);holdPoint=null;}},true);
    ['pointerup','pointercancel'].forEach(function(type){document.addEventListener(type,function(){clearTimeout(holdTimer);holdPoint=null;},true);});
    document.addEventListener('click',function(e){if(suppressHoldClick&&Date.now()<holdClickUntil&&holdTarget&&holdTarget.contains(e.target)){suppressHoldClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('contextmenu',function(e){if(isMobileEditor()&&removalInfo(e.target)){e.preventDefault();}},true);
    document.addEventListener('dragover',function(e){if(elementDrag){elementDrag.y=e.clientY;if(!e.target.closest('.omni-element-dropzone'))e.dataTransfer.dropEffect='none';}});
    document.addEventListener('drop',function(e){if(elementDrag){e.preventDefault();clearElementDrag();}});
    window.addEventListener('blur',function(){if(elementDrag)clearElementDrag();clearTimeout(holdTimer);});
    window.addEventListener('scroll',function(){clearTimeout(holdTimer);positionElementZones();},true);window.addEventListener('resize',positionElementZones);
    document.addEventListener('pointerdown',function(e){var info=removalInfo(e.target),current=selectedElement();state.repeatSelection=!!(info&&current&&info.source===current.source);selectContent(e.target);},true);document.addEventListener('focusin',function(e){if(!state.activeEdit)selectContent(e.target);});
    document.addEventListener('click',function(e){var el=editableTarget(e.target),info=removalInfo(e.target);if(!el&&!info)return;if(e.target.closest('.omni-touch-menu,.omni-image-action'))return;e.preventDefault();e.stopPropagation();var current=selectedElement(),repeat=e.detail===0?!!(info&&current&&info.source===current.source):state.repeatSelection;if(!info){if(el)beginEdit(el);return;}if(state.activeEdit&&state.activeEdit.el===el)return;selectContent(e.target);if(repeat&&el&&!info.target.hasAttribute('data-omni-hidden-element'))beginEdit(el);},true);
    document.addEventListener('click',function(e){var service=e.target.closest('[data-add-service]');if(service){e.preventDefault();addService(service);return;}var industry=e.target.closest('[data-add-industry]');if(industry){e.preventDefault();addIndustry();}},true);
    document.addEventListener('click',function(e){var link=e.target.closest('a[href]');if(!link||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||/^((mailto|tel):|#)/i.test(link.getAttribute('href')))return;var url;try{url=new URL(link.href,location.href);}catch(error){return;}if(url.origin!==location.origin)return;e.preventDefault();finishEdit(true);saveDraft(true).then(function(){state.allowNavigate=true;location.href=url.href;}).catch(function(error){toast(error.message||'Save your changes before leaving this page.','error');});});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&elementDrag){e.preventDefault();clearElementDrag();return;}
      if(state.activeEdit){if(e.key==='Escape'){e.preventDefault();finishEdit(false);return;}if(e.key==='Enter'&&state.activeEdit.collection&&state.activeEdit.rich&&!e.ctrlKey&&!e.metaKey)return;if(e.key==='Enter'&&!(e.shiftKey&&state.activeEdit.rich&&/<br\s*\/?\s*>/i.test(state.activeEdit.original))){e.preventDefault();finishEdit(true);return;}}
      if(e.key==='Escape'&&$('.omni-dialog[open],.omni-action-sheet[open]'))return;
      if(e.key==='Escape'&&$('.omni-panel')){e.preventDefault();closePanel();return;}
      if(!state.activeEdit&&!e.isComposing&&!e.target.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],.omni-panel,.omni-dialog,.omni-action-sheet')){
        if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&selectedElement()){e.preventDefault();moveElementBy(selectedElement(),e.key==='ArrowUp'?-1:1);return;}
        if(e.key==='Escape'){e.preventDefault();clearSelection();return;}
        if((e.key==='Delete'||e.key==='Backspace')&&selectedElement()){e.preventDefault();if((state.draft.hiddenElements||[]).indexOf(selectedElement().id)<0)toggleElement(selectedElement());return;}
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();publish();}
    });
    document.addEventListener('paste',function(e){if(!state.activeEdit)return;e.preventDefault();var text=(e.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,text);});
    document.addEventListener('submit',function(e){if(!e.target.closest('.omni-dialog,.omni-panel')){e.preventDefault();toast('Forms are disabled in edit mode.');}},true);
    window.addEventListener('resize',positionMiniTools);window.addEventListener('scroll',positionMiniTools,true);if(window.visualViewport){window.visualViewport.addEventListener('resize',positionMiniTools);window.visualViewport.addEventListener('scroll',positionMiniTools);}
    window.addEventListener('resize',positionElementTools);window.addEventListener('scroll',positionElementTools,true);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&state.draft&&totalChanges())saveDraft(true).catch(function(){});});
    window.addEventListener('beforeunload',function(e){if(!state.allowNavigate&&state.draft&&totalChanges()){flushSync();e.preventDefault();e.returnValue='';}});
  }

  function boot(){
    api('GET','/api/me').then(function(me){if(!me.authed){location.replace('admin.html');throw new Error('Not signed in');}state.user=me.user;state.permissions=me.permissions||{};return api('GET','/api/draft');}).then(function(data){
      state.live=clone(data.live);var local=readLocal(),serverAt=data.savedAt?Date.parse(data.savedAt):0,localAt=local&&local.savedAt?Date.parse(local.savedAt):0;
      state.draft=clone(local&&local.draft&&localAt>serverAt?local.draft:(data.draft||data.live));state.savedAt=localAt>serverAt?local.savedAt:data.savedAt;
      /* the live version this draft started from — handed back by the server for an existing draft, else "now" */
      state.baseUpdatedAt=data.draft?(data.baseUpdatedAt||(data.live&&data.live.updatedAt)||null):((data.live&&data.live.updatedAt)||null);
      var useLocal=!!(local&&local.draft&&localAt>serverAt&&!same(local.draft,data.draft||data.live));state.draftRevision=useLocal?(local.draftRevision||0):(data.revision||0);if(useLocal)state.baseUpdatedAt=local.baseUpdatedAt||null;state.recoveryConflict=useLocal&&(state.draftRevision!==(data.revision||0)||state.baseUpdatedAt!==(data.baseUpdatedAt||(data.live&&data.live.updatedAt)||null));state.savedBy=data.savedBy||null;
      state.lang=(window.OmniI18n&&window.OmniI18n.getLang())||'en';state.defaults=(window.OmniSite&&window.OmniSite.getDefaults())||{engines:clone(window.OMNI_ENGINES||[]),industries:clone(window.OMNI_INDUSTRIES||[]),collections:clone(window.OMNI_COLLECTIONS||{}),i18n:clone(window.OM_I18N||{en:{},az:{}})};
      buildBar();buildPageFrame();mergeDraftDict();if(window.OmniI18n)window.OmniI18n.setLang(state.lang);applyDraft();rewriteLinks();bindEvents();loadUnread();setSaveStatus(state.savedAt?'Draft restored':'Draft ready');
      if(state.recoveryConflict)showDraftConflict({savedBy:data.savedBy});else if(new URLSearchParams(location.search).get('panel')==='settings'&&state.permissions.manageSettings)openSettings();
      document.dispatchEvent(new CustomEvent('omni:editor-ready'));
    }).catch(function(error){if(error.status===401)location.replace('admin.html');else if(error.message!=='Not signed in'){document.documentElement.classList.remove('omni-editing');console.error(error);}});
  }
  window.OmniEditor={getState:function(){return state;},commit:commit,undo:undo,redo:redo,publish:publish,discard:discard};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
