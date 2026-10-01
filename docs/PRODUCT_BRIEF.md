# Household App — LLM Coding Brief

## 1. Product concept

Build a simple household-management app for couples and households.

The core problem is not simply:

> "Who cleans?"

It is:

> "What work exists in our household, who is responsible for it, and how is it divided?"

The app should make household responsibilities visible and help people organise them together.

The product should feel:

* Simple
* Calm
* Modern
* Non-judgemental
* Fast to configure
* Easy to use every day
* More like a shared household tool than a project-management app

Do not overload users with configuration during onboarding.

---

# 2. Core product principle

## DISCOVER FIRST. ALLOCATE SECOND.

The app must first establish:

> **What needs to happen in this household?**

Only afterwards should it ask:

> **Who does it?**

And only after that:

> **How often?**

Do not mix these stages unnecessarily.

---

# 3. Free vs Premium — fundamental product model

The most important monetisation principle is:

## FREE = manage predefined household responsibilities

## PREMIUM = customise and expand the household workload

Free users receive a curated library of predefined responsibilities.

Premium users unlock deeper granularity and customisation.

### Free

Users can:

* Set up their household
* Select predefined responsibilities
* Assign responsibilities
* Set frequency
* Complete tasks
* Add household members
* Use the standard responsibility library

### Premium

Everything in Free, plus:

* Break responsibilities into detailed tasks
* Add additional tasks
* Create completely new responsibilities
* Customise the household workload in greater detail
* Access more granular responsibility structures

### Critical rule

**Adding new tasks or responsibilities is Premium-only.**

A Free user must NOT be able to create:

* Custom tasks
* Custom responsibilities
* Additional subtasks

The underlying architecture should support them, but the UI must enforce the subscription entitlement.

---

# 4. Initial household setup

The first user creates a household.

Collect only the information needed to determine which predefined responsibilities are relevant.

## Household members

Example:

* Me
* Partner

Allow additional members later.

## Home structure

Ask for relevant rooms.

Examples:

* Bedrooms
* Bathrooms
* Kitchen
* Living room
* Office
* Other relevant rooms

Use simple controls.

Example:

**How many bedrooms?**

`−   3   +`

Avoid long forms.

## Household circumstances

Ask whether the household has:

* Children
* Pets
* Garden / outdoor space
* Car
* Other relevant circumstances

Only show questions that are useful for generating responsibilities.

---

# 5. Generate household responsibilities

Once the household structure is known, generate a predefined list of relevant responsibilities.

Do NOT immediately ask about frequency.

Do NOT immediately assign responsibilities.

Instead ask:

> **What needs to happen in your household?**

The user selects the responsibilities that apply.

---

# 6. Responsibility categories

Use a curated responsibility library.

## Cleaning

Examples:

* Vacuum
* Mop
* Dust
* Clean bathroom
* Clean toilet
* Clean shower/bath
* Clean kitchen
* Clean windows
* Clean mirrors
* General tidying

## Kitchen & dishes

* Load dishwasher
* Unload dishwasher
* Wash dishes
* Clean kitchen surfaces
* Clean sink
* Put food away
* Clean appliances

## Laundry

* Laundry
* Change bed linen
* Wash towels

## Food

* Meal planning
* Grocery shopping
* Cooking
* Preparing lunches
* Managing leftovers

## Waste

* Take rubbish out
* Recycling
* Glass
* Paper
* Bottles
* Bring bins back in

## Household supplies

* Buy cleaning products
* Buy toilet paper
* Buy laundry detergent
* Buy household supplies

## Maintenance

* Small repairs
* Light bulbs
* Appliances
* Heating
* Plumbing
* Furniture assembly
* Contact tradespeople

## Organisation / mental load

* Organise appointments
* Book repairs
* Manage household documents
* Track things that need doing
* Remember important dates

## Children

Only show when relevant.

Examples:

* Prepare children's clothes
* Prepare school/Kita bags
* School/Kita drop-off
* School/Kita pickup
* Children's meals
* Bathing
* Bedtime
* Toys
* School/Kita administration
* Activities
* Appointments

## Pets

Only show when relevant.

Examples:

* Feed pet
* Walk pet
* Clean litter
* Vet appointments
* Buy pet supplies

---

# 7. Responsibility selection UX

Responsibilities should initially appear as simple selectable items.

Example:

## LAUNDRY

☐ Laundry

## CLEANING

☐ Vacuum
☐ Mop
☐ Clean bathroom
☐ Clean kitchen

The user simply selects what applies.

The app should not ask:

* How often?
* How long?
* Who does it?
* How difficult is it?

Not yet.

The first stage is only:

> **Does this responsibility exist in our household?**

---

# 8. Free users cannot create new tasks

This is a critical requirement.

A Free user can select from the predefined responsibility library.

A Free user cannot:

* Add a custom responsibility
* Add a custom task
* Create subtasks
* Modify the predefined task structure

If the user attempts to access customisation, show a Premium upgrade prompt.

Example:

> **Make your household fit your life.**
>
> Premium lets you add your own responsibilities and break everyday chores into detailed tasks.

CTA:

**Unlock Premium**

Do not prevent Free users from using the standard functionality.

---

# 9. Premium granularity

Premium should reveal the work behind high-level responsibilities.

Example:

### Free

**Laundry**

### Premium

**Laundry**

* Wash clothes
* Dry clothes
* Fold clothes
* Put clothes away
* Wash towels
* Wash bed linen

And:

**+ Add task**

Another example:

### Free

**Clean bathroom**

### Premium

* Clean toilet
* Clean sink
* Clean shower
* Clean bathtub
* Clean mirror
* Clean floor
* Replace towels
* Refill toilet paper
* Refill soap

Another:

### Free

**Cooking**

### Premium

* Plan meals
* Check ingredients
* Grocery shop
* Prepare ingredients
* Cook
* Store leftovers
* Clean kitchen afterwards

Premium is therefore not simply:

> "More chores."

It is:

> **More detailed understanding and customisation of the work.**

---

# 10. Adding custom responsibilities

Premium users can create a new responsibility.

Example:

**+ Add responsibility**

Fields:

* Name
* Category
* Optional description

Example:

> Clean aquarium

The new responsibility becomes part of that household's responsibility inventory.

Free users can see that customisation exists but cannot use it.

---

# 11. Adding custom tasks

Premium users can add tasks inside existing responsibilities.

Example:

### Laundry

* Wash clothes
* Dry clothes
* Fold clothes
* Put clothes away

Premium user:

**+ Add task**

→ "Clean washing machine"

This task becomes part of the household's Laundry structure.

---

# 12. Important product distinction

Adding a responsibility does NOT mean assigning it.

For example, a user selects:

* Laundry
* Cooking
* Cleaning bathroom

That does NOT mean the user owns them.

The app is first building the household workload map.

This distinction must be reflected in both the UX and data model.

---

# 13. Partner onboarding

Invite the second household member.

The second person should be able to:

1. Join the household
2. See the responsibilities already identified
3. Confirm the household setup
4. Add/customise responsibilities only if their household has Premium
5. Continue to allocation

The language should be neutral.

Avoid:

> "Your partner assigned these chores to you."

Prefer:

> **"Here's what your household currently has."**

---

# 14. Shared responsibility inventory

After the household setup, create a shared inventory.

Example:

# OUR HOUSEHOLD

### Cleaning

* Vacuum
* Mop
* Bathroom
* Kitchen

### Laundry

* Laundry
* Bed linen

### Food

* Grocery shopping
* Cooking

### Waste

* Rubbish
* Recycling

This is the household's responsibility map.

---

# 15. Allocation stage

Only after the responsibility inventory is established should the app introduce ownership.

Ask:

> **Who normally takes responsibility for this?**

Options:

* Me
* Partner
* Both
* We haven't decided

Do not force an assignment.

"Both" and "Undecided" are valid states.

---

# 16. Preference stage

Allow each person to express preferences.

Example:

### How do you feel about this task?

* ❤️ Happy to do it
* 🙂 Don't mind
* 😐 Neutral
* 🙃 Would rather not

This is not intended to create competition.

It gives the system information that can later help households organise responsibilities.

---

# 17. Frequency stage

Only after responsibilities and ownership have been established should frequency be introduced.

Possible options:

* Daily
* Several times a week
* Weekly
* Every two weeks
* Monthly
* Occasionally
* As needed

Do not introduce frequency during the initial responsibility-discovery stage.

---

# 18. Mental load

The architecture should distinguish between physical execution and mental responsibility.

Example:

## Grocery shopping

Physical work:

* Go shopping
* Carry groceries
* Put groceries away

Mental work:

* Notice what is missing
* Check supplies
* Create shopping list
* Plan meals
* Remember household preferences

The application should eventually be able to represent both.

This is an important long-term product differentiator.

---

# 19. Data model

Separate the concepts of:

### Responsibility

A high-level household responsibility.

Example:

`Laundry`

### Task

A specific piece of work.

Example:

`Wash clothes`

### Assignment

Who is responsible.

Example:

`Partner`

### Frequency

How often it occurs.

Example:

`Weekly`

### Preference

How a person feels about doing it.

Example:

`Would rather not`

### Subscription entitlement

Determines whether a household can customise the predefined responsibility library.

---

# 20. Suggested data structure

### Household

```text
Household
├── id
├── members[]
├── rooms[]
├── children[]
├── pets[]
├── responsibilities[]
├── subscription
└── settings
```

### Responsibility

```text
Responsibility
├── id
├── category
├── name
├── description
├── predefined
├── premium
└── tasks[]
```

### Task

```text
Task
├── id
├── responsibility_id
├── name
├── description
├── predefined
├── assigned_to
├── frequency
├── preference
├── estimated_effort
├── mental_load
└── active
```

### Subscription

```text
Subscription
├── plan
├── active
└── entitlements
```

Example:

```text
plan: free

entitlements:
  detailed_tasks: false
  custom_tasks: false
  custom_responsibilities: false
```

Premium:

```text
plan: premium

entitlements:
  detailed_tasks: true
  custom_tasks: true
  custom_responsibilities: true
```

The entitlement system should be centralised rather than checking `premium` manually throughout the application.

---

# 21. Home screen

After setup, keep the home screen extremely simple.

Example:

# TODAY

○ Empty dishwasher
○ Laundry
○ Take bins out

Then:

# THIS WEEK

○ Vacuum
○ Change bed linen
○ Grocery shopping

And optionally:

# HOUSEHOLD

A neutral summary of household responsibilities.

Do not make the interface feel like a scoreboard.

---

# 22. Household balance

Eventually the app can show how responsibilities are distributed.

However, do not create a simplistic "winner" score.

Avoid:

> You do 63%.
> Your partner does 37%.

Instead use neutral information.

For example:

**Your responsibilities**

8

**Partner's responsibilities**

7

**Shared**

3

If effort estimation is eventually implemented, it can provide more meaningful context.

---

# 23. Task completion

A task should be completed with a simple interaction.

Example:

`○ Laundry`

Tap:

`✓ Laundry`

Avoid unnecessary confirmation dialogs.

Completion should immediately update the household state.

---

# 24. Recurring tasks

Recurring tasks should automatically generate their next occurrence.

Example:

Laundry:

`Weekly`

Completed:

`1 October`

Next:

`8 October`

The system should avoid creating duplicate recurring tasks.

---

# 25. Custom task behaviour

Premium-created tasks should behave exactly like predefined tasks once created.

They should support:

* Assignment
* Frequency
* Completion
* Recurrence
* Preferences
* Future effort estimates

The distinction is only that the task was created by the household rather than coming from the predefined library.

---

# 26. Design principles

The UI should be:

* Mobile-first
* PWA-ready
* Responsive
* Touch-friendly
* Minimal
* Highly readable
* Fast

Avoid:

* Dense dashboards
* Excessive colours
* Complex navigation
* Large forms
* Too many settings
* Competitive gamification
* "Winner/loser" household scoring

The emotional tone should be:

> **We're running this household together.**

Not:

> **Let's prove who does more.**

---

# 27. Technical approach

Build the first version as a modern responsive web app / PWA.

Recommended approach:

### Frontend

Either:

* HTML
* CSS
* JavaScript

or:

* React
* TypeScript
* Vite

Choose the simplest architecture appropriate for the project.

Do not introduce unnecessary frameworks.

### Storage

For the first prototype:

* LocalStorage or IndexedDB

The architecture should allow migration to a cloud database later.

Production can eventually use:

* Authentication
* Cloud database
* Household sharing
* Real-time synchronisation

These are not necessary for the first prototype.

---

# 28. MVP — Free

The first Free MVP should contain:

### Onboarding

1. Welcome
2. Create household
3. Add household members
4. Define rooms
5. Define children/pets
6. Generate relevant predefined responsibilities
7. Select responsibilities

### Household inventory

8. View selected responsibilities
9. View responsibility categories

### Allocation

10. Assign responsibilities to:

    * Me
    * Partner
    * Both
    * Undecided

### Preferences

11. Set task preference

### Scheduling

12. Set frequency

### Daily use

13. View today's tasks
14. View upcoming tasks
15. Complete tasks

### Persistence

16. Save household state
17. Restore household state after reopening

---

# 29. Premium MVP

Premium should add:

1. Detailed task breakdowns
2. Additional tasks within responsibilities
3. Custom responsibilities
4. Custom tasks
5. Custom task scheduling
6. Custom task assignment
7. Custom task completion

Example:

Free:

**Laundry**

Premium:

**Laundry**

* Wash
* Dry
* Fold
* Put away
* Wash towels
* Wash bed linen
* * Add task

---

# 30. Premium gating

Premium gating must be implemented consistently.

Create a central entitlement check.

Conceptually:

```text
canCreateCustomTask()
canCreateCustomResponsibility()
canViewDetailedTasks()
```

Do not scatter subscription checks throughout unrelated components.

When a Free user encounters a Premium feature:

1. Keep their current state intact.
2. Explain what the feature unlocks.
3. Provide an upgrade CTA.
4. Do not break the workflow.

Example:

> **Make it more detailed**
>
> Premium lets you break Laundry into individual tasks and add your own responsibilities.

**Unlock Premium**

---

# 31. Important MVP boundary

Do NOT build the following yet:

* AI allocation
* Automatic fairness algorithms
* Advanced analytics
* Social features
* Complex gamification
* Calendar integrations
* Shopping integrations
* Push notification systems
* Multiple households
* Advanced subscription billing
* Time tracking
* Sophisticated mental-load analytics

The first objective is to validate the fundamental household workflow.

---

# 32. Future features

The architecture should leave room for:

* AI-assisted allocation
* Automatic workload balancing
* Mental-load tracking
* Time/effort estimation
* Notifications
* Calendar integration
* Shopping lists
* Household inventory
* Family accounts
* Multiple households
* Advanced recurring schedules
* Household insights
* More sophisticated Premium functionality

These should not influence the simplicity of the MVP.

---

# 33. Coding rules for the LLM

When implementing the application:

1. Follow this specification.
2. Do not invent product behaviour.
3. Keep components modular.
4. Separate UI from household/business logic.
5. Keep the predefined responsibility library separate from household-specific data.
6. Treat Free/Premium as an entitlement system.
7. Do not hard-code Premium checks throughout the UI.
8. Make the data model extensible.
9. Use realistic sample household data during development.
10. Make every implemented screen functional.
11. Persist user interactions.
12. Ensure the application works on mobile widths.
13. Keep interactions fast and simple.
14. Do not add features outside the MVP without explicit instruction.
15. Preserve the distinction between responsibility, task, assignment and frequency.

Most importantly:

> **A responsibility is not an assignment.**

And:

> **Free users select from the predefined system. Premium users can customise it.**

---

# 34. Development sequence

Build the application in stages.

## Phase 1 — Foundation

Create:

* Project structure
* Routing/navigation
* Design system
* Data models
* Local persistence
* Subscription/entitlement model

## Phase 2 — Household onboarding

Build:

**Welcome → Members → Rooms → Children/Pets → Responsibility generation**

## Phase 3 — Responsibility discovery

Build:

**Generated responsibilities → Selection → Confirmation → Household inventory**

This phase should be fully functional before continuing.

## Phase 4 — Premium customisation

Build:

**Detailed tasks → Add task → Add responsibility → Premium gating**

## Phase 5 — Allocation

Build:

**Who does it? → Me / Partner / Both / Undecided**

## Phase 6 — Preferences

Build:

**Happy → Don't mind → Neutral → Would rather not**

## Phase 7 — Frequency

Build:

**Daily → Several times/week → Weekly → Fortnightly → Monthly → Occasionally → As needed**

## Phase 8 — Daily household management

Build:

**Today → Upcoming → Complete → Recurring tasks**

## Phase 9 — Polish

Improve:

* Empty states
* Loading states
* Error handling
* Responsive behaviour
* Accessibility
* Animations
* Premium upgrade moments
* Persistence reliability

---

# 35. First coding milestone

Do NOT build the entire app immediately.

The first milestone should be:

### Working prototype

**Welcome**

↓

**Household setup**

↓

**Rooms / household circumstances**

↓

**Generated responsibility library**

↓

**Select responsibilities**

↓

**Shared responsibility inventory**

The entire flow must work end-to-end.

After that is stable, proceed to:

**Premium customisation → Allocation → Preferences → Frequency → Daily tasks**

---

# 36. Success criteria

The MVP succeeds if a couple can:

1. Create their household in a few minutes.
2. Quickly identify the work required to run it.
3. See that work in one shared place.
4. Understand that responsibilities are separate from assignments.
5. Decide who owns each responsibility.
6. Establish frequencies.
7. See what needs to be done today.
8. Mark tasks complete.
9. Return later and find the household state preserved.

And for Premium:

10. Break high-level responsibilities into meaningful detailed tasks.
11. Add their own tasks.
12. Add responsibilities that aren't in the predefined library.

The fundamental product experience should be:

> **Make the invisible household workload visible.**
>
> **Then make it possible to organise it together.**

# Final product principle

## DISCOVER FIRST.

## ALLOCATE SECOND.

## CUSTOMISE WITH PREMIUM.
