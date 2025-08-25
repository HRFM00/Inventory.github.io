(function(){
  var PAGE_SIZE=10; var currentPage=1; var currentSearch=''; var liveTimer=null;
  function $(id){return document.getElementById(id);} 
  function buildQuery(client, keyword){ var q=client.from('inventory').select('*'); if(keyword){ var parts=['jan','name','category']; var ors=[]; for(var i=0;i<parts.length;i++){ ors.push(parts[i]+'.ilike.%'+keyword+'%'); } q=q.or(ors.join(',')); } return q; }
  function applySorts(q){
    var sc=$('sortCreated'), sg=$('sortCategory'), sq=$('sortQuantity');
    // category はフィルタ（完全一致）とし、順序は作成日時・個数のみで制御
    if(sg && sg.value && sg.value!=='none'){
      q=q.eq('category', sg.value);
    }
    var sorts=[];
    if(sc && sc.value && sc.value!=='none'){ sorts.push({field:'created_at', asc:(sc.value==='asc')}); }
    if(sq && sq.value && sq.value!=='none'){ sorts.push({field:'quantity', asc:(sq.value==='asc')}); }
    for(var i=0;i<sorts.length;i++){
      q=q.order(sorts[i].field,{ascending:sorts[i].asc});
    }
    if(sorts.length===0){ q=q.order('created_at',{ascending:false}); }
    return q;
  }
  function fetchPage(getClient, cb){ var client=getClient(); if(!client){ cb(new Error('未設定')); return;} var from=(currentPage-1)*PAGE_SIZE, to=from+PAGE_SIZE-1; var q=buildQuery(client,currentSearch); q=applySorts(q).range(from,to); q.then(function(res){ if(res&&res.error){ cb(res.error); return;} cb(null,res.data||[]); }).catch(function(e){ cb(e); }); }
  function renderTable(escapeHtml, rows){ var thead=$('browseThead'), tbody=$('browseTbody'); thead.innerHTML=''; tbody.innerHTML=''; var tr=document.createElement('tr'); tr.innerHTML='<th>JAN</th><th>カテゴリー</th><th>個数</th>'; thead.appendChild(tr); for(var i=0;i<rows.length;i++){ var r=rows[i]; var tr2=document.createElement('tr'); tr2.innerHTML='<td>'+escapeHtml(r.jan||'')+'</td><td>'+escapeHtml(r.category||'')+'</td><td>'+String(r.quantity||'')+'</td>'; tbody.appendChild(tr2);} $('pageInfo').innerHTML='ページ '+currentPage; }
  function applyFilter(addLog, escapeHtml, getClient){ currentPage=1; currentSearch=$('searchInput').value||''; fetchPage(getClient,function(err,data){ if(err){ addLog('取得失敗: '+(err.message||err)); return;} renderTable(escapeHtml,data); }); }
  function nextPage(addLog, escapeHtml, getClient){ currentPage+=1; fetchPage(getClient,function(err,data){ if(err){ addLog('取得失敗: '+(err.message||err)); currentPage-=1; return;} if(!data||!data.length){ currentPage-=1; return;} renderTable(escapeHtml,data); }); }
  function prevPage(addLog, escapeHtml, getClient){ if(currentPage<=1)return; currentPage-=1; fetchPage(getClient,function(err,data){ if(err){ addLog('取得失敗: '+(err.message||err)); currentPage+=1; return;} renderTable(escapeHtml,data); }); }
  function toCsvValue(v){ if(v==null)return ''; var s=String(v); if(/[",\n]/.test(s)){ s='"'+s.replace(/"/g,'""')+'"'; } return s; }
  function rowsToCsv(rows){ var cols=['jan','category','quantity']; var out=['JAN,カテゴリー,個数']; for(var i=0;i<rows.length;i++){ var r=rows[i]; var line=[]; for(var j=0;j<cols.length;j++){ line.push(toCsvValue(r[cols[j]])); } out.push(line.join(',')); } return out.join('\r\n'); }
  function exportAllCsv(addLog, getClient){ var client=getClient(); if(!client){ addLog('Supabase未設定'); return;} addLog('全件CSV出力を開始'); // 1,000件ずつ取得
    var all=[]; var page=0; var size=1000;
    function loop(){ var from=page*size, to=from+size-1; var q=buildQuery(client, $('searchInput').value||''); q=applySorts(q).range(from,to); q.then(function(res){ if(res&&res.error){ addLog('取得失敗: '+(res.error.message||res.error)); return; } var data=res.data||[]; for(var i=0;i<data.length;i++){ all.push(data[i]); }
        if(data.length<size){ // done
          var csv=rowsToCsv(all); var BOM='\uFEFF'; var blob=new Blob([BOM+csv],{type:'text/csv;charset=utf-8'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='inventory_export.csv'; document.body.appendChild(a); a.click(); setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); },0); addLog('CSV出力完了: '+all.length+'件');
        } else { page+=1; setTimeout(loop, 50); }
      }).catch(function(e){ addLog('取得失敗: '+(e.message||e)); }); }
    loop();
  }
  function init(addLog, escapeHtml, getClient){
    document.getElementById('applyFilter').onclick=function(){ applyFilter(addLog, escapeHtml, getClient); };
    document.getElementById('nextPage').onclick=function(){ nextPage(addLog, escapeHtml, getClient); };
    document.getElementById('prevPage').onclick=function(){ prevPage(addLog, escapeHtml, getClient); };
    document.getElementById('exportAllCsv').onclick=function(){ exportAllCsv(addLog, getClient); };
    // realtime filtering
    var si=document.getElementById('searchInput'); if(si){ si.addEventListener('input', function(){ if(liveTimer) clearTimeout(liveTimer); liveTimer=setTimeout(function(){ applyFilter(addLog, escapeHtml, getClient); }, 300); }); }
    var sc=document.getElementById('sortCreated'); if(sc){ sc.addEventListener('change', function(){ applyFilter(addLog, escapeHtml, getClient); }); }
    var sg=document.getElementById('sortCategory'); if(sg){ sg.addEventListener('change', function(){ applyFilter(addLog, escapeHtml, getClient); }); }
    var sq=document.getElementById('sortQuantity'); if(sq){ sq.addEventListener('change', function(){ applyFilter(addLog, escapeHtml, getClient); }); }
  }
  // wire on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){ if(window.App){
    // sortCategory を DEFAULT_CATEGORIES で埋める
    try{
      var catSel=document.getElementById('sortCategory');
      if(catSel && window.App.DEFAULT_CATEGORIES){
        for(var i=0;i<App.DEFAULT_CATEGORIES.length;i++){
          var opt=document.createElement('option');
          opt.value=String(App.DEFAULT_CATEGORIES[i]);
          opt.text=String(App.DEFAULT_CATEGORIES[i]);
          catSel.appendChild(opt);
        }
      }
    }catch(_e){}
    init(App.addLog, App.escapeHtml, (App.getClient||function(){ return null;}));
  }});
})();


