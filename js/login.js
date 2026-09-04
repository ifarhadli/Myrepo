(function(){
  'use strict';
  var form=document.getElementById('loginForm'),password=document.getElementById('loginPw'),error=document.getElementById('loginErr'),submit=form.querySelector('[type="submit"]');
  function showError(message){error.textContent=message;error.hidden=false;password.setAttribute('aria-invalid','true');password.focus();}
  function clearError(){error.hidden=true;error.textContent='';password.setAttribute('aria-invalid','false');}
  function api(method,path,body){return fetch(path,{method:method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},body:body===undefined?undefined:JSON.stringify(body)}).then(function(response){return response.json().catch(function(){return{};}).then(function(data){if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;});});}
  document.querySelector('[data-password-toggle]').addEventListener('click',function(){var showing=password.type==='text';password.type=showing?'password':'text';this.textContent=showing?'Show':'Hide';this.setAttribute('aria-pressed',String(!showing));password.focus();});
  password.addEventListener('input',clearError);
  form.addEventListener('submit',function(e){e.preventDefault();clearError();if(!password.value){showError('Enter your password.');return;}submit.disabled=true;submit.textContent='Signing in…';api('POST','/api/login',{password:password.value}).then(function(){location.href='index.html?edit=1';}).catch(function(failure){submit.disabled=false;submit.textContent='Sign in';showError(failure.message||'Could not sign in.');});});
  api('GET','/api/me').then(function(me){if(me.authed)location.replace('index.html?edit=1');}).catch(function(){document.getElementById('login').hidden=true;document.getElementById('noServer').hidden=false;});
})();
