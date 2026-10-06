'use strict';

/* =========================================================
   BACKEND — Firebase Auth + Firestore
   ---------------------------------------------------------
   The only file that talks to Firebase. Everything else uses
   Backend.Auth / Backend.Repo, so the storage layer can be
   swapped without touching UI or domain logic.

   Firestore layout
     users/{uid}            { email, displayName, householdId, createdAt, inviteCodes[] }
     households/{hid}       { ownerId, memberIds[], members[], rooms[], children[],
                              pets[], circumstances, responsibilities[], settings }
     invites/{code}         { householdId, createdBy, createdAt, expiresAt, usedBy, usedAt, forName }
     subscriptions/{uid}    { plan: 'premium', active, expiresAt? }   ← access granted from the admin panel
     customers/{uid}        ← Stripe extension: checkout_sessions (created here), subscriptions (synced by Stripe)
     metrics/{hid}          { <step>: time, activeDays[] } — see METRIC_STEPS
     premiumRequests/{uid}  { uid, email, name, householdId, members, status, requestedAt, decidedAt? }
                            status: pending → approved | denied; approved → revoked; denied/revoked → pending
     feedback/{id}          { uid, name, householdId, text, screen, version, at, status: 'new'|'done' }
     errors/{id}            { uid, name, message, stack, where, screen, version, ua, at }
     admins/{uid}           { role: 'admin' }   ← created by hand in the Firebase console
   ========================================================= */
const Backend = (() => {
  const REDIRECT_KEY = 'household-app/google-redirect';
  let auth = null;
  let db = null;

  const isConfigured = () =>
    typeof firebase !== 'undefined' &&
    typeof FIREBASE_CONFIG !== 'undefined' && !!FIREBASE_CONFIG.apiKey &&
    !String(FIREBASE_CONFIG.apiKey).startsWith('REPLACE');

  const sdkLoaded = () => typeof firebase !== 'undefined' && typeof firebase.firestore === 'function';

  function init() {
    if (!isConfigured()) return false;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    // Offline cache so the app opens instantly and queues writes without a connection.
    db.enablePersistence({ synchronizeTabs: true }).catch(() => { /* unsupported browser or another tab owns it */ });
    return true;
  }

  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  const users = () => db.collection('users');
  const households = () => db.collection('households');
  const invites = () => db.collection('invites');
  const subscriptions = () => db.collection('subscriptions');
  const premiumRequests = () => db.collection('premiumRequests');
  const feedback = () => db.collection('feedback');
  const errorReports = () => db.collection('errors');

  /* ---------- Auth ---------- */
  const Auth = {
    onChange: cb => auth.onAuthStateChanged(cb),
    current: () => auth.currentUser,

    async signUp(name, email, password) {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (name) await cred.user.updateProfile({ displayName: name });
      cred.user.sendEmailVerification().catch(() => {});
      return cred.user;
    },
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),

    async google() {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Redirect sign-in loses its result in an installed iOS web app (Safari walls off storage between
      // github.io and firebaseapp.com), so try the pop-up first everywhere and keep the redirect as a fallback.
      const redirect = () => { SafeStorage.set(REDIRECT_KEY, '1'); return auth.signInWithRedirect(provider); };
      try {
        return await auth.signInWithPopup(provider);
      } catch (e) {
        const c = e && e.code;
        if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported') {
          return redirect();
        }
        throw e;
      }
    },
    /** Only check for a returning Google redirect when one was started; the check can stall otherwise. */
    redirectResult() {
      if (!SafeStorage.get(REDIRECT_KEY)) return Promise.resolve(null);
      SafeStorage.remove(REDIRECT_KEY);
      return auth.getRedirectResult();
    },
    resetPassword: email => auth.sendPasswordResetEmail(email),
    /** Signed in with an email and password (not only Google)? Only then can the password be changed. */
    usesPassword: () => !!(auth.currentUser && auth.currentUser.providerData.some(p => p && p.providerId === 'password')),
    /** Change the password: confirm the current one first (Firebase needs a recent sign-in). */
    async changePassword(current, next) {
      const u = auth.currentUser;
      if (!u || !u.email) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' });
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, current));
      await u.updatePassword(next);
    },
    signOut: () => auth.signOut(),
    /** Firebase only allows deleting an account shortly after signing in. */
    signedInRecently: () => {
      const u = auth.currentUser;
      const at = u && u.metadata && Date.parse(u.metadata.lastSignInTime);
      return !!at && Date.now() - at < 4 * 60 * 1000;
    },
  };

  /* ---------- Data ---------- */
  const Repo = {
    async ensureUser(user, nameHint, viaInvite) {
      const ref = users().doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          email: user.email || '',
          displayName: user.displayName || nameHint || '',
          householdId: null,
          createdAt: now(),
          ...(viaInvite ? { viaInvite: true } : {}),
        });
      }
    },
    watchUser: (userId, onData, onError) =>
      users().doc(userId).onSnapshot(s => onData(s.exists ? s.data() : null), onError),
    setHouseholdRef: (userId, householdId) => users().doc(userId).update({ householdId }),

    /** onData(household|null, { fromCache }) — "missing" from the local cache isn't final. */
    watchHousehold: (hid, onData, onError) =>
      households().doc(hid).onSnapshot({ includeMetadataChanges: false },
        s => onData(s.exists ? { id: s.id, ...s.data() } : null, { fromCache: s.metadata.fromCache }),
        onError),

    /** Access granted to the household's organiser from the admin panel. Missing → null; unreadable → onError. */
    watchSubscription: (ownerId, onData, onError) =>
      subscriptions().doc(ownerId).onSnapshot(s => onData(s.exists ? s.data() : null), onError),

    async createHousehold(userId, data) {
      const ref = households().doc();
      const batch = db.batch();
      batch.set(ref, { ...data, createdAt: now(), updatedAt: now() });
      batch.update(users().doc(userId), { householdId: ref.id });
      await batch.commit();
      return ref.id;
    },

    /** Write selected top-level fields of the household. */
    saveHousehold(hid, fields) {
      return households().doc(hid).update({ ...fields, updatedAt: now() });
    },

    async createInvite(hid, userId, forName = '') {
      const code = randomCode(16);
      const expires = new Date(Date.now() + APP_CONFIG.inviteValidDays * 864e5);
      await invites().doc(code).set({
        householdId: hid,
        createdBy: userId,
        createdAt: now(),
        expiresAt: firebase.firestore.Timestamp.fromDate(expires),
        usedBy: null,
        usedAt: null,
        forName: String(forName || '').slice(0, 40),
      });
      // Remembered on the profile, so deleting the account can remove these too.
      await users().doc(userId).update({ inviteCodes: firebase.firestore.FieldValue.arrayUnion(code) }).catch(() => {});
      return code;
    },

    /**
     * Join the household behind an invite code. Done in one batch so the
     * security rules can check the invite and the household change together.
     * Throws Error with .code: invite/not-found | invite/used | invite/expired
     */
    async redeemInvite(code, user, name) {
      const inviteSnap = await invites().doc(code).get();
      if (!inviteSnap.exists) throw Object.assign(new Error('Invite not found'), { code: 'invite/not-found' });
      const invite = inviteSnap.data();
      if (invite.usedBy && invite.usedBy !== user.uid) throw Object.assign(new Error('Invite used'), { code: 'invite/used' });
      if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) throw Object.assign(new Error('Invite expired'), { code: 'invite/expired' });

      const FieldValue = firebase.firestore.FieldValue;
      const batch = db.batch();
      batch.update(invites().doc(code), { usedBy: user.uid, usedAt: now() });
      batch.update(households().doc(invite.householdId), {
        memberIds: FieldValue.arrayUnion(user.uid),
        members: FieldValue.arrayUnion({ uid: user.uid, name: (name || '').slice(0, 40), role: 'member', joinedAt: new Date().toISOString() }),
        joinInvite: code,
        updatedAt: now(),
      });
      batch.update(users().doc(user.uid), { householdId: invite.householdId });
      await batch.commit();
      return invite.householdId;
    },

    /** Someone leaves; `fields` (Household.departure) also removes their answers and notes and,
     *  when the organiser leaves, makes the other person the organiser. */
    async leaveHousehold(h, userId, fields) {
      const batch = db.batch();
      batch.update(households().doc(h.id), { ...fields, updatedAt: now() });
      batch.update(users().doc(userId), { householdId: null });
      await batch.commit();
      await Repo.forgetInvites(userId);
    },
    /** Delete the invites I created (an old link must never bring anyone back in). */
    async forgetInvites(userId) {
      const profile = await users().doc(userId).get().catch(() => null);
      const codes = (profile && profile.exists && profile.data().inviteCodes) || [];
      await Promise.all(codes.map(code => invites().doc(code).delete().catch(() => {})));
      if (codes.length) await users().doc(userId).update({ inviteCodes: [] }).catch(() => {});
    },

    /** Owner deletes the household for everyone. */
    async deleteHousehold(hid, userId) {
      const batch = db.batch();
      batch.delete(households().doc(hid));
      batch.update(users().doc(userId), { householdId: null });
      await batch.commit();
    },
  };

  /**
   * Delete everything stored about a person (after they've left or deleted their household):
   * the invites they made, their access request, their profile, then the sign-in itself.
   * Stripe keeps payment records that tax law requires; the extension removes the rest.
   */
  Repo.deleteAccount = async user => {
    await Repo.forgetInvites(user.uid);
    await premiumRequests().doc(user.uid).delete().catch(() => {});
    await Repo.forgetReports(user.uid).catch(() => {});
    await users().doc(user.uid).delete();
    await auth.currentUser.delete();
  };

  /* ---------- Feedback and crash reports (read in the admin panel) ---------- */
  Repo.sendFeedback = (user, info) => feedback().add({
    uid: user.uid,
    name: String(info.name || '').slice(0, 60),
    householdId: info.householdId || null,
    text: String(info.text || '').trim().slice(0, 1000),
    screen: String(info.screen || '').slice(0, 40),
    version: String(info.version || '').slice(0, 20),
    at: now(),
    status: 'new',
  });
  Repo.reportError = (user, entry) => errorReports().add({
    uid: user.uid,
    name: String(user.displayName || '').slice(0, 60),
    message: entry.message, stack: entry.stack, where: entry.where, screen: entry.screen, version: entry.version, ua: entry.ua,
    at: now(),
  });
  /** Someone deleting their account: their feedback and crash reports go too. */
  Repo.forgetReports = async userId => {
    for (const col of [feedback(), errorReports()]) {
      const q = await col.where('uid', '==', userId).get();
      await Promise.all(q.docs.map(d => d.ref.delete()));
    }
  };

  /* ---------- Requesting access while payments aren't set up ---------- */
  Repo.watchPremiumRequest = (userId, onData) =>
    premiumRequests().doc(userId).onSnapshot(s => onData(s.exists ? s.data() : null), () => onData(null));
  Repo.requestPremium = (user, info) => premiumRequests().doc(user.uid).set({
    uid: user.uid,
    email: user.email || '',
    name: (info.name || '').slice(0, 60),
    householdId: info.householdId || null,
    members: info.members || 1,
    status: 'pending',
    requestedAt: now(),
  });

  /** Beta switch: when on, a new request is approved on the spot. Returns true if this request got access. */
  Repo.autoApprove = async user => {
    const cfg = await db.collection('config').doc('beta').get();
    if (!cfg.exists || cfg.data().autoApprove !== true) return false;
    const batch = db.batch();
    batch.set(subscriptions().doc(user.uid), { plan: 'premium', active: true, grantedAt: now(), grantedBy: 'auto', auto: true });
    batch.update(premiumRequests().doc(user.uid), { status: 'approved', decidedAt: now(), decidedBy: 'auto' });
    await batch.commit();
    return true;
  };

  /* ---------- Funnel metrics (no personal data: step times per household) ---------- */
  const METRIC_STEPS = ['created', 'homeDone', 'listed', 'timesDone', 'rated', 'paywall', 'checkout', 'subscribed', 'invited', 'joined', 'reviewed', 'started'];
  const Metrics = {
    STEPS: METRIC_STEPS,
    mark(hid, step) {
      if (!METRIC_STEPS.includes(step)) return Promise.resolve();
      return db.collection('metrics').doc(hid).set({ [step]: now() }, { merge: true });
    },
    activeDay(hid, day) {
      return db.collection('metrics').doc(hid).set({ activeDays: firebase.firestore.FieldValue.arrayUnion(day) }, { merge: true });
    },
  };

  /* ---------- Billing (Stripe through the Firebase extension) ---------- */
  const Billing = {
    enabled: () => !!(APP_CONFIG.billing.prices.monthly && APP_CONFIG.billing.prices.yearly),
    customers: () => db.collection(APP_CONFIG.billing.customersCollection),
    /** The organiser's Stripe subscriptions (any status). Unreadable → null ("unknown", never "none"). */
    watchSubscriptions(userId, onData) {
      return Billing.customers().doc(userId).collection('subscriptions').onSnapshot(
        q => onData(q.docs.map(d => {
          const x = d.data();
          return { id: d.id, status: x.status, price: x.price ? { id: x.price.id } : null, created: x.created,
            trial_end: x.trial_end, current_period_end: x.current_period_end, cancel_at_period_end: x.cancel_at_period_end };
        })),
        () => onData(null));
    },
    /**
     * Create a Checkout Session and resolve with its URL. The extension fills in `url` (or `error`).
     * One call = one session; the caller makes sure it isn't called twice.
     */
    startCheckout(userId, plan, { trial }) {
      const cfg = APP_CONFIG.billing;
      const price = cfg.prices[plan];
      if (!price) return Promise.reject(Object.assign(new Error('Billing is not set up'), { code: 'billing/not-configured' }));
      const back = `${location.origin}${location.pathname}`;
      const session = {
        price,
        success_url: `${back}?checkout=success#/subscribe`,
        cancel_url: `${back}?checkout=cancel#/subscribe`,
        allow_promotion_codes: true,
        client_reference_id: userId,
        metadata: { uid: userId, plan },
        locale: 'auto',
        // Stripe's shortest allowed lifetime: an abandoned checkout page can't be paid later.
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      };
      if (trial && plan === 'yearly') session.trial_period_days = cfg.trialDays;
      return Billing.customers().doc(userId).collection('checkout_sessions').add(session).then(ref => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { off(); reject(Object.assign(new Error('Checkout timed out'), { code: 'billing/timeout' })); }, 30000);
        const off = ref.onSnapshot(snap => {
          const d = snap.data() || {};
          if (d.error) { clearTimeout(timer); off(); reject(Object.assign(new Error(d.error.message || 'Checkout failed'), { code: 'billing/error' })); }
          else if (d.url) { clearTimeout(timer); off(); resolve(d.url); }
        }, err => { clearTimeout(timer); reject(err); });
      }));
    },
    /** Does this person have a subscription of their own that will renew? true / false / null (couldn't check). */
    async ownSubscriptionRunning(userId) {
      if (!Billing.enabled()) return false;
      try {
        const q = await Billing.customers().doc(userId).collection('subscriptions').get();
        return q.docs.some(d => { const x = d.data(); return ['trialing', 'active', 'past_due'].includes(x.status) && !x.cancel_at_period_end; });
      } catch (e) { return null; }
    },
    /** Stripe customer portal: change plan, update card, cancel. */
    async portalUrl() {
      const fn = firebase.app().functions(APP_CONFIG.billing.functionsRegion)
        .httpsCallable('ext-firestore-stripe-payments-createPortalLink');
      const { data } = await fn({ returnUrl: `${location.origin}${location.pathname}#/subscribe`, locale: 'auto' });
      return data.url;
    },
  };

  /* ---------- Admin panel ---------- */
  const Admin = {
    isAdmin: async userId => (await db.collection('admins').doc(userId).get()).exists,
    watchRequests: (onData, onError) =>
      premiumRequests().orderBy('requestedAt', 'desc').onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, ...d.data() }))), onError),
    async unlock(userId, adminId) {
      const batch = db.batch();
      batch.set(subscriptions().doc(userId), { plan: 'premium', active: true, grantedAt: now(), grantedBy: adminId }, { merge: true });
      batch.update(premiumRequests().doc(userId), { status: 'approved', decidedAt: now(), decidedBy: adminId });
      await batch.commit();
    },
    watchConfig: (onData, onError) =>
      db.collection('config').doc('beta').onSnapshot(s => onData(s.exists ? s.data() : {}), onError),
    setAutoApprove: (on, adminId) =>
      db.collection('config').doc('beta').set({ autoApprove: !!on, changedAt: now(), changedBy: adminId }),
    deny: (userId, adminId) => premiumRequests().doc(userId).update({ status: 'denied', decidedAt: now(), decidedBy: adminId }),
    /** Everyone's name, email and household, to see who reached each funnel step. */
    watchUsers: (onData, onError) =>
      users().onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, email: d.data().email || '', name: d.data().displayName || '', householdId: d.data().householdId || null, viaInvite: !!d.data().viaInvite, createdAt: d.data().createdAt && d.data().createdAt.toMillis ? d.data().createdAt.toMillis() : 0 }))), onError),
    watchMetrics: (onData, onError) =>
      db.collection('metrics').onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, ...d.data() }))), onError),
    watchFeedback: (onData, onError) =>
      feedback().orderBy('at', 'desc').limit(300).onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, ...d.data() }))), onError),
    markFeedback: (id, status) => feedback().doc(id).update({ status }),
    watchErrors: (onData, onError) =>
      errorReports().orderBy('at', 'desc').limit(500).onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, ...d.data() }))), onError),
    async clearErrors(ids) {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = db.batch();
        ids.slice(i, i + 400).forEach(id => batch.delete(errorReports().doc(id)));
        await batch.commit();
      }
    },
    async revoke(userId, adminId) {
      const batch = db.batch();
      batch.set(subscriptions().doc(userId), { active: false, revokedAt: now(), revokedBy: adminId }, { merge: true });
      batch.update(premiumRequests().doc(userId), { status: 'revoked', decidedAt: now(), decidedBy: adminId });
      await batch.commit();
    },
  };

  return { init, isConfigured, sdkLoaded, Auth, Repo, Admin, Billing, Metrics };
})();
