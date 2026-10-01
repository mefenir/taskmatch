'use strict';

/* =========================================================
   ENTITLEMENTS — single source of truth for Free/Premium
   ---------------------------------------------------------
   Premium belongs to a PERSON, not to the household: it is the
   subscription of the household's owner (the user who created
   it). Every member gets the owner's entitlements, and when the
   owner's subscription ends, everyone drops back to Free at the
   same moment. Data created with Premium is kept, it just
   becomes read-only until Premium is active again.

   The subscription document (subscriptions/{ownerUid}) can only
   be written by the server / Firebase console, never by the app.
   UI code never checks `plan === 'premium'` directly.
   ========================================================= */
const PLANS = Object.freeze({
  free:    Object.freeze({ detailed_tasks: false, custom_tasks: false, custom_responsibilities: false, suggest_changes: false, time_totals: false }),
  premium: Object.freeze({ detailed_tasks: true,  custom_tasks: true,  custom_responsibilities: true,  suggest_changes: true,  time_totals: true  }),
});

const Entitlements = {
  /** @param {object|null} subscription the household owner's subscription doc */
  of(subscription) {
    const s = subscription;
    if (!s || s.active !== true || !PLANS[s.plan]) return PLANS.free;
    if (s.expiresAt && typeof s.expiresAt.toMillis === 'function' && s.expiresAt.toMillis() < Date.now()) return PLANS.free;
    return PLANS[s.plan];
  },
  isPremium:                     sub => Entitlements.of(sub) === PLANS.premium,
  canViewDetailedTasks:          sub => Entitlements.of(sub).detailed_tasks,
  canCreateCustomTask:           sub => Entitlements.of(sub).custom_tasks,
  canCreateCustomResponsibility: sub => Entitlements.of(sub).custom_responsibilities,
  canSuggestChanges:             sub => Entitlements.of(sub).suggest_changes,
  /** Per-person weekly time totals on the plan. Per-task times are free. */
  canSeeTimeTotals:              sub => Entitlements.of(sub).time_totals,
};
