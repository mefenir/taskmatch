'use strict';

/* =========================================================
   CONFIG
   The Firebase web config is not a secret: access to data is
   controlled by firestore.rules. Replace the placeholders with
   the values from Firebase console → Project settings →
   General → Your apps → Web app.
   ========================================================= */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnldFi_1IBvI7nzcV5gGt3L58Gm9bEgag",
  authDomain: "taskmatch-c51d2.firebaseapp.com",
  projectId: "taskmatch-c51d2",
  storageBucket: "taskmatch-c51d2.firebasestorage.app",
  messagingSenderId: "665804476761",
  appId: "1:665804476761:web:1e1f89038cffe049003c48",
  measurementId: "G-RRZR3BCK58"
};
const APP_CONFIG = Object.freeze({
  inviteValidDays: 14,
  minPasswordLength: 6,
});
