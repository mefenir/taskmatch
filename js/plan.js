'use strict';

/* =========================================================
   PLAN LOGIC — pure functions, no DOM, no Firebase
   - Split:    shares responsibilities out by weekly effort,
               keeping clear preference oppositions
   - Schedule: recurring due dates for Today / Week / Month
   - Messages: light-hearted swap copy
   ========================================================= */
const PREFERENCES = Object.freeze([
  { id: 'love',       icon: 'love', label: 'Happy to do it', score: 2 },
  { id: 'ok',         icon: 'ok',   label: "Don't mind",     score: 1 },
  { id: 'rather_not', icon: 'notKeen', label: 'Would rather not', score: 0 },
]);
const PREF_SCORE = Object.freeze({ love: 2, ok: 1, rather_not: 0 });

const Split = {
  /**
   * @param responsibilities household responsibilities (with minutes/frequency)
   * @param memberIds        people to share between
   * @param prefs            { [uid]: { [responsibilityId]: 'love'|'ok'|'rather_not' } }
   * @param options.fixed     { [id]: uid } items that stay where they are (re-sharing only some)
   * @param options.start     { [id]: uid } where items start; unlike fixed they may still move to even things out
   * @param options.seed      a reshuffle uses a new seed, so the plan can come out differently
   * @returns { assignments: { [responsibilityId]: uid }, loads: { [uid]: minutesPerWeek } }
   * Deterministic: the same input always gives the same plan on every phone.
   */
  run(responsibilities, memberIds, prefs, options = {}) {
    const fixed = options.fixed || {};
    const start = options.start || {};
    const seed = options.seed || 0;
    const jitter = id => { if (!seed) return 1; let h = seed * 2654435761 >>> 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 1 + ((h % 1000) / 1000 - 0.5) * 0.4; };
    // The caller's order is the tie-break (organiser first), so a placeholder being replaced by the
    // real partner gives exactly the same plan. Every phone passes the same order.
    const people = memberIds.slice();
    const score = (m, r) => { const v = (prefs[m] || {})[r.id]; return v in PREF_SCORE ? PREF_SCORE[v] : 1; };
    const items = responsibilities
      .map(r => ({ r, w: Timing.weeklyMinutes(r), order: Timing.weeklyMinutes(r) * jitter(r.id) }))
      .sort((a, b) => (b.order - a.order) || (a.r.id < b.r.id ? -1 : 1));

    const load = Object.fromEntries(people.map(m => [m, 0]));
    const assignments = {};
    const locked = new Set();
    const give = (it, m) => { assignments[it.r.id] = m; load[m] += it.w; };

    // Who may take it: when someone loves it and someone would rather not, only the lovers.
    const candidates = it => {
      const s = people.map(m => score(m, it.r));
      return s.includes(2) && s.includes(0) ? people.filter((m, i) => s[i] === 2) : people;
    };
    // Cost of giving a task to someone: their load afterwards, minus a nudge for liking it.
    const cost = (it, m) => load[m] + it.w - score(m, it.r) * 0.3 * it.w;
    const best = (it, list) => list.reduce((a, m) => (cost(it, m) < cost(it, a) ? m : a), list[0]);

    // 0. Items that stay where they are.
    for (const it of items) {
      const m = fixed[it.r.id];
      if (m && m in load) { give(it, m); locked.add(it.r.id); }
    }
    // 0b. Items that start with someone but may still move (only as far as needed).
    for (const it of items) {
      const m = start[it.r.id];
      if (!(it.r.id in assignments) && m && m in load) give(it, m);
    }
    // 1. Clear oppositions first: they always go to the person who loves them.
    for (const it of items) {
      if (it.r.id in assignments) continue;
      const c = candidates(it);
      if (c.length < people.length) { give(it, best(it, c)); if (c.length === 1) locked.add(it.r.id); }
    }
    // 2. Everything else, heaviest first, to whoever it suits best.
    for (const it of items) if (!(it.r.id in assignments)) give(it, best(it, people));

    // 3. Even it out with small moves and trades, without going love → rather not.
    const acceptable = (r, from, to) => score(to, r) >= score(from, r) - 1;
    const mine = m => items.filter(it => assignments[it.r.id] === m && !locked.has(it.r.id));
    for (let round = 0; round < 200; round++) {
      const sorted = people.slice().sort((a, b) => load[b] - load[a] || (a < b ? -1 : 1));
      const hi = sorted[0], lo = sorted[sorted.length - 1];
      const gap = load[hi] - load[lo];
      if (gap <= 0) break;
      let bestMove = null;
      for (const a of mine(hi)) {
        // move a: hi → lo
        if (acceptable(a.r, hi, lo)) {
          const g = Math.abs(gap - 2 * a.w);
          if (g < gap - 0.01 && (!bestMove || g < bestMove.g)) bestMove = { g, a };
        }
        // trade a (hi → lo) for b (lo → hi)
        for (const b of mine(lo)) {
          if (!acceptable(a.r, hi, lo) || !acceptable(b.r, lo, hi)) continue;
          const g = Math.abs(gap - 2 * (a.w - b.w));
          if (g < gap - 0.01 && (!bestMove || g < bestMove.g)) bestMove = { g, a, b };
        }
      }
      if (!bestMove) break;
      assignments[bestMove.a.r.id] = lo; load[hi] -= bestMove.a.w; load[lo] += bestMove.a.w;
      if (bestMove.b) { assignments[bestMove.b.r.id] = hi; load[lo] -= bestMove.b.w; load[hi] += bestMove.b.w; }
    }
    return { assignments, loads: load };
  },

  loads(responsibilities, assignments, memberIds) {
    const load = Object.fromEntries(memberIds.map(m => [m, 0]));
    responsibilities.forEach(r => { const m = assignments[r.id]; if (m in load) load[m] += Timing.weeklyMinutes(r); });
    return load;
  },

  /** "Evenly split" when nobody is more than 15% above the average. */
  isEven(loads) {
    const v = Object.values(loads);
    if (!v.length) return true;
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    return avg === 0 || (Math.max(...v) - Math.min(...v)) <= avg * 0.15 + 5;
  },
};

const Schedule = {
  day(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; },
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  advance(d, f) {
    const x = new Date(d);
    if (f.everyDays) x.setDate(x.getDate() + f.everyDays);
    else if (f.everyMonths) x.setMonth(x.getMonth() + f.everyMonths);
    return x;
  },
  /** Next due day of a scheduled responsibility, or null when it's "as needed".
   *  firstOffsetDays spreads the very first round so not everything is due on day one. */
  nextDue(r, completion, startedAt, firstOffsetDays = 0) {
    const f = Timing.frequency(Timing.of(r).frequency);
    if (!f.everyDays && !f.everyMonths) return null;
    if (completion && completion.last) return this.day(this.advance(this.day(completion.last), f));
    return this.addDays(this.day(startedAt || Date.now()), firstOffsetDays);
  },
  periodDays(f) { return f.everyDays || (f.everyMonths ? 30 * f.everyMonths : 0); },
  /** Weeks start on Monday. Weekday index: 0 = Monday … 6 = Sunday. */
  weekdayIndex: d => (new Date(d).getDay() + 6) % 7,
  mondayOf(d) { const x = this.day(d); return this.addDays(x, -this.weekdayIndex(x)); },
  weeksBetween(a, b) { return Math.round((this.mondayOf(b) - this.mondayOf(a)) / (7 * 864e5)); },
  /** 'YYYY-MM-DD' for a local day, and back (null when it isn't a real date). */
  key(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; },
  fromKey(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
  },
  WEEKDAYS: Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  doneOn(completion, day) {
    return !!(completion && completion.last && this.day(completion.last).getTime() === this.day(day).getTime());
  },
  weekday: d => d.toLocaleDateString(undefined, { weekday: 'short' }),
  shortDate: d => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
  relative(d, today) {
    const days = Math.round((this.day(d) - this.day(today)) / 864e5);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days < 0) return `${-days} days ago`;
    return days < 7 ? this.weekday(d) : this.shortDate(d);
  },
};

/* Swap copy — picked per swap (stable for that swap), with the plain outcome shown underneath. */
const SwapMessages = Object.freeze({
  request: [
    '<b>Hot potato!</b> {name} is tossing you {task}.',
    '{task} is looking for a new home. {name} hopes it\'s yours.',
    '{name} says {task} just isn\'t their love language.',
    'Psst. {name} wants to trade away {task}. Make them pay for it.',
    'Incoming! {name} is trying to pass you {task}.',
    '{name} would like to renegotiate. Subject: {task}.',
    '{name} has had enough of {task}. Fancy it, for a price?',
  ],
  price: [
    'Your turn: what does {name} get in return?',
    'Name your price. 😈',
    'Choose wisely… or wickedly.',
    'Every deal has a price. Pick theirs.',
  ],
  declined: [
    'Nice try. {task} stays with you.',
    'Swap denied. {task} has grown attached to you.',
    '{name} politely declined. {task} sends its regards.',
    'No deal! Maybe it\'s a sign.',
    '{name} passed. {task} isn\'t going anywhere.',
    'Request bounced. Better luck next time, champ.',
    'Hard pass from {name}. You and {task}: still a team.',
  ],
  done: [
    'Deal done! {task} is now {name}\'s. You got {other} in return.',
    'Pleasure doing business. You traded {task} for {other}.',
    'Swapped! Was it worth it? Only {other} will tell.',
  ],
  /** Fill a message. Values are escaped; task names are emphasised. */
  pick(kind, seed, vars) {
    const list = this[kind];
    let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return list[h % list.length]
      .replace(/\{name\}/g, esc(vars.name || ''))
      .replace(/\{task\}/g, `<em>${esc(vars.task || '')}</em>`)
      .replace(/\{other\}/g, `<em>${esc(vars.other || '')}</em>`);
  },
});
