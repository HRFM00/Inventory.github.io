(function(){
  function $(id){return document.getElementById(id);} 
  function toIntSafe(s){
    var n=parseInt(String(s||'0').replace(/[^0-9\-]/g,''),10);
    if(isNaN(n))return 0; return n;
  }
  function sanitizeJan(s){ s=String(s||'').replace(/[^0-9]/g,''); if(s.length>32)s=s.substr(0,32); return s; }
  function setOverlay(v,text,percent){ var ov=$('overlay'),ot=$('overlayText'),op=$('overlayProgress'); if(!ov)return; ov.style.display=v?'':'none'; if(text!=null)ot.innerHTML=text; if(percent!=null)op.innerHTML=String(percent)+'%'; }
  function readFileAsTextWithEncoding(file, encoding, cb){
    var fr=new FileReader();
    fr.onload=function(){
      try{
        var buf=new Uint8Array(fr.result);
        var dec;
        if(encoding==='shift_jis'){
          if(typeof TextDecoder!=='undefined'){
            // TextDecoder may not support shift_jis in very old WebViews; fallback to readAsText
            try{ dec=new TextDecoder('shift_jis'); var s=dec.decode(buf); cb(null, s||''); return; }catch(e){}
          }
          // fallback
          var fr2=new FileReader(); fr2.onload=function(){ cb(null, fr2.result||''); }; fr2.onerror=function(e){ cb(e||new Error('read error')); }; fr2.readAsText(file, 'shift_jis');
        } else {
          // utf-8
          if(typeof TextDecoder!=='undefined'){
            try{ dec=new TextDecoder('utf-8'); var s2=dec.decode(buf); cb(null, s2||''); return; }catch(e){}
          }
          var fr3=new FileReader(); fr3.onload=function(){ cb(null, fr3.result||''); }; fr3.onerror=function(e){ cb(e||new Error('read error')); }; fr3.readAsText(file, 'utf-8');
        }
      }catch(ex){ cb(ex); }
    };
    fr.onerror=function(e){ cb(e||new Error('read error')); };
    fr.readAsArrayBuffer(file);
  }

  function parseCsvLine(line){
    var out=[], cur='', i=0, inQ=false; while(i<line.length){ var ch=line.charAt(i); if(inQ){ if(ch==='"'){ if(i+1<line.length && line.charAt(i+1)==='"'){ cur+='"'; i+=2; continue; } else { inQ=false; i++; continue; } } else { cur+=ch; i++; continue; } } else { if(ch==='"'){ inQ=true; i++; continue; } if(ch===','){ out.push(cur); cur=''; i++; continue; } cur+=ch; i++; } }
    out.push(cur); return out;
  }

  function stripBom(s){ if(s && s.charCodeAt(0)===0xFEFF){ return s.slice(1); } return s; }

  // CSV 解析: ヘッダー行から「商品コード」「変動数」「区分」を検出し、売上のみ集計
  function parseCsvAndAggregate(text){
    var lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    if(!lines.length) return { rows:[], totals:{} };
    var header=parseCsvLine(stripBom(lines[0]));
    var idxJan=-1, idxDelta=-1, idxKubun=-1; // 区分, 商品コード, 変動数
    // 1st pass: exact match (優先)
    for(var i=0;i<header.length;i++){
      var h=(header[i]||'').trim();
      if(idxJan<0 && h==='商品コード') idxJan=i;
      if(idxDelta<0 && h==='変動数') idxDelta=i;
      if(idxKubun<0 && h==='区分') idxKubun=i;
    }
    // 2nd pass: candidates and filtering（既に決まっていれば上書きしない）
    if(idxJan<0 || idxDelta<0 || idxKubun<0){
      var kubunCandidates=[];
      for(var j=0;j<header.length;j++){
        var hh=(header[j]||'').trim();
        if(idxJan<0 && hh.indexOf('商品コード')!==-1) idxJan=j;
        if(idxDelta<0 && hh.indexOf('変動数')!==-1) idxDelta=j;
        if(hh.indexOf('区分')!==-1) kubunCandidates.push({idx:j, label:hh});
      }
      if(idxKubun<0){
        // 完全一致の『区分』優先
        for(var k=0;k<kubunCandidates.length;k++){ if(kubunCandidates[k].label==='区分'){ idxKubun=kubunCandidates[k].idx; break; } }
      }
      if(idxKubun<0){
        // 『税区分』『○○区分』を除外。どうしても無ければ最短ラベルを採用
        var filtered=[]; for(var m=0;m<kubunCandidates.length;m++){ var lab=kubunCandidates[m].label; if(lab==='税区分') continue; if(lab.indexOf('税')!==-1) continue; filtered.push(kubunCandidates[m]); }
        var pickList = filtered.length? filtered : kubunCandidates;
        var best=null; for(var n=0;n<pickList.length;n++){ if(!best || pickList[n].label.length < best.label.length){ best=pickList[n]; } }
        if(best) idxKubun=best.idx;
      }
    }
    // ヘッダーが見つからなければ空を返す
    if(idxJan<0 || idxDelta<0 || idxKubun<0){
      return { rows:[], totals:{}, meta:{ idxJan:idxJan, idxDelta:idxDelta, idxKubun:idxKubun, header:header } };
    }
    var totals={};
    var debugSamples=[];
    for(var r=1;r<lines.length;r++){
      var line=lines[r];
      if(!line) continue;
      var cols=parseCsvLine(line);
      var jan=sanitizeJan(cols[idxJan]||'');
      var delta=toIntSafe(cols[idxDelta]||'0');
      var kubun=(cols[idxKubun]||'');
      if(!jan) continue;
      // 売上のみ対象。CSVでは売上行の変動数は負値。売れた数 = -変動数。
      if(String(kubun).indexOf('売上')===-1) continue;
      var sold=-delta; // deltaは負数想定
      if(sold<=0) continue;
      if(!totals[jan]) totals[jan]=0;
      totals[jan]+=sold;
      if(debugSamples.length<5){ debugSamples.push({jan:jan, delta:delta, kubun:kubun}); }
    }
    var rows=[]; for(var k in totals){ if(totals.hasOwnProperty(k)){ rows.push({jan:k, sold:totals[k]}); } }
    rows.sort(function(a,b){ if(a.jan<b.jan) return -1; if(a.jan>b.jan) return 1; return 0; });
    return { rows: rows, totals: totals, meta:{ idxJan:idxJan, idxDelta:idxDelta, idxKubun:idxKubun, header:header, samples:debugSamples } };
  }

  function fetchCurrentInventoryMap(getClient, jans, cb){
    var client=getClient(); if(!client){ cb(new Error('未設定')); return; }
    // JANごとに全件取得して合計（件数が多い場合は適宜RPC等に置き換え）
    var map={}; var i=0;
    function next(){ if(i>=jans.length){ cb(null,map); return; }
      var jan=jans[i];
      client.from('inventory').select('quantity').eq('jan', jan)
        .then(function(res){ if(res&&res.error){ throw res.error; }
          var data=res.data||[]; var sum=0; for(var t=0;t<data.length;t++){ sum+= (parseInt(data[t].quantity,10)||0); }
          map[jan]=sum; i++; setTimeout(next, 5);
        }).catch(function(e){ map[jans[i]]=0; i++; setTimeout(next, 5); });
    }
    next();
  }

  function fetchExistingJanMap(getClient, jans, cb){
    var client=getClient(); if(!client){ cb(new Error('未設定')); return; }
    // 重複除去
    var seen={}; var uniq=[]; for(var u=0; u<jans.length; u++){ var jv=jans[u]; if(!seen[jv]){ seen[jv]=true; uniq.push(jv); } }
    var map={}; var idx=0; var size=500; // chunk
    function next(){ if(idx>=jans.length){ cb(null,map); return; }
      var chunk=[]; var i=0; for(i=0;i<size && (idx+i)<uniq.length; i++){ chunk.push(uniq[idx+i]); }
      idx+=chunk.length;
      if(chunk.length===0){ try{ if(window.console&&console.warn){ console.warn('[在庫更新] 空チャンクをスキップ'); } }catch(_e){} if(idx>=uniq.length){ cb(null,map); } else { setTimeout(next, 0); } return; }
      client.from('inventory').select('jan').in('jan', chunk)
        .then(function(res){ if(res&&res.error){ throw res.error; }
          var data=res.data||[]; for(var t=0;t<data.length;t++){ map[data[t].jan]=true; }
          setTimeout(next, 5);
        }).catch(function(e){ // on error, skip this chunk but continue
          try{ if(window.console&&console.warn){ console.warn('[在庫更新] 存在チェック失敗 chunk size', chunk.length, e); } }catch(_e){}
          setTimeout(next, 5);
        });
    }
    next();
  }

  function renderPreview(escapeHtml, list, currentMap){
    var tbody=$('updateTbody'); if(!tbody)return; tbody.innerHTML='';
    for(var i=0;i<list.length;i++){
      var r=list[i]; var cur=currentMap[r.jan]||0; var after=cur - r.sold; if(after<0) after=0; // 0で止める
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+escapeHtml(r.jan)+'</td><td>'+String(r.sold)+'</td><td>'+String(cur)+'</td><td>'+String(after)+'</td>';
      tbody.appendChild(tr);
    }
  }

  function computeDiffOps(list, currentMap){
    // 在庫最終値を after へ合わせるための差分 = after - current
    var ops=[];
    for(var i=0;i<list.length;i++){
      var r=list[i]; var cur=currentMap[r.jan]||0; var after=cur - r.sold; if(after<0) after=0; var diff=after - cur; // 負なら減算、正なら増
      if(diff===0) continue;
      ops.push({jan:r.jan, diff:diff});
    }
    return ops;
  }

  function sendDiffs(addLog, getClient, diffs, onProgress, onDone){
    var client=getClient(); if(!client){ addLog('Supabase未設定'); onDone(new Error('未設定')); return; }
    if(!diffs.length){ onDone(null, {ok:0,ng:0}); return; }
    setOverlay(true,'送信中...',0);
    var i=0, ok=0, ng=0, total=diffs.length;
    function step(){ if(i>=total){ setOverlay(false); onDone(null,{ok:ok,ng:ng}); return; }
      var it=diffs[i]; var pct=Math.floor((i*100)/total); setOverlay(true,'送信中... ('+(i+1)+'/'+total+')',pct);
      // 直近の1行を更新（quantity += diff）。0になってもレコードは残す。
      client.from('inventory').select('id,quantity').eq('jan', it.jan).order('created_at', {ascending:false}).limit(1)
        .then(function(res){ if(res&&res.error) throw res.error; var rows=res.data||[]; if(!rows.length){ throw new Error('対象JANの在庫行が見つかりません: '+it.jan); }
          var row=rows[0]; var newQty=(parseInt(row.quantity,10)||0)+ (parseInt(it.diff,10)||0);
          return client.from('inventory').update({quantity:newQty}).eq('id', row.id);
        })
        .then(function(res2){ if(res2&&res2.error) throw res2.error; ok++; i++; setTimeout(step, 0); })
        .catch(function(e){ ng++; try{ if(window.console&&console.error){ console.error('[在庫更新] 更新失敗 op=', it, 'error=', e); } }catch(_ee){}
          addLog('失敗: '+(e&&e.message?e.message:e)); i++; setTimeout(step, 0);
        });
    }
    step();
  }

  function init(addLog, escapeHtml, getClient){
    var fileInput=$('updateCsvFile'), parseBtn=$('parseUpdateCsv'), info=$('updateInfo'), sendBtn=$('sendUpdate'), prog=$('sendUpdateProgress');
    var lastEl=$('lastUpdateAt');
    // show last update time
    try{ var last=localStorage.getItem('inventoryLastUpdatedAt'); if(lastEl){ lastEl.innerHTML= last? escapeHtml(last) : '--'; } }catch(_e){}
    var parsedRows=null; var currentMap=null; var diffs=null; var lastRows=null;
    if(parseBtn) parseBtn.onclick=function(){ var f=(fileInput&&fileInput.files&&fileInput.files[0])?fileInput.files[0]:null; if(!f){ addLog('CSVを選択してください'); return; }
      var encSel=document.getElementById('updateEncoding'); var enc=(encSel&&encSel.value)||'utf-8';
      info.innerHTML='解析中...';
      function handleParsed(ag, usedEnc){
        try{ if(window.console&&console.log){ console.log('[在庫更新] 解析encoding:', usedEnc); console.log('[在庫更新] header:', ag.meta && ag.meta.header); console.log('[在庫更新] idxJan/idxDelta/idxKubun:', ag.meta && ag.meta.idxJan, ag.meta && ag.meta.idxDelta, ag.meta && ag.meta.idxKubun); console.log('[在庫更新] 解析rows:', ag.rows); console.log('[在庫更新] 解析totals:', ag.totals); if(console.table) try{ console.table(ag.rows); }catch(_e){} } }catch(_err){}
        parsedRows=ag.rows; if(!parsedRows.length){ info.innerHTML='対象データなし'; $('updateTbody').innerHTML=''; sendBtn.disabled=true; return; }
        var jans=[]; for(var i=0;i<parsedRows.length;i++){ jans.push(parsedRows[i].jan); }
        // まずDBに存在するJANだけに絞る
        fetchExistingJanMap(getClient, jans, function(e1, existMap){ if(e1){ addLog('商品存在確認失敗: '+(e1.message||e1)); }
          var filtered=[]; for(var i2=0;i2<parsedRows.length;i2++){ var row=parsedRows[i2]; if(existMap && existMap[row.jan]) filtered.push(row); }
          try{ if(window.console&&console.log){ console.log('[在庫更新] inventory存在フィルタ: before', parsedRows.length, 'after', filtered.length); } }catch(_e){}
          if(!filtered.length){ info.innerHTML='対象データなし（DBに存在するJANがありません）'; $('updateTbody').innerHTML=''; sendBtn.disabled=true; return; }
          var jans2=[]; for(var j=0;j<filtered.length;j++){ jans2.push(filtered[j].jan); }
          fetchCurrentInventoryMap(getClient, jans2, function(e2, map2){ if(e2){ addLog('在庫取得失敗: '+(e2.message||e2)); info.innerHTML=''; return; }
            currentMap=map2; lastRows=filtered; renderPreview(escapeHtml, lastRows, currentMap); diffs=computeDiffOps(lastRows, currentMap);
            info.innerHTML='対象 '+String(filtered.length)+' 件'; sendBtn.disabled=(diffs.length===0);
          });
        });
      }
      readFileAsTextWithEncoding(f, enc, function(err, text){ if(err){ addLog('読込失敗'); info.innerHTML=''; return; }
        var ag=parseCsvAndAggregate(text);
        // ヘッダー未検出・行0 の場合は自動フォールバックで別エンコーディングも試す
        var needFallback=( (!ag.meta) || (ag.meta.idxJan<0 || ag.meta.idxDelta<0 || ag.meta.idxKubun<0 || (ag.rows && ag.rows.length===0)) );
        if(needFallback){ var alt=(enc==='utf-8'?'shift_jis':'utf-8'); try{ if(window.console&&console.warn){ console.warn('[在庫更新] フォールバック試行: '+alt); } }catch(_e){}
          readFileAsTextWithEncoding(f, alt, function(err2, text2){ if(err2){ handleParsed(ag, enc); return; }
            var ag2=parseCsvAndAggregate(text2); handleParsed(ag2, alt);
          });
        } else { handleParsed(ag, enc); }
      });
    };
    if(sendBtn) sendBtn.onclick=function(){ if(!diffs||!diffs.length){ addLog('送信対象なし'); return; }
      sendBtn.disabled=true; prog.innerHTML='送信中...';
      sendDiffs(addLog, getClient, diffs, function(p){ prog.innerHTML=String(p)+'%'; }, function(err, stat){ sendBtn.disabled=false; prog.innerHTML=''; if(err){ addLog('送信失敗'); return; } addLog('送信完了: 成功 '+stat.ok+' / 失敗 '+stat.ng);
        // 画面の結果に反映: 表示中の行の現在在庫を反映後在庫に更新し、売れた数を0にする
        try{
          if(lastRows && currentMap){
            for(var i=0;i<lastRows.length;i++){
              var r=lastRows[i];
              var cur=currentMap[r.jan]||0; var after=cur - r.sold; if(after<0) after=0;
              currentMap[r.jan]=after;
              r.sold=0;
            }
            renderPreview(App.escapeHtml, lastRows, currentMap);
          }
          var nowStr=new Date().toLocaleString();
          try{ localStorage.setItem('inventoryLastUpdatedAt', nowStr); }catch(_ee){}
          if(lastEl){ lastEl.innerHTML = nowStr; }
        }catch(_e){}
      });
    };
  }

  // wire on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){ if(window.App){ init(App.addLog, App.escapeHtml, (App.getClient||function(){ return null;})); }});
})();


