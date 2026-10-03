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

  /* Premium billing through Stripe (Firebase extension "Run Payments with Stripe").
     Paste the two price IDs from the Stripe dashboard (Products → Premium → prices).
     While they are empty the Premium page shows "I'm interested" instead of a checkout.
     The amounts below are only what the app SHOWS: keep them identical to Stripe. */
  billing: Object.freeze({
    prices: Object.freeze({
      monthly: '',          // e.g. 'price_1Q…' — €4.99 per month
      yearly: '',           // e.g. 'price_1Q…' — €39.99 per year
    }),
    display: Object.freeze({ currency: 'EUR', locale: 'en-IE', monthly: 4.99, yearly: 39.99 }),
    trialDays: 21,          // free trial, yearly plan only (must match firestore.rules)
    functionsRegion: 'us-central1', // the region you installed the extension in
    customersCollection: 'customers',
  }),

  /* Legal pages (legal.html) read these. Fill them in before charging anyone. */
  legal: Object.freeze({
    operator: '',           // your full name or company
    address: '',            // street, postcode, city, country
    email: '',              // contact email
    vatId: '',              // optional
  }),
});
