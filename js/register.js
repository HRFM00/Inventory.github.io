(function(){
  var STORAGE_KEY='inventoryQueue';
  var SENDING_JOB_KEY='inventorySendingJob';
  var isSending=false;
  function $(id){return document.getElementById(id);} 
  function sanitizeJan(s){ s=String(s||'').replace(/[^0-9]/g,''); if(s.length>32)s=s.substr(0,32); return s; }
  function parseQuantity(v){ var n=parseInt(String(v||'1'),10); if(isNaN(n)||n<1)n=1; return n; }
  function readQueue(){ try{ var s=localStorage.getItem(STORAGE_KEY); if(!s)return []; var a=JSON.parse(s); return a instanceof Array?a:[]; }catch(e){ return []; } }
  function writeQueue(a){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }catch(e){} }
  function readJob(){ try{ var s=localStorage.getItem(SENDING_JOB_KEY); if(!s) return null; return JSON.parse(s); }catch(e){ return null; } }
  function writeJob(job){ try{ localStorage.setItem(SENDING_JOB_KEY, JSON.stringify(job)); }catch(e){} }
  function clearJob(){ try{ localStorage.removeItem(SENDING_JOB_KEY); }catch(e){} }
  function renderCategories(cats){ var w=$('categoryButtons'); w.innerHTML=''; for(var i=0;i<cats.length;i++){ (function(cat){ var b=document.createElement('button'); b.innerHTML=cat; b.onclick=function(){ window._selectedCategory=cat; highlightCats(); focusJan(); }; w.appendChild(b); })(cats[i]); } }
  function highlightCats(){ var w=$('categoryButtons'), bs=w.getElementsByTagName('button'); for(var i=0;i<bs.length;i++){ bs[i].className=(bs[i].innerHTML===window._selectedCategory?'selected':''); } }
  function renderQuantities(qs){ var w=$('quantityButtons'); w.innerHTML=''; for(var i=0;i<qs.length;i++){ (function(q){ var b=document.createElement('button'); b.innerHTML=String(q); b.onclick=function(){ $('quantityInput').value=String(q); highlightQty(b); focusJan(); }; w.appendChild(b); })(qs[i]); } $('quantityInput').value='1'; }
  function highlightQty(activeBtn){ var w=$('quantityButtons'), bs=w.getElementsByTagName('button'); for(var i=0;i<bs.length;i++){ bs[i].className=''; } if(activeBtn) activeBtn.className='selected'; }
  function syncQtyHighlightFromInput(){ var w=$('quantityButtons'); if(!w)return; var bs=w.getElementsByTagName('button'); var v=parseInt(String(($('quantityInput')||{value:''}).value||''),10); if(isNaN(v)){ highlightQty(null); return; } var match=null; for(var i=0;i<bs.length;i++){ var val=parseInt(String(bs[i].innerHTML||''),10); if(!isNaN(val)&&val===v){ match=bs[i]; break; } } highlightQty(match); }
  function focusJan(){ var el=$('janInput'); if(el&&el.focus)try{el.focus();}catch(e){} }
  function setJanEditable(isEditable){
    var el=$('janInput'); if(!el) return;
    try{ el.readOnly = true; }catch(_e){}
    try{ el.setAttribute('inputmode','none'); }catch(_e){}
  }
  function addToQueue(addLog, escapeHtml){
    var jan=sanitizeJan($('janInput').value);
    var qty=parseQuantity($('quantityInput').value);
    var cat=window._selectedCategory;
    if(!jan){ addLog('JANが空です'); focusJan(); return; }
    if(!cat){ addLog('カテゴリーを選択してください'); return; }
    var list=readQueue();
    var nowTs=new Date().getTime();
    // 同一JANは加算（カテゴリーは既存を優先）
    var foundIdx=-1;
    for(var i=0;i<list.length;i++){
      if(list[i].jan===jan && list[i].category===cat){ foundIdx=i; break; }
    }
    if(foundIdx>=0){
      var item=list[foundIdx];
      item.quantity = parseInt(item.quantity,10)+qty;
      if(isNaN(item.quantity) || item.quantity<1) item.quantity = qty; // safety
      item.ts = nowTs;
    } else {
      list.push({jan:jan,category:cat,quantity:qty,ts:nowTs});
    }
    writeQueue(list);
    renderQueue(addLog, escapeHtml);
    // 入力と選択状態をリセット（自動登録を防止）
    $('janInput').value='';
    $('quantityInput').value='1';
    try{ highlightQty(null); }catch(_e){}
    window._selectedCategory=null;
    try{ highlightCats(); }catch(_e){}
    setJanEditable(false);
    focusJan();
  }
  function removeFromQueue(idx, addLog, escapeHtml){ var list=readQueue(); if(idx>=0&&idx<list.length){ list.splice(idx,1); writeQueue(list); renderQueue(addLog, escapeHtml); } }
  function renderQueue(addLog, escapeHtml){ var tbody=$('queueTbody'); tbody.innerHTML=''; var list=readQueue(); for(var i=0;i<list.length;i++){ (function(ix){ var r=list[ix]; var tr=document.createElement('tr'); tr.innerHTML='<td>'+escapeHtml(r.jan)+'</td><td>'+escapeHtml(r.category)+'</td><td>'+String(r.quantity)+'</td><td></td>'; var tdOps=tr.lastChild; var del=document.createElement('button'); del.innerHTML='削除'; del.onclick=function(){ removeFromQueue(ix, addLog, escapeHtml); }; tdOps.appendChild(del); tbody.appendChild(tr); })(i); } }
  function renderSending(addLog, escapeHtml){
    var section=$('sendingSection'); var tbody=$('sendingTbody'); var bar=$('sendingProgressBar'); var text=$('sendingProgressText'); var resumeBtn=$('resumeSending');
    var job=readJob();
    if(!job || !job.items || !job.items.length){ if(section) section.style.display='none'; return; }
    if(section) section.style.display='';
    if(tbody) tbody.innerHTML='';
    for(var i=0;i<job.items.length;i++){
      var it=job.items[i];
      var st=(it.status||'pending'); var label=(st==='ok'?'完了':(st==='ng'?'失敗':'待機'));
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+escapeHtml(it.jan)+'</td><td>'+escapeHtml(it.category)+'</td><td>'+String(it.quantity)+'</td><td>'+label+'</td>';
      if(tbody) tbody.appendChild(tr);
    }
    var total=job.items.length, idx=job.idx||0; if(idx>total) idx=total;
    var pct= total? Math.floor((idx*100)/total) : 0;
    if(bar) bar.style.width= String(pct)+'%';
    if(text) text.innerHTML= String(pct)+'% ('+idx+'/'+total+')';
    if(resumeBtn) resumeBtn.style.display = (isSending || (idx>=total)) ? 'none' : '';
  }
  function updateSendingProgress(){ renderSending(function(){}, App.escapeHtml); }
  function setOverlay(v,text,percent){ var ov=$('overlay'),ot=$('overlayText'),op=$('overlayProgress'); ov.style.display=v?'':'none'; if(text!=null)ot.innerHTML=text; if(percent!=null)op.innerHTML=String(percent)+'%'; }
  function sendQueue(addLog, getClient){ var client=getClient(); if(!client){ addLog('Supabase未設定のため送信できません'); return; } var list=readQueue(); if(!list.length){ addLog('送信対象がありません'); return; } $('sendQueue').disabled=true; setOverlay(true,'送信中...',0); var total=list.length,done=0,ok=0,ng=0,kept=[]; function step(i){ if(i>=total){ setOverlay(false); $('sendQueue').disabled=false; writeQueue(kept); renderQueue(addLog, App.escapeHtml); addLog('送信完了: 成功 '+ok+' / 失敗 '+ng); return; } var it=list[i]; var pct=Math.floor((done*100)/total); setOverlay(true,'送信中... ('+(done+1)+'/'+total+')',pct); var name='NONE',price=null; 
      // 既存の最新行があれば quantity を加算、無ければ新規作成
      client.from('inventory').select('id,quantity').eq('jan', it.jan).order('created_at', {ascending:false}).limit(1)
        .then(function(res){ if(res&&res.error) throw res.error; var rows=res.data||[]; if(rows.length>0){ var row=rows[0]; var newQty=(parseInt(row.quantity,10)||0) + (parseInt(it.quantity,10)||0); if(newQty===0){ return client.from('inventory').delete().eq('id', row.id); } return client.from('inventory').update({quantity:newQty}).eq('id', row.id); } else { return client.from('inventory').insert({jan:it.jan,category:it.category,quantity:it.quantity,name:name,price:price}); } })
        .then(function(r2){ if(r2&&r2.error) throw r2.error; done++; ok++; step(i+1); })
        .catch(function(err){ done++; ng++; kept.push(it); addLog('失敗: '+(err&&err.message?err.message:err)); step(i+1); }); }
    step(0);
  }
  function startSending(addLog, escapeHtml, getClient){
    var client=getClient(); if(!client){ addLog('Supabase未設定のため送信できません'); return; }
    if(isSending){ addLog('送信中です'); return; }
    var existing=readJob();
    if(existing && existing.items && existing.items.length && (existing.idx||0) < existing.items.length){
      // resume existing job
      renderSending(addLog, escapeHtml);
      runSending(addLog, getClient);
      return;
    }
    var list=readQueue(); if(!list.length){ addLog('送信対象がありません'); return; }
    // snapshot and clear queue so new scans can be added concurrently
    var job={ items:[], idx:0, ok:0, ng:0, createdAt: new Date().toISOString() };
    for(var i=0;i<list.length;i++){ var it=list[i]; job.items.push({jan:it.jan, category:it.category, quantity:it.quantity, ts:it.ts, status:'pending'}); }
    writeJob(job);
    writeQueue([]);
    renderQueue(addLog, escapeHtml);
    renderSending(addLog, escapeHtml);
    runSending(addLog, getClient);
  }
  function runSending(addLog, getClient){
    if(isSending) return; isSending=true;
    var client=getClient(); if(!client){ isSending=false; return; }
    function step(){
      var job=readJob(); if(!job || !job.items || job.idx>=job.items.length){
        isSending=false; clearJob(); updateSendingProgress(); $('sendQueue').disabled=false; addLog('送信完了'); return;
      }
      var i=job.idx; var it=job.items[i];
      // persist alive heartbeat
      writeJob(job); updateSendingProgress();
      client.from('inventory').select('id,quantity').eq('jan', it.jan).order('created_at', {ascending:false}).limit(1)
        .then(function(res){ if(res&&res.error) throw res.error; var rows=res.data||[]; if(rows.length>0){ var row=rows[0]; var newQty=(parseInt(row.quantity,10)||0) + (parseInt(it.quantity,10)||0); if(newQty===0){ return client.from('inventory').delete().eq('id', row.id); } return client.from('inventory').update({quantity:newQty}).eq('id', row.id); } else { return client.from('inventory').insert({jan:it.jan,category:it.category,quantity:it.quantity,name:'NONE',price:null}); } })
        .then(function(r2){ if(r2&&r2.error) throw r2.error; var j=readJob(); if(!j){ isSending=false; return; } j.items[i].status='ok'; j.ok=(j.ok||0)+1; j.idx=i+1; writeJob(j); updateSendingProgress(); setTimeout(step, 0); })
        .catch(function(err){
          // Stop on network error; allow resume later
          try{ addLog('送信失敗: '+(err&&err.message?err.message:err)); }catch(_e){}
          isSending=false; var j2=readJob(); if(j2){ j2.items[i].status='pending'; writeJob(j2); updateSendingProgress(); }
          // If offline, wait for online event; otherwise show resume button
          var btn=$('resumeSending'); if(btn) btn.style.display='';
        });
    }
    $('sendQueue').disabled=true;
    step();
  }
  function init(categories, quantities, addLog, escapeHtml, getClient){
    renderCategories(categories);
    renderQuantities(quantities);
    renderQueue(addLog, escapeHtml);
    $('addToQueue').onclick=function(){ addToQueue(addLog, escapeHtml); };
    $('sendQueue').onclick=function(){ startSending(addLog, escapeHtml, getClient); };
    // グローバルでスキャナ/キーボード入力を捕捉（readonlyでも反映）
    document.addEventListener('keydown', function(e){
      var view=document.getElementById('view-register');
      if(!view || view.style.display==='none') return;
      var tgt=e.target || e.srcElement;
      if(tgt && (tgt.tagName==='INPUT' || tgt.tagName==='TEXTAREA' || (tgt.isContentEditable===true))){ if(!(tgt && tgt.id==='janInput')) return; }
      var el=$('janInput'); if(!el) return;
      var key=e.key || '';
      if(/^[0-9]$/.test(key)){
        el.value = (el.value||'') + key;
        if(e.preventDefault) e.preventDefault(); else e.returnValue=false;
        return;
      }
      if(key==='Backspace'){
        if((el.value||'').length>0){
          el.value = (el.value||'').slice(0,-1);
          if(e.preventDefault) e.preventDefault(); else e.returnValue=false;
          return;
        }
        return; // let default if empty
      }
      if(key==='Enter' || key==='Tab'){
        if((el.value||'').length>0){
          if(e.preventDefault) e.preventDefault(); else e.returnValue=false;
          addToQueue(addLog, escapeHtml);
          return;
        }
        // if JAN empty, allow normal Tab/Enter behavior
        return;
      }
    });
    // JAN入力をクリックしたら手入力モードに切り替え、離れたら戻す
    var ji=$('janInput');
    if(ji){
      ji.addEventListener('click', function(){
        setJanEditable(false);
        try{ ji.focus(); if(ji.setSelectionRange){ var l=(ji.value||'').length; ji.setSelectionRange(l,l);} }catch(_e){}
      });
      ji.addEventListener('blur', function(){ setJanEditable(false); });
      ji.addEventListener('keydown', function(e){
        var k=e.keyCode||e.which; var key=e.key||'';
        if(k===13 || key==='Enter' || k===9 || key==='Tab'){
          if(e.preventDefault) e.preventDefault(); else e.returnValue=false;
          addToQueue(addLog, escapeHtml);
          setJanEditable(false);
        }
      });
    }
    var qi=$('quantityInput'); if(qi&&qi.addEventListener){ qi.addEventListener('input',syncQtyHighlightFromInput); qi.addEventListener('keyup',syncQtyHighlightFromInput); qi.addEventListener('change',syncQtyHighlightFromInput);} 
    // resume events
    var btn=$('resumeSending'); if(btn){ btn.onclick=function(){ if(!isSending) runSending(addLog, getClient); }; }
    window.addEventListener('online', function(){ if(!isSending){ var job=readJob(); if(job && job.items && (job.idx||0) < job.items.length){ runSending(addLog, getClient); } } });
    // render sending section on load if exists
    renderSending(addLog, escapeHtml);
  }
  window.RegisterOnly={init:init};
})();


