'use strict';

/* =========================================================
   HOUSEHOLD DOMAIN LOGIC — pure functions, no DOM, no Firebase
   ---------------------------------------------------------
   The organiser (ownerId, who created the household) sets it up
   alone and gets a plan straight away, split with a placeholder
   for the partner (INVITEE). The partner joins with that plan in
   hand, marks only what doesn't suit them, and both say yes.

   members[]   people in the household, each linked to an account
   memberIds[] the account ids, used by the security rules
   ownerId     the organiser; the subscription follows this account (entitlements.js)
   settings    { step, onboarded, partnerName, baseline, invitedAt }
   responsibilities [{ id, libraryId|null, name, category, minutes, frequency,
               predefined, custom?, parts?[] }] — "tasks" in the app
   suggestions [{ id, by, type: 'add'|'remove'|'breakdown', … }] — the partner
               proposes, the organiser decides
   preferences { [uid]: { values: { [unitId]: 'love'|'rather_not' }, submittedAt } }
               unmarked = 'ok'; never shown to the other person
   plan        { status: 'proposed'|'active', assignments: { [unitId]: uid|INVITEE },
               signature, accepted: { [uid]: at }, rebalancedBy?, createdAt, startedAt }
   swaps       [{ id, from, to, respId, status: 'pending'|'done'|'declined', gave?, at, resolvedAt?, seen? }]
   completions { [unitId]: { last, prev, by } }
   reshare, reshuffle, notes — see their sections below
   ========================================================= */
const LIMITS = { bedroom: [0, 10], bathroom: [0, 6], children: [0, 8] };

/* Running low → which task it belongs to. First match wins; otherwise Household supplies, then Grocery. */
const SUPPLY_ROUTES = [
  { lib: ['pet_care', 'feed_pet'], words: ['dog', ' cat', 'pet', 'litter', 'kibble', 'treats', 'hund', 'katze', 'bird', 'hay '] },
  { lib: ['kids_ready', 'kids_admin'], words: ['nappies', 'nappy', 'diaper', 'baby', 'formula', 'windeln', 'school'] },
  { lib: ['car_care', 'car_service'], words: [' car', 'motor oil', 'engine', 'washer fluid', 'windscreen', 'tyre', 'tire', 'fuel', 'petrol', 'diesel'] },
  { lib: ['garden_tidy', 'water_garden', 'mow'], words: ['garden', 'seeds', 'soil', 'compost', 'fertili', 'hose', 'lawn', 'plant food'] },
  { lib: ['supplies'], words: ['toilet', 'detergent', 'dishwasher', 'soap', 'sponge', 'bin bag', 'bin liner', 'bags', 'cleaner', 'cleaning', 'bleach', 'paper', 'tissue', 'shampoo', 'toothpaste', 'battery', 'batteries', 'bulb', 'foil', 'cling', 'salt for', 'rinse aid', 'softener'] },
  { lib: ['groceries'], words: ['milk', 'bread', 'egg', 'coffee', ' tea', 'butter', 'cheese', 'fruit', 'veg', 'tomato', 'onion', 'potato', 'pasta', 'rice', 'flour', 'sugar', 'salt', 'oil', 'juice', 'water', 'beer', 'wine', 'yog', 'meat', 'chicken', 'fish', 'cereal', 'snack', 'food', 'apple', 'banana', 'sauce', 'spice', 'honey', 'jam', 'oat', 'milch', 'brot', 'eier', 'kaffee', 'käse'] },
];

/** The partner who hasn't joined yet (plan placeholder). Never a real user id (those are 28 chars, no dashes). */
const INVITEE = 'invitee';

const SAFE_ID = /^[\w-]{1,64}$/;
const okId = x => typeof x === 'string' && SAFE_ID.test(x);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const NOTE_KIND_IDS = ['note', 'low', 'today'];

const Household = {
  /**
   * The other member can write parts of the shared document, so never trust its shape:
   * drop entries with odd ids or kinds instead of letting them break a screen.
   * (All values are also escaped when rendered; this is the second line of defence.)
   */
  sanitize(h) {
    const list = (v, ok) => (Array.isArray(v) ? v.filter(x => isObj(x) && ok(x)) : []);
    h.members = list(h.members, m => okId(m.uid));
    h.memberIds = (Array.isArray(h.memberIds) ? h.memberIds : []).filter(okId);
    h.responsibilities = list(h.responsibilities, r => okId(r.id) && typeof r.name === 'string')
      .map(r => (r.parts == null || Array.isArray(r.parts) ? r : { ...r, parts: [] }))
      .map(r => (r.parts ? { ...r, parts: r.parts.filter(p => isObj(p) && okId(p.id)) } : r));
    h.swaps = list(h.swaps, x => okId(x.id));
    h.notes = list(h.notes, n => okId(n.id) && NOTE_KIND_IDS.includes(n.kind) && typeof n.text === 'string');
    h.suggestions = list(h.suggestions, x => okId(x.id) && ['add', 'remove', 'breakdown'].includes(x.type))
      .map(x => (x.parts == null ? x : { ...x, parts: (Array.isArray(x.parts) ? x.parts : []).filter(p => isObj(p) && typeof p.name === 'string') }));
    const ids = v => (Array.isArray(v) ? v.filter(okId) : []);
    const known = new Set(LIBRARY.categories.map(c => c.id));
    h.responsibilities = h.responsibilities.map(r => (known.has(r.category) ? r : { ...r, category: 'organisation' }));
    if (h.plan != null && !isObj(h.plan)) h.plan = null;
    if (h.plan && h.plan.skipped != null) h.plan.skipped = ids(h.plan.skipped);
    if (h.reshare != null && (!isObj(h.reshare) || !okId(h.reshare.id))) h.reshare = null;
    if (h.reshare) h.reshare.unitIds = ids(h.reshare.unitIds);
    if (h.reshuffle != null && !isObj(h.reshuffle)) h.reshuffle = null;
    if (!isObj(h.settings)) h.settings = {};
    if (!isObj(h.preferences)) h.preferences = {};
    return h;
  },

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
      suggestions: [],
      settings: { step: 'members', onboarded: false, partnerName: '', libraryVersion: LIBRARY.version },
    };
  },

  isOwner: (h, userId) => !!h && h.ownerId === userId,
  owner: h => (h.members || []).find(m => m.uid === h.ownerId) || null,
  /** A real member, or the partner who hasn't joined yet (INVITEE). */
  member(h, userId) {
    if (userId === INVITEE) return this.invitee(h);
    return (h.members || []).find(m => m.uid === userId) || null;
  },
  memberName(m) {
    const n = ((m && m.name) || '').trim();
    if (n) return n;
    if (m && m.placeholder) return 'Your partner';
    return m && m.role === 'owner' ? 'Organiser' : 'Partner';
  },
  renameMember(h, userId, name) { const m = this.member(h, userId); if (m && !m.placeholder) m.name = name.slice(0, 40); },

  /* ---------- People in the plan ----------
   * The organiser builds the plan before the partner joins. Until then the partner is a
   * placeholder (INVITEE) with the name the organiser gave; when they join, everything
   * the placeholder had becomes theirs. */
  alone: h => (h.memberIds || []).length < 2,
  partnerId: h => (h.memberIds || []).find(m => m !== h.ownerId) || null,
  invitee: h => ({ uid: INVITEE, name: ((h.settings && h.settings.partnerName) || '').trim(), role: 'member', placeholder: true }),
  /** Everyone the plan is shared between: the members, plus the placeholder while the organiser is alone. */
  people(h) {
    const real = (h.memberIds || []).map(id => (h.members || []).find(m => m.uid === id)).filter(Boolean);
    return this.alone(h) ? [...real, this.invitee(h)] : real;
  },
  peopleIds(h) { return this.people(h).map(m => m.uid); },
  /** Who an assignment really means today (the placeholder ↔ the partner, someone who left → the placeholder). */
  norm(h, id) {
    if (!id) return null;
    if (this.alone(h)) return (h.memberIds || []).includes(id) ? id : INVITEE;
    if (id === INVITEE) return this.partnerId(h);
    return id;
  },

  /**
   * What changes when someone leaves (or deletes their account): their answers, notes and
   * suggestions go; their ticks stay as history without a name; the plan goes back to a draft
   * for whoever stays. When the organiser leaves, the other person becomes the organiser.
   * @returns the household fields to write
   */
  departure(h, userId) {
    const stays = (h.memberIds || []).filter(m => m !== userId);
    const preferences = { ...(h.preferences || {}) };
    delete preferences[userId];
    const completions = Object.fromEntries(Object.entries(h.completions || {})
      .map(([id, c]) => [id, c && c.by === userId ? { ...c, by: null } : c]));
    const out = {
      members: (h.members || []).filter(m => m.uid !== userId),
      memberIds: stays,
      preferences,
      completions,
      notes: (h.notes || []).filter(n => n.by !== userId).map(n => (n.claimedBy === userId ? { ...n, claimedBy: null } : n)),
      suggestions: (h.suggestions || []).filter(x => x.by !== userId),
      swaps: (h.swaps || []).filter(x => x.status !== 'pending' || (x.from !== userId && x.to !== userId)),
      plan: h.plan ? { ...h.plan, status: 'proposed', accepted: {}, rebalancedBy: null } : null,
      reshare: null,
      reshuffle: null,
    };
    if (h.ownerId === userId && stays.length) {
      out.ownerId = stays[0];
      out.members = out.members.map(m => ({ ...m, role: 'owner' }));
      out.settings = { ...h.settings, partnerName: '', invitedAt: null };
    }
    return out;
  },

  /* ---------- Board: notes, running low, today only ---------- *
   * notes [{ id, by, kind: 'note'|'low'|'today', text, createdAt (ms), day ('YYYY-MM-DD'), claimedBy? }]
   *  - note:  stays 7 days, the author can delete it any time
   *  - low:   goes to whoever looks after the related task, until someone has got it
   *  - today: on the board for the day it was written; whoever taps "I'll do it" first
   *           takes it onto their Today list, where it stays until ticked
   * Done items are simply removed. */
  NOTE_DAYS: 7,
  NOTE_MAX_LENGTH: 140,
  notes: h => h.notes || [],
  dayKey(ms = Date.now()) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  noteAlive(n, now = Date.now()) {
    const fresh = now - n.createdAt < this.NOTE_DAYS * 864e5;
    if (n.kind === 'note') return fresh;
    if (n.kind === 'today') return n.claimedBy ? fresh : n.day === this.dayKey(now);
    return true;
  },
  liveNotes(h, now = Date.now()) { return this.notes(h).filter(n => this.noteAlive(n, now)); },
  /** What's on the board: everything alive except "today" tasks someone has taken. */
  boardNotes(h, now = Date.now()) {
    return this.liveNotes(h, now).filter(n => !(n.kind === 'today' && n.claimedBy)).sort((a, b) => b.createdAt - a.createdAt);
  },
  addNote(h, userId, kind, text) {
    const clean = String(text || '').trim().slice(0, this.NOTE_MAX_LENGTH);
    if (!clean || !['note', 'low', 'today'].includes(kind)) return null;
    const n = { id: uid(), by: userId, kind, text: clean, createdAt: Date.now(), day: this.dayKey() };
    h.notes = [...this.liveNotes(h), n];
    return n;
  },
  deleteNote(h, userId, id) {
    const n = this.notes(h).find(x => x.id === id);
    if (!n || n.by !== userId) return false;
    h.notes = this.liveNotes(h).filter(x => x.id !== id);
    return true;
  },
  /** First tap wins: returns false if someone already took it. */
  claimNote(h, userId, id) {
    const n = this.notes(h).find(x => x.id === id);
    if (!n || n.kind !== 'today' || n.claimedBy) return false;
    h.notes = this.liveNotes(h).map(x => x.id === id ? { ...x, claimedBy: userId } : x);
    return true;
  },
  finishNote(h, id) {
    const had = this.notes(h).some(x => x.id === id);
    h.notes = this.liveNotes(h).filter(x => x.id !== id);
    return had;
  },
  /** Running low: which task (and so which person) it belongs to. */
  noteTarget(h, n) {
    const text = ' ' + n.text.toLowerCase() + ' ';
    const route = SUPPLY_ROUTES.find(r => r.words.some(w => text.includes(w))) || null;
    const chain = [...(route ? route.lib : []), 'supplies', 'groceries'];
    for (const lib of chain) {
      const r = h.responsibilities.find(x => x.libraryId === lib);
      if (!r) continue;
      let unit = r;
      if (this.isSplit(r)) {
        const score = p => {
          const name = p.name.toLowerCase();
          let s = name.split(/[^a-z]+/).filter(w => w.length > 3 && text.includes(w)).length;
          if (/^shopping$|buy|other/.test(name)) s += 0.6; else if (/shop|suppl|product/.test(name)) s += 0.4;
          return s;
        };
        const best = this.parts(r).slice().sort((a, b) => score(b) - score(a))[0];
        unit = this.unit(h, best.id) || r;
      }
      const who = this.assignee(h, unit.id);
      if (who && h.memberIds.includes(who)) return { uid: who, unitId: unit.id, via: unit.parentName ? `${unit.parentName} · ${unit.name}` : unit.name };
    }
    return null;
  },
  /** Board items that sit on this person's Today list. */
  myNoteTasks(h, userId) {
    return this.liveNotes(h).filter(n =>
      (n.kind === 'today' && n.claimedBy === userId) ||
      (n.kind === 'low' && (this.noteTarget(h, n) || {}).uid === userId));
  },
  /** Does this board item wait for this person? 'mine' (running low, theirs to get),
   *  'grab' (someone else's, anyone can take it) or null. */
  noteWaiting(h, n, userId) {
    if (n.kind === 'low') {
      const t = this.noteTarget(h, n);
      if (t) return t.uid === userId ? 'mine' : null;
      return n.by !== userId ? 'grab' : null;
    }
    if (n.kind === 'today' && !n.claimedBy) return n.by !== userId ? 'grab' : null;
    return null;
  },
  /** New on the board since this person last looked, written by someone else. */
  unseenNotes(h, userId, seenAt) {
    return this.boardNotes(h).filter(n => n.by !== userId && n.createdAt > (seenAt || 0));
  },

  /* ---------- Suggestions ---------- */

  suggestions: h => h.suggestions || [],
  suggestionFor(h, userId, type, key) {
    return this.suggestions(h).find(x => x.by === userId && x.type === type &&
      (type === 'add' ? x.libraryId === key : x.responsibilityId === key)) || null;
  },
  /** Suggest how to break a task into parts (replaces my earlier suggestion for it). */
  suggestBreakdown(h, userId, respId, parts) {
    const r = h.responsibilities.find(x => x.id === respId); if (!r) return;
    h.suggestions = this.suggestions(h).filter(x => !(x.by === userId && x.type === 'breakdown' && x.responsibilityId === respId));
    h.suggestions.push({ id: uid(), by: userId, type: 'breakdown', responsibilityId: respId, name: r.name, category: r.category,
      parts: parts.map(p => ({ name: String(p.name).slice(0, 60), minutes: Number(p.minutes) || 10, frequency: p.frequency, ...(p.custom ? { custom: true } : {}) })),
      at: new Date().toISOString() });
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
    else if (sug.type === 'breakdown') this.setBreakdown(h, sug.responsibilityId, sug.parts || []);
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

  /* ---------- Where the household is ----------
   * setup  → the organiser is still setting up (home, tasks, times, own answers)
   * draft  → the plan exists; the partner hasn't joined yet
   * review → the partner has joined and is looking at the plan
   * plan   → both have answered; the plan waits for both to say yes
   * active → the plan runs */
  stage(h) {
    if (!h.settings.onboarded) return 'setup';
    if (h.plan && h.plan.status === 'active') return 'active';
    if (this.alone(h)) return 'draft';
    if (h.memberIds.some(m => !this.prefsComplete(h, m))) return 'review';
    return 'plan';
  },

  /* ---------- Preferences (private to each person) ----------
   * Anything not marked counts as 🙂 Don't mind. */
  prefs(h, userId) { return ((h.preferences || {})[userId]) || { values: {} }; },
  setPref(h, userId, respId, value) {
    const mine = this.prefs(h, userId);
    const values = { ...(mine.values || {}) };
    if (value === 'ok') delete values[respId]; else values[respId] = value;
    h.preferences = { ...(h.preferences || {}), [userId]: { ...mine, values } };
  },
  /** How many tasks this person marked as something other than 🙂. */
  marked(h, userId) { return Object.keys(this.prefs(h, userId).values || {}).length; },
  prefsComplete(h, userId) { return !!this.prefs(h, userId).submittedAt; },
  submitPrefs(h, userId) {
    const mine = this.prefs(h, userId);
    h.preferences = { ...(h.preferences || {}), [userId]: { ...mine, submittedAt: new Date().toISOString() } };
  },
  /** How someone feels about a unit: its own answer, else the answer for the whole task. */
  prefFor(h, userId, unit) {
    const v = this.prefs(h, userId).values || {};
    return v[unit.id] || (unit.parentId ? v[unit.parentId] : null) || 'ok';
  },
  /** What the split uses: only answers someone has handed in (the rest is 🙂). */
  planPref(h, userId, unit) { return this.prefsComplete(h, userId) ? this.prefFor(h, userId, unit) : 'ok'; },

  /* ---------- Units: what the plan is made of ----------
   * A unit is a whole task, or for a task broken into parts, each of its parts. */
  parts: r => r.parts || [],
  isSplit(r) { return this.parts(r).length > 0; },
  partUnit(r, p) {
    return { id: p.id, parentId: r.id, parentName: r.name, name: p.name, minutes: p.minutes, frequency: p.frequency,
      category: r.category, libraryId: null, mentalLoad: !!p.mentalLoad, custom: !!p.custom };
  },
  units(h) {
    const out = [];
    h.responsibilities.forEach(r => { if (this.isSplit(r)) this.parts(r).forEach(p => out.push(this.partUnit(r, p))); else out.push(r); });
    return out;
  },
  unit(h, id) { return this.units(h).find(u => u.id === id) || null; },
  parentOf(h, partId) { return h.responsibilities.find(r => this.parts(r).some(p => p.id === partId)) || null; },

  /* ---------- Plan ---------- */
  /** Changes to the list, times, parts, people or preferences make a proposed plan out of date. */
  planSignature(h) {
    const units = this.units(h).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const parts = units.map(u => { const t = Timing.of(u); return `${u.id}:${t.minutes}:${t.frequency}`; });
    const prefs = this.peopleIds(h).slice().sort().map(m => m + '=' + units.map(u => this.planPref(h, m, u)[0]).join(''));
    return parts.join('|') + '#' + prefs.join('|') + '#' + (h.planSeed || 0);
  },
  /** A plan that isn't running yet follows every change to the list, times, parts or answers. */
  needsNewPlan(h) {
    const st = this.stage(h);
    if (st === 'setup' || st === 'active') return false;
    return !h.plan || h.plan.signature !== this.planSignature(h);
  },
  prefMap(h, units) {
    return Object.fromEntries(this.peopleIds(h).map(m => [m, Object.fromEntries(units.map(u => [u.id, this.planPref(h, m, u)]))]));
  },
  /** Work out the split. `by` (who caused it) counts as having said yes; if nothing moved,
   *  earlier yeses stay. */
  buildPlan(h, by = null) {
    const units = this.units(h);
    const ids = this.peopleIds(h);
    const prefs = this.prefMap(h, units);
    let seed = h.planSeed || 0;
    let { assignments } = Split.run(units, ids, prefs, { seed });
    // After a reshuffle, look for a split that's actually different (and still fair).
    const before = h.previousAssignments;
    if (before) {
      const same = a => units.every(u => a[u.id] === before[u.id]);
      for (let tries = 0; tries < 12 && same(assignments); tries++) {
        const next = Split.run(units, ids, prefs, { seed: seed + 1 });
        seed += 1;
        if (Split.isEven(Split.loads(units, next.assignments, ids)) || tries === 11) assignments = next.assignments;
      }
      h.planSeed = seed;
      h.previousAssignments = null;
    }
    const old = h.plan;
    const unchanged = !!old && old.assignments && units.every(u => this.norm(h, old.assignments[u.id]) === assignments[u.id]);
    const accepted = unchanged ? { ...(old.accepted || {}) } : {};
    if (by) accepted[by] = new Date().toISOString();
    h.plan = { status: 'proposed', assignments, signature: this.planSignature(h), accepted, createdAt: new Date().toISOString() };
    if (!unchanged) h.swaps = [];
    h.reshare = null;
  },
  /** Who does a unit (a new part sits with whoever had the whole task until it's shared out). */
  assignee(h, id) { return this.norm(h, this.rawAssignee(h, id)); },
  rawAssignee(h, id) {
    const a = (h.plan && h.plan.assignments) || {};
    if (h.responsibilities.some(x => x.id === id)) return a[id] || null;
    const parent = this.parentOf(h, id);
    return parent ? (a[id] || a[parent.id] || null) : null;
  },
  majority(h, r) {
    const a = (h.plan && h.plan.assignments) || {};
    const load = {};
    this.parts(r).forEach(p => { const m = this.norm(h, a[p.id] || a[r.id]); if (m) load[m] = (load[m] || 0) + Timing.weeklyMinutes(this.partUnit(r, p)); });
    const people = Object.keys(load);
    if (!people.length) return null;
    return people.sort((x, y) => (load[y] - load[x]) || (x === a[r.id] ? -1 : y === a[r.id] ? 1 : (x < y ? -1 : 1)))[0];
  },
  setAssignee(h, id, userId) { h.plan = { ...h.plan, assignments: { ...(h.plan.assignments || {}), [id]: userId } }; },
  tasksOf(h, userId) { return this.units(h).filter(u => this.assignee(h, u.id) === userId); },
  /** Added after the plan started: nobody's yet. */
  unassigned(h) { const ids = this.peopleIds(h); return h.plan ? this.units(h).filter(u => !ids.includes(this.assignee(h, u.id))) : []; },
  claim(h, id, userId) { this.setAssignee(h, id, userId); },
  loads(h) {
    const units = this.units(h);
    return Split.loads(units, Object.fromEntries(units.map(u => [u.id, this.assignee(h, u.id)])), this.peopleIds(h));
  },
  /** The whole household's work, in minutes a week. */
  weeklyTotal(h) { return this.units(h).reduce((t, u) => t + Timing.weeklyMinutes(u), 0); },
  /** Who looks after a whole task: a name, "Shared" when its parts are split between people, or nobody. */
  ownerOf(h, r) {
    if (!this.isSplit(r)) return this.assignee(h, r.id);
    const people = new Set(this.parts(r).map(p => this.assignee(h, p.id)).filter(Boolean));
    return people.size === 1 ? [...people][0] : (people.size ? 'shared' : null);
  },
  hasAccepted(h, userId) { return !!(h.plan && h.plan.accepted && h.plan.accepted[userId]); },
  /** The plan starts once every member (not the placeholder) has said yes. */
  acceptPlan(h, userId) {
    const accepted = { ...(h.plan.accepted || {}), [userId]: new Date().toISOString() };
    const everyone = !this.alone(h) && h.memberIds.every(m => accepted[m]);
    h.plan = { ...h.plan, accepted, ...(everyone ? { status: 'active', startedAt: new Date().toISOString() } : {}) };
  },

  /* ---------- Reshuffle (start the split over) ---------- */
  reshuffle: h => h.reshuffle || null,
  requestReshuffle(h, from) { h.reshuffle = { id: uid(), by: from, status: 'pending', at: new Date().toISOString() }; },
  /** A fresh split that differs from the current one; both say yes again. Ticks are kept. */
  reshufflePlan(h, by) {
    h.planSeed = (h.planSeed || 0) + 1;
    h.previousAssignments = Object.fromEntries(this.units(h).map(u => [u.id, this.assignee(h, u.id)]));
    h.plan = null; h.swaps = []; h.reshare = null;
    this.buildPlan(h, by);
  },
  acceptReshuffle(h, by) {
    this.reshufflePlan(h, by);
    h.reshuffle = { ...h.reshuffle, status: 'done', resolvedAt: new Date().toISOString() };
  },
  declineReshuffle(h) { h.reshuffle = { ...h.reshuffle, status: 'declined', resolvedAt: new Date().toISOString() }; },
  markReshuffleSeen(h) { h.reshuffle = { ...h.reshuffle, seen: true }; },

  /* ---------- Breaking tasks into parts ---------- */
  /** Suggested parts for a task, each with a share of its time and the same rhythm. */
  defaultParts(r) {
    const names = Library.parts(r.libraryId);
    const t = Timing.of(r);
    const each = Math.max(5, Math.round(t.minutes / Math.max(1, names.length) / 5) * 5);
    return names.map(name => ({ name, minutes: each, frequency: t.frequency }));
  },
  /** Set a task's parts. An empty list puts it back together (with whoever had most of it). */
  setBreakdown(h, respId, parts) {
    const r = h.responsibilities.find(x => x.id === respId);
    if (!r) return;
    if (!parts.length) {
      if (h.plan && this.parts(r).length) {
        const keep = this.majority(h, r);
        if (keep) h.plan = { ...h.plan, assignments: { ...(h.plan.assignments || {}), [r.id]: keep } };
      }
      r.parts = [];
      return;
    }
    const byName = new Map(this.parts(r).map(p => [p.name.toLowerCase(), p]));
    r.parts = parts.map(p => {
      const old = byName.get(String(p.name).toLowerCase());
      return { id: old ? old.id : uid(), name: String(p.name).slice(0, 60), minutes: Number(p.minutes) || 10,
        frequency: p.frequency || Timing.of(r).frequency, ...(p.custom ? { custom: true } : {}) };
    });
  },
  /** Parts that haven't been shared out yet (they sit with the task's owner for now). */
  newParts(h) { return this.newUnits(h).filter(u => u.parentId); },
  /** Anything new in a running plan that hasn't been shared out yet: tasks added to the list
   *  (nobody has them) and new parts (still sitting with whoever had the whole
   *  task). Tasks the household chose to leave under "Needs a home" are skipped. */
  newUnits(h) {
    if (!h.plan || h.plan.status !== 'active') return [];
    const a = h.plan.assignments || {};
    const skipped = new Set(h.plan.skipped || []);
    return this.units(h).filter(u => !skipped.has(u.id) &&
      (u.parentId ? !a[u.id] : !h.memberIds.includes(this.assignee(h, u.id))));
  },
  activeReshare: h => h.reshare || null,

  /* ---------- Re-share: rate just some parts, re-divide only those ---------- */
  startReshare(h, by, unitIds) {
    h.reshare = { id: uid(), by, status: 'rating', unitIds, prefs: {}, done: {}, accepted: {}, at: new Date().toISOString() };
  },
  reshareValue(h, userId, unit) {
    const own = ((h.reshare && h.reshare.prefs) || {})[userId] || {};
    return own[unit.id] || this.prefFor(h, userId, unit);
  },
  setResharePref(h, userId, unitId, value) {
    const prefs = { ...(h.reshare.prefs || {}) };
    prefs[userId] = { ...(prefs[userId] || {}), [unitId]: value };
    h.reshare = { ...h.reshare, prefs };
  },
  /** Mark my answers done; when everyone is done, work out the proposal. */
  finishReshare(h, userId) {
    h.reshare = { ...h.reshare, done: { ...(h.reshare.done || {}), [userId]: true } };
    if (!h.memberIds.every(m => h.reshare.done[m])) return;
    const units = this.units(h);
    const ids = new Set(h.reshare.unitIds);
    const fixed = Object.fromEntries(units.filter(u => !ids.has(u.id)).map(u => [u.id, this.assignee(h, u.id)]).filter(([, m]) => m));
    const prefs = Object.fromEntries(h.memberIds.map(m => [m, Object.fromEntries(units.map(u => [u.id, this.reshareValue(h, m, u)]))]));
    // First try moving only the new parts. If that can't keep things even (say a new part takes
    // much longer than usual), let the fewest other tasks move too.
    let { assignments, loads } = Split.run(units, h.memberIds, prefs, { fixed, seed: h.planSeed || 0 });
    let moved = [];
    if (!Split.isEven(loads)) {
      const soft = Split.run(units, h.memberIds, prefs, { start: fixed, seed: h.planSeed || 0 });
      const softMoved = Object.keys(fixed).filter(id => soft.assignments[id] !== fixed[id]);
      if (Split.isEven(soft.loads) || this.gap(soft.loads) < this.gap(loads)) { assignments = soft.assignments; loads = soft.loads; moved = softMoved; }
    }
    const proposal = Object.fromEntries([...h.reshare.unitIds, ...moved].filter(id => assignments[id]).map(id => [id, assignments[id]]));
    h.reshare = { ...h.reshare, status: 'proposed', proposal, moved, loads, accepted: {} };
  },
  gap(loads) { const v = Object.values(loads); return v.length ? Math.max(...v) - Math.min(...v) : 0; },
  /** Everyone said yes → apply. */
  acceptReshare(h, userId) {
    h.reshare = { ...h.reshare, accepted: { ...(h.reshare.accepted || {}), [userId]: true } };
    if (!h.memberIds.every(m => h.reshare.accepted[m])) return false;
    Object.entries(h.reshare.proposal || {}).forEach(([id, m]) => this.setAssignee(h, id, m));
    h.reshare = null;
    return true;
  },
  /** Keep things as they are: the parts stay with whoever has them now. */
  declineReshare(h) {
    const homeless = [];
    (h.reshare.unitIds || []).forEach(id => {
      const m = this.assignee(h, id);
      if (m && h.memberIds.includes(m)) this.setAssignee(h, id, m); else homeless.push(id);
    });
    // New tasks nobody has stay under "Needs a home" without being offered again.
    if (homeless.length) h.plan = { ...h.plan, skipped: [...new Set([...(h.plan.skipped || []), ...homeless])] };
    h.reshare = null;
  },

  /* ---------- Swaps ---------- */
  swaps: h => h.swaps || [],
  requestSwap(h, from, to, respId) {
    if (this.swaps(h).some(x => x.status === 'pending' && x.respId === respId)) return null;
    const swap = { id: uid(), from, to, respId, status: 'pending', at: new Date().toISOString() };
    h.swaps = [...this.swaps(h), swap];
    return swap;
  },
  /** Only swaps about tasks that still exist in the current view. */
  incomingSwap(h, userId) { return this.swaps(h).find(x => x.status === 'pending' && x.to === userId && this.unit(h, x.respId)) || null; },
  pendingFor(h, respId) { return this.swaps(h).find(x => x.status === 'pending' && x.respId === respId) || null; },
  /** Accept: the task moves to them, and the task they pick moves back. */
  acceptSwap(h, swapId, giveRespId) {
    const x = this.swaps(h).find(s => s.id === swapId);
    if (!x || x.status !== 'pending') return;
    this.setAssignee(h, x.respId, x.to);
    if (giveRespId) this.setAssignee(h, giveRespId, x.from);
    h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, status: 'done', gave: giveRespId || null, resolvedAt: new Date().toISOString() } : s);
  },
  declineSwap(h, swapId) {
    h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, status: 'declined', resolvedAt: new Date().toISOString() } : s);
  },
  /** Results the person who asked hasn't seen yet. */
  swapResults(h, userId) { return this.swaps(h).filter(x => x.from === userId && x.status !== 'pending' && !x.seen); },
  markSwapSeen(h, swapId) { h.swaps = this.swaps(h).map(s => s.id === swapId ? { ...s, seen: true } : s); },
  unitName(h, id) { const u = this.unit(h, id) || h.responsibilities.find(r => r.id === id); return u ? u.name : 'a task'; },

  /* ---------- Schedule ---------- */
  /** Spread each person's first round evenly over the period (weekly over 7 days, monthly over 30). */
  firstOffset(h, r) {
    const freq = Timing.of(r).frequency;
    const f = Timing.frequency(freq);
    const period = Schedule.periodDays(f);
    if (period <= 1) return 0;
    const owner = this.assignee(h, r.id);
    const same = this.units(h)
      .filter(x => this.assignee(h, x.id) === owner && Timing.of(x).frequency === freq)
      .map(x => x.id).sort();
    const i = same.indexOf(r.id);
    return i < 0 ? 0 : Math.floor(i * period / same.length);
  },
  dueDate(h, r) {
    return Schedule.nextDue(r, this.completion(h, r.id), h.plan && h.plan.startedAt, this.firstOffset(h, r));
  },
  /** Is a scheduled unit due on `day`? Anything overdue counts as due today. */
  dueOn(h, r, day, today = new Date()) {
    const f = Timing.frequency(Timing.of(r).frequency);
    let d = this.dueDate(h, r);
    if (!d) return false;
    const target = Schedule.day(day).getTime();
    const start = Schedule.day(today);
    if (d < start) d = start;
    for (let i = 0; i < 400 && d.getTime() < target; i++) d = Schedule.advance(d, f);
    return d.getTime() === target;
  },
  /**
   * Today's progress for some people, by time: minutes of the scheduled work due today (or overdue)
   * that is ticked, out of all of it. Work ticked today counts as done.
   * @returns {{ done: number, total: number, left: number, pct: number }} minutes; left = tasks still open
   */
  dayProgress(h, userIds, now = new Date()) {
    const today = Schedule.day(now);
    let done = 0, open = 0, left = 0;
    this.units(h).forEach(u => {
      if (!userIds.includes(this.assignee(h, u.id)) || !Timing.isScheduled(u)) return;
      const minutes = Timing.of(u).minutes;
      if (Schedule.doneOn(this.completion(h, u.id), now)) done += minutes;
      else if (this.dueDate(h, u) <= today) { open += minutes; left += 1; }
    });
    const total = done + open;
    return { done, total, left, pct: total ? Math.round(done / total * 100) : 0 };
  },

  /* ---------- Ticking things off ---------- */
  /** A part starts from when its whole task was last done. */
  completion(h, id) {
    const all = h.completions || {};
    const own = all[id] || null;
    const parent = this.parentOf(h, id);
    return parent ? own || all[parent.id] || null : own;
  },
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
      mentalLoad: !!lib.mentalLoad,
      minutes: Timing.defaultsFor(lib.id).minutes,
      frequency: Timing.defaultsFor(lib.id).frequency,
      createdAt: new Date().toISOString(),
    });
  },
  /** A task of your own (not from the list). */
  addCustom(h, { name, category, minutes, frequency }) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) return null;
    const cat = LIBRARY.categories.some(c => c.id === category) ? category : 'organisation';
    const r = {
      id: uid(), libraryId: null, category: cat, name: clean, description: '', predefined: false, custom: true,
      mentalLoad: false, minutes: MINUTE_OPTIONS.includes(Number(minutes)) ? Number(minutes) : 15,
      frequency: FREQUENCIES.some(f => f.id === frequency) ? frequency : 'weekly', createdAt: new Date().toISOString(),
    };
    h.responsibilities.push(r);
    return r;
  },
  customCount: h => h.responsibilities.filter(r => !r.predefined).length,
  removeTask(h, id) {
    const before = h.responsibilities.length;
    h.responsibilities = h.responsibilities.filter(r => r.id !== id);
    return h.responsibilities.length !== before;
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
