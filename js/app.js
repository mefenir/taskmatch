'use strict';

/* =========================================================
   APP — state, auth flow, live sync, actions, routing
   ========================================================= */
const INVITE_KEY = 'household-app/pending-invite';
const HOUSEHOLD_SCREENS = ['members', 'home', 'circumstances', 'responsibilities', 'frequency', 'inventory', 'review', 'waiting',
  'preferences', 'prefsDone', 'plan', 'today', 'premium', 'breakdown', 'reshare'];
const SETUP_SCREENS = ['members', 'home', 'circumstances', 'responsibilities', 'frequency'];

const S = {
  phase: 'loading',          // loading | setup | signedOut | ready | error
  fatal: null,
  user: null,                // Firebase user
  profile: null,             // users/{uid}
  household: null,           // households/{hid} (live)
  subscription: null,        // subscriptions/{household.ownerId} (live)
  premiumRequest: null,      // premiumRequests/{uid} — my own "I'm interested" (live)
  householdLoading: false,
  joining: false,
  busy: false,
  suggestMode: false,
  breakdown: null,           // { respId, parts: [{ name, minutes, frequency, custom, on }], newName } while editing
  view: 'today',
  everyone: false,
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

const DATA_ERRORS = {
  'permission-denied': "The database refused access. In Firebase, open Firestore Database → Rules, paste in the contents of firestore.rules and press Publish.",
  'not-found': "The Firestore database doesn't exist yet. In Firebase, open Firestore Database and create it.",
  'failed-precondition': "The Firestore database isn't ready. In Firebase, check Firestore Database has been created.",
  'unavailable': "You're offline and this household isn't saved on this device yet.",
};

function fail(e) {
  console.error(e);
  S.phase = 'error';
  S.fatal = DATA_ERRORS[e && e.code] || null;
  S.fatalCode = (e && (e.code || e.message)) || 'unknown';
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
    toast(e && e.code === 'permission-denied'
      ? "Couldn't save: the database refused access (permission-denied). Check firestore.rules is published."
      : "Couldn't save that change. Check your connection and try again.");
  });
}
let nameTimer = null;
function flushName() { if (nameTimer) { clearTimeout(nameTimer); nameTimer = null; save('members'); } }

/** After rooms/children/pets change, drop responsibilities that no longer apply. */
function saveSetup(field) {
  const h = S.household;
  const fields = [field];
  if (Household.prune(h)) fields.push('responsibilities');
  if (Household.tidySuggestions(h)) fields.push('suggestions');
  save(...fields);
  rerender();
}
function saveResponsibilities() {
  const fields = ['responsibilities'];
  if (Household.tidySuggestions(S.household)) fields.push('suggestions');
  save(...fields);
  rerender();
}
const isOwner = () => !!S.household && Household.isOwner(S.household, S.user.uid);

/** Once everyone has answered (or the inputs changed before starting), work out the split. */
function maybeBuildPlan(byMe = false) {
  syncPremium();
  const h = S.household;
  if (!h || !Household.needsNewPlan(h)) return false;
  const hadPlan = !!h.plan && h.plan.status === 'proposed';
  Household.buildPlan(h);
  save('plan', 'swaps', 'planSeed');
  if (hadPlan) toast(byMe
    ? 'Plan re-balanced. You both need to say yes again.'
    : 'Something changed, so the plan was re-balanced. Have another look.');
  return true;
}

/* ---------- live data ---------- */
function stop(key) { if (watchers[key]) { watchers[key](); watchers[key] = null; } }
function teardown() {
  stop('user'); stop('household'); stop('sub'); stop('request'); S.premiumRequest = null; clearTimeout(watchers.retryTimer);
  watchers.householdId = undefined; watchers.ownerId = null;
}

async function onAuth(user) {
  teardown();
  Sheet.close();
  S.user = user; S.profile = null; S.household = null; S.subscription = null;
  S.householdLoading = false; S.joining = false; S.lastStage = undefined;
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
  watchers.request = Backend.Repo.watchPremiumRequest(user.uid, req => { S.premiumRequest = req; if (currentRoute === 'premium') rerender(); });
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

function watchHousehold(hid, attempt = 0) {
  stop('household');
  if (attempt === 0) { stop('sub'); watchers.ownerId = null; S.household = null; S.subscription = null; }
  watchers.householdId = hid;
  clearTimeout(watchers.retryTimer);
  if (!hid) { S.householdLoading = false; return; }
  if (!S.household) S.householdLoading = true;
  watchers.household = Backend.Repo.watchHousehold(hid, (h, meta) => {
    if (watchers.householdId !== hid) return;
    if (!h) {
      // The local cache may simply not have it yet (e.g. just joined) — wait for the server.
      if (meta && meta.fromCache) return;
      forgetHousehold(); // really gone (deleted)
      return;
    }
    if (!(h.memberIds || []).includes(S.user.uid)) { forgetHousehold(); return; }
    S.householdLoading = false;
    S.household = h;
    if (h.ownerId !== watchers.ownerId) watchSubscription(h.ownerId);
    maybeBuildPlan();
    if (S.joining) {
      // The household can arrive before the join call itself resolves, so it finishes the join.
      S.joining = false;
      clearInvite();
      render(true);
      return;
    }
    rerender();
  }, err => {
    if (watchers.householdId !== hid) return;
    // Straight after creating or joining, the server can refuse for a moment because the
    // save hasn't landed yet. Retry instead of treating it as "removed".
    if (err && err.code === 'permission-denied' && attempt < 6) {
      watchers.retryTimer = setTimeout(() => watchHousehold(hid, attempt + 1), 400 * Math.pow(2, attempt));
      return;
    }
    S.householdLoading = false;
    if (err && err.code === 'permission-denied') forgetHousehold(); else fail(err);
  });
}

function forgetHousehold() {
  S.household = null; S.subscription = null;
  stop('household'); stop('sub');
  watchers.householdId = null;
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
    if (was !== Entitlements.isPremium(sub)) { maybeBuildPlan(); rerender(); }
    if (Entitlements.isPremium(sub)) {
      const t = sub.grantedAt && typeof sub.grantedAt.toMillis === 'function' ? sub.grantedAt.toMillis() : (sub.grantedAt || 1);
      const key = `household-app/premium-welcome/${ownerId}/${t}`;
      if (!SafeStorage.get(key) && S.household && Household.stage(S.household) !== 'setup') {
        SafeStorage.set(key, '1');
        setTimeout(() => { if (!Sheet.isOpen()) Sheets.premiumWelcome(); }, 300);
      }
    }
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
      S.busy = false;
      history.replaceState(null, '', '#/start');
      render(true);
      const why = DATA_ERRORS[e && e.code] || 'Check your connection and try again.';
      Sheets.notice("Couldn't create your household", `${why} (Error code: ${(e && (e.code || e.message)) || 'unknown'})`);
      return;
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
  toggleResp(d) { if (!isOwner()) return; Household.toggle(S.household, d.id); saveResponsibilities(); },
  toggleCategory(d) {
    if (!isOwner()) return;
    const h = S.household;
    const items = Library.relevant(h).filter(r => r.category === d.cat);
    const sel = Household.selectedLibraryIds(h);
    const all = items.every(i => sel.has(i.id));
    items.forEach(i => (all ? Household.deselect(h, i.id) : Household.select(h, i.id)));
    saveResponsibilities();
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
  openResponsibility(d) { Actions.peek(d); },
  peek(d) {
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === d.id) || Household.parentOf(h, d.id);
    if (r) Sheets.taskPeek(r);
  },
  upgrade() { Sheet.close(); go('premium'); },
  async requestPremium() {
    if (S.busy) return;
    const h = S.household;
    S.busy = true; rerender();
    try {
      await Backend.Repo.requestPremium(S.user, {
        name: Household.memberName(Household.member(h, S.user.uid)),
        householdId: h.id,
        members: h.memberIds.length,
      });
      toast("Thanks! You're on the list.");
    } catch (e) {
      console.error(e);
      toast("Couldn't send that. Check your connection and try again.");
    }
    S.busy = false; rerender();
  },
  /* reshuffle the whole plan (both have to agree) */
  askReshuffle() { Sheets.askReshuffle(); },
  requestReshuffle() {
    Sheet.close();
    Household.requestReshuffle(S.household, S.user.uid);
    save('reshuffle'); rerender();
    toast('Asked. If they agree, you both answer again.');
  },
  acceptReshuffle() {
    const h = S.household;
    Household.acceptReshuffle(h);
    save('prefRound', 'planSeed', 'previousAssignments', 'plan', 'swaps', 'reshare', 'reshuffle');
    toast("Let's reshuffle! Answer again and you'll get a fresh split.");
    goHome();
  },
  declineReshuffle() { Household.declineReshuffle(S.household); save('reshuffle'); rerender(); },
  dismissReshuffle() { Household.markReshuffleSeen(S.household); save('reshuffle'); rerender(); },

  /* cancel Premium (owner) */
  confirmCancelPremium() { Sheets.confirmCancelPremium(); },
  async cancelPremium() {
    Sheet.close();
    try { await Backend.Repo.cancelPremium(S.user.uid); toast('Premium cancelled. Your breakdowns are remembered.'); }
    catch (e) { console.error(e); toast("Couldn't cancel. Check your connection and try again."); }
  },

  /* break a task into parts (owner saves, partner suggests) */
  openBreakdown(d) {
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === d.id);
    if (!r) return;
    const current = Household.parts(r).map(p => ({ name: p.name, minutes: p.minutes, frequency: p.frequency, custom: !!p.custom, on: true }));
    const names = new Set(current.map(p => p.name.toLowerCase()));
    const offered = Household.defaultParts(r).filter(p => !names.has(p.name.toLowerCase())).map(p => ({ ...p, on: false }));
    S.breakdown = { respId: r.id, parts: [...current, ...offered], newName: '' };
    Sheet.close();
    go('breakdown');
  },
  toggleBreakPart(d) { const p = S.breakdown.parts[Number(d.key)]; if (p) p.on = !p.on; rerender(); },
  addBreakPart() {
    const bd = S.breakdown;
    const name = (bd.newName || '').trim();
    if (!name) return;
    if (bd.parts.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('That part is already in the list.'); return; }
    const r = S.household.responsibilities.find(x => x.id === bd.respId);
    bd.parts.push({ name, minutes: 10, frequency: Timing.of(r).frequency, custom: true, on: true });
    bd.newName = '';
    rerender();
    const input = document.getElementById('bd-new'); if (input) { input.value = ''; input.focus(); }
  },
  saveBreakdown() {
    const h = S.household;
    const bd = S.breakdown;
    const r = h.responsibilities.find(x => x.id === bd.respId);
    const parts = bd.parts.filter(p => p.on);
    if (!r || parts.length < 2) return;
    Household.setBreakdown(h, r.id, parts);
    save(...(h.plan ? ['responsibilities', 'plan'] : ['responsibilities']));
    maybeBuildPlan(true);
    S.breakdown = null;
    go('inventory');
    toast(Household.stage(h) === 'active'
      ? `${r.name} is now ${parts.length} parts. Share them out from the plan when you're ready.`
      : `${r.name} is now ${parts.length} parts.`);
  },
  mergeBreakdown() {
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === S.breakdown.respId);
    Household.setBreakdown(h, r.id, []);
    save(...(h.plan ? ['responsibilities', 'plan'] : ['responsibilities']));
    maybeBuildPlan(true);
    S.breakdown = null;
    go('inventory');
    toast(`${r.name} is one task again.`);
  },
  suggestBreakdown() {
    const h = S.household;
    const bd = S.breakdown;
    const parts = bd.parts.filter(p => p.on);
    if (parts.length < 2) return;
    Household.suggestBreakdown(h, S.user.uid, bd.respId, parts);
    save('suggestions');
    S.breakdown = null;
    go('inventory');
    toast(`Suggestion sent to ${Household.memberName(Household.owner(h))}.`);
  },

  /* re-share only the new parts */
  startReshare() {
    const h = S.household;
    const fresh = Household.newParts(h).map(u => u.id);
    const ids = fresh.length ? fresh : Household.units(h).filter(u => u.parentId).map(u => u.id);
    if (!ids.length) return;
    Household.startReshare(h, S.user.uid, ids);
    save('reshare');
    go('reshare');
  },
  setResharePref(d) { Household.setResharePref(S.household, S.user.uid, d.id, d.key); save('reshare'); rerender(); },
  finishReshare() { Household.finishReshare(S.household, S.user.uid); save('reshare'); rerender(); },
  acceptReshare() {
    const h = S.household;
    const done = Household.acceptReshare(h, S.user.uid);
    save('plan', 'reshare');
    if (done) { toast('Done! The new parts are shared out.'); go('plan'); } else rerender();
  },
  declineReshare() {
    Household.declineReshare(S.household);
    save('plan', 'reshare');
    toast('No changes. The parts stay where they are.');
    go('plan');
  },

  dismissNudge() { SafeStorage.set('household-app/nudge-dismissed/' + S.household.id, '1'); rerender(); },

  /* preferences */
  setPref(d) {
    Household.setPref(S.household, S.user.uid, d.id, d.key);
    save('preferences');
    rerender();
  },
  fillPrefs() {
    const h = S.household;
    const v = Household.prefs(h, S.user.uid).values || {};
    h.responsibilities.forEach(r => { if (!v[r.id]) Household.setPref(h, S.user.uid, r.id, 'ok'); });
    save('preferences');
    rerender();
  },
  submitPrefs() {
    const h = S.household;
    if (!Household.allRated(h, S.user.uid)) return;
    Household.submitPrefs(h, S.user.uid);
    save('preferences');
    maybeBuildPlan(true);
    goHome();
  },
  editPrefs() {
    Sheet.close();
    const h = S.household;
    const mine = Household.prefs(h, S.user.uid);
    h.preferences = { ...(h.preferences || {}), [S.user.uid]: { ...mine, submittedAt: null } };
    save('preferences');
    go('preferences');
  },

  /* plan */
  acceptPlan() {
    const h = S.household;
    Household.acceptPlan(h, S.user.uid);
    save('plan');
    if (h.plan.status === 'active') { toast("You're all set. Let's go!"); go('today'); } else rerender();
  },
  timeTotals() {
    Sheets.premium({ title: 'See the time behind the split', body: 'Premium shows roughly how much time each of you spends on the household every week.' });
  },
  claim(d) { Household.claim(S.household, d.id, S.user.uid); save('plan'); rerender(); },

  /* swaps */
  askSwap(d) { Sheets.askSwap(d.id); },
  sendSwap(d) {
    Sheet.close();
    const swap = Household.requestSwap(S.household, S.user.uid, d.to, d.id);
    if (swap) { save('swaps'); toast('Swap offered. Fingers crossed! 🤞'); }
    rerender();
  },
  takeSwap(d) {
    const swap = Household.swaps(S.household).find(x => x.id === d.id);
    if (swap) Sheets.swapPrice(swap);
  },
  completeSwap(d) {
    const h = S.household;
    const swap = Household.swaps(h).find(x => x.id === d.id);
    Sheet.close();
    if (!swap || swap.status !== 'pending') return;
    Household.acceptSwap(h, d.id, d.key || null);
    save('plan', 'swaps');
    const task = (h.responsibilities.find(r => r.id === swap.respId) || {}).name;
    toast(`Deal! ${task} is yours now.`);
    rerender();
  },
  declineSwap(d) { Household.declineSwap(S.household, d.id); save('swaps'); rerender(); },
  dismissSwap(d) { Household.markSwapSeen(S.household, d.id); save('swaps'); rerender(); },

  /* daily use */
  setView(d) { S.view = d.key; rerender(); },
  toggleEveryone() { S.everyone = !S.everyone; rerender(); },
  toggleDone(d) { Household.toggleDone(S.household, d.id, S.user.uid); save('completions'); rerender(); },

  /* members: agree to the owner's list */
  agree() {
    Household.agree(S.household, S.user.uid);
    save('agreements');
    S.suggestMode = false;
    goHome();
    toast("You've agreed to the list.");
  },

  /* Premium: members suggest edits, the owner decides */
  suggestChanges() {
    if (!Entitlements.canSuggestChanges(S.subscription)) {
      Sheets.premium({
        title: 'Suggest changes',
        body: 'With Premium you can suggest adding or removing responsibilities, and the person who set up the household decides.',
      });
      return;
    }
    S.suggestMode = true;
    currentRoute === 'review' ? rerender() : go('review');
  },
  doneSuggesting() {
    S.suggestMode = false;
    const h = S.household;
    Household.agreementState(h, S.user.uid) === 'agreed' ? go('inventory') : rerender();
  },
  suggest(d) {
    if (!Entitlements.canSuggestChanges(S.subscription)) { Actions.suggestChanges(); return; }
    Household.toggleSuggestion(S.household, S.user.uid, d.type, d.id);
    save('suggestions');
    rerender();
  },
  withdrawSuggestion(d) {
    const h = S.household;
    h.suggestions = Household.suggestions(h).filter(x => !(x.id === d.id && x.by === S.user.uid));
    save('suggestions');
    rerender();
  },
  acceptSuggestion(d) {
    if (!isOwner()) return;
    const sug = Household.suggestions(S.household).find(x => x.id === d.id);
    Household.acceptSuggestion(S.household, d.id);
    save('responsibilities', 'suggestions');
    maybeBuildPlan(true);
    rerender();
    if (sug) toast(sug.type === 'add' ? `Added ${sug.name}` : sug.type === 'breakdown' ? `${sug.name} is now broken into parts.` : `Removed ${sug.name}`);
  },
  declineSuggestion(d) {
    if (!isOwner()) return;
    Household.declineSuggestion(S.household, d.id);
    save('suggestions');
    rerender();
  },
};

const Changes = {
  breakFreq(value, d) { const p = S.breakdown && S.breakdown.parts[Number(d.key)]; if (p) { p.frequency = value; rerender(); } },
  breakMin(value, d) { const p = S.breakdown && S.breakdown.parts[Number(d.key)]; if (p) { p.minutes = Number(value); rerender(); } },
  frequency(value, d) { Household.setTiming(S.household, d.id, { frequency: value }); save('responsibilities'); maybeBuildPlan(true); },
  minutes(value, d) { Household.setTiming(S.household, d.id, { minutes: Number(value) }); save('responsibilities'); maybeBuildPlan(true); },
};

const Inputs = {
  breakNew(value) { if (S.breakdown) S.breakdown.newName = value; },
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

/** Broken-down tasks only count while the household has Premium. */
function syncPremium() { Household.premium = Entitlements.canViewDetailedTasks(S.subscription); }

function resolveRoute() {
  const name = hashName();
  if (S.phase === 'setup' || S.phase === 'error' || S.phase === 'loading') return S.phase;
  if (S.phase === 'signedOut') return name === 'auth' ? 'auth' : 'welcome';
  if (S.joining) return 'joining';
  if (!S.profile || S.householdLoading) return 'loading';
  const h = S.household;
  if (!h) return 'start';

  const me = S.user.uid;
  const owner = Household.isOwner(h, me);
  const stage = Household.stage(h);
  if (name === 'premium') return 'premium';
  if (name === 'breakdown' && S.breakdown && Entitlements.canViewDetailedTasks(S.subscription)) return 'breakdown';
  if (name === 'reshare' && h.reshare) return 'reshare';

  // Setting up: the owner walks through the steps, everyone else waits.
  if (stage === 'setup') {
    if (!owner) return 'waiting';
    return SETUP_SCREENS.includes(name) ? name : (h.settings.step || 'members');
  }
  // Members look through the owner's list and agree before anything else.
  if (!owner && stage !== 'active' && Household.agreementState(h, me) !== 'agreed') return 'review';

  let home, allowed;
  if (stage === 'alone' || stage === 'agreeing') { home = 'inventory'; allowed = ['inventory']; }
  else if (stage === 'preferences') { home = Household.prefsComplete(h, me) ? 'prefsDone' : 'preferences'; allowed = [home, 'inventory']; }
  else if (stage === 'plan') { home = 'plan'; allowed = ['plan', 'inventory']; }
  else { home = 'today'; allowed = ['today', 'plan', 'inventory']; }
  if (owner) allowed = allowed.concat(SETUP_SCREENS);
  else allowed = allowed.concat(['review']);
  // When the household moves on to a new stage, everyone goes to that stage's main screen.
  const moved = S.lastStage !== undefined && S.lastStage !== stage;
  S.lastStage = stage;
  if (moved) return home;
  return name === home || allowed.includes(name) ? name : home;
}

function render(routeChanged) {
  syncPremium();
  const name = resolveRoute();
  const routable = name === 'auth' || name === 'welcome' || name === 'start' || HOUSEHOLD_SCREENS.includes(name);
  if (routable && location.hash !== '#/' + name) history.replaceState(null, '', '#/' + name);
  const changed = routeChanged || name !== currentRoute;
  if (name !== currentRoute && name !== 'review') S.suggestMode = false;
  currentRoute = name;
  watchLoading(name);
  $app.innerHTML = Screens[name]();
  fitButtons($app);
  if (changed) {
    window.scrollTo(0, 0);
    const heading = $app.querySelector('h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }
}

/** If any loading state lasts too long, say so instead of spinning forever. */
let loadingTimer = null;
function watchLoading(name) {
  const waiting = name === 'loading' || name === 'joining';
  if (!waiting) { clearTimeout(loadingTimer); loadingTimer = null; return; }
  if (loadingTimer) return;
  loadingTimer = setTimeout(() => {
    loadingTimer = null;
    if (currentRoute === 'loading' || currentRoute === 'joining') {
      S.phase = 'error';
      S.joining = false;
      S.fatal = "This is taking too long. Check your connection. A content blocker, VPN or DNS filter blocking Google's Firebase (gstatic.com, googleapis.com, firebaseapp.com) can also cause this.";
      render(true);
    }
  }, 15000);
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
    ['id', 'key', 'delta', 'cat', 'to', 'mode', 'type', 'change'].forEach(k => { if (a.dataset[k] != null) sel += `[data-${k}="${CSS.escape(a.dataset[k])}"]`; });
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

/** Go to the main screen for wherever the household is now. */
function goHome() { history.replaceState(null, '', '#/'); render(true); }

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
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el.value, { ...el.dataset }, el);
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
  try {
    captureInvite();
    if (!Backend.sdkLoaded()) {
      S.phase = 'error';
      S.fatal = "Couldn't reach the sign-in service. A content blocker, VPN or DNS filter may be blocking Google's Firebase (gstatic.com, googleapis.com). Allow those sites, or try another network, then reload.";
      render(true);
      return;
    }
    if (!Backend.init()) { S.phase = 'setup'; render(true); return; }
    render(true);

    Backend.Auth.redirectResult().catch(e => {
      if (!SILENT_AUTH_ERRORS.includes(e && e.code)) { S.auth.error = authMessage(e); if (S.phase === 'signedOut') rerender(); }
    });
    Backend.Auth.onChange(onAuth);
  } catch (e) {
    // Never leave a blank page: show what went wrong instead.
    console.error(e);
    S.phase = 'error';
    S.fatal = "The app couldn't start. Check js/config.js matches the Firebase setup in the README.";
    try { render(true); } catch (e2) {
      document.getElementById('app').innerHTML = '<main class="screen"><h1>Something went wrong</h1><p class="lead">' + esc(S.fatal) + '</p></main>';
    }
  }
})();
