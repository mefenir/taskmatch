# Our Household

A calm, shared household app for couples and households. It makes the invisible household workload visible first, then helps you organise it together.

Static site (HTML, CSS, plain JavaScript), Firebase for sign-in and data, hosted on GitHub Pages. No build step.

The full product spec is in [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md). Read it before changing product behaviour.

## How it works

**Discover first. Allocate second. Customise with Premium.**

1. **The organiser sets up alone** (5 short steps): names, your home (rooms, children, pets, garden, car), the tasks your home needs, how often and how long, and the organiser's own answers (❤️ happy to do it · 🙂 don't mind · 🙃 rather not; unmarked = 🙂).
2. **A draft plan straight away**, with the household's weekly hours and a "who does most of it today" baseline. Nobody waits for anyone.
3. **Invite only then**: a native share with ready text and a one-time link.
4. **The partner** opens the link, sees "{organiser} made a plan for your home" and marks only what they disagree with, on one screen.
   - Nothing marked → **Looks good, let's start**: the plan is active.
   - Something marked → **Rebalance with my answers**: a fair split from both answers, then both say yes.
5. **Daily use**: Today / This week / This month, ticks, swaps. New tasks in a running plan are shared out automatically (both rate, fair split, both say yes). **Reshuffle** gives a fresh split after asking the other person.

The fair split (`js/plan.js`) shares by weekly effort (time × frequency), not by count. Clear oppositions (❤️ vs 🙃) go to the person who likes it; the rest is balanced. The same answers always give the same plan; the organiser is the tie-break, so the plan doesn't change when the partner joins.

Vocabulary used everywhere: **task**, **part** (Premium breakdown of a task), **organiser** (who created the household and pays for Premium).

Every button gives instant feedback (press animation); async actions show a spinner and are locked until they finish, and repeated taps are ignored, so nothing — above all a purchase — can run twice.

## Free and Premium

| | Free | Premium |
|---|---|---|
| Discover, plan, fair split, swaps, ticks, reshuffle | ✓ | ✓ |
| Own tasks | 3 | unlimited |
| Break tasks into parts | – | ✓ |
| Partner suggests changes | – | ✓ |
| Weekly time per person | – | ✓ |
| Board (note · running low · today only) | – | ✓ |

- **Price:** € 4.99 / month, or € 39.99 / year (shown as € 3.33 / month, billed yearly). **21-day free trial on the yearly plan only**, once per person.
- Premium belongs to the **organiser** and covers the whole household. When it ends, everyone is back on Free at once; data is kept and returns with Premium (parts merge back to whoever did most of them).
- The trial offer is shown once, right after the plan starts. Elsewhere Premium is offered by one shared component (gold badge → sheet → Premium page).
- The organiser manages or cancels the subscription in the Stripe customer portal (Premium page → Manage or cancel subscription). A failed renewal keeps Premium while Stripe retries and shows "Fix payment".
- Two sources can make the organiser Premium, merged in `Entitlements.effective()`: a Stripe subscription (`customers/{uid}/subscriptions`) or a gift from the admin panel (`subscriptions/{uid}`). While no Stripe prices are configured, the Premium page shows **I'm interested** (requests go to the admin panel).

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
- only the organiser edits the household, its list and the times; the partner can answer their *own* preferences, say yes to the plan, swap and tick tasks off, and (with Premium) suggest changes and write board notes,
- people can only join with a valid, unused, unexpired invite,
- members can leave; only the owner can delete,
- nobody can give themselves Premium, and checkouts only use the two configured prices.

### 4. Turn on GitHub Pages

On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.

The app is live at `https://mefenir.github.io/taskmatch/` a minute or two later. Every push to `main` redeploys it.

### 5. Admin panel (funnel and Premium requests)

The panel is at **`https://mefenir.github.io/taskmatch/admin.html`**. It isn't linked from the app.

One-time setup:
1. **Firebase → Authentication → Users → Add user.** Pick a username in email form (it doesn't need a real inbox), e.g. `admin@taskmatch.app`, and a strong password. Copy the new **User UID**.
2. **Firestore → Data → Start collection** `admins` → Document ID = that UID → field `role` (string) = `admin` → Save.
3. Make sure the latest `firestore.rules` are published.

Then sign in on `admin.html` with that username and password.

**Funnel** shows, for the last 30 / 90 days or all time, how many households reached each step (started setting up → picked tasks → saw their plan → invited → partner joined → partner reviewed → plan started → opened checkout), with % of the previous step, and how many were still used 7 days after starting. Data comes from `metrics/{hid}` (step times and active days only, no names or content).

**Premium requests** shows every request, filtered by **Waiting / Premium / Closed / All**:
- **Unlock Premium** gives the requester's whole household Premium (writes `subscriptions/{uid}`).
- **Deny** turns the request down; they can ask again later.
- **Revoke Premium** ends it; everyone in the household drops back to Free at once.

Only accounts listed in `admins` can see requests or change Premium; the rules enforce it, not just the page.

### 6. Payments with Stripe (Premium)

Needs the Firebase **Blaze** plan (pay as you go; the free quota covers a small app).

1. **Stripe → Products → Add product** "Our Household Premium" with two **recurring** prices: **€ 4.99 monthly** and **€ 39.99 yearly**. Don't set a default trial on either price — the app asks for the 21-day trial only on the yearly checkout.
2. On the product, add **metadata** `firebaseRole` = `premium`. The extension then puts `stripeRole: premium` into the organiser's sign-in token, which the security rules check.
3. **Firebase → Extensions → Run Payments with Stripe** (`stripe/firestore-stripe-payments`). Settings: customers collection `customers`, products collection `products`, sync new users: yes. Note the **region** you pick.
4. Copy the webhook URL the extension shows into **Stripe → Developers → Webhooks**, with the events the extension lists (product, price, checkout.session.completed, customer.subscription.*, invoice.*…). Put the signing secret back into the extension.
5. **Stripe → Settings → Billing → Customer portal**: allow cancelling and updating the payment method.
6. **Stripe → Settings → Billing → Subscriptions and emails**: turn on the **reminder email before a trial ends** (required in the EU) and emails for failed payments.
7. Paste the two price IDs in **both** places:
   - [`js/config.js`](js/config.js) → `billing.prices.monthly` / `yearly` (and `functionsRegion` = the extension region),
   - [`firestore.rules`](firestore.rules) → `monthlyPrice()` / `yearlyPrice()` — then **publish the rules again**.
8. Keep `billing.display` in `config.js` identical to the Stripe prices; the app shows those numbers.

How it's protected:
- A checkout can only be created by the signed-in person, for one of the two prices, with the trial only on the yearly price and only for 21 days (rules).
- The app never starts a second checkout while one is open (busy lock, reused session for 25 minutes) or while a subscription exists or needs payment.
- `paidPremium/{uid}` is a small mirror the organiser's app writes only when the token really has `stripeRole: premium`; it lets the rules allow the partner's Premium writes (notes, suggestions).

### 7. Legal pages

Fill in `legal` in [`js/config.js`](js/config.js) (name, address, email, VAT ID if any). [`legal.html`](legal.html) shows the imprint, privacy policy, terms and withdrawal, using the prices and trial from `billing`. It's a template: **have it checked by a lawyer before charging anyone.**

### 8. Security settings in the consoles (once)

- **Firebase → Authentication → Settings → User actions:** turn on **Email enumeration protection**.
- **Firebase → Authentication → Settings → Password policy:** require at least 8 characters (the app asks for 8).
- **Google Cloud → APIs & Services → Credentials → the Browser key:** under *Application restrictions* pick *Websites* and add `https://mefenir.github.io/*` and `http://localhost/*`. The key is public by design; this stops other sites from using your quota.
- **Admin account:** a long random password, and a username that isn't easy to guess.
- **GitHub → Settings → Code security:** turn on Dependabot alerts and secret scanning. **Settings → Branches:** protect `main` from force pushes.
- If the app ever moves away from `https://mefenir.github.io/taskmatch/`, update `appUrl()` in `firestore.rules`, or Stripe checkouts will be refused.

What the code already does: every value from the database is escaped before it reaches the page, and data the other person wrote is checked again when it arrives (`Household.sanitize`); a Content-Security-Policy blocks injected scripts; the app refuses to run inside someone else's frame; the rules check who may write what, the shape of joins/leaves, the size of requests and that checkouts go back to this app only. No secret keys are in the repository: the Stripe secret lives only inside the Firebase extension.

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
admin.html, js/admin.js  Admin panel: funnel and Premium requests
legal.html            Imprint, privacy, terms, withdrawal (reads js/config.js)
firestore.rules       Security rules
docs/PRODUCT_BRIEF.md Product spec
```

## Data model (Firestore)

| Path | What | Who can write |
|---|---|---|
| `users/{uid}` | email, display name, which household | that user |
| `households/{hid}` | organiser, members, partner name, rooms, children, pets, tasks (with times), suggestions, preferences, plan, swaps, completions, notes | organiser; partner only own preferences plus plan, swaps, ticks, (Premium) suggestions and notes |
| `invites/{code}` | household, expiry, who used it | members create; invitee redeems once |
| `subscriptions/{uid}` | `plan`, `active`, optional `expiresAt` | admin only |
| `premiumRequests/{uid}` | name, email, household size, status (`pending` / `approved` / `denied` / `revoked`) | the person asks; admin decides |
| `customers/{uid}/…` | Stripe customer, checkout sessions, subscriptions, payments | the person creates checkout sessions; the rest only the Stripe extension |
| `products`, `prices` | synced from Stripe | the Stripe extension |
| `paidPremium/{uid}` | `active`, `expiresAt` mirror of a paid subscription | that person, only with `stripeRole: premium` in the token |
| `metrics/{hid}` | funnel step times, active days | household members; read by admin |
| `admins/{uid}` | `role: admin` | Firebase console only |

A responsibility is **not** an assignment: selected responsibilities carry no owner, frequency or preference yet.

## Known limits of this version

- One household per person.
- A household has two people (organiser and partner).
- Preferences are hidden in the app but stored in the shared household data (the split runs on your phones). Making them truly private needs a server function (Firebase Blaze plan).
- If two people change the *same* list at the *same* second, the last save wins.
- A trial is refused by the app to anyone who has had a subscription; a deliberately modified app could still ask Stripe for a second trial. Acceptable for now; a server function can close it later.
- The security rules can't be tested automatically here; publish them and try a purchase in Stripe test mode before going live.
