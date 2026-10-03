'use strict';

/* =========================================================
   ENTITLEMENTS — single source of truth for Free/Premium
   ---------------------------------------------------------
   Premium belongs to the household's organiser (the person who
   created it). Everyone in the household gets the organiser's
   entitlements, and when that subscription ends everyone drops
   back to Free at the same moment. Data created with Premium is
   kept and comes back when Premium does.

   Two sources can make the organiser Premium, merged by
   Entitlements.effective() into one subscription object:
     - a paid Stripe subscription (customers/{uid}/subscriptions,
       written only by the Stripe extension), status trialing/active
     - a grant from the admin panel (subscriptions/{uid}), for gifts
   UI code never checks plan names directly — only these helpers.
   ========================================================= */
const PLANS = Object.freeze({
  free: Object.freeze({
    detailed_tasks: false, custom_task_limit: 3, suggest_changes: false, time_totals: false, board: false,
  }),
  premium: Object.freeze({
    detailed_tasks: true, custom_task_limit: Infinity, suggest_changes: true, time_totals: true, board: true,
  }),
});

// past_due: a renewal failed and Stripe is retrying — keep Premium meanwhile (and ask to fix the card).
const PAID_STATUSES = Object.freeze(['trialing', 'active', 'past_due']);
// A payment that needs the customer: never offer a new checkout on top of it.
const PROBLEM_STATUSES = Object.freeze(['past_due', 'unpaid', 'incomplete']);
const toMillis = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : null)));

const Entitlements = {
  /**
   * One subscription view from the admin grant and the Stripe subscriptions.
   * @returns {{plan, active, source, status?, interval?, trialEnd?, periodEnd?, cancelAtPeriodEnd?}|null}
   */
  effective(grant, stripeSubs) {
    const paid = (stripeSubs || []).filter(s => PAID_STATUSES.includes(s.status))
      .sort((a, b) => (toMillis(b.created) || 0) - (toMillis(a.created) || 0))[0];
    if (paid) {
      const priceId = paid.price && (paid.price.id || paid.price);
      const billing = APP_CONFIG.billing;
      return {
        plan: 'premium', active: true, source: 'stripe', status: paid.status,
        interval: priceId === billing.prices.yearly ? 'year' : priceId === billing.prices.monthly ? 'month' : null,
        trialEnd: toMillis(paid.trial_end), periodEnd: toMillis(paid.current_period_end),
        cancelAtPeriodEnd: !!paid.cancel_at_period_end,
      };
    }
    if (grant) return { ...grant, source: 'grant' };
    return null;
  },
  /** Has this person ever had a paid subscription (then no second free trial). Unknown counts as yes. */
  hadSubscription: stripeSubs => !Array.isArray(stripeSubs) || stripeSubs.length > 0,
  /** A subscription whose payment needs fixing (card declined, 3-D Secure not finished…). */
  paymentProblem: stripeSubs => (stripeSubs || []).find(s => PROBLEM_STATUSES.includes(s.status)) || null,

  /** @param {object|null} subscription the effective subscription of the organiser */
  of(subscription) {
    const s = subscription;
    if (!s || s.active !== true || !PLANS[s.plan]) return PLANS.free;
    const exp = toMillis(s.expiresAt);
    if (exp && exp < Date.now()) return PLANS.free;
    return PLANS[s.plan];
  },
  isPremium:            sub => Entitlements.of(sub) === PLANS.premium,
  canViewDetailedTasks: sub => Entitlements.of(sub).detailed_tasks,
  canAddCustomTask:     (sub, count) => count < Entitlements.of(sub).custom_task_limit,
  customTaskLimit:      sub => Entitlements.of(sub).custom_task_limit,
  canSuggestChanges:    sub => Entitlements.of(sub).suggest_changes,
  /** Per-person weekly time totals. Per-task times and the household total are free. */
  canSeeTimeTotals:     sub => Entitlements.of(sub).time_totals,
  canUseBoard:          sub => Entitlements.of(sub).board,
};
