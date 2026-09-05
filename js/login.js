(function(){
  'use strict';
  var loginForm=document.getElementById('loginForm'),email=document.getElementById('loginEmail'),emailField=document.getElementById('loginEmailField'),password=document.getElementById('loginPw'),loginError=document.getElementById('loginErr'),loginStatus=document.getElementById('loginStatus');
  var recoverView=document.getElementById('recoverView'),recoverStatus=document.getElementById('recoverStatus'),sendRecovery=document.getElementById('sendRecovery'),recoverEmail=document.getElementById('recoverEmail'),recoverEmailField=document.getElementById('recoverEmailField');
  var resetForm=document.getElementById('resetForm'),resetPw=document.getElementById('resetPw'),resetPw2=document.getElementById('resetPw2'),resetError=document.getElementById('resetErr');
  var resetToken=new URLSearchParams(location.search).get('reset')||'',authInfo={emailRequired:false,recoveryAvailable:false};

  function api(method,path,body){
    return fetch(path,{method:method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'OmniAdmin'},body:body===undefined?undefined:JSON.stringify(body)}).then(function(response){
      return response.json().catch(function(){return{};}).then(function(data){if(!response.ok){var error=new Error(data.error||('HTTP '+response.status));error.status=response.status;throw error;}return data;});
    });
  }
  function showOnly(view){loginForm.hidden=view!=='login';recoverView.hidden=view!=='recover';resetForm.hidden=view!=='reset';}
  function setNotice(node,message,kind){node.textContent=message;node.hidden=!message;if(kind)node.setAttribute('data-kind',kind);else node.removeAttribute('data-kind');}
  function showLoginError(message,field){loginError.textContent=message;loginError.hidden=false;var target=field==='email'?email:password;target.setAttribute('aria-invalid','true');target.focus();}
  function clearLoginError(){loginError.hidden=true;loginError.textContent='';email.setAttribute('aria-invalid','false');password.setAttribute('aria-invalid','false');}
  function showResetError(message){resetError.textContent=message;resetError.hidden=false;resetPw.setAttribute('aria-invalid','true');resetPw2.setAttribute('aria-invalid','true');resetPw.focus();}
  function clearResetError(){resetError.hidden=true;resetError.textContent='';resetPw.setAttribute('aria-invalid','false');resetPw2.setAttribute('aria-invalid','false');}

  document.querySelectorAll('[data-password-toggle]').forEach(function(button){
    button.addEventListener('click',function(){var input=document.getElementById(button.getAttribute('data-password-toggle')),showing=input.type==='text';input.type=showing?'password':'text';button.textContent=showing?'Show':'Hide';button.setAttribute('aria-pressed',String(!showing));input.focus();});
  });
  [email,password].forEach(function(input){input.addEventListener('input',clearLoginError);});
  loginForm.addEventListener('submit',function(event){
    event.preventDefault();clearLoginError();var submit=loginForm.querySelector('[type="submit"]');
    if(authInfo.emailRequired&&(!email.value||!email.checkValidity())){showLoginError('Enter the email address for your account.','email');return;}
    if(!password.value){showLoginError('Enter your password.');return;}
    submit.disabled=true;submit.textContent='Signing in…';
    api('POST','/api/login',{email:email.value.trim(),password:password.value}).then(function(){location.href='index.html?edit=1';}).catch(function(failure){submit.disabled=false;submit.textContent='Sign in';showLoginError(failure.message||'Could not sign in.',authInfo.emailRequired?'email':'password');});
  });

  document.getElementById('forgotPassword').addEventListener('click',function(){
    showOnly('recover');setNotice(recoverStatus,'');sendRecovery.disabled=true;
    api('GET','/api/recover').then(function(info){
      recoverEmailField.hidden=!info.emailRequired;recoverEmail.required=!!info.emailRequired;
      if(info.available){sendRecovery.disabled=false;document.getElementById('recoverHelp').textContent=info.emailRequired?'Enter your account email. We will send a private, one-time reset link if it matches an active account.':'We will email a private, one-time reset link to the saved account address.';}
      else{document.getElementById('recoverHelp').textContent='Password recovery is not set up. Whoever runs the server can delete data/admin.json and restart to generate a new password.';setNotice(recoverStatus,'No recovery email can be sent from this installation.','warning');}
    }).catch(function(){setNotice(recoverStatus,'Could not check recovery status. Try again in a moment.','warning');});
  });
  document.querySelectorAll('[data-back-login]').forEach(function(button){button.addEventListener('click',function(){showOnly('login');(emailField.hidden?password:email).focus();});});
  recoverEmail.addEventListener('input',function(){recoverEmail.setAttribute('aria-invalid','false');setNotice(recoverStatus,'');});
  sendRecovery.addEventListener('click',function(){
    if(!recoverEmailField.hidden&&(!recoverEmail.value||!recoverEmail.checkValidity())){recoverEmail.setAttribute('aria-invalid','true');setNotice(recoverStatus,'Enter a valid account email.','warning');recoverEmail.focus();return;}
    sendRecovery.disabled=true;sendRecovery.textContent='Sending…';setNotice(recoverStatus,'');
    api('POST','/api/recover',{email:recoverEmail.value.trim()}).then(function(){setNotice(recoverStatus,'If that account can receive recovery mail, a reset link has been sent. Check the inbox and spam folder.','success');sendRecovery.textContent='Link requested';}).catch(function(error){sendRecovery.disabled=false;sendRecovery.textContent='Send reset link';setNotice(recoverStatus,error.message||'Could not request a reset link.','warning');});
  });
  [resetPw,resetPw2].forEach(function(input){input.addEventListener('input',clearResetError);});
  resetForm.addEventListener('submit',function(event){
    event.preventDefault();clearResetError();var submit=resetForm.querySelector('[type="submit"]');
    if(resetPw.value.length<8){showResetError('Use at least 8 characters.');return;}if(resetPw.value!==resetPw2.value){showResetError('The passwords do not match.');return;}
    submit.disabled=true;submit.textContent='Saving…';api('POST','/api/reset',{token:resetToken,next:resetPw.value}).then(function(){
      history.replaceState(null,'',location.pathname);resetToken='';resetForm.reset();return api('GET','/api/auth').catch(function(){return authInfo;});
    }).then(function(info){authInfo=info||authInfo;emailField.hidden=!authInfo.emailRequired;email.required=!!authInfo.emailRequired;showOnly('login');setNotice(loginStatus,'Password set. Sign in to continue.','success');(emailField.hidden?password:email).focus();
    }).catch(function(error){submit.disabled=false;submit.textContent='Save new password';showResetError(error.message||'The reset link is invalid or expired.');});
  });

  if(resetToken){showOnly('reset');resetPw.focus();}
  api('GET','/api/me').then(function(me){
    if(me.authed&&!resetToken){location.replace('index.html?edit=1');return;}
    return api('GET','/api/auth').then(function(info){authInfo=info||authInfo;emailField.hidden=!authInfo.emailRequired;email.required=!!authInfo.emailRequired;if(authInfo.emailRequired&&!resetToken)email.focus();});
  }).catch(function(){document.getElementById('login').hidden=true;document.getElementById('noServer').hidden=false;});
})();
