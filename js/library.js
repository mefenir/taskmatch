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
