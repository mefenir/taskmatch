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
     invites/{code}         { householdId, createdBy, createdAt, expiresAt, usedBy, usedAt }
     subscriptions/{uid}    { plan: 'free'|'premium', active, expiresAt? }   ← server-only writes
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

    watchHousehold: (hid, onData, onError) =>
      households().doc(hid).onSnapshot(s => onData(s.exists ? { id: s.id, ...s.data() } : null), onError),

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

    async createInvite(hid, userId) {
      const code = randomCode(16);
      const expires = new Date(Date.now() + APP_CONFIG.inviteValidDays * 864e5);
      await invites().doc(code).set({
        householdId: hid,
        createdBy: userId,
        createdAt: now(),
        expiresAt: firebase.firestore.Timestamp.fromDate(expires),
        usedBy: null,
        usedAt: null,
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

  return { init, isConfigured, sdkLoaded, Auth, Repo };
})();
