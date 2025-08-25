(function(){
  var App = {};
  var SUPABASE_URL_KEY='https://ckosqudwsqylsudndpkj.supabase.co', SUPABASE_ANON_KEY_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrb3NxdWR3c3F5bHN1ZG5kcGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MjIyMDksImV4cCI6MjA3MTA5ODIwOX0.pe0DKeMb3goyvpnup99mzuZoiVMz8O017t1DHkkJto8';
  var AUTH_SB_URL_KEY='https://ppmbtoptcxelwewwompk.supabase.co', AUTH_SB_ANON_KEY_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbWJ0b3B0Y3hlbHdld3dvbXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNjE0NjcsImV4cCI6MjA2OTYzNzQ2N30.Q01_d75sc3j362CMulQwkhtp0SuTzU86X2ElmXPU518';
  var DEFAULT_CATEGORIES=['食品(長期)','期限切れ食品','冷凍食品','日用品','飲料','酒','ペット','バッグ','靴'];
  var DEFAULT_QUANTITIES=[1,2,3,4,5,6,12,24,30];
  function $(id){return document.getElementById(id);} 
  function escapeHtml(s){ if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function addLog(m){ try{ var a=$('logArea'); var t=new Date().toISOString(); a.innerHTML='['+t+'] '+escapeHtml(String(m))+'<br/>'+a.innerHTML; if(window.console&&console.log)console.log(m);}catch(e){} }
  function saveConfig(){ /* 設定UI削除済み。必要なら事前にlocalStorageへ格納してください。*/ }
  function getClient(){
    if(App._client) return App._client;
    var url=null,key=null;
    // サポート: 定数に直接URL/KEYが入っている場合
    try{
      if(typeof SUPABASE_URL_KEY==='string' && SUPABASE_URL_KEY.indexOf('http')===0){ url=SUPABASE_URL_KEY; }
      if(typeof SUPABASE_ANON_KEY_KEY==='string' && SUPABASE_ANON_KEY_KEY.length>20){ key=SUPABASE_ANON_KEY_KEY; }
    }catch(_e){}
    // 旧仕様: localStorageのキー名として使う場合
    if(!url||!key){ try{ url=url||localStorage.getItem(SUPABASE_URL_KEY); key=key||localStorage.getItem(SUPABASE_ANON_KEY_KEY);}catch(e){} }
    if(!url||!key){ addLog('Supabase設定が未入力です'); return null; }
    try{ if(!window.supabase||!window.supabase.createClient){ addLog('Supabaseクライアント読込失敗'); return null;} App._client=window.supabase.createClient(url,key); return App._client; }catch(e){ addLog('初期化失敗: '+e); return null; }
  }
  function getAuthClient(){
    if(App._authClient) return App._authClient;
    var url=null,key=null;
    // サポート: 定数に直接URL/KEYが入っている場合
    try{
      if(typeof AUTH_SB_URL_KEY==='string' && AUTH_SB_URL_KEY.indexOf('http')===0){ url=AUTH_SB_URL_KEY; }
      if(typeof AUTH_SB_ANON_KEY_KEY==='string' && AUTH_SB_ANON_KEY_KEY.length>20){ key=AUTH_SB_ANON_KEY_KEY; }
    }catch(_e){}
    // 旧仕様: localStorageのキー名として使う場合
    if(!url||!key){ try{ url=url||localStorage.getItem(AUTH_SB_URL_KEY); key=key||localStorage.getItem(AUTH_SB_ANON_KEY_KEY);}catch(e){} }
    if(!url||!key){ addLog('認証Supabase設定が未入力です'); return null; }
    try{ if(!window.supabase||!window.supabase.createClient){ addLog('Supabaseクライアント読込失敗'); return null;} App._authClient=window.supabase.createClient(url,key); return App._authClient; }catch(e){ addLog('認証初期化失敗: '+e); return null; }
  }
  function init(){ if(window.RegisterOnly&&RegisterOnly.init){ RegisterOnly.init(DEFAULT_CATEGORIES,DEFAULT_QUANTITIES, addLog, escapeHtml, getClient); } setTimeout(function(){ var el=$('janInput'); if(el&&el.focus)el.focus(); },0); }
  function showLogin(){ var content=document.getElementById('content'); var login=document.getElementById('loginPanel'); if(login) login.style.display=''; if(content) content.style.display='none'; var ub=document.getElementById('userBar'); if(ub) ub.style.display='none'; }
  function showApp(user){ var content=document.getElementById('content'); var login=document.getElementById('loginPanel'); if(login) login.style.display='none'; if(content) content.style.display=''; var ub=document.getElementById('userBar'); var uw=document.getElementById('userWelcome'); if(ub) ub.style.display=''; if(uw) uw.innerHTML= escapeHtml((user && (user.full_name||user.username||''))||''); }
  function handleLoginUI(){ var toggle=document.getElementById('toggleAuthConfig'); var save=document.getElementById('saveAuthConfig'); var logout=document.getElementById('logoutBtn'); var btn=document.getElementById('loginBtn'); var msg=document.getElementById('loginMsg'); if(toggle){ toggle.onclick=function(){ var p=document.getElementById('authConfigPanel'); if(p) p.style.display=(p.style.display==='none'?'': 'none'); }; } if(save){ save.onclick=function(){ var u=(document.getElementById('authSupabaseUrl')||{}).value||''; var k=(document.getElementById('authSupabaseKey')||{}).value||''; try{ localStorage.setItem(AUTH_SB_URL_KEY,u); localStorage.setItem(AUTH_SB_ANON_KEY_KEY,k); msg.innerHTML='保存しました'; }catch(e){ msg.innerHTML='保存失敗'; } }; } if(logout){ logout.onclick=function(){ try{ window.userAuthUtils && window.userAuthUtils.clearSession(); }catch(_e){} showLogin(); }; } if(btn){ btn.onclick=function(){ var user=(document.getElementById('loginUsername')||{}).value||''; var pass=(document.getElementById('loginPassword')||{}).value||''; var uc=window.userAuthUtils; if(!uc){ msg.innerHTML='認証ユーティリティが読込できません'; return; } // inject auth client creator
      window.createSupabaseClient = function(){ return getAuthClient(); };
      uc.initializeSupabase();
      msg.innerHTML='ログイン中...';
      uc.login(user, pass).then(function(res){ if(res && res.success){ try{ uc.saveSession(res.user); }catch(_e){} showApp(res.user); } else { msg.innerHTML= (res && res.error) || 'ログイン失敗'; } }).catch(function(e){ msg.innerHTML= e && e.message || 'ログイン失敗'; }); } }
  }
  function showTab(id){ var r=document.getElementById('view-register'); var b=document.getElementById('view-browse'); var u=document.getElementById('view-update'); var tr=document.getElementById('tabRegister'); var tb=document.getElementById('tabBrowse'); var tu=document.getElementById('tabUpdate'); if(id==='register'){ r.style.display=''; b.style.display='none'; u.style.display='none'; tr.className='tab active'; tb.className='tab'; tu.className='tab'; setTimeout(function(){ var el=$('janInput'); if(el&&el.focus)el.focus(); },0); } else if(id==='browse'){ r.style.display='none'; b.style.display=''; u.style.display='none'; tr.className='tab'; tb.className='tab active'; tu.className='tab'; var btn=document.getElementById('applyFilter'); if(btn&&btn.click) btn.click(); } else { r.style.display='none'; b.style.display='none'; u.style.display=''; tr.className='tab'; tb.className='tab'; tu.className='tab active'; } }
  function initTabs(){ document.getElementById('tabRegister').onclick=function(){ showTab('register'); }; document.getElementById('tabBrowse').onclick=function(){ showTab('browse'); }; var tu=document.getElementById('tabUpdate'); if(tu){ tu.onclick=function(){ showTab('update'); }; } }
  
  // expose helpers for other modules (browse.js)
  App.addLog = addLog;
  App.escapeHtml = escapeHtml;
  App.getClient = getClient;
  App.getAuthClient = getAuthClient;
  App.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
  App.DEFAULT_QUANTITIES = DEFAULT_QUANTITIES;
  window.showTab=showTab;
  window.App=App;
  document.addEventListener('DOMContentLoaded', function(){ handleLoginUI(); var sess=null; try{ sess= window.userAuthUtils && window.userAuthUtils.getSession && window.userAuthUtils.getSession(); }catch(_e){} if(sess){ showApp(sess); } else { showLogin(); } init(); initTabs(); });
})();


