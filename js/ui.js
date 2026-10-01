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
  sparkSm: svg('<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>', 12, 2.4),
};

const ONBOARDING = ['members', 'home', 'circumstances', 'responsibilities', 'frequency'];

function topbar({ back, step }) {
  const backBtn = back
    ? `<button class="icon-btn left" data-action="nav" data-to="${back}" aria-label="Back">${Icon.back}</button>`
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
      <button class="step-btn" data-action="step" data-key="${key}" data-delta="-1" ${value <= min ? 'disabled' : ''} aria-label="Fewer">${Icon.minus}</button>
      <output aria-live="polite">${value}</output>
      <button class="step-btn" data-action="step" data-key="${key}" data-delta="1" ${value >= max ? 'disabled' : ''} aria-label="More">${Icon.plus}</button>
    </div>
  </div>`;
}

function switchRow(action, key, label, sub, on) {
  return `<button class="row" role="switch" aria-checked="${on}" data-action="${action}" data-key="${key}">
    <div class="row-text"><span class="row-title">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</div>
    <span class="switch" aria-hidden="true"></span>
  </button>`;
}

function addOwnRow(label, locked) {
  return `<div class="card"><button class="row add" data-action="addResponsibility">
    <span class="plus" aria-hidden="true">${Icon.plus}</span>
    <div class="row-text"><span class="row-title">${label}</span></div>
    ${locked ? `<span class="badge">${Icon.sparkSm} Premium</span>` : ''}
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
      const first = r.querySelector('.sheet button');
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

/** Bottom navigation once the plan is running. */
function bottomNav(current, dots = {}) {
  const item = (to, label, icon) => {
    const dot = dots[to] && current !== to;
    return `<button data-action="nav" data-to="${to}" ${current === to ? 'aria-current="page"' : ''}${dot ? ` aria-label="${label}, needs your attention"` : ''}>
      <span class="nav-icon">${icon}${dot ? '<span class="nav-dot" aria-hidden="true"></span>' : ''}</span><span>${label}</span></button>`;
  };
  return `<nav class="bottom-nav" aria-label="Main"><div class="inner">
    ${item('today', 'Today', svg('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>'))}
    ${item('plan', 'Plan', svg('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'))}
    ${item('inventory', 'Household', svg('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M10 20v-6h4v6"/>'))}
  </div></nav>`;
}
