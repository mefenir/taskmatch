'use strict';

/* =========================================================
   ADMIN PANEL — the signup funnel, access requests/gifts,
   feedback sent from the app and crash reports
   Sign in with the admin account (created in the Firebase
   console). Access is checked twice: here, and by the
   Firestore rules (admins/{uid} must exist).
   ========================================================= */
const A = {
  phase: 'loading',     // loading | signedOut | notAdmin | ready | error
  user: null,
  requests: [],
  metrics: [],
  users: [],
  openStep: null,       // funnel: the step whose people are listed
  feedback: [],
  errors: [],
  feedbackFilter: 'new',
  config: {},           // config/beta: { autoApprove }
  openCouple: null,     // journey: the couple whose people are shown
  tab: 'funnel',        // funnel | journey | requests | feedback | errors
  range: 30,            // funnel: households created in the last N days (0 = all)
  filter: 'pending',
  busy: null,           // uid currently being changed
  error: '',
  values: {},
};
let unwatch = null;
let unwatchMetrics = null;
let unwatchUsers = null;
let unwatchFeedback = null;
let unwatchErrors = null;
let unwatchConfig = null;
let unwatchStats = null;
const TABS = ['funnel', 'journey', 'requests', 'feedback', 'errors'];
// In the order a household goes through them. signedUp and requested are worked out from other data.
const STEP_LABEL = {
  signedUp: 'Signed up', created: 'Started setting up', homeDone: 'Described their home', listed: 'Picked their tasks',
  timesDone: 'Set their times', rated: 'Saw their plan', paywall: 'Saw the plans', requested: 'Asked for access',
  checkout: 'Opened checkout', subscribed: 'Subscribed', invited: 'Invited their partner',
  joined: 'Partner joined', reviewed: 'Partner reviewed', started: 'Plan started',
};
// Which step each percentage is measured against ("of <parent>").
const PARENT = {
  created: 'signedUp', homeDone: 'created', listed: 'homeDone', timesDone: 'listed', rated: 'timesDone',
  paywall: 'rated', requested: 'rated', checkout: 'rated', subscribed: 'rated',
  invited: 'subscribed', joined: 'invited', reviewed: 'joined', started: 'reviewed',
};
// The main path, for the Journey tab.
const PATH = ['signedUp', 'created', 'homeDone', 'listed', 'timesDone', 'rated', 'subscribed', 'invited', 'joined', 'reviewed', 'started'];
const STAGE = {
  created: 'Setting up', homeDone: 'Described home', listed: 'Picked tasks', timesDone: 'Set times', rated: 'Saw plan',
  subscribed: 'Has access', invited: 'Invited partner', joined: 'Partner joined', reviewed: 'Partner reviewed', started: 'Plan started',
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

  const newFeedback = A.feedback.filter(f => f.status !== 'done').length;
  const tab = (key, label) => `<button data-action="tab" data-key="${key}" aria-pressed="${A.tab === key}">${label}</button>`;
  const tabs = `<div class="seg" role="group" aria-label="Section">
      ${tab('funnel', 'Funnel')}${tab('journey', 'Journey')}${tab('requests', 'Access requests')}
      ${tab('feedback', `Feedback${newFeedback ? ` (${newFeedback})` : ''}`)}${tab('errors', `Errors${A.errors.length ? ` (${errorGroups().length})` : ''}`)}</div>`;
  const pw = A.pwOpen ? `<div class="card pw-card">
      <div class="field"><label for="a-pw-cur">Current password</label>
        <input id="a-pw-cur" type="password" autocomplete="current-password" value="${esc(A.values.pwCur || '')}" data-field="pwCur"></div>
      <div class="field"><label for="a-pw-new">New password (at least 8 characters)</label>
        <input id="a-pw-new" type="password" autocomplete="new-password" value="${esc(A.values.pwNew || '')}" data-field="pwNew"></div>
      ${A.pwError ? `<p class="form-error" role="alert" style="margin:0 16px 8px">${esc(A.pwError)}</p>` : ''}
      <div class="btns" style="display:flex;gap:8px;padding:0 16px 16px">
        <button class="btn primary" style="flex:1" data-action="savePassword" ${A.busy === 'pw' ? 'disabled' : ''}>${A.busy === 'pw' ? 'Saving…' : 'Save'}</button>
        <button class="btn secondary" style="flex:1" data-action="togglePassword">Cancel</button></div>
    </div>` : '';
  const head = `<div class="topbar"><span class="spacer"></span>
      <button class="link-btn" style="margin:0 16px 0 0" data-action="togglePassword" aria-expanded="${!!A.pwOpen}">Change password</button>
      <button class="link-btn" style="margin:0" data-action="signOut">Sign out</button></div>
    <h1 style="margin-top:0">Admin</h1>${pw}${tabs}`;
  if (A.tab === 'funnel') return `<main class="screen">${head}${funnel()}</main>`;
  if (A.tab === 'journey') return `<main class="screen">${head}${journey()}</main>`;
  if (A.tab === 'feedback') return `<main class="screen">${head}${feedbackList()}</main>`;
  if (A.tab === 'errors') return `<main class="screen">${head}${errorList()}</main>`;

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
    <div class="card"><button class="row" role="switch" aria-checked="${A.config.autoApprove === true}" data-action="toggleAuto" ${A.busy === 'auto' ? 'disabled' : ''}>
      <div class="row-text"><span class="row-title">Approve new requests automatically</span>
      <span class="row-sub">${A.config.autoApprove === true ? 'On: anyone who taps Request access gets in at once. Turn it off when the testers are in.' : 'Off: you approve each request yourself.'}</span></div><span class="switch"></span></button></div>
    <div class="seg" role="group" aria-label="Filter">${FILTERS.map(([k, l]) =>
      `<button data-action="filter" data-key="${esc(k)}" aria-pressed="${A.filter === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="card">${list.length ? list.map(r => `<div class="req">
        <div class="top"><span class="who">${esc(r.name || 'No name')}</span><span class="status ${esc(r.status)}">${r.status === 'approved' && r.decidedBy === 'auto' ? 'Unlocked automatically' : STATUS_LABEL[r.status] || esc(r.status)}</span></div>
        <div class="meta">${esc(r.email || '')}<br>${esc(Number(r.members) || 1)} in household · asked ${when(r.requestedAt)}${r.decidedAt ? ` · changed ${when(r.decidedAt)}` : ''}</div>
        <div class="btns">${buttons(r)}</div>
      </div>`).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>
  </main>`;
}

/** Households created in the period, the people who signed up in it (partners who joined by invite excluded), and requests by household. */
function funnelData() {
  // Counting starts at the chosen period or the last reset, whichever is later.
  const since = Math.max(A.range ? Date.now() - A.range * 864e5 : 0, A.statsResetAt || 0);
  const rows = A.metrics.filter(m => (millis(m.created) || 0) >= since);
  const signups = A.users.filter(u => !u.viaInvite && (u.createdAt || 0) >= since);
  const reqByHid = new Map(A.requests.filter(r => r.householdId).map(r => [r.householdId, r]));
  return { since, rows, signups, reqByHid };
}
/** The time a household reached a step (null if it hasn't). "Asked for access" comes from the access requests. */
const reachedAt = (m, k, reqByHid) => k === 'requested' ? millis((reqByHid.get(m.id) || {}).requestedAt) : millis(m[k]);

/** How many households reached each step, and how many came back a week after starting. */
function funnel() {
  const { rows, signups, reqByHid } = funnelData();
  const steps = Object.keys(STEP_LABEL);
  const n = k => k === 'signedUp' ? signups.length : rows.filter(m => reachedAt(m, k, reqByHid)).length;
  const retained = rows.filter(m => {
    const s = millis(m.started); if (!s) return false;
    return (m.activeDays || []).some(d => Date.parse(d) >= s + 7 * 864e5);
  }).length;
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
  const ranges = [[30, '30 days'], [90, '90 days'], [0, 'All time']];
  const first = n('signedUp');
  return `<div class="seg" role="group" aria-label="Period" style="margin-top:12px">${ranges.map(([k, l]) =>
      `<button data-action="range" data-key="${esc(k)}" aria-pressed="${A.range === k}">${l}</button>`).join('')}</div>
    <div class="card">${steps.map(k => {
      const v = n(k); const parent = PARENT[k];
      const open = A.openStep === k;
      return `<button class="row step-row" data-action="openStep" data-key="${esc(k)}" aria-expanded="${open}"><div class="row-text"><span class="row-title">${STEP_LABEL[k]}</span>
        <span class="row-sub">${parent ? `${pct(v, n(parent))} of ${STEP_LABEL[parent].replace(/^./, c => c.toLowerCase())} · ` : ''}${parent ? `${pct(v, first)} of all` : 'Accounts created, partners who joined by invite not counted'}</span></div>
        <span class="status">${v}</span></button>${open ? (k === 'signedUp' ? whoSignedUp(signups, rows) : whoReached(rows, k, reqByHid)) : ''}`;
    }).join('')}
      <div class="row static"><div class="row-text"><span class="row-title">Still using it a week after starting</span>
        <span class="row-sub">${pct(retained, n('started'))} of plans started</span></div><span class="status">${retained}</span></div>
    </div>
    <p class="fine" style="text-align:left">Households, not people (except Signed up). Counted from when each step was first reached. Tap a step to see who reached it.</p>
    ${resetBlock()}`;
}

/** Start the statistics over (Funnel and Journey). */
function resetBlock() {
  return `<div class="card" style="margin-top:24px"><div class="row static col">
      <div class="row-text"><span class="row-title">Reset statistics</span>
      <span class="row-sub">${A.statsResetAt ? `Last reset ${when(A.statsResetAt)}. ` : ''}Deletes every household's steps and active days, and counts sign-ups and requests from now on. Accounts, homes and access are not touched.</span></div>
      <div class="btns"><button class="btn danger" data-action="resetStats" ${A.busy === 'reset' ? 'disabled' : ''}>${A.busy === 'reset' ? 'Resetting…' : 'Reset statistics'}</button></div>
    </div></div>`;
}

/** Everyone who signed up in the period, newest first; "stopped here" when they never started setting up. */
function whoSignedUp(signups, rows) {
  if (!signups.length) return '<div class="who-list"><p class="meta">Nobody yet.</p></div>';
  const started = new Set(rows.map(m => m.id));
  return `<div class="who-list">${[...signups].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(u => `<div class="who-item">
      <div><span class="who">${esc(u.name || 'No name')}</span> <span class="meta">· ${esc(u.email)}</span></div>
      <div class="meta">${when(u.createdAt)}${u.householdId && started.has(u.householdId) ? '' : ' <span class="status">stopped here</span>'}</div></div>`).join('')}</div>`;
}

/** The people in each household that reached a step, newest first; "stopped here" when it's their furthest step. */
function whoReached(rows, step, reqByHid) {
  const steps = Object.keys(STEP_LABEL).filter(k => k !== 'signedUp' && k !== 'requested');
  const furthest = m => steps.filter(k => m[k]).pop();
  const list = rows.filter(m => reachedAt(m, step, reqByHid)).sort((a, b) => (reachedAt(b, step, reqByHid) || 0) - (reachedAt(a, step, reqByHid) || 0));
  if (!list.length) return '<div class="who-list"><p class="meta">Nobody yet.</p></div>';
  return `<div class="who-list">${list.map(m => {
    const people = A.users.filter(u => u.householdId === m.id);
    const names = people.length ? people.map(u => `<div><span class="who">${esc(u.name || 'No name')}</span> <span class="meta">· ${esc(u.email)}</span></div>`).join('')
      : '<span class="meta">Nobody in this household any more</span>';
    const stop = furthest(m) === step ? ' <span class="status">stopped here</span>' : '';
    return `<div class="who-item"><div>${names}</div><div class="meta">${when(reachedAt(m, step, reqByHid))}${stop}</div></div>`;
  }).join('')}</div>`;
}

/* ---------- Journey: the main path as bars, each couple's progress, and 21 days of activity ---------- */
const DAYS = 21;
const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const coupleName = m => {
  const people = A.users.filter(u => u.householdId === m.id);
  return people.length ? people.map(u => (u.name || u.email || 'No name').split(' ')[0]).join(' & ') : 'Household';
};
const furthestIdx = m => { let i = -1; PATH.forEach((k, j) => { if (j && m[k]) i = j; }); return i; };

function journey() {
  const { rows, signups } = funnelData();
  const ranges = [[30, '30 days'], [90, '90 days'], [0, 'All time']];
  const counts = PATH.map(k => k === 'signedUp' ? signups.length : rows.filter(m => m[k]).length);
  const max = Math.max(1, ...counts);
  // The biggest single drop between neighbouring steps.
  let dropAt = -1, drop = 0;
  counts.forEach((c, i) => { if (i && counts[i - 1] - c > drop) { drop = counts[i - 1] - c; dropAt = i; } });
  const bars = `<div class="card jbars">${PATH.map((k, i) => `<div class="jbar${i === dropAt ? ' drop' : ''}">
      <div class="jlabel"><span>${STEP_LABEL[k]}</span><span class="jn">${counts[i]}</span></div>
      <div class="jtrack"><div class="jfill" style="width:${Math.round(counts[i] / max * 100)}%"></div></div></div>`).join('')}</div>
    ${dropAt > 0 ? `<p class="fine" style="text-align:left">Biggest drop: ${esc(STEP_LABEL[PATH[dropAt - 1]])} → ${esc(STEP_LABEL[PATH[dropAt]])} (${drop} fewer).</p>` : ''}`;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = dayStr(today);
  const lastKey = m => (m.activeDays || []).reduce((a, d) => (d > a ? d : a), '');
  const couples = rows.filter(m => millis(m.created)).sort((a, b) => lastKey(b).localeCompare(lastKey(a)) || (millis(b.created) - millis(a.created)));
  const weekAgo = dayStr(new Date(today.getTime() - 6 * 864e5));
  const activeNow = couples.filter(m => (m.activeDays || []).some(d => d >= weekAgo)).length;

  const board = couples.length ? `<div class="card">${couples.map(m => {
    const idx = furthestIdx(m); const open = A.openCouple === m.id;
    const last = lastKey(m);
    const segs = PATH.slice(1).map((k, j) => `<i class="${j + 1 <= idx ? 'on' : ''}"></i>`).join('');
    const people = A.users.filter(u => u.householdId === m.id);
    return `<button class="row step-row couple" data-action="openCouple" data-id="${esc(m.id)}" aria-expanded="${open}"><div class="row-text">
        <span class="row-title">${esc(coupleName(m))}</span>
        <span class="jsegs" aria-hidden="true">${segs}</span>
        <span class="row-sub">${idx >= 0 ? STAGE[PATH[idx]] : 'Setting up'} · ${last ? `last active ${esc(last === todayKey ? 'today' : last)}` : 'not active yet'}</span></div></button>
      ${open ? `<div class="who-list">${people.length ? people.map(u => `<div class="who-item"><div><span class="who">${esc(u.name || 'No name')}</span> <span class="meta">· ${esc(u.email)}</span></div></div>`).join('') : '<p class="meta">Nobody in this household any more.</p>'}</div>` : ''}`;
  }).join('')}</div>` : '<div class="card"><div class="note" style="border:0">No couples yet.</div></div>';

  // 21-day grid: one row per couple, one column per day since they started.
  const cell = 14, gap = 3, label = 0;
  const grid = couples.length ? `<div class="card jgrid"><div class="jgrid-scroll">${couples.map(m => {
    const start = new Date(millis(m.created)); start.setHours(0, 0, 0, 0);
    const set = new Set(m.activeDays || []);
    const cells = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(start.getTime() + i * 864e5); const key = dayStr(d);
      const x = label + i * (cell + gap);
      if (key > todayKey) return '';
      return set.has(key)
        ? `<rect x="${x}" y="0" width="${cell}" height="${cell}" rx="4" class="on"><title>${key}: active</title></rect>`
        : `<rect x="${x + .75}" y=".75" width="${cell - 1.5}" height="${cell - 1.5}" rx="3.5" class="off"><title>${key}: not active</title></rect>`;
    }).join('');
    return `<div class="jrow"><span class="jname">${esc(coupleName(m))}</span>
      <svg width="${DAYS * (cell + gap)}" height="${cell}" viewBox="0 0 ${DAYS * (cell + gap)} ${cell}" role="img" aria-label="${esc(coupleName(m))}: active on ${(m.activeDays || []).length} of the first ${DAYS} days">${cells}</svg></div>`;
  }).join('')}</div></div>
    <p class="fine" style="text-align:left">Each square is a day since the couple started: filled when they opened the app, outlined when they didn't.</p>` : '';

  return `<div class="seg" role="group" aria-label="Period" style="margin-top:12px">${ranges.map(([k, l]) =>
      `<button data-action="range" data-key="${esc(k)}" aria-pressed="${A.range === k}">${l}</button>`).join('')}</div>
    <h2 class="jh">The path</h2>${bars}
    <h2 class="jh">Couples</h2>
    <p class="lead" style="margin:0 0 8px">Active in the last 7 days: <strong>${activeNow} of ${couples.length}</strong> couples</p>${board}
    <h2 class="jh">First ${DAYS} days</h2>${grid || '<p class="fine" style="text-align:left">Nothing to show yet.</p>'}`;
}

/** Notes from Settings → Send feedback, newest first. */
function feedbackList() {
  const filters = [['new', 'New'], ['done', 'Done'], ['all', 'All']];
  const list = A.feedback.filter(f => A.feedbackFilter === 'all' || (A.feedbackFilter === 'done' ? f.status === 'done' : f.status !== 'done'));
  const count = k => A.feedback.filter(f => k === 'all' || (k === 'done' ? f.status === 'done' : f.status !== 'done')).length;
  return `<div class="seg" role="group" aria-label="Filter" style="margin-top:12px">${filters.map(([k, l]) =>
      `<button data-action="feedbackFilter" data-key="${k}" aria-pressed="${A.feedbackFilter === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="card">${list.length ? list.map(f => `<div class="req">
        <div class="top"><span class="who">${esc(f.name || 'No name')}</span><span class="status ${f.status === 'done' ? 'approved' : 'pending'}">${f.status === 'done' ? 'Done' : 'New'}</span></div>
        <p class="feedback-text">${esc(f.text || '')}</p>
        <div class="meta">${when(f.at)}${f.screen ? ` · on ${esc(f.screen)}` : ''}${f.version ? ` · v${esc(f.version)}` : ''}</div>
        <div class="btns"><button class="btn secondary" data-action="markFeedback" data-id="${esc(f.id)}" data-key="${f.status === 'done' ? 'new' : 'done'}" ${A.busy === f.id ? 'disabled' : ''}>${f.status === 'done' ? 'Mark as new' : 'Mark as done'}</button></div>
      </div>`).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>`;
}

/** Crash reports grouped by message: how often, how many people, which screens, latest first. */
function errorGroups() {
  const groups = new Map();
  A.errors.forEach(e => {
    const key = `${e.message || ''}|${e.where || ''}`;
    const g = groups.get(key) || { key, message: e.message || 'Unknown error', where: e.where || '', ids: [], people: new Set(), names: new Set(), screens: new Set(), versions: new Set(), last: 0, sample: e };
    g.ids.push(e.id); g.people.add(e.uid); if (e.name) g.names.add(e.name);
    if (e.screen) g.screens.add(e.screen); if (e.version) g.versions.add(e.version);
    const t = millis(e.at) || 0; if (t >= g.last) { g.last = t; g.sample = e; }
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => b.people.size - a.people.size || b.last - a.last);
}
function errorList() {
  const groups = errorGroups();
  return `<p class="lead" style="margin:12px 0">Crashes on people's phones, grouped. Fix anything seen by 2 or more people first, then clear it.</p>
    <div class="card">${groups.length ? groups.map(g => `<div class="req">
        <div class="top"><span class="who">${esc(g.message)}</span><span class="status ${g.people.size > 1 ? 'denied' : 'pending'}">${g.ids.length}×</span></div>
        <div class="meta">${g.people.size} ${g.people.size === 1 ? 'person' : 'people'}${g.names.size ? ` (${esc([...g.names].join(', '))})` : ''} · last ${when(g.last)}<br>
          ${g.where ? `at ${esc(g.where)} · ` : ''}${g.screens.size ? `on ${esc([...g.screens].join(', '))}` : ''}${g.versions.size ? ` · v${esc([...g.versions].join(', v'))}` : ''}</div>
        ${g.sample.stack ? `<details class="stack"><summary>Details</summary><pre>${esc(g.sample.stack)}</pre><p class="meta">${esc(g.sample.ua || '')}</p></details>` : ''}
        <div class="btns"><button class="btn secondary" data-action="clearErrors" data-key="${esc(g.key)}" ${A.busy === g.key ? 'disabled' : ''}>Clear</button></div>
      </div>`).join('') : `<div class="note" style="border:0">No errors reported.</div>`}</div>`;
}

function render() { $root.innerHTML = view(); tidyText($root); fitButtons($root); }

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
  tab(d) { A.tab = TABS.includes(d.key) ? d.key : 'funnel'; render(); },
  feedbackFilter(d) { A.feedbackFilter = ['new', 'done', 'all'].includes(d.key) ? d.key : 'new'; render(); },
  async markFeedback(d) {
    if (A.busy) return;
    A.busy = d.id; render();
    try { await Backend.Admin.markFeedback(d.id, d.key === 'new' ? 'new' : 'done'); }
    catch (e) { console.error(e); toast(`Couldn't do that (${e.code || 'error'}). Check the rules are published.`); }
    A.busy = null; render();
  },
  async clearErrors(d) {
    if (A.busy) return;
    const g = errorGroups().find(x => x.key === d.key);
    if (!g || !confirm(`Clear ${g.ids.length} report${g.ids.length === 1 ? '' : 's'} of this error?`)) return;
    A.busy = d.key; render();
    try { await Backend.Admin.clearErrors(g.ids); toast('Cleared.'); }
    catch (e) { console.error(e); toast(`Couldn't do that (${e.code || 'error'}). Check the rules are published.`); }
    A.busy = null; render();
  },
  range(d) { A.range = Number(d.key) || 0; render(); },
  togglePassword() { A.pwOpen = !A.pwOpen; A.pwError = ''; A.values.pwCur = A.values.pwNew = ''; render(); },
  async savePassword() {
    if (A.busy) return;
    const cur = A.values.pwCur || '', next = A.values.pwNew || '';
    if (!cur) { A.pwError = 'Type the current password.'; render(); return; }
    if (next.length < 8) { A.pwError = 'The new password needs at least 8 characters.'; render(); return; }
    A.busy = 'pw'; A.pwError = ''; render();
    try {
      await Backend.Auth.changePassword(cur, next);
      A.pwOpen = false; A.values.pwCur = A.values.pwNew = '';
      toast('Password changed.');
    } catch (e) {
      const c = e && e.code;
      A.pwError = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(c) ? 'The current password is not right.'
        : c === 'auth/too-many-requests' ? 'Too many tries. Wait a moment.' : `Couldn't change it (${c || 'error'}).`;
    }
    A.busy = null; render();
  },
  openCouple(d) { A.openCouple = A.openCouple === d.id ? null : d.id; render(); },
  async toggleAuto() {
    if (A.busy) return;
    const next = A.config.autoApprove !== true;
    if (next && !confirm('Turn on automatic approval? Anyone who taps Request access from now on gets in straight away. Requests already waiting are not changed.')) return;
    A.busy = 'auto'; render();
    try { await Backend.Admin.setAutoApprove(next, A.user.uid); toast(next ? 'Automatic approval is on.' : 'Automatic approval is off.'); }
    catch (e) { console.error(e); toast(`Couldn't do that (${e.code || 'error'}). Check the rules are published.`); }
    A.busy = null; render();
  },
  async resetStats() {
    if (A.busy) return;
    if (!confirm('Reset all statistics?\n\nThis deletes every household\'s funnel steps and active days for good, and the Funnel and Journey start counting from now. Accounts, homes and access are not touched.\n\nThis can\'t be undone.')) return;
    A.busy = 'reset'; render();
    try { const n = await Backend.Admin.resetStats(A.user.uid); A.openStep = null; A.openCouple = null; toast(`Statistics reset. ${n} household record${n === 1 ? '' : 's'} deleted.`); }
    catch (e) { console.error(e); toast(`Couldn't reset (${e.code || 'error'}). Check the rules are published.`); }
    A.busy = null; render();
  },
  openStep(d) { A.openStep = A.openStep === d.key ? null : d.key; render(); },
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
    if (unwatchUsers) { unwatchUsers(); unwatchUsers = null; }
    if (unwatchFeedback) { unwatchFeedback(); unwatchFeedback = null; }
    if (unwatchErrors) { unwatchErrors(); unwatchErrors = null; }
    if (unwatchConfig) { unwatchConfig(); unwatchConfig = null; }
    if (unwatchStats) { unwatchStats(); unwatchStats = null; }
    A.feedback = []; A.errors = [];
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
    unwatchUsers = Backend.Admin.watchUsers(list => { A.users = list; render(); }, e => console.error(e));
    unwatchFeedback = Backend.Admin.watchFeedback(list => { A.feedback = list; render(); }, e => console.error(e));
    unwatchConfig = Backend.Admin.watchConfig(c => { A.config = c || {}; render(); }, e => console.error(e));
    unwatchStats = Backend.Admin.watchStats(st => { A.statsResetAt = (st && st.resetAt) || 0; render(); }, e => console.error(e));
    unwatchErrors = Backend.Admin.watchErrors(list => { A.errors = list; render(); }, e => console.error(e));
  });
})();

/* Keep a focused field above the phone's keyboard (the admin panel on a phone). */
(function keyboardSafe() {
  const vv = window.visualViewport;
  const place = () => {
    const el = document.activeElement;
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const top = (vv ? vv.offsetTop : 0) + 16, bottom = (vv ? vv.offsetTop + vv.height : innerHeight) - 16;
    const r = (el.closest('.field') || el).getBoundingClientRect();
    if (r.bottom > bottom) window.scrollBy(0, r.bottom - bottom);
    else if (r.top < top) window.scrollBy(0, r.top - top);
  };
  document.documentElement.style.scrollPaddingBottom = '120px';
  if (vv) vv.addEventListener('resize', () => setTimeout(place, 60));
  document.addEventListener('focusin', () => { setTimeout(place, 60); setTimeout(place, 350); });
})();
