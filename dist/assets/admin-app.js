const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const setStatus = (node, message, kind = '') => { node.textContent = message; node.className = `status ${kind}`; };
let supabaseClient = null;
let session = null;

async function request(path, options = {}) {
  const token = session?.access_token;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('accept', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `REQUEST_FAILED_${response.status}`);
  return data;
}

function renderStats(analytics) {
  const metrics = analytics.metrics || analytics.stats || analytics;
  $('#statsGrid').innerHTML = [
    ['users', metrics.users ?? metrics.userCount ?? 0],
    ['sightings', metrics.sightings ?? metrics.sightingCount ?? 0],
    ['accepted', metrics.acceptedPhotos ?? metrics.acceptedSightings ?? metrics.accepted ?? 0],
    ['open reports', metrics.openReports ?? metrics.reports ?? 0],
  ].map(([label, value]) => `<article class="stat-card"><b>${esc(value)}</b><small>${esc(label)}</small></article>`).join('');
}

function renderQueue(node, items, emptyMessage, type) {
  if (!items.length) { node.innerHTML = `<div class="empty">${esc(emptyMessage)}</div>`; return; }
  node.innerHTML = items.map((item) => {
    const id = esc(item.id);
    if (type === 'moderation') return `<article class="queue-item"><div><strong>${esc(item.reason || 'Review needed')}</strong><small>${esc(item.target_type)} · ${esc(item.target_id)}</small><time>${esc(item.created_at)}</time></div><div class="queue-actions"><button data-admin-action="dismiss" data-id="${id}">Dismiss</button><button class="danger" data-admin-action="remove" data-id="${id}">Remove</button></div></article>`;
    return `<article class="queue-item"><div><strong>${esc(item.kind || 'Care flag')} · ${esc(item.cat_type || 'Cat')}</strong><small>${esc(item.note || 'No note')}</small><time>${esc(item.created_at)}</time></div><div class="queue-actions"><button data-care-action="helped" data-id="${id}">Marked helped</button><button data-care-action="rejected" data-id="${id}">Close</button></div></article>`;
  }).join('');
}

async function loadDashboard() {
  setStatus($('#dashboardStatus'), 'Refreshing queues…');
  try {
    const [analytics, moderation, care] = await Promise.all([request('/api/admin/analytics'), request('/api/admin/moderation'), request('/api/admin/care-flags')]);
    const moderationItems = moderation.items || [];
    const careItems = care.items || [];
    renderStats(analytics);
    $('#moderationCount').textContent = moderationItems.length;
    $('#careCount').textContent = careItems.length;
    renderQueue($('#moderationList'), moderationItems, 'Queue is clear.', 'moderation');
    renderQueue($('#careList'), careItems, 'No open care flags.', 'care');
    setStatus($('#dashboardStatus'), `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, 'success');
  } catch (error) {
    setStatus($('#dashboardStatus'), error.message === 'ADMIN_REQUIRED' ? 'This account is not approved for admin access.' : `Could not load operations data: ${error.message}`, 'error');
  }
}

async function enterApp(nextSession) {
  session = nextSession;
  if (!session) { $('#authCard').hidden = false; $('#dashboard').hidden = true; $('#signOutButton').hidden = true; return; }
  $('#authCard').hidden = true;
  $('#dashboard').hidden = false;
  $('#signOutButton').hidden = false;
  $('#adminIdentity').textContent = session.user?.email || 'Authenticated operations user';
  await loadDashboard();
}

async function boot() {
  try {
    const config = await fetch('/api/auth/config').then((response) => response.json());
    if (!config.enabled || !config.url || !config.anonKey) throw new Error('Supabase Auth is not configured.');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.4');
    supabaseClient = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const current = await supabaseClient.auth.getSession();
    await enterApp(current.data.session);
    supabaseClient.auth.onAuthStateChange((_event, nextSession) => { void enterApp(nextSession); });
  } catch (error) { setStatus($('#authStatus'), error.message || 'Unable to initialize secure admin sign-in.', 'error'); }
}

$('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus($('#authStatus'), 'Signing in…');
  try {
    const values = new FormData(event.currentTarget);
    const result = await supabaseClient.auth.signInWithPassword({ email: String(values.get('email')), password: String(values.get('password')) });
    if (result.error) throw result.error;
    setStatus($('#authStatus'), 'Signed in. Checking admin access…', 'success');
    await enterApp(result.data.session);
  } catch (error) { setStatus($('#authStatus'), error.message || 'Sign-in failed.', 'error'); }
  finally { button.disabled = false; }
});

$('#refreshButton').addEventListener('click', () => void loadDashboard());
$('#signOutButton').addEventListener('click', () => void supabaseClient?.auth.signOut());
document.addEventListener('click', async (event) => {
  const moderation = event.target.closest('[data-admin-action]');
  const care = event.target.closest('[data-care-action]');
  const action = moderation || care;
  if (!action) return;
  action.disabled = true;
  try {
    if (moderation) await request(`/api/admin/moderation/${encodeURIComponent(action.dataset.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: action.dataset.adminAction }) });
    else await request(`/api/admin/care-flags/${encodeURIComponent(action.dataset.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: action.dataset.careAction }) });
    await loadDashboard();
  } catch (error) { setStatus($('#dashboardStatus'), error.message || 'Could not save that decision.', 'error'); action.disabled = false; }
});

boot();
