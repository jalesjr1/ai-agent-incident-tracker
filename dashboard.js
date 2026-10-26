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
  // Glossary lives at the END so it doesn't break the visual flow of the analytics.
  const TABS = [
    ['overview','Overview'], ['lag','Disclosure Lag'], ['responsibility','Responsibility'],
    ['camps','Camp Impact'], ['cost','Cost Asymmetry'], ['actors','Actor Type'],
    ['targets','Target Type'], ['severity','Severity'], ['cve','CVEs'],
    ['new','New This Week'], ['sources','Sources'], ['glossary','Glossary']
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
    const fns = {overview:renderOverview, lag:renderLag, responsibility:renderResponsibility,
                 camps:renderCamps, cost:renderCost, actors:renderActors, targets:renderTargets,
                 severity:renderSeverity, cve:renderCve, new:renderNew, sources:renderSources,
                 glossary:renderGlossary};
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

  // Reusable one-liner definitions for inline tips (also defined in Glossary tab).
  const TERMS = {
    camp: '<strong>Camp</strong>: a viewpoint group with a position on AI risk. Six camps tracked — see Glossary.',
    actor: '<strong>Actor</strong>: who committed the incident (perpetrator). Distinct from "discoverer."',
    actorType: '<strong>Actor type</strong>: categorical role of the actor — eval, red-team, commodity attacker, etc.',
    severity: '<strong>Severity</strong>: critical = data/system compromise; high = security boundary crossed; medium = unauthorized access; low = probe or attempt.',
    disclosureLag: '<strong>Disclosure lag</strong>: days between compromise and public disclosure.',
    targetType: '<strong>Target type</strong>: what got hit — government portal, internal system, consumer platform, etc.',
    campImpact: '<strong>Camp impact</strong>: signed score (−2…+3) per incident — how much this evidence strengthens (+) or weakens (−) each camp.',
    primarySource: '<strong>Primary source</strong>: the canonical URL where the incident was first disclosed.',
    responsibility: '<strong>Responsibility</strong>: who committed the incident. Researchers who reported it are excluded by design.',
  };

  // ---- 1 Overview ----
  function renderOverview(){
    const p = document.getElementById('panel-overview');
    const c1 = mkCard('Cumulative incidents by incident month',
      TERMS.camp + ' Line rises with the May→Sep acceleration in agent attacks.');
    p.appendChild(c1);
    const counts = months.map(m=>inc.filter(i=>monthKey(i.incidentDate)<=m).length);
    new Chart(c1.querySelector('canvas'), {
      type:'line',
      data:{ labels:months, datasets:[{ label:'Cumulative', data:counts, borderColor:'#4c9aff', backgroundColor:'rgba(76,154,255,.15)', fill:true, tension:.3 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{ beginAtZero:true, grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6'}}, x:{ ticks:{color:'#9aa0a6'}, grid:{display:false}, type:'category' } } }
    });
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
      TERMS.disclosureLag + ' Pillars: how long each incident operated before the public knew. Median overlaid.');
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

  // ---- 3 Responsibility (NEW: who is responsible) ----
  function renderResponsibility(){
    const p = document.getElementById('panel-responsibility');
    const totals = D.stats.responsibility.totals;
    const excluded = D.stats.responsibility.excludedResearchers;
    const labels = Object.keys(totals);
    const values = labels.map(l => totals[l]);

    // Horizontal bar chart — readable when one party dominates (OpenAI = 20 of 29).
    const c = mkCard('Incidents by responsible party (perpetrator)',
      TERMS.responsibility + ' Bars sum to perpetrators only; ' + excluded + ' researcher-discovered incidents are excluded.');
    p.appendChild(c);
    const palette = ['#4c9aff','#ff5252','#81c784','#ffb74d','#d292ff','#4dd0e1','#9aa0a6','#f48fb1','#a1887f'];
    new Chart(c.querySelector('canvas'), {
      type:'bar',
      data:{ labels: labels.map(l => l + ' ('+totals[l]+')'), datasets:[{ label:'incidents', data:values,
        backgroundColor: labels.map((_,k)=>palette[k%palette.length]) }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>ctx.parsed.x+' incidents'}} },
        scales:{ beginAtZero:true, x:{ grid:{color:'#2a2e37'}, ticks:{color:'#9aa0a6', stepSize:1}}, y:{ ticks:{color:'#9aa0a6'}, grid:{display:false} } } }
    });

    // Stacked-by-month line so you can see whether responsibility is concentrating or diversifying over time.
    const monthsSet = months;
    const datasets = labels.map((l, k) => ({
      label: l,
      data: monthsSet.map(m => inc.filter(i => monthKey(i.incidentDate) === m && responsibleOf(i) === l).length),
      backgroundColor: palette[k % palette.length],
      borderColor: palette[k % palette.length],
      fill: false, tension: .2, pointRadius: 3,
    }));
    const c2 = mkCard('Responsible parties over time (by incident month)',
      TERMS.actor + ' Stacked view shows whether responsibility is concentrating on one lab or diversifying.');
    p.appendChild(c2);
    new Chart(c2.querySelector('canvas'), {
      type:'bar',
      data:{ labels: monthsSet, datasets },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#e8eaed',font:{size:10}}}},
        scales:{ x:{ stacked:true, ticks:{color:'#9aa0a6'}, grid:{display:false}}, y:{ stacked:true, beginAtZero:true, ticks:{color:'#9aa0a6', stepSize:1}, grid:{color:'#2a2e37'} } } }
    });

    // Detail table — which incidents each party is responsible for.
    const detail = document.createElement('div'); detail.className = 'card';
    detail.innerHTML = '<h3>By party — incident IDs</h3><ul>' +
      labels.map(l => '<li><strong>'+l+'</strong> ('+totals[l]+'): ' +
        inc.filter(i => responsibleOf(i) === l).map(i => '<a href="'+i.primarySource+'" target="_blank">'+i.id+'</a>').join(', ') +
        '</li>').join('') +
      '<li><strong>Excluded — researchers</strong> ('+excluded+'): ' +
        inc.filter(i => responsibleOf(i) === null).map(i => i.id).join(', ') +
        '</li>' + '</ul>';
    p.appendChild(detail);
  }

  // Mirror the build.py classifier so the time-series chart agrees with the totals.
  function responsibleOf(i){
    const a = i.actor.toLowerCase();
    const t = i.actorType;
    if (t === 'vulnerability-researcher') return null;
    if (a.indexOf('openai') >= 0) return 'OpenAI';
    if (a.indexOf('moonshot') >= 0 || a.indexOf('kimi') >= 0) return 'Moonshot AI';
    if (a.indexOf('anthropic') >= 0) return 'Anthropic';
    if (a.indexOf('google') >= 0 || a.indexOf('gemini') >= 0) return 'Google';
    if (a.indexOf('microsoft') >= 0 || a.indexOf('copilot') >= 0 || a.indexOf('mai-code') >= 0) return 'Microsoft';
    if (a.indexOf('hugging') >= 0) return 'Hugging Face';
    if (a.indexOf('aws') >= 0 || a.indexOf('amazon') >= 0 || a.indexOf('bedrock') >= 0) return 'AWS/Amazon';
    if (a.indexOf('fireworks') >= 0) return 'Fireworks AI';
    if (a.indexOf('manus') >= 0) return 'Manus';
    if (a.indexOf('storm-0940') >= 0 || t === 'state-aligned-attacker') return 'State-aligned (Storm-0940)';
    if (a.indexOf('criminal') >= 0 || t === 'commodity-attacker' || t === 'unknown-attacker') return 'Criminal / commodity attacker';
    if (a.indexOf('unattributed') >= 0 || a.indexOf('unknown') >= 0) return 'Unattributed';
    if (a.indexOf('production-coding') >= 0 || t === 'production-agent-deployment') return 'Unattributed production agent';
    return null;
  }

  // ---- 4 Camp impact ----
  function renderCamps(){
    const p = document.getElementById('panel-camps');
    const c = mkCard('Cumulative camp-impact score (signed) over time',
      TERMS.camp + ' Each incident adds signed impact (−2…+3) to a camp. Rising = evidence strengthening that camp\'s position, falling = weakening. Six-camp taxonomy.');
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

  // ---- 5 Cost asymmetry ----
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

  // ---- 6 Actor type ----
  function renderActors(){
    const p = document.getElementById('panel-actors');
    const c = mkCard('Incidents by actor type, by month (stacked)',
      TERMS.actorType + ' Frontier-lab-eval (frontier eval/red-team) vs commodity-attacker (OSS harness + paid API). The late-Sep jump in commodity/tooling is the 6th camp.');
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

  // ---- 7 Target type ----
  function renderTargets(){
    const p = document.getElementById('panel-targets');
    const c = mkCard('Incidents by target type',
      TERMS.targetType + ' Government targets (healthcare, federal) are a new slice — Medicare/AIHW/SEC/Commerce/Education made "government" the emerging target class.');
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

  // ---- 8 Severity ----
  function renderSeverity(){
    const p = document.getElementById('panel-severity');
    const c = mkCard('Severity by incident month (stacked area)',
      TERMS.severity + ' Critical incidents (HF, Medicare, US-gov, Plugin4Shell, self-replication) cluster in Sep.');
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

  // ---- 9 CVEs ----
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

  // ---- 10 New this week (BUGFIX: was D.stats.isNewThisWeek — script writes newThisWeek) ----
  function renderNew(){
    const p = document.getElementById('panel-new');
    const recent = [...inc].filter(i=>D.stats.newThisWeek[i.id]).sort((a,b)=>b.disclosureDate.localeCompare(a.disclosureDate));
    const t = document.createElement('div'); t.className='card';
    t.innerHTML = '<h3>Disclosed in the last 7 days</h3>' + (recent.length?
      '<ul>'+recent.map(i=>'<li><span class="pill sev-'+i.severity+'">'+i.severity+'</span><strong>'+i.id+'</strong> — '+i.summary+'<br><span class="src">disclosed '+i.disclosureDate+' · incident '+i.incidentDate+' · <a href="'+i.primarySource+'" target="_blank">source</a></span></li>').join('')+'</ul>'
      : '<p style="color:#9aa0a6">No incidents disclosed in the last 7 days.</p>');
    p.appendChild(t);
  }

  // ---- 11 Sources ----
  function renderSources(){
    const p = document.getElementById('panel-sources');
    const t = document.createElement('div'); t.className='card';
    const urls=[...new Set(inc.map(i=>i.primarySource))];
    t.innerHTML = '<h3>Primary sources ('+urls.length+')</h3><ul>'+urls.map(u=>'<li><a href="'+u+'" target="_blank">'+u+'</a></li>').join('')+'</ul>';
    p.appendChild(t);
  }

  // ---- 12 Glossary (NEW) ----
  function renderGlossary(){
    const p = document.getElementById('panel-glossary');

    // Schema-level fields
    const fields = document.createElement('div'); fields.className = 'card';
    fields.innerHTML = `
      <h3>Schema fields — what each column means</h3>
      <ul>
        <li><strong>incidentDate</strong> — the date the compromise or unauthorized action actually happened (not when it was discovered).</li>
        <li><strong>disclosureDate</strong> — the date the incident became public (via a primary source).</li>
        <li><strong>actor</strong> — who committed the incident (perpetrator). Examples: <code>openai-swarm</code>, <code>moonshot-ai</code>, <code>criminal-operator-oss-harnesses</code>.</li>
        <li><strong>actorType</strong> — categorical role of the actor. See vocabulary below.</li>
        <li><strong>target</strong> — what got hit. Free-text label of the victim system, dataset, or org.</li>
        <li><strong>targetType</strong> — categorical classification of the target.</li>
        <li><strong>discoveredBy</strong> — who first noticed/reported. Often a security researcher, often different from the actor.</li>
        <li><strong>primarySource</strong> — the canonical URL where the incident was first disclosed (blog post, advisory, paper, etc.).</li>
        <li><strong>campImpact</strong> — signed score per camp (-2 to +3). How much this incident strengthens (+) or weakens (-) each camp's position.</li>
        <li><strong>method</strong> — short tag describing how the incident happened (e.g. <code>package-registry-upload</code>, <code>indirect-prompt-injection</code>).</li>
        <li><strong>severity</strong> — critical / high / medium / low (see vocabulary).</li>
        <li><strong>cveIds</strong> — list of CVE identifiers assigned, if any. Most agent incidents do not have CVEs.</li>
        <li><strong>recordsExfiltrated</strong> — number of records taken, when known.</li>
        <li><strong>estimatedCostUsd</strong> — attacker's cost in USD, when known (drives the cost-asymmetry scatter).</li>
        <li><strong>tags</strong> — free-form topic tags.</li>
        <li><strong>countryTargets</strong> — ISO country codes of victim countries, or <code>"global"</code>.</li>
        <li><strong>evidencePublicDataset</strong> — whether the underlying evidence is in a public dataset researchers can re-examine.</li>
        <li><strong>notes</strong> — free-text curator commentary.</li>
      </ul>`;
    p.appendChild(fields);

    // Actor type vocabulary
    const actors = document.createElement('div'); actors.className = 'card';
    actors.innerHTML = `
      <h3>Actor type vocabulary</h3>
      <ul>
        <li><strong>frontier-lab-eval</strong> — agent run as part of a frontier lab's evaluation or red-team. Includes internal eval and training-task incidents. The OpenAI alignment disclosures fall here.</li>
        <li><strong>frontier-lab-internal-redteam</strong> — frontier lab's own red team (a subset of eval; deliberately attacking their product).</li>
        <li><strong>frontier-lab-production</strong> — agent in a real customer-facing deployment from a frontier lab.</li>
        <li><strong>frontier-lab-internal-deployment</strong> — agent deployed internally at a frontier lab (helping researchers, etc.).</li>
        <li><strong>commercial-lab-distillation</strong> — non-frontier commercial lab running distillation or fine-tuning work.</li>
        <li><strong>vulnerability-researcher</strong> — external researcher (academic, vendor, independent) who found and disclosed. Not the perpetrator — excluded from the Responsibility chart.</li>
        <li><strong>commodity-attacker</strong> — criminal using off-the-shelf OSS agent harnesses + paid LLM APIs. The "6th-camp" threat actor.</li>
        <li><strong>unknown-attacker</strong> — perpetrator not yet identified.</li>
        <li><strong>production-agent-deployment</strong> — agent deployed by an end user/org (not a lab). Identity often undisclosed.</li>
      </ul>`;
    p.appendChild(actors);

    // Severity vocabulary
    const sev = document.createElement('div'); sev.className = 'card';
    sev.innerHTML = `
      <h3>Severity vocabulary</h3>
      <ul>
        <li><strong>critical</strong> — data exfiltration, unauthorized writes to live systems, persistent unauthorized access, or compromise of sensitive infrastructure. Examples: Hugging Face (token + weights), Medicare (read+write), 147,451-row internal-tables incident.</li>
        <li><strong>high</strong> — security boundary crossed, unauthorized access to non-public data, code execution in a sandbox, or successful prompt-injection with material impact.</li>
        <li><strong>medium</strong> — unauthorized access to public-but-protected data, sandbox-escape attempts that succeeded, or policy violations with limited blast radius.</li>
        <li><strong>low</strong> — probes, failed attempts, or boundary testing that did not produce material impact.</li>
      </ul>`;
    p.appendChild(sev);

    // Six-camp taxonomy — the bit you asked about
    const camps = document.createElement('div'); camps.className = 'card';
    camps.innerHTML = `
      <h3>The "six camps" — what a camp is, and which is which</h3>
      <p style="color:#9aa0a6; font-size:13px; margin-bottom:10px;">
        A <strong>camp</strong> is a viewpoint group with a distinct position on AI risk.
        Each incident gets a signed score against every camp: does this evidence
        strengthen or weaken that camp's argument? The score is curator-assigned,
        not algorithmic. The six are the taxonomy adopted for this tracker.
      </p>
      <ul>
        <li><strong style="color:#4c9aff">camp-1-existential</strong> — favors hard limits: ban / moratorium / kill-switches. Evidence for this camp = incidents that look like uncontrolled, broad, hard-to-stop agent behavior.</li>
        <li><strong style="color:#ff5252">camp-2-loss-of-control</strong> — bounded near-term loss-of-control scenarios (Cotra, Amodei, Hobbhahn). Evidence for this camp = agent persists at a goal after being told to stop, modifies its environment to stay alive, etc.</li>
        <li><strong style="color:#81c784">camp-3-engineer-skeptic</strong> — Mitchell / McGraw school: agents are sandbox + reward hacking, not agency. Evidence <em>against</em> this camp = incidents showing agentic behavior, not just prompt tricks.</li>
        <li><strong style="color:#ffb74d">camp-4-move-fast</strong> — regulation is theater, defensive AI is the real answer. Evidence against this camp = incidents that defeat existing defensive measures.</li>
        <li><strong style="color:#d292ff">camp-5-eval-artifact</strong> — these incidents are benchmark-design artifacts, not real-world failures. Evidence against this camp = incidents that affect real users in production.</li>
        <li><strong style="color:#4dd0e1">camp-6-commodity-attacker</strong> — the new camp: OSS agent harness + paid LLM API gives commodity attackers frontier capability. Evidence for this camp = attacks like Gambit at &lt;$0.05 per record.</li>
      </ul>`;
    p.appendChild(camps);

    // Disclosure-lag framing
    const lag = document.createElement('div'); lag.className = 'card';
    lag.innerHTML = `
      <h3>Why disclosure lag matters</h3>
      <p style="color:#9aa0a6; font-size:13px; line-height:1.5;">
        The gap between when an incident happened and when it became public is
        itself a signal. Short lag = caught fast (often by defenders).
        Long lag = either nobody noticed for months (worse) or the organization
        sat on it (different problem). The current median is
        <strong>${D.stats.medianLagDays} days</strong>, which is dominated by
        the Hugging Face retrospective-review cases (Aug→Oct 2026 disclosures
        for incidents from earlier in the year). Median is more meaningful than
        mean here because the right tail is heavy.
      </p>`;
    p.appendChild(lag);
  }

  show('overview');
})();