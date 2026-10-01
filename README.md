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
- Leave a household (members) or delete it (owner).
- Free/Premium gating, with Premium tied to the household owner (see below).

Next phases from the brief: Premium customisation → who does what → preferences → frequency → daily tasks.

## How Premium works

- Premium belongs to a **person**: the household **owner**, meaning whoever created the household.
- Everyone in the owner's household gets Premium while the owner's subscription is active.
- When the owner's subscription ends, **everyone** drops back to Free at the same moment. Anything created with Premium is kept and becomes read-only.
- Members who aren't the owner see "Ask {owner} to upgrade" instead of an upgrade button.
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

The rules make sure that:
- only members can read or change a household, and nobody can change its owner,
- people can only join with a valid, unused, unexpired invite,
- members can leave; only the owner can delete,
- nobody can give themselves Premium.

### 4. Turn on GitHub Pages

On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.

The app is live at `https://mefenir.github.io/<repo-name>/` a minute or two later. Every push to `main` redeploys it.

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
| `households/{hid}` | owner, members, rooms, children, pets, responsibilities, setup progress | members (owner fixed) |
| `invites/{code}` | household, expiry, who used it | members create; invitee redeems once |
| `subscriptions/{uid}` | `plan`, `active`, optional `expiresAt` | server / console only |

A responsibility is **not** an assignment: selected responsibilities carry no owner, frequency or preference yet.

## Known limits of this version

- One household per person.
- If two people change the *same* list at the *same* second, the last save wins.
- No checkout; Premium is set by hand.
