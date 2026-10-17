(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  let loaded=false;
  const request=async(path,options={})=>{const response=await fetch(path,{credentials:'include',...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'REQUEST_FAILED');return data;};
  const close=()=>document.getElementById('pawprintAdminConsole')?.remove();
  const render=async()=>{
    let data,careData,analytics;
    try{[data,careData,analytics]=await Promise.all([request('/api/admin/moderation'),request('/api/admin/care-flags'),request('/api/admin/analytics')]);}catch(error){window.notify?.(error.message==='ADMIN_REQUIRED'?'Admin access is required.':'Admin data is unavailable.');return;}
    const root=document.getElementById('pawprintAdminConsole');if(!root)return;
    const items=data.items||[];
    const stats=analytics.metrics||analytics.stats||analytics||{};stats.accepted=stats.acceptedPhotos||stats.accepted||stats.acceptedSightings||0;const care=careData.items||[];
    root.innerHTML=`<div class="pw-admin-card" role="dialog" aria-modal="true" aria-labelledby="pwAdminTitle"><div class="pw-admin-head"><div><span class="eyebrow">Operations</span><h2 id="pwAdminTitle">Admin console</h2><p>${items.length} moderation · ${care.length} care item${care.length===1?'':'s'}</p></div><button class="pw-icon-button" data-admin-close aria-label="Close admin console">×</button></div><div class="pw-admin-stats"><span><b>${esc(stats.users||stats.userCount||0)}</b><small>users</small></span><span><b>${esc(stats.sightings||stats.sightingCount||0)}</b><small>sightings</small></span><span><b>${esc(stats.accepted||stats.acceptedSightings||0)}</b><small>accepted</small></span></div><h3>Moderation</h3><div class="pw-admin-list">${items.length?items.map(item=>`<article class="pw-admin-item"><div><strong>${esc(item.reason)}</strong><small>${esc(item.target_type)} · ${esc(item.target_id)}</small><time>${esc(item.created_at)}</time></div><div class="pw-admin-actions"><button class="btn btn-light btn-small" data-admin-action="dismiss" data-admin-id="${esc(item.id)}">Dismiss</button><button class="btn btn-amber btn-small" data-admin-action="remove" data-admin-id="${esc(item.id)}">Remove</button></div></article>`).join(''):'<div class="pw-admin-empty"><strong>Queue is clear.</strong><span>New reports and uncertain AI checks will appear here.</span></div>'}</div><h3>Care flags</h3><div class="pw-admin-list">${care.length?care.map(item=>`<article class="pw-admin-item"><div><strong>${esc(item.kind)} · ${esc(item.cat_type||'Cat')}</strong><small>${esc(item.note||'No note')}</small><time>${esc(item.created_at)}</time></div><div class="pw-admin-actions"><button class="btn btn-amber btn-small" data-care-action="helped" data-care-id="${esc(item.id)}">Marked helped</button><button class="btn btn-light btn-small" data-care-action="rejected" data-care-id="${esc(item.id)}">Close</button></div></article>`).join(''):'<div class="pw-admin-empty"><strong>No open care flags.</strong><span>Resolved care actions will remain in the audit trail.</span></div>'}</div></div>`;
  };
  const open=async()=>{if(document.getElementById('pawprintAdminConsole'))return;const root=document.createElement('div');root.id='pawprintAdminConsole';root.className='pw-admin-backdrop';root.innerHTML='<div class="pw-admin-card pw-admin-loading" role="status">Loading moderation queue…</div>';document.body.append(root);await render();};
  const discover=async()=>{
    if(loaded||!window.pawprintSession)return;
    try{await request('/api/admin/analytics');}catch{return;}
    loaded=true;
    const host=document.querySelector('.app-header-actions')||document.querySelector('.nav-actions');if(!host||host.querySelector('[data-open-admin]'))return;
    const button=document.createElement('button');button.type='button';button.className='btn btn-light btn-small';button.dataset.openAdmin='1';button.textContent='Moderation';host.prepend(button);
  };
  document.addEventListener('click',async event=>{
    if(event.target.closest('[data-open-admin]')){event.preventDefault();await open();return;}
    if(event.target.closest('[data-admin-close]')||event.target.id==='pawprintAdminConsole'){close();return;}
    const action=event.target.closest('[data-admin-action]');if(!action)return;
    action.disabled=true;
    try{await request(`/api/admin/moderation/${encodeURIComponent(action.dataset.adminId)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:action.dataset.adminAction})});await render();window.notify?.('Moderation decision saved.');}
    catch(error){action.disabled=false;window.notify?.(error.message||'Could not save moderation decision.');}
  });
  document.addEventListener('click',async event=>{
    const action=event.target.closest('[data-care-action]');if(!action)return;action.disabled=true;
    try{await request(`/api/admin/care-flags/${encodeURIComponent(action.dataset.careId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:action.dataset.careAction})});await render();window.notify?.('Care flag updated.');}
    catch(error){action.disabled=false;window.notify?.(error.message||'Could not update care flag.');}
  });
  window.addEventListener('pawprint-authenticated',()=>setTimeout(discover,400));
  window.addEventListener('hashchange',()=>setTimeout(discover,400));
  setTimeout(discover,1200);
})();
