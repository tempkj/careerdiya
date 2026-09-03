/* Career Diya native Career Library renderer / adapter. */
(function(){
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const arr = (value) => Array.isArray(value) ? value : [];
  const text = (value, fallback='') => value === undefined || value === null || value === '' ? fallback : String(value);
  const initials = (name='') => name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

  const COUNTRY_OPTIONS = [
    ['India','IN','INR','₹'], ['United States','US','USD','$'], ['Canada','CA','CAD','$'], ['United Kingdom','GB','GBP','£'],
    ['Australia','AU','AUD','$'], ['Germany','DE','EUR','€'], ['France','FR','EUR','€'], ['United Arab Emirates','AE','AED','د.إ'],
    ['Japan','JP','JPY','¥'], ['Singapore','SG','SGD','$'], ['China','CN','CNY','¥'], ['Brazil','BR','BRL','R$'],
    ['South Africa','ZA','ZAR','R'], ['Russia','RU','RUB','₽'], ['Italy','IT','EUR','€'], ['Spain','ES','EUR','€'],
    ['Netherlands','NL','EUR','€'], ['Sweden','SE','SEK','kr'], ['Switzerland','CH','CHF','CHF'], ['New Zealand','NZ','NZD','$'],
    ['Mexico','MX','MXN','$'], ['Indonesia','ID','IDR','Rp'], ['Saudi Arabia','SA','SAR','﷼'], ['Turkey','TR','TRY','₺'],
    ['South Korea','KR','KRW','₩'], ['Thailand','TH','THB','฿'], ['Malaysia','MY','MYR','RM'], ['Vietnam','VN','VND','₫'],
    ['Philippines','PH','PHP','₱'], ['Egypt','EG','EGP','E£'], ['Nigeria','NG','NGN','₦'], ['Kenya','KE','KES','KSh'],
    ['Argentina','AR','ARS','$'], ['Poland','PL','PLN','zł'], ['Ireland','IE','EUR','€'], ['North Macedonia','MK','MKD','ден'],
    ['Sri Lanka','LK','LKR','Rs'], ['Zimbabwe','ZW','ZWL','Z$'], ['Qatar','QA','QAR','﷼'], ['Uganda','UG','UGX','USh'],
    ['Panama','PA','PAB','B/.']
  ];
  const LANGUAGE_OPTIONS = ['English','Hindi','Marathi','Punjabi','Spanish','French','German','Bengali','Tamil','Telugu','Macedonian','Arabic','Sinhala','Manipuri'];
  const COUNTRY_META = Object.fromEntries(COUNTRY_OPTIONS.map(([name,code,currency,symbol])=>[name,{code,currency,symbol}]));
  const COUNTRY_ALIASES = Object.fromEntries(COUNTRY_OPTIONS.flatMap(([name,code])=>[[code,name],[name.toUpperCase(),name]]));

  function normalizeCountry(value='India'){
    const raw = String(value || 'India').trim();
    return COUNTRY_ALIASES[raw.toUpperCase()] || raw;
  }

  function sectionCard(label, title, content, extra=''){
    return `<section class="career-detail-card ${extra}"><div class="tag">${esc(label)}</div><h2>${esc(title)}</h2>${content}</section>`;
  }

  function list(items, cls='career-bullet-list'){
    return `<ul class="${cls}">${arr(items).map(x=>`<li>${esc(typeof x==='string' ? x : x?.title || '')}</li>`).join('')}</ul>`;
  }

  function optionAccordion(items){
    return arr(items).map(item=>`
      <details class="career-option">
        <summary><span>${esc(item?.title || '')}</span><span class="career-option-chevron">⌄</span></summary>
        <div><p>${esc(item?.description || '')}</p></div>
      </details>`).join('');
  }

  function pathwayMarkup(path, idx){
    return `<div class="career-pathway"><div class="career-pathway-head"><span>${idx+1}</span><h3>${esc(path?.name || '')}</h3></div><div class="career-pathway-steps">${arr(path?.steps).map(step=>`<div class="career-path-step"><span>›</span><div><h4>${esc(step?.title || '')}</h4><p>${esc(step?.description || '')}</p></div></div>`).join('')}</div></div>`;
  }

  function normalizeSalary(value, currency){
    const raw = text(value, '');
    if(!raw) return '—';
    const meta = Object.values(COUNTRY_META).find(x=>x.currency===currency);
    const symbol = meta?.symbol || ({ INR:'₹', USD:'$', GBP:'£', EUR:'€', AED:'د.إ' }[currency] || '');
    if(!symbol) return raw;
    const trimmed = raw.trim();
    if(trimmed.startsWith(symbol)) return trimmed;
    if(/^[?]\s*\d/.test(trimmed)) return trimmed.replace(/^\?\s*/, symbol);
    if(/^(INR|USD|GBP|EUR|AED|CAD|AUD|JPY|CNY|SGD|ZAR|RUB|SEK|CHF|NZD|MXN|IDR|SAR|TRY|KRW|THB|MYR|VND|PHP|EGP|NGN|KES|ARS|PLN|MKD|LKR|QAR|UGX|PAB|BRL)\s*[-+]?\d/i.test(trimmed)) return trimmed.replace(/^(INR|USD|GBP|EUR|AED|CAD|AUD|JPY|CNY|SGD|ZAR|RUB|SEK|CHF|NZD|MXN|IDR|SAR|TRY|KRW|THB|MYR|VND|PHP|EGP|NGN|KES|ARS|PLN|MKD|LKR|QAR|UGX|PAB|BRL)\s*/i, symbol);
    if(/^[-+]?\d/.test(trimmed)) return symbol + trimmed;
    return trimmed;
  }

  function metric(label, value, sub=''){
    return `<div class="career-metric"><small>${esc(label)}</small><strong>${esc(value || '—')}</strong>${sub?`<span>${esc(sub)}</span>`:''}</div>`;
  }

  function marketSnapshot(salary, marketCurrency, stats){
    const entry = normalizeSalary(salary.entry, marketCurrency);
    const senior = normalizeSalary(salary.senior, marketCurrency);
    const growth = text(stats.jobGrowth,'');
    const demand = text(stats.demandLevel,'Not specified');
    return `<div class="career-market-visual" aria-label="Market snapshot">
      <div class="career-market-track-wrap">
        <div class="career-market-track"><span class="career-market-dot career-market-dot-start"></span><span class="career-market-fill"></span><span class="career-market-dot career-market-dot-end"></span><span class="career-growth-badge">${esc(demand === 'High' ? 'High Growth 🚀' : (growth ? growth : 'Market outlook'))}</span></div>
      </div>
      <div class="career-market-range"><div><small>Entry level</small><strong>${esc(entry)}</strong></div><div class="career-market-senior"><small>Senior level</small><strong>${esc(senior)}</strong></div></div>
      <div class="career-market-note">*Estimated annual compensation (${esc(marketCurrency || 'local currency')})</div>
    </div>`;
  }

  function ensureVideoModal(){
    if(document.getElementById('careerVideoModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="careerVideoModal" class="career-video-modal" aria-hidden="true"><div class="career-video-dialog" role="dialog" aria-modal="true" aria-label="Career video"><button type="button" class="career-video-close" id="careerVideoClose" aria-label="Close video">×</button><div class="career-video-frame-wrap"><iframe id="careerVideoFrame" title="Career video" src="" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><video id="careerVideoPlayer" class="career-video-player" controls playsinline hidden></video></div></div></div>`);
    const modal=document.getElementById('careerVideoModal');
    const close=()=>{ const frame=document.getElementById('careerVideoFrame'); const video=document.getElementById('careerVideoPlayer'); frame.src=''; frame.hidden=false; video.pause(); video.removeAttribute('src'); video.hidden=true; modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); };
    document.getElementById('careerVideoClose').addEventListener('click',close);
    modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && modal.classList.contains('is-open')) close(); });
  }

  async function playCareerVideo({careerName,country,language,type}){
    ensureVideoModal();
    const cfg = window.CAREER_DIYA_SUPABASE || {};
    if(!cfg.url || !cfg.anonKey) throw new Error('Supabase configuration is missing.');
    const endpoint = cfg.url.replace(/\/$/,'') + '/functions/v1/career-library-video';
    const res = await fetch(endpoint, {method:'POST',headers:{'apikey':cfg.anonKey,'Authorization':'Bearer '+cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({careerName,country,language,type})});
    const payload = await res.json().catch(()=>({}));
    if(!res.ok || !payload?.url) throw new Error(payload?.error || 'Video could not be loaded.');
    const url=String(payload.url);
    if(!/^https?:\/\//i.test(url)) throw new Error('Career Library returned an unsupported video URL.');
    const modal=document.getElementById('careerVideoModal');
    const frame=document.getElementById('careerVideoFrame');
    const video=document.getElementById('careerVideoPlayer');
    const isDirectVideo=/\.(mp4|webm|ogg)(?:$|[?#])/i.test(url);
    const youtubeMatch=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    if(isDirectVideo){ frame.hidden=true; video.hidden=false; video.src=url; video.play().catch(()=>{}); }
    else if(youtubeMatch){ frame.hidden=false; video.hidden=true; frame.src='https://www.youtube.com/embed/'+youtubeMatch[1]+'?autoplay=1&rel=0'; }
    else { frame.hidden=false; video.hidden=true; frame.src=url; }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
  }

  function renderCareerData(data, career, directionName, country='India', language='English'){
    const stats = data.stats || {};
    const salary = stats.salary || {};
    const demand = text(stats.demandLevel,'Not specified');
    const industries = arr(stats.topIndustries);
    const videos = arr(data.videoRecommendations).slice(0,2);
    const faq = arr(data.faqs);
    const primaryName = text(data.title, career?.canonicalName || 'Career');
    const initialsText = initials(primaryName);
    const marketCountry = normalizeCountry(text(data.country, country || 'India'));
    const marketLanguage = text(data.language, language || 'English');
    const marketCurrency = text(salary.currency, COUNTRY_META[marketCountry]?.currency || '');
    const countryOptions = COUNTRY_OPTIONS.map(([name,code])=>`<option value="${esc(name)}" ${name===marketCountry?'selected':''}>${esc(name)} (${code})</option>`).join('');
    const languageOptions = LANGUAGE_OPTIONS.map(name=>`<option value="${esc(name)}" ${name===marketLanguage?'selected':''}>${esc(name)}</option>`).join('');

    return `<div class="career-detail-shell">
      <section class="career-detail-hero">
        <div class="career-detail-hero-copy">
          <div class="eyebrow">Career profile</div><h1>${esc(primaryName)}</h1>
          <p>${esc(text(data.introduction,'Explore this career, understand the work, and decide what evidence you need before committing.'))}</p>
          <div class="career-detail-actions"><a class="btn btn-secondary" href="#career-nature">Explore the work</a><button class="btn btn-primary" type="button" id="careerLibraryRetryTop">Refresh profile</button></div>
        </div>
        <div class="career-snapshot">
          <div class="career-snapshot-icon">${esc(initialsText)}</div><div class="career-snapshot-title">${esc(primaryName)}</div>
          <div class="career-snapshot-context">${esc(marketCountry)} · ${esc(marketLanguage)}</div>
          <div class="career-market-controls">
            <div><label for="careerCountrySelect">Market</label><select id="careerCountrySelect">${countryOptions}</select></div>
            <div><label for="careerLanguageSelect">Language</label><select id="careerLanguageSelect">${languageOptions}</select></div>
          </div>
          ${marketSnapshot(salary, marketCurrency, stats)}
          <div class="career-market-grid">${metric('Growth', stats.jobGrowth)}${metric('Demand', demand)}</div>
          ${industries.length ? `<div class="career-industry-wrap"><small>Top industries</small><div class="career-industry-list">${industries.map(i=>`<span>${esc(i)}</span>`).join('')}</div></div>` : ''}
        </div>
      </section>

      <div class="career-detail-layout">
        <div class="career-detail-main" id="career-detail-content">
          ${sectionCard('Why explore it?', 'Who may enjoy this career', list(data.whoShouldPursue))}
          ${sectionCard('Work reality', 'What the work is actually like', `<p>${esc(data.workNature?.description || '')}</p>${arr(data.workNature?.examples).length?`<h3 class="career-subtitle">Typical activities</h3>${list(data.workNature.examples)}`:''}`,'career-detail-card')}
          ${arr(data.eligibility).length ? sectionCard('What you may need', 'Eligibility & requirements', list(data.eligibility)) : ''}
          ${arr(data.pathways).length ? sectionCard('Career navigators', 'Ways into this career', arr(data.pathways).map(pathwayMarkup).join('')) : ''}
          ${(arr(data.conventionalOptions).length || arr(data.newAgeOptions).length || arr(data.aiRelatedOptions).length) ? `<section class="career-detail-card" id="career-opportunities"><div class="tag">Explore opportunities</div><h2>Related career options</h2>${arr(data.conventionalOptions).length?`<h3 class="career-group-title">Conventional career options</h3>${optionAccordion(data.conventionalOptions)}`:''}${arr(data.newAgeOptions).length?`<h3 class="career-group-title">New-age career options</h3>${optionAccordion(data.newAgeOptions)}`:''}${arr(data.aiRelatedOptions).length?`<h3 class="career-group-title">AI-related career options</h3>${optionAccordion(data.aiRelatedOptions)}`:''}</section>` : ''}
          ${faq.length ? `<section class="career-detail-card"><div class="tag">Common questions</div><h2>Frequently asked questions</h2>${faq.map(item=>`<details class="career-option"><summary><span>${esc(item?.question || item?.title || '')}</span><span class="career-option-chevron">⌄</span></summary><div><p>${esc(item?.answer || item?.description || '')}</p></div></details>`).join('')}</section>` : ''}
        </div>
        <aside class="career-detail-side">
          ${stats.futureOutlook ? `<div class="career-side-card"><div class="tag">Market outlook</div><h3>Where the field is heading</h3><p>${esc(stats.futureOutlook)}</p><div class="career-demand"><span>Demand</span><strong>${esc(demand)}</strong></div></div>`:''}
          ${videos.length ? `<div class="career-side-card"><div class="tag">Recommended watch</div><h3>Go a little deeper</h3>${videos.map((v,i)=>`<button type="button" class="career-video-item show-career-video" data-video-type="${Number(v?.type||i+1)}" aria-label="Play ${esc(v?.title || ('Career in '+primaryName))}"><span class="career-video-placeholder">▶</span><span><strong>${esc(v?.title || ('Career in '+primaryName))}</strong><small>${esc(v?.channelName || '')}</small></span></button>`).join('')}</div>`:''}
          <div class="career-side-card"><div class="tag">Next step</div><h3>Build evidence before you commit.</h3><p>Choose the next action that fits where you are — validate your fit, talk it through, or start learning.</p><div class="career-next-actions"><a class="btn btn-secondary" href="assessment.html">Assess fit</a><a class="btn btn-secondary" href="counselling.html">Talk to someone</a><a class="btn btn-primary" href="https://skilldiya.netlify.app/courses">Explore learning</a></div></div>
          <div class="career-side-source">Career information is presented in Career Diya from the connected Career Library service.</div>
        </aside>
      </div>
    </div>`;
  }

  async function loadCareerProfile({careerName, careerId, directionName, country='India', language='English'}){
    const cfg = window.CAREER_DIYA_SUPABASE || {};
    if(!cfg.url || !cfg.anonKey) throw new Error('Supabase configuration is missing.');
    const endpoint = cfg.url.replace(/\/$/,'') + '/functions/v1/career-library';
    const normalizedCountry=normalizeCountry(country);
    const res = await fetch(endpoint, {method:'POST',headers:{'apikey':cfg.anonKey,'Authorization':'Bearer '+cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({careerName,country:normalizedCountry,language})});
    const payload = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(payload.error || 'Career Library service is unavailable.');
    return payload.careerData;
  }

  window.CareerDiyaCareerLibrary = { loadCareerProfile, renderCareerData, playCareerVideo, COUNTRY_OPTIONS, LANGUAGE_OPTIONS, normalizeCountry };
})();
