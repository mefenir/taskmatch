'use strict';

/* =========================================================
   BACKEND — Firebase Auth + Firestore
   ---------------------------------------------------------
   The only file that talks to Firebase. Everything else uses
   Backend.Auth / Backend.Repo, so the storage layer can be
   swapped without touching UI or domain logic.

   Firestore layout
     users/{uid}            { email, displayName, householdId, createdAt }
     households/{hid}       { ownerId, memberIds[], members[], rooms[], children[],
                              pets[], circumstances, responsibilities[], settings }
     invites/{code}         { householdId, createdBy, createdAt, expiresAt, usedBy, usedAt, forName }
     subscriptions/{uid}    { plan: 'free'|'premium', active, expiresAt? }   ← Premium granted from the admin panel
     customers/{uid}        ← Stripe extension: checkout_sessions (created here), subscriptions (synced by Stripe)
     paidPremium/{uid}      { plan, active, expiresAt }   ← "has paid until", for the security rules
     metrics/{hid}          { created, listed, rated, invited, joined, reviewed, started, checkout, activeDays[] }
     premiumRequests/{uid}  { uid, email, name, householdId, members, status, requestedAt, decidedAt? }
                            status: pending → approved | denied; approved → revoked | cancelled; denied/revoked/cancelled → pending
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
      // Pop-ups don't work in an installed iOS web app; use a full-page redirect there.
      const redirect = () => { SafeStorage.set(REDIRECT_KEY, '1'); return auth.signInWithRedirect(provider); };
      if (isStandalone()) return redirect();
      try {
        return await auth.signInWithPopup(provider);
      } catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
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
    signOut: () => auth.signOut(),
  };

  /* ---------- Data ---------- */
  const Repo = {
    async ensureUser(user, nameHint) {
      const ref = users().doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          email: user.email || '',
          displayName: user.displayName || nameHint || '',
          householdId: null,
          createdAt: now(),
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

    /** Premium status of the household owner. Missing or unreadable → treated as Free. */
    watchSubscription: (ownerId, onData) =>
      subscriptions().doc(ownerId).onSnapshot(s => onData(s.exists ? s.data() : null), () => onData(null)),

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

    /** A non-owner leaves. The household and everyone else's data stay. */
    async leaveHousehold(h, userId) {
      const batch = db.batch();
      batch.update(households().doc(h.id), {
        memberIds: firebase.firestore.FieldValue.arrayRemove(userId),
        members: (h.members || []).filter(m => m.uid !== userId),
        updatedAt: now(),
      });
      batch.update(users().doc(userId), { householdId: null });
      await batch.commit();
    },

    /** Owner deletes the household for everyone. */
    async deleteHousehold(hid, userId) {
      const batch = db.batch();
      batch.delete(households().doc(hid));
      batch.update(users().doc(userId), { householdId: null });
      await batch.commit();
    },
  };

  /* ---------- Premium interest ("I'm interested") ---------- */
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

  /** The owner ends their own Premium. The household drops back to Free straight away. */
  Repo.cancelPremium = async userId => {
    await subscriptions().doc(userId).update({ active: false, cancelledAt: now() });
    // Premium may have been switched on by hand without a request; then there's nothing to update.
    await premiumRequests().doc(userId).update({ status: 'cancelled', cancelledAt: now() }).catch(() => {});
  };

  /* ---------- Funnel metrics (no personal data: step times per household) ---------- */
  const METRIC_STEPS = ['created', 'listed', 'rated', 'invited', 'joined', 'reviewed', 'started', 'checkout'];
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
        success_url: `${back}?checkout=success#/premium`,
        cancel_url: `${back}?checkout=cancel#/premium`,
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
    /**
     * Copy "has paid until …" to paidPremium/{uid} so the security rules can check the partner's
     * Premium writes. Allowed only while the sign-in token carries stripeRole == 'premium'.
     */
    async mirror(userId, untilMs) {
      const ref = db.collection('paidPremium').doc(userId);
      if (!untilMs) return ref.set({ active: false, syncedAt: now() }, { merge: true });
      await auth.currentUser.getIdToken(true);
      return ref.set({ plan: 'premium', active: true, expiresAt: firebase.firestore.Timestamp.fromMillis(untilMs), syncedAt: now() });
    },
    /** Stripe customer portal: change plan, update card, cancel. */
    async portalUrl() {
      const fn = firebase.app().functions(APP_CONFIG.billing.functionsRegion)
        .httpsCallable('ext-firestore-stripe-payments-createPortalLink');
      const { data } = await fn({ returnUrl: `${location.origin}${location.pathname}#/premium`, locale: 'auto' });
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
    deny: (userId, adminId) => premiumRequests().doc(userId).update({ status: 'denied', decidedAt: now(), decidedBy: adminId }),
    watchMetrics: (onData, onError) =>
      db.collection('metrics').onSnapshot(q => onData(q.docs.map(d => ({ id: d.id, ...d.data() }))), onError),
    async revoke(userId, adminId) {
      const batch = db.batch();
      batch.set(subscriptions().doc(userId), { active: false, revokedAt: now(), revokedBy: adminId }, { merge: true });
      batch.update(premiumRequests().doc(userId), { status: 'revoked', decidedAt: now(), decidedBy: adminId });
      await batch.commit();
    },
  };

  return { init, isConfigured, sdkLoaded, Auth, Repo, Admin, Billing, Metrics };
})();
