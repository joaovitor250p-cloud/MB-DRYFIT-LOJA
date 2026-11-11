let shopFirebaseClientPromise=null,shopFirebaseObserverStarted=false,shopFirebaseBusy=0,shopFirebaseRefreshTimer=null;
function firebaseCustomerMessage(error){
 const messages={'auth/invalid-credential':'E-mail ou senha incorretos.','auth/invalid-login-credentials':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/user-not-found':'E-mail ou senha incorretos.','auth/email-already-in-use':'Este e-mail já tem conta. Entre ou use “Esqueci minha senha”.','auth/invalid-email':'Informe um e-mail válido.','auth/weak-password':'Use uma senha com pelo menos 8 caracteres.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/network-request-failed':'Não foi possível conectar. Confira sua internet e tente novamente.','auth/user-disabled':'Essa conta está desativada. Fale com a MB.','auth/requires-recent-login':'Entre novamente para continuar.','auth/operation-not-allowed':'O acesso por e-mail ainda precisa ser ativado pela loja.'};
 return messages[error?.code]||(error?.status?error.message:'Não foi possível concluir o acesso. Tente novamente.');
}
async function getShopFirebaseClient(){
 if(!shopFirebaseClientPromise)shopFirebaseClientPromise=(async()=>{
  const {config}=await shopAPI('account/firebase/config');if(!config)throw Error('Firebase indisponível.');
  const [appSDK,authSDK]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
  const app=appSDK.getApps().find(app=>app.name==='mb-dryfit')||appSDK.initializeApp(config,'mb-dryfit'),auth=authSDK.getAuth(app);auth.languageCode='pt';
  try{await authSDK.setPersistence(auth,authSDK.browserLocalPersistence)}catch{await authSDK.setPersistence(auth,authSDK.inMemoryPersistence)}
  return {auth,sdk:authSDK};
 })().catch(error=>{shopFirebaseClientPromise=null;throw error});
 return shopFirebaseClientPromise;
}
function clearFirebaseCustomerView(){
 shopCustomer.user=null;shopCustomer.role=null;shopOrderReceipt=null;
 try{localStorage.setItem('mb-last-order-v1','null')}catch{}
 catalogFavorites.clear();let guest=[];try{guest=JSON.parse(localStorage.getItem('mb-dryfit-favorites-v1')||'[]')}catch{}
 for(const key of guest)catalogFavorites.add(key);refreshAccountButtons();if(products.length)render();
 const dialog=$('#customerAccount');if(dialog?.open)drawFirebaseAccountForm(dialog,'login');
}
async function establishFirebaseCustomer(user,profile=null,forceRefresh=false){
 const id_token=await user.getIdToken(forceRefresh);await shopAPI('account/firebase/session','POST',{id_token,...(profile?{profile}:{})});await loadCustomerAccount();
 return shopCustomer.user;
}
async function initFirebaseCustomer(){
 if(shopFirebaseObserverStarted||shopCustomer.provider!=='firebase')return;
 try{
  const {auth,sdk}=await getShopFirebaseClient();shopFirebaseObserverStarted=true;
  sdk.onIdTokenChanged(auth,async user=>{
   if(shopFirebaseBusy)return;
   if(!user){if(shopCustomer.user){await shopAPI('account/logout','POST',{});clearFirebaseCustomerView()}return}
   if(!user.emailVerified)return;
   try{await establishFirebaseCustomer(user)}catch(error){if(error.status===401||error.status===403){await sdk.signOut(auth);clearFirebaseCustomerView()}}
  });
  shopFirebaseRefreshTimer=setInterval(async()=>{
   if(document.hidden||shopFirebaseBusy||!auth.currentUser?.emailVerified)return;
   try{await establishFirebaseCustomer(auth.currentUser)}catch(error){if(error.status===401||error.status===403||String(error.code||'').includes('token-expired')){await sdk.signOut(auth);await shopAPI('account/logout','POST',{});clearFirebaseCustomerView()}}
  },45*60*1000);
  window.addEventListener('focus',async()=>{if(!shopFirebaseBusy&&auth.currentUser?.emailVerified)try{await establishFirebaseCustomer(auth.currentUser)}catch{}});
 }catch{notifyShopper('O acesso à conta não carregou. Você pode continuar usando o catálogo e tentar entrar novamente.')}
}
async function completeFirebaseCustomerAccess(dialog,user,profile=null){
 if(!user.emailVerified){drawFirebaseAccountForm(dialog,'verify',user.email);return false}
 try{await establishFirebaseCustomer(user,profile,true)}catch(error){if(error.status===428){drawFirebaseAccountForm(dialog,'complete',user.email);return false}throw error}
 await syncAccountFavorites(true);dialog.close();
 if(shopAccountReturnTeam&&['owner','seller'].includes(shopCustomer.role)){location.href='/gestao';return true}
 notifyShopper('Conta conectada. Bem-vindo à MB!');if($('#shopCartDialog')?.open)refreshShopCartQuote();return true;
}
function drawFirebaseAccountForm(dialog,mode='login',email=''){
 dialog.dataset.accountMode=mode;const register=mode==='register',complete=mode==='complete',verify=mode==='verify',reset=mode==='reset',resetSent=mode==='reset-sent';
 const title=register?'Criar minha conta':complete?'Seu perfil na MB':verify?'Confirme seu e-mail':reset||resetSent?'Recuperar senha':'Bem-vindo de volta.';
 const profile=register||complete,formMode=!verify&&!resetSent;
 dialog.innerHTML='<div class="account-head"><div><small>SEU ESPAÇO / MB DRYFIT</small><h2 id="customerAccountTitle">'+title+'</h2></div><button type="button" data-close-account aria-label="Fechar">✕</button></div>'+
 (verify?'<p class="account-notice">Abra o e-mail enviado pelo Firebase e toque no link de confirmação. Depois volte aqui e selecione “Já confirmei meu e-mail”. Confira também a caixa de spam.</p><p class="account-email">'+esc(email)+'</p>':resetSent?'<p class="account-notice">Se houver uma conta com esse e-mail, o Firebase enviará um link para redefinir sua senha. Abra o link, escolha a nova senha e volte para entrar.</p>':'')+
 (formMode?'<form id="customerAccountForm"><div class="account-fields">'+(profile?'<label>Nome<input name="first_name" autocomplete="given-name" maxlength="80" required></label><label>Sobrenome<input name="last_name" autocomplete="family-name" maxlength="80" required></label><label class="wide">Data de nascimento<input name="birth_date" type="date" min="1900-01-01" max="'+new Date().toISOString().slice(0,10)+'" required autocomplete="bday"></label>':'')+'<label class="wide">E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required value="'+esc(email)+'" '+(complete?'readonly':'')+'></label>'+(!reset&&!complete?'<label class="wide">Senha<input name="password" type="password" minlength="8" maxlength="128" autocomplete="'+(register?'new-password':'current-password')+'" required><small>No mínimo 8 caracteres.</small></label>':'')+'</div><p id="customerAccountError" role="alert"></p><button class="shop-primary" id="accountSubmit">'+(register?'Criar conta e confirmar e-mail':complete?'Salvar perfil e entrar':reset?'Enviar link de recuperação':'Entrar')+'</button></form>':'<p id="customerAccountError" role="alert"></p>'+(verify?'<button class="shop-primary" id="firebaseCheckEmail">Já confirmei meu e-mail</button>':''))+
 '<div class="account-links">'+(mode==='login'?'<button type="button" data-account-mode="register">Quero criar minha conta</button><button type="button" data-account-mode="reset">Esqueci minha senha</button>':(verify?'<button type="button" id="firebaseResendEmail">Reenviar link de confirmação</button>':'')+'<button type="button" data-account-mode="login">Voltar para entrar</button>')+'</div><p class="account-privacy">Seu perfil é individual. Nome, e-mail e data de nascimento não aparecem no catálogo.</p>';
 dialog.querySelector('[data-close-account]').onclick=()=>dialog.close();
 dialog.querySelectorAll('[data-account-mode]').forEach(button=>button.onclick=()=>drawFirebaseAccountForm(dialog,button.dataset.accountMode));
 const showError=error=>{const host=dialog.querySelector('#customerAccountError');if(host)host.textContent=firebaseCustomerMessage(error)};
 const run=async(button,action)=>{button.disabled=true;shopFirebaseBusy++;try{await action()}catch(error){showError(error)}finally{shopFirebaseBusy--;if(button.isConnected)button.disabled=false}};
 const form=dialog.querySelector('#customerAccountForm');if(form)form.onsubmit=event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));return run(dialog.querySelector('#accountSubmit'),async()=>{
  const {auth,sdk}=await getShopFirebaseClient();
  if(reset){await sdk.sendPasswordResetEmail(auth,data.email);drawFirebaseAccountForm(dialog,'reset-sent',data.email);return}
  if(complete){if(!auth.currentUser)throw Object.assign(Error('Entre novamente para completar seu perfil.'),{status:401});await completeFirebaseCustomerAccess(dialog,auth.currentUser,{first_name:data.first_name,last_name:data.last_name,birth_date:data.birth_date});return}
  const credentials=register?await sdk.createUserWithEmailAndPassword(auth,data.email,data.password):await sdk.signInWithEmailAndPassword(auth,data.email,data.password);
  if(register){await shopAPI('account/firebase/profile','POST',{id_token:await credentials.user.getIdToken(),profile:{first_name:data.first_name,last_name:data.last_name,birth_date:data.birth_date}});drawFirebaseAccountForm(dialog,'verify',data.email);await sdk.sendEmailVerification(credentials.user);return}
  await sdk.reload(credentials.user);await completeFirebaseCustomerAccess(dialog,auth.currentUser);
 })};
 const check=dialog.querySelector('#firebaseCheckEmail');if(check)check.onclick=()=>run(check,async()=>{const {auth,sdk}=await getShopFirebaseClient();if(!auth.currentUser){drawFirebaseAccountForm(dialog,'login',email);return}await sdk.reload(auth.currentUser);if(!auth.currentUser.emailVerified)throw Object.assign(Error('O e-mail ainda não foi confirmado. Abra o link recebido e tente novamente.'),{status:403});await completeFirebaseCustomerAccess(dialog,auth.currentUser)});
 const resend=dialog.querySelector('#firebaseResendEmail');if(resend)resend.onclick=()=>run(resend,async()=>{const {auth,sdk}=await getShopFirebaseClient();if(!auth.currentUser){drawFirebaseAccountForm(dialog,'login',email);return}await sdk.sendEmailVerification(auth.currentUser);notifyShopper('Link enviado. Confira seu e-mail e a caixa de spam.')});
}

async function signOutFirebaseCustomer(){const {auth,sdk}=await getShopFirebaseClient();shopFirebaseBusy++;try{await sdk.signOut(auth)}finally{shopFirebaseBusy--}}
