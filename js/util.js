'use strict';

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
