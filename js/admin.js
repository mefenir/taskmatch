'use strict';

/* =========================================================
   ADMIN PANEL — access requests/gifts and the signup funnel
   Sign in with the admin account (created in the Firebase
   console). Access is checked twice: here, and by the
   Firestore rules (admins/{uid} must exist).
   ========================================================= */
const A = {
  phase: 'loading',     // loading | signedOut | notAdmin | ready | error
  user: null,
  requests: [],
  metrics: [],
  tab: 'funnel',        // funnel | requests
  range: 30,            // funnel: households created in the last N days (0 = all)
  filter: 'pending',
  busy: null,           // uid currently being changed
  error: '',
  values: {},
};
let unwatch = null;
let unwatchMetrics = null;
// In the order a household goes through them.
const STEP_LABEL = {
  created: 'Started setting up', listed: 'Picked their tasks', rated: 'Saw their plan', paywall: 'Saw the plans',
  checkout: 'Opened checkout', subscribed: 'Subscribed or trial', invited: 'Invited their partner',
  joined: 'Partner joined', reviewed: 'Partner reviewed', started: 'Plan started',
};
const millis = t => (!t ? null : typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : Date.parse(t));
const $root = document.getElementById('app');

const STATUS_LABEL = { pending: 'Waiting', approved: 'Unlocked', denied: 'Denied', revoked: 'Revoked', cancelled: 'Cancelled by user' };
const CLOSED = ['denied', 'revoked', 'cancelled'];
const FILTERS = [['pending', 'Waiting'], ['approved', 'Unlocked'], ['closed', 'Closed'], ['all', 'All']];

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

  const tabs = `<div class="seg" role="group" aria-label="Section">
      <button data-action="tab" data-key="funnel" aria-pressed="${A.tab === 'funnel'}">Funnel</button>
      <button data-action="tab" data-key="requests" aria-pressed="${A.tab === 'requests'}">Access requests</button></div>`;
  const head = `<div class="topbar"><span class="spacer"></span><button class="link-btn" style="margin:0" data-action="signOut">Sign out</button></div>
    <h1 style="margin-top:0">Admin</h1>${tabs}`;
  if (A.tab === 'funnel') return `<main class="screen">${head}${funnel()}</main>`;

  const matches = r => A.filter === 'all' || r.status === A.filter || (A.filter === 'closed' && CLOSED.includes(r.status));
  const list = A.requests.filter(matches);
  const count = k => A.requests.filter(r => k === 'all' || r.status === k || (k === 'closed' && CLOSED.includes(r.status))).length;
  const buttons = r => {
    const dis = A.busy === r.id ? 'disabled' : '';
    if (r.status === 'pending') return `<button class="btn primary" data-action="unlock" data-id="${esc(r.id)}" ${dis}>Unlock</button>
      <button class="btn secondary" data-action="deny" data-id="${esc(r.id)}" ${dis}>Deny</button>`;
    if (r.status === 'approved') return `<button class="btn secondary" data-action="revoke" data-id="${esc(r.id)}" ${dis}>Revoke</button>`;
    return `<button class="btn primary" data-action="unlock" data-id="${esc(r.id)}" ${dis}>Unlock</button>`;
  };
  return `<main class="screen">${head}
    <p class="lead" style="margin-bottom:12px">Signed in as ${esc(A.user.email || '')}. Unlocking gives the whole household access without paying (for gifts and tests; paid subscriptions run through Stripe).</p>
    <div class="seg" role="group" aria-label="Filter">${FILTERS.map(([k, l]) =>
      `<button data-action="filter" data-key="${esc(k)}" aria-pressed="${A.filter === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="card">${list.length ? list.map(r => `<div class="req">
        <div class="top"><span class="who">${esc(r.name || 'No name')}</span><span class="status ${esc(r.status)}">${STATUS_LABEL[r.status] || esc(r.status)}</span></div>
        <div class="meta">${esc(r.email || '')}<br>${esc(Number(r.members) || 1)} in household · asked ${when(r.requestedAt)}${r.decidedAt ? ` · changed ${when(r.decidedAt)}` : ''}</div>
        <div class="btns">${buttons(r)}</div>
      </div>`).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>
  </main>`;
}

/** How many households reached each step, and how many came back a week after starting. */
function funnel() {
  const since = A.range ? Date.now() - A.range * 864e5 : 0;
  const rows = A.metrics.filter(m => (millis(m.created) || 0) >= since);
  const steps = Object.keys(STEP_LABEL);
  const n = k => rows.filter(m => m[k]).length;
  const first = n('created') || 0;
  const retained = rows.filter(m => {
    const s = millis(m.started); if (!s) return false;
    return (m.activeDays || []).some(d => Date.parse(d) >= s + 7 * 864e5);
  }).length;
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
  const ranges = [[30, '30 days'], [90, '90 days'], [0, 'All time']];
  return `<div class="seg" role="group" aria-label="Period" style="margin-top:12px">${ranges.map(([k, l]) =>
      `<button data-action="range" data-key="${esc(k)}" aria-pressed="${A.range === k}">${l}</button>`).join('')}</div>
    <div class="card">${steps.map((k, i) => {
      const v = n(k); const prev = i ? n(steps[i - 1]) : v;
      return `<div class="row static"><div class="row-text"><span class="row-title">${STEP_LABEL[k]}</span>
        <span class="row-sub">${i ? `${pct(v, prev)} of the step before · ` : ''}${pct(v, first)} of all</span></div>
        <span class="status">${v}</span></div>`;
    }).join('')}
      <div class="row static"><div class="row-text"><span class="row-title">Still using it a week after starting</span>
        <span class="row-sub">${pct(retained, n('started'))} of plans started</span></div><span class="status">${retained}</span></div>
    </div>
    <p class="fine" style="text-align:left">Households, not people. Counted from when each step was first reached.</p>`;
}

function render() { $root.innerHTML = view(); fitButtons($root); }

async function act(kind, userId) {
  A.busy = userId; render();
  try {
    if (kind === 'unlock') await Backend.Admin.unlock(userId, A.user.uid);
    if (kind === 'deny') await Backend.Admin.deny(userId, A.user.uid);
    if (kind === 'revoke') await Backend.Admin.revoke(userId, A.user.uid);
    toast({ unlock: 'Unlocked.', deny: 'Request denied.', revoke: 'Access revoked.' }[kind]);
  } catch (e) {
    console.error(e);
    toast(`Couldn't do that (${e.code || 'error'}). Check the rules are published.`);
  }
  A.busy = null; render();
}

const Actions = {
  signOut() { Backend.Auth.signOut(); },
  filter(d) { A.filter = d.key; render(); },
  tab(d) { A.tab = d.key === 'requests' ? 'requests' : 'funnel'; render(); },
  range(d) { A.range = Number(d.key) || 0; render(); },
  unlock(d) { act('unlock', d.id); },
  deny(d) { act('deny', d.id); },
  revoke(d) { if (confirm('Revoke access for this household?')) act('revoke', d.id); },
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
    if (unwatchMetrics) { unwatchMetrics(); unwatchMetrics = null; }
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
    unwatchMetrics = Backend.Admin.watchMetrics(list => { A.metrics = list; render(); }, e => console.error(e));
  });
})();
