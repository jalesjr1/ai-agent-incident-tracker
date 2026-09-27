/* AI Agent Incident Tracker renderer. Reads window.DASH set by build. */
(function () {
  const D = window.DASH;
  if (!D) { document.body.innerHTML = '<h3>No data. Run scripts/build.py first.</h3>'; return; }
  const inc = D.incidents;

  // ---- stats ----
  document.getElementById('header-sub').textContent =
    'Last updated ' + D.metadata.lastUpdated + ' · Schema v' + D.metadata.schemaVersion +
    ' · source: Obsidian AI Research Vault / ' + D.metadata.sourceVault;
  document.getElementById('stat-incidents').textContent = inc.length;
  document.getElementById('stat-lag').textContent = D.stats.medianLagDays;
  const nw7 = Object.values(D.stats.newThisWeek).filter(Boolean).length;
  document.getElementById('stat-new7').textContent = nw7;

  // ---- tabs ----
  const TABS = [
    ['overview','Overview'], ['lag','Disclosure Lag'], ['camps','Camp Impact'],
    ['cost','Cost Asymmetry'], ['actors','Actor Type'], ['targets','Target Type'],
    ['severity','Severity'], ['cve','CVEs'], ['new','New This Week'], ['sources','Sources']
  ];
  const tabsEl = document.getElementById('tabs');
  const panelsEl = document.getElementById('panels');
  TABS.forEach(([k,label]) => {
    const b = document.createElement('button');
    b.className = 'tab-btn'; b.dataset.tab = k; b.textContent = label;
    if (k === 'overview') b.classList.add('active');
    tabsEl.appendChild(b);
  });
  TABS.forEach(([k]) => {
    const p = document.createElement('div');
    p.className = 'panel'; p.id = 'panel-' + k;
    if (k === 'overview') p.classList.add('active');
    panelsEl.appendChild(p);
  });
  const charts = {};
  function show(tab){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="'+tab+'"]').classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+tab).classList.add('active');
    const fns = {overview:renderOverview, lag:renderLag, camps:renderCamps, cost:renderCost,
                 actors:renderActors, targets:renderTargets, severity:renderSeverity,
                 cve:renderCve, new:renderNew, sources:renderSources};
    if (fns[tab] && !charts[tab]) { fns[tab](); charts[tab]=true; }
  }
  tabsEl.addEventListener('click', e => { if (e.target.classList.contains('tab-btn')) show(e.target.dataset.tab); });
  const mkCard = (title, tip) => {
    const c = document.createElement('div'); c.className='card';
    c.innerHTML = '<h3>'+title+'</h3><div class="chartbox"><canvas></canvas></div>' + (tip?'<div class="tip">'+tip+'</div>':'');
    return c;
  };
  const monthKey = d => d.slice(0,7);
  const months = [...new Set(inc.map(i=>monthKey(i.incidentDate)))].sort();

  // ---- 1 Overview ----
  function renderOverview(){
    const p = document.getElementById('panel-overview');
    // cumulative line
    const c1 = mkCard('Cumulative incidents by incident month','Line rises with the May→Sep acceleration in agent attacks.');
    p.appendChild(c1);
    const counts = months.map(m=>inc.filter(i=>monthKey(i.incidentDate)<=m).length);
    new Chart(c1.querySelector('canvas'), {
      type:'line',
      data:{ labels:months, datasets:[{ label:'Cumulative', data:counts, borderColor:'#4c9aff', backgroundColor:'rgba(76,154,255,.15)', fill:true, tension:.3 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{ beginAtZero:true, grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}}, x:{ ticks:{color:'#9aa0a6'}, grid:{display:false}, type:'category' } } }
    });
    // table of most recent incidents
    const t = document.createElement('div'); t.className='card';
    t.innerHTML = '<h3>Most recent incidents</h3><ul>' +
      [...inc].sort((a,b)=>b.disclosureDate.localeCompare(a.disclosureDate)).slice(0,8).map(i =>
        '<li><span class="pill sev-'+i.severity+'">'+i.severity+'</span><strong>'+i.summary.slice(0,90)+'…</strong><br><span class="src">'+i.incidentDate+' → disclosed '+i.disclosureDate+' · '+i.actorType+' → '+i.targetType+' · <a href="'+i.primarySource+'" target="_blank">source</a></span></li>'
      ).join('') + '</ul>';
    p.appendChild(t);
  }

  // ---- 2 Disclosure lag ----
  function renderLag(){
    const p = document.getElementById('panel-lag');
    const c = mkCard('Disclosure lag by incident (days between compromise and public disclosure)',
      'Pillars: how long each incident operated before the public knew. Note Medicare (green) and RubyGems. Median overlaid.');
    p.appendChild(c);
    const items=[...inc].sort((a,b)=>a.incidentDate.localeCompare(b.incidentDate));
    new Chart(c.querySelector('canvas'), {
      type:'bar',
      data:{ labels: items.map(i=>i.id.slice(0,18)), datasets:[{
        label:'lag days', data:items.map(i=>D.stats.lagDays[i.id]||0),
        backgroundColor: items.map(i=>(D.stats.lagDays[i.id]||0)>62?'#ff5252':'#4c9aff') }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false} },
        scales:{ x:{ beginAtZero:true, grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}}, y:{ ticks:{color:'#9aa0a6', font:{size:10}}, grid:{display:false} } } }
    });
  }

  // ---- 3 Camp impact ----
  function renderCamps(){
    const p = document.getElementById('panel-camps');
    const c = mkCard('Cumulative camp-impact score (signed) over time','Each incident adds signed impact (−2…+3) to a camp. Rising = evidence strengthening that camp’s position, falling = weakening. Six-camp taxonomy.');
    p.appendChild(c);
    const camps = Object.keys(inc[0].campImpact);
    const datasets = camps.map((camp,k)=>{
      const run=[]; let acc=0;
      months.forEach(m=>{ inc.filter(i=>monthKey(i.incidentDate)<=m).forEach(i=>acc+=i.campImpact[camp]||0); run.push(acc); });
      return { label:camp, data:run, borderColor:['#4c9aff','#ff5252','#81c784','#ffb74d','#d292ff','#4dd0e1'][k], fill:false, tension:.2 };
    });
    new Chart(c.querySelector('canvas'), {
      type:'line',
      data:{ labels:months, datasets },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8eaed',font:{size:10}}}},
        scales:{ y:{ grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}}, x:{ ticks:{color:'#9aa0a6'}, grid:{display:false} } } }
    });
  }

  // ---- 4 Cost asymmetry ----
  function renderCost(){
    const p = document.getElementById('panel-cost');
    const c = mkCard('Cost asymmetry: records exfiltrated vs attacker cost (log scale)',
      'The Gambit campaign (~600K cards for ~$18K ≈ $0.03/card) sits in the empty quadrant — a commodity attack at frontier-lab-adjacent scale. This is the 6th-camp signal.');
    p.appendChild(c);
    const pts = inc.filter(i=>i.recordsExfiltrated!=null && i.estimatedCostUsd!=null);
    new Chart(c.querySelector('canvas'), {
      type:'scatter',
      data:{ datasets:[{ data: pts.map(i=>({x:Math.max(i.estimatedCostUsd,0.01), y:i.recordsExfiltrated})), backgroundColor:'#ff5252', pointRadius:8,
        label: pts.map(i=>i.id).join(', ') }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},
        tooltip:{callbacks:{label:(ctx)=>{const i=pts[ctx.dataIndex];return i.id+' — $'+i.estimatedCostUsd+' → '+i.recordsExfiltrated+' records';}}}},
        scales:{ x:{ type:'logarithmic', title:{display:true,text:'attacker cost (USD)',color:'#9aa0a6'}, grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}},
                 y:{ type:'logarithmic', title:{display:true,text:'records exfiltrated',color:'#9aa0a6'}, grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}} } }
    });
    const note = document.createElement('div'); note.className='card';
    note.innerHTML = '<h3>Cost per record</h3><ul>'+ pts.map(i=>'<li><strong>'+i.id+'</strong> — '+i.recordsExfiltrated.toLocaleString()+' records / $'+i.estimatedCostUsd+' = <strong>$'+(i.estimatedCostUsd/i.recordsExfiltrated).toFixed(2)+' per record</strong></li>').join('')+'</ul>';
    p.appendChild(note);
  }

  // ---- 5 Actor type ----
  function renderActors(){
    const p = document.getElementById('panel-actors');
    const c = mkCard('Incidents by actor type, by month (stacked)','Frontier-lab-eval (frontier eval/red-team) vs commodity-attacker (OSS harness + paid API). The late-Sep jump in commodity/tooling is the 6th camp.');
    p.appendChild(c);
    const types=['frontier-lab-eval','frontier-lab-production','commercial-lab-distillation','vulnerability-researcher','commodity-attacker','unknown'];
    const datasets = types.map((t,k)=>({ label:t, data:months.map(m=>inc.filter(i=>monthKey(i.incidentDate)===m && i.actorType===t).length),
      backgroundColor:['#4c9aff','#81c784','#ffb74d','#d292ff','#ff5252','#9aa0a6'][k] }));
    new Chart(c.querySelector('canvas'), {
      type:'bar',
      data:{ labels:months, datasets },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8eaed',font:{size:10}}}},
        scales:{ x:{ stacked:true, ticks:{color:'#9aa0a6'}, grid:{display:false}}, y:{ stacked:true, beginAtZero:true, ticks:{color:'#9aa0a6'}, grid:{color:'#2a2e37'} } } }
    });
  }

  // ---- 6 Target type ----
  function renderTargets(){
    const p = document.getElementById('panel-targets');
    const c = mkCard('Incidents by target type','Govement targets (healthcare, federal) are a new slice — Medicare/AIHW/SEC/Commerce/Education made "government" the emerging target class.');
    p.appendChild(c);
    const tally={}; inc.forEach(i=>{ const t=i.targetType.split('-')[0]==='government'?'government':i.targetType; tally[t]=(tally[t]||0)+1; });
    const labels=Object.keys(tally);
    new Chart(c.querySelector('canvas'), {
      type:'pie',
      data:{ labels, datasets:[{ data:labels.map(l=>tally[l]),
        backgroundColor:['#4c9aff','#ff5252','#81c784','#ffb74d','#d292ff','#4dd0e1','#9aa0a6'] }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:'#e8eaed',font:{size:12}}}} }
    });
  }

  // ---- 7 Severity ----
  function renderSeverity(){
    const p = document.getElementById('panel-severity');
    const c = mkCard('Severity by incident month (stacked area)','Critical incidents (HF, Medicare, US-gov, Plugin4Shell, self-replication) cluster in Sep.');
    p.appendChild(c);
    const sevs=['critical','high','medium','low'];
    const datasets = sevs.map((s,k)=>({ label:s, data:months.map(m=>inc.filter(i=>monthKey(i.incidentDate)===m && i.severity===s).length),
      backgroundColor:['rgba(255,82,82,.75)','rgba(255,138,101,.75)','rgba(255,213,79,.75)','rgba(129,199,132,.75)'] }));
    new Chart(c.querySelector('canvas'), {
      type:'line',
      data:{ labels:months, datasets: datasets.map(d=>({...d,fill:'-1',borderColor:d.backgroundColor,pointRadius:0})) },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8eaed',font:{size:11}}}},
        scales:{ y:{ beginAtZero:true, stacked:true, ticks:{color:'#9aa0a6'}, grid:{color:'#2a2e37'}}, x:{ stacked:true, ticks:{color:'#9aa0a6'}, grid:{display:false} } } }
    });
  }

  // ---- 8 CVEs ----
  function renderCve(){
    const p = document.getElementById('panel-cve');
    const cves = inc.flatMap(i=>i.cveIds.map(c=>({cve:c,id:i.id})));
    const c = mkCard('CVE landscape ('+cves.length+' CVEs)','CVEs are sparse because most agent incidents are not assigned CVEs — a finding in itself. Track Plugin4Shell / CVE-2026-2256 cluster as it grows.');
    p.appendChild(c);
    if(cves.length===0){ c.querySelector('.chartbox').innerHTML='<p style="color:#9aa0a6">No CVEs yet. Most incidents in this space are disclosed as blog posts, not CVEs — CA note in the research.</p>'; return; }
    new Chart(c.querySelector('canvas'), {
      type:'bar', data:{ labels:cves.map(x=>x.cve), datasets:[{label:'CVEs',data:cves.map(()=>1),backgroundColor:'#d292ff'}] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{legend:{display:false}},
        scales:{ x:{beginAtZero:true,grid:{color:'#2a2e37'},ticks:{color:'#9aa0a6'}},y:{ticks:{color:'#9aa0a6'},grid:{display:false}}} }
    });
  }

  // ---- 9 New this week ----
  function renderNew(){
    const p = document.getElementById('panel-new');
    const recent = [...inc].filter(i=>D.stats.isNewThisWeek[i.id]).sort((a,b)=>b.disclosureDate.localeCompare(a.disclosureDate));
    const t = document.createElement('div'); t.className='card';
    t.innerHTML = '<h3>Disclosed in the last 7 days</h3>' + (recent.length?
      '<ul>'+recent.map(i=>'<li><span class="pill sev-'+i.severity+'">'+i.severity+'</span><strong>'+i.id+'</strong> — '+i.summary+'<br><span class="src">disclosed '+i.disclosureDate+' · incident '+i.incidentDate+' · <a href="'+i.primarySource+'" target="_blank">source</a></span></li>').join('')+'</ul>'
      : '<p style="color:#9aa0a6">No incidents disclosed in the last 7 days.</p>');
    p.appendChild(t);
  }

  // ---- 10 Sources ----
  function renderSources(){
    const p = document.getElementById('panel-sources');
    const t = document.createElement('div'); t.className='card';
    const urls=[...new Set(inc.map(i=>i.primarySource))];
    t.innerHTML = '<h3>Primary sources ('+urls.length+')</h3><ul>'+urls.map(u=>'<li><a href="'+u+'" target="_blank">'+u+'</a></li>').join('')+'</ul>';
    p.appendChild(t);
  }

  show('overview');
})();