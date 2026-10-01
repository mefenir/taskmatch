'use strict';

/* =========================================================
   SCREENS — each returns HTML for the current state `S`
   (state lives in app.js). No data writes happen in here.
   ========================================================= */
const houseArt = `<div class="welcome-art" aria-hidden="true">
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <rect width="72" height="72" rx="20" fill="var(--accent-soft)"/>
    <path d="M20 34L36 21l16 13v17a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V34z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M31 53V42h10v11" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
  </svg>
</div>`;

const Screens = {
  loading() {
    return `<main class="screen center-screen" aria-busy="true"><div class="spinner" aria-hidden="true"></div>
      <p class="lead" style="margin-top:16px">Loading…</p></main>`;
  },

  setup() {
    return `<main class="screen">
      ${houseArt}
      <h1>Almost there</h1>
      <p class="lead">This copy of the app isn't connected to Firebase yet. Add your project's web config to <code>js/config.js</code> — the README walks through it.</p>
    </main>`;
  },

  error() {
    return `<main class="screen">
      ${houseArt}
      <h1>Something went wrong</h1>
      <p class="lead">${esc(S.fatal || "We couldn't load your household.")}</p>
      <div class="bottom-bar"><button class="btn primary" data-action="reload">Try again</button>
      <button class="btn ghost" data-action="signOut">Sign out</button></div>
    </main>`;
  },

  /* ---------- Signed out ---------- */
  welcome() {
    const invited = !!S.pendingInvite;
    return `<main class="screen welcome">
      ${houseArt}
      <h1>${invited ? "You've been invited to a household" : 'Run your home, together.'}</h1>
      <p class="lead">${invited
        ? 'Create an account or sign in to join. You\'ll see everything your household has set up so far.'
        : 'First, make the work of your household visible. Who does what comes later.'}</p>
      ${invited ? '' : `<ol class="how">
        <li>Tell us a little about your home</li>
        <li>Pick what needs to happen</li>
        <li>Invite your partner and see it all in one place</li>
      </ol>`}
      <div class="bottom-bar">
        <button class="btn primary" data-action="authMode" data-mode="signup">${invited ? 'Create account and join' : 'Get started'}</button>
        <button class="btn ghost" data-action="authMode" data-mode="signin">I already have an account</button>
      </div>
    </main>`;
  },

  auth() {
    const mode = S.auth.mode;
    const titles = { signup: 'Create your account', signin: 'Welcome back', reset: 'Reset your password' };
    const busy = S.auth.busy ? 'disabled' : '';
    const v = S.auth.values;
    const err = S.auth.error ? `<p class="form-error" role="alert">${esc(S.auth.error)}</p>` : '';
    const note = S.auth.note ? `<p class="form-note" role="status">${esc(S.auth.note)}</p>` : '';
    const field = (name, label, type, auto, extra = '') => `<div class="field">
        <label for="f-${name}">${label}</label>
        <input id="f-${name}" name="${name}" type="${type}" autocomplete="${auto}" value="${esc(v[name] || '')}" data-auth-field="${name}" ${extra}>
      </div>`;

    const google = mode === 'reset' ? '' : `
      <button class="btn google" data-action="google" ${busy}>${Icon.google} Continue with Google</button>
      <div class="divider">or with email</div>`;

    const fields = mode === 'reset'
      ? field('email', 'Email', 'email', 'email', 'required inputmode="email"')
      : (mode === 'signup' ? field('name', 'Your name', 'text', 'given-name', 'maxlength="40"') : '') +
        field('email', 'Email', 'email', 'email', 'required inputmode="email"') +
        field('password', 'Password', 'password', mode === 'signup' ? 'new-password' : 'current-password',
          `required minlength="${APP_CONFIG.minPasswordLength}"`);

    const submit = { signup: 'Create account', signin: 'Sign in', reset: 'Send reset link' }[mode];
    const links = {
      signup: `<p class="switch-link">Already have an account? <button class="link-btn" data-action="authMode" data-mode="signin">Sign in</button></p>`,
      signin: `<p class="switch-link"><button class="link-btn" data-action="authMode" data-mode="reset">Forgot password?</button></p>
               <p class="switch-link">New here? <button class="link-btn" data-action="authMode" data-mode="signup">Create an account</button></p>`,
      reset:  `<p class="switch-link"><button class="link-btn" data-action="authMode" data-mode="signin">Back to sign in</button></p>`,
    }[mode];

    return `<main class="screen">
      ${topbar({ back: 'welcome' })}
      <h1>${titles[mode]}</h1>
      ${S.pendingInvite ? `<p class="lead">You'll join your household straight after.</p>` : '<p class="lead" style="margin-bottom:20px"></p>'}
      ${err}${note}
      ${google}
      <form class="auth-form" data-form="auth" novalidate>
        ${fields}
        <button class="btn primary" type="submit" style="margin-top:20px" ${busy}>${S.auth.busy ? 'Please wait…' : submit}</button>
      </form>
      ${links}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },

  /* ---------- Signed in, no household ---------- */
  start() {
    return `<main class="screen welcome">
      <div class="topbar"><span class="spacer"></span>
        <button class="link-btn" data-action="signOut" style="margin:0">Sign out</button></div>
      ${houseArt}
      <h1>Hi${S.user && S.user.displayName ? ' ' + esc(S.user.displayName.split(' ')[0]) : ''}. Let's set up your household.</h1>
      <p class="lead">First, make the work of your household visible. Who does what comes later.</p>
      <ol class="how">
        <li>Tell us a little about your home</li>
        <li>Pick what needs to happen</li>
        <li>Invite your partner and see it all in one place</li>
      </ol>
      <div class="bottom-bar">
        <button class="btn primary" data-action="createHousehold" ${S.busy ? 'disabled' : ''}>Set up our household</button>
        <p class="fine">Joining someone else's household? Open the invite link they sent you.</p>
      </div>
    </main>`;
  },

  joining() {
    return `<main class="screen center-screen" aria-busy="true"><div class="spinner" role="img" aria-label="Joining"></div>
      <p class="lead" style="margin-top:16px">Joining your household…</p></main>`;
  },

  /* ---------- Household onboarding ---------- */
  members() {
    const h = S.household;
    const mine = Household.member(h, S.user.uid);
    const others = h.members.filter(m => m.uid !== S.user.uid);
    return `<main class="screen">
      ${topbar({ back: h.settings.onboarded ? 'inventory' : null, step: 'members' })}
      <h1>Who lives here?</h1>
      <p class="lead">Just names for now. Nobody gets any chores at this stage.</p>
      <div class="card">
        <div class="field">
          <label for="my-name">Your name</label>
          <input id="my-name" value="${esc(mine ? mine.name : '')}" placeholder="Your name" autocomplete="given-name" maxlength="40" data-input="myName">
        </div>
        ${others.map(m => `<div class="row static">
            <span class="avatar" aria-hidden="true">${esc(Household.memberName(m).charAt(0).toUpperCase())}</span>
            <div class="row-text"><span class="row-title">${esc(Household.memberName(m))}</span>
            <span class="row-sub">${m.role === 'owner' ? 'Set up this household' : 'Joined'}</span></div>
          </div>`).join('')}
      </div>
      <button class="btn ghost" data-action="invite">${Icon.plus} Invite ${others.length ? 'someone else' : 'your partner'}</button>
      <p class="fine" style="margin-top:0">You can also do this later.</p>
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="home">Continue</button></div>
    </main>`;
  },

  home() {
    const h = S.household;
    return `<main class="screen">
      ${topbar({ back: 'members', step: 'home' })}
      <h1>Your home</h1>
      <p class="lead">Rooms help us suggest what needs doing.</p>
      <div class="card">
        ${stepperRow('bedroom', 'Bedrooms', '', roomCount(h, 'bedroom'))}
        ${stepperRow('bathroom', 'Bathrooms', 'Including guest toilets', roomCount(h, 'bathroom'))}
      </div>
      <div class="card">
        ${switchRow('toggleRoom', 'kitchen', 'Kitchen', '', roomCount(h, 'kitchen') > 0)}
        ${switchRow('toggleRoom', 'living', 'Living room', '', roomCount(h, 'living') > 0)}
        ${switchRow('toggleRoom', 'office', 'Home office', '', roomCount(h, 'office') > 0)}
      </div>
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="circumstances">Continue</button></div>
    </main>`;
  },

  circumstances() {
    const h = S.household;
    const petTypes = [['dog', 'Dog'], ['cat', 'Cat'], ['other', 'Other pet']];
    const chips = `<button class="chip" data-action="clearPets" aria-pressed="${h.pets.length === 0}">None</button>` +
      petTypes.map(([t, l]) => `<button class="chip" data-action="togglePet" data-key="${t}" aria-pressed="${h.pets.some(p => p.type === t)}">${l}</button>`).join('');
    return `<main class="screen">
      ${topbar({ back: 'home', step: 'circumstances' })}
      <h1>Anything else in your household?</h1>
      <p class="lead">Only what changes the work that needs doing.</p>
      <div class="card">${stepperRow('children', 'Children', 'Adds childcare and school/Kita', h.children.length)}</div>
      <div class="card"><div class="row static col">
        <div class="row-text"><span class="row-title">Pets</span><span class="row-sub">Adds feeding, walks and vet visits</span></div>
        <div class="chips" role="group" aria-label="Pets">${chips}</div>
      </div></div>
      <div class="card">
        ${switchRow('toggleFlag', 'garden', 'Garden or outdoor space', '', !!h.circumstances.garden)}
        ${switchRow('toggleFlag', 'car', 'Car', '', !!h.circumstances.car)}
      </div>
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="responsibilities">Show what needs doing</button></div>
    </main>`;
  },

  responsibilities() {
    const h = S.household;
    const selected = Household.selectedLibraryIds(h);
    const groups = Household.discoveryGroups(h);
    const sections = groups.map(({ category, items }) => {
      const n = items.filter(i => selected.has(i.id)).length;
      const all = n === items.length;
      const rows = items.map(item => `<button class="row" data-action="toggleResp" data-id="${item.id}" aria-pressed="${selected.has(item.id)}">
          <span class="check" aria-hidden="true">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${esc(item.name)}</span></div>
        </button>`).join('');
      return `<section aria-labelledby="cat-${category.id}">
        <div class="section-head">
          <h2 class="section-title" id="cat-${category.id}">${esc(category.name)}</h2>
          <button class="link-btn" data-action="toggleCategory" data-cat="${category.id}">${all ? 'Clear' : 'Select all'}</button>
        </div>
        <div class="card">${rows}</div>
      </section>`;
    }).join('');
    const count = h.responsibilities.length;
    return `<main class="screen">
      ${topbar({ back: 'circumstances', step: 'responsibilities' })}
      <h1>What needs to happen in your household?</h1>
      <p class="lead" style="margin-bottom:0">Tick everything that applies. You're not deciding who does it yet.</p>
      ${sections}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${addOwnRow('Add your own responsibility', !Entitlements.canCreateCustomResponsibility(S.subscription))}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${count ? plural(count, 'responsibility', 'responsibilities') + ' selected' : 'Nothing selected yet'}</p>
        <button class="btn primary" data-action="confirmSelection" ${count ? '' : 'disabled'}>Continue</button>
      </div>
    </main>`;
  },

  inventory() {
    const h = S.household;
    const groups = Household.inventory(h);
    const total = h.responsibilities.length;
    const members = h.members.map(m => {
      const n = Household.memberName(m);
      const you = m.uid === S.user.uid ? ' <span class="you">(you)</span>' : '';
      return `<span class="member"><span class="avatar" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>${esc(n)}${you}</span>`;
    }).join('');
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="inv-${category.id}">
        <div class="section-head">
          <h2 class="section-title" id="inv-${category.id}">${esc(category.name)}</h2>
          <span class="section-meta">${items.length}</span>
        </div>
        <div class="card">${items.map(r => `<button class="row" data-action="openResponsibility" data-id="${r.id}">
            <div class="row-text"><span class="row-title">${esc(r.name)}</span></div>
            ${r.mentalLoad ? '<span class="tag">Mental load</span>' : ''}
            <span class="chev">${Icon.chev}</span>
          </button>`).join('')}</div>
      </section>`).join('');
    const alone = h.memberIds.length < 2;
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">Our household</h1>
      <div class="members">${members}</div>
      ${alone ? `<div class="card next-card">
          <h2>Invite your partner</h2>
          <p>Send them a link. They'll see everything here and can help decide who does what.</p>
          <button class="btn primary" data-action="invite">Create invite link</button>
        </div>` : ''}
      <div class="card">
        <div class="stats">
          <div class="stat"><b>${total}</b><span>${total === 1 ? 'Responsibility' : 'Responsibilities'}</span></div>
          <div class="stat"><b>${groups.length}</b><span>${groups.length === 1 ? 'Area' : 'Areas'}</span></div>
        </div>
        <div class="note">This is everything your home involves. Nothing is assigned to anyone yet.</div>
      </div>
      ${sections || `<div class="card"><div class="note" style="border:0">No responsibilities yet.</div></div>`}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${addOwnRow('Add your own responsibility', !Entitlements.canCreateCustomResponsibility(S.subscription))}
      <button class="btn secondary" data-action="nav" data-to="responsibilities">Edit responsibilities</button>
      <div class="card next-card" style="margin-top:24px">
        <h2>Next: who does what</h2>
        <p>Once you're both happy with this list, you'll decide together who usually takes care of each one.</p>
        <button class="btn primary" disabled>Coming in the next build</button>
      </div>
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },
};

/* =========================================================
   SHEETS
   ========================================================= */
const Sheets = {
  /** Premium prompt. Premium is paid by the household owner, so other members are pointed to them. */
  premium({ title, body }) {
    const h = S.household;
    const isOwner = Household.isOwner(h, S.user.uid);
    const ownerName = Household.memberName(Household.owner(h));
    const cta = isOwner
      ? `<button class="btn premium" data-action="upgrade">Unlock Premium</button>
         <button class="btn ghost" data-action="closeSheet">Not now</button>`
      : `<p style="margin-top:-8px">Premium is linked to ${esc(ownerName)}'s account and covers everyone in your household. Ask ${esc(ownerName)} to upgrade.</p>
         <button class="btn secondary" data-action="closeSheet">Got it</button>`;
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      ${cta}`, title);
  },

  confirm() {
    const h = S.household;
    const groups = Household.inventory(h);
    const total = h.responsibilities.length;
    Sheet.open(`<h2>Here's what your household has</h2>
      <p>${plural(total, 'responsibility', 'responsibilities')} across ${plural(groups.length, 'area')}. Nothing is assigned to anyone yet.</p>
      <ul class="summary">${groups.map(g => `<li><span>${esc(g.category.name)}</span><span>${g.items.length}</span></li>`).join('')}</ul>
      <button class="btn primary" data-action="finishSetup">Looks right</button>
      <button class="btn ghost" data-action="closeSheet">Keep editing</button>`, 'Confirm responsibilities');
  },

  /** Shown once to someone who just joined through an invite. */
  joined() {
    const h = S.household;
    const groups = Household.inventory(h);
    const ownerName = Household.memberName(Household.owner(h));
    const body = h.settings.onboarded
      ? `<p>${esc(ownerName)} has set up ${plural(h.responsibilities.length, 'responsibility', 'responsibilities')} so far. Have a look, change anything that's missing, and then you'll decide together who does what.</p>
         <ul class="summary">${groups.map(g => `<li><span>${esc(g.category.name)}</span><span>${g.items.length}</span></li>`).join('')}</ul>`
      : `<p>${esc(ownerName)} is still setting things up. You can carry on from here together.</p>`;
    Sheet.open(`<h2>Here's what your household currently has</h2>${body}
      <button class="btn primary" data-action="closeSheet">Take a look</button>`, 'Welcome to your household');
  },

  invite(state) {
    if (state === 'loading') {
      Sheet.open(`<h2>Invite your partner</h2><p>Creating a link…</p>`, 'Invite');
      return;
    }
    if (state && state.error) {
      Sheet.open(`<h2>Invite your partner</h2><p>${esc(state.error)}</p>
        <button class="btn secondary" data-action="invite">Try again</button>
        <button class="btn ghost" data-action="closeSheet">Close</button>`, 'Invite');
      return;
    }
    const canShare = typeof navigator.share === 'function';
    Sheet.open(`<h2>Invite your partner</h2>
      <p>Send this link. They create an account (or sign in) and join your household straight away.</p>
      <div class="link-box"><code>${esc(state.link)}</code></div>
      ${canShare ? `<button class="btn primary" data-action="shareInvite" data-link="${esc(state.link)}">Share link</button>` : ''}
      <button class="btn ${canShare ? 'secondary' : 'primary'}" data-action="copyInvite" data-link="${esc(state.link)}">${Icon.copy} Copy link</button>
      <p class="fine">Works once and expires in ${APP_CONFIG.inviteValidDays} days.</p>`, 'Invite');
  },

  menu() {
    const h = S.household;
    const isOwner = Household.isOwner(h, S.user.uid);
    const premium = Entitlements.isPremium(S.subscription);
    const ownerName = Household.memberName(Household.owner(h));
    const plan = premium ? (isOwner ? 'Premium' : `Premium via ${ownerName}`) : 'Free';
    Sheet.open(`<h2>Household</h2>
      <div class="plan-line"><span>Plan</span><span>${esc(plan)}</span></div>
      <div class="plan-line"><span>Signed in as</span><span>${esc(S.user.email || '')}</span></div>
      <button class="btn secondary" data-action="sheetNav" data-to="members">Edit household setup</button>
      <button class="btn secondary" data-action="sheetNav" data-to="responsibilities">Edit responsibilities</button>
      <button class="btn secondary" data-action="invite">Invite someone</button>
      <button class="btn ghost" data-action="signOut">Sign out</button>
      ${isOwner
        ? `<button class="btn ghost text-danger" data-action="confirmDelete">Delete household</button>`
        : `<button class="btn ghost text-danger" data-action="confirmLeave">Leave household</button>`}`, 'Household options');
  },

  confirmDelete() {
    Sheet.open(`<h2>Delete this household?</h2>
      <p>This removes the household and its responsibilities for everyone in it. It can't be undone.</p>
      <button class="btn danger" data-action="deleteHousehold">Delete household</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Delete household');
  },

  confirmLeave() {
    const ownerName = Household.memberName(Household.owner(S.household));
    Sheet.open(`<h2>Leave this household?</h2>
      <p>Everything stays as it is for the others. You'd need a new invite from ${esc(ownerName)} to come back.</p>
      <button class="btn danger" data-action="leaveHousehold">Leave household</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Leave household');
  },

  notice(title, body) {
    Sheet.open(`<h2>${esc(title)}</h2><p>${esc(body)}</p>
      <button class="btn primary" data-action="closeSheet">OK</button>`, title);
  },
};
