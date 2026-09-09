const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),{spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=__dirname,TMP=fs.mkdtempSync(path.join(os.tmpdir(),'omni-full-audit-'));
for(const n of fs.readdirSync(ROOT))if(/\.html$/.test(n)||['server.js','css','js','assets'].includes(n))fs.cpSync(path.join(ROOT,n),path.join(TMP,n),{recursive:true});
fs.mkdirSync(path.join(TMP,'data'));for(const n of ['site.json','site.js'])if(fs.existsSync(path.join(ROOT,'data',n)))fs.copyFileSync(path.join(ROOT,'data',n),path.join(TMP,'data',n));
fs.mkdirSync(path.join(OUT,'screenshots'),{recursive:true});fs.mkdirSync(path.join(OUT,'snapshots'),{recursive:true});
const PORT=6181,DEBUG=6182,CONTROL=6183,MAIL=6184,BASE='http://127.0.0.1:'+PORT,PW='audit-local-password',mail=[];
const mailServer=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{mail.push(JSON.parse(b));res.writeHead(200,{'Content-Type':'application/json'});res.end('{"id":"audit-mail"}')})}).listen(MAIL,'127.0.0.1');
const app=spawn(process.execPath,['server.js'],{cwd:TMP,windowsHide:true,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',ADMIN_PASSWORD:PW,ADMIN_EMAIL:'',RESEND_API_KEY:'audit-mock',RESEND_API_URL:'http://127.0.0.1:'+MAIL+'/emails',NOTIFY_EMAIL_TO:'',NOTIFY_WEBHOOK_URL:''},stdio:'ignore'});
const bin=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=spawn(bin,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port='+DEBUG,'--user-data-dir='+path.join(TMP,'browser'),'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,seq=0,step=0;const pending=new Map(),errors=[],actions=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){try{const x=await fn();if(x)return x}catch{}await pause(100)}throw Error('Timeout '+String(fn))}
function send(method,params={}){return new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function snapshot(){const data=await ev(`(()=>{const visible=e=>!!(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';return {url:location.href,title:document.title,focus:document.activeElement?.outerHTML.slice(0,300),overflow:document.documentElement.scrollWidth-innerWidth,text:(document.querySelector('dialog[open],.omni-panel,#panel,#login')||document.querySelector('.omni-bar')||document.body).innerText,controls:[...document.querySelectorAll('button,a,input,select,textarea,summary,[role=button],[contenteditable=true]')].filter(visible).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('title')||'').trim().slice(0,100),attrs:Object.fromEntries([...e.attributes].filter(a=>a.name==='id'||a.name==='href'||a.name==='type'||a.name==='class'||a.name.startsWith('data-')||a.name.startsWith('aria-')).map(a=>[a.name,a.value])),disabled:e.disabled,value:e.value,options:e.tagName==='SELECT'?[...e.options].map(o=>({text:o.text,value:o.value})):undefined}))}})()`);fs.writeFileSync(path.join(OUT,'snapshots',String(++step).padStart(4,'0')+'.json'),JSON.stringify(data,null,2));return data}
async function target(selector){const s=await snapshot();const r=await ev(`(()=>{const a=[...document.querySelectorAll(${JSON.stringify(selector)})];if(a.length!==1)throw Error('Target count '+a.length);const e=a[0];e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,disabled:!!e.disabled,html:e.outerHTML.slice(0,400)}})()`);if(!r.w||!r.h)throw Error('Hidden target '+selector);return r}
async function click(selector){const t=await target(selector);if(t.disabled)throw Error('Disabled target '+selector);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:t.x,y:t.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:t.x,y:t.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:t.x,y:t.y,button:'left',clickCount:1});await pause(180);return snapshot()}
async function command(c){let result;switch(c.op){
case 'snap':result=await snapshot();break;
case 'click':result=await click(c.selector);break;
case 'fill':await click(c.selector);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});await send('Input.insertText',{text:c.value});if(c.blur)await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await pause(120);result=await snapshot();break;
case 'select':await target(c.selector);result=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(c.selector)});e.value=${JSON.stringify(c.value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(220);result=await snapshot();break;
case 'key':await snapshot();await send('Input.dispatchKeyEvent',{type:'keyDown',...c.key});await send('Input.dispatchKeyEvent',{type:'keyUp',...c.key});await pause(150);result=await snapshot();break;
case 'go':await send('Page.navigate',{url:BASE+c.route});await until(()=>ev(`location.pathname===${JSON.stringify(c.route.split(/[?#]/)[0])}&&document.readyState!=='loading'`));await pause(350);result=await snapshot();break;
case 'view':await send('Emulation.setDeviceMetricsOverride',{width:c.width,height:c.height||900,deviceScaleFactor:1,mobile:c.width<700});await pause(150);result=await snapshot();break;
case 'shot':await snapshot();const pic=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const file=path.join(OUT,'screenshots',c.name+'.png');fs.writeFileSync(file,Buffer.from(pic.data,'base64'));result=file;break;
case 'eval':result=await ev(c.expression);break;
case 'cdp':await snapshot();result=await send(c.method,c.params);break;
case 'mail':result=mail;break;
case 'errors':result=errors;break;
case 'stop':setTimeout(()=>{ws.close();browser.kill();app.kill();mailServer.close();process.exit()},250);result='stopped';break;
default:throw Error('Unknown operation')}
actions.push({at:new Date().toISOString(),op:c.op,selector:c.selector,route:c.route,name:c.name});fs.writeFileSync(path.join(OUT,'actions.json'),JSON.stringify(actions,null,2));return result}
(async()=>{
 await until(()=>fetch(BASE+'/api/auth').then(r=>r.ok));
 const tab=await until(()=>fetch('http://127.0.0.1:'+DEBUG+'/json/list').then(r=>r.json()).then(a=>a.find(x=>x.type==='page')));
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown'){errors.push(m.params);fs.writeFileSync(path.join(OUT,'errors.json'),JSON.stringify(errors,null,2))}};
 for(const m of ['Page.enable','Runtime.enable','Accessibility.enable','Network.enable'])await send(m);
 await send('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 http.createServer((req,res)=>{
  let b='';req.on('data',c=>b+=c);req.on('end',async()=>{
   try{res.end(JSON.stringify(await command(JSON.parse(b))))}
   catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}))}
  });
 }).listen(CONTROL,'127.0.0.1');
 console.log(JSON.stringify({ready:true,BASE,CONTROL,TMP}));
})().catch(e=>{console.error(e);browser.kill();app.kill();process.exit(1)});
