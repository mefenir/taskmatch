# Our Household

A calm, shared household app for couples and households. It makes the invisible household workload visible first, then helps you organise it together.

Static site (HTML, CSS, plain JavaScript), Firebase for sign-in and data, hosted on GitHub Pages. No build step.

The full product spec is in [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md). Read it before changing product behaviour.

## What works today

- Sign up or sign in with email and password, or with Google. Password reset.
- Create a household: your name, rooms, children, pets, garden, car.
- Pick what needs to happen from the predefined responsibility library.
- See the shared household inventory, synced live between everyone in the household.
- Invite your partner with a one-time link. They sign up and join straight away.
- Partners never set up anything themselves. While the owner is still setting up, they see a waiting screen. Then they look through the owner's list and **agree** to it. If the owner changes the list later, they're asked to look again. The owner sees who has agreed.
- With Premium, partners can **suggest changes** (add or remove a responsibility). The owner accepts or declines each one.
- Leave a household (members) or delete it (owner).
- Free/Premium gating, with Premium tied to the household owner (see below).

- **How often, and how long?** Every responsibility comes with a typical frequency and time per go. The owner can change them until the plan starts; the partner sees them when reviewing the list.
- **Preferences.** Once everyone has agreed to the list, each person marks every task ❤️ Happy to do it · 🙂 Don't mind · 🙃 Would rather not. Nobody sees anyone else's answers.
- **The fair split** (`js/plan.js`). Shares tasks by *weekly effort* (time × how often), not by count. A clear opposition (❤️ vs 🙃) always goes to the person who loves it; everything else is balanced, leaning towards what people like. The same answers always give the same plan.
- **The plan.** Both see who does what and "Evenly split". To hand something over, tap **Swap**: the other person takes it and picks one of their tasks to give back — or declines. Both say **Start this plan** to begin.
- **Daily use.** Today / This week / This month, with a toggle for everyone's tasks. Tap to tick off (tap again the same day to undo); recurring tasks come back on schedule, and each person's first round is spread out so day one isn't overloaded. "As needed" tasks are ticked whenever they happen.
- Tasks added after the plan starts show up under **Needs a home** for someone to claim.

## How Premium works

- Premium belongs to a **person**: the household **owner**, meaning whoever created the household.
- Everyone in the owner's household gets Premium while the owner's subscription is active.
- When the owner's subscription ends, **everyone** drops back to Free at the same moment. Anything created with Premium is kept and becomes read-only.
- Members who aren't the owner see "Ask {owner} to upgrade" instead of an upgrade button.
- Suggesting changes is a Premium feature for members; the security rules refuse suggestions while the owner isn't Premium.
- Seeing the **total time per person** on the plan is Premium. Per-task times are free.

Planned for Premium later: detailed tasks (the split would then work per task), custom responsibilities with your own time estimates, and adjusting estimates.
- The app can never grant Premium. It's stored in `subscriptions/{ownerUid}`, which only the Firebase console (and later a payment webhook) can write.

There's no checkout yet. To test Premium, give an owner a subscription by hand (step 5 below).

## Setup

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project**. Analytics isn't needed.
2. **Build → Authentication → Get started**, then enable:
   - **Email/Password**
   - **Google**. Google asks for a *support email*, which is shown to people on the Google sign-in screen. Use an address you're happy to make public.
3. **Authentication → Settings → Authorised domains** → add `mefenir.github.io` (and `localhost` is already there for testing).
4. **Build → Firestore Database → Create database**. Pick a region near your users (e.g. `europe-west3`, Frankfurt). Start in **production mode**.

### 2. Connect the app

1. **Project settings (gear) → General → Your apps → Add app → Web (`</>`)**. Register it and copy the `firebaseConfig` values.
2. Paste them into [`js/config.js`](js/config.js), replacing the `REPLACE_ME` placeholders. This config isn't secret; the security rules protect the data.

### 3. Publish the security rules

**Firestore Database → Rules** → paste the contents of [`firestore.rules`](firestore.rules) → **Publish**.

**Publish them again whenever `firestore.rules` changes in this repo** — the app expects the latest version.

The rules make sure that:
- only members can read a household, and nobody can change its owner,
- only the owner edits the household, its list and the times; other members can agree, answer their *own* preferences, say yes to the plan, swap and tick tasks off, and suggest list changes while the owner has Premium,
- people can only join with a valid, unused, unexpired invite,
- members can leave; only the owner can delete,
- nobody can give themselves Premium.

### 4. Turn on GitHub Pages

On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.

The app is live at `https://mefenir.github.io/taskmatch/` a minute or two later. Every push to `main` redeploys it.

### 5. Test Premium (optional)

1. Sign up in the app and create a household. Copy your **User UID** from **Authentication → Users**.
2. **Firestore → Start collection** `subscriptions` → Document ID = that UID → fields:
   - `plan` (string): `premium`
   - `active` (boolean): `true`
3. Everyone in your household now has Premium. Set `active` to `false` and they all lose it again.

## Running locally

Any static server works (sign-in needs `http://localhost`, not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project structure

```
index.html            App shell; loads Firebase and the scripts in order
css/styles.css        Design tokens (light + dark) and components
js/config.js          Firebase web config + app settings
js/util.js            Small helpers
js/library.js         Predefined responsibility library (read-only, versioned)
js/entitlements.js    Free/Premium rules — the only place plans are checked
js/plan.js            The fair split, recurring schedule, swap messages (no DOM, no Firebase)
js/household.js       Household domain logic (no DOM, no Firebase)
js/backend.js         All Firebase Auth + Firestore calls
js/ui.js              Shared UI pieces: rows, steppers, sheets, toast
js/screens.js         Screens and sheets (HTML from state)
js/app.js             State, auth flow, live sync, actions, router
firestore.rules       Security rules
docs/PRODUCT_BRIEF.md Product spec
```

## Data model (Firestore)

| Path | What | Who can write |
|---|---|---|
| `users/{uid}` | email, display name, which household | that user |
| `households/{hid}` | owner, members, rooms, children, pets, responsibilities (with times), agreements, suggestions, preferences, plan, swaps, completions | owner; members only their own agreement/preferences plus plan, swaps and ticks |
| `invites/{code}` | household, expiry, who used it | members create; invitee redeems once |
| `subscriptions/{uid}` | `plan`, `active`, optional `expiresAt` | server / console only |

A responsibility is **not** an assignment: selected responsibilities carry no owner, frequency or preference yet.

## Known limits of this version

- One household per person.
- Preferences are hidden in the app but stored in the shared household data (the split runs on your phones). Making them truly private needs a server function (Firebase Blaze plan).
- If two people change the *same* list at the *same* second, the last save wins.
- No checkout; Premium is set by hand.
