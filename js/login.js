(function(){
  'use strict';
  var loginForm=document.getElementById('loginForm'),password=document.getElementById('loginPw'),loginError=document.getElementById('loginErr'),loginStatus=document.getElementById('loginStatus');
  var recoverView=document.getElementById('recoverView'),recoverStatus=document.getElementById('recoverStatus'),sendRecovery=document.getElementById('sendRecovery');
  var resetForm=document.getElementById('resetForm'),resetPw=document.getElementById('resetPw'),resetPw2=document.getElementById('resetPw2'),resetError=document.getElementById('resetErr');
  var resetToken=new URLSearchParams(location.search).get('reset')||'';

  function api(method,path,body){
    return fetch(path,{method:method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},body:body===undefined?undefined:JSON.stringify(body)}).then(function(response){
      return response.json().catch(function(){return{};}).then(function(data){if(!response.ok){var error=new Error(data.error||('HTTP '+response.status));error.status=response.status;throw error;}return data;});
    });
  }
  function showOnly(view){loginForm.hidden=view!=='login';recoverView.hidden=view!=='recover';resetForm.hidden=view!=='reset';}
  function setNotice(node,message,kind){node.textContent=message;node.hidden=!message;if(kind)node.setAttribute('data-kind',kind);else node.removeAttribute('data-kind');}
  function showLoginError(message){loginError.textContent=message;loginError.hidden=false;password.setAttribute('aria-invalid','true');password.focus();}
  function clearLoginError(){loginError.hidden=true;loginError.textContent='';password.setAttribute('aria-invalid','false');}
  function showResetError(message){resetError.textContent=message;resetError.hidden=false;resetPw.setAttribute('aria-invalid','true');resetPw2.setAttribute('aria-invalid','true');resetPw.focus();}
  function clearResetError(){resetError.hidden=true;resetError.textContent='';resetPw.setAttribute('aria-invalid','false');resetPw2.setAttribute('aria-invalid','false');}

  document.querySelectorAll('[data-password-toggle]').forEach(function(button){
    button.addEventListener('click',function(){var input=document.getElementById(button.getAttribute('data-password-toggle')),showing=input.type==='text';input.type=showing?'password':'text';button.textContent=showing?'Show':'Hide';button.setAttribute('aria-pressed',String(!showing));input.focus();});
  });
  password.addEventListener('input',clearLoginError);
  loginForm.addEventListener('submit',function(e){
    e.preventDefault();clearLoginError();var submit=loginForm.querySelector('[type="submit"]');if(!password.value){showLoginError('Enter your password.');return;}
    submit.disabled=true;submit.textContent='Signing in…';api('POST','/api/login',{password:password.value}).then(function(){location.href='index.html?edit=1';}).catch(function(failure){submit.disabled=false;submit.textContent='Sign in';showLoginError(failure.message||'Could not sign in.');});
  });

  document.getElementById('forgotPassword').addEventListener('click',function(){
    showOnly('recover');setNotice(recoverStatus,'');sendRecovery.disabled=true;
    api('GET','/api/recover').then(function(info){
      if(info.available){sendRecovery.disabled=false;document.getElementById('recoverHelp').textContent='We will email a private, one-time reset link to the recovery address saved by the site owner.';}
      else{document.getElementById('recoverHelp').textContent='Password recovery is not set up. Whoever runs the server can delete data/admin.json and restart to generate a new password.';setNotice(recoverStatus,'No recovery email can be sent from this installation.','warning');}
    }).catch(function(){setNotice(recoverStatus,'Could not check recovery status. Try again in a moment.','warning');});
  });
  document.querySelectorAll('[data-back-login]').forEach(function(button){button.addEventListener('click',function(){showOnly('login');password.focus();});});
  sendRecovery.addEventListener('click',function(){
    sendRecovery.disabled=true;sendRecovery.textContent='Sending…';setNotice(recoverStatus,'');
    api('POST','/api/recover',{}).then(function(){setNotice(recoverStatus,'If recovery is configured, a reset link has been sent. Check the inbox and spam folder.','success');sendRecovery.textContent='Link requested';}).catch(function(error){sendRecovery.disabled=false;sendRecovery.textContent='Send reset link';setNotice(recoverStatus,error.message||'Could not request a reset link.','warning');});
  });
  [resetPw,resetPw2].forEach(function(input){input.addEventListener('input',clearResetError);});
  resetForm.addEventListener('submit',function(e){
    e.preventDefault();clearResetError();var submit=resetForm.querySelector('[type="submit"]');
    if(resetPw.value.length<8){showResetError('Use at least 8 characters.');return;}if(resetPw.value!==resetPw2.value){showResetError('The passwords do not match.');return;}
    submit.disabled=true;submit.textContent='Saving…';api('POST','/api/reset',{token:resetToken,next:resetPw.value}).then(function(){
      history.replaceState(null,'',location.pathname);resetToken='';resetForm.reset();showOnly('login');setNotice(loginStatus,'Password updated. Sign in with your new password.','success');password.focus();
    }).catch(function(error){submit.disabled=false;submit.textContent='Save new password';showResetError(error.message||'The reset link is invalid or expired.');});
  });

  if(resetToken){showOnly('reset');resetPw.focus();}
  api('GET','/api/me').then(function(me){if(me.authed&&!resetToken)location.replace('index.html?edit=1');}).catch(function(){document.getElementById('login').hidden=true;document.getElementById('noServer').hidden=false;});
})();
