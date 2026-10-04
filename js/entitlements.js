'use strict';

/* =========================================================
   ENTITLEMENTS — does this household have a subscription?
   ---------------------------------------------------------
   Setting up and seeing the draft plan is free. Inviting the
   partner and using the plan together needs a subscription.
   There is no Free tier: with a subscription everything is on.

   The subscription belongs to the household's organiser and
   covers both people. When it ends, the household is paused:
   nothing is deleted, and it all comes back on restart.

   Two sources, merged by Entitlements.effective():
     - a paid Stripe subscription (customers/{uid}/subscriptions,
       written only by the Stripe extension)
     - a grant from the admin panel (subscriptions/{uid}), for gifts
   ========================================================= */

// past_due: a renewal failed and Stripe is retrying — keep access meanwhile (and ask to fix the card).
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

  /** Is the subscription on right now? */
  active(sub) {
    if (!sub || sub.active !== true || sub.plan !== 'premium') return false;
    const exp = toMillis(sub.expiresAt);
    return !(exp && exp < Date.now());
  },

  /** Has this person ever had a paid subscription (then no second free trial). Unknown counts as yes. */
  hadSubscription: stripeSubs => !Array.isArray(stripeSubs) || stripeSubs.length > 0,
  /** A subscription whose payment needs fixing (card declined, 3-D Secure not finished…). */
  paymentProblem: stripeSubs => (stripeSubs || []).find(s => PROBLEM_STATUSES.includes(s.status)) || null,
};
