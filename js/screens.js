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
      ${S.fatalCode ? `<p class="fine" style="text-align:left">Error code: ${esc(S.fatalCode)}</p>` : ''}
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
        <button class="btn primary" data-action="nav" data-to="frequency" ${count ? '' : 'disabled'}>Continue</button>
      </div>
    </main>`;
  },

  /* ---------- Owner: how often and how long ---------- */
  frequency() {
    const h = S.household;
    const setup = !h.settings.onboarded;
    const stage = Household.stage(h);
    const groups = Household.inventory(h);
    const freqOptions = sel => FREQUENCIES.map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${f.label}</option>`).join('');
    const minuteOptions = sel => {
      const opts = MINUTE_OPTIONS.includes(sel) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, sel].sort((a, b) => a - b);
      return opts.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${formatMinutes(m)}</option>`).join('');
    };
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="fq-${category.id}">
        <div class="section-head"><h2 class="section-title" id="fq-${category.id}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => {
          const t = Timing.of(r);
          return `<div class="timing-row">
            <span class="row-title" id="t-${r.id}">${esc(r.name)}</span>
            <div class="timing-controls">
              <select class="select" data-change="frequency" data-id="${r.id}" aria-label="How often: ${esc(r.name)}">${freqOptions(t.frequency)}</select>
              <select class="select minutes" data-change="minutes" data-id="${r.id}" aria-label="How long each time: ${esc(r.name)}">${minuteOptions(t.minutes)}</select>
            </div>
          </div>`;
        }).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      ${setup ? topbar({ back: 'responsibilities', step: 'frequency' }) : topbar({ back: stage === 'plan' ? 'plan' : 'inventory' })}
      <h1>How often, and how long?</h1>
      <p class="lead" style="margin-bottom:0">We've filled in what's typical for a household. Change anything that's different in yours.</p>
      ${stage === 'plan' ? `<p class="form-note" style="margin-top:16px">Changing these re-balances the plan, and any swaps start over.</p>` : ''}
      ${sections}
      <div class="bottom-bar">
        ${setup
          ? `<button class="btn primary" data-action="confirmSelection">Continue</button>`
          : `<button class="btn primary" data-action="nav" data-to="${stage === 'plan' ? 'plan' : 'inventory'}">Done</button>`}
      </div>
    </main>`;
  },

  /* ---------- Members who aren't the owner ---------- */
  waiting() {
    const h = S.household;
    const ownerName = Household.memberName(Household.owner(h));
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      ${houseArt}
      <h1>${esc(ownerName)} is setting up your household</h1>
      <p class="lead">You'll see the list of what your home involves here as soon as it's ready. Then you can look through it and agree to it.</p>
      <div class="members">${memberChips(h)}</div>
    </main>`;
  },

  review() {
    const h = S.household;
    const me = S.user.uid;
    const ownerName = Household.memberName(Household.owner(h));
    const state = Household.agreementState(h, me);
    const suggesting = S.suggestMode && Entitlements.canSuggestChanges(S.subscription);
    const groups = Household.inventory(h);

    const lead = {
      pending: `${esc(ownerName)} put this list together. If it matches your home, agree to it. Nothing is assigned to anyone yet.`,
      changed: `${esc(ownerName)} has changed the list since you agreed. Have another look.`,
      agreed: `You've agreed to this list. ${esc(ownerName)} can still change it.`,
    }[state];

    const sections = groups.map(({ category, items }) => `<section aria-labelledby="rv-${category.id}">
        <div class="section-head"><h2 class="section-title" id="rv-${category.id}">${esc(category.name)}</h2>
          <span class="section-meta">${items.length}</span></div>
        <div class="card">${items.map(r => {
          const sug = Household.suggestionFor(h, me, 'remove', r.id);
          return suggesting
            ? `<button class="row" data-action="suggest" data-type="remove" data-id="${r.id}" aria-pressed="${!!sug}">
                <div class="row-text"><span class="row-title" ${sug ? 'style="text-decoration:line-through;color:var(--muted)"' : ''}>${esc(r.name)}</span></div>
                <span class="${sug ? 'badge' : 'tag'}">${sug ? 'Suggested: remove' : 'Suggest removing'}</span>
              </button>`
            : `<div class="row static"><div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
                ${sug ? '<span class="badge">Suggested: remove</span>' : (r.mentalLoad ? '<span class="tag">Mental load</span>' : '')}</div>`;
        }).join('')}</div>
      </section>`).join('');

    // Things that could be added: relevant library items the list doesn't have yet.
    const selected = Household.selectedLibraryIds(h);
    const addable = Household.discoveryGroups(h)
      .map(g => ({ ...g, items: g.items.filter(i => !selected.has(i.id)) }))
      .filter(g => g.items.length);
    const addSection = suggesting && addable.length ? `
      <div class="section-head"><h2 class="section-title">Suggest adding</h2></div>
      <p class="fine" style="text-align:left;margin:-4px 4px 12px">${esc(ownerName)} decides whether to add these.</p>
      ${addable.map(({ category, items }) => `<div class="section-head" style="margin-top:12px"><h3 class="section-meta" style="margin:0">${esc(category.name)}</h3></div>
        <div class="card">${items.map(i => {
          const sug = Household.suggestionFor(h, me, 'add', i.id);
          return `<button class="row" data-action="suggest" data-type="add" data-id="${i.id}" aria-pressed="${!!sug}">
              <span class="check" aria-hidden="true" ${sug ? '' : 'style="color:var(--muted)"'}>${Icon.plus}</span>
              <div class="row-text"><span class="row-title">${esc(i.name)}</span></div>
              ${sug ? '<span class="badge">Suggested</span>' : ''}
            </button>`;
        }).join('')}</div>`).join('')}` : '';

    const mine = Household.suggestions(h).filter(x => x.by === me);
    const locked = !Entitlements.canSuggestChanges(S.subscription);
    const bottom = suggesting
      ? `<p class="count">${mine.length ? `${plural(mine.length, 'suggestion')} sent to ${esc(ownerName)}` : 'Tap anything to suggest a change'}</p>
         <button class="btn primary" data-action="doneSuggesting">Done</button>`
      : `${state === 'agreed' ? '' : `<button class="btn primary" data-action="agree">Agree to this list</button>`}
         <button class="btn secondary" data-action="suggestChanges">Suggest changes ${locked ? `<span class="badge">${Icon.sparkSm} Premium</span>` : ''}</button>
         ${state === 'agreed' ? `<button class="btn ghost" data-action="nav" data-to="inventory">Back to overview</button>` : ''}`;

    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${suggesting ? 'Suggest changes' : "Here's what your household currently has"}</h1>
      <p class="lead" style="margin-bottom:8px">${suggesting ? `Tap a responsibility to suggest removing it, or add one below. ${esc(ownerName)} decides.` : lead}</p>
      <div class="members">${memberChips(h)}</div>
      ${sections || `<div class="card"><div class="note" style="border:0">The list is empty so far.</div></div>`}
      ${addSection}
      <div class="bottom-bar">${bottom}</div>
    </main>`;
  },

  /* ---------- Everyone: how do you feel about each one ---------- */
  preferences() {
    const h = S.household;
    const me = S.user.uid;
    const values = Household.prefs(h, me).values || {};
    const groups = Household.inventory(h);
    const answered = h.responsibilities.filter(r => values[r.id]).length;
    const total = h.responsibilities.length;
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="pf-${category.id}">
        <div class="section-head"><h2 class="section-title" id="pf-${category.id}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => `<div class="pref-row" role="group" aria-labelledby="pn-${r.id}">
            <div class="row-text"><span class="row-title" id="pn-${r.id}">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
            <div class="pref-group">${PREFERENCES.map(p => `<button class="pref-btn" data-action="setPref" data-id="${r.id}" data-key="${p.id}" aria-pressed="${values[r.id] === p.id}" aria-label="${p.label}" title="${p.label}">${p.emoji}</button>`).join('')}</div>
          </div>`).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">How do you feel about each one?</h1>
      <p class="lead" style="margin-bottom:12px">Only you see your answers. They help split things fairly.</p>
      <div class="legend">${PREFERENCES.map(p => `<span>${p.emoji} ${p.label}</span>`).join('')}</div>
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${answered} of ${total} answered</p>
        ${answered < total && answered > 0 ? `<button class="btn ghost" data-action="fillPrefs">Mark the rest 🙂 Don't mind</button>` : ''}
        <button class="btn primary" data-action="submitPrefs" ${answered < total ? 'disabled' : ''}>Done</button>
      </div>
    </main>`;
  },

  prefsDone() {
    const h = S.household;
    const waitingFor = h.members.filter(m => m.uid !== S.user.uid && !Household.prefsComplete(h, m.uid)).map(m => esc(Household.memberName(m)));
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      ${houseArt}
      <h1>Thanks, you're done</h1>
      <p class="lead">As soon as ${waitingFor.join(' and ') || 'everyone'} has answered too, the app splits everything fairly and shows you the plan.</p>
      <div class="bottom-bar">
        <button class="btn secondary" data-action="editPrefs">Change my answers</button>
        <button class="btn ghost" data-action="nav" data-to="inventory">See the household list</button>
      </div>
    </main>`;
  },

  /* ---------- The plan: who does what ---------- */
  plan() {
    const h = S.household;
    const me = S.user.uid;
    const active = h.plan && h.plan.status === 'active';
    const others = h.members.filter(m => m.uid !== me);
    const mine = Household.tasksOf(h, me);
    const loads = Household.loads(h);

    const row = (r, own) => {
      const pending = Household.pendingFor(h, r.id);
      const right = own && others.length
        ? (pending ? '<span class="tag">Swap asked</span>' : `<button class="mini" data-action="askSwap" data-id="${r.id}">Swap</button>`)
        : '';
      return `<div class="row static"><div class="row-text"><span class="row-title">${esc(r.name)}</span>
        <span class="row-sub">${esc(Timing.label(r))}</span></div>${right}</div>`;
    };
    const list = (title, items, own) => `<div class="section-head"><h2 class="section-title">${title}</h2><span class="section-meta">${items.length}</span></div>
      <div class="card">${items.length ? items.map(r => row(r, own)).join('') : '<div class="note" style="border:0">Nothing here.</div>'}</div>`;

    const balance = Entitlements.canSeeTimeTotals(S.subscription)
      ? `<div class="card"><div class="balance" style="flex-direction:column;align-items:stretch;gap:6px">${h.members.map(m =>
          `<div style="display:flex;justify-content:space-between"><span>${esc(m.uid === me ? 'You' : Household.memberName(m))}</span><span class="sub">about ${formatMinutes(loads[m.uid] || 0)} a week</span></div>`).join('')}</div></div>`
      : `<div class="card"><button class="row" data-action="timeTotals">
          <span class="chev" style="color:var(--accent)">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${Split.isEven(loads) ? 'Evenly split' : 'Split as evenly as your preferences allow'}</span>
          <span class="row-sub">Shared by effort, not by number of tasks</span></div>
          <span class="badge">${Icon.sparkSm} Time</span></button></div>`;

    const unassigned = active ? Household.unassigned(h) : [];
    const accepted = Household.hasAccepted(h, me);
    const waiting = h.members.filter(m => !Household.hasAccepted(h, m.uid)).map(m => esc(Household.memberName(m)));

    const bottom = active ? '' : `<div class="bottom-bar">
        ${accepted
          ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
          : `<button class="btn primary" data-action="acceptPlan">Start this plan</button>`}
        ${Household.isOwner(h, me) ? `<button class="btn ghost" data-action="nav" data-to="frequency">Edit times & frequency</button>` : ''}
      </div>`;

    return `<main class="screen ${active ? 'has-nav' : ''}">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${active ? 'Your plan' : 'Here\'s your plan'}</h1>
      <p class="lead" style="margin-bottom:16px">${active
        ? 'Who does what. Want to hand something over? Tap Swap.'
        : 'This is how it came out. If something isn\'t to your taste, tap Swap. When you\'re both happy, say yes.'}</p>
      ${swapCards(h)}
      ${balance}
      ${list('Your tasks', mine, true)}
      ${others.map(m => list(`${esc(Household.memberName(m))}'s tasks`, Household.tasksOf(h, m.uid), false)).join('')}
      ${unassigned.length ? `<div class="section-head"><h2 class="section-title">Needs a home</h2></div>
        <div class="card">${unassigned.map(r => `<div class="row static"><div class="row-text"><span class="row-title">${esc(r.name)}</span>
          <span class="row-sub">${esc(Timing.label(r))}</span></div><button class="mini" data-action="claim" data-id="${r.id}">I'll take it</button></div>`).join('')}</div>` : ''}
      ${bottom}
      ${active ? bottomNav('plan') : ''}
    </main>`;
  },

  /* ---------- Daily use ---------- */
  today() {
    const h = S.household;
    const me = S.user.uid;
    const view = S.view || 'today';
    const everyone = !!S.everyone;
    const now = new Date();
    const today = Schedule.day(now);
    const pool = h.responsibilities.filter(r => everyone || Household.assignee(h, r.id) === me);
    const who = r => {
      if (!everyone) return '';
      const a = Household.assignee(h, r.id);
      const m = Household.member(h, a);
      return a === me ? 'You · ' : (m ? esc(Household.memberName(m)) + ' · ' : '');
    };
    const tick = (r, sub) => {
      const c = Household.completion(h, r.id);
      const done = Schedule.doneOn(c, now);
      return `<button class="row ${done ? 'done' : ''}" data-action="toggleDone" data-id="${r.id}" aria-pressed="${done}">
        <span class="check" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${who(r)}${sub}</span></div>
      </button>`;
    };
    const scheduled = pool.filter(r => Timing.isScheduled(r)).map(r => ({ r, due: Household.dueDate(h, r) }));
    const freqOf = r => Timing.of(r).frequency;

    let body = '';
    if (view === 'today') {
      const open = scheduled.filter(x => x.due <= today && !Schedule.doneOn(Household.completion(h, x.r.id), now));
      const done = pool.filter(r => Timing.isScheduled(r) && Schedule.doneOn(Household.completion(h, r.id), now));
      const whenNeeded = pool.filter(r => !Timing.isScheduled(r));
      open.sort((a, b) => a.due - b.due);
      body = `${open.length || done.length ? `<div class="card">
          ${open.map(x => tick(x.r, x.due < today ? `Was due ${Schedule.relative(x.due, now).toLowerCase()}` : Timing.frequency(freqOf(x.r)).label)).join('')}
          ${done.map(r => tick(r, 'Done today')).join('')}
        </div>` : ''}
        ${!open.length ? `<div class="celebrate">${done.length ? 'All done for today 🎉' : 'Nothing due today. Enjoy it.'}</div>` : ''}
        ${whenNeeded.length ? `<div class="section-head"><h2 class="section-title">When needed</h2></div>
          <div class="card">${whenNeeded.map(r => { const c = Household.completion(h, r.id); return tick(r, c && c.last ? `Last done ${Schedule.relative(c.last, now).toLowerCase()}` : 'Tick it when you do it'); }).join('')}</div>` : ''}`;
    } else {
      const days = view === 'week' ? 7 : 31;
      const end = Schedule.addDays(today, days);
      const frequent = pool.filter(r => ['daily', 'several'].includes(freqOf(r)));
      const upcoming = scheduled
        .filter(x => !['daily', 'several'].includes(freqOf(x.r)) && x.due < end)
        .sort((a, b) => a.due - b.due);
      const summary = frequent.length ? `<div class="card"><div class="everyday">
          ${frequent.filter(r => freqOf(r) === 'daily').length ? `<div><b>Every day:</b> ${frequent.filter(r => freqOf(r) === 'daily').map(r => esc(r.name)).join(', ')}</div>` : ''}
          ${frequent.filter(r => freqOf(r) === 'several').length ? `<div style="margin-top:6px"><b>Several times a week:</b> ${frequent.filter(r => freqOf(r) === 'several').map(r => esc(r.name)).join(', ')}</div>` : ''}
        </div></div>` : '';
      body = `${summary}
        <div class="section-head"><h2 class="section-title">${view === 'week' ? 'Coming up this week' : 'Coming up this month'}</h2></div>
        ${upcoming.length ? `<div class="card">${upcoming.map(x => tick(x.r, `${x.due <= today ? 'Due now' : Schedule.relative(x.due, now)} · ${Timing.frequency(freqOf(x.r)).label}`)).join('')}</div>`
          : `<div class="celebrate">Nothing else coming up.</div>`}`;
    }

    return `<main class="screen has-nav">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${{ today: 'Today', week: 'This week', month: 'This month' }[view]}</h1>
      ${swapCards(h)}
      <div class="seg" role="group" aria-label="Period">
        <button data-action="setView" data-key="today" aria-pressed="${view === 'today'}">Today</button>
        <button data-action="setView" data-key="week" aria-pressed="${view === 'week'}">This week</button>
        <button data-action="setView" data-key="month" aria-pressed="${view === 'month'}">This month</button>
      </div>
      <div class="filter-line">
        <span class="section-meta">${everyone ? 'Everyone\'s tasks' : 'Your tasks'}</span>
        <button class="chip small" data-action="toggleEveryone" aria-pressed="${everyone}">Show everyone</button>
      </div>
      ${body}
      ${bottomNav('today')}
    </main>`;
  },

  /* ---------- Overview (owner and members) ---------- */
  inventory() {
    const h = S.household;
    const me = S.user.uid;
    const isOwner = Household.isOwner(h, me);
    const ownerName = Household.memberName(Household.owner(h));
    const groups = Household.inventory(h);
    const total = h.responsibilities.length;
    const others = h.members.filter(m => m.uid !== me);

    const sections = groups.map(({ category, items }) => `<section aria-labelledby="inv-${category.id}">
        <div class="section-head">
          <h2 class="section-title" id="inv-${category.id}">${esc(category.name)}</h2>
          <span class="section-meta">${items.length}</span>
        </div>
        <div class="card">${items.map(r => `<button class="row" data-action="openResponsibility" data-id="${r.id}">
            <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
            ${r.mentalLoad ? '<span class="tag">Mental load</span>' : ''}
            <span class="chev">${Icon.chev}</span>
          </button>`).join('')}</div>
      </section>`).join('');

    // Who has agreed (owner's view), or my own status (member's view).
    let status = '';
    if (isOwner && others.length) {
      status = `<div class="card">${others.map(m => {
        const st = Household.agreementState(h, m.uid);
        const n = esc(Household.memberName(m));
        const text = { agreed: `${n} agreed to the list`, pending: `${n} hasn't looked at the list yet`, changed: `You've changed the list since ${n} agreed` }[st];
        return `<div class="row static"><span class="avatar" aria-hidden="true">${n.charAt(0).toUpperCase()}</span>
          <div class="row-text"><span class="row-title">${text}</span></div>
          ${st === 'agreed' ? `<span class="chev" style="color:var(--accent)">${Icon.check}</span>` : ''}</div>`;
      }).join('')}</div>`;
    } else if (!isOwner) {
      status = `<div class="card"><div class="row static">
          <div class="row-text"><span class="row-title">You agreed to ${esc(ownerName)}'s list</span>
          <span class="row-sub">If anything's missing, suggest a change.</span></div>
          <span class="chev" style="color:var(--accent)">${Icon.check}</span></div></div>`;
    }

    // Suggestions: the owner decides; members see their own pending ones.
    const locked = !Entitlements.canSuggestChanges(S.subscription);
    const suggestions = Household.suggestions(h);
    let suggestionCard = '';
    if (isOwner && suggestions.length) {
      suggestionCard = `<div class="section-head"><h2 class="section-title">Suggestions</h2><span class="section-meta">${suggestions.length}</span></div>
        <div class="card">${suggestions.map(x => {
          const by = esc(Household.memberName(Household.member(h, x.by) || { name: 'Someone' }));
          return `<div class="row static col">
            <div class="row-text"><span class="row-title">${x.type === 'add' ? 'Add' : 'Remove'}: ${esc(x.name)}</span>
              <span class="row-sub">Suggested by ${by}</span></div>
            <div style="display:flex;gap:8px">
              <button class="btn primary" style="min-height:44px" data-action="acceptSuggestion" data-id="${x.id}">${x.type === 'add' ? 'Add it' : 'Remove it'}</button>
              <button class="btn secondary" style="min-height:44px;margin-top:0" data-action="declineSuggestion" data-id="${x.id}">Keep as is</button>
            </div></div>`;
        }).join('')}</div>`;
    } else if (!isOwner) {
      const mine = suggestions.filter(x => x.by === me);
      if (mine.length) {
        suggestionCard = `<div class="section-head"><h2 class="section-title">Your suggestions</h2><span class="section-meta">Waiting for ${esc(ownerName)}</span></div>
          <div class="card">${mine.map(x => `<div class="row static">
            <div class="row-text"><span class="row-title">${x.type === 'add' ? 'Add' : 'Remove'}: ${esc(x.name)}</span></div>
            ${locked ? '' : `<button class="link-btn" data-action="withdrawSuggestion" data-id="${x.id}">Withdraw</button>`}</div>`).join('')}</div>`;
      }
    }

    const alone = h.memberIds.length < 2;
    const actions = isOwner
      ? `${addOwnRow('Add your own responsibility', !Entitlements.canCreateCustomResponsibility(S.subscription))}
         <button class="btn secondary" data-action="nav" data-to="responsibilities">Edit responsibilities</button>`
      : `<button class="btn secondary" data-action="suggestChanges">Suggest a change ${locked ? `<span class="badge">${Icon.sparkSm} Premium</span>` : ''}</button>`;

    return `<main class="screen ${Household.stage(h) === 'active' ? 'has-nav' : ''}">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">Our household</h1>
      <div class="members">${memberChips(h)}</div>
      ${isOwner && alone ? `<div class="card next-card">
          <h2>Invite your partner</h2>
          <p>Send them a link. They'll see this list and can agree to it.</p>
          <button class="btn primary" data-action="invite">Create invite link</button>
        </div>` : ''}
      ${status}
      ${suggestionCard}
      <div class="card">
        <div class="stats">
          <div class="stat"><b>${total}</b><span>${total === 1 ? 'Responsibility' : 'Responsibilities'}</span></div>
          <div class="stat"><b>${groups.length}</b><span>${groups.length === 1 ? 'Area' : 'Areas'}</span></div>
        </div>
        <div class="note">This is everything your home involves. Nothing is assigned to anyone yet.</div>
      </div>
      ${sections || `<div class="card"><div class="note" style="border:0">No responsibilities yet.</div></div>`}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${actions}
      ${['alone', 'agreeing'].includes(Household.stage(h)) ? `<div class="card next-card" style="margin-top:24px">
        <h2>Next: who does what</h2>
        <p>Once ${alone ? 'your partner has joined and agreed' : 'everyone has agreed'} to this list, you'll each say how you feel about the tasks, and the app splits them fairly.</p>
      </div>` : ''}
      ${Household.isOwner(h, me) && Household.stage(h) !== 'active' && h.settings.onboarded ? `<button class="btn ghost" data-action="nav" data-to="frequency">Edit times & frequency</button>` : ''}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
      ${Household.stage(h) === 'active' ? bottomNav('inventory') : ''}
    </main>`;
  },
};

/** Incoming swap requests and results of my own requests (on Plan and Today). */
function swapCards(h) {
  const me = S.user.uid;
  const name = id => esc(Household.memberName(Household.member(h, id) || {}));
  const taskName = id => { const r = h.responsibilities.find(x => x.id === id); return r ? r.name : 'a task'; };
  const incoming = Household.incomingSwap(h, me);
  const results = Household.swapResults(h, me);
  let html = '';
  if (incoming) {
    html += `<div class="swap-card" role="status">
      <p class="joke">${SwapMessages.pick('request', incoming.id, { name: Household.memberName(Household.member(h, incoming.from) || {}), task: taskName(incoming.respId) })}</p>
      <p class="plain">If you take it, you pick one of your tasks to give ${name(incoming.from)} in return.</p>
      <div class="btns">
        <button class="btn primary" data-action="takeSwap" data-id="${incoming.id}">Deal, I'll take it</button>
        <button class="btn secondary" data-action="declineSwap" data-id="${incoming.id}">Nope, it's yours</button>
      </div></div>`;
  }
  results.forEach(x => {
    const vars = { name: Household.memberName(Household.member(h, x.to) || {}), task: taskName(x.respId), other: x.gave ? taskName(x.gave) : 'nothing' };
    const plain = x.status === 'done'
      ? `${esc(vars.task)} is now ${name(x.to)}'s.${x.gave ? ` ${esc(vars.other)} is now yours.` : ''}`
      : `${name(x.to)} declined. ${esc(vars.task)} stays yours.`;
    html += `<div class="result-card" role="status">
      <p class="joke">${SwapMessages.pick(x.status === 'done' ? 'done' : 'declined', x.id, vars)}</p>
      <p class="plain">${plain}</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissSwap" data-id="${x.id}">OK</button></div>`;
  });
  return html;
}

function memberChips(h) {
  return h.members.map(m => {
    const n = Household.memberName(m);
    const you = m.uid === S.user.uid ? ' <span class="you">(you)</span>' : '';
    return `<span class="member"><span class="avatar" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>${esc(n)}${you}</span>`;
  }).join('');
}

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

  /** Offering one of my tasks to someone else. */
  askSwap(respId) {
    const h = S.household;
    const r = h.responsibilities.find(x => x.id === respId);
    const others = h.members.filter(m => m.uid !== S.user.uid);
    const offer = m => `<button class="btn primary" data-action="sendSwap" data-id="${respId}" data-to="${m.uid}">Offer it to ${esc(Household.memberName(m))}</button>`;
    Sheet.open(`<h2>Hand over ${esc(r.name)}?</h2>
      <p>If ${others.length === 1 ? esc(Household.memberName(others[0])) : 'they'} take${others.length === 1 ? 's' : ''} it, they choose one of their tasks to give you in return. That's the price of a swap.</p>
      ${others.map(offer).join('')}
      <button class="btn ghost" data-action="closeSheet">Keep it</button>`, 'Swap');
  },

  /** The price: pick one of my tasks to give back. */
  swapPrice(swap) {
    const h = S.household;
    const fromName = Household.memberName(Household.member(h, swap.from) || {});
    const mine = Household.tasksOf(h, S.user.uid).filter(r => r.id !== swap.respId);
    Sheet.open(`<h2>${SwapMessages.pick('price', swap.id, { name: fromName })}</h2>
      <p>Pick one of your tasks for ${esc(fromName)}.</p>
      <div class="card">${mine.map(r => `<button class="row" data-action="completeSwap" data-id="${swap.id}" data-key="${r.id}">
          <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
          <span class="chev">${Icon.chev}</span></button>`).join('') ||
        `<button class="row" data-action="completeSwap" data-id="${swap.id}" data-key=""><div class="row-text"><span class="row-title">I have nothing to give, just take it</span></div></button>`}</div>
      <button class="btn ghost" data-action="closeSheet">Back</button>`, 'Pick what to give back');
  },

  menu() {
    const h = S.household;
    const isOwner = Household.isOwner(h, S.user.uid);
    const premium = Entitlements.isPremium(S.subscription);
    const ownerName = Household.memberName(Household.owner(h));
    const plan = premium ? (isOwner ? 'Premium' : `Premium via ${ownerName}`) : 'Free';
    const ownerItems = `
      <button class="btn secondary" data-action="sheetNav" data-to="members">Edit household setup</button>
      <button class="btn secondary" data-action="sheetNav" data-to="responsibilities">Edit responsibilities</button>`;
    const stage = Household.stage(h);
    const memberItems = h.settings.onboarded
      ? `<button class="btn secondary" data-action="sheetNav" data-to="review">Look through the list</button>` : '';
    const stageItems = (stage === 'plan' || (stage === 'preferences' && Household.prefsComplete(h, S.user.uid)))
      ? `<button class="btn secondary" data-action="editPrefs">Change my answers</button>` : '';
    Sheet.open(`<h2>Household</h2>
      <div class="plan-line"><span>Plan</span><span>${esc(plan)}</span></div>
      <div class="plan-line"><span>Signed in as</span><span>${esc(S.user.email || '')}</span></div>
      ${isOwner ? ownerItems : memberItems}
      ${isOwner && h.settings.onboarded && stage !== 'active' ? `<button class="btn secondary" data-action="sheetNav" data-to="frequency">Edit times & frequency</button>` : ''}
      ${stageItems}
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
