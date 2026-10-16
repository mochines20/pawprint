/* Reference mobile screens. Rendered from API data; no demo values are invented here. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    home:'<path d="m3 10 9-7 9 7v10H4V10m5 10v-7h6v7"/>',
    journal:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 16h14M9 7h6"/>',
    camera:'<path d="M3 7h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/>',
    care:'<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z"/>',
    profile:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    back:'<path d="m15 4-8 8 8 8"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    flame:'<path d="M13 2c1 6 7 8 7 13a8 8 0 0 1-16 0c0-3 2-6 4-8l1 5c3-3 4-6 4-10Z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  const icon = name => `<svg class="pw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.journal}</svg>`;
  const avatar = (type='cat-ink') => window.pawprintAvatarMarkup?.(type) || cat(false);
  function cat(active=true) {
    return `<svg class="pw-cat ${active?'is-orange':'is-black'}" viewBox="0 0 100 110" aria-hidden="true"><path class="pw-cat-tail" d="M33 91C7 97 7 72 15 65"/><path class="pw-cat-fur" d="M32 93Q19 76 36 57Q67 47 78 76L82 97H39Z"/><path class="pw-cat-fur" d="M29 47 27 12 48 29Q56 26 64 29L85 12 84 48Q89 76 58 77 27 77 29 47Z"/><path class="pw-cat-ear" d="m33 23 2 19 11-9m32-10-2 19-10-9"/><ellipse class="pw-cat-eye" cx="46" cy="51" rx="10" ry="13"/><ellipse class="pw-cat-eye" cx="70" cy="51" rx="10" ry="13"/><ellipse fill="var(--pw-ink)" cx="49" cy="51" rx="5" ry="10"/><ellipse fill="var(--pw-ink)" cx="73" cy="51" rx="5" ry="10"/><g fill="var(--pw-white)"><circle cx="46" cy="45" r="3"/><circle cx="70" cy="45" r="3"/></g><path d="m55 65 4 3 4-3m-4 3q-4 6-8 1m8-1q4 6 8 1M45 32v9m10-11v9m10-9v9" fill="none" stroke="var(--pw-ink)" stroke-width="2.5" stroke-linecap="round"/><path d="m42 77 16 6 20-6-18 15Z" fill="var(--pw-amber)" stroke="var(--pw-ink)" stroke-width="2"/></svg>`;
  }
  const header = (title, left='back') => `<header class="pw-screen-header"><button type="button" class="pw-icon-button" data-goto-screen="home" aria-label="Back to Home">${icon(left)}</button><h2>${esc(title)}</h2><button type="button" class="pw-icon-button" data-ui-theme aria-label="Switch color theme">${icon('sun')}</button></header>`;
  const loading = label => `<div class="pw-loading" role="status"><paw-loader variant="paws" size="sm" label="${esc(label)}"></paw-loader><span>${esc(label)}</span></div>`;
  function medal(item) {
    const tone=['mist','amber','sage','ink','coral','gold'].includes(item.tone)?item.tone:'mist';
    return `<svg class="pw-medal pw-medal-${tone}" viewBox="0 0 80 112" role="img" aria-label="${esc(item.title)}${item.earned?', earned':', locked'}"><g stroke="var(--pw-ink)" stroke-width="2.4" stroke-linejoin="round"><path d="m9 4 17 0 22 42-15 10Z" fill="var(--medal-color)"/><path d="m54 4 17 0-24 52-16-10Z" fill="var(--medal-color)"/><path d="m17 6 20 40m26-40-21 40" stroke="var(--pw-white)" stroke-width="1.2" stroke-dasharray="3 2"/><circle cx="41" cy="77" r="34" fill="var(--pw-ink)"/><circle cx="39" cy="73" r="34" fill="var(--medal-color)"/><circle cx="39" cy="73" r="29" fill="var(--medal-light)"/><circle cx="39" cy="73" r="26" fill="none" stroke="var(--medal-color)" stroke-width="2" stroke-dasharray="2 2"/><path d="M23 74 22 54 35 62h8l13-8-1 20q3 18-16 18T23 74Z" fill="var(--pw-ink)"/><path d="m26 59 2 9 5-4m19-6-2 9-5-4" fill="var(--pw-ear)" stroke-width="1"/><g fill="var(--pw-amber)" stroke-width="1"><ellipse cx="31" cy="76" rx="4" ry="6"/><ellipse cx="47" cy="76" rx="4" ry="6"/></g><g fill="var(--pw-ink)" stroke="none"><ellipse cx="32" cy="77" rx="2" ry="4"/><ellipse cx="48" cy="77" rx="2" ry="4"/></g><g fill="var(--pw-white)" stroke="none"><circle cx="30" cy="73" r="1.5"/><circle cx="46" cy="73" r="1.5"/></g><path d="m37 84 2 2 2-2m-7 3q3 4 5-1 2 5 5 1" fill="none" stroke="var(--pw-ear)" stroke-width="1.3"/><path d="m38 98 1-3 1 3 4 1-3 2v3l-2-2-3 2v-3l-2-2Z" fill="var(--pw-amber)" stroke-width="1"/></g></svg>`;
  }
  function home() {
    const name = window.pawprintPublicProfile?.nickname || window.pawprintProfile?.display_name || 'Cat spotter';
    const hour = Number(new Intl.DateTimeFormat('en',{hour:'numeric',hourCycle:'h23'}).format(new Date()));
    return `<div class="screen-panel pw-screen pw-home"><header class="pw-home-header"><button class="pw-greeting" data-goto-screen="profile" aria-label="Open your profile"><span class="pw-avatar">${avatar(window.pawprintPublicProfile?.avatar)}</span><span><small>Good ${hour<12?'morning':hour<18?'afternoon':'evening'}</small><strong>${esc(name)}</strong></span></button><button class="pw-streak-pill" data-goto-screen="journal">${icon('flame')}<span data-streak-summary>Streak</span></button></header><div class="dashboard-grid pw-home-grid"><article class="app-card map-card pw-map-card"><div class="pw-map-frame"><div class="map-title">Philippines · public sightings</div><div class="app-map" aria-label="Approximate public cat sightings"></div><span class="pw-map-note">Approximate areas · delayed 5 min</span></div><div class="app-actions"><button class="btn btn-amber pw-spot-button" id="captureBtn">${icon('camera')} Spot a cat</button></div></article><article class="app-card metric-card pw-streak-card"><span data-streak-cat>${cat(false)}</span><div><small>Current streak</small><strong id="streakMetric">—</strong><small>days in a row</small></div></article><article class="app-card progress-card pw-goal-card"><h2>Today's small goal</h2><p>Spot 1 cat to keep it safe</p><div class="progress-track"><span id="dailyGoalProgress" style="width:0%"></span></div><strong id="dailyGoalMetric">—</strong></article><section class="pw-recent"><div class="pw-section-heading"><h2>Recent pawprints</h2><button class="pw-text-button" data-goto-screen="journal">View all</button></div><div id="journalList">${loading('Loading your pawprints')}</div></section></div></div>`;
  }
  // Rarity is supplied by the server. Unknown classifications remain unclassified.
  const rarity = entry => {
    if(entry.rarity)return String(entry.rarity).toLowerCase();
    // Compatibility with older API responses: the same game tiers as Worker.rarityFor.
    const type=String(entry.catType||'').toLowerCase();
    if(!type||type.includes('unclassified'))return '';
    if(/calico|tortoiseshell/.test(type))return 'rare';
    if(/black|white/.test(type))return 'super rare';
    if(/tuxedo|gray/.test(type))return 'uncommon';
    return 'common';
  };
  const mapPin=()=>'<svg class="pw-map-pin-art" viewBox="0 0 48 64" aria-hidden="true"><path d="M24 61C20 55 3 38 3 24a21 21 0 0 1 42 0c0 14-17 31-21 37Z" fill="var(--pw-pin-fill,var(--pw-amber))" stroke="var(--pw-ink)" stroke-width="3.5" stroke-linejoin="round"/><circle cx="24" cy="24" r="12" fill="var(--pw-paper)" stroke="var(--pw-ink)" stroke-width="2.5"/><g class="pw-pin-paw" fill="var(--pw-ink)"><ellipse cx="17" cy="22" rx="2" ry="3" transform="rotate(-25 17 22)"/><ellipse cx="22" cy="19" rx="2" ry="3"/><ellipse cx="27" cy="19" rx="2" ry="3"/><ellipse cx="31" cy="23" rx="2" ry="3" transform="rotate(25 31 23)"/><path d="M18 29q0-3 6-6 6 3 6 6 0 5-6 2-6 3-6-2Z"/></g></svg>';
  // The nine classified coat labels supported by AI_VALIDATION_PROMPT in the Worker.
  // Breed names are not counted as coat discoveries; "unclassified" is not a collectible.
  const coats=['Orange tabby','Tuxedo','Black','White','Calico','Tortoiseshell','Gray tabby','Ginger-white','Mixed'];
  const coatKey=value=>String(value||'').toLowerCase().replace(/ cat$/,'').replace(/^gray$/,'gray tabby');
  function filterEntries(entries, filter) {
    return entries.filter(e => filter==='all' || (filter==='first'?e.firstSpotted:filter==='rare'?['rare','super rare'].includes(rarity(e)):rarity(e)===filter));
  }
  function row(entry, recent=false) {
    const type=String(entry.catType || 'Unclassified cat'), rare=rarity(entry);
    const src=String(entry.photoUrl||'');
    const safePhoto=/^(\/[^/]|https?:\/\/)/i.test(src);
    const image=safePhoto?`<img src="${esc(src)}" alt="${esc(type)}" loading="lazy">`:avatar(/black|tuxedo/i.test(type)?'cat-ink':/calico/i.test(type)?'cat-calico':'cat-tangerine');
    const date=new Date(entry.spottedAt); const when=Number.isNaN(date.getTime())?'Saved':date.toLocaleDateString('en-PH',{month:'short',day:'numeric'});
    const meta=entry.visibility==='private'?'private':entry.visibility==='friends'?'friends only':(entry.locationLabel||'approximate area');
    return `<button type="button" class="pw-entry ${recent?'pw-entry-recent':''}" ${recent?'data-goto-screen="journal"':`data-journal-entry="${esc(entry.id||entry.sightingId)}"`}><span class="pw-entry-art">${image}</span><span class="pw-entry-copy"><strong>${esc(type)}</strong>${entry.firstSpotted&&!recent?'<span class="pw-first-found">First found</span>':''}<small>${esc(when)} · ${esc(meta)}</small></span>${rare?`<span class="pw-rarity" data-rarity="${esc(rare)}">${esc(rare)}</span>`:''}</button>`;
  }
  function journal(entries, filter, page) {
    const filtered=filterEntries(entries,filter), pages=Math.max(1,Math.ceil(filtered.length/5)), start=Math.min(page,pages-1)*5;
    const found=new Set(entries.map(e=>coatKey(e.coatType||e.catType))),known=coats.filter(c=>found.has(coatKey(c))),missing=coats.find(c=>!found.has(coatKey(c)));
    return `<div class="screen-panel pw-screen pw-journal">${header('Cat Journal','journal')}<div class="pw-collection-intro"><span class="eyebrow">Your private collection</span><h1>Every cat has a story.</h1><div class="pw-collection-summary"><progress value="${known.length}" max="${coats.length}" aria-label="Coat collection progress"></progress><strong>${known.length} of ${coats.length} coats</strong></div></div><div class="pw-filters" aria-label="Filter Cat Journal">${['all','common','uncommon','rare','first'].map(f=>`<button class="chip ${filter===f?'active':''}" aria-pressed="${filter===f}" data-journal-filter="${f}">${f==='first'?'First spots':f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div><div id="journalEntries" class="pw-entries">${filtered.length?filtered.slice(start,start+5).map(e=>row(e)).join(''):'<div class="pw-undiscovered"><span>?</span><div><strong>Not found yet</strong><small>Your next validated sighting could be the first.</small></div></div>'}</div>${pages>1?`<div class="journal-pagination"><span>${start+1}–${Math.min(start+5,filtered.length)} of ${filtered.length}</span><div><button class="btn btn-light" data-journal-page="prev" ${!page?'disabled':''}>Previous 5</button><button class="btn btn-amber" data-journal-page="next" ${page>=pages-1?'disabled':''}>Next 5</button></div></div>`:''}${filter==='all'&&entries.length&&missing?`<div class="pw-undiscovered pw-missing-coat"><span>?</span><div><strong>${esc(missing)}</strong><small>Not found yet</small></div></div>`:''}<section class="pw-week" data-streak-week>${loading('Loading your streak')}</section></div>`;
  }
  function updateStreak(data) {
    if(!data)return;
    const streak=data.streak||{}, current=Number(streak.current||0), active=Boolean(streak.active ?? current>0);
    document.querySelectorAll('[data-streak-summary]').forEach(el=>el.textContent=`${current} day streak`);
    document.querySelectorAll('[data-streak-cat]').forEach(el=>el.innerHTML=cat(active));
    document.querySelectorAll('[data-streak-week]').forEach(el=>{
      const days=data.streakCalendar||[];
      el.innerHTML=`<div class="pw-week-title">${cat(active)}<div><strong>${active?'Orange cat streak':'Start a new streak'}${current?' · '+current+' days':''}</strong><small>${esc(streak.helper||'Validate a cat photo to keep it glowing')}</small></div></div><div class="pw-week-days">${days.map(day=>`<span class="${day.status==='complete'?'complete':day.status==='freeze'?'frozen':''} ${day.isToday?'today':''}" aria-label="${esc(day.label+' '+day.number+': '+day.status)}"><b>${day.status==='complete'?'✓':day.status==='freeze'?'❄':''}</b><small>${esc(day.label)}</small></span>`).join('')}</div>`;
    });
  }
  function mount(screen) {
    document.body.dataset.pwScreen=screen;
    if(screen==='profile') enhanceProfile();
    updateStreak(window.pawprintDashboard);
    document.querySelectorAll('.mobile-nav [data-screen]').forEach(b=>b.setAttribute('aria-current',b.dataset.screen===screen?'page':'false'));
    const greeting=document.querySelector('.pw-greeting strong');if(greeting)greeting.textContent=window.pawprintPublicProfile?.nickname||window.pawprintProfile?.display_name||'Cat spotter';
  }
  function enhanceProfile() {
    const panel=document.querySelector('.profile-screen-panel'); if(!panel)return;
    panel.classList.add('pw-screen','pw-profile');
    panel.insertAdjacentHTML('afterbegin',header('My profile'));
    const identity=panel.querySelector('.profile-identity-card');
    const publicProfile=window.pawprintPublicProfile;
    if(identity&&!identity.querySelector('.profile-avatar svg')) identity.querySelector('.profile-avatar').innerHTML=avatar(publicProfile?.avatar);
    const achievement=panel.querySelector('.profile-achievements');
    if(achievement){
      const progress=achievement.querySelector('.profile-progress-card');if(progress)achievement.prepend(progress);
      const grid=achievement.querySelector('.profile-medal-grid');
      if(grid&&grid.children.length>4){const extra=document.createElement('details');extra.className='pw-extra-medals';extra.innerHTML='<summary>View all medals</summary><div class="profile-medal-grid"></div>';const dest=extra.lastElementChild;while(grid.children.length>4)dest.appendChild(grid.children[4]);achievement.appendChild(extra);}
    }
    const detailsCard=panel.querySelector('.profile-details-card');
    if(detailsCard){
      const wrap=document.createElement('details');wrap.className='pw-edit-profile';wrap.innerHTML='<summary>Edit profile & language <span>›</span></summary>';detailsCard.before(wrap);wrap.appendChild(detailsCard);
      const exportButton=detailsCard.querySelector('#exportData'),deleteButton=detailsCard.querySelector('.danger-zone');
      const data=document.createElement('details');data.className='pw-data-controls';data.innerHTML='<summary>Export or delete my data <span>›</span></summary><div class="pw-data-actions"></div>';wrap.after(data);
      if(exportButton)data.lastChild.appendChild(exportButton);if(deleteButton)data.lastChild.appendChild(deleteButton);data.after(wrap);
    }
    const settings=panel.querySelector('.profile-settings-card');
    if(settings){
      const privacy=settings.querySelector('.profile-privacy-panel');
      if(privacy){
        const other=document.createElement('details');other.className='pw-edit-profile';other.innerHTML='<summary>More privacy settings <span>›</span></summary>';
        const rows=[...privacy.children];rows.slice(0,2).forEach(row=>other.appendChild(row));
        privacy.prepend(Object.assign(document.createElement('div'),{className:'pw-visibility-control',innerHTML:'<details><summary>Public visibility <strong>Per sighting ›</strong></summary><p>Choose Public, Friends, or Private before each capture. Public pins always use a delayed, approximate area.</p></details>'}));
        const map=privacy.querySelector('[data-toggle="map"]');if(map){map.hidden=true;map.before(Object.assign(document.createElement('strong'),{textContent:'On',className:'pw-map-always'}));}
        settings.appendChild(other);
        const language=window.pawprintProfile?.language||'en';
        privacy.insertAdjacentHTML('beforeend',`<button class="pw-more-button" data-edit-language>Language <strong>${esc({en:'English',fil:'Filipino',es:'Spanish',ja:'Japanese'}[language]||language)} ›</strong></button>`);
      }
      settings.insertAdjacentHTML('beforeend','<button class="pw-more-button" type="button" data-more-open>More tools <span>›</span></button>');
    }
  }
  function recent(entries) {
    const list=document.getElementById('journalList');if(!list)return;
    list.innerHTML=entries.length?entries.slice(0,2).map(e=>row(e,true)).join(''):'<div class="pw-undiscovered"><span>?</span><div><strong>No pawprints yet</strong><small>Your first validated cat will appear here.</small></div></div>';
  }
  function captureUI() {
    const modal=document.querySelector('#captureModal .modal');if(!modal)return;
    modal.classList.add('pw-capture-screen');
    modal.dataset.captureState='idle';
    const title=document.getElementById('captureTitle'),close=modal.querySelector('[data-close-modal]');
    title.textContent='New pawprint';const head=document.createElement('header');head.className='pw-screen-header';
    const back=document.createElement('button');back.className='pw-icon-button';back.type='button';back.setAttribute('aria-label','Back');back.innerHTML=icon('back');back.onclick=()=>close?.click();
    if(close){close.className='pw-icon-button';close.setAttribute('aria-label','Close camera');close.innerHTML=icon('close');}
    modal.prepend(head);head.append(back,title);if(close)head.appendChild(close);
    const preview=document.getElementById('capturePreview');
    preview.insertAdjacentHTML('beforeend','<span class="pw-camera-only">● Camera only</span><div class="pw-camera-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="pw-camera-status" id="pwCaptureStatus" role="status">Ready when you are</span>');
    const safety=document.createElement('div');safety.className='pw-capture-safety';safety.innerHTML='<span>Keep your distance</span><span>No flash</span><span>Don’t chase</span>';preview.after(safety);
    const action=modal.querySelector('.modal-actions');safety.after(action);
    const button=document.getElementById('confirmCapture');button.classList.add('pw-shutter');button.title='Start camera, then capture and verify';
    const caption=document.createElement('span');caption.id='pwShutterCaption';caption.textContent='Start camera';action.appendChild(caption);
    const help=document.getElementById('captureHelp');help.classList.add('pw-capture-help');action.after(help);
    modal.insertAdjacentHTML('beforeend',`<div class="pw-capture-privacy">${icon('lock')}<p><strong>Your exact location stays private.</strong> Public pins appear as an approximate area after a 5-minute delay.</p></div>`);
    const source=document.querySelector('.mobile-nav');if(source){const nav=source.cloneNode(true);nav.classList.add('pw-capture-nav');nav.querySelectorAll('[data-screen]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-current','false');});nav.querySelector('[data-open-capture]')?.removeAttribute('data-open-capture');nav.querySelector('.mobile-capture')?.setAttribute('data-shutter-proxy','');nav.addEventListener('click',event=>{if(event.target.closest('[data-screen]'))close?.click();if(event.target.closest('[data-shutter-proxy]'))button.click();});modal.appendChild(nav);}
    document.getElementById('captureModal').addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const focusable=[...modal.querySelectorAll('button:not(:disabled),textarea,select,a[href]')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
  }
  function captureStatus(state,label) {
    const panel=document.querySelector('#captureModal .pw-capture-screen');if(panel)panel.dataset.captureState=state;
    const status=document.getElementById('pwCaptureStatus'),caption=document.getElementById('pwShutterCaption');
    if(status){status.textContent=label;status.dataset.state=state;}
    if(caption)caption.textContent=state==='checking'?'Checking cat…':state==='ready'?'Capture and verify':'Start camera';
  }
  function syncLandingShowcase() {
    const showcase=document.querySelector('.showcase');
    if(!showcase)return;
    const entry=(kind,title,meta,rarity)=>`<div class="device-row showcase-entry"><span class="showcase-entry-art">${avatar(kind)}</span><span class="showcase-entry-copy"><b>${esc(title)}</b><small>${esc(meta)}</small></span><em>${esc(rarity)}</em></div>`;
    showcase.innerHTML=`
      <figure class="sneak-peek-card"><img src="/assets/pawprint-sneakpeek.svg" alt="Pawprint mobile sneak peek"><figcaption>One connected Pawprint view</figcaption></figure>
      <div class="device device-left"><div class="device-screen showcase-home-preview">
        <div class="device-top"><span class="avatar">${avatar('cat-ink')}</span><span>Welcome home<small>Philippines · browser preview</small></span><span class="mock-icon" aria-hidden="true">···</span></div>
        <div class="showcase-kicker">MAP · TODAY</div><div class="device-map showcase-map"><span class="mini-pin a"><i></i></span><span class="mini-pin b"><i></i></span><span class="mini-pin c"><i></i></span></div>
        <div class="device-card showcase-goal"><b>Today's small goal</b><small>Spot 1 cat to keep it safe</small><span class="showcase-progress"></span><strong>1/1</strong></div>
        <div class="device-nav"><strong>Home</strong><span>Journal</span><span>Care</span><span>Profile</span></div>
      </div></div>
      <div class="device device-main"><div class="device-screen showcase-journal-preview">
        <div class="device-top"><span class="mock-icon">${icon('menu')}</span><span>Cat Journal<small>Your private collection</small></span><span class="mock-icon">${icon('sun')}</span></div>
        <div class="showcase-kicker">YOUR COLLECTION</div><div class="device-title">Cat Journal<div class="device-sub">8 cats · 4 areas explored</div></div>
        ${entry('cat-tangerine','Orange tabby','Spotted today','common')}${entry('cat-tuxedo','Tuxedo','Spotted yesterday','uncommon')}${entry('cat-calico','Calico','Private Journal','rare')}
        <div class="device-card black showcase-streak"><b>04 day streak</b><small>Validated pawprints keep it glowing.</small></div>
        <div class="device-nav"><span>Home</span><strong>Journal</strong><span>Care</span><span>Profile</span></div>
      </div></div>
      <div class="device device-mini"><div class="device-screen showcase-profile-preview">
        <div class="device-top"><span class="mock-icon">${icon('back')}</span><span>My profile</span><span class="mock-icon">${icon('sun')}</span></div>
        <div class="showcase-profile-avatar">${avatar('cat-tangerine')}</div><b class="showcase-profile-name">Pawprint spotter</b><small class="showcase-profile-copy">Your account stays private.</small>
        <div class="device-card black showcase-xp"><b>248 XP</b><small>Alley Scout · level 3</small></div>
        <div class="device-row"><span>Privacy</span><span>Friends ›</span></div><div class="device-row"><span>Language</span><span>English ›</span></div>
      </div></div>`;
  }
  function syncPawTrailContrast(trail) {
    const layer=trail?.el;
    if(!layer)return;
    const darkSections=[...document.querySelectorAll('.dark-section')];
    const scrollY=window.scrollY||window.pageYOffset||0;
    layer.querySelectorAll('.pt-p').forEach(paw=>{
      const y=parseFloat(paw.style.top||'0');
      const onDark=darkSections.some(section=>{
        const rect=section.getBoundingClientRect(),top=rect.top+scrollY,bottom=rect.bottom+scrollY;
        return y>=top&&y<=bottom;
      });
      paw.style.setProperty('--pt-c',onDark?'#FAF8F4':'#151515');
      paw.style.setProperty('--pt-a',onDark?'#FAF8F4':'#FFB400');
      paw.style.setProperty('--o',onDark?'0.82':(paw.classList.contains('pt-a')?'0.4':'0.09'));
    });
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('button[data-ui-theme]')){const dark=document.documentElement.dataset.uiTheme!=='dark';document.documentElement.dataset.uiTheme=dark?'dark':'light';try{localStorage.setItem('pawprint-ui-theme',dark?'dark':'light');}catch{}}
    if(event.target.closest('[data-more-open]'))document.querySelector('.app-sidebar [data-screen="more"]')?.click();
    if(event.target.closest('[data-edit-language]')){const panel=document.querySelector('.pw-edit-profile:has(#profileForm)');if(panel){panel.open=true;document.getElementById('profileLanguage')?.focus();}}
    if(event.target.closest('#captureBtn,[data-open-capture]'))queueMicrotask(()=>{const modal=document.getElementById('captureModal');if(modal?.classList.contains('open')){modal.scrollTop=0;modal.querySelector('.pw-screen-header button')?.focus();}});
  });
  try{document.documentElement.dataset.uiTheme=localStorage.getItem('pawprint-ui-theme')||'light';}catch{}
  window.addEventListener('pawprint-profile-ready',()=>{const greeting=document.querySelector('.pw-greeting strong'),art=document.querySelector('.pw-greeting .pw-avatar');if(greeting)greeting.textContent=window.pawprintPublicProfile?.nickname||'Cat spotter';if(art)art.innerHTML=avatar(window.pawprintPublicProfile?.avatar);});
  window.PawprintUI={home,journal,filterEntries,mount,updateStreak,recent,captureStatus,icon,esc,medal,mapPin};
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.mobile-nav [data-screen]').forEach(b=>{const span=b.querySelector('.side-icon');if(span)span.innerHTML=icon(b.dataset.screen);});
    const camera=document.querySelector('.mobile-capture');if(camera)camera.innerHTML=icon('camera');
    syncLandingShowcase();
    const landing=document.querySelector('.landing');
    if(landing&&window.PawTrail&&!window.pawprintPawTrail){
      window.pawprintPawTrail=window.PawTrail.init({parent:landing,color:'#151515',accent:'#FFB400',opacity:.09,behind:false,zIndex:0});
      const trailLayer=window.pawprintPawTrail.el;
      const trailContrastObserver=new MutationObserver(()=>syncPawTrailContrast(window.pawprintPawTrail));
      trailContrastObserver.observe(trailLayer,{childList:true});
      syncPawTrailContrast(window.pawprintPawTrail);
    }
    captureUI();
  },{once:true});
})();
