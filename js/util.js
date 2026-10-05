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

/* ---------- Crash reports ----------
   Errors on testers' phones go to the admin panel (Errors tab), once signed in:
   message, stack, screen and app version, at most 5 different ones per visit.
   Errors before sign-in wait in a short queue. */
const ErrorLog = (() => {
  const MAX = 5;
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
  function report(err, where) {
    const message = cut((err && err.message) || err, 300) || 'Unknown error';
    if (/^Script error\.?$/.test(message)) return;   // another site's script: nothing useful to report
    const key = `${message}|${where || ''}`;
    if (seen.has(key) || seen.size >= MAX) return;
    seen.add(key);
    const entry = {
      message,
      stack: cut(err && err.stack, 2000),
      where: cut(where, 60),
      screen: cut(location.hash.replace(/^#\/?/, '').split('?')[0], 40),
      version: cut(version(), 20),
      ua: cut(navigator.userAgent, 200),
    };
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
    /** Start sending (after sign-in); anything queued goes first. */
    connect(fn) { sender = fn; queue.splice(0).forEach(send); },
    disconnect() { sender = null; },
  };
})();
