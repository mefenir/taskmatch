'use strict';

// Never run inside someone else's frame (clickjacking).
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; } }

/* =========================================================
   UTILITIES
   ========================================================= */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => { try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

/** Unguessable invite code (no ambiguous characters). */
function randomCode(length = 16) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

/** localStorage that never throws (private mode, blocked storage). */
const SafeStorage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

const isStandalone = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  catch (e) { return false; }
};

/** Keep every button label on one line: if it doesn't fit, shrink its text a little (down to 12px). */
function fitButtons(scope = document) {
  scope.querySelectorAll('.btn, .mini, .chip, .seg button, .link-btn').forEach(b => {
    b.style.fontSize = ''; b.style.paddingLeft = b.style.paddingRight = '';
    if (!b.offsetParent || b.scrollWidth <= b.clientWidth + 1) return;
    b.style.paddingLeft = b.style.paddingRight = '';
    const pad = parseFloat(getComputedStyle(b).paddingLeft);
    if (pad > 12) b.style.paddingLeft = b.style.paddingRight = '12px';
    let size = parseFloat(getComputedStyle(b).fontSize);
    while (b.scrollWidth > b.clientWidth + 1 && size > 12) { size -= 0.5; b.style.fontSize = size + 'px'; }
  });
}
window.addEventListener('resize', () => fitButtons());

/**
 * Text that reads well on any width:
 *  - a sentence that doesn't fit on the rest of a line starts on the next one ("Everything done. /
 *    A well-earned evening.", never "Everything done. A / well-earned evening.")
 *  - a block never ends with one word alone on its last line.
 * Runs after every render, on plain-text blocks only (no markup inside), building with text nodes.
 */
const TIDY_TEXT = 'h1, h2, h3, p, .row-title, .row-sub, .note-text, .celebrate, .meter-sub, .fine, .lead';
function tidyText(scope = document) {
  scope.querySelectorAll(TIDY_TEXT).forEach(el => {
    if (el.dataset.tidy || el.closest('button.btn, .mini, .chip, .link-btn')) return;
    el.dataset.tidy = '1';
    const heading = /^H[1-3]$/.test(el.tagName);       // headings use text-wrap: balance instead of glue
    if (el.children.length) { if (!heading) glueLastWord(el); return; }
    // Headings never break at a hyphen ("well-" / "earned"): use a no-break hyphen.
    const text = heading ? el.textContent.replace(/(\w)-(\w)/g, '$1\u2011$2') : el.textContent;
    if (heading) el.textContent = text;
    // Split only where a sentence ends: . ! or ? (and a closing quote) followed by a space.
    const bits = text.trim().split(/([.!?]["')\]]*)\s+/);
    const parts = [];
    for (let i = 0; i < bits.length; i += 2) parts.push(bits[i] + (bits[i + 1] || ''));
    if (parts.length < 2) { if (!heading) glueLastWord(el); return; }
    el.textContent = '';
    parts.forEach((p, i) => {
      const span = document.createElement('span');
      span.className = 'sentence';
      span.textContent = p.trim();
      if (!heading) glueLastWord(span);
      el.appendChild(span);
      if (i < parts.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
}
/** Keep the last two words of a block together (in a no-wrap span), so the last line never holds one word alone. */
function glueLastWord(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last = null, n;
  while ((n = walker.nextNode())) if (n.nodeValue.trim()) last = n;
  const m = last && /^([\s\S]*\S)\s+(\S+\s+\S+)(\s*)$/.exec(last.nodeValue);
  // Only short endings, in blocks of four words or more: gluing a long pair could leave a word alone at the start instead.
  if (!m || m[2].length > 16 || el.textContent.trim().split(/\s+/).length < 4) return;
  const keep = document.createElement('span');
  keep.className = 'nowrap';
  keep.textContent = m[2];
  last.nodeValue = m[1] + ' ';
  last.parentNode.insertBefore(keep, last.nextSibling);
  if (m[3]) keep.after(document.createTextNode(m[3]));
}

/* ---------- Crash reports ----------
   Errors on testers' phones go to the admin panel (Errors tab), once signed in:
   message, stack, screen and app version, at most 5 different ones per visit.
   Errors before sign-in wait in a short queue. */
const ErrorLog = (() => {
  const MAX = 5;
  /* Safari (mostly iPhone) can drop the app's link to its offline storage while the app sits in
     the background; after that, syncing can quietly stop. When we see it, the app reloads itself
     once, where the person was. Never twice within 2 minutes, so it can't loop. The report waits
     in sessionStorage and is sent after the reload, marked "recovered". */
  const STORAGE_LOST = /Indexed ?Database server|database connection is closing/i;
  const RELOADED_AT = 'recover-reloaded-at', PENDING = 'recover-report', GAP = 2 * 60 * 1000;
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    drop(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nothing to drop */ } },
  };
  let recovering = false;
  function recover(entry) {
    if (recovering) return true;
    if (Date.now() - (Number(session.get(RELOADED_AT)) || 0) < GAP) return false;   // just reloaded: don't loop
    entry.where = cut(`${entry.where} · recovered`, 60);
    if (!session.set(RELOADED_AT, String(Date.now())) || !session.set(PENDING, JSON.stringify(entry))) return false;   // can't guard the loop: don't reload
    recovering = true;
    const reload = () => location.reload();
    if (!document.hidden) { reload(); return true; }
    document.addEventListener('visibilitychange', function back() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', back);
      reload();
    });
    return true;
  }
  function pending() {
    const raw = session.get(PENDING);
    session.drop(PENDING);
    try { const e = raw && JSON.parse(raw); return e && typeof e.message === 'string' ? e : null; } catch (e) { return null; }
  }
  const seen = new Set();
  const queue = [];
  let sender = null;
  const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
  const version = () => {
    const s = document.querySelector('script[src*="js/app.js"]');
    const m = s && /[?&]v=([^&#]+)/.exec(s.getAttribute('src'));
    return m ? m[1] : '';
  };
  const send = entry => { try { Promise.resolve(sender(entry)).catch(() => {}); } catch (e) { /* never throw from here */ } };
  /* Context for a report — technical facts only, never anything a person typed. */
  const openedAt = Date.now();
  let shownAt = openedAt, hiddenFor = 0, hiddenAt = document.hidden ? openedAt : 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt) { hiddenFor = Date.now() - hiddenAt; hiddenAt = 0; }
    shownAt = Date.now();
  });
  const steps = [];   // the last 5 taps: action name and screen
  const ago = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
  const screenNow = () => location.hash.replace(/^#\/?/, '').split('?')[0] || 'start';
  function device() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const v = (re) => { const m = re.exec(ua); return m ? m[1].replace(/_/g, '.') : ''; };
    const os = ios ? `${/iPad/.test(ua) || /Macintosh/.test(ua) ? 'iPad' : 'iPhone'} · iOS ${v(/OS (\d+(?:_\d+)?)/)}`.trim()
      : /Android/.test(ua) ? `Android ${v(/Android (\d+(?:\.\d+)?)/)}`.trim()
      : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const browser = /CriOS|Chrome\//.test(ua) && !/Edg/.test(ua) ? (/SamsungBrowser/.test(ua) ? 'Samsung Internet' : 'Chrome')
      : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /EdgiOS|Edg\//.test(ua) ? 'Edge' : /Safari\//.test(ua) ? 'Safari' : 'Other browser';
    let installed = false;
    try { installed = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) { /* old browser */ }
    return `${os} · ${installed ? 'home-screen app' : `${browser} tab`}`;
  }
  function moment() {
    const now = Date.now();
    const parts = [navigator.onLine === false ? 'offline' : 'online', `open ${ago(now - openedAt)}`];
    if (document.hidden) parts.push('in background');
    else if (hiddenFor) parts.push(`back ${ago(now - shownAt)} ago (away ${ago(hiddenFor)})`);
    return parts.join(' · ');
  }
  function trail() {
    const now = Date.now();
    return steps.map(x => `${x.screen}: ${x.action} ${ago(now - x.at)}`).join(' → ');
  }
  function report(err, where) {
    const message = cut((err && err.message) || err, 300) || 'Unknown error';
    if (/^Script error\.?$/.test(message)) return;   // another site's script: nothing useful to report
    const key = `${message}|${where || ''}`;
    const lost = STORAGE_LOST.test(message);
    if (!lost && (seen.has(key) || seen.size >= MAX)) return;
    const entry = {
      message,
      stack: cut(err && err.stack, 2000),
      where: cut(where, 60),
      screen: cut(location.hash.replace(/^#\/?/, '').split('?')[0], 40),
      version: cut(version(), 20),
      ua: cut(navigator.userAgent, 200),
      kind: cut(err && err.name, 40),
      device: cut(device(), 80),
      moment: cut(moment(), 120),
      trail: cut(trail(), 300),
    };
    if (lost && recover(entry)) return;   // sent after the reload
    if (seen.has(key) || seen.size >= MAX) return;
    seen.add(key);
    if (sender) send(entry); else if (queue.length < MAX) queue.push(entry);
  }
  window.addEventListener('error', e => {
    if (!e.error && !e.message) return;
    const file = e.filename ? `${e.filename.split('/').pop().split('?')[0]}:${e.lineno || 0}` : 'page';
    report(e.error || e.message, file);
  });
  window.addEventListener('unhandledrejection', e => report(e.reason, 'promise'));
  return {
    report,
    version,
    /** Remember a tap (action name only) for the next report. */
    step(action) {
      steps.push({ action: cut(action, 30), screen: cut(screenNow(), 20), at: Date.now() });
      if (steps.length > 5) steps.shift();
    },
    /** Start sending (after sign-in); anything queued goes first. */
    connect(fn) {
      sender = fn;
      const before = pending();
      if (before) send(before);
      queue.splice(0).forEach(send);
    },
    disconnect() { sender = null; },
  };
})();
