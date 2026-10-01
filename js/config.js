'use strict';

/* =========================================================
   CONFIG
   The Firebase web config is not a secret: access to data is
   controlled by firestore.rules. Replace the placeholders with
   the values from Firebase console → Project settings →
   General → Your apps → Web app.
   ========================================================= */
const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const APP_CONFIG = Object.freeze({
  inviteValidDays: 14,
  minPasswordLength: 6,
});
