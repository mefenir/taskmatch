'use strict';

/* =========================================================
   APP — state, auth flow, live sync, actions, routing
   ========================================================= */
const INVITE_KEY = 'household-app/pending-invite';
const INVITE_FROM_KEY = 'household-app/pending-invite-from';
const HOUSEHOLD_SCREENS = ['members', 'home', 'responsibilities', 'frequency', 'rate', 'review', 'today', 'household', 'settings',
  'subscribe', 'breakdown', 'reshare'];
const SETUP_SCREENS = ONBOARDING;

const S = {
  phase: 'loading',          // loading | setup | signedOut | ready | error
  fatal: null,
  user: null,                // Firebase user
  profile: null,             // users/{uid}
  household: null,           // households/{hid} (live)
  grant: null,               // subscriptions/{organiser} — access given from the admin panel (live)
  stripeSubs: [],            // customers/{organiser}/subscriptions — paid subscriptions (live)
  subscription: null,        // the two above merged (Entitlements.effective)
  premiumRequest: null,      // premiumRequests/{uid} — "request access" while billing isn't set up (live)
  householdLoading: false,
  joining: false,
  suggestMode: false,
  breakdown: null,           // { respId, parts: [{ name, minutes, frequency, custom, on }], newName } while editing
  prefDraft: null,           // answers being changed on the review / rate screens, saved in one go
  customDraft: null,         // the "add your own task" form
  planChoice: 'yearly',      // plan picked on the plans screen
  checkoutReturn: null,      // 'success' | 'cancel' after coming back from Stripe
  inviteLink: null,          // ready-made invite (so sharing can open straight from the tap)
  dayOffset: 0,              // the day picked on Today (0 = today … 6)
  pendingInvite: null,
  inviteFrom: null,
  auth: { mode: 'signup', busy: false, error: '', note: '', values: {} },
};

const watchers = { user: null, household: null, sub: null, stripe: null, householdId: undefined, ownerId: null };

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

const BILLING_ERRORS = {
  'billing/not-configured': "Payments aren't set up yet. Please try again later.",
  'billing/timeout': "The payment page didn't open in time. Check your connection and try again.",
  'billing/error': "The payment page couldn't be opened. Nothing was charged. Please try again.",
};

function fail(e) {
  console.error(e);
  S.phase = 'error';
  S.fatal = DATA_ERRORS[e && e.code] || null;
  S.fatalCode = (e && (e.code || e.message)) || 'unknown';
  render(true);
}

/** Read one-time parameters from the address (invite link, return from Stripe), then tidy the address. */
function captureParams() {
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('invite');
    if (code && /^[a-z0-9]{8,40}$/.test(code)) {
      SafeStorage.set(INVITE_KEY, code);
      const from = (params.get('from') || '').trim().slice(0, 40);
      if (from) SafeStorage.set(INVITE_FROM_KEY, from); else SafeStorage.remove(INVITE_FROM_KEY);
    }
    const checkout = params.get('checkout');
    if (checkout === 'success' || checkout === 'cancel') S.checkoutReturn = checkout;
    ['invite', 'from', 'checkout'].forEach(k => params.delete(k));
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  } catch (e) {}
  S.pendingInvite = SafeStorage.get(INVITE_KEY);
  S.inviteFrom = S.pendingInvite ? SafeStorage.get(INVITE_FROM_KEY) : null;
}
function clearInvite() { S.pendingInvite = null; S.inviteFrom = null; SafeStorage.remove(INVITE_KEY); SafeStorage.remove(INVITE_FROM_KEY); }

/* ---------- persistence of household changes ---------- */
function save(...fields) {
  const h = S.household;
  if (!h) return Promise.resolve();
  const data = {};
  [...new Set(fields)].forEach(f => { data[f] = h[f] === undefined ? null : h[f]; });
  return Backend.Repo.saveHousehold(h.id, data).catch(e => {
    console.error(e);
    toast(e && e.code === 'permission-denied'
      ? "Couldn't save: the database refused access. Check firestore.rules is published."
      : "Couldn't save that change. Check your connection and try again.");
  });
}
/** Save a change and, if it changes a plan that isn't running yet, the updated plan in the same write. */
function commit(...fields) {
  if (rebuildPlan(S.user && S.user.uid)) fields.push('plan', 'swaps', 'planSeed', 'previousAssignments', 'reshare');
  return save(...fields);
}
/** Work out the plan again if the list, times, parts or answers changed. `by` counts as having said yes. */
function rebuildPlan(by) {
  const h = S.household;
  if (!h || !Household.needsNewPlan(h)) return false;
  Household.buildPlan(h, by || null);
  return true;
}
let nameTimer = null;
let partnerTimer = null;
function flushName() { if (nameTimer) { clearTimeout(nameTimer); nameTimer = null; save('members'); } }
function flushPartnerName() { if (partnerTimer) { clearTimeout(partnerTimer); partnerTimer = null; save('settings'); } }

/** After rooms/children/pets change, drop tasks that no longer apply. */
function saveSetup(field) {
  const h = S.household;
  const fields = [field];
  if (Household.prune(h)) fields.push('responsibilities');
  if (Household.tidySuggestions(h)) fields.push('suggestions');
  commit(...fields);
  rerender();
}
function saveResponsibilities() {
  const fields = ['responsibilities'];
  if (Household.tidySuggestions(S.household)) fields.push('suggestions');
  commit(...fields);
  rerender();
}
const isOrganiser = () => !!S.household && Household.isOwner(S.household, S.user.uid);
/** The household's subscription is on (setting up and the draft plan don't need it). */
const hasAccess = () => Entitlements.active(S.subscription);

/** Funnel steps, written once per household from each device (no personal data). */
function mark(step) {
  const h = S.household;
  if (!h) return;
  const key = `household-app/metric/${h.id}/${step}`;
  if (SafeStorage.get(key)) return;
  SafeStorage.set(key, '1');
  Backend.Metrics.mark(h.id, step).catch(() => SafeStorage.remove(key));
}
function markActiveDay() {
  const h = S.household;
  if (!h || !h.settings.onboarded || (Household.stage(h) !== 'draft' && !hasAccess())) return;
  const day = Household.dayKey();
  const key = `household-app/active/${h.id}`;
  if (SafeStorage.get(key) === day) return;
  SafeStorage.set(key, day);
  Backend.Metrics.activeDay(h.id, day).catch(() => SafeStorage.remove(key));
}

/* ---------- live data ---------- */
function stop(key) { if (watchers[key]) { watchers[key](); watchers[key] = null; } }
function teardown() {
  stop('user'); stop('household'); stop('sub'); stop('stripe'); clearTimeout(watchers.subRetry); stop('request'); S.premiumRequest = null; clearTimeout(watchers.retryTimer);
  watchers.householdId = undefined; watchers.ownerId = null; watchers.lastOwner = null; watchers.lastNames = null;
}

async function onAuth(user) {
  teardown();
  Sheet.close();
  S.user = user; S.profile = null; S.household = null; S.grant = null; S.stripeSubs = []; S.subscription = null;
  S.householdLoading = false; S.joining = false; S.lastStage = undefined; S.inviteLink = null;
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
  watchers.request = Backend.Repo.watchPremiumRequest(user.uid, req => { S.premiumRequest = req; if (currentRoute === 'subscribe') rerender(); });
}

function onProfile(profile) {
  S.profile = profile || { householdId: null };
  const hid = S.profile.householdId || null;

  if (S.pendingInvite && !S.joining) {
    if (!hid) { redeemInvite(); return; }
    clearInvite();
    render(false);
    Sheets.notice("You're already in a household", "Being part of more than one household isn't possible yet. To join another one, leave this household first.");
  }
  if (hid !== watchers.householdId) watchHousehold(hid);
  render(false);
  // Signed in again to delete the account (same person, recently): carry on.
  let resume = null;
  try { resume = JSON.parse(SafeStorage.get(RESUME_DELETE_KEY) || 'null'); } catch (e) {}
  if (resume) {
    SafeStorage.remove(RESUME_DELETE_KEY);
    if (resume.uid === S.user.uid && Date.now() - resume.at < 30 * 60 * 1000) {
      setTimeout(() => { if (hid) go('settings'); Actions.confirmDeleteAccount(); }, 600);
    }
  }
  if (!hid) afterPortal();
}

function watchHousehold(hid, attempt = 0) {
  stop('household');
  if (attempt === 0) { stop('sub'); stop('stripe'); watchers.ownerId = null; watchers.lastOwner = null; watchers.lastNames = null; S.household = null; S.grant = null; S.stripeSubs = []; S.subscription = null; }
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
    S.household = Household.sanitize(h);
    if (h.ownerId !== watchers.ownerId) watchAccess(h.ownerId);
    afterSnapshot(h);
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

/** Housekeeping on every update from the server. */
function afterSnapshot(h) {
  const me = S.user.uid;
  // The organiser left and I'm the organiser now.
  const was = watchers.lastOwner;
  if (was && was !== h.ownerId && h.ownerId === me) {
    const name = (watchers.lastNames || {})[was] || 'Your partner';
    setTimeout(() => Sheets.notice(`${name} left the household`, "You're the organiser now. Your plan, tasks and history are all here."), 300);
  }
  watchers.lastOwner = h.ownerId;
  watchers.lastNames = Object.fromEntries((h.members || []).map(m => [m.uid, Household.memberName(m)]));
  // The partner takes over what the placeholder had in the plan.
  if (!Household.isOwner(h, me)) {
    mark('joined');
    if (h.plan && Object.values(h.plan.assignments || {}).includes(INVITEE)) {
      h.plan = { ...h.plan, assignments: Object.fromEntries(Object.entries(h.plan.assignments).map(([k, v]) => [k, v === INVITEE ? me : v])) };
      save('plan');
    }
  }
  // Changes nobody in particular made: the organiser's app keeps a plan that isn't running yet up to date.
  if (Household.isOwner(h, me) && rebuildPlan(null)) save('plan', 'swaps', 'planSeed', 'previousAssignments', 'reshare');
  if (Household.isOwner(h, me) && Household.stage(h) === 'draft' && hasAccess()) prepareInvite();
  markActiveDay();
}

function forgetHousehold() {
  // Gone without my doing (the organiser deleted it): say so, once.
  const before = S.household;
  if (before && !S.selfLeaving && !Household.isOwner(before, S.user.uid)) {
    const who = Household.memberName(Household.owner(before));
    setTimeout(() => Sheets.notice(`${who} deleted the household`, "It's gone for both of you. You can set up your own home any time."), 300);
  }
  S.selfLeaving = false;
  S.household = null; S.grant = null; S.stripeSubs = []; S.subscription = null;
  stop('household'); stop('sub'); stop('stripe');
  watchers.householdId = null;
  Backend.Repo.setHouseholdRef(S.user.uid, null).catch(() => {});
  render(true);
}

/**
 * Access follows the organiser's account: a paid Stripe subscription, or a grant from the admin panel.
 * A read that fails means "unknown", never "ended": both listeners are retried with a growing pause,
 * and meanwhile the household shows a neutral "checking" screen instead of the plans screen.
 */
const READ_FAILED = Symbol('read failed');
function watchAccess(ownerId, attempt = 0) {
  stop('sub'); stop('stripe'); clearTimeout(watchers.subRetry);
  watchers.ownerId = ownerId;
  if (attempt === 0) { S.grant = null; S.stripeSubs = []; S.subscription = null; S.subUnknown = false; watchers.subLoaded = false; }
  const read = { grant: undefined, stripe: Backend.Billing.enabled() ? undefined : [] };   // undefined = still waiting
  const retry = () => {
    clearTimeout(watchers.subRetry);
    watchers.subRetry = setTimeout(() => { if (watchers.ownerId === ownerId) watchAccess(ownerId, attempt + 1); },
      Math.min(60000, 2000 * Math.pow(2, attempt)));
  };
  const update = () => {
    if (read.grant === undefined || read.stripe === undefined) return;
    const was = hasAccess();
    const firstLoad = !watchers.subLoaded;
    S.grant = read.grant === READ_FAILED ? null : read.grant;
    S.stripeSubs = read.stripe;                       // null = couldn't read (never treated as "none")
    S.subscription = Entitlements.effective(S.grant, S.stripeSubs);
    watchers.subLoaded = true;
    const now = hasAccess();
    S.subUnknown = !now && (read.grant === READ_FAILED || read.stripe === null);
    if (read.grant === READ_FAILED || read.stripe === null) retry();
    if (now && S.household && isOrganiser()) {
      mark('subscribed');
      if (Household.stage(S.household) === 'draft') {
        prepareInvite();
        // Just subscribed (back from Stripe, or a grant arriving while the app is open): straight on to the invite.
        if (S.checkoutReturn === 'success' || (!was && !firstLoad)) setTimeout(() => { if (!Sheet.isOpen()) Sheets.unlocked(); }, 300);
      }
    }
    if (now) { S.checkoutReturn = null; markActiveDay(); }
    afterPortal();
    if (was && !now && !firstLoad && Sheet.isOpen()) Sheet.close();
    rerender();
  };
  watchers.sub = Backend.Repo.watchSubscription(ownerId,
    grant => { read.grant = grant; update(); },
    () => { read.grant = READ_FAILED; update(); });
  if (Backend.Billing.enabled()) {
    watchers.stripe = Backend.Billing.watchSubscriptions(ownerId, subs => { read.stripe = subs; update(); });
  }
}

/** Deleting an account needs a fresh sign-in: sign out, ask for it, then carry on (see onProfile). */
function askToSignInAgain() {
  SafeStorage.set(RESUME_DELETE_KEY, JSON.stringify({ uid: S.user.uid, at: Date.now() }));
  Sheet.close();
  Backend.Auth.signOut().then(() => {
    S.auth = { mode: 'signin', busy: false, error: '', note: 'For your security, sign in again to delete your account.', values: {} };
    if (S.phase === 'signedOut') render(true);   // otherwise the sign-out itself renders it (see resolveRoute)
  });
}

/** Back from Stripe after "cancel, then leave / delete": finish what was started. */
function afterPortal() {
  let pending = null;
  try { pending = JSON.parse(SafeStorage.get(AFTER_PORTAL_KEY + S.user.uid) || 'null'); } catch (e) {}
  if (!pending) return;
  const forAccount = pending.then === 'deleteAccount';      // needs no household
  if (!forAccount && (!S.household || !watchers.subLoaded)) return;
  SafeStorage.remove(AFTER_PORTAL_KEY + S.user.uid);
  if (Date.now() - pending.at > 60 * 60 * 1000) return;
  setTimeout(async () => (forAccount ? Actions.confirmDeleteAccount() : Sheets.afterCancel(pending.then, await ownSubscriptionRenews())), 300);
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

/* ---------- invite: made in advance so the share sheet opens straight from the tap ---------- */
const INVITE_LINK_KEY = 'household-app/invite-link/';
function inviteText() {
  const h = S.household;
  const me = Household.memberName(Household.member(h, S.user.uid));
  return `${me} made a plan for our home: who does what, split fairly. Have a look and mark anything that doesn't suit you.`;
}
function prepareInvite() {
  const h = S.household;
  if (S.inviteLink || watchers.inviteBusy) return;
  try {
    const saved = JSON.parse(SafeStorage.get(INVITE_LINK_KEY + h.id) || 'null');
    if (saved && saved.until > Date.now()) { S.inviteLink = saved.link; return; }
  } catch (e) {}
  watchers.inviteBusy = true;
  const me = Household.memberName(Household.member(h, S.user.uid));
  Backend.Repo.createInvite(h.id, S.user.uid, h.settings.partnerName || '')
    .then(code => {
      S.inviteLink = `${location.origin}${location.pathname}?invite=${code}&from=${encodeURIComponent(me)}`;
      // Keep it a little shorter than the invite itself lives.
      SafeStorage.set(INVITE_LINK_KEY + h.id, JSON.stringify({ link: S.inviteLink, until: Date.now() + (APP_CONFIG.inviteValidDays - 1) * 864e5 }));
    })
    .catch(e => console.error(e))
    .finally(() => { watchers.inviteBusy = false; });
}

/* ---------- auth form ---------- */
async function submitAuth() {
  const { mode, values: v } = S.auth;
  const email = (v.email || '').trim();
  const password = v.password || '';
  const min = APP_CONFIG.minPasswordLength;
  let error = '';
  if (!email) error = 'Enter your email address.';
  else if (mode === 'signup' && password.length < min) error = `Use at least ${min} characters for your password.`;
  else if (mode === 'signin' && !password) error = 'Enter your password.';
  if (error) { S.auth.error = error; S.auth.note = ''; rerender(); return; }

  S.auth.busy = true; S.auth.error = ''; S.auth.note = '';
  rerender();
  try {
    if (mode === 'signup') await Backend.Auth.signUp((v.name || '').trim(), email, password);
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
   An action that returns a promise keeps its button busy until it settles
   (see the click handler), so nothing can run twice.
   ========================================================= */
let checkoutInFlight = false;
const AFTER_PORTAL_KEY = 'household-app/after-portal/';
const RESUME_DELETE_KEY = 'household-app/resume-delete-account';
/** The organiser's own paid subscription will still renew (so leaving would keep charging). Unknown → true. */
async function ownSubscriptionRenews() {
  if (!isOrganiser()) return false;
  return (await Backend.Billing.ownSubscriptionRunning(S.user.uid)) !== false;
}
const CHECKOUT_KEY = 'household-app/checkout/';

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
  signOut() { Sheet.close(); flushName(); flushPartnerName(); Backend.Auth.signOut(); },

  /* household lifecycle */
  async createHousehold() {
    const name = (S.user.displayName || (S.profile && S.profile.displayName) || '').trim();
    try {
      const hid = await Backend.Repo.createHousehold(S.user.uid, Household.create({ ownerId: S.user.uid, ownerName: name }));
      SafeStorage.set(`household-app/metric/${hid}/created`, '1');
      Backend.Metrics.mark(hid, 'created').catch(() => {});
      history.replaceState(null, '', '#/members');
    } catch (e) {
      console.error(e);
      history.replaceState(null, '', '#/start');
      render(true);
      const why = DATA_ERRORS[e && e.code] || 'Check your connection and try again.';
      Sheets.notice("Couldn't create your household", `${why} (Error code: ${(e && (e.code || e.message)) || 'unknown'})`);
    }
  },
  async deleteHousehold() {
    S.selfLeaving = true;
    try { await Backend.Repo.deleteHousehold(S.household.id, S.user.uid); Sheet.close(); toast('Household deleted.'); }
    catch (e) { S.selfLeaving = false; console.error(e); toast("Couldn't delete the household. Try again."); }
  },
  async leaveHousehold() {
    const h = S.household;
    S.selfLeaving = true;
    try { await Backend.Repo.leaveHousehold(h, S.user.uid, Household.departure(h, S.user.uid)); Sheet.close(); toast('You left the household.'); }
    catch (e) { S.selfLeaving = false; console.error(e); toast("Couldn't leave the household. Try again."); }
  },
  /** Cancel in Stripe first, then come back to finish leaving / deleting (see afterPortal). */
  cancelThen(d) {
    if (!['leave', 'deleteHousehold', 'deleteAccount'].includes(d.key)) return;
    SafeStorage.set(AFTER_PORTAL_KEY + S.user.uid, JSON.stringify({ then: d.key, at: Date.now() }));
    return Actions.openPortal();
  },
  /** Before deleting an account: does this person still have a subscription that renews? */
  async confirmDeleteAccount() {
    const running = await Backend.Billing.ownSubscriptionRunning(S.user.uid);
    if (running === null) { toast("We couldn't check your subscription. Check your connection and try again."); return; }
    Sheets.deleteAccount(running);
  },
  /**
   * Delete my account: leave (or hand over, or delete) the household, then erase my data and
   * my sign-in. Firebase needs a recent sign-in for this, so after a while it asks for one first.
   */
  async deleteAccount() {
    const running = await Backend.Billing.ownSubscriptionRunning(S.user.uid);
    if (running !== false) { if (running) Sheets.deleteAccount(true); else toast("We couldn't check your subscription. Try again in a moment."); return; }
    if (!Backend.Auth.signedInRecently()) {
      askToSignInAgain();
      return;
    }
    const h = S.household;
    const me = S.user.uid;
    let left = false;
    S.selfLeaving = true;
    try {
      if (h && Household.isOwner(h, me) && Household.alone(h)) await Backend.Repo.deleteHousehold(h.id, me);
      else if (h) await Backend.Repo.leaveHousehold(h, me, Household.departure(h, me));
      left = !!h;
      teardown();
      await Backend.Repo.deleteAccount(S.user);
      Sheet.close();
      history.replaceState(null, '', '#/');
      toast('Your account and your data have been deleted.');
    } catch (e) {
      S.selfLeaving = false;
      console.error(e);
      if (e && e.code === 'auth/requires-recent-login') {
        askToSignInAgain();
        return;
      }
      // Still signed in: pick up where things are now, rather than leaving the app frozen.
      const user = Backend.Auth.current();
      if (user) onAuth(user);
      toast(left ? "You've left the household, but your account couldn't be deleted yet. Try again in Settings."
        : "Couldn't delete your account. Check your connection and try again.");
    }
  },

  /* invite: the phone's share sheet straight away; a sheet with the link otherwise */
  async invite() {
    const h = S.household;
    if (!isOrganiser() || !Household.alone(h)) return;
    if (!hasAccess()) { Sheet.close(); go('subscribe'); return; }
    const name = Household.memberName(Household.invitee(h));
    const text = inviteText();
    if (!S.inviteLink) {
      prepareInvite();
      for (let i = 0; i < 40 && !S.inviteLink; i++) await new Promise(r => setTimeout(r, 250));
      if (!S.inviteLink) { toast("Couldn't create an invite link. Check your connection and try again."); return; }
      Sheets.invite({ link: S.inviteLink, text, name });   // the tap's moment to share has passed
    } else if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Our home plan', text, url: S.inviteLink }); }
      catch (e) { if (e && e.name === 'AbortError') return; Sheets.invite({ link: S.inviteLink, text, name }); }
    } else {
      Sheets.invite({ link: S.inviteLink, text, name });
    }
    if (!h.settings.invitedAt) { h.settings.invitedAt = new Date().toISOString(); save('settings'); }
    mark('invited');
    rerender();
  },
  copyInvite() {
    const value = `${inviteText()}\n${S.inviteLink}`;
    const done = () => toast('Copied. Paste it into a message.');
    const failCopy = () => toast("Copying didn't work. Press and hold the link to copy it.");
    try { navigator.clipboard.writeText(value).then(done, failCopy); } catch (e) { failCopy(); }
  },
  async shareInvite() {
    try { await navigator.share({ title: 'Our home plan', text: inviteText(), url: S.inviteLink }); Sheet.close(); }
    catch (e) { /* closed the share sheet: the link stays on screen */ }
  },

  /* navigation */
  nav(d) {
    flushName(); flushPartnerName();
    const h = S.household;
    if (h && !h.settings.onboarded && ONBOARDING.includes(d.to) && h.settings.step !== d.to) {
      if (currentRoute === 'responsibilities' && d.to === 'frequency') mark('listed');
      h.settings.step = d.to;
      save('settings');
    }
    go(d.to);
  },
  sheetNav(d) { Sheet.close(); go(d.to); },
  closeSheet() { Sheet.close(); },
  menu() { go('settings'); },
  // Leaving or deleting: if the organiser's own subscription still renews, offer to cancel it first.
  // (Unknown counts as "renews", so the safe option is always shown when in doubt.)
  async confirmDelete() { Sheets.confirmDelete(await ownSubscriptionRenews()); },
  async confirmLeave() { Sheets.confirmLeave(await ownSubscriptionRenews()); },

  /* household setup (organiser) */
  step(d) {
    if (!isOrganiser()) return;
    const h = S.household;
    const [min, max] = LIMITS[d.key];
    const delta = Number(d.delta);
    if (d.key === 'children') { Household.setChildren(h, clamp(h.children.length + delta, min, max)); saveSetup('children'); }
    else { Household.setRoom(h, d.key, clamp(roomCount(h, d.key) + delta, min, max)); saveSetup('rooms'); }
  },
  toggleRoom(d) { if (!isOrganiser()) return; const h = S.household; Household.setRoom(h, d.key, roomCount(h, d.key) > 0 ? 0 : 1); saveSetup('rooms'); },
  toggleFlag(d) { if (!isOrganiser()) return; const h = S.household; h.circumstances[d.key] = !h.circumstances[d.key]; saveSetup('circumstances'); },
  togglePet(d) { if (!isOrganiser()) return; Household.togglePet(S.household, d.key); saveSetup('pets'); },
  clearPets() { if (!isOrganiser()) return; S.household.pets = []; saveSetup('pets'); },

  /* tasks */
  toggleResp(d) { if (!isOrganiser()) return; Household.toggle(S.household, d.id); saveResponsibilities(); },
  toggleCategory(d) {
    if (!isOrganiser()) return;
    const h = S.household;
    const items = Library.relevant(h).filter(r => r.category === d.cat);
    const sel = Household.selectedLibraryIds(h);
    const all = items.every(i => sel.has(i.id));
    items.forEach(i => (all ? Household.deselect(h, i.id) : Household.select(h, i.id)));
    saveResponsibilities();
  },
  addCustomTask() { if (isOrganiser()) Sheets.customTask(); },
  saveCustomTask() {
    const h = S.household;
    const d = S.customDraft || {};
    if (!isOrganiser()) return;
    const r = Household.addCustom(h, d);
    if (!r) { toast('Give the task a name first.'); const i = document.getElementById('ct-name'); if (i) i.focus(); return; }
    S.customDraft = null;
    Sheet.close();
    saveResponsibilities();
    toast(`Added ${r.name}.`);
  },
  removeTask(d) {
    if (!isOrganiser()) return;
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === d.id);
    if (!r || r.predefined) return;
    Household.removeTask(h, r.id);
    Sheet.close();
    saveResponsibilities();
    toast(`Removed ${r.name}.`);
  },

  /* answers: during setup they're saved as you tap; later they're changed in one go */
  setPref(d) {
    const h = S.household;
    if (!h.settings.onboarded) {
      if (!isOrganiser()) return;
      Household.setPref(h, S.user.uid, d.id, d.key);
      save('preferences');
    } else {
      S.prefDraft = { ...(S.prefDraft || {}), [d.id]: d.key };
    }
    rerender();
  },
  setBaseline(d) {
    if (!isOrganiser() || !['me', 'half', 'them'].includes(d.key)) return;
    S.household.settings.baseline = d.key;
    save('settings');
    rerender();
  },
  /** The organiser's last setup step: hand in the answers and see the plan. */
  finishSetup() {
    const h = S.household;
    if (!isOrganiser() || h.settings.onboarded) return;
    const me = S.user.uid;
    Household.submitPrefs(h, me);
    h.settings.onboarded = true;
    h.settings.step = 'plan';
    Household.buildPlan(h, me);
    save('settings', 'preferences', 'plan', 'swaps', 'planSeed');
    mark('rated');
    if (hasAccess()) prepareInvite();
    go('household');
  },
  /** Changing answers later (anyone, before the plan runs). */
  saveAnswers() {
    applyPrefDraft();
    const h = S.household;
    Household.submitPrefs(h, S.user.uid);
    commit('preferences');
    toast('Saved. The plan follows your answers.');
    go('household');
  },
  /** The partner, after looking at the plan: start it, or rebalance with their answers first. */
  submitReview() {
    const h = S.household;
    const me = S.user.uid;
    if (Household.isOwner(h, me)) return;
    applyPrefDraft();
    const changes = Household.marked(h, me) > 0;
    Household.submitPrefs(h, me);
    Household.buildPlan(h, changes ? null : me);
    if (changes) h.plan = { ...h.plan, rebalancedBy: me };
    else if (Household.hasAccepted(h, me)) Household.acceptPlan(h, me);
    save('preferences', 'plan', 'swaps', 'planSeed');
    mark('reviewed');
    if (h.plan.status === 'active') { mark('started'); toast("You're all set. Let's go!"); go('today'); return; }
    toast(changes ? "Rebalanced with your answers. Have a look and say yes." : 'Thanks! The plan starts once you both say yes.');
    go('household');
  },

  /* plan */
  acceptPlan() {
    const h = S.household;
    if (!h.plan || h.plan.status === 'active' || Household.alone(h)) return;
    Household.acceptPlan(h, S.user.uid);
    save('plan');
    if (h.plan.status === 'active') {
      mark('started');
      toast("You're all set. Let's go!");
      go('today');
    } else rerender();
  },
  claim(d) { Household.claim(S.household, d.id, S.user.uid); save('plan'); rerender(); },

  /* reshuffle the whole plan (the other person agrees first) */
  askReshuffle() { Sheets.askReshuffle(); },
  requestReshuffle() {
    Sheet.close();
    Household.requestReshuffle(S.household, S.user.uid);
    save('reshuffle'); rerender();
    toast('Asked. If they agree, you both get a fresh split.');
  },
  acceptReshuffle() {
    const h = S.household;
    Household.acceptReshuffle(h, S.user.uid);
    save('planSeed', 'previousAssignments', 'plan', 'swaps', 'reshare', 'reshuffle');
    toast("Here's a fresh split. Say yes when it works for you.");
    go('household');
  },
  declineReshuffle() { Household.declineReshuffle(S.household); save('reshuffle'); rerender(); },
  dismissReshuffle() { Household.markReshuffleSeen(S.household); save('reshuffle'); rerender(); },

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
    toast(`Deal! ${Household.unitName(h, swap.respId)} is yours now.`);
    rerender();
  },
  declineSwap(d) { Household.declineSwap(S.household, d.id); save('swaps'); rerender(); },
  dismissSwap(d) { Household.markSwapSeen(S.household, d.id); save('swaps'); rerender(); },

  /* daily use */
  shareNow() { if (isOrganiser()) shareNewTasks(true); },
  setDay(d) { S.dayOffset = clamp(Number(d.key) || 0, 0, 6); rerender(); },
  toggleDone(d) {
    const h = S.household;
    Household.toggleDone(h, d.id, S.user.uid);
    save('completions');
    rerender();
  },

  /* subscription: one screen, one checkout */
  peek(d) {
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === d.id) || Household.parentOf(h, d.id);
    if (r) Sheets.taskPeek(r, Household.unit(h, d.id));
  },
  /** Whoever does a weekly task picks its day; it stays until they change it. */
  setWeekday(d) {
    const h = S.household;
    const day = Number(d.key);
    const u = Household.unit(h, d.id);
    if (!u || !Household.setWeekday(h, S.user.uid, d.id, day)) return;
    save('weekdays');
    const r = h.responsibilities.find(x => x.id === d.id) || Household.parentOf(h, d.id);
    if (r) Sheets.taskPeek(r, u);
    rerender();
    toast(`${u.name}: every ${Timing.of(u).frequency === 'fortnightly' ? 'other ' : ''}${Schedule.WEEKDAYS[day]}`);
  },
  choosePlan(d) { if (d.key === 'yearly' || d.key === 'monthly') { S.planChoice = d.key; rerender(); } },
  /**
   * Open Stripe Checkout. Guarded four ways against paying twice: the busy button, an in-flight
   * flag, "already subscribed", and re-using the same checkout page for 25 minutes (so even a second
   * tap after a reload lands on the same payment, not a new one).
   */
  async startCheckout() {
    if (checkoutInFlight || !isOrganiser()) return;
    if (!watchers.subLoaded || !Array.isArray(S.stripeSubs)) { toast("We're still checking your plan. Try again in a moment."); return; }
    if (hasAccess()) { toast('You already have a subscription.'); return; }
    if (Entitlements.paymentProblem(S.stripeSubs)) { toast('Please fix the payment for your subscription first.'); return; }
    const plan = S.planChoice === 'monthly' ? 'monthly' : 'yearly';
    const key = `${CHECKOUT_KEY}${S.user.uid}`;
    try {
      const recent = JSON.parse(SafeStorage.get(key) || 'null');
      if (recent && recent.plan === plan && Date.now() - recent.at < 25 * 60 * 1000 && recent.url) { location.assign(recent.url); return holdBusy(); }
    } catch (e) {}
    checkoutInFlight = true;
    try {
      mark('checkout');
      const url = await Backend.Billing.startCheckout(S.user.uid, plan, { trial: !Entitlements.hadSubscription(S.stripeSubs) });
      SafeStorage.set(key, JSON.stringify({ plan, url, at: Date.now() }));
      location.assign(url);
      return holdBusy();
    } catch (e) {
      console.error(e);
      toast(BILLING_ERRORS[e && e.code] || "The payment page couldn't be opened. Nothing was charged. Please try again.");
    } finally {
      checkoutInFlight = false;
    }
  },
  async openPortal() {
    try { location.assign(await Backend.Billing.portalUrl()); return holdBusy(); }
    catch (e) {
      console.error(e);
      if (S.user) SafeStorage.remove(AFTER_PORTAL_KEY + S.user.uid);   // nothing to come back to
      toast("Couldn't open your subscription settings. Try again in a moment.");
    }
  },
  async requestPremium() {
    const h = S.household;
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
  },

  /* break a task into parts (organiser saves, partner suggests) */
  openBreakdown(d) {
    // Breaking tasks into parts comes with the subscription (the draft before it is free).
    if (!hasAccess()) { Sheets.partsNeedSubscription(); return; }
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
  toggleBreakPart(d) { const p = S.breakdown && S.breakdown.parts[Number(d.key)]; if (p) p.on = !p.on; rerender(); },
  addBreakPart() {
    const bd = S.breakdown;
    if (!bd) return;
    const name = (bd.newName || '').trim().slice(0, 60);
    if (!name) return;
    if (bd.parts.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('That part is already in the list.'); return; }
    const r = S.household.responsibilities.find(x => x.id === bd.respId);
    bd.parts.push({ name, minutes: 10, frequency: Timing.of(r).frequency, custom: true, on: true });
    bd.newName = '';
    rerender();
    const input = document.getElementById('bd-new'); if (input) { input.value = ''; input.focus(); }
  },
  saveBreakdown() {
    if (!isOrganiser() || !hasAccess()) return;
    const h = S.household;
    const bd = S.breakdown;
    const r = bd && h.responsibilities.find(x => x.id === bd.respId);
    const parts = bd ? bd.parts.filter(p => p.on) : [];
    if (!r || parts.length < 2) return;
    Household.setBreakdown(h, r.id, parts);
    commit('responsibilities', 'plan');
    S.breakdown = null;
    if (shareNewTasks(true)) { toast(`${r.name} is now ${parts.length} parts. Say how you feel about them, then they're shared out fairly.`); return; }
    go('household');
    toast(`${r.name} is now ${parts.length} parts.`);
  },
  mergeBreakdown() {
    if (!isOrganiser()) return;
    const h = S.household;
    const r = S.breakdown && h.responsibilities.find(x => x.id === S.breakdown.respId);
    if (!r) return;
    Household.setBreakdown(h, r.id, []);
    commit('responsibilities', 'plan');
    S.breakdown = null;
    go('household');
    toast(`${r.name} is one task again.`);
  },
  suggestBreakdown() {
    const h = S.household;
    const bd = S.breakdown;
    const parts = bd ? bd.parts.filter(p => p.on) : [];
    if (parts.length < 2) return;
    Household.suggestBreakdown(h, S.user.uid, bd.respId, parts);
    save('suggestions');
    S.breakdown = null;
    go('household');
    toast(`Suggestion sent to ${Household.memberName(Household.owner(h))}.`);
  },

  /* sharing out new tasks in a running plan */
  setResharePref(d) { Household.setResharePref(S.household, S.user.uid, d.id, d.key); save('reshare'); rerender(); },
  finishReshare() { Household.finishReshare(S.household, S.user.uid); save('reshare'); rerender(); },
  acceptReshare() {
    const h = S.household;
    const done = Household.acceptReshare(h, S.user.uid);
    save('plan', 'reshare');
    if (done) { toast('Done! Shared out fairly.'); go('household'); } else rerender();
  },
  declineReshare() {
    Household.declineReshare(S.household);
    save('plan', 'reshare');
    toast('No changes. Anything new that nobody has stays under Needs a home.');
    go('household');
  },

  /* board */
  toggleBoard() { openBoard(!S.boardOpen); rerender(); },
  addNote() { Sheets.addNote(); },
  noteKind(d) { S.noteDraft = { ...(S.noteDraft || {}), kind: d.key }; Sheets.addNote(); },
  postNote() {
    const h = S.household;
    const d = S.noteDraft || {};
    const n = Household.addNote(h, S.user.uid, d.kind || 'note', d.text);
    if (!n) { const i = document.getElementById('note-text'); if (i) i.focus(); toast('Write something first.'); return; }
    save('notes');
    S.noteDraft = { kind: d.kind || 'note', text: '' };
    openBoard(true);
    Sheet.close();
    rerender();
    if (n.kind === 'low') {
      const t = Household.noteTarget(h, n);
      toast(!t ? 'On the board for whoever gets there first.'
        : t.uid === S.user.uid ? `Added to your Today list (${t.via}).`
        : `${Household.memberName(Household.member(h, t.uid))} will see it with ${t.via}.`);
    } else toast(n.kind === 'today' ? 'On the board. Whoever takes it first gets it.' : 'On the board for 7 days.');
  },
  deleteNote(d) { if (Household.deleteNote(S.household, S.user.uid, d.id)) { save('notes'); rerender(); } },
  claimNote(d) {
    if (Household.claimNote(S.household, S.user.uid, d.id)) { save('notes'); rerender(); toast("It's on your Today list."); }
    else { toast('Someone already took it.'); rerender(); }
  },
  gotNote(d) { if (Household.finishNote(S.household, d.id)) { save('notes'); rerender(); toast('Thanks! Off the board.'); } },
  doneNote(d) { if (Household.finishNote(S.household, d.id)) { save('notes'); rerender(); toast('Done. Nice one.'); } },

  /* the partner suggests list changes, the organiser decides */
  suggestChanges() {
    S.suggestMode = true;
    go('household');
  },
  doneSuggesting() { S.suggestMode = false; rerender(); },
  suggest(d) {
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
    if (!isOrganiser()) return;
    const sug = Household.suggestions(S.household).find(x => x.id === d.id);
    if (!sug) return;
    Household.acceptSuggestion(S.household, d.id);
    commit('responsibilities', 'suggestions', 'plan');
    rerender();
    if (sug.type !== 'remove' && shareNewTasks(true)) {
      toast(sug.type === 'add' ? `Added ${sug.name}. Say how you feel about it, then it's shared out fairly.` : `${sug.name} is now broken into parts. Say how you feel about them, then they're shared out fairly.`);
      return;
    }
    toast(sug.type === 'add' ? `Added ${sug.name}` : sug.type === 'breakdown' ? `${sug.name} is now broken into parts.` : `Removed ${sug.name}`);
  },
  declineSuggestion(d) {
    if (!isOrganiser()) return;
    Household.declineSuggestion(S.household, d.id);
    save('suggestions');
    rerender();
  },
};

/** Keep a button busy while the browser leaves for Stripe (or for 15 s if it doesn't). */
const holdBusy = () => new Promise(resolve => setTimeout(resolve, 15000));

/** Answers changed on the review / rate screens land in the household in one go. */
function applyPrefDraft() {
  const h = S.household;
  Object.entries(S.prefDraft || {}).forEach(([id, v]) => Household.setPref(h, S.user.uid, id, v));
  S.prefDraft = null;
}
/** A draft only lives while its screen is open. */
function prefValue(h, userId, unit) {
  if (S.prefDraft && unit.id in S.prefDraft) return S.prefDraft[unit.id];
  return Household.prefFor(h, userId, unit);
}

/** How many tasks I've marked ❤️ or 🙃, counting answers not saved yet. */
function markedCount(h, userId) {
  const v = { ...(Household.prefs(h, userId).values || {}) };
  Object.entries(S.prefDraft || {}).forEach(([k, x]) => { if (x === 'ok') delete v[k]; else v[k] = x; });
  return Object.keys(v).length;
}

const Changes = {
  breakFreq(value, d) { const p = S.breakdown && S.breakdown.parts[Number(d.key)]; if (p && FREQUENCIES.some(f => f.id === value)) { p.frequency = value; rerender(); } },
  breakMin(value, d) { const p = S.breakdown && S.breakdown.parts[Number(d.key)]; if (p) { p.minutes = Number(value) || p.minutes; rerender(); } },
  frequency(value, d) { if (!isOrganiser()) return; Household.setTiming(S.household, d.id, { frequency: value }); commit('responsibilities'); rerender(); },
  minutes(value, d) { if (!isOrganiser()) return; Household.setTiming(S.household, d.id, { minutes: Number(value) }); commit('responsibilities'); rerender(); },
  customCategory(value) { S.customDraft = { ...(S.customDraft || {}), category: value }; },
  customFrequency(value) { S.customDraft = { ...(S.customDraft || {}), frequency: value }; },
  customMinutes(value) { S.customDraft = { ...(S.customDraft || {}), minutes: Number(value) }; },
};

const Inputs = {
  noteText(value) { S.noteDraft = { ...(S.noteDraft || { kind: 'note' }), text: value }; },
  breakNew(value) {
    if (!S.breakdown) return;
    S.breakdown.newName = value;
    const add = document.querySelector('[data-action="addBreakPart"]');
    if (add) add.disabled = !value.trim();
  },
  customName(value) { S.customDraft = { ...(S.customDraft || {}), name: value }; },
  myName(value) {
    Household.renameMember(S.household, S.user.uid, value);
    clearTimeout(nameTimer);
    nameTimer = setTimeout(flushName, 600);
  },
  partnerName(value) {
    if (!isOrganiser()) return;
    S.household.settings.partnerName = value.slice(0, 40);
    clearTimeout(partnerTimer);
    partnerTimer = setTimeout(flushPartnerName, 600);
  },
};

/* =========================================================
   ROUTER & RENDERING
   ========================================================= */
const $app = document.getElementById('app');
let currentRoute = null;
const hashName = () => location.hash.replace(/^#\/?/, '').split('?')[0];

/** Anything new in a running plan (an added task, a custom task, new parts) is shared out
 *  automatically: both rate it → fair split → both say yes. The organiser's app starts it,
 *  since only the organiser changes the list. A finished re-share clears itself if its tasks
 *  have since been removed. */
function shareNewTasks(navigate = false) {
  const h = S.household;
  if (!h || !S.user || Household.stage(h) !== 'active' || !Household.isOwner(h, S.user.uid)) return false;
  if (h.reshare && !(h.reshare.unitIds || []).some(id => Household.unit(h, id))) { h.reshare = null; save('reshare'); }
  if (h.reshare) return false;
  const ids = Household.newUnits(h).map(u => u.id);
  if (!ids.length) return false;
  Household.startReshare(h, S.user.uid, ids);
  save('reshare');
  if (navigate) go('reshare');
  return true;
}
// Not from the Household tab: tasks added there one after another go into one round once you move on.
const SHARE_FROM = ['today', 'household'];

// Old addresses from before Plan and Household became one Home tab.
const ROUTE_ALIASES = { plan: 'household', inventory: 'household' };
function resolveRoute() {
  const name = ROUTE_ALIASES[hashName()] || hashName();
  if (S.phase === 'setup' || S.phase === 'error' || S.phase === 'loading') return S.phase;
  // A note to read (e.g. "sign in again to delete your account") always comes with the sign-in form.
  if (S.phase === 'signedOut') return name === 'auth' || (S.auth.note && name !== 'welcome') ? 'auth' : 'welcome';
  if (S.joining) return 'joining';
  if (!S.profile || S.householdLoading) return 'loading';
  const h = S.household;
  if (!h) return 'start';

  const me = S.user.uid;
  const organiser = Household.isOwner(h, me);
  const stage = Household.stage(h);

  // The organiser sets up alone. (A partner can't be here yet: invites only exist once the plan does.)
  if (stage === 'setup') return organiser && SETUP_SCREENS.includes(name) ? name : (h.settings.step || 'members');

  // Settings are always there (a paused household shows what can still be done).
  if (name === 'settings') return 'settings';

  // Past the draft, the household needs its subscription. Without it, it's paused on the plans screen.
  // While that isn't known yet (still loading, or a read failed) a neutral screen keeps the address as it is.
  if (stage !== 'draft' && !hasAccess()) { S.lastStage = stage; return !watchers.subLoaded || S.subUnknown ? 'checking' : 'subscribe'; }
  if (name === 'subscribe') return 'subscribe';
  if (name === 'breakdown' && S.breakdown) return 'breakdown';
  if (name === 'reshare' && Household.activeReshare(h)) return 'reshare';

  // The partner's first look: the plan, with their own answers.
  const myTurn = !organiser && stage === 'review' && !Household.prefsComplete(h, me);
  // Once the plan runs: Today (mine) and Home (ours). Before that, Home is the only screen.
  const home = myTurn ? 'review' : stage === 'active' ? 'today' : 'household';
  let allowed = stage === 'active' ? ['today', 'household'] : ['household', 'rate'];
  if (myTurn) allowed = ['review', 'household'];
  if (organiser) allowed = allowed.concat(['members', 'home', 'responsibilities', 'frequency']);
  // When the household moves on to a new stage, everyone goes to that stage's main screen.
  const moved = S.lastStage !== undefined && S.lastStage !== stage;
  S.lastStage = stage;
  if (moved) return home;
  return name === home || allowed.includes(name) ? name : home;
}

function render(routeChanged) {
  const name = resolveRoute();
  const routable = name === 'auth' || name === 'welcome' || name === 'start' || HOUSEHOLD_SCREENS.includes(name);
  if (routable && location.hash !== '#/' + name) history.replaceState(null, '', '#/' + name);
  const changed = routeChanged || name !== currentRoute;
  if (name !== currentRoute) {
    if (name !== 'household') S.suggestMode = false;
    if (name !== 'today') S.dayOffset = 0;
    if (name === 'settings' && ['today', 'household', 'subscribe'].includes(currentRoute)) S.settingsFrom = currentRoute;
    if (!['review', 'rate'].includes(name)) S.prefDraft = null;
  }
  currentRoute = name;
  watchLoading(name);
  // New tasks are shared out when you arrive on Today or Home, so several added in a row go out together.
  if (SHARE_FROM.includes(name) && changed) shareNewTasks();
  if (name === 'subscribe' && isOrganiser() && !hasAccess()) mark('paywall');
  $app.innerHTML = Screens[name]();
  fitButtons($app);
  applyBusy($app);
  animateMeters($app);
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

/* While a finger or mouse is pressing a button, live updates wait: re-drawing the screen
   between press and release would swallow the tap (e.g. a save landing as "Continue" is pressed). */
let pressing = false;
let rerenderWaiting = false;
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('[data-action], button, a')) pressing = true; }, true);
const release = () => setTimeout(() => { pressing = false; if (rerenderWaiting) { rerenderWaiting = false; rerender(); } }, 0);
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);

/** Re-render in place, keeping scroll position, focus, and anything half-typed. */
function rerender() {
  if (pressing) { rerenderWaiting = true; return; }
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

/**
 * Every tap on an action: instant visual feedback (CSS :active + a short "pressed" pulse),
 * repeated taps on the same button within 350 ms ignored, and async actions locked until they finish.
 */
const lastTap = new Map();
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const action = el.dataset.action;
  const fn = Actions[action];
  if (!fn) return;
  e.preventDefault();
  if (Busy.has(action)) return;
  const tapKey = JSON.stringify(el.dataset);
  const now = Date.now();
  if (now - (lastTap.get(tapKey) || 0) < 350) return;
  lastTap.set(tapKey, now);
  el.classList.remove('pressed'); void el.offsetWidth; el.classList.add('pressed');
  let result;
  try { result = fn({ ...el.dataset }, el); }
  catch (err) { console.error(err); toast('Something went wrong. Please try again.'); return; }
  if (result && typeof result.then === 'function') {
    Busy.add(action);
    applyBusy(document);
    result.catch(err => console.error(err)).finally(() => {
      Busy.delete(action);
      document.querySelectorAll(`[data-action="${action}"]`).forEach(b => { b.classList.remove('is-busy'); b.removeAttribute('aria-busy'); b.disabled = false; });
      rerender();
    });
  }
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
document.addEventListener('focusout', e => {
  if (!e.target.matches) return;
  if (e.target.matches('[data-input="myName"]')) flushName();
  if (e.target.matches('[data-input="partnerName"]')) flushPartnerName();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Sheet.isOpen()) Sheet.close();
  if (e.key !== 'Enter' || !e.target.matches) return;
  if (e.target.matches('[data-input="myName"], [data-input="partnerName"]')) e.target.blur();
  if (e.target.matches('[data-input="noteText"]')) { e.preventDefault(); Actions.postNote(); }
  if (e.target.matches('[data-input="customName"]')) { e.preventDefault(); Actions.saveCustomTask(); }
  if (e.target.matches('[data-input="breakNew"]')) { e.preventDefault(); Actions.addBreakPart(); }
});

/* ---------- boot ---------- */
(function boot() {
  try {
    captureParams();
    if (!Backend.sdkLoaded()) {
      S.phase = 'error';
      S.fatal = "Couldn't reach the sign-in service. A content blocker, VPN or DNS filter may be blocking Google's Firebase (gstatic.com, googleapis.com). Allow those sites, or try another network, then reload.";
      render(true);
      return;
    }
    if (!Backend.init()) { S.phase = 'setup'; render(true); return; }
    render(true);
    if (S.checkoutReturn === 'cancel') toast('No worries, nothing was charged.');

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
