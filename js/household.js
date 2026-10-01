'use strict';

/* =========================================================
   HOUSEHOLD DOMAIN LOGIC — pure functions, no DOM, no Firebase
   ---------------------------------------------------------
   Responsibility ≠ assignment: a selected responsibility has
   no owner, frequency or preference. Those arrive in later
   phases and live on tasks.

   members[]   people in the household, each linked to an account
   memberIds[] the account ids, used by the security rules
   ownerId     the account that created the household; Premium
               follows this account (see entitlements.js)
   agreements  { [uid]: { at, signature } } — a member agreeing to the
               owner's list; it goes stale when the list changes
   suggestions [{ id, by, type: 'add'|'remove', libraryId?, responsibilityId?,
               name, category, at }] — Premium: members propose edits,
               the owner accepts or declines
   preferences { [uid]: { values: { [respId]: 'love'|'ok'|'rather_not' }, submittedAt } }
               never shown to the other person
   plan        { status: 'proposed'|'active', assignments: { [respId]: uid },
               signature, accepted: { [uid]: at }, createdAt, startedAt }
   swaps       [{ id, from, to, respId, status: 'pending'|'done'|'declined',
               gave?, at, resolvedAt?, seen? }]
   completions { [respId]: { last, prev, by } }
   ========================================================= */
const LIMITS = { bedroom: [0, 10], bathroom: [0, 6], children: [0, 8] };

const Household = {
  /** Data for a new household document (id is assigned by the backend). */
  create({ ownerId, ownerName }) {
    return {
      ownerId,
      memberIds: [ownerId],
      members: [{ uid: ownerId, name: (ownerName || '').slice(0, 40), role: 'owner', joinedAt: new Date().toISOString() }],
      rooms: [
        { type: 'bedroom', count: 1 },
        { type: 'bathroom', count: 1 },
        { type: 'kitchen', count: 1 },
        { type: 'living', count: 1 },
        { type: 'office', count: 0 },
      ],
      children: [],
      pets: [],
      circumstances: { garden: false, car: false },
      responsibilities: [],
      agreements: {},
      suggestions: [],
      settings: { step: 'members', onboarded: false, libraryVersion: LIBRARY.version },
    };
  },

  isOwner: (h, userId) => !!h && h.ownerId === userId,
  owner: h => (h.members || []).find(m => m.uid === h.ownerId) || null,
  member: (h, userId) => (h.members || []).find(m => m.uid === userId) || null,
  memberName(m) {
    const n = ((m && m.name) || '').trim();
    return n || (m && m.role === 'owner' ? 'Household owner' : 'Household member');
  },
  renameMember(h, userId, name) { const m = this.member(h, userId); if (m) m.name = name.slice(0, 40); },

  /* ---------- Agreement (members confirm the owner's list) ---------- */

  /** Fingerprint of the current list; an agreement only counts for the list it was given on. */
  signature(h) { return h.responsibilities.map(r => r.id).sort().join(','); },
  agreementState(h, userId) {
    if (this.isOwner(h, userId)) return 'owner';
    const a = (h.agreements || {})[userId];
    if (!a) return 'pending';
    return a.signature === this.signature(h) ? 'agreed' : 'changed';
  },
  agree(h, userId) {
    h.agreements = { ...(h.agreements || {}), [userId]: { at: new Date().toISOString(), signature: this.signature(h) } };
  },

  /* ---------- Suggestions (Premium) ---------- */

  suggestions: h => h.suggestions || [],
  suggestionFor(h, userId, type, key) {
    return this.suggestions(h).find(x => x.by === userId && x.type === type &&
      (type === 'add' ? x.libraryId === key : x.responsibilityId === key)) || null;
  },
  /** Add the suggestion, or withdraw it if this person already made it. */
  toggleSuggestion(h, userId, type, key) {
    const existing = this.suggestionFor(h, userId, type, key);
    if (existing) { h.suggestions = this.suggestions(h).filter(x => x.id !== existing.id); return; }
    let name, category;
    if (type === 'add') {
      const lib = Library.get(key); if (!lib) return;
      name = lib.name; category = lib.category;
    } else {
      const r = h.responsibilities.find(x => x.id === key); if (!r) return;
      name = r.name; category = r.category;
    }
    h.suggestions = [...this.suggestions(h), {
      id: uid(), by: userId, type, name, category, at: new Date().toISOString(),
      ...(type === 'add' ? { libraryId: key } : { responsibilityId: key }),
    }];
  },
  acceptSuggestion(h, id) {
    const sug = this.suggestions(h).find(x => x.id === id);
    if (!sug) return;
    if (sug.type === 'add') this.select(h, sug.libraryId);
    else h.responsibilities = h.responsibilities.filter(r => r.id !== sug.responsibilityId);
    h.suggestions = this.suggestions(h).filter(x => x.id !== id);
  },
  declineSuggestion(h, id) { h.suggestions = this.suggestions(h).filter(x => x.id !== id); },
  /** Drop suggestions that no longer make sense (already added / already removed). */
  tidySuggestions(h) {
    const selected = this.selectedLibraryIds(h);
    const ids = new Set(h.responsibilities.map(r => r.id));
    const before = this.suggestions(h).length;
    h.suggestions = this.suggestions(h).filter(x => x.type === 'add' ? !selected.has(x.libraryId) : ids.has(x.responsibilityId));
    return h.suggestions.length !== before;
  },

  /* ---------- Times & frequency ---------- */
  setTiming(h, respId, changes) {
    const r = h.responsibilities.find(x => x.id === respId);
    if (!r) return;
    const t = Timing.of(r);
    r.minutes = changes.minutes != null ? Number(changes.minutes) : t.minutes;
    r.frequency = changes.frequency || t.frequency;
  },

  /* ---------- Where the household is ---------- */
  /**
   * setup → (alone) → agreeing → preferences → plan → active
   * 'plan' means a proposed plan both still have to say yes to.
   */
  stage(h) {
    if (!h.settings.onboarded) return 'setup';
    if ((h.memberIds || []).length < 2) return 'alone';
    // Once the plan runs, later list changes don't stop daily use: new tasks just need a home.
    if (h.plan && h.plan.status === 'active') return 'active';
    if (h.memberIds.some(m => this.agreementState(h, m) === 'pending' || this.agreementState(h, m) === 'changed')) return 'agreeing';
    if (h.memberIds.some(m => !this.prefsComplete(h, m))) return 'preferences';
    return 'plan';
  },

  /* ---------- Preferences (private to each person) ---------- */
  prefs(h, userId) { return ((h.preferences || {})[userId]) || { values: {} }; },
  setPref(h, userId, respId, value) {
    const mine = this.prefs(h, userId);
    h.preferences = { ...(h.preferences || {}), [userId]: { ...mine, values: { ...(mine.values || {}), [respId]: value } } };
  },
  allRated(h, userId) { const v = this.prefs(h, userId).values || {}; return h.responsibilities.every(r => v[r.id]); },
  prefsComplete(h, userId) { return !!this.prefs(h, userId).submittedAt && this.allRated(h, userId); },
  submitPrefs(h, userId) {
    const mine = this.prefs(h, userId);
    h.preferences = { ...(h.preferences || {}), [userId]: { ...mine, submittedAt: new Date().toISOString() } };
  },

  /* ---------- Plan ---------- */
  /** Changes to the list, times, people or preferences make a proposed plan out of date. */
  planSignature(h) {
    const parts = h.responsibilities.slice().sort((a, b) => (a.id < b.id ? -1 : 1))
      .map(r => { const t = Timing.of(r); return `${r.id}:${t.minutes}:${t.frequency}`; });
    const prefs = h.memberIds.slice().sort().map(m => {
      const v = this.prefs(h, m).values || {};
      return m + '=' + h.responsibilities.map(r => r.id).sort().map(id => v[id] || '-').join('');
    });
    return parts.join('|') + '#' + prefs.join('|');
  },
  needsNewPlan(h) {
    return this.stage(h) === 'plan' && (!h.plan || h.plan.status !== 'proposed' || h.plan.signature !== this.planSignature(h));
  },
  buildPlan(h) {
    const prefs = Object.fromEntries(h.memberIds.map(m => [m, this.prefs(h, m).values || {}]));
    const { assignments } = Split.run(h.responsibilities, h.memberIds, prefs);
    h.plan = { status: 'proposed', assignments, signature: this.planSignature(h), accepted: {}, createdAt: new Date().toISOString() };
    h.swaps = [];
  },
  assignee(h, respId) { return h.plan && h.plan.assignments ? h.plan.assignments[respId] || null : null; },
  tasksOf(h, userId) { return h.responsibilities.filter(r => this.assignee(h, r.id) === userId); },
  /** Added after the plan started: nobody's yet. */
  unassigned(h) { return h.plan ? h.responsibilities.filter(r => !this.assignee(h, r.id) || !h.memberIds.includes(this.assignee(h, r.id))) : []; },
  claim(h, respId, userId) { h.plan = { ...h.plan, assignments: { ...h.plan.assignments, [respId]: userId } }; },
  loads(h) { return Split.loads(h.responsibilities, (h.plan && h.plan.assignments) || {}, h.memberIds); },
  hasAccepted(h, userId) { return !!(h.plan && h.plan.accepted && h.plan.accepted[userId]); },
  acceptPlan(h, userId) {
    const accepted = { ...(h.plan.accepted || {}), [userId]: new Date().toISOString() };
    const everyone = h.memberIds.every(m => accepted[m]);
    h.plan = { ...h.plan, accepted, ...(everyone ? { status: 'active', startedAt: new Date().toISOString() } : {}) };
  },

  /* ---------- Swaps ---------- */
  swaps: h => h.swaps || [],
  requestSwap(h, from, to, respId) {
    if (this.swaps(h).some(x => x.status === 'pending' && x.respId === respId)) return null;
    const swap = { id: uid(), from, to, respId, status: 'pending', at: new Date().toISOString() };
    h.swaps = [...this.swaps(h), swap];
    return swap;
  },
  incomingSwap(h, userId) { return this.swaps(h).find(x => x.status === 'pending' && x.to === userId) || null; },
  pendingFor(h, respId) { return this.swaps(h).find(x => x.status === 'pending' && x.respId === respId) || null; },
  /** Accept: the task moves to them, and the task they pick moves back. */
  acceptSwap(h, swapId, giveRespId) {
    const x = this.swaps(h).find(s => s.id === swapId);
    if (!x || x.status !== 'pending') return;
    const a = { ...h.plan.assignments, [x.respId]: x.to };
    if (giveRespId) a[giveRespId] = x.from;
    h.plan = { ...h.plan, assignments: a };
    h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, status: 'done', gave: giveRespId || null, resolvedAt: new Date().toISOString() } : s);
  },
  declineSwap(h, swapId) {
    h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, status: 'declined', resolvedAt: new Date().toISOString() } : s);
  },
  /** Results the person who asked hasn't seen yet. */
  swapResults(h, userId) { return this.swaps(h).filter(x => x.from === userId && x.status !== 'pending' && !x.seen); },
  markSwapSeen(h, swapId) { h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, seen: true } : s); },

  /* ---------- Schedule ---------- */
  /** Spread each person's first round evenly over the period (weekly over 7 days, monthly over 30). */
  firstOffset(h, r) {
    const freq = Timing.of(r).frequency;
    const f = Timing.frequency(freq);
    const period = Schedule.periodDays(f);
    if (period <= 1) return 0;
    const owner = this.assignee(h, r.id);
    const same = h.responsibilities
      .filter(x => this.assignee(h, x.id) === owner && Timing.of(x).frequency === freq)
      .map(x => x.id).sort();
    const i = same.indexOf(r.id);
    return i < 0 ? 0 : Math.floor(i * period / same.length);
  },
  dueDate(h, r) {
    return Schedule.nextDue(r, this.completion(h, r.id), h.plan && h.plan.startedAt, this.firstOffset(h, r));
  },

  /* ---------- Ticking things off ---------- */
  completion: (h, respId) => (h.completions || {})[respId] || null,
  toggleDone(h, respId, userId, now = new Date()) {
    const c = this.completion(h, respId);
    const all = { ...(h.completions || {}) };
    if (c && Schedule.doneOn(c, now)) all[respId] = { last: c.prev || null, prev: null, by: userId };   // undo today's tick
    else all[respId] = { last: now.toISOString(), prev: c ? c.last : null, by: userId };
    h.completions = all;
  },

  setRoom(h, type, count) {
    const r = h.rooms.find(x => x.type === type);
    if (r) r.count = count; else h.rooms.push({ type, count });
  },
  setChildren(h, n) {
    while (h.children.length < n) h.children.push({ id: uid() });
    h.children.length = n;
  },
  togglePet(h, type) {
    const i = h.pets.findIndex(p => p.type === type);
    if (i >= 0) h.pets.splice(i, 1); else h.pets.push({ id: uid(), type });
  },

  selectedLibraryIds(h) { return new Set(h.responsibilities.filter(r => r.predefined).map(r => r.libraryId)); },
  select(h, libId) {
    if (this.selectedLibraryIds(h).has(libId)) return;
    const lib = Library.get(libId);
    if (!lib) return;
    h.responsibilities.push({
      id: uid(),
      libraryId: lib.id,
      category: lib.category,
      name: lib.name,
      description: '',
      predefined: true,
      premium: false,
      mentalLoad: !!lib.mentalLoad,
      minutes: Timing.defaultsFor(lib.id).minutes,
      frequency: Timing.defaultsFor(lib.id).frequency,
      tasks: [], // Premium later: detailed tasks, each with its own effort and owner
      createdAt: new Date().toISOString(),
    });
  },
  deselect(h, libId) { h.responsibilities = h.responsibilities.filter(r => !(r.predefined && r.libraryId === libId)); },
  toggle(h, libId) { this.selectedLibraryIds(h).has(libId) ? this.deselect(h, libId) : this.select(h, libId); },

  /** Remove predefined responsibilities that no longer apply (e.g. pets removed). Custom ones are kept. Returns true if anything changed. */
  prune(h) {
    const ids = new Set(Library.relevant(h).map(r => r.id));
    const before = h.responsibilities.length;
    h.responsibilities = h.responsibilities.filter(r => !r.predefined || ids.has(r.libraryId));
    return h.responsibilities.length !== before;
  },

  /** Relevant library items grouped by category, for the selection screen. */
  discoveryGroups(h) {
    const relevant = Library.relevant(h);
    return LIBRARY.categories
      .map(c => ({ category: c, items: relevant.filter(r => r.category === c.id) }))
      .filter(g => g.items.length);
  },

  /** The household's own responsibility map, grouped by category. */
  inventory(h) {
    const groups = new Map();
    h.responsibilities.forEach(r => { if (!groups.has(r.category)) groups.set(r.category, []); groups.get(r.category).push(r); });
    return [...groups.entries()]
      .sort((a, b) => Library.categoryOrder(a[0]) - Library.categoryOrder(b[0]))
      .map(([cat, items]) => ({
        category: Library.category(cat),
        items: items.slice().sort((a, b) => Library.order(a.libraryId) - Library.order(b.libraryId)),
      }));
  },
};
