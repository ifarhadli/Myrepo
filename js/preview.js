/* Private draft-preview shell. The server injects this only after validating
   the revocable preview token. No editor controls or private API data. */
(function(){
  'use strict';
  var token=String(window.OMNI_PREVIEW_TOKEN||'');
  if(!token)return;
  document.documentElement.classList.add('omni-preview');
  function previewUrl(raw){
    if(!raw||/^(?:mailto:|tel:|javascript:|#)/i.test(raw))return raw;
    try{
      var url=new URL(raw,location.href);
      if(url.origin!==location.origin||/^\/(?:api|admin|data|media)(?:\/|\.|$)/i.test(url.pathname))return raw;
      url.searchParams.delete('edit');url.searchParams.set('preview',token);
      return url.pathname+url.search+url.hash;
    }catch(error){return raw;}
  }
  document.querySelectorAll('a[href]').forEach(function(link){var next=previewUrl(link.getAttribute('href'));if(next)link.setAttribute('href',next);});
  document.addEventListener('submit',function(event){
    event.preventDefault();
    var ribbon=document.querySelector('.omni-preview-ribbon span');
    if(ribbon){ribbon.textContent='Forms are disabled in preview. No information was sent.';ribbon.setAttribute('role','alert');}
  },true);
})();
