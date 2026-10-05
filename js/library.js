'use strict';

/* =========================================================
   PREDEFINED RESPONSIBILITY LIBRARY  (read-only, versioned)
   Kept separate from household data. Households store a
   reference (libraryId) plus a copy of the display name.
   `when(household)` decides whether an item is relevant.
   `tasks` = the usual parts of a task, offered when it's
   broken into parts.
   ========================================================= */
const roomCount = (h, type) => (h.rooms.find(r => r.type === type) || {}).count || 0;

const When = {
  always: () => true,
  room:   type => h => roomCount(h, type) > 0,
  kids:   h => h.children.length > 0,
  pets:   h => h.pets.length > 0,
  pet:    type => h => h.pets.some(p => p.type === type),
  flag:   key => h => !!h.circumstances[key],
};

const R = (category, id, name, when = When.always, extra = {}) => Object.freeze({ id, category, name, when, ...extra });

const LIBRARY = Object.freeze({
  version: 1,
  categories: Object.freeze([
    { id: 'cleaning',     name: 'Cleaning' },
    { id: 'kitchen',      name: 'Kitchen & dishes' },
    { id: 'laundry',      name: 'Laundry' },
    { id: 'food',         name: 'Food' },
    { id: 'waste',        name: 'Waste & recycling' },
    { id: 'supplies',     name: 'Household supplies' },
    { id: 'maintenance',  name: 'Maintenance' },
    { id: 'organisation', name: 'Organisation & mental load' },
    { id: 'children',     name: 'Children' },
    { id: 'pets',         name: 'Pets' },
    { id: 'garden',       name: 'Garden & outdoors' },
    { id: 'car',          name: 'Car' },
  ]),
  responsibilities: Object.freeze([
    // Each task bundles its usual parts; breaking it down turns them into
    // separate tasks with their own timing and owner. `tasks` lists those parts.
    // Cleaning
    R('cleaning', 'clean_bathroom', 'Clean bathroom', When.room('bathroom'), { perRoom: 'bathroom', tasks: ['Clean toilet', 'Clean sink', 'Clean shower & bath', 'Clean mirror', 'Clean floor', 'Fresh towels', 'Refill toilet paper & soap'] }),
    R('cleaning', 'clean_floors', 'Clean floors', When.always, { tasks: ['Vacuum', 'Mop'] }),
    R('cleaning', 'tidying', 'General tidying', When.always, { tasks: ['Tidy up', 'Dusting', 'Change bed linen'] }),
    R('cleaning', 'clean_windows', 'Clean windows', When.always, { tasks: ['Clean windows', 'Wipe frames & sills'] }),
    R('cleaning', 'tidy_office', 'Tidy home office', When.room('office'), { tasks: ['Clear the desk', 'Sort papers'] }),
    // Kitchen & dishes
    R('kitchen', 'dishes', 'Dishes', When.room('kitchen'), { tasks: ['Load dishwasher', 'Unload dishwasher', 'Wash up by hand'] }),
    R('kitchen', 'clean_kitchen', 'Clean kitchen', When.room('kitchen'), { tasks: ['Wipe surfaces', 'Clean sink', 'Clean appliances'] }),
    // Laundry
    R('laundry', 'laundry', 'Laundry', When.always, { tasks: ['Wash clothes', 'Dry & hang up', 'Fold', 'Put away', 'Wash towels'] }),
    // Food
    R('food', 'groceries', 'Grocery', When.always, { mentalLoad: true, tasks: [
      { name: 'Meal planning', mentalLoad: true }, { name: "Check what's missing", mentalLoad: true },
      { name: 'Make the shopping list', mentalLoad: true }, { name: 'Shopping' }, { name: 'Put groceries away' } ] }),
    R('food', 'cooking', 'Cooking', When.always, { tasks: ['Prepare ingredients', 'Cook', 'Pack lunches', 'Store leftovers'] }),
    // Waste
    R('waste', 'rubbish', 'Take rubbish out', When.always, { tasks: ['Take the bins out', 'Bring bins back in', 'Replace bin bags'] }),
    R('waste', 'recycling', 'Recycling', When.always, { tasks: ['Paper', 'Glass', 'Bottles & deposit', 'Packaging'] }),
    // Supplies
    R('supplies', 'supplies', 'Household supplies', When.always, { mentalLoad: true, tasks: ['Cleaning products', 'Toilet paper', 'Laundry detergent', 'Other household supplies'] }),
    // Maintenance
    R('maintenance', 'small_repairs', 'Small repairs & DIY', When.always, { tasks: ['Light bulbs', 'Furniture assembly', 'Small fixes'] }),
    R('maintenance', 'tradespeople', 'Repairs & tradespeople', When.always, { mentalLoad: true, tasks: ['Appliances', 'Heating', 'Plumbing', 'Book repairs', 'Contact tradespeople'] }),
    // Organisation / mental load
    R('organisation', 'appointments', 'Appointments', When.always, { mentalLoad: true, tasks: ['Book appointments', 'Keep the shared calendar'] }),
    R('organisation', 'documents', 'Household paperwork', When.always, { mentalLoad: true, tasks: ['Bills & contracts', 'Insurance', 'Filing'] }),
    R('organisation', 'track_todos', 'Keep track of to-dos & dates', When.always, { mentalLoad: true, tasks: ['Track what needs doing', 'Remember birthdays & dates', 'Gifts & cards'] }),
    // Children
    R('children', 'kids_ready', 'Getting the kids ready', When.kids, { tasks: ["Prepare children's clothes", 'Pack school/Kita bags'] }),
    R('children', 'school_runs', 'School/Kita runs', When.kids, { tasks: ['Drop-off', 'Pickup'] }),
    R('children', 'kids_meals', "Children's meals", When.kids, { tasks: ['Breakfast', 'Snacks', 'Dinner'] }),
    R('children', 'bath_bedtime', 'Bath & bedtime', When.kids, { tasks: ['Bathing', 'Bedtime'] }),
    R('children', 'toys', "Toys & kids' tidying", When.kids, { tasks: ['Tidy toys', "Sort kids' clothes"] }),
    R('children', 'kids_admin', 'School/Kita admin & appointments', When.kids, { mentalLoad: true, tasks: ['Forms & admin', 'Doctor appointments', 'Parent evenings'] }),
    R('children', 'activities', 'Activities', When.kids, { tasks: ['Drive to activities', 'Organise playdates'] }),
    // Pets
    R('pets', 'feed_pet', 'Feed pet', When.pets, { tasks: ['Food', 'Fresh water'] }),
    R('pets', 'walk_pet', 'Walk pet', When.pet('dog'), { tasks: ['Morning walk', 'Evening walk'] }),
    R('pets', 'litter', 'Clean litter', When.pet('cat'), { tasks: ['Scoop litter', 'Change litter'] }),
    R('pets', 'pet_care', 'Vet & pet supplies', When.pets, { mentalLoad: true, tasks: ['Vet appointments', 'Buy food & supplies'] }),
    // Garden
    R('garden', 'mow', 'Mow the lawn', When.flag('garden'), { tasks: ['Mow', 'Edges & clippings'] }),
    R('garden', 'water_garden', 'Water the garden', When.flag('garden'), { tasks: ['Water beds', 'Water pots'] }),
    R('garden', 'garden_tidy', 'Weeding & garden tidying', When.flag('garden'), { tasks: ['Weeding', 'Rake leaves', 'Tidy outdoor space'] }),
    // Car
    R('car', 'car_care', 'Car care', When.flag('car'), { tasks: ['Refuel / charge', 'Clean the car'] }),
    R('car', 'car_service', 'Service & tyres', When.flag('car'), { mentalLoad: true, tasks: ['Service & inspection', 'Seasonal tyre change'] }),
  ]),
});

const Library = (() => {
  const index = new Map(LIBRARY.responsibilities.map((r, i) => [r.id, { item: r, order: i }]));
  const catOrder = new Map(LIBRARY.categories.map((c, i) => [c.id, i]));
  return {
    get: id => (index.get(id) || {}).item || null,
    order: id => (index.has(id) ? index.get(id).order : Infinity),
    category: id => LIBRARY.categories.find(c => c.id === id) || { id: String(id), name: String(id) },
    categoryOrder: id => (catOrder.has(id) ? catOrder.get(id) : Infinity),
    relevant: h => LIBRARY.responsibilities.filter(r => r.when(h)),
    /** An example for "Add your own part": something that belongs to this task (else to its area). */
    partExample: r => PART_EXAMPLES[r.libraryId] || PART_EXAMPLES[r.category] || 'Something else this needs',
    /** Names of the parts inside a responsibility (shown when you open a task). */
    parts: libId => ((index.get(libId) || {}).item || {}).tasks ? index.get(libId).item.tasks.map(t => (typeof t === 'string' ? t : t.name)) : [],
  };
})();

/* Examples shown in the "Add your own part" field, by task, then by area. Never one of the task's own parts. */
const PART_EXAMPLES = Object.freeze({
  clean_bathroom: 'Clean the grout', clean_floors: 'Clean the skirting boards', tidying: 'Water the plants',
  clean_windows: 'Clean the blinds', tidy_office: 'Dust the screen', dishes: 'Scrub the pans',
  clean_kitchen: 'Descale the kettle', laundry: 'Iron shirts', groceries: 'Check the fridge',
  cooking: 'Plan the week\'s meals', rubbish: 'Clean the bins', recycling: 'Return deposit bottles',
  supplies: 'Dishwasher tabs', small_repairs: 'Oil squeaky hinges', tradespeople: 'Chimney sweep',
  appointments: 'Dentist check-ups', documents: 'Tax return', track_todos: 'Plan holidays',
  kids_ready: 'Check the weather', school_runs: 'Bring the gym bag', kids_meals: 'Pack fruit',
  bath_bedtime: 'Read a story', toys: 'Give away old toys', kids_admin: 'Sign permission slips',
  activities: 'Swimming lessons', feed_pet: 'Wash the bowls', walk_pet: 'Midday walk',
  litter: 'Clean the tray', pet_care: 'Flea treatment', mow: 'Sharpen the blades',
  water_garden: 'Water the hanging baskets', garden_tidy: 'Trim the hedge', car_care: 'Top up washer fluid',
  car_service: 'Renew the parking permit',
  // by area, for your own tasks
  cleaning: 'Dust the shelves', kitchen: 'Clean the oven', food: 'Check the fridge',
  waste: 'Clean the bins', maintenance: 'Bleed the radiators', organisation: 'Pay the bills',
  children: 'Pack the bags', pets: 'Brush the coat', garden: 'Sweep the patio', car: 'Check tyre pressure',
});

/* =========================================================
   TIMING — default effort per responsibility
   Average hands-on minutes per occurrence and a typical
   frequency for a household. The owner can change both
   until the plan is accepted.
   ========================================================= */
const FREQUENCIES = Object.freeze([
  { id: 'daily',       label: 'Daily',                perWeek: 7,    everyDays: 1 },
  { id: 'several',     label: 'Several times a week', perWeek: 3,    everyDays: 2 },
  { id: 'weekly',      label: 'Weekly',               perWeek: 1,    everyDays: 7 },
  { id: 'fortnightly', label: 'Every two weeks',      perWeek: 0.5,  everyDays: 14 },
  { id: 'monthly',     label: 'Monthly',              perWeek: 0.25, everyMonths: 1 },
  { id: 'occasionally', label: 'Occasionally',        perWeek: 0.08 },
  { id: 'asneeded',    label: 'As needed',            perWeek: 0.15 },
]);
const MINUTE_OPTIONS = Object.freeze([5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240]);

const TIMING_DEFAULTS = Object.freeze({
  // Times cover all the parts of a task together (e.g. one whole bathroom). A task with `perRoom`
  // (the bathroom) is timed per room: the total is this time × the number of those rooms.
  clean_bathroom: [60, 'weekly'], clean_floors: [50, 'weekly'], tidying: [25, 'daily'], clean_windows: [60, 'monthly'], tidy_office: [15, 'weekly'],
  dishes: [25, 'daily'], clean_kitchen: [15, 'daily'],
  laundry: [60, 'several'],
  groceries: [75, 'weekly'], cooking: [50, 'daily'],
  rubbish: [10, 'several'], recycling: [15, 'weekly'],
  supplies: [30, 'monthly'],
  small_repairs: [45, 'monthly'], tradespeople: [30, 'occasionally'],
  appointments: [15, 'weekly'], documents: [30, 'monthly'], track_todos: [15, 'weekly'],
  kids_ready: [20, 'daily'], school_runs: [40, 'daily'], kids_meals: [30, 'daily'], bath_bedtime: [40, 'daily'],
  toys: [10, 'daily'], kids_admin: [30, 'weekly'], activities: [60, 'weekly'],
  feed_pet: [5, 'daily'], walk_pet: [30, 'daily'], litter: [10, 'daily'], pet_care: [30, 'monthly'],
  mow: [45, 'fortnightly'], water_garden: [15, 'several'], garden_tidy: [45, 'fortnightly'],
  car_care: [20, 'weekly'], car_service: [60, 'occasionally'],
});

const Timing = {
  frequency: id => FREQUENCIES.find(f => f.id === id) || FREQUENCIES.find(f => f.id === 'weekly'),
  defaultsFor(libId) {
    const d = TIMING_DEFAULTS[libId];
    return d ? { minutes: d[0], frequency: d[1] } : { minutes: 20, frequency: 'weekly' };
  },
  /** Effective timing of a household responsibility (falls back to library defaults). */
  /** minutes = the total (each × rooms); each = the time set per room (what is stored). base = how often the household set it; frequency/perWeek = how often it really happens once
   *  the person doing it has picked its days (r._days, set by Household.applyWhen): 7 days = daily. */
  of(r) {
    const d = this.defaultsFor(r.libraryId);
    const each = Number(r.minutes) || d.minutes;
    const rooms = Number(r._rooms) > 1 ? Number(r._rooms) : 1;
    const minutes = each * rooms;
    const base = r.frequency || d.frequency;
    const n = Array.isArray(r._days) ? r._days.length : 0;
    if (n && (base === 'several' || base === 'weekly')) {
      return { minutes, each, rooms, base, frequency: n >= 7 ? 'daily' : n === 1 ? 'weekly' : 'several', perWeek: Math.min(n, 7) };
    }
    return { minutes, each, rooms, base, frequency: base, perWeek: this.frequency(base).perWeek };
  },
  /** Minutes per week this responsibility takes on average. */
  weeklyMinutes(r) { const t = this.of(r); return t.minutes * t.perWeek; },
  isScheduled(r) { const f = this.frequency(this.of(r).frequency); return !!(f.everyDays || f.everyMonths); },
  freqLabel(r) {
    const t = this.of(r);
    return t.frequency === 'several' && t.base !== 'several' || (t.frequency === 'several' && t.perWeek !== 3)
      ? `${t.perWeek}× a week` : this.frequency(t.frequency).label;
  },
  label(r) { const t = this.of(r); return `${this.freqLabel(r)} · ${formatMinutes(t.minutes)}`; },
};

function formatMinutes(m) {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
