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
    function byId(rows){var out={};(rows||[]).forEach(function(row){out[row.id]=row;});return out;}
    return {added:difference(byId(before.addedElements),byId(after.addedElements)),links:difference(before.elementLinks,after.elementLinks),styles:difference(before.elementStyles,after.elementStyles)};
  }
  return {address:address,link:link,changes:changes,kinds:['paragraph','bullet','button','stat','faq','step','card','copy'],positions:['after','before','into'],styles:['primary','secondary','text']};
});
