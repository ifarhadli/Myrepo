'use strict';
module.exports = async function({req,check,adminCookie,editorCookie}){
  const admin={admin:true,cookie:adminCookie,captureCookie:false},anonymous={cookie:'',captureCookie:false};
  const baseline=(await req('GET','/api/site',undefined,anonymous)).json;
  const draft=JSON.parse(JSON.stringify(baseline));
  draft.features.englishVersion=false;draft.features.underConstruction=true;
  draft.settings.defaultLang='en';
  for(const flag of ['englishVersion','underConstruction']){
    const forbidden=JSON.parse(JSON.stringify(baseline));forbidden.features[flag]=draft.features[flag];
    const r=await req('PUT','/api/draft',{...forbidden,draftRevision:0},{admin:true,cookie:editorCookie,captureCookie:false});
    check('Editor cannot change '+flag,r.status===403,r.text);
  }
  let r=await req('PUT','/api/draft',{...draft,draftRevision:0},admin);
  check('Admin can save language and availability controls',r.status===200,r.text);
  check('unpublished construction setting leaves public pages open',(await req('GET','/',undefined,anonymous)).status===200);
  r=await req('POST','/api/publish',undefined,admin);
  check('hiding English forces AZ default and preserves English copy',r.status===200&&r.json.site.settings.defaultLang==='az'&&JSON.stringify(r.json.site.i18n.en)===JSON.stringify(baseline.i18n.en),r.text);
  for(const route of ['/','/services.html','/services','/work/example','/?edit=1']){
    r=await req('GET',route,undefined,anonymous);
    check('construction gates public '+route,r.status===503&&/lang="az"/.test(r.text)&&!r.text.includes('js/editor.js'),r.text.slice(0,150));
  }
  check('construction is temporary and uncached',r.headers.get('retry-after')==='3600'&&r.headers.get('cache-control')==='no-store');
  check('construction leaves login accessible',(await req('GET','/admin.html',undefined,anonymous)).status===200);
  check('owner can edit while construction is live',(await req('GET','/index.html?edit=1',undefined,admin)).status===200);
  check('construction leaves required assets accessible',(await req('GET','/css/style.css',undefined,anonymous)).status===200);
  check('HEAD construction response has no body',(await req('HEAD','/',undefined,anonymous)).text==='');
  const live=(await req('GET','/api/site',undefined,anonymous)).json;
  await req('PUT','/api/draft',{...live,draftRevision:0},admin);
  r=await req('POST','/api/preview-link',{path:'/'},admin);
  const preview=new URL(r.json.url);
  r=await req('GET',preview.pathname+preview.search,undefined,anonymous);
  check('private preview bypasses construction and stays private',r.status===200&&r.text.includes('js/preview.js')&&r.headers.get('cache-control')==='no-store');
  check('invalid preview cannot bypass construction',(await req('GET','/?preview=invalid',undefined,anonymous)).status===403);
  const revision=(await req('GET','/api/draft',undefined,admin)).json.revision;
  await req('PUT','/api/draft',{...baseline,draftRevision:revision},admin);
  r=await req('POST','/api/publish',undefined,admin);
  check('owner can reopen site and re-enable English',r.status===200&&r.json.site.features.englishVersion!==false&&(await req('GET','/',undefined,anonymous)).status===200);
};
