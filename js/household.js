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
      tasks: [], // filled in later phases (Premium breakdowns / scheduling)
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
