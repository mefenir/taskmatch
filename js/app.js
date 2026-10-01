'use strict';

/* =========================================================
   APP — state, auth flow, live sync, actions, routing
   ========================================================= */
const INVITE_KEY = 'household-app/pending-invite';
const HOUSEHOLD_SCREENS = ['members', 'home', 'circumstances', 'responsibilities', 'inventory'];

const S = {
  phase: 'loading',          // loading | setup | signedOut | ready | error
  fatal: null,
  user: null,                // Firebase user
  profile: null,             // users/{uid}
  household: null,           // households/{hid} (live)
  subscription: null,        // subscriptions/{household.ownerId} (live)
  householdLoading: false,
  joining: false,
  busy: false,
  pendingInvite: null,
  auth: { mode: 'signup', busy: false, error: '', note: '', values: {} },
};

const watchers = { user: null, household: null, sub: null, householdId: undefined, ownerId: null };

/* ---------- helpers ---------- */
const AUTH_ERRORS = {
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/missing-email': 'Enter your email address.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/email-already-in-use': "There's already an account with this email. Try signing in instead.",
  'auth/weak-password': `Use at least ${APP_CONFIG.minPasswordLength} characters for your password.`,
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': "This web address isn't allowed to sign in yet. Add it in Firebase → Authentication → Settings → Authorised domains.",
  'auth/account-exists-with-different-credential': 'This email already has an account with a different sign-in method. Sign in with email and password instead.',
  'auth/operation-not-allowed': "This sign-in method isn't switched on in Firebase yet.",
};
const SILENT_AUTH_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
const authMessage = e => AUTH_ERRORS[e && e.code] || 'Something went wrong. Please try again.';

const INVITE_ERRORS = {
  'invite/not-found': ["This invite link doesn't work", 'Check you opened the whole link, or ask for a new one.'],
  'invite/used': ['This invite has already been used', 'Each link works once. Ask for a new one.'],
  'invite/expired': ['This invite has expired', 'Ask for a new link.'],
  'permission-denied': ["This invite couldn't be used", 'It may have expired or already been used. Ask for a new link.'],
};

function fail(e) {
  console.error(e);
  S.phase = 'error';
  S.fatal = e && e.code === 'unavailable' ? "You're offline and this household isn't saved on this device yet." : null;
  render(true);
}

function captureInvite() {
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('invite');
    if (code && /^[a-z0-9]{8,40}$/.test(code)) {
      SafeStorage.set(INVITE_KEY, code);
      params.delete('invite');
      const q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  } catch (e) {}
  S.pendingInvite = SafeStorage.get(INVITE_KEY);
}
function clearInvite() { S.pendingInvite = null; SafeStorage.remove(INVITE_KEY); }

/* ---------- persistence of household changes ---------- */
function save(...fields) {
  const h = S.household;
  if (!h) return;
  const data = {};
  fields.forEach(f => { data[f] = h[f]; });
  Backend.Repo.saveHousehold(h.id, data).catch(e => {
    console.error(e);
    toast("Couldn't save that change. Check your connection and try again.");
  });
}
let nameTimer = null;
function flushName() { if (nameTimer) { clearTimeout(nameTimer); nameTimer = null; save('members'); } }

/** After rooms/children/pets change, drop responsibilities that no longer apply. */
function saveSetup(field) {
  const pruned = Household.prune(S.household);
  pruned ? save(field, 'responsibilities') : save(field);
  rerender();
}

/* ---------- live data ---------- */
function stop(key) { if (watchers[key]) { watchers[key](); watchers[key] = null; } }
function teardown() {
  stop('user'); stop('household'); stop('sub');
  watchers.householdId = undefined; watchers.ownerId = null;
}

async function onAuth(user) {
  teardown();
  Sheet.close();
  S.user = user; S.profile = null; S.household = null; S.subscription = null;
  S.householdLoading = false; S.joining = false;
  if (!user) { S.phase = 'signedOut'; render(true); return; }
  // On sign-up this fires before the display name is saved, so use what was typed.
  const nameHint = user.displayName || (S.auth.values.name || '').trim();
  S.auth = { mode: 'signin', busy: false, error: '', note: '', values: {} };
  S.phase = 'loading'; render(true);
  try {
    await Backend.Repo.ensureUser(user, nameHint);
  } catch (e) { fail(e); return; }
  S.phase = 'ready';
  watchers.user = Backend.Repo.watchUser(user.uid, onProfile, fail);
}

function onProfile(profile) {
  S.profile = profile || { householdId: null };
  const hid = S.profile.householdId || null;

  if (S.pendingInvite && !S.joining) {
    if (!hid) { redeemInvite(); return; }
    clearInvite();
    render(false);
    Sheets.notice("You're already in a household", 'Being part of more than one household isn\'t possible yet. To join another one, leave this household first.');
  }
  if (hid !== watchers.householdId) watchHousehold(hid);
  render(false);
}

function watchHousehold(hid) {
  stop('household'); stop('sub');
  watchers.householdId = hid; watchers.ownerId = null;
  S.household = null; S.subscription = null;
  if (!hid) { S.householdLoading = false; return; }
  S.householdLoading = true;
  watchers.household = Backend.Repo.watchHousehold(hid, h => {
    S.householdLoading = false;
    if (!h || !(h.memberIds || []).includes(S.user.uid)) { forgetHousehold(); return; }
    S.household = h;
    if (h.ownerId !== watchers.ownerId) watchSubscription(h.ownerId);
    if (S.joining) {
      // The household can arrive before the join call itself resolves, so it finishes the join.
      S.joining = false;
      clearInvite();
      render(true);
      Sheets.joined();
      return;
    }
    rerender();
  }, err => {
    S.householdLoading = false;
    // Household deleted, or this account was removed from it.
    if (err && err.code === 'permission-denied') forgetHousehold(); else fail(err);
  });
}

function forgetHousehold() {
  S.household = null; S.subscription = null;
  stop('household'); stop('sub');
  Backend.Repo.setHouseholdRef(S.user.uid, null).catch(() => {});
  render(true);
}

/** Premium follows the household owner's account. */
function watchSubscription(ownerId) {
  stop('sub');
  watchers.ownerId = ownerId;
  S.subscription = null;
  watchers.sub = Backend.Repo.watchSubscription(ownerId, sub => {
    const was = Entitlements.isPremium(S.subscription);
    S.subscription = sub;
    if (was !== Entitlements.isPremium(sub)) rerender();
  });
}

async function redeemInvite() {
  const code = S.pendingInvite;
  S.joining = true;
  render(true);
  const name = (S.user.displayName || (S.profile && S.profile.displayName) || '').trim();
  try {
    await Backend.Repo.redeemInvite(code, S.user, name);
    clearInvite(); // the household snapshot finishes the join (see watchHousehold)
  } catch (e) {
    console.error(e);
    clearInvite();
    S.joining = false;
    render(true);
    const [title, body] = INVITE_ERRORS[e && e.code] || ["Couldn't join the household", 'Check your connection and try again, or ask for a new link.'];
    Sheets.notice(title, body);
  }
}

/* ---------- auth form ---------- */
async function submitAuth() {
  const { mode, values: v } = S.auth;
  const email = (v.email || '').trim();
  const password = v.password || '';
  const name = (v.name || '').trim();
  const min = APP_CONFIG.minPasswordLength;
  let error = '';
  if (!email) error = 'Enter your email address.';
  else if (mode === 'signup' && password.length < min) error = `Use at least ${min} characters for your password.`;
  else if (mode === 'signin' && !password) error = 'Enter your password.';
  if (error) { S.auth.error = error; S.auth.note = ''; rerender(); return; }

  S.auth.busy = true; S.auth.error = ''; S.auth.note = '';
  rerender();
  try {
    if (mode === 'signup') await Backend.Auth.signUp(name, email, password);
    else if (mode === 'signin') await Backend.Auth.signIn(email, password);
    else {
      await Backend.Auth.resetPassword(email);
      S.auth.mode = 'signin';
      S.auth.note = "If there's an account for that email, a reset link is on its way.";
    }
  } catch (e) {
    if (mode === 'reset' && e && e.code === 'auth/user-not-found') {
      S.auth.mode = 'signin';
      S.auth.note = "If there's an account for that email, a reset link is on its way.";
    } else {
      S.auth.error = authMessage(e);
    }
  }
  S.auth.busy = false;
  if (S.phase === 'signedOut') rerender();
}

/* =========================================================
   ACTIONS — UI events → domain logic → save → render
   ========================================================= */
const Actions = {
  reload() { location.reload(); },

  /* auth */
  authMode(d) {
    S.auth.mode = d.mode; S.auth.error = ''; S.auth.note = '';
    go('auth');
  },
  async google() {
    S.auth.busy = true; S.auth.error = ''; rerender();
    try { await Backend.Auth.google(); }
    catch (e) { if (!SILENT_AUTH_ERRORS.includes(e && e.code)) S.auth.error = authMessage(e); }
    S.auth.busy = false;
    if (S.phase === 'signedOut') rerender();
  },
  signOut() { Sheet.close(); flushName(); Backend.Auth.signOut(); },

  /* household lifecycle */
  async createHousehold() {
    if (S.busy) return;
    S.busy = true; rerender();
    const name = (S.user.displayName || (S.profile && S.profile.displayName) || '').trim();
    try {
      await Backend.Repo.createHousehold(S.user.uid, Household.create({ ownerId: S.user.uid, ownerName: name }));
      history.replaceState(null, '', '#/members');
    } catch (e) {
      console.error(e);
      toast("Couldn't create your household. Check your connection and try again.");
    }
    S.busy = false; rerender();
  },
  async deleteHousehold() {
    Sheet.close();
    try { await Backend.Repo.deleteHousehold(S.household.id, S.user.uid); }
    catch (e) { console.error(e); toast("Couldn't delete the household. Try again."); }
  },
  async leaveHousehold() {
    Sheet.close();
    try { await Backend.Repo.leaveHousehold(S.household, S.user.uid); }
    catch (e) { console.error(e); toast("Couldn't leave the household. Try again."); }
  },

  /* invites */
  async invite() {
    Sheets.invite('loading');
    try {
      const code = await Backend.Repo.createInvite(S.household.id, S.user.uid);
      const link = `${location.origin}${location.pathname}?invite=${code}`;
      Sheets.invite({ link });
    } catch (e) {
      console.error(e);
      Sheets.invite({ error: "Couldn't create an invite link. Check your connection and try again." });
    }
  },
  copyInvite(d) {
    const done = () => toast('Link copied');
    const failCopy = () => toast("Copying didn't work. Press and hold the link to copy it.");
    try { navigator.clipboard.writeText(d.link).then(done, failCopy); } catch (e) { failCopy(); }
  },
  shareInvite(d) {
    navigator.share({ title: 'Join our household', text: "Join our household so we can organise it together:", url: d.link }).catch(() => {});
  },

  /* navigation */
  nav(d) {
    flushName();
    const h = S.household;
    if (h && !h.settings.onboarded && ONBOARDING.includes(d.to) && h.settings.step !== d.to) {
      h.settings.step = d.to;
      save('settings');
    }
    go(d.to);
  },
  sheetNav(d) { Sheet.close(); go(d.to); },
  closeSheet() { Sheet.close(); },
  menu() { Sheets.menu(); },
  confirmDelete() { Sheets.confirmDelete(); },
  confirmLeave() { Sheets.confirmLeave(); },

  /* household setup */
  step(d) {
    const h = S.household;
    const [min, max] = LIMITS[d.key];
    const delta = Number(d.delta);
    if (d.key === 'children') { Household.setChildren(h, clamp(h.children.length + delta, min, max)); saveSetup('children'); }
    else { Household.setRoom(h, d.key, clamp(roomCount(h, d.key) + delta, min, max)); saveSetup('rooms'); }
  },
  toggleRoom(d) { const h = S.household; Household.setRoom(h, d.key, roomCount(h, d.key) > 0 ? 0 : 1); saveSetup('rooms'); },
  toggleFlag(d) { const h = S.household; h.circumstances[d.key] = !h.circumstances[d.key]; saveSetup('circumstances'); },
  togglePet(d) { Household.togglePet(S.household, d.key); saveSetup('pets'); },
  clearPets() { S.household.pets = []; saveSetup('pets'); },

  /* responsibilities */
  toggleResp(d) { Household.toggle(S.household, d.id); save('responsibilities'); rerender(); },
  toggleCategory(d) {
    const h = S.household;
    const items = Library.relevant(h).filter(r => r.category === d.cat);
    const sel = Household.selectedLibraryIds(h);
    const all = items.every(i => sel.has(i.id));
    items.forEach(i => (all ? Household.deselect(h, i.id) : Household.select(h, i.id)));
    save('responsibilities'); rerender();
  },
  confirmSelection() { if (S.household.responsibilities.length) Sheets.confirm(); },
  finishSetup() {
    const h = S.household;
    h.settings.onboarded = true;
    h.settings.step = 'inventory';
    save('settings');
    Sheet.close();
    go('inventory');
  },

  /* Premium-gated: always routed through Entitlements with the owner's subscription. */
  addResponsibility() {
    if (Entitlements.canCreateCustomResponsibility(S.subscription)) { toast('Custom responsibilities arrive in the Premium phase.'); return; }
    Sheets.premium({
      title: 'Make your household fit your life.',
      body: 'Premium lets you add your own responsibilities and break everyday chores into detailed tasks.',
    });
  },
  openResponsibility(d) {
    const r = S.household.responsibilities.find(x => x.id === d.id);
    if (!r) return;
    if (Entitlements.canViewDetailedTasks(S.subscription)) { toast('Detailed tasks arrive in the Premium phase.'); return; }
    Sheets.premium({
      title: 'Make it more detailed',
      body: `Premium lets you break ${r.name} into individual tasks and add your own responsibilities.`,
    });
  },
  upgrade() { Sheet.close(); toast("Checkout isn't part of this version yet."); },
};

const Inputs = {
  myName(value) {
    Household.renameMember(S.household, S.user.uid, value);
    clearTimeout(nameTimer);
    nameTimer = setTimeout(flushName, 600);
  },
};

/* =========================================================
   ROUTER & RENDERING
   ========================================================= */
const $app = document.getElementById('app');
let currentRoute = null;
const hashName = () => location.hash.replace(/^#\/?/, '').split('?')[0];

function resolveRoute() {
  const name = hashName();
  if (S.phase === 'setup' || S.phase === 'error' || S.phase === 'loading') return S.phase;
  if (S.phase === 'signedOut') return name === 'auth' ? 'auth' : 'welcome';
  if (S.joining) return 'joining';
  if (!S.profile || S.householdLoading) return 'loading';
  const h = S.household;
  if (!h) return 'start';
  const fallback = h.settings.onboarded ? 'inventory' : (h.settings.step || 'members');
  if (!HOUSEHOLD_SCREENS.includes(name)) return fallback;
  if (name === 'inventory' && !h.settings.onboarded) return fallback;
  return name;
}

function render(routeChanged) {
  const name = resolveRoute();
  const routable = name === 'auth' || name === 'welcome' || name === 'start' || HOUSEHOLD_SCREENS.includes(name);
  if (routable && location.hash !== '#/' + name) history.replaceState(null, '', '#/' + name);
  const changed = routeChanged || name !== currentRoute;
  currentRoute = name;
  $app.innerHTML = Screens[name]();
  if (changed) {
    window.scrollTo(0, 0);
    const heading = $app.querySelector('h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }
}

/** Re-render in place, keeping scroll position, focus, and anything half-typed. */
function rerender() {
  const a = document.activeElement;
  let sel = null;
  let typing = null;
  if (a && a.id && a.tagName === 'INPUT') {
    typing = { id: a.id, value: a.value, start: a.selectionStart, end: a.selectionEnd };
  } else if (a && a.dataset && a.dataset.action) {
    sel = `[data-action="${a.dataset.action}"]`;
    ['id', 'key', 'delta', 'cat', 'to', 'mode'].forEach(k => { if (a.dataset[k] != null) sel += `[data-${k}="${CSS.escape(a.dataset[k])}"]`; });
  }
  render(false);
  if (typing) {
    const el = document.getElementById(typing.id);
    if (el) {
      el.value = typing.value;
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(typing.start, typing.end); } catch (e) {}
    }
  } else if (sel) {
    const el = $app.querySelector(sel);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
}

function go(name) {
  if (location.hash === '#/' + name) render(true);
  else location.hash = '#/' + name;
}

/* ---------- events ---------- */
window.addEventListener('hashchange', () => render(true));
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn({ ...el.dataset }, el); }
});
document.addEventListener('input', e => {
  const authField = e.target.closest('[data-auth-field]');
  if (authField) { S.auth.values[authField.dataset.authField] = authField.value; return; }
  const el = e.target.closest('[data-input]');
  if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el.value, { ...el.dataset }, el);
});
document.addEventListener('submit', e => {
  if (!e.target.closest('[data-form="auth"]')) return;
  e.preventDefault();
  if (!S.auth.busy) submitAuth();
});
document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('[data-input="myName"]')) flushName(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Sheet.isOpen()) Sheet.close();
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-input="myName"]')) e.target.blur();
});

/* ---------- boot ---------- */
(function boot() {
  captureInvite();
  if (!Backend.init()) { S.phase = 'setup'; render(true); return; }
  render(true);
  Backend.Auth.redirectResult().catch(e => {
    if (!SILENT_AUTH_ERRORS.includes(e && e.code)) { S.auth.error = authMessage(e); if (S.phase === 'signedOut') rerender(); }
  });
  Backend.Auth.onChange(onAuth);
})();
