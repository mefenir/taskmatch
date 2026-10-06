# Our Household

A calm, shared household app for couples and households. It makes the invisible household workload visible first, then helps you organise it together.

Static site (HTML, CSS, plain JavaScript), Firebase for sign-in and data, hosted on GitHub Pages. No build step.

The full product spec is in [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md). Read it before changing product behaviour.

## How it works

**Discover first. Allocate second. Start together with a subscription.**

1. **The organiser sets up alone** (5 short steps): names, your home (rooms, children, pets, garden, car), the tasks your home needs, how often and how long, and the organiser's own answers (❤️ happy to do it · 🙂 don't mind · 🙃 rather not; unmarked = 🙂).
2. **A draft plan straight away**, with the household's weekly hours, each person's share and a "who does most of it today" baseline. Nobody waits for anyone. All of this is free.
3. **Subscribe, then invite.** The plans screen comes next (yearly with 21 days free, or monthly). Right after subscribing, the app offers the invite: a native share with ready text and a one-time link.
4. **The partner** opens the link, sees "{organiser} made a plan for your home" and marks only what they disagree with, on one screen.
   - Nothing marked → **Looks good, let's start**: the plan is active.
   - Something marked → **Rebalance with my answers**: a fair split from both answers, then both say yes.
5. **Two tabs once the plan runs:**
   - **Me and Us**: two tabs with one look. **Me** is what I do and tick: *Today* (daily tasks), *This week* (several times a week as "1 of 3", weekly, and two-weekly or monthly tasks in the week they're due; done whenever suits, never "late") and *Anytime* (occasional and as needed, with when it was last done). **Us** is the household at a glance and nothing is ticked there: each person's share of the week, anything that needs you, the board, and the tasks by category (closed until tapped) with a round initial for who has each. Tapping a task lights the row and opens its sheet: who has it, what it includes, Swap, Break into parts / Suggest a breakdown, I'll take it, Remove. The app owns the calendar: nobody picks days.
   - **Settings** (gear, top right): You (name, sign-in, my answers), Our home (people and invite, your home, tasks, times, reshuffle; the partner gets "Suggest a change"), Subscription, Help & legal, then Sign out and, apart, Leave household / Delete household / Delete my account. Every row shows its current state.

**Leaving and deleting**
- *Partner leaves:* their answers, notes, suggestions and pending swaps are removed; their ticks stay without a name; the organiser is back to a draft and can invite again.
- *Organiser leaves while the partner stays:* the partner becomes the organiser (handover) and is told so. The subscription belongs to a person, so it doesn't move; if it still renews, the app offers "Cancel my subscription, then leave" (Stripe portal, then straight back to finish) or "Leave and keep my subscription".
- *Delete household* (organiser): gone for both; the partner is told. Same subscription choice.
- *Delete my account* (anyone, also from the start screen): leaves or hands over (or deletes the household if alone), deletes the invites they made, their access request, their profile and their sign-in. A renewing subscription must be cancelled first. Firebase needs a recent sign-in, so after a few minutes the app asks to sign in again and then continues.
- Invites stop working once the person who made them has left, and leaving deletes their unused invites.
   Before the plan runs, the plan screen (same task list, categories open) is the only screen. New tasks in a running plan show under Needs you as "waiting to be shared out" and go out together (both rate, fair split, both say yes). **Reshuffle** gives a fresh split after asking the other person.

The fair split (`js/plan.js`) shares by weekly effort (time × frequency), not by count. Clear oppositions (❤️ vs 🙃) go to the person who likes it; the rest is balanced. The same answers always give the same plan; the organiser is the tie-break, so the plan doesn't change when the partner joins.

Vocabulary used everywhere: **task**, **part** (a task broken into smaller tasks), **organiser** (who created the household and holds the subscription).

Every button gives instant feedback (press animation); async actions show a spinner and are locked until they finish, and repeated taps are ignored, so nothing — above all a purchase — can run twice.

## Free draft, then one subscription

There is no Free tier. Setting up and seeing the draft plan is free; inviting the partner and using the plan together needs a subscription, and then everything is on: the plan, swaps, daily lists, weekly time per person, the board, breaking tasks into parts, own tasks, partner suggestions.

- **Price:** € 4.99 / month (no trial, charged from day one), or € 39.99 / year (shown as € 3.33 / month, billed yearly) with a **21-day free trial**, once per person.
- The subscription belongs to the **organiser** and covers both people. The partner never pays and never sees a checkout.
- **When it ends**, the household is paused for both: the plans screen replaces the app (the partner sees "{organiser}'s subscription has ended"). Nothing is deleted; restarting brings everything back as it was, including anything that was half-way.
- A failed renewal (`past_due`) keeps the household running while Stripe retries and shows "Fix payment".
- If the subscription can't be read (offline, a hiccup), the app never says "ended": it shows a neutral "checking" screen and retries by itself.
- The organiser manages or cancels in the Stripe customer portal (Settings → Your subscription → Manage or cancel subscription).
- Two sources give access, merged in `Entitlements.effective()`: a Stripe subscription (`customers/{uid}/subscriptions`) or a gift from the admin panel (`subscriptions/{uid}`). While no Stripe prices are configured, the plans screen shows **Request access** (requests go to the admin panel).
- The subscription is checked by the app. The security rules protect who may change what; they don't check payment (a modified app could use the plan without paying, but never touch someone else's data).

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
- only the organiser edits the household, its list and the times; the partner can answer their *own* preferences, say yes to the plan, swap and tick tasks off, suggest changes and write board notes,
- people can only join with a valid, unused, unexpired invite,
- members can leave; only the owner can delete,
- nobody can give themselves access, and checkouts only use the two configured prices.

### 4. Turn on GitHub Pages

On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.

The app is live at `https://mefenir.github.io/taskmatch/` a minute or two later. Every push to `main` redeploys it.

### 5. Admin panel (funnel, access requests, feedback, errors)

The panel is at **`https://mefenir.github.io/taskmatch/admin.html`**. It isn't linked from the app.

One-time setup:
1. **Firebase → Authentication → Users → Add user.** Pick a username in email form (it doesn't need a real inbox), e.g. `admin@taskmatch.app`, and a strong password. Copy the new **User UID**.
2. **Firestore → Data → Start collection** `admins` → Document ID = that UID → field `role` (string) = `admin` → Save.
3. Make sure the latest `firestore.rules` are published.

Then sign in on `admin.html` with that username and password.

**Funnel** shows, for the last 30 / 90 days or all time, how many people and households reached each step: signed up (partners who joined by invite not counted) → started setting up → described their home → picked tasks → set their times → saw their plan → saw the plans → asked for access → opened checkout → subscribed → invited → partner joined → partner reviewed → plan started. Each row shows its % of its parent step (access, checkout, subscribed and plans are measured against "saw their plan"), and how many were still used 7 days after starting. Tap a row to see who reached it. Data comes from `metrics/{hid}` (step times and active days only, no names or content).

**Journey** shows the main path as bars (the biggest drop highlighted), one row per couple with a progress bar, current stage and last active day (tap for names and emails), and a 21-day activity grid with "Active in the last 7 days: X of Y couples".

**Automatic approval** (switch at the top of Access requests, stored in `config/beta`): while on, anyone who taps Request access is approved at once and marked "Unlocked automatically" (still revocable). It only affects new requests. Turn it off once the beta testers are in. Needs the latest `firestore.rules` published.

**Access requests** shows every request, filtered by **Waiting / Unlocked / Closed / All**:
- **Unlock** gives the requester's household access without paying (writes `subscriptions/{uid}`), for gifts and tests.
- **Deny** turns the request down; they can ask again later.
- **Revoke** ends it; the household is paused for both at once.

**Feedback** lists the notes people send from **Settings → Send feedback**: their name, the note, the screen they came from and the app version. Filter **New / Done / All**; **Mark as done** once handled.

**Errors** lists crashes on people's phones, grouped by message: how many times, how many people (and who), which screens and versions, and the technical details. The app reports uncaught errors, failed promises, broken buttons and failed saves, at most 5 different ones per visit, only while signed in. **Clear** removes a group once it's fixed.

Only accounts listed in `admins` can see requests, feedback or errors, or give access; the rules enforce it, not just the page.

### 6. Payments with Stripe

Needs the Firebase **Blaze** plan (pay as you go; the free quota covers a small app).

1. **Stripe → Products → Add product** "Our Household" with two **recurring** prices: **€ 4.99 monthly** and **€ 39.99 yearly**. Don't set a default trial on either price — the app asks for the 21-day trial only on the yearly checkout.
2. **Firebase → Extensions → Run Payments with Stripe** (`stripe/firestore-stripe-payments`). Settings: customers collection `customers`, products collection `products`, sync new users: yes. If the extension offers it, turn on **deleting Stripe customer data when a user is deleted** (so "Delete my account" also clears the customer in Stripe). Note the **region** you pick.
3. Copy the webhook URL the extension shows into **Stripe → Developers → Webhooks**, with the events the extension lists (product, price, checkout.session.completed, customer.subscription.*, invoice.*…). Put the signing secret back into the extension.
4. **Stripe → Settings → Billing → Customer portal**: allow cancelling and updating the payment method.
5. **Stripe → Settings → Billing → Subscriptions and emails**: turn on the **reminder email before a trial ends** (required in the EU) and emails for failed payments.
6. Paste the two price IDs in **both** places:
   - [`js/config.js`](js/config.js) → `billing.prices.monthly` / `yearly` (and `functionsRegion` = the extension region),
   - [`firestore.rules`](firestore.rules) → `monthlyPrice()` / `yearlyPrice()` — then **publish the rules again**.
7. Keep `billing.display` in `config.js` identical to the Stripe prices; the app shows those numbers.

How it's protected:
- A checkout can only be created by the signed-in person, for one of the two prices, with the trial only on the yearly price and only for 21 days (rules).
- The app never starts a second checkout while one is open (busy lock, reused session for 25 minutes) or while a subscription exists or needs payment.

### 7. Legal pages

Fill in `legal` in [`js/config.js`](js/config.js) (name, address, email, VAT ID if any). [`legal.html`](legal.html) shows the imprint, privacy policy, terms and withdrawal, using the prices and trial from `billing`. It's a template: **have it checked by a lawyer before charging anyone.**

### 8. Security settings in the consoles (once)

- **Firebase → Authentication → Settings → User actions:** turn on **Email enumeration protection**.
- **Firebase → Authentication → Settings → Password policy:** require at least 8 characters (the app asks for 8).
- **Google Cloud → APIs & Services → Credentials → the Browser key:** under *Application restrictions* pick *Websites* and add `https://mefenir.github.io/*`, `https://taskmatch-c51d2.firebaseapp.com/*` (Google sign-in runs on this Firebase page, so it must be allowed too) and `http://localhost/*`. The key is public by design; this stops other sites from using your quota.
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
js/entitlements.js    Does the household have a subscription — the only place it's checked
js/plan.js            The fair split, recurring schedule, swap messages (no DOM, no Firebase)
js/household.js       Household domain logic (no DOM, no Firebase)
js/backend.js         All Firebase Auth + Firestore calls
js/ui.js              Shared UI pieces: rows, steppers, sheets, toast
js/screens.js         Screens and sheets (HTML from state)
js/app.js             State, auth flow, live sync, actions, router
admin.html, js/admin.js  Admin panel: funnel and access requests
legal.html            Imprint, privacy, terms, withdrawal (reads js/config.js)
firestore.rules       Security rules
docs/PRODUCT_BRIEF.md Product spec
```

## Data model (Firestore)

| Path | What | Who can write |
|---|---|---|
| `users/{uid}` | email, display name, which household, codes of invites they made | that user (and deletes it with their account) |
| `households/{hid}` | organiser, members, partner name, rooms, children, pets, tasks (with times), suggestions, preferences, plan, swaps, completions, notes | organiser; partner only own preferences plus plan, swaps, ticks, suggestions and notes |
| `invites/{code}` | household, expiry, who used it | members create; invitee redeems once |
| `subscriptions/{uid}` | `plan`, `active`, optional `expiresAt` | admin only |
| `premiumRequests/{uid}` | name, email, household size, status (`pending` / `approved` / `denied` / `revoked`) | the person asks; admin decides |
| `customers/{uid}/…` | Stripe customer, checkout sessions, subscriptions, payments | the person creates checkout sessions; the rest only the Stripe extension |
| `products`, `prices` | synced from Stripe | the Stripe extension |
| `metrics/{hid}` | funnel step times, active days | household members; read by admin |
| `feedback/{id}` | name, household, note, screen, version, status (`new` / `done`) | anyone signed in sends as themselves; admin reads and marks; the sender can delete their own |
| `errors/{id}` | name, error message, stack, screen, version, browser | anyone signed in reports as themselves; admin reads and clears; the sender can delete their own |
| `admins/{uid}` | `role: admin` | Firebase console only |

A responsibility is **not** an assignment: selected responsibilities carry no owner, frequency or preference yet.

## Known limits of this version

- One household per person.
- A household has two people (organiser and partner).
- Preferences are hidden in the app but stored in the shared household data (the split runs on your phones). Making them truly private needs a server function (Firebase Blaze plan).
- If two people change the *same* list at the *same* second, the last save wins.
- A trial is refused by the app to anyone who has had a subscription; a deliberately modified app could still ask Stripe for a second trial. Acceptable for now; a server function can close it later.
- Feedback and error reports are capped in size, but the rules can't limit how many a signed-in person sends; the app sends at most 5 error reports per visit. Fine for a beta; a server function can add a real limit later.
- The security rules can't be tested automatically here; publish them and try a purchase in Stripe test mode before going live.

**Room-based times**: the bathroom task is timed per bathroom (shown on the Times screen as "Time for each bathroom"); the total is that time × the number of bathrooms, and the fair split uses the total. Parts scale the same way.

**Needs you** (on Us) only holds things you act on: a swap offer, a reshuffle request, rating or approving new tasks, suggestions to decide (organiser), new tasks to share out (organiser), a payment problem. Results that need no action (a swap's outcome, a declined reshuffle) have a Dismiss button. Nothing about waiting for the other person. When it's empty, a calm line ("All clear. Nothing needs you right now."), one per day. Tasks nobody has show as "N without anyone" on their category.

**Text**: every screen keeps a sentence together when it doesn't fit on the rest of a line, and a block never ends with one word alone (tidyText in util.js; headings use text-wrap: balance and never break at a hyphen).

**Layout details**: on Us the board comes right after each person's share, then Needs you (a quiet grey line when there's nothing). The settings gear sits level with the first line of each screen. Open categories on Us show their tasks on a slightly darker shade. A round up-arrow appears bottom right once a page is scrolled, above the tabs. Settings → Your name opens a sheet to change it (both people; the rules let the partner change only their own name).

**Admin funnel**: tap a step to list the households that reached it, with each person's name and email and when they got there; "stopped here" marks where a household's progress ends. (The admin can read users/{uid} for this.)

**Settings order**: You (Your name, Signed in as — plain text, My answers before the plan runs, Your subscription) · Our home (People, then for the organiser Your home / Tasks / Times, Suggest a change to the list for the partner, Reshuffle the plan) · Help & legal (Send feedback, Imprint…, Contact) · Change password (email accounts only, asks for the current one) and Sign out · Leave household / Delete household / Delete my account. Anything opened from Settings returns there with its back arrow or Done. The admin panel has Change password next to Sign out.
