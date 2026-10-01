'use strict';

/* =========================================================
   PREDEFINED RESPONSIBILITY LIBRARY  (read-only, versioned)
   Kept separate from household data. Households store a
   reference (libraryId) plus a copy of the display name.
   `when(household)` decides whether an item is relevant.
   `tasks` = detailed breakdown, shown only with the
   `detailed_tasks` entitlement (Premium, later phase).
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
    // Cleaning
    R('cleaning', 'vacuum', 'Vacuum'),
    R('cleaning', 'mop', 'Mop'),
    R('cleaning', 'dust', 'Dust'),
    R('cleaning', 'clean_bathroom', 'Clean bathroom', When.room('bathroom'), { tasks: ['Clean toilet', 'Clean sink', 'Clean shower', 'Clean bathtub', 'Clean mirror', 'Clean floor', 'Replace towels', 'Refill toilet paper', 'Refill soap'] }),
    R('cleaning', 'clean_toilet', 'Clean toilet', When.room('bathroom')),
    R('cleaning', 'clean_shower', 'Clean shower/bath', When.room('bathroom')),
    R('cleaning', 'clean_kitchen', 'Clean kitchen', When.room('kitchen')),
    R('cleaning', 'clean_windows', 'Clean windows'),
    R('cleaning', 'clean_mirrors', 'Clean mirrors'),
    R('cleaning', 'tidying', 'General tidying'),
    R('cleaning', 'tidy_office', 'Tidy home office', When.room('office')),
    // Kitchen & dishes
    R('kitchen', 'load_dishwasher', 'Load dishwasher', When.room('kitchen')),
    R('kitchen', 'unload_dishwasher', 'Unload dishwasher', When.room('kitchen')),
    R('kitchen', 'wash_dishes', 'Wash dishes', When.room('kitchen')),
    R('kitchen', 'kitchen_surfaces', 'Clean kitchen surfaces', When.room('kitchen')),
    R('kitchen', 'clean_sink', 'Clean sink', When.room('kitchen')),
    R('kitchen', 'put_food_away', 'Put food away', When.room('kitchen')),
    R('kitchen', 'clean_appliances', 'Clean appliances', When.room('kitchen')),
    // Laundry
    R('laundry', 'laundry', 'Laundry', When.always, { tasks: ['Wash clothes', 'Dry clothes', 'Fold clothes', 'Put clothes away', 'Wash towels', 'Wash bed linen'] }),
    R('laundry', 'bed_linen', 'Change bed linen', When.room('bedroom')),
    R('laundry', 'towels', 'Wash towels'),
    // Food
    R('food', 'meal_planning', 'Meal planning', When.always, { mentalLoad: true }),
    R('food', 'groceries', 'Grocery shopping', When.always, { tasks: [
      { name: 'Notice what is missing', mentalLoad: true }, { name: 'Check supplies', mentalLoad: true },
      { name: 'Create shopping list', mentalLoad: true }, { name: 'Go shopping' },
      { name: 'Carry groceries' }, { name: 'Put groceries away' } ] }),
    R('food', 'cooking', 'Cooking', When.always, { tasks: ['Plan meals', 'Check ingredients', 'Grocery shop', 'Prepare ingredients', 'Cook', 'Store leftovers', 'Clean kitchen afterwards'] }),
    R('food', 'lunches', 'Preparing lunches'),
    R('food', 'leftovers', 'Managing leftovers'),
    // Waste
    R('waste', 'rubbish', 'Take rubbish out'),
    R('waste', 'recycling', 'Recycling'),
    R('waste', 'glass', 'Glass'),
    R('waste', 'paper', 'Paper'),
    R('waste', 'bottles', 'Bottles'),
    R('waste', 'bins_back', 'Bring bins back in'),
    // Supplies
    R('supplies', 'buy_cleaning', 'Buy cleaning products'),
    R('supplies', 'buy_toilet_paper', 'Buy toilet paper'),
    R('supplies', 'buy_detergent', 'Buy laundry detergent'),
    R('supplies', 'buy_household', 'Buy household supplies'),
    // Maintenance
    R('maintenance', 'small_repairs', 'Small repairs'),
    R('maintenance', 'light_bulbs', 'Light bulbs'),
    R('maintenance', 'appliances', 'Appliances'),
    R('maintenance', 'heating', 'Heating'),
    R('maintenance', 'plumbing', 'Plumbing'),
    R('maintenance', 'furniture', 'Furniture assembly'),
    R('maintenance', 'tradespeople', 'Contact tradespeople'),
    // Organisation / mental load
    R('organisation', 'appointments', 'Organise appointments', When.always, { mentalLoad: true }),
    R('organisation', 'book_repairs', 'Book repairs', When.always, { mentalLoad: true }),
    R('organisation', 'documents', 'Manage household documents', When.always, { mentalLoad: true }),
    R('organisation', 'track_todos', 'Track things that need doing', When.always, { mentalLoad: true }),
    R('organisation', 'dates', 'Remember important dates', When.always, { mentalLoad: true }),
    // Children
    R('children', 'kids_clothes', "Prepare children's clothes", When.kids),
    R('children', 'kids_bags', 'Prepare school/Kita bags', When.kids),
    R('children', 'dropoff', 'School/Kita drop-off', When.kids),
    R('children', 'pickup', 'School/Kita pickup', When.kids),
    R('children', 'kids_meals', "Children's meals", When.kids),
    R('children', 'bathing', 'Bathing', When.kids),
    R('children', 'bedtime', 'Bedtime', When.kids),
    R('children', 'toys', 'Toys', When.kids),
    R('children', 'kids_admin', 'School/Kita administration', When.kids, { mentalLoad: true }),
    R('children', 'activities', 'Activities', When.kids),
    R('children', 'kids_appointments', 'Appointments', When.kids, { mentalLoad: true }),
    // Pets
    R('pets', 'feed_pet', 'Feed pet', When.pets),
    R('pets', 'walk_pet', 'Walk pet', When.pet('dog')),
    R('pets', 'litter', 'Clean litter', When.pet('cat')),
    R('pets', 'vet', 'Vet appointments', When.pets, { mentalLoad: true }),
    R('pets', 'pet_supplies', 'Buy pet supplies', When.pets),
    // Garden
    R('garden', 'mow', 'Mow the lawn', When.flag('garden')),
    R('garden', 'water_garden', 'Water the garden', When.flag('garden')),
    R('garden', 'weeding', 'Weeding', When.flag('garden')),
    R('garden', 'leaves', 'Rake leaves', When.flag('garden')),
    R('garden', 'outdoor_tidy', 'Tidy outdoor space', When.flag('garden')),
    // Car
    R('car', 'fuel', 'Refuel / charge car', When.flag('car')),
    R('car', 'clean_car', 'Clean car', When.flag('car')),
    R('car', 'car_service', 'Car service & inspection', When.flag('car'), { mentalLoad: true }),
    R('car', 'tyres', 'Seasonal tyre change', When.flag('car')),
  ]),
});

const Library = (() => {
  const index = new Map(LIBRARY.responsibilities.map((r, i) => [r.id, { item: r, order: i }]));
  const catOrder = new Map(LIBRARY.categories.map((c, i) => [c.id, i]));
  return {
    get: id => (index.get(id) || {}).item || null,
    order: id => (index.has(id) ? index.get(id).order : Infinity),
    category: id => LIBRARY.categories.find(c => c.id === id) || { id, name: id },
    categoryOrder: id => (catOrder.has(id) ? catOrder.get(id) : Infinity),
    relevant: h => LIBRARY.responsibilities.filter(r => r.when(h)),
  };
})();

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
  // Cleaning
  vacuum: [30, 'weekly'], mop: [25, 'weekly'], dust: [20, 'weekly'], clean_bathroom: [40, 'weekly'],
  clean_toilet: [10, 'weekly'], clean_shower: [20, 'weekly'], clean_kitchen: [30, 'weekly'],
  clean_windows: [60, 'monthly'], clean_mirrors: [10, 'fortnightly'], tidying: [15, 'daily'], tidy_office: [15, 'weekly'],
  // Kitchen & dishes
  load_dishwasher: [10, 'daily'], unload_dishwasher: [10, 'daily'], wash_dishes: [20, 'daily'],
  kitchen_surfaces: [10, 'daily'], clean_sink: [5, 'several'], put_food_away: [10, 'several'], clean_appliances: [30, 'monthly'],
  // Laundry
  laundry: [45, 'several'], bed_linen: [30, 'fortnightly'], towels: [20, 'weekly'],
  // Food
  meal_planning: [20, 'weekly'], groceries: [60, 'weekly'], cooking: [45, 'daily'], lunches: [15, 'several'], leftovers: [10, 'several'],
  // Waste
  rubbish: [5, 'several'], recycling: [10, 'weekly'], glass: [10, 'monthly'], paper: [10, 'fortnightly'],
  bottles: [15, 'monthly'], bins_back: [5, 'weekly'],
  // Supplies
  buy_cleaning: [20, 'monthly'], buy_toilet_paper: [10, 'monthly'], buy_detergent: [10, 'monthly'], buy_household: [30, 'monthly'],
  // Maintenance
  small_repairs: [45, 'monthly'], light_bulbs: [10, 'asneeded'], appliances: [30, 'asneeded'], heating: [20, 'occasionally'],
  plumbing: [30, 'asneeded'], furniture: [90, 'occasionally'], tradespeople: [20, 'asneeded'],
  // Organisation / mental load
  appointments: [15, 'weekly'], book_repairs: [15, 'asneeded'], documents: [30, 'monthly'], track_todos: [10, 'weekly'], dates: [10, 'monthly'],
  // Children
  kids_clothes: [10, 'daily'], kids_bags: [10, 'daily'], dropoff: [20, 'daily'], pickup: [20, 'daily'], kids_meals: [30, 'daily'],
  bathing: [20, 'several'], bedtime: [30, 'daily'], toys: [10, 'daily'], kids_admin: [20, 'weekly'], activities: [60, 'weekly'],
  kids_appointments: [30, 'monthly'],
  // Pets
  feed_pet: [5, 'daily'], walk_pet: [30, 'daily'], litter: [10, 'daily'], vet: [60, 'occasionally'], pet_supplies: [20, 'fortnightly'],
  // Garden
  mow: [45, 'fortnightly'], water_garden: [15, 'several'], weeding: [30, 'fortnightly'], leaves: [45, 'occasionally'], outdoor_tidy: [30, 'monthly'],
  // Car
  fuel: [15, 'weekly'], clean_car: [45, 'monthly'], car_service: [60, 'occasionally'], tyres: [60, 'occasionally'],
});

const Timing = {
  frequency: id => FREQUENCIES.find(f => f.id === id) || FREQUENCIES.find(f => f.id === 'weekly'),
  defaultsFor(libId) {
    const d = TIMING_DEFAULTS[libId];
    return d ? { minutes: d[0], frequency: d[1] } : { minutes: 20, frequency: 'weekly' };
  },
  /** Effective timing of a household responsibility (falls back to library defaults). */
  of(r) {
    const d = this.defaultsFor(r.libraryId);
    return { minutes: Number(r.minutes) || d.minutes, frequency: r.frequency || d.frequency };
  },
  /** Minutes per week this responsibility takes on average. */
  weeklyMinutes(r) { const t = this.of(r); return t.minutes * this.frequency(t.frequency).perWeek; },
  isScheduled(r) { const f = this.frequency(this.of(r).frequency); return !!(f.everyDays || f.everyMonths); },
  label(r) { const t = this.of(r); return `${this.frequency(t.frequency).label} · ${formatMinutes(t.minutes)}`; },
};

function formatMinutes(m) {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
