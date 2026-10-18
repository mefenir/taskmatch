'use strict';

/* =========================================================
   ADMIN PANEL — Inbox (access requests, feedback, crash reports),
   Couples (the path and each couple) and Settings
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
  openStep: null,       // couples: the path step whose people are listed
  feedback: [],
  errors: [],
  config: {},           // config/beta: { autoApprove }
  openCouple: null,     // couples: the couple that is opened
  tab: 'inbox',         // inbox | couples | settings
  inboxView: '',        // '' | access | feedback (the history pages under Inbox)
  range: 30,            // couples: households created in the last N days (0 = all)
  filter: 'approved',   // access history
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
const TABS = ['inbox', 'couples', 'settings'];
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

  const title = { inbox: 'Inbox', couples: 'Couples', settings: 'Settings' }[A.tab];
  const body = A.tab === 'couples' ? couples() : A.tab === 'settings' ? settings() : inbox();
  return `<main class="screen has-nav">${body.startsWith('<!--sub-->') ? '' : `<h1 class="adm-title">${title}</h1>`}${body}</main>${nav()}`;
}

/* ---------- Navigation: three sections, a dot on Inbox when something waits ---------- */
const ico = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
function waitingCount() {
  return A.requests.filter(r => r.status === 'pending').length + A.feedback.filter(f => f.status !== 'done').length + errorGroups().length;
}
function nav() {
  const item = (key, label, icon, dot) => `<button data-action="tab" data-key="${key}" ${A.tab === key ? 'aria-current="page"' : ''}${dot ? ` aria-label="${label}, needs your attention"` : ''}>
      <span class="nav-icon">${ico(icon)}${dot ? '<span class="nav-dot" aria-hidden="true"></span>' : ''}</span><span>${label}</span></button>`;
  return `<nav class="bottom-nav" aria-label="Sections"><div class="inner">
    ${item('inbox', 'Inbox', '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>', A.tab !== 'inbox' && waitingCount() > 0)}
    ${item('couples', 'Couples', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>')}
    ${item('settings', 'Settings', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')}
  </div></nav>`;
}
const sectionHead = (label, n, note) => `<div class="adm-sec"><h2 class="section-title">${label}${n != null ? ` <span class="adm-count">${n}</span>` : ''}</h2>${note ? `<p class="adm-note">${note}</p>` : ''}</div>`;
const backTo = label => `<button class="link-btn adm-back" data-action="inboxView" data-key="">‹ ${label}</button>`;

/* ---------- Inbox: everything waiting for you, each with its one action ---------- */
function requestCard(r) {
  const dis = A.busy === r.id ? 'disabled' : '';
  const buttons = r.status === 'pending'
    ? `<button class="btn primary" data-action="unlock" data-id="${esc(r.id)}" ${dis}>Unlock</button><button class="btn secondary" data-action="deny" data-id="${esc(r.id)}" ${dis}>Deny</button>`
    : r.status === 'approved' ? `<button class="btn secondary" data-action="revoke" data-id="${esc(r.id)}" ${dis}>Revoke</button>`
    : `<button class="btn primary" data-action="unlock" data-id="${esc(r.id)}" ${dis}>Unlock</button>`;
  const status = r.status === 'pending' ? '' : `<span class="status ${esc(r.status)}">${r.status === 'approved' && r.decidedBy === 'auto' ? 'Unlocked automatically' : STATUS_LABEL[r.status] || esc(r.status)}</span>`;
  return `<div class="req">
    <div class="top"><span class="who">${esc(r.name || 'No name')}</span>${status}</div>
    <div class="meta">${esc(r.email || '')}<br>${esc(Number(r.members) || 1)} in household · asked ${when(r.requestedAt)}${r.decidedAt ? ` · changed ${when(r.decidedAt)}` : ''}</div>
    <div class="btns">${buttons}</div></div>`;
}
function feedbackCard(f) {
  const done = f.status === 'done';
  return `<div class="req">
    <div class="top"><span class="who">${esc(f.name || 'No name')}</span>${FEEDBACK_TYPES[f.type] ? `<span class="tag">${FEEDBACK_TYPES[f.type]}</span>` : ''}</div>
    ${f.text ? `<p class="feedback-text">${esc(f.text)}</p>` : ''}
    <div class="meta">${when(f.at)}${f.screen ? ` · on ${esc(f.screen)}` : ''}${f.version ? ` · v${esc(f.version)}` : ''}</div>
    <div class="btns"><button class="btn secondary" data-action="markFeedback" data-id="${esc(f.id)}" data-key="${done ? 'new' : 'done'}" ${A.busy === f.id ? 'disabled' : ''}>${done ? 'Mark as new' : 'Mark as done'}</button></div></div>`;
}
function errorCard(g) {
  return `<div class="req">
    <div class="top"><span class="who">${esc(g.message)}</span><span class="status ${g.people.size > 1 ? 'denied' : 'pending'}">${g.ids.length}×</span></div>
    <div class="meta">${g.people.size} ${g.people.size === 1 ? 'person' : 'people'}${g.names.size ? ` (${esc([...g.names].join(', '))})` : ''} · last ${when(g.last)}${g.versions.size ? ` · v${esc([...g.versions].join(', v'))}` : ''}</div>
    ${errorDetails(g)}
    <div class="btns"><button class="btn secondary" data-action="clearErrors" data-key="${esc(g.key)}" ${A.busy === g.key ? 'disabled' : ''}>Clear</button></div></div>`;
}
function inbox() {
  if (A.inboxView === 'access') return accessHistory();
  if (A.inboxView === 'feedback') return doneFeedback();
  const waiting = A.requests.filter(r => r.status === 'pending');
  const fresh = A.feedback.filter(f => f.status !== 'done');
  const groups = errorGroups();
  const parts = [];
  if (waiting.length) parts.push(`${sectionHead('Waiting for access', waiting.length)}<div class="card">${waiting.map(requestCard).join('')}</div>`);
  if (fresh.length) parts.push(`${sectionHead('Feedback', fresh.length)}<div class="card">${fresh.map(feedbackCard).join('')}</div>`);
  if (groups.length) parts.push(`${sectionHead('Errors', groups.length, 'Fix what 2 or more people hit first.')}<div class="card">${groups.map(errorCard).join('')}</div>`);
  const decided = A.requests.length - waiting.length, done = A.feedback.length - fresh.length;
  const more = `<div class="card adm-more">
      <button class="row" data-action="inboxView" data-key="access"><div class="row-text"><span class="row-title">Access history</span></div><span class="adm-n">${decided}</span><span class="chev" aria-hidden="true">›</span></button>
      <button class="row" data-action="inboxView" data-key="feedback"><div class="row-text"><span class="row-title">Done feedback</span></div><span class="adm-n">${done}</span><span class="chev" aria-hidden="true">›</span></button></div>`;
  const clear = `<div class="card adm-clear"><p class="row-title">All clear</p><p class="adm-note">Nothing needs you right now.</p></div>`;
  return `${parts.length ? parts.join('') : clear}${sectionHead('Earlier')}${more}`;
}
function accessHistory() {
  const filters = [['approved', 'Unlocked'], ['closed', 'Closed'], ['all', 'All']];
  const f = filters.some(([k]) => k === A.filter) ? A.filter : 'approved';
  const matches = (r, k) => r.status !== 'pending' && (k === 'all' || r.status === k || (k === 'closed' && CLOSED.includes(r.status)));
  const list = A.requests.filter(r => matches(r, f));
  return `<!--sub-->${backTo('Inbox')}<h1 class="adm-title">Access history</h1>
    <div class="seg" role="group" aria-label="Filter">${filters.map(([k, l]) =>
      `<button data-action="filter" data-key="${k}" aria-pressed="${f === k}">${l} (${A.requests.filter(r => matches(r, k)).length})</button>`).join('')}</div>
    <div class="card">${list.length ? list.map(requestCard).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>`;
}
function doneFeedback() {
  const list = A.feedback.filter(f => f.status === 'done');
  return `<!--sub-->${backTo('Inbox')}<h1 class="adm-title">Done feedback</h1>
    <div class="card">${list.length ? list.map(feedbackCard).join('') : `<div class="note" style="border:0">Nothing here.</div>`}</div>`;
}

/* ---------- Couples: headline numbers, the path, and each couple ---------- */
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
/** The payment steps only show once Stripe prices are set (before that, nobody pays). */
const payments = () => !!(Backend.Billing && Backend.Billing.enabled());
const path = () => payments() ? [...PATH.slice(0, 6), 'paywall', 'checkout', ...PATH.slice(6)] : PATH;
const stepLabel = k => (k === 'subscribed' && !payments() ? 'Got access' : STEP_LABEL[k]);
const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');

function couples() {
  const { rows, signups, reqByHid } = funnelData();
  const steps = path();
  const n = k => k === 'signedUp' ? signups.length : rows.filter(m => reachedAt(m, k, reqByHid)).length;
  const counts = steps.map(n);
  const retained = rows.filter(m => {
    const s = millis(m.started); if (!s) return false;
    return (m.activeDays || []).some(d => Date.parse(d) >= s + 7 * 864e5);
  }).length;
  const started = n('started');
  const ranges = [[30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']];
  const period = `<label class="adm-period"><span class="sr-only">Period</span><select data-change="range">${ranges.map(([k, l]) =>
      `<option value="${k}" ${A.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const tile = (num, label, sub) => `<div class="adm-tile"><span class="adm-big">${num}</span><span class="adm-tl">${label}</span>${sub ? `<span class="adm-ts">${sub}</span>` : ''}</div>`;
  const tiles = `<div class="adm-tiles">
      ${tile(counts[0], 'Signed up')}
      ${tile(started, 'Plan started', counts[0] ? `${pct(started, counts[0])} of sign-ups` : '')}
      ${tile(retained, 'A week later', started ? `${pct(retained, started)} still using it` : 'Still using it')}</div>`;

  // The biggest single drop between neighbouring steps.
  let dropAt = -1, drop = 0;
  counts.forEach((c, i) => { if (i && counts[i - 1] - c > drop) { drop = counts[i - 1] - c; dropAt = i; } });
  const max = Math.max(1, ...counts);
  const bars = `<div class="card">${steps.map((k, i) => {
    const open = A.openStep === k;
    const share = i && counts[i - 1] ? pct(counts[i], counts[i - 1]) : '';
    const sub = i === 0 ? 'Partners who joined by invite not counted' : i === dropAt ? `Biggest drop: ${drop} fewer than the step before` : '';
    return `<button class="row step-row jbar${i === dropAt ? ' drop' : ''}" data-action="openStep" data-key="${esc(k)}" data-count="${counts[i]}" aria-expanded="${open}"${share ? ` aria-label="${esc(stepLabel(k))}: ${counts[i]}, ${share} of the step before"` : ''}>
        <div class="row-text"><span class="jlabel"><span class="row-title">${esc(stepLabel(k))}</span><span class="jn">${share ? `<span class="jpct">${share}</span>` : ''}${counts[i]}</span></span>
        <span class="jtrack"><span class="jfill" style="width:${Math.round(counts[i] / max * 100)}%"></span></span>
        ${sub ? `<span class="row-sub">${sub}</span>` : ''}</div></button>
      ${open ? (k === 'signedUp' ? whoSignedUp(signups, rows) : whoReached(rows, k, reqByHid)) : ''}`;
  }).join('')}</div>`;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = dayStr(today);
  const lastKey = m => (m.activeDays || []).reduce((a, d) => (d > a ? d : a), '');
  const list = rows.filter(m => millis(m.created)).sort((a, b) => lastKey(b).localeCompare(lastKey(a)) || (millis(b.created) - millis(a.created)));
  const weekAgo = dayStr(new Date(today.getTime() - 6 * 864e5));
  const activeNow = list.filter(m => (m.activeDays || []).some(d => d >= weekAgo)).length;
  const board = list.length ? `<div class="card">${list.map(m => {
    const idx = furthestIdx(m); const open = A.openCouple === m.id;
    const last = lastKey(m);
    const segs = PATH.slice(1).map((k, j) => `<i class="${j + 1 <= idx ? 'on' : ''}"></i>`).join('');
    return `<button class="row step-row couple" data-action="openCouple" data-id="${esc(m.id)}" aria-expanded="${open}"><div class="row-text">
        <span class="row-title">${esc(coupleName(m))}</span>
        <span class="jsegs" aria-hidden="true">${segs}</span>
        <span class="row-sub">${idx >= 0 ? (PATH[idx] === 'subscribed' && !payments() ? 'Got access' : STAGE[PATH[idx]]) : 'Setting up'} · ${last ? `last active ${esc(last === todayKey ? 'today' : last)}` : 'not active yet'}</span></div></button>
      ${open ? coupleDetail(m, todayKey) : ''}`;
  }).join('')}</div>` : '<div class="card"><div class="note" style="border:0">No couples yet.</div></div>';

  return `${period}${tiles}
    ${sectionHead('The path', null, 'Households per step, and the share of the step before. Tap one to see who.')}${bars}
    ${sectionHead('Couples', null, `Active in the last 7 days: <strong>${activeNow} of ${list.length}</strong>`)}${board}`;
}

/** One couple opened: who they are and their first 21 days. */
function coupleDetail(m, todayKey) {
  const people = A.users.filter(u => u.householdId === m.id);
  const names = people.length ? people.map(u => `<div class="who-item"><div><span class="who">${esc(u.name || 'No name')}</span> <span class="meta">· ${esc(u.email)}</span></div></div>`).join('')
    : '<p class="meta">Nobody in this household any more.</p>';
  const cell = 12, gap = 3;
  const start = new Date(millis(m.created)); start.setHours(0, 0, 0, 0);
  const set = new Set(m.activeDays || []);
  let active = 0, shown = 0;
  const cells = Array.from({ length: DAYS }, (_, i) => {
    const key = dayStr(new Date(start.getTime() + i * 864e5));
    const x = i * (cell + gap);
    if (key > todayKey) return '';
    shown++;
    if (set.has(key)) { active++; return `<rect x="${x}" y="0" width="${cell}" height="${cell}" rx="3.5" class="on"><title>${key}: active</title></rect>`; }
    return `<rect x="${x + .75}" y=".75" width="${cell - 1.5}" height="${cell - 1.5}" rx="3" class="off"><title>${key}: not active</title></rect>`;
  }).join('');
  const w = DAYS * (cell + gap);
  return `<div class="who-list">${names}
    <div class="jdays"><span class="meta">First ${DAYS} days: active on ${active} of ${shown}</span>
      <svg width="100%" viewBox="0 0 ${w} ${cell}" style="max-width:${w}px" role="img" aria-label="Active on ${active} of the first ${shown} days">${cells}</svg></div></div>`;
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
  const steps = path().filter(k => k !== 'signedUp' && k !== 'requested');
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

const DAYS = 21;
const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const coupleName = m => {
  const people = A.users.filter(u => u.householdId === m.id);
  return people.length ? people.map(u => (u.name || u.email || 'No name').split(' ')[0]).join(' & ') : 'Household';
};
const furthestIdx = m => { let i = -1; PATH.forEach((k, j) => { if (j && m[k]) i = j; }); return i; };

/* ---------- Settings: access, account, and the one risky button ---------- */
function settings() {
  const auto = A.config.autoApprove === true;
  const pw = A.pwOpen ? `<div class="pw-form">
      <div class="field"><label for="a-pw-cur">Current password</label>
        <input id="a-pw-cur" type="password" autocomplete="current-password" value="${esc(A.values.pwCur || '')}" data-field="pwCur"></div>
      <div class="field"><label for="a-pw-new">New password (at least 8 characters)</label>
        <input id="a-pw-new" type="password" autocomplete="new-password" value="${esc(A.values.pwNew || '')}" data-field="pwNew"></div>
      ${A.pwError ? `<p class="form-error" role="alert">${esc(A.pwError)}</p>` : ''}
      <div class="btns"><button class="btn primary" data-action="savePassword" ${A.busy === 'pw' ? 'disabled' : ''}>${A.busy === 'pw' ? 'Saving…' : 'Save'}</button>
        <button class="btn secondary" data-action="togglePassword">Cancel</button></div></div>` : '';
  return `${sectionHead('Access')}
    <div class="card"><button class="row" role="switch" aria-checked="${auto}" data-action="toggleAuto" ${A.busy === 'auto' ? 'disabled' : ''}>
      <div class="row-text"><span class="row-title">Approve requests automatically</span>
      <span class="row-sub">${auto ? 'On: anyone who asks gets in at once.' : 'Off: you approve each request.'}</span></div><span class="switch"></span></button></div>
    <p class="adm-note adm-under">Unlocking gives a household free access, for gifts and tests.</p>
    ${sectionHead('Account')}
    <div class="card"><div class="row static"><div class="row-text"><span class="row-title">Signed in as</span><span class="row-sub">${esc(A.user.email || '')}</span></div></div>
      <button class="row" data-action="togglePassword" aria-expanded="${!!A.pwOpen}"><div class="row-text"><span class="row-title">Change password</span></div><span class="chev" aria-hidden="true">${A.pwOpen ? '⌄' : '›'}</span></button>${pw}</div>
    ${sectionHead('Statistics')}
    <div class="card"><div class="row static col"><div class="row-text"><span class="row-title">Reset statistics</span>
      <span class="row-sub">${A.statsResetAt ? `Last reset ${when(A.statsResetAt)}. ` : ''}Starts the path and couples' activity over. Accounts, homes and access stay.</span></div>
      <div class="btns"><button class="btn danger" data-action="resetStats" ${A.busy === 'reset' ? 'disabled' : ''}>${A.busy === 'reset' ? 'Resetting…' : 'Reset statistics'}</button></div></div></div>
    <button class="btn secondary adm-signout" data-action="signOut">Sign out</button>`;
}

const FEEDBACK_TYPES = { broken: 'Broken', confusing: 'Confusing', idea: 'Idea' };

/** Crash reports grouped by message: how often, how many people, which screens, latest first. */
function errorGroups() {
  const groups = new Map();
  A.errors.forEach(e => {
    const key = `${e.message || ''}|${e.where || ''}`;
    const g = groups.get(key) || { key, message: e.message || 'Unknown error', where: e.where || '', ids: [], people: new Set(), names: new Set(), screens: new Set(), versions: new Set(), devices: new Set(), first: Infinity, last: 0, sample: e };
    g.ids.push(e.id); g.people.add(e.uid); if (e.name) g.names.add(e.name);
    if (e.screen) g.screens.add(e.screen); if (e.version) g.versions.add(e.version);
    if (e.device) g.devices.add(e.device);
    const t = millis(e.at) || 0; if (t >= g.last) { g.last = t; g.sample = e; } if (t && t < g.first) g.first = t;
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => b.people.size - a.people.size || b.last - a.last);
}
/** The latest report of a group: device, the moment, the last taps, where, and the raw stack. */
function errorDetails(g) {
  const e = g.sample;
  const line = (label, value) => value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : '';
  const others = [...g.devices].filter(d => d !== e.device);
  return `<details class="stack"><summary>Details</summary><dl class="err-facts">
      ${line('Device', e.device || e.ua || 'Not recorded')}
      ${line('Also on', others.join(', '))}
      ${line('Moment', e.moment)}
      ${line('Last taps', e.trail)}
      ${line('Screen', [...g.screens].join(', '))}
      ${line('Type', e.kind)}
      ${line('From', e.where)}
      ${line('First seen', g.ids.length > 1 && g.first < g.last ? when(g.first) : '')}
    </dl>${e.stack ? `<pre>${esc(e.stack)}</pre>` : ''}${e.device && e.ua ? `<p class="meta">${esc(e.ua)}</p>` : ''}</details>`;
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
  tab(d) {
    const next = TABS.includes(d.key) ? d.key : 'inbox';
    if (next === A.tab && !A.inboxView) return;
    A.tab = next; A.inboxView = ''; render(); window.scrollTo(0, 0);
  },
  inboxView(d) { A.inboxView = ['access', 'feedback'].includes(d.key) ? d.key : ''; render(); window.scrollTo(0, 0); },
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
    if (!confirm('Reset all statistics?\n\nThis deletes every household\'s funnel steps and active days for good, and the path and couples start counting from now. Accounts, homes and access are not touched.\n\nThis can\'t be undone.')) return;
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
document.addEventListener('change', e => {
  if (e.target.dataset.change === 'range') { const v = Number(e.target.value); A.range = [30, 90, 0].includes(v) ? v : 30; A.openStep = null; render(); }
});
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
