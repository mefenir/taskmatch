'use strict';

/* =========================================================
   ADMIN PANEL — Premium requests
   Sign in with the admin account (created in the Firebase
   console). Access is checked twice: here, and by the
   Firestore rules (admins/{uid} must exist).
   ========================================================= */
const A = {
  phase: 'loading',     // loading | signedOut | notAdmin | ready | error
  user: null,
  requests: [],
  filter: 'pending',
  busy: null,           // uid currently being changed
  error: '',
  values: {},
};
let unwatch = null;
const $root = document.getElementById('app');

const STATUS_LABEL = { pending: 'Waiting', approved: 'Premium', denied: 'Denied', revoked: 'Revoked' };
const FILTERS = [['pending', 'Waiting'], ['approved', 'Premium'], ['closed', 'Closed'], ['all', 'All']];

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
const when = ts => {
  if (!ts) return '—';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function view() {
  if (A.phase === 'loading') return `<main class="screen center-screen"><div class="spinner" aria-hidden="true"></div><p class="lead" style="margin-top:16px">Loading…</p></main>`;
  if (A.phase === 'error') return `<main class="screen"><h1>Admin</h1><p class="form-error">${esc(A.error)}</p>
    <button class="btn secondary" data-action="signOut">Sign out</button></main>`;

  if (A.phase === 'signedOut') return `<main class="screen">
    <h1>Admin</h1>
    <p class="lead">Sign in with the admin username and password.</p>
    ${A.error ? `<p class="form-error" role="alert">${esc(A.error)}</p>` : ''}
    <form class="auth-form" data-form="login" novalidate>
      <div class="field"><label for="a-email">Username (email)</label>
        <input id="a-email" type="email" autocomplete="username" value="${esc(A.values.email || '')}" data-field="email"></div>
      <div class="field"><label for="a-pw">Password</label>
        <input id="a-pw" type="password" autocomplete="current-password" data-field="password"></div>
      <button class="btn primary" type="submit" style="margin-top:20px" ${A.busy ? 'disabled' : ''}>${A.busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>`;

  if (A.phase === 'notAdmin') return `<main class="screen"><h1>Admin</h1>
    <p class="lead">${esc(A.user.email || 'This account')} isn't an admin account.</p>
    <button class="btn secondary" data-action="signOut">Sign out</button></main>`;

  const matches = r => A.filter === 'all' || r.status === A.filter || (A.filter === 'closed' && (r.status === 'denied' || r.status === 'revoked'));
  const list = A.requests.filter(matches);
  const count = k => A.requests.filter(r => k === 'all' || r.status === k || (k === 'closed' && (r.status === 'denied' || r.status === 'revoked'))).length;
  const buttons = r => {
    const dis = A.busy === r.id ? 'disabled' : '';
    if (r.status === 'pending') return `<button class="btn primary" data-action="unlock" data-id="${r.id}" ${dis}>Unlock Premium</button>
      <button class="btn secondary" data-action="deny" data-id="${r.id}" ${dis}>Deny</button>`;
    if (r.status === 'approved') return `<button class="btn secondary" data-action="revoke" data-id="${r.id}" ${dis}>Revoke Premium</button>`;
    return `<button class="btn primary" data-action="unlock" data-id="${r.id}" ${dis}>Unlock Premium</button>`;
  };
  return `<main class="screen">
    <div class="topbar"><span class="spacer"></span><button class="link-btn" style="margin:0" data-action="signOut">Sign out</button></div>
    <h1 style="margin-top:0">Premium requests</h1>
    <p class="lead" style="margin-bottom:12px">Signed in as ${esc(A.user.email || '')}. Unlocking gives the whole household Premium.</p>
    <div class="seg" role="group" aria-label="Filter">${FILTERS.map(([k, l]) =>
      `<button data-action="filter" data-key="${k}" aria-pressed="${A.filter === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="card">${list.length ? list.map(r => `<div class="req">
        <div class="top"><span class="who">${esc(r.name || 'No name')}</span><span class="status ${esc(r.status)}">${STATUS_LABEL[r.status] || esc(r.status)}</span></div>
        <div class="meta">${esc(r.email || '')}<br>${r.members || 1} in household · asked ${when(r.requestedAt)}${r.decidedAt ? ` · changed ${when(r.decidedAt)}` : ''}</div>
        <div class="btns">${buttons(r)}</div>
      </div>`).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>
  </main>`;
}

function render() { $root.innerHTML = view(); }

async function act(kind, userId) {
  A.busy = userId; render();
  try {
    if (kind === 'unlock') await Backend.Admin.unlock(userId, A.user.uid);
    if (kind === 'deny') await Backend.Admin.deny(userId, A.user.uid);
    if (kind === 'revoke') await Backend.Admin.revoke(userId, A.user.uid);
    toast({ unlock: 'Premium unlocked.', deny: 'Request denied.', revoke: 'Premium revoked.' }[kind]);
  } catch (e) {
    console.error(e);
    toast(`Couldn't do that (${e.code || 'error'}). Check the rules are published.`);
  }
  A.busy = null; render();
}

const Actions = {
  signOut() { Backend.Auth.signOut(); },
  filter(d) { A.filter = d.key; render(); },
  unlock(d) { act('unlock', d.id); },
  deny(d) { act('deny', d.id); },
  revoke(d) { if (confirm('Revoke Premium for this household?')) act('revoke', d.id); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn({ ...el.dataset }); }
});
document.addEventListener('input', e => { if (e.target.dataset.field) A.values[e.target.dataset.field] = e.target.value; });
document.addEventListener('submit', async e => {
  if (!e.target.closest('[data-form="login"]')) return;
  e.preventDefault();
  const email = (A.values.email || '').trim(), password = A.values.password || '';
  if (!email || !password) { A.error = 'Enter the username and password.'; render(); return; }
  A.busy = 'login'; A.error = ''; render();
  try { await Backend.Auth.signIn(email, password); }
  catch (err) { A.error = 'Username or password is incorrect.'; A.busy = null; render(); }
});

(function boot() {
  if (!Backend.sdkLoaded() || !Backend.init()) {
    A.phase = 'error'; A.error = "Couldn't connect to Firebase. Check js/config.js and your connection."; render(); return;
  }
  Backend.Auth.onChange(async user => {
    if (unwatch) { unwatch(); unwatch = null; }
    A.user = user; A.busy = null; A.requests = [];
    if (!user) { A.phase = 'signedOut'; render(); return; }
    A.phase = 'loading'; render();
    try {
      if (!(await Backend.Admin.isAdmin(user.uid))) { A.phase = 'notAdmin'; render(); return; }
    } catch (e) { A.phase = 'notAdmin'; render(); return; }
    A.phase = 'ready'; render();
    unwatch = Backend.Admin.watchRequests(list => { A.requests = list; render(); }, e => {
      console.error(e); A.phase = 'error'; A.error = `Couldn't load requests (${e.code || 'error'}). Publish the latest firestore.rules.`; render();
    });
  });
})();
