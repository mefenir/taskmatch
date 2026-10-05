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
