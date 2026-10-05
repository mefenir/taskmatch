'use strict';

/* =========================================================
   UI PRIMITIVES — icons, rows, sheets, toast
   ========================================================= */
const svg = (d, size = 22, sw = 2) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const Icon = {
  back:    svg('<path d="M15 18l-6-6 6-6"/>'),
  chev:    svg('<path d="M9 6l6 6-6 6"/>', 18),
  check:   svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 15, 3),
  plus:    svg('<path d="M12 5v14M5 12h14"/>', 18),
  minus:   svg('<path d="M5 12h14"/>', 18),
  more:    svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>', 22, 2.4),
  spark:   svg('<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>', 26, 1.8),
  google:  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z"/></svg>',
  copy:    svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 18),
  lock:    svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 16),
  gear:    svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22, 1.8),
  board:   svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>', 20, 1.8),
  note:    svg('<path d="M20 12a7 7 0 0 1-10.3 6.2L5 19.5l1.3-4.2A7 7 0 1 1 20 12z"/>', 18, 1.9),
  low:     svg('<path d="M5 9h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8z"/><path d="M9 9l3-5 3 5"/>', 18, 1.9),
  today:   svg('<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>', 18, 1.9),
  // How you feel about a task (rating screens): heart, smile, frown — drawn at 22 for buttons, 16 for the legend.
  love:    svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', 22, 1.9),
  ok:      svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9.3 9.6h.01M14.7 9.6h.01"/>', 22, 1.9),
  notKeen: svg('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 15.5a4 4 0 0 0-7 0"/><path d="M9.3 9.6h.01M14.7 9.6h.01"/>', 22, 1.9),
  up:      svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 20, 2.2),
  sparkSm: svg('<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>', 12, 2.4),
};

/* The organiser's setup, in order. The partner never goes through it. */
const ONBOARDING = ['members', 'home', 'responsibilities', 'frequency', 'rate'];

/* ---------- Instant feedback, no double actions ----------
   An action that returns a promise is "busy" until it settles: its buttons are disabled
   and show a spinner, and the same action can't start again (even after a re-render). */
const Busy = new Set();
function applyBusy(scope = document) {
  scope.querySelectorAll('[data-action]').forEach(el => {
    const on = Busy.has(el.dataset.action);
    el.classList.toggle('is-busy', on);
    if (on) { el.disabled = true; el.setAttribute('aria-busy', 'true'); }
  });
}

/* ---------- What a subscription gives the two of you (the plans screen) ---------- */
const BENEFITS = Object.freeze([
  { title: 'A fair plan you both agreed to', body: 'Your partner marks what doesn\'t suit them, the app rebalances, you both say yes.' },
  { title: 'Daily lists for each of you', body: 'Today, this week, this month. Tick things off, swap when life gets in the way.' },
  { title: 'See that it stays fair', body: 'How much time each of you puts in every week, shared by effort, not by count.' },
  { title: 'Stop reminding each other', body: 'A shared board for notes, things running low and last-minute jobs, sent to the right person.' },
  { title: 'Every detail has an owner', body: 'Break big tasks into parts, add your own, and let your partner suggest changes.' },
]);

/** Prices as the app shows them (the amounts Stripe charges are set in Stripe). */
function money(amount) {
  const d = APP_CONFIG.billing.display;
  try { return new Intl.NumberFormat(d.locale, { style: 'currency', currency: d.currency }).format(amount); }
  catch (e) { return `€${amount.toFixed(2)}`; }
}

function topbar({ back, step }) {
  const backBtn = back
    ? `<button class="icon-btn left" data-action="nav" data-to="${esc(back)}" aria-label="Back">${Icon.back}</button>`
    : `<span style="width:34px"></span>`;
  const i = ONBOARDING.indexOf(step);
  const progress = i >= 0
    ? `<div class="progress" aria-hidden="true">${ONBOARDING.map((_, k) => `<span class="${k <= i ? 'done' : ''}"></span>`).join('')}</div>
       <span class="step-label">Step ${i + 1} of ${ONBOARDING.length}</span>`
    : '<span class="spacer"></span>';
  return `<div class="topbar">${backBtn}${progress}</div>`;
}

function stepperRow(key, label, sub, value) {
  const [min, max] = LIMITS[key];
  return `<div class="row static">
    <div class="row-text"><span class="row-title" id="lbl-${key}">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</div>
    <div class="stepper" role="group" aria-labelledby="lbl-${key}">
      <button class="step-btn" data-action="step" data-key="${esc(key)}" data-delta="-1" ${value <= min ? 'disabled' : ''} aria-label="Fewer">${Icon.minus}</button>
      <output aria-live="polite">${value}</output>
      <button class="step-btn" data-action="step" data-key="${esc(key)}" data-delta="1" ${value >= max ? 'disabled' : ''} aria-label="More">${Icon.plus}</button>
    </div>
  </div>`;
}

function switchRow(action, key, label, sub, on) {
  return `<button class="row" role="switch" aria-checked="${on}" data-action="${action}" data-key="${esc(key)}">
    <div class="row-text"><span class="row-title">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</div>
    <span class="switch" aria-hidden="true"></span>
  </button>`;
}

/** The gear at the top right of every main screen: one way into Settings. */
/** The small version of a feeling icon, for the legend above a list. */
const prefIconSm = id => Icon[id].replace('width="22" height="22"', 'width="16" height="16"').replace('stroke-width="1.9"', 'stroke-width="2"');
const settingsButton = () => `<button class="icon-btn right" data-action="nav" data-to="settings" aria-label="Settings">${Icon.gear}</button>`;

function addOwnRow(label) {
  return `<div class="card"><button class="row add" data-action="addCustomTask">
    <span class="plus" aria-hidden="true">${Icon.plus}</span>
    <div class="row-text"><span class="row-title">${label}</span></div>
  </button></div>`;
}

const Sheet = (() => {
  let timer = null;
  const root = () => document.getElementById('sheet-root');

  /** Pull the handle (or the top of the sheet) down to close it. */
  function enableDrag(panel) {
    let startY = 0, dy = 0, startT = 0, dragging = false;
    const start = e => {
      const onHandle = e.target.closest('.sheet-handle');
      if (!onHandle && (panel.scrollTop > 0 || e.target.closest('button, a, input, select, textarea'))) return;
      dragging = true; startY = e.clientY; dy = 0; startT = Date.now();
      panel.style.transition = 'none';
      try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const move = e => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
      if (dy > 4) e.preventDefault();
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = '';
      const fast = dy > 40 && (dy / Math.max(1, Date.now() - startT)) > 0.5;
      if (dy > Math.min(140, panel.offsetHeight * 0.3) || fast) { panel.style.transform = 'translateY(100%)'; Sheet.close(); }
      else panel.style.transform = '';
    };
    panel.addEventListener('pointerdown', start);
    panel.addEventListener('pointermove', move);
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
  }

  return {
    open(html, label) {
      clearTimeout(timer);
      const r = root();
      r.innerHTML = `<div class="sheet-backdrop" data-action="closeSheet"></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || 'Dialog')}">
          <div class="sheet-handle" aria-hidden="true"><span></span></div>${html}</div>`;
      r.classList.add('open');
      enableDrag(r.querySelector('.sheet'));
      requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('show')));
      tidyText(r);
      fitButtons(r);
      applyBusy(r);
      const first = r.querySelector('.sheet input, .sheet button');
      if (first) first.focus({ preventScroll: true });
    },
    close() {
      const r = root();
      r.classList.remove('show');
      timer = setTimeout(() => { r.innerHTML = ''; r.classList.remove('open'); }, 220);
    },
    isOpen: () => root().classList.contains('open'),
  };
})();

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/** Bottom navigation once the organiser has finished setting up. */
function bottomNav(current, dots = {}) {
  const item = (to, label, icon) => {
    const dot = dots[to] && current !== to;
    return `<button data-action="nav" data-to="${esc(to)}" ${current === to ? 'aria-current="page"' : ''}${dot ? ` aria-label="${label}, needs your attention"` : ''}>
      <span class="nav-icon">${icon}${dot ? '<span class="nav-dot" aria-hidden="true"></span>' : ''}</span><span>${label}</span></button>`;
  };
  return `<nav class="bottom-nav" aria-label="Main"><div class="inner">
    ${item('today', 'Me', svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'))}
    ${item('household', 'Us', svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>'))}
  </div></nav>`;
}

/* ---------- Progress line: a slim bar that fills by time done, sliding from the last value ---------- */
const meterLast = {};
function progressBar(pct, label, sub) {
  const key = 'me';
  const from = key in meterLast ? meterLast[key] : 0;
  return `<div class="meter-card">
    <div class="meter-head"><span class="meter-label">${label}</span><span class="meter-sub">${sub}</span></div>
    <div class="meter slim" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"
      data-meter="${key}" data-pct="${pct}" style="--p:${from}%"><div class="meter-fill"></div></div></div>`;
}
function animateMeters(root) {
  root.querySelectorAll('[data-meter]').forEach(m => {
    const pct = Number(m.dataset.pct);
    meterLast[m.dataset.meter] = pct;
    requestAnimationFrame(() => requestAnimationFrame(() => m.style.setProperty('--p', pct + '%')));
  });
}

