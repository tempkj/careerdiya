(function(){
  'use strict';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function addMuralDecor(band, opts){
    if (!band || band.querySelector('.cd2-mural-decor')) return;
    const decor=document.createElement('div');
    decor.className='cd2-mural-decor';
    const blooms=opts&&opts.blooms||['navy','gold'];
    decor.innerHTML = blooms.map(name=>`<span class="bloom bloom-${name}" data-bloom></span>`).join('') +
      '<span class="hatch"></span><span class="scrim"></span>'+
      '<span class="mural-shape square"></span><span class="mural-shape circle"></span>'+
      (blooms.includes('green')?'<span class="mural-shape ring"></span>':'');
    band.prepend(decor);
    band.classList.add('mural-band');
  }

  document.querySelectorAll('.hero').forEach(b=>addMuralDecor(b,{blooms:['navy','gold','green']}));
  document.querySelectorAll('.page-hero').forEach(b=>addMuralDecor(b,{blooms:['navy','gold']}));

  // Keep the navigation language and active state consistent across every page.
  document.querySelectorAll('.navlinks a').forEach(link=>{
    const href=(link.getAttribute('href')||'').split('?')[0].split('#')[0];
    const current = href && (href === page || (page==='index.html' && href==='index.html'));
    if(current) link.setAttribute('aria-current','page');
    const labels={
      'index.html':'Home',
      'explore.html':'Explore Careers',
      'paths.html':'Career Paths',
      'assessment.html':'Assessment',
      'counselling.html':'Counselling',
      'resources.html':'Resources'
    };
    if(labels[href]) link.textContent=labels[href];
  });

  // Standardise visible button/link casing where old text slipped into sentence case.
  const replacements={
    'My career':'My Career',
    'my career':'My Career',
    'Career paths':'Career Paths',
    'Career explorer':'Career Explorer',
    'Start free':'Start Free',
    'Start assessment':'Start Assessment',
    'See counselling':'See Counselling',
    'Explore assessment':'Explore Assessment',
    'Open deeper assessment':'Open Deeper Assessment',
    'Request a conversation':'Request A Conversation',
    'Request A conversation':'Request A Conversation',
    'Talk to us':'Talk To Us',
    'Explore Skill Diya':'Explore Skill Diya',
    'Start exploring':'Start Exploring'
  };
  document.querySelectorAll('a.btn,button.btn,.nav-cta').forEach(node=>{
    const t=(node.textContent||'').trim();
    if(replacements[t]) node.textContent=replacements[t];
  });
})();

/* =========================================================
   Background variants — 1b / 2a / 2b
   ========================================================= */
(function(){
  'use strict';
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  function variantForPage(){
    if(page==='index.html') return '1b';
    if(['explore.html','assessment.html'].includes(page)) return '2a';
    return '2b';
  }
  function decorateBand(band, variant){
    if(!band) return;
    band.classList.add(`cd2-${variant}`);
    const existing=band.querySelector('.cd2-mural-decor');
    if(existing) return;
    const decor=document.createElement('div');
    decor.className='cd2-mural-decor';
    const blooms=variant==='2a'?['navy','gold']:['navy','gold','green'];
    decor.innerHTML=blooms.map(name=>`<span class="bloom bloom-${name}" data-bloom></span>`).join('')+
      '<span class="hatch"></span><span class="scrim"></span>'+
      '<span class="mural-shape square"></span><span class="mural-shape circle"></span>'+
      (blooms.includes('green')?'<span class="mural-shape ring"></span>':'');
    band.prepend(decor);
    band.classList.add('mural-band');
  }
  document.querySelectorAll('.hero,.page-hero').forEach(b=>decorateBand(b,variantForPage()));

  /* Dashboard/profile/auth do not have a page hero; give them the same 2b opening. */
  const needsStandalone=['dashboard.html','profile.html','auth.html','courses.html','admissions.html'].includes(page);
  if(needsStandalone && !document.querySelector('.hero,.page-hero,.cd2-page-mural')){
    const host=document.createElement('div');
    host.className='cd2-page-mural cd2-2b';
    host.innerHTML='<div class="cd2-mural-decor">'+
      '<span class="bloom bloom-navy"></span><span class="bloom bloom-gold"></span><span class="bloom bloom-green"></span>'+
      '<span class="hatch"></span><span class="scrim"></span>'+
      '<span class="mural-shape square"></span><span class="mural-shape circle"></span><span class="mural-shape ring"></span>'+
      '</div><div class="cd2-page-mural-content container"><div class="eyebrow">Career Diya</div></div>';
    const header=document.querySelector('.site-header');
    if(header && header.parentNode) header.parentNode.insertBefore(host,header.nextSibling);
  }
})();
