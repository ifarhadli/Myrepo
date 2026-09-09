/* Shared editor/runtime/server rules. No DOM or dependencies. */
(function(root,factory){var rules=factory();if(typeof module==='object'&&module.exports)module.exports=rules;else root.OmniElementRules=rules;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function address(value){return typeof value==='string'&&value===value.trim()&&/^(\*|[a-z0-9-]{1,40}):[a-zA-Z0-9._-]{1,120}$/.test(value);}
  function link(value){
    if(typeof value!=='string'||!value||value.length>2000||/[\s\\<>"'\u0000-\u001f\u007f]/.test(value))return false;
    if(/^https?:\/\//i.test(value)){try{var url=new URL(value);return !!url.hostname&&!url.username&&!url.password;}catch(e){return false;}}
    if(/^mailto:[^@?]+@[^@?]+\.[^@?]+(?:\?[^#]*)?$/i.test(value))return true;
    if(/^tel:\+?[0-9().-]+$/i.test(value))return true;
    return /^(?:[a-z0-9-]+\.html(?:#[a-zA-Z0-9._:-]+)?|\/(?:work|insights|careers)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:#[a-zA-Z0-9._:-]+)?|#[a-zA-Z0-9._:-]*)$/.test(value);
  }
  function changes(before,after){
    before=before||{};after=after||{};
    function difference(a,b){var keys=Object.keys(a||{}).concat(Object.keys(b||{}));return Array.from(new Set(keys)).filter(function(key){return JSON.stringify((a||{})[key])!==JSON.stringify((b||{})[key]);}).length;}
    function byId(rows,key){var out={};(rows||[]).forEach(function(row,index){out[row[key||'id']]=key?[row,index]:row;});return out;}
    return {added:difference(byId(before.addedElements),byId(after.addedElements)),moved:difference(byId(before.placements,'key'),byId(after.placements,'key')),links:difference(before.elementLinks,after.elementLinks),styles:difference(before.elementStyles,after.elementStyles)};
  }
  function brandColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);}
  // Each new position names its previous index. Missing indices were deleted.
  function remapRemovalOrder(draft,prefix,order,previousLength){
    draft.hiddenElements=(draft.hiddenElements||[]).map(function(id){
      var colon=id.indexOf(':'),key=id.slice(colon+1);if(key.indexOf(prefix)!==0)return id;
      var match=key.slice(prefix.length).match(/^(\d+)(\..*)?$/);if(!match)return id;
      if(Number(match[1])>=previousLength)return id; // Preserve unknown valid future keys.
      var next=order.indexOf(Number(match[1]));return next<0?null:id.slice(0,colon+1)+prefix+next+(match[2]||'');
    }).filter(function(id){return id!==null;});
  }
  function remapRemovedItems(draft,prefix,from,to,length){
    if(from<0||from>=length||to!==null&&(to<0||to>=length))return;
    var order=Array.from({length:length},function(_,i){return i;}),moved=order.splice(from,1)[0];if(to!==null)order.splice(to,0,moved);
    remapRemovalOrder(draft,prefix,order,length);
  }
  function catalogueResetOrder(before,after){
    var used=[];return after.map(function(value){var index=before.findIndex(function(old,i){return used.indexOf(i)<0&&old===value;});if(index>=0)used.push(index);return index;});
  }
  return {address:address,link:link,changes:changes,brandColor:brandColor,remapRemovalOrder:remapRemovalOrder,remapRemovedItems:remapRemovedItems,catalogueResetOrder:catalogueResetOrder,kinds:['paragraph','bullet','button','stat','faq','step','card','copy'],positions:['after','before','into'],styles:['primary','secondary','text']};
});
