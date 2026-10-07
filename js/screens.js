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
    const from = S.inviteFrom ? esc(S.inviteFrom) : '';
    return `<main class="screen welcome">
      ${houseArt}
      <h1>${invited ? `${from || 'Your partner'} listed your home's tasks` : 'Share your home fairly, without the arguments.'}</h1>
      <p class="lead">${invited
        ? "Say how you feel about each one. The split is made from both your answers. It takes about a minute."
        : 'Set up your home in a few minutes, see how much work it really is, and get a fair split for the two of you.'}</p>
      ${invited ? '' : `<ol class="how">
        <li>List what your home needs</li>
        <li>Say what you like doing and what you'd rather not</li>
        <li>Get a fair split, then invite your partner to look at it</li>
      </ol>
      <p class="fine" style="text-align:left;margin-top:12px">Setting up and seeing your plan is free.</p>
      <p class="fine" style="text-align:left;margin-top:8px">Did your partner send you a link? Open that link first, before you sign up here.</p>`}
      <div class="bottom-bar">
        <button class="btn primary" data-action="authMode" data-mode="signup">${invited ? 'Create account and see the plan' : 'Get started'}</button>
        <button class="btn ghost" data-action="authMode" data-mode="signin">I already have an account</button>
        ${legalLine()}
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
        <input id="f-${esc(name)}" name="${name}" type="${type}" autocomplete="${auto}" value="${esc(v[name] || '')}" data-auth-field="${name}" ${extra}>
      </div>`;

    const google = mode === 'reset' ? '' : `
      <button class="btn google" data-action="google" ${busy}>${Icon.google} Continue with Google</button>
      <div class="divider">or with email</div>`;

    const fields = mode === 'reset'
      ? field('email', 'Email', 'email', 'email', 'required inputmode="email"')
      : (mode === 'signup' ? field('name', 'Your name', 'text', 'given-name', 'maxlength="40"') : '') +
        field('email', 'Email', 'email', 'email', 'required inputmode="email"') +
        field('password', 'Password', 'password', mode === 'signup' ? 'new-password' : 'current-password',
          `required minlength="${APP_CONFIG.minPasswordLength}"`) +
        (mode === 'signup' ? field('password2', 'Repeat password', 'password', 'new-password', `required minlength="${APP_CONFIG.minPasswordLength}"`) : '');

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
    const first = S.user && S.user.displayName ? ' ' + esc(S.user.displayName.split(' ')[0]) : '';
    return `<main class="screen welcome">
      <div class="topbar"><span class="spacer"></span>
        <button class="link-btn" data-action="signOut" style="margin:0">Sign out</button></div>
      ${houseArt}
      <h1>Hi${first}. Let's set up your home.</h1>
      <p class="lead">A few minutes, then a fair split to share with your partner.</p>
      <div class="bottom-bar">
        <button class="btn primary" data-action="createHousehold">Set up our home</button>
      </div>
    </main>`;
  },

  /** Past the draft, while we don't know yet whether the subscription is on (never says "ended"). */
  checking() {
    if (!S.subUnknown) return `<main class="screen center-screen" aria-busy="true"><div class="spinner" aria-hidden="true"></div>
      <p class="lead" style="margin-top:16px">Checking your subscription…</p></main>`;
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        ${settingsButton()}</div>
      ${houseArt}
      <h1>We couldn't check your subscription</h1>
      <p class="lead">Check your connection. We'll keep trying, and your home opens as soon as it works.</p>
      <div class="bottom-bar"><button class="btn primary" data-action="reload">Try again</button></div>
    </main>`;
  },

  joining() {
    return `<main class="screen center-screen" aria-busy="true"><div class="spinner" role="img" aria-label="Joining"></div>
      <p class="lead" style="margin-top:16px">Joining your household…</p></main>`;
  },

  /* ---------- Organiser setup ---------- */
  members() {
    const h = S.household;
    const me = Household.member(h, S.user.uid);
    const setup = !h.settings.onboarded;
    const partner = Household.alone(h) ? null : Household.member(h, Household.partnerId(h));
    return `<main class="screen">
      ${topbar({ back: setup ? null : 'settings', step: setup ? 'members' : null })}
      <h1>Who shares your home?</h1>
      <p class="lead">${setup ? "Just first names. You'll invite your partner once the plan is ready." : 'Change how your names show in the app.'}</p>
      <div class="card">
        <div class="field">
          <label for="my-name">Your name</label>
          <input id="my-name" value="${esc(me ? me.name : '')}" placeholder="Your name" autocomplete="given-name" maxlength="40" data-input="myName">
        </div>
        ${partner
          ? `<div class="row static"><span class="avatar" aria-hidden="true">${esc(Household.memberName(partner).charAt(0).toUpperCase())}</span>
              <div class="row-text"><span class="row-title">${esc(Household.memberName(partner))}</span><span class="row-sub">Joined</span></div></div>`
          : `<div class="field" style="border-top:1px solid var(--line)">
              <label for="partner-name">Your partner's name</label>
              <input id="partner-name" value="${esc(h.settings.partnerName || '')}" placeholder="e.g. Sam" autocomplete="off" maxlength="40" data-input="partnerName">
            </div>`}
      </div>
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="${esc(setup ? 'home' : 'settings')}">${setup ? 'Continue' : 'Done'}</button></div>
    </main>`;
  },

  home() {
    const h = S.household;
    const setup = !h.settings.onboarded;
    const petTypes = [['dog', 'Dog'], ['cat', 'Cat'], ['other', 'Other pet']];
    const pets = `<button class="chip" data-action="clearPets" aria-pressed="${h.pets.length === 0}">None</button>` +
      petTypes.map(([t, l]) => `<button class="chip" data-action="togglePet" data-key="${esc(t)}" aria-pressed="${h.pets.some(p => p.type === t)}">${l}</button>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'members' : 'settings', step: setup ? 'home' : null })}
      <h1>Your home</h1>
      <p class="lead">So we only suggest what applies to you.</p>
      <div class="card">
        ${stepperRow('bedroom', 'Bedrooms', '', roomCount(h, 'bedroom'))}
        ${stepperRow('bathroom', 'Bathrooms', 'Including guest toilets', roomCount(h, 'bathroom'))}
        ${switchRow('toggleRoom', 'kitchen', 'Kitchen', '', roomCount(h, 'kitchen') > 0)}
        ${switchRow('toggleRoom', 'living', 'Living room', '', roomCount(h, 'living') > 0)}
        ${switchRow('toggleRoom', 'office', 'Home office', '', roomCount(h, 'office') > 0)}
      </div>
      <div class="card">
        ${stepperRow('children', 'Children', 'Adds childcare and school/Kita', h.children.length)}
        <div class="row static col">
          <div class="row-text"><span class="row-title">Pets</span><span class="row-sub">Adds feeding, walks and vet visits</span></div>
          <div class="chips" role="group" aria-label="Pets">${pets}</div>
        </div>
        ${switchRow('toggleFlag', 'garden', 'Garden or outdoor space', '', !!h.circumstances.garden)}
        ${switchRow('toggleFlag', 'car', 'Car', '', !!h.circumstances.car)}
      </div>
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="${esc(setup ? 'responsibilities' : 'settings')}">${setup ? 'Show what needs doing' : 'Done'}</button></div>
    </main>`;
  },

  responsibilities() {
    const customRow = r => `<div class="row static"><span class="check" style="color:var(--accent)" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
        <button class="link-btn" data-action="removeTask" data-id="${esc(r.id)}">Remove</button></div>`;
    const h = S.household;
    const setup = !h.settings.onboarded;
    const selected = Household.selectedLibraryIds(h);
    const groups = Household.discoveryGroups(h);
    const sections = groups.map(({ category, items }) => {
      const n = items.filter(i => selected.has(i.id)).length;
      const all = n === items.length;
      const rows = items.map(item => `<button class="row" data-action="toggleResp" data-id="${esc(item.id)}" aria-pressed="${selected.has(item.id)}">
          <span class="check" aria-hidden="true">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${esc(item.name)}</span></div>
        </button>`).join('');
      const mine = h.responsibilities.filter(r => !r.predefined && r.category === category.id).map(customRow).join('');
      return `<section aria-labelledby="cat-${esc(category.id)}">
        <div class="section-head">
          <h2 class="section-title" id="cat-${esc(category.id)}">${esc(category.name)}</h2>
          <button class="link-btn" data-action="toggleCategory" data-cat="${esc(category.id)}">${all ? 'Clear' : 'Select all'}</button>
        </div>
        <div class="card">${rows}${mine}</div>
      </section>`;
    }).join('');
    // A task of your own in an area that isn't listed (e.g. children, with none): still under its own area name.
    const shown = new Set(groups.map(g => g.category.id));
    const ownSection = LIBRARY.categories.filter(c => !shown.has(c.id)).map(c => {
      const mine = h.responsibilities.filter(r => !r.predefined && r.category === c.id);
      return mine.length ? `<div class="section-head"><h2 class="section-title">${esc(c.name)}</h2></div><div class="card">${mine.map(customRow).join('')}</div>` : '';
    }).join('');
    const count = h.responsibilities.length;
    const active = Household.stage(h) === 'active';
    return `<main class="screen">
      ${topbar({ back: setup ? 'home' : 'settings', step: setup ? 'responsibilities' : null })}
      <h1>What needs doing in your home?</h1>
      <p class="lead" style="margin-bottom:0">${setup ? "Tick everything that applies. You're not deciding who does it yet."
        : active ? "Tick anything new. You'll both say how you feel about new tasks, and they're shared out fairly."
        : 'Tick everything that applies. The plan updates straight away.'}</p>
      ${sections}
      ${ownSection}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${addOwnRow('Add your own task')}
      ${setup ? '' : reshuffleBlock(h)}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${count ? `${plural(count, 'task')} · about ${formatMinutes(Household.weeklyTotal(h))} a week` : 'Nothing selected yet'}</p>
        <button class="btn primary" data-action="nav" data-to="${esc(setup ? 'frequency' : 'settings')}" ${count ? '' : 'disabled'}>${setup ? 'Continue' : 'Done'}</button>
      </div>
    </main>`;
  },

  /* ---------- How often and how long (organiser) ---------- */
  frequency() {
    const h = S.household;
    const setup = !h.settings.onboarded;
    const stage = Household.stage(h);
    const groups = Household.inventory(h);
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="fq-${esc(category.id)}">
        <div class="section-head"><h2 class="section-title" id="fq-${esc(category.id)}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => {
          const t = Timing.of(r);
          return `<div class="timing-row">
            <span class="row-title" id="t-${esc(r.id)}">${esc(r.name)}${t.rooms > 1 ? `<span class="row-sub" style="display:block">Time for each bathroom · ${formatMinutes(t.minutes)} for all ${t.rooms}</span>` : (Library.get(r.libraryId) || {}).perRoom ? '<span class="row-sub">Time for each bathroom</span>' : ''}</span>
            <div class="timing-controls">
              <select class="select" data-change="frequency" data-id="${esc(r.id)}" aria-label="How often: ${esc(r.name)}">${frequencyOptions(t.frequency)}</select>
              <select class="select minutes" data-change="minutes" data-id="${esc(r.id)}" aria-label="How long each time: ${esc(r.name)}">${minuteOptions(t.each)}</select>
            </div>
          </div>`;
        }).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'responsibilities' : 'settings', step: setup ? 'frequency' : null })}
      <h1>How often, and how long?</h1>
      <p class="lead" style="margin-bottom:0">We've filled in what's typical. Change anything that's different in your home.</p>
      ${stage === 'active' ? `<p class="form-note" style="margin-top:16px">Your plan is running. Changes here affect when tasks come up, not who does them.</p>` : ''}
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">About ${formatMinutes(Household.weeklyTotal(h))} a week in total</p>
        <button class="btn primary" data-action="nav" data-to="${esc(setup ? 'rate' : 'settings')}">${setup ? 'Continue' : 'Done'}</button>
      </div>
    </main>`;
  },

  /* ---------- Break a task into parts ---------- */
  breakdown() {
    const h = S.household;
    const bd = S.breakdown;
    const r = bd && h.responsibilities.find(x => x.id === bd.respId);
    if (!r) return Screens.inventory();
    const isOwner = Household.isOwner(h, S.user.uid);
    const ownerName = esc(Household.memberName(Household.owner(h)));
    const on = bd.parts.filter(p => p.on);
    const total = on.reduce((t, p) => t + p.minutes * Timing.frequency(p.frequency).perWeek, 0);
    const rows = bd.parts.map((p, i) => `<div class="timing-row">
        <button class="row" style="padding:0;min-height:44px" data-action="toggleBreakPart" data-key="${esc(i)}" aria-pressed="${p.on}">
          <span class="check" aria-hidden="true">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${esc(p.name)}</span>${p.custom ? '<span class="row-sub">Your own</span>' : ''}</div>
        </button>
        ${p.on ? `<div class="timing-controls">
          <select class="select" data-change="breakFreq" data-key="${esc(i)}" aria-label="How often: ${esc(p.name)}">${frequencyOptions(p.frequency)}</select>
          <select class="select minutes" data-change="breakMin" data-key="${esc(i)}" aria-label="How long: ${esc(p.name)}">${minuteOptions(p.minutes)}</select>
        </div>` : ''}
      </div>`).join('');
    const wasSplit = Household.parts(r).length > 0;
    return `<main class="screen">
      ${topbar({ back: 'household' })}
      <h1>Break down ${esc(r.name)}</h1>
      <p class="lead" style="margin-bottom:0">${isOwner
        ? 'Tick the parts you want as separate items. Each gets its own time and rhythm, and can go to a different person.'
        : `Pick the parts you'd like as separate tasks. ${ownerName} decides.`}</p>
      <div class="section-head"><h2 class="section-title">Parts</h2><span class="section-meta">${on.length} chosen</span></div>
      <div class="card">${rows}
        <div class="field" style="border-top:1px solid var(--line)"><label for="bd-new">Add your own part</label>
          <div class="field-line"><input id="bd-new" maxlength="60" placeholder="e.g. ${esc(Library.partExample(r))}" value="${esc(bd.newName || '')}" data-input="breakNew" enterkeyhint="done" autocomplete="off">
          <button class="mini add-part" data-action="addBreakPart" ${(bd.newName || '').trim() ? '' : 'disabled'}>Add</button></div></div>
      </div>
      <p class="fine" style="text-align:left;margin:0 4px 6px">Each part becomes its own item in your plan and is shared out fairly between you.</p>
      <p class="fine" style="text-align:left;margin:0 4px">Together about ${formatMinutes(total)} a week. As one task it was ${formatMinutes(Timing.weeklyMinutes(r))}.</p>
      <div class="bottom-bar">
        ${isOwner
          ? `<button class="btn primary" data-action="saveBreakdown" ${on.length < 2 ? 'disabled' : ''}>${wasSplit ? 'Save the parts' : 'Break it down'}</button>
             ${wasSplit ? `<button class="btn ghost" data-action="mergeBreakdown">Put it back together</button>` : ''}`
          : `<button class="btn primary" data-action="suggestBreakdown" ${on.length < 2 ? 'disabled' : ''}>Suggest this breakdown</button>`}
        ${on.length < 2 ? '<p class="fine">Pick at least two parts.</p>' : ''}
      </div>
    </main>`;
  },

  /* ---------- Rate new tasks or parts, then see how they'd be shared ---------- */
  reshare() {
    const h = S.household;
    const me = S.user.uid;
    const rsh = Household.activeReshare(h);
    if (!rsh) return Screens.plan();
    const units = (rsh.unitIds || []).map(id => Household.unit(h, id)).filter(Boolean);
    const noun = reshareNoun(h, rsh);
    const who = id => id === me ? 'You' : esc(Household.memberName(Household.member(h, id) || {}));
    if (rsh.status === 'rating' && !(rsh.done || {})[me]) {
      return `<main class="screen">
        ${topbar({ back: 'household' })}
        <h1>How do you feel about the new ${noun}s?</h1>
        <div class="card" style="margin-top:12px">${units.map(u => {
          const v = Household.reshareValue(h, me, u);
          return `<div class="pref-row"><div class="row-text"><span class="row-title">${esc(u.name)}</span><span class="row-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${esc(Timing.label(u))}</span></div>
            <div class="pref-group">${PREFERENCES.map(p => `<button class="pref-btn pref-${p.id}" data-action="setResharePref" data-id="${esc(u.id)}" data-key="${esc(p.id)}" aria-pressed="${v === p.id}" aria-label="${p.label}" title="${p.label}">${Icon[p.icon]}</button>`).join('')}</div></div>`;
        }).join('')}</div>
        <div class="bottom-bar"><button class="btn primary" data-action="finishReshare">Done</button></div>
      </main>`;
    }
    if (rsh.status === 'rating') {
      return `<main class="screen">${topbar({ back: 'household' })}${houseArt}
        <h1>Thanks!</h1><p class="lead">As soon as everyone has rated the new ${noun}s, you'll see how they'd be shared out.</p>
        <div class="bottom-bar"><button class="btn secondary" data-action="nav" data-to="household">Back to Home</button></div></main>`;
    }
    const accepted = (rsh.accepted || {})[me];
    const waiting = h.members.filter(m => !(rsh.accepted || {})[m.uid]).map(m => esc(Household.memberName(m)));
    const moved = (rsh.moved || []).map(id => Household.unit(h, id)).filter(Boolean);
    const changeRow = u => {
      const now = Household.assignee(h, u.id), next = (rsh.proposal || {})[u.id];
      return `<div class="row static"><div class="row-text"><span class="row-title">${esc(u.name)}</span>
        <span class="row-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${esc(Timing.label(u))}${now !== next && h.memberIds.includes(now) ? ` · was ${who(now)}` : ''}</span></div>
        <span class="tag" style="${next === me ? 'background:var(--accent-soft);color:var(--ink)' : ''}">${who(next)}</span></div>`;
    };
    return `<main class="screen">
      ${topbar({ back: 'household' })}
      <h1>Here's how the new ${noun}s would be shared</h1>
      <p class="lead" style="margin-bottom:12px">${moved.length
        ? `The new ${noun}s take quite some time, so a few other tasks change hands too, to keep things even.`
        : `Only the new ${noun}s are shared. Everything else in your plan stays as it is.`}</p>
      <div class="card">${units.map(changeRow).join('')}</div>
      ${moved.length ? `<div class="section-head"><h2 class="section-title">Also changing hands</h2></div>
        <div class="card">${moved.map(changeRow).join('')}</div>` : ''}
      ${rsh.loads ? `<div class="card" style="margin-top:16px"><div class="balance" style="flex-direction:column;align-items:stretch;gap:6px">${h.members.map(m =>
        `<div style="display:flex;justify-content:space-between"><span>${who(m.uid)}</span><span class="sub">about ${formatMinutes(rsh.loads[m.uid] || 0)} a week</span></div>`).join('')}</div></div>` : ''}
      <div class="bottom-bar">${accepted
        ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
        : `<button class="btn primary" data-action="acceptReshare">Yes, share it like this</button>
           <button class="btn ghost" data-action="declineReshare">${noun === 'part' ? 'Keep things as they are' : "Not now, we'll pick them ourselves"}</button>`}</div>
    </main>`;
  },

  /* ---------- Plans: after the draft, when paused, or to manage the subscription ---------- */
  subscribe() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    const orgName = esc(Household.memberName(Household.owner(h)));
    const partnerName = esc(Household.memberName(Household.people(h).find(m => m.uid !== h.ownerId) || Household.invitee(h)));
    const draft = Household.stage(h) === 'draft';
    const sub = S.subscription;
    const on = Entitlements.active(sub);
    const date = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const price = APP_CONFIG.billing.display;
    const billing = Backend.Billing.enabled();
    let head, lead, action, showBenefits = true;

    if (on) {
      showBenefits = false;
      head = 'Your subscription';
      lead = isOrg ? 'It covers both of you.' : `You're covered by ${orgName}'s subscription.`;
      let status;
      if (sub.source === 'stripe' && sub.status === 'trialing' && sub.trialEnd) {
        status = `<p class="joke">Free trial until ${date(sub.trialEnd)}</p>
          <p class="plain" style="margin:0">${sub.cancelAtPeriodEnd ? "You've cancelled, so you won't be charged." : `Then ${money(sub.interval === 'month' ? price.monthly : price.yearly)} per ${sub.interval || 'year'}. Cancel any time before ${date(sub.trialEnd)} and you won't be charged.`}</p>`;
      } else if (sub.source === 'stripe' && sub.periodEnd) {
        status = `<p class="joke">${sub.interval === 'month' ? 'Monthly' : 'Yearly'} plan</p>
          <p class="plain" style="margin:0">${sub.cancelAtPeriodEnd ? `Ends on ${date(sub.periodEnd)}.` : `Renews on ${date(sub.periodEnd)}.`}</p>`;
      } else {
        status = `<p class="joke">Your home is unlocked 🎉</p><p class="plain" style="margin:0">It covers both of you.</p>`;
      }
      if (isOrg && sub.source === 'stripe' && sub.status === 'past_due') {
        status += `<p class="plain" style="margin:8px 0 0"><b>Your last payment didn't go through.</b> Stripe will try again; update your card so nothing stops.</p>`;
      }
      // When it started and what happens next, in plain rows.
      const fact = (title, value) => `<div class="row static"><div class="row-text"><span class="row-title">${title}</span><span class="row-sub">${value}</span></div></div>`;
      const facts = [];
      if (sub.since) facts.push(fact('Active since', date(sub.since)));
      if (sub.source === 'stripe' && sub.periodEnd) {
        const label = sub.cancelAtPeriodEnd ? 'Ends on' : sub.status === 'trialing' ? 'First payment' : 'Next renewal';
        facts.push(fact(label, date(sub.status === 'trialing' && sub.trialEnd ? sub.trialEnd : sub.periodEnd)));
      } else if (sub.source === 'grant') {
        facts.push(fact('Renewal', sub.expires ? `Free until ${date(sub.expires)}` : 'Nothing to renew'));
      }
      action = `<div class="result-card">${status}</div>
        ${facts.length ? `<div class="card" style="margin-bottom:16px">${facts.join('')}</div>` : ''}
        ${isOrg && sub.source === 'stripe' ? `<button class="btn secondary" data-action="openPortal">Manage or cancel subscription</button>` : ''}`;
    } else if (!isOrg) {
      showBenefits = false;
      head = everSubscribed() ? `${orgName}'s subscription has ended` : `${orgName} needs to start the subscription`;
      lead = `Your plan, tasks and everything you've ticked off are saved. Once ${orgName} ${everSubscribed() ? 'restarts' : 'starts'} it, you're back where you left off.`;
      action = '';
    } else {
      const ended = !draft && everSubscribed();
      head = ended ? 'Your subscription has ended' : 'Start your plan together';
      lead = draft ? `One subscription covers you and ${partnerName}. Your draft plan is saved and ready to send.`
        : ended ? `Your plan, tasks and history are all saved. Restart to pick up where you left off with ${partnerName}.`
        : `One subscription covers you and ${partnerName}. Everything you've set up is saved.`;
      if (S.checkoutReturn === 'success') {
        action = `<div class="result-card" role="status"><div class="spinner small" aria-hidden="true"></div>
          <p class="joke">Unlocking your home…</p><p class="plain" style="margin:0">This usually takes a few seconds.</p></div>`;
      } else if (billing && (!watchers.subLoaded || !Array.isArray(S.stripeSubs))) {
        action = !watchers.subLoaded
          ? `<div class="result-card" role="status"><div class="spinner small" aria-hidden="true"></div><p class="plain" style="margin:0">Checking your plan…</p></div>`
          : `<div class="result-card" role="status"><p class="joke">We couldn't check your plan</p>
              <p class="plain" style="margin:0">So nothing is charged twice, buying waits until we can. Check your connection and try again.</p></div>
             <button class="btn secondary" data-action="reload">Try again</button>`;
      } else if (billing && Entitlements.paymentProblem(S.stripeSubs)) {
        action = `<div class="result-card" role="status"><p class="joke">There's a problem with your payment</p>
            <p class="plain" style="margin:0">Your bank declined it or it needs confirming. Fix it in your subscription settings; there's nothing new to buy.</p></div>
          <button class="btn premium" data-action="openPortal">Fix payment</button>`;
      } else if (billing) {
        const choice = S.planChoice || 'yearly';
        const trial = !Entitlements.hadSubscription(S.stripeSubs);
        const days = APP_CONFIG.billing.trialDays;
        const saving = Math.round((1 - price.yearly / (price.monthly * 12)) * 100);
        const trialEnd = Date.now() + days * 864e5;
        const card = (key, name, big, small, line, tag) => `<button class="plan-card" role="radio" aria-checked="${choice === key}" data-action="choosePlan" data-key="${esc(key)}">
            ${tag ? `<span class="plan-tag">${tag}</span>` : ''}
            <span class="plan-name">${name}</span>
            <span class="plan-price">${big}<small>${small}</small></span>
            <span class="plan-sub">${line}</span></button>`;
        const cta = choice === 'yearly' ? (trial ? `Start ${days}-day free trial` : 'Subscribe yearly') : 'Subscribe monthly';
        const fine = choice === 'yearly'
          ? (trial
            ? `Free until ${date(trialEnd)}, then ${money(price.yearly)} a year, billed yearly. We'll remind you before the trial ends. Cancel any time before then and you won't be charged.`
            : `${money(price.yearly)} a year, billed yearly. Renews automatically until you cancel.`)
          : `${money(price.monthly)} a month, billed monthly from today. Renews automatically until you cancel.`;
        action = `${S.checkoutReturn === 'cancel' ? '<p class="form-note" role="status">No worries, nothing was charged.</p>' : ''}
          <div class="plans" role="radiogroup" aria-label="Choose a plan">
            ${card('yearly', 'Yearly', money(price.yearly / 12), '/month', `${money(price.yearly)} billed yearly · save ${saving}%`, trial ? `${days} days free` : `Save ${saving}%`)}
            ${card('monthly', 'Monthly', money(price.monthly), '/month', 'Billed monthly, no trial', '')}
          </div>
          <button class="btn premium" data-action="startCheckout">${cta}</button>
          <p class="fine">${fine} Payment is handled securely by Stripe.</p>
          ${legalLine()}`;
      } else {
        const req = S.premiumRequest;
        const note = req && req.status === 'denied' ? "We can't unlock your home just yet. You can ask again any time." : '';
        action = (note ? `<p class="form-note">${note}</p>` : '') + (req && req.status === 'pending'
          ? `<div class="result-card"><p class="joke">Thanks, you're on the list! 🙌</p>
              <p class="plain" style="margin:0">We'll let you know as soon as your home is unlocked.</p></div>`
          : `<button class="btn premium" data-action="requestPremium">Request access</button>
             <p class="fine">Payments aren't open yet. Ask for access and we'll unlock your home.</p>`);
      }
    }

    const back = S.fromSettings === 'subscribe' ? 'settings' : draft ? 'household' : on ? 'today' : null;
    return `<main class="screen">
      ${back ? topbar({ back }) : `<div class="topbar"><span class="spacer"></span>
        ${settingsButton()}</div>`}
      <div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h1 style="margin-top:0">${head}</h1>
      <p class="lead">${lead}</p>
      ${showBenefits ? `<div class="card">${BENEFITS.map(b => `<div class="row static">
          <span class="chev" style="color:var(--premium)">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${b.title}</span><span class="row-sub">${b.body}</span></div></div>`).join('')}</div>` : ''}
      <div style="margin-top:8px">${action}</div>
      <div style="height:calc(32px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },

  /* ---------- How do you feel about each task (organiser setup, or changing answers) ---------- */
  rate() {
    const h = S.household;
    const me = S.user.uid;
    const setup = !h.settings.onboarded;
    const groups = Household.inventory(h);
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="pf-${esc(category.id)}">
        <div class="section-head"><h2 class="section-title" id="pf-${esc(category.id)}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => prefRow(h, me, r)).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'frequency' : 'settings', step: setup ? 'rate' : null })}
      <h1>How do you feel about each task?</h1>
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${markedCount(h, me) ? `${plural(markedCount(h, me), 'task')} marked` : 'Nothing marked yet. That\'s fine too.'}</p>
        <button class="btn primary" data-action="${setup ? 'finishSetup' : 'saveAnswers'}">${setup ? 'See our plan' : 'Save my answers'}</button>
      </div>
    </main>`;
  },

  /* ---------- Partner: says how they feel about each task before the split is made ---------- */
  review() {
    const h = S.household;
    const me = S.user.uid;
    const orgName = esc(Household.memberName(Household.owner(h)));
    const marked = markedCount(h, me);
    const sections = Household.inventory(h).map(({ category, items }) => `<section aria-labelledby="rv-${esc(category.id)}">
        <div class="section-head"><h2 class="section-title" id="rv-${esc(category.id)}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => prefRow(h, me, r)).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>${settingsButton()}</div>
      <h1>${orgName} listed the tasks. How do you feel about each?</h1>
      <p class="lead">Only you see your answers. The split is made from both of yours, so it's fair for you both.</p>
      ${totalCard(h)}
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${marked ? `${plural(marked, 'task')} marked` : "Nothing marked yet. That's fine too."}</p>
        <button class="btn primary" data-action="submitReview">See our split</button>
        <button class="btn ghost" data-action="suggestChanges">Suggest a change to the list</button>
      </div>
    </main>`;
  },

  /* ---------- The plan before it runs: draft, partner looking, saying yes ---------- */
  plan() {
    const h = S.household;
    const me = S.user.uid;
    const stage = Household.stage(h);
    const isOrg = Household.isOwner(h, me);
    const people = Household.people(h);
    const partner = people.find(m => m.uid !== me) || null;
    const partnerName = partner ? esc(Household.memberName(partner)) : 'your partner';
    const accepted = Household.hasAccepted(h, me);
    const waiting = h.memberIds.filter(m => !Household.hasAccepted(h, m)).map(m => esc(Household.memberName(Household.member(h, m))));

    let head, lead, top = '', bottom = '';
    if (stage === 'draft') {
      const invited = !!(h.settings && h.settings.invitedAt);
      head = 'Your plan is ready';
      lead = `Here's a first draft of a fair split. When ${partnerName} joins, they add their own answers and the split is made from both of yours.`;
      top = totalCard(h);
      bottom = `<div class="bottom-bar">${hasAccess()
        ? `${invited ? `<p class="count">${partnerName} hasn't joined yet</p>` : ''}
           <button class="btn primary" data-action="invite">${invited ? 'Send the link again' : `Invite ${partnerName} to see the plan`}</button>`
        : (!Backend.Billing.enabled() && S.premiumRequest && S.premiumRequest.status === 'pending')
          ? `<p class="count">We'll unlock your home once it's approved</p>
             <button class="btn premium" disabled>Approval pending</button>`
          : `<p class="count">${trialOffer() ? `${APP_CONFIG.billing.trialDays} days free, then ${money(APP_CONFIG.billing.display.yearly)}/year` : 'One subscription covers you both'}</p>
           <button class="btn premium" data-action="nav" data-to="subscribe">${trialOffer() ? 'Start free and invite ' + partnerName : 'Unlock and invite ' + partnerName}</button>`}
      </div>`;
    } else if (stage === 'review') {
      head = 'Your plan';
      lead = `${partnerName} is adding their answers. Your split, made from both, shows up here when it's ready.`;
    } else {
      const by = h.plan && h.plan.rebalancedBy;
      head = "Here's your plan";
      lead = by === me ? 'Rebalanced with your answers. Have a look and say yes if it works for you.'
        : by ? `${esc(Household.memberName(Household.member(h, by)))} marked a few things, so the plan was rebalanced. Have a look and say yes if it works for you.`
        : "Made from both your answers. If something isn't to your taste, tap it to swap. When you're both happy, say yes.";
      bottom = `<div class="bottom-bar">
        ${accepted
          ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
          : `<button class="btn primary" data-action="acceptPlan">Start this plan</button>`}
      </div>`;
    }

    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>${settingsButton()}</div>
      <h1>${head}</h1>
      <p class="lead" style="margin-bottom:16px">${lead}</p>
      ${swapCards(h)}
      ${suggestionsCard(h)}
      ${top}
      ${planLists(h)}
      ${isOrg ? `<button class="btn outline" data-action="nav" data-to="frequency">Change times</button>` : ''}
      ${bottom}
    </main>`;
  },

  /* ---------- Us: the household at a glance. Nothing is ticked here. ---------- */
  household() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    if (!isOrg && S.suggestMode) return Screens.suggest();
    if (Household.stage(h) !== 'active') return Screens.plan();
    const needs = statusBanner(h) + swapCards(h) + suggestionsCard(h) + newTasksCard(h) + (isOrg ? timeHintsCard(h) : '');
    const names = Household.people(h).map(m => esc(Household.memberName(m).split(' ')[0])).join(' & ');
    return `<main class="screen has-nav">
      <div class="topbar"><span class="spacer"></span>${settingsButton()}</div>
      <div class="greeting"><p class="hello">${names}</p>
        <h1 class="mood">Our home</h1>
      </div>
      ${balanceCard(h)}
      ${boardCard(h)}
      <div class="section-head"><h2 class="section-title">Needs you</h2></div>
      ${needs || `<p class="all-clear">${esc(allClearLine())}</p>`}
      ${personLists(h)}
      ${isOrg ? addOwnRow('Add your own task') : ''}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
      ${bottomNav('household', navDots(h))}
    </main>`;
  },

  /* ---------- Me: what I do. Today, this week, anytime. Never about the partner. ---------- */
  today() {
    const h = S.household;
    const me = S.user.uid;
    const now = new Date();
    const lists = Household.myLists(h, me, now);
    const progress = Household.dayProgress(h, [me], now);
    const first = esc(Household.memberName(Household.member(h, me)).split(' ')[0]);
    const tick = (r, sub, done) => `<button class="row ${done ? 'done' : ''}" data-action="toggleDone" data-id="${esc(r.id)}" aria-pressed="${done}">
        <span class="check" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${r.parentName ? esc(r.parentName) + ' · ' : ''}${sub}</span></div>
      </button>${feelStrip(r.id)}`;
    const doneToday = r => Schedule.doneOn(Household.completion(h, r.id), now);
    // Done for me by the other person today: off my list, with a line saying so.
    const covered = Household.coveredForMe(h, me, now);
    const coveredIds = new Set(covered.map(x => x.unit.id));
    ['today', 'week', 'anytime'].forEach(k => { lists[k] = lists[k].filter(r => !coveredIds.has(r.id)); });
    const feelFor = S.feel && S.feel.until > Date.now() ? S.feel.id : null;
    const feelStrip = id => id !== feelFor ? '' : `<div class="feel-strip" role="group" aria-label="How long did it take?">
        <span>How long did it take?</span>
        <div class="chips">${[['quicker', 'Quicker'], ['ok', 'About right'], ['longer', 'Longer']].map(([k, l]) =>
          `<button class="chip" data-action="feel" data-id="${esc(id)}" data-key="${k}">${l}</button>`).join('')}</div></div>`;
    const section = (title, rows) => rows.length ? `<div class="section-head"><h2 class="section-title">${title}</h2></div><div class="card">${rows.join('')}</div>` : '';
    const byOpen = (a, b) => Number(a.done) - Number(b.done);

    const today = lists.today.map(r => ({ r, done: doneToday(r) })).sort(byOpen)
      .map(x => tick(x.r, x.done ? 'Done today' : formatMinutes(Timing.of(x.r).minutes), x.done));
    const week = lists.week.map(r => {
      const target = Household.weekTarget(r), ticks = Household.weekTicks(h, r, now);
      const done = Household.doneForNow(h, r, now);
      const sub = target > 1 ? `${Math.min(ticks, target)} of ${target} this week${doneToday(r) && !done ? ' · done today' : ''}`
        : done ? 'Done this week' : esc(Timing.label(r));
      // A several-times task can be ticked once a day: today's tick shows as ticked until tomorrow.
      return { r, done: done || doneToday(r), sub };
    }).sort(byOpen).map(x => tick(x.r, x.sub, x.done));
    const anytime = lists.anytime.map(r => {
      const c = Household.completion(h, r.id);
      const done = doneToday(r);
      return { r, done, sub: done ? 'Done today' : c && c.last ? `Last done ${esc(Schedule.relative(c.last, now).toLowerCase())}` : 'Whenever it\'s needed' };
    }).sort(byOpen).map(x => tick(x.r, x.sub, x.done));
    const board = Household.myNoteTasks(h, me);
    const nothing = !today.length && !week.length && !anytime.length && !board.length && !covered.length;
    const helped = covered.length ? `<div class="card helped">${covered.map(x =>
      `<div class="row static"><span class="helped-mark" aria-hidden="true">💛</span><div class="row-text"><span class="row-title">${esc(HelpLines.line(Household.memberName(Household.member(h, x.by)).split(' ')[0], x.unit.name, x.unit.id + Schedule.key(now)))}</span></div></div>`).join('')}</div>` : '';

    return `<main class="screen has-nav">
      <div class="topbar"><span class="spacer"></span>${settingsButton()}</div>
      <div class="greeting"><p class="hello">Hello, ${first}</p>
        <h1 class="mood">${esc(Mood.line(now, progress))}</h1>
      </div>
      ${progress.count ? progressBar(progress.pct, 'Your day', progress.left ? `${progress.doneCount} of ${progress.count} done` : 'All done') : ''}
      ${helped}
      ${board.length ? `<div class="section-head"><h2 class="section-title">From the board</h2></div>
        <div class="card">${board.map(n => noteTaskRow(h, n, me, false)).join('')}</div>` : ''}
      ${section('Today', today)}
      ${section('This week', week)}
      ${section('Anytime', anytime)}
      ${nothing ? '<div class="celebrate">Nothing on your list.</div>' : ''}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
      ${bottomNav('today', navDots(h))}
    </main>`;
  },

  /* ---------- Settings: everything about you, your home, the subscription, in one place ---------- */
  settings() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    const stage = Household.stage(h);
    const on = Entitlements.active(S.subscription);
    const usable = on || stage === 'draft';                       // a paused household can't be edited
    const orgName = Household.memberName(Household.owner(h));
    const partner = Household.people(h).find(m => m.uid !== me);
    const partnerName = partner ? Household.memberName(partner) : 'your partner';
    const row = (attrs, title, status) => `<button class="row" ${attrs}>
        <div class="row-text"><span class="row-title">${title}</span>${status ? `<span class="row-sub">${status}</span>` : ''}</div>
        <span class="chev">${Icon.chev}</span></button>`;
    const info = (title, status) => `<div class="row static"><div class="row-text"><span class="row-title">${title}</span><span class="row-sub">${status}</span></div></div>`;
    const go = to => `data-action="nav" data-to="${esc(to)}"`;
    const group = (title, rows) => rows.filter(Boolean).length
      ? `<div class="section-head"><h2 class="section-title">${title}</h2></div><div class="card">${rows.filter(Boolean).join('')}</div>` : '';

    const sub = S.subscription;
    const date = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    let subStatus;
    if (!on) subStatus = stage === 'draft' || !everSubscribed() ? 'Not started' : 'Ended';
    else if (!isOrg) subStatus = `Covered by ${esc(orgName)}`;
    else if (sub.source === 'stripe' && sub.status === 'trialing' && sub.trialEnd) subStatus = `Free trial until ${date(sub.trialEnd)}`;
    else if (sub.source === 'stripe' && sub.status === 'past_due') subStatus = "Payment didn't go through";
    else if (sub.source === 'stripe' && sub.periodEnd) subStatus = `${sub.interval === 'month' ? 'Monthly' : 'Yearly'} · ${sub.cancelAtPeriodEnd ? 'ends' : 'renews'} ${date(sub.periodEnd)}`;
    else subStatus = 'Active';

    // You: name, how you sign in (plain text, never a link), your answers before the plan runs, the subscription.
    const myName = Household.memberName(Household.member(h, me));
    const marked = Household.marked(h, me);
    const you = group('You', [
      usable ? row('data-action="editName"', 'Your name', esc(myName)) : info('Your name', esc(myName)),
      `<div class="row static"><div class="row-text"><span class="row-title">Signed in as</span><span class="row-sub plain-text">${esc(S.user.email || '')}</span></div></div>`,
      usable && stage !== 'active' ? row(go('rate'), 'My answers', marked ? `${plural(marked, 'task')} marked` : 'Nothing marked') : '',
      (isOrg || on) && stage !== 'setup' ? row(go('subscribe'), 'Your subscription', subStatus) : info('Your subscription', subStatus),
    ]);

    const people = Household.people(h).map(m => esc(Household.memberName(m))).join(' & ');
    const invited = !!(h.settings && h.settings.invitedAt);
    const alone = Household.alone(h);
    const roomsOf = type => roomCount(h, type);
    const homeBits = [plural(roomsOf('bedroom'), 'bedroom'), plural(roomsOf('bathroom'), 'bathroom')];
    if (h.children.length) homeBits.push(plural(h.children.length, 'child', 'children'));
    if (h.pets.length) homeBits.push(h.pets.map(p => p.type === 'other' ? 'pet' : p.type).join(', '));
    if (h.circumstances.garden) homeBits.push('garden');
    if (h.circumstances.car) homeBits.push('car');
    const ours = group('Our home', [
      isOrg && usable ? row(go('members'), 'People', alone ? `${esc(people)} · ${invited ? 'invite sent' : 'not joined yet'}` : esc(people)) : info('People', esc(people)),
      isOrg && alone && h.settings.onboarded ? row('data-action="invite"', `Invite ${esc(partnerName)}`, hasAccess() ? (invited ? 'Send the link again' : 'Send them the plan') : 'Starts with your subscription') : '',
      isOrg && usable ? row(go('home'), 'Your home', esc(homeBits.join(' · '))) : '',
      isOrg && usable ? row(go('responsibilities'), 'Tasks', plural(h.responsibilities.length, 'task')) : '',
      isOrg && usable ? row(go('frequency'), 'Times', `about ${formatMinutes(Household.weeklyTotal(h))} a week`) : '',
      !isOrg && on ? row('data-action="suggestChanges"', 'Our Tasks', `Suggest changes · ${esc(orgName)} decides`) : '',
      on && !alone && stage !== 'setup' && h.plan ? row(go('swap'), 'Swap', `Offer one of your tasks to ${esc(partnerName)}`) : '',
    ]);

    const contact = APP_CONFIG.legal && APP_CONFIG.legal.email;
    const help = group('Help & legal', [
      `<button class="row" data-action="openFeedback"><div class="row-text"><span class="row-title">Send feedback</span><span class="row-sub">What works, what doesn't, what confused you</span></div><span class="chev">${Icon.chev}</span></button>`,
      `<a class="row" href="legal.html" target="_blank" rel="noopener"><div class="row-text"><span class="row-title">Imprint, privacy and terms</span></div><span class="chev">${Icon.chev}</span></a>`,
      contact ? `<a class="row" href="mailto:${esc(contact)}"><div class="row-text"><span class="row-title">Contact us</span><span class="row-sub">${esc(contact)}</span></div><span class="chev">${Icon.chev}</span></a>` : '',
    ]);

    return `<main class="screen">
      ${topbar({ back: S.settingsFrom === 'today' ? 'today' : 'household' })}
      <h1>Settings</h1>
      ${you}${ours}${help}
      <div class="card" style="margin-top:24px">
        ${Backend.Auth.usesPassword() ? `<button class="row" data-action="changePassword"><div class="row-text"><span class="row-title">Change password</span></div><span class="chev">${Icon.chev}</span></button>` : ''}
        <button class="row" data-action="signOut"><div class="row-text"><span class="row-title">Sign out</span></div></button>
      </div>
      <div class="card danger-zone">
        ${!isOrg || !alone ? `<button class="row" data-action="confirmLeave"><div class="row-text"><span class="row-title text-danger">Leave household</span>
          <span class="row-sub">${isOrg ? `${esc(partnerName)} becomes the organiser` : "You'd need a new invite to come back"}</span></div></button>` : ''}
        ${isOrg ? `<button class="row" data-action="confirmDelete"><div class="row-text"><span class="row-title text-danger">Delete household</span><span class="row-sub">${alone ? 'Removes it and everything in it' : 'Removes it for both of you'}</span></div></button>` : ''}
        <button class="row" data-action="confirmDeleteAccount"><div class="row-text"><span class="row-title text-danger">Delete my account</span><span class="row-sub">Your name, email, sign-in and data</span></div></button>
      </div>
      <div style="height:calc(32px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },

  /* ---------- Our Tasks: the partner suggests changes (the organiser decides) ---------- */
  suggest() {
    const h = S.household;
    const me = S.user.uid;
    const orgName = esc(Household.memberName(Household.owner(h)));
    const count = Household.suggestions(h).filter(x => x.by === me).length;
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="doneSuggesting" aria-label="Back">${Icon.back}</button></div>
      <h1 style="margin-top:0">Our Tasks</h1>
      <p class="lead">Suggest removing, breaking down, adding tasks or reshuffling the plan.</p>
      ${suggestionsCard(h)}
      ${taskMap(h)}
      <div class="section-head"><h2 class="section-title">Suggest adding</h2></div>
      <div class="card"><div class="field" style="margin:0;padding:14px 16px">
        <label for="sg-add">What else needs doing?</label>
        <input id="sg-add" maxlength="60" placeholder="e.g. Water the plants" autocomplete="off" enterkeyhint="done">
        <button class="btn secondary" style="margin-top:12px" data-action="suggestAdd">Suggest adding</button>
      </div></div>
      ${reshuffleBlock(h)}
      <div style="height:96px"></div>
      <div class="bottom-bar"><p class="count">${plural(count, 'suggestion')} for ${orgName}</p>
        <button class="btn primary" data-action="doneSuggesting">Done</button></div>
    </main>`;
  },

  /* ---------- Swap: your tasks, offer any of them to your partner ---------- */
  swap() {
    const h = S.household;
    const me = S.user.uid;
    const partner = Household.people(h).find(m => m.uid !== me);
    const pName = esc(partner ? Household.memberName(partner) : 'your partner');
    const mine = Household.tasksOf(h, me);
    const groups = Household.inventory(h).map(({ category }) => ({ category, items: mine.filter(u => u.category === category.id) })).filter(g => g.items.length);
    const rows = items => items.map(u => {
      const asked = Household.pendingFor(h, u.id);
      const name = u.parentName ? `${esc(u.parentName)}: ${esc(u.name)}` : esc(u.name);
      return asked
        ? `<div class="row static"><div class="row-text"><span class="row-title">${name}</span><span class="row-sub">${esc(Timing.label(u))}</span></div><span class="tag">Swap asked</span></div>`
        : `<button class="row" data-action="askSwap" data-id="${esc(u.id)}"><div class="row-text"><span class="row-title">${name}</span><span class="row-sub">${esc(Timing.label(u))}</span></div><span class="tag">Swap</span></button>`;
    }).join('');
    return `<main class="screen">
      ${topbar({ back: 'settings' })}
      <h1>Swap</h1>
      <p class="lead">Offer one of your tasks to ${pName}. If they take it, they choose one of theirs in return.</p>
      ${swapCards(h)}
      ${groups.length ? groups.map(g => `<div class="section-head"><h2 class="section-title">${esc(g.category.name)}</h2></div><div class="card">${rows(g.items)}</div>`).join('')
        : '<div class="note">You have no tasks to swap right now.</div>'}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },
};

/* ---------- Pieces of the plan and Home screens ---------- */
/** The plan as two plain lists, one per person, all open: easy to see who has what and how it adds up. */
function planLists(h) {
  const me = S.user.uid;
  const stage = Household.stage(h);
  const loads = Household.loads(h);
  // A tick means "agreed to this plan": the organiser made it, the others tick when they say yes.
  const agreed = uid => (stage === 'draft' || stage === 'review') ? uid === h.ownerId : Household.hasAccepted(h, uid);
  const people = Household.people(h).slice().sort((a, b) => (a.uid === me ? -1 : b.uid === me ? 1 : 0));
  return people.map(m => {
    const units = Household.tasksOf(h, m.uid);
    const rows = units.map(u => `<button class="row task-row" data-action="openTask" data-id="${esc(u.parentId || u.id)}">
        <div class="row-text"><span class="row-title">${u.parentName ? `${esc(u.parentName)}: ${esc(u.name)}` : esc(u.name)}</span>
          <span class="row-sub">${esc(Timing.label(u))}</span></div></button>`).join('');
    const ok = agreed(m.uid);
    const name = m.uid === me ? 'You' : Household.memberName(m);
    return `<div class="section-head plan-head"><h2 class="section-title">${esc(name)}
        <span class="agree ${ok ? 'on' : ''}" role="img" aria-label="${ok ? 'Agreed' : 'Not yet'}">${ok ? Icon.check : ''}</span></h2>
        <span class="section-meta">about ${formatMinutes(loads[m.uid] || 0)} a week</span></div>
      <div class="card">${rows || '<div class="note" style="border:0">Nothing yet.</div>'}</div>`;
  }).join('');
}
/** Each person's planned share of the week (the plan, not who has ticked more). */
function balanceCard(h) {
  const me = S.user.uid;
  const loads = Household.loads(h);
  return `<div class="card balance-card">${Household.people(h).map(m =>
    `<div class="balance-line"><span class="owner ${m.uid === me ? 'me' : ''}" aria-hidden="true">${esc(initialOf(h, m.uid))}</span>
      <span class="balance-name">${esc(m.uid === me ? 'You' : Household.memberName(m))}</span>
      <span class="balance-sub">about ${formatMinutes(loads[m.uid] || 0)} a week</span></div>`).join('')}</div>`;
}
/** One or two letters for a person, unique within the household. */
function initialOf(h, uid) {
  const people = Household.people(h);
  const name = m => Household.memberName(m).trim() || '?';
  const m = people.find(p => p.uid === uid);
  if (!m) return '';
  const one = name(m)[0].toUpperCase();
  const clash = people.some(p => p.uid !== uid && name(p)[0].toUpperCase() === one);
  return clash ? name(m).slice(0, 2).replace(/^./, c => c.toUpperCase()) : one;
}
/** Who looks after a task, as small round initials (dashed when nobody has it yet). */
/** Tasks that keep taking longer (or less) than planned: the organiser can change the time. */
function timeHintsCard(h) {
  return Household.timeHints(h).map(t => `<div class="card"><div class="row static col">
      <div class="row-text"><span class="row-title">${esc(t.unit.name)} usually takes ${t.dir > 0 ? 'longer' : 'less time'}</span>
      <span class="row-sub">Planned ${esc(formatMinutes(t.from))}. It was ${t.dir > 0 ? 'longer' : 'quicker'} 3 of the last 4 times. Change it to ${esc(formatMinutes(t.to))}?</span></div>
      <div class="btns" style="display:flex;gap:8px;margin-top:10px">
        <button class="btn primary" style="flex:1" data-action="applyTime" data-id="${esc(t.id)}" data-key="${esc(t.minutes)}">Change to ${esc(formatMinutes(t.to))}</button>
        <button class="btn secondary" style="flex:1" data-action="keepTime" data-id="${esc(t.id)}">Keep it</button></div>
    </div></div>`).join('');
}
function ownerBadges(h, r) {
  const me = S.user.uid;
  const people = Household.peopleIds(h);
  const units = Household.isSplit(r) ? Household.parts(r).map(p => p.id) : [r.id];
  const owners = [...new Set(units.map(id => Household.assignee(h, id)).map(x => (people.includes(x) ? x : null)))];
  const label = uid => !uid ? 'Nobody yet' : uid === me ? 'Yours' : `${Household.memberName(Household.member(h, uid))}'s`;
  const sorted = owners.sort((x, y) => (x === me ? -1 : y === me ? 1 : x ? -1 : 1));
  return `<span class="owners" aria-label="${esc(sorted.map(label).join(', '))}">${sorted.map(uid => uid
    ? `<span class="owner ${uid === me ? 'me' : ''}" aria-hidden="true">${esc(initialOf(h, uid))}</span>`
    : '<span class="owner none" aria-hidden="true"></span>').join('')}</span>`;
}
/** The household's tasks by category, each category opening in place. Tapping a task opens its sheet. */
function taskMap(h, openAll) {
  const me = S.user.uid;
  const people = Household.peopleIds(h);
  const open = S.openCats || {};
  return `<div class="section-head"><h2 class="section-title">The tasks</h2><span class="section-meta">${h.responsibilities.length}</span></div>
    <div class="card task-map">${Household.inventory(h).map(({ category, items }) => {
      const expanded = category.id in open ? open[category.id] : !!openAll;
      const mine = items.filter(r => {
        const ids = Household.isSplit(r) ? Household.parts(r).map(p => p.id) : [r.id];
        return ids.some(id => Household.assignee(h, id) === me);
      }).length;
      const freeIds = new Set(homeless(h).map(u => u.id));
      const free = items.filter(r => (Household.isSplit(r) ? Household.parts(r).map(p => p.id) : [r.id]).some(id => freeIds.has(id))).length;
      const sub = `${plural(items.length, 'task')}${people.includes(me) && Household.stage(h) !== 'setup' ? ` · ${mine} yours` : ''}${free ? ` · ${free} without anyone` : ''}`;
      const rows = expanded ? items.map(r => {
        const parts = Household.parts(r).length;
        return `<button class="row task-row" data-action="openTask" data-id="${esc(r.id)}">
          <div class="row-text"><span class="row-title">${esc(r.name)}</span>
            <span class="row-sub">${esc(Timing.label(r))}${parts ? ` · ${plural(parts, 'part')}` : ''}${r.mentalLoad ? ' · Mental load' : ''}${Household.suggestionFor(h, me, 'remove', r.id) ? ' · Removal suggested' : ''}</span></div>
          ${ownerBadges(h, r)}</button>`;
      }).join('') : '';
      return `<button class="row cat-head" data-action="toggleCat" data-key="${esc(category.id)}" aria-expanded="${expanded}">
          <div class="row-text"><span class="row-title">${esc(category.name)}</span><span class="row-sub">${sub}</span></div>
          <span class="chev" aria-hidden="true">${Icon.chev}</span></button>${rows}`;
    }).join('')}</div>`;
}
/** Us: everyone's tasks, split by person, then by when. Tapping a task opens its sheet. */
function personLists(h) {
  const me = S.user.uid;
  const now = new Date();
  const ids = Household.peopleIds(h).sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
  const status = (u, uid) => {
    const c = Household.completion(h, u.id);
    if (Schedule.doneOn(c, now)) return c && c.by && c.by !== uid ? `Done today by ${esc(Household.memberName(Household.member(h, c.by)).split(' ')[0])}` : 'Done today';
    if (Household.slot(u) === 'week' && Household.doneForNow(h, u, now)) return 'Done this week';
    return esc(Timing.label(u));
  };
  const row = (u, uid) => {
    const done = Household.doneForNow(h, u, now) || Schedule.doneOn(Household.completion(h, u.id), now);
    return `<button class="row task-row${done ? ' is-done' : ''}" data-action="openTask" data-id="${esc(u.parentId || u.id)}">
      <div class="row-text"><span class="row-title">${esc(u.name)}</span><span class="row-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${status(u, uid)}</span></div></button>`;
  };
  return ids.map(uid => {
    const units = Household.units(h).filter(u => Household.assignee(h, u.id) === uid);
    const groups = [
      ['Today', units.filter(u => Household.slot(u) === 'today')],
      ['This week', units.filter(u => Household.dueThisWeek(h, u, now))],
      ['Anytime', units.filter(u => Household.slot(u) === 'anytime')],
      ['Later', units.filter(u => Household.slot(u) === 'week' && !Household.dueThisWeek(h, u, now))],
    ].filter(([, list]) => list.length);
    const name = uid === me ? 'Your part' : `${esc(Household.memberName(Household.member(h, uid)).split(' ')[0])}'s part`;
    return `<section class="person-part ${uid === me ? 'is-me' : 'is-partner'}" aria-label="${name}">
      <div class="section-head"><h2 class="section-title">${name}</h2><span class="section-meta">${units.length}</span></div>
      ${groups.length ? groups.map(([title, list]) => `<h3 class="sub-title">${title}</h3>
        <div class="card">${list.map(u => row(u, uid)).join('')}</div>`).join('') : '<p class="fine" style="text-align:left">Nothing here yet.</p>'}
    </section>`;
  }).join('') + (homeless(h).length ? `<div class="section-head"><h2 class="section-title">Nobody has these yet</h2></div>
    <div class="card">${homeless(h).map(u => row(u, null)).join('')}</div>` : '');
}
/** Tasks nobody has yet (after "not now" in a share-out). */
function homeless(h) {
  if (Household.stage(h) !== 'active') return [];
  const sharing = new Set(((Household.activeReshare(h) || {}).unitIds) || []);
  return Household.unassigned(h).filter(u => !sharing.has(u.id));
}
/** New tasks waiting to be shared out: the organiser starts the share-out. */
function newTasksCard(h) {
  if (Household.stage(h) !== 'active' || !Household.isOwner(h, S.user.uid) || Household.activeReshare(h)) return '';
  const skipped = new Set((h.plan && h.plan.skipped) || []);
  const waiting = Household.units(h).filter(u => !Household.peopleIds(h).includes(Household.assignee(h, u.id)) && !skipped.has(u.id));
  if (!waiting.length) return '';
  return `<div class="swap-card" role="status"><p class="joke">${plural(waiting.length, 'new task')} to share out</p>
    <p class="plain">${esc(waiting.map(u => u.name).join(', '))}. You both say how you feel about ${waiting.length === 1 ? 'it' : 'them'}, then the app shares ${waiting.length === 1 ? 'it' : 'them'} out fairly.</p>
    <button class="btn primary" data-action="shareNow">Share ${waiting.length === 1 ? 'it' : 'them'} out now</button></div>`;
}
/** When nothing needs me: a calm line, the same all day, a different one tomorrow. */
const ALL_CLEAR = Object.freeze([
  'All clear. Nothing needs you right now.',
  'Nothing for now. Enjoy the quiet.',
  'All quiet on the home front.',
  'Hey, nothing for now!',
  'All clear. Let\'s keep going.',
  'Nothing waiting for you. Carry on.',
  'Nothing to sort out. Nice.',
  'All good here. Come back later.',
]);
function allClearLine(now = new Date()) {
  const dayNo = Math.floor((Schedule.day(now) - new Date(now.getFullYear(), 0, 0)) / 864e5);
  return ALL_CLEAR[dayNo % ALL_CLEAR.length];
}
/** "Reshuffle the plan", at the bottom of the task screens (it asks the other person first). */
function reshuffleBlock(h) {
  const stage = Household.stage(h);
  if (stage === 'setup' || !h.plan || Household.alone(h) || !Entitlements.active(S.subscription)) return '';
  const partner = Household.people(h).find(m => m.uid !== S.user.uid);
  const pName = esc(partner ? Household.memberName(partner) : 'your partner');
  if (h.reshuffle && h.reshuffle.status === 'pending') return `<p class="fine" style="margin-top:24px">Reshuffle asked. Waiting for ${pName}.</p>`;
  return `<div style="margin-top:24px"><button class="btn secondary" data-action="askReshuffle">Reshuffle the plan</button>
    <p class="fine">Asks ${pName} first. A swap is usually enough.</p></div>`;
}
/** Suggestions: the organiser decides; the partner sees their own, waiting. */
function suggestionsCard(h) {
  const me = S.user.uid;
  const isOrg = Household.isOwner(h, me);
  const orgName = esc(Household.memberName(Household.owner(h)));
  const all = Household.suggestions(h);
  const label = x => x.type === 'breakdown' ? `Break down: ${esc(x.name)}` : `${x.type === 'add' ? 'Add' : 'Remove'}: ${esc(x.name)}`;
  if (isOrg && all.length) {
    return `<div class="card">${all.map(x => {
      const by = esc(Household.memberName(Household.member(h, x.by) || {}));
      return `<div class="row static col">
        <div class="row-text"><span class="row-title">${label(x)}</span>
          <span class="row-sub">${x.type === 'breakdown' ? `Into ${esc((x.parts || []).map(p => p.name).join(', '))} · ` : ''}Suggested by ${by}</span></div>
        <div class="btn-pair">
          <button class="btn primary" data-action="acceptSuggestion" data-id="${esc(x.id)}">${x.type === 'add' ? 'Add it' : x.type === 'breakdown' ? 'Use these parts' : 'Remove it'}</button>
          <button class="btn secondary" data-action="declineSuggestion" data-id="${esc(x.id)}">Keep as is</button>
        </div></div>`;
    }).join('')}</div>`;
  }
  const mine = isOrg ? [] : all.filter(x => x.by === me);
  if (!mine.length) return '';
  return `<div class="card"><div class="row static"><div class="row-text"><span class="row-title">Your suggestions</span><span class="row-sub">Waiting for ${orgName}</span></div></div>
    ${mine.map(x => `<div class="row static"><div class="row-text"><span class="row-title">${label(x)}</span></div>
      <button class="link-btn" data-action="withdrawSuggestion" data-id="${esc(x.id)}">Withdraw</button></div>`).join('')}</div>`;
}
/* ---------- The line under "Hello, Ian": by time of day and how my day is going. Never about the partner. ---------- */
/** Warm one-liners for when the other person did one of your tasks. Picked by task and day, so they don't jump around. */
const HelpLines = (() => {
  const LINES = [
    (n, t) => `${n} did ${t} today. One less thing for you.`,
    (n, t) => `${t} is done. ${n} took care of it.`,
    (n, t) => `${n} covered ${t} for you today.`,
    (n, t) => `Good news: ${n} already did ${t}.`,
    (n, t) => `${t}? Done, thanks to ${n}.`,
    (n, t) => `${n} gave you a hand with ${t} today.`,
    (n, t) => `${n} beat you to ${t}. Lucky you.`,
    (n, t) => `${t} is off your list. ${n} did it.`,
  ];
  const hash = str => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { line: (name, task, key) => LINES[hash(key) % LINES.length](name, task), LINES };
})();
const Mood = (() => {
  const LINES = {
    early: {
      free: ['Nothing on today. Coffee first, then whatever you like.', 'A free day already? The house is in a good mood.'],
      fresh: ['Fresh start. One small thing and you\'re off.', 'Early bird gets the clean kitchen.'],
      going: ['Up early and already ticking. Impressive.', 'Getting things done before most people are awake.'],
      done: ['All done before breakfast? Legend.', 'Everything ticked. The rest of the day is yours.'],
    },
    morning: {
      free: ['Nothing due today. Enjoy the quiet.', 'No chores on the list. Plan something nice.'],
      fresh: ['Good morning energy. Start with the easiest one.', 'One tick and the day already feels lighter.'],
      going: ['Nice rhythm. Keep it rolling.', 'Good momentum before lunch.'],
      done: ['Done before noon? Show-off.', 'All ticked. Nothing left but the good stuff.'],
    },
    midday: {
      free: ['Lunch, then nothing. Perfect.', 'A chore-free day. Make the most of it.'],
      fresh: ['Plenty of day left. A quick one after lunch?', 'Easy does it. One at a time.'],
      going: ['Halfway there. The afternoon looks lighter already.', 'Nice progress. Snack break earned.'],
      done: ['Everything done by lunchtime. Who are you?', 'All clear. Enjoy the rest of the day.'],
    },
    afternoon: {
      free: ['Nothing on the list. Feet up whenever you like.', 'A free afternoon. Rare and precious.'],
      fresh: ['Ten minutes now, a calmer evening later.', 'Still plenty of day left. Start small.'],
      going: ['Getting there. The finish line is in sight.', 'A little more and you\'re done.'],
      done: ['All done. The evening is officially yours.', 'Ticked it all. Time for something fun.'],
    },
    evening: {
      free: ['Nothing to do tonight. Enjoy it.', 'Quiet evening, clear list.'],
      fresh: ['Still time. Or tomorrow, we won\'t tell.', 'Just one before the sofa?'],
      going: ['Almost there. The sofa is waiting.', 'Last stretch. You\'ve got this.'],
      done: ['Home sorted. Feet up. 🛋️', 'Everything done. A well-earned evening.'],
    },
    night: {
      free: ['Nothing due. Sleep well.', 'All quiet. See you tomorrow.'],
      fresh: ['It\'s late. Tomorrow is a fine day for chores.', 'Rest now. The list will still be there.'],
      going: ['Good effort today. The rest can wait.', 'Time to rest. You did plenty.'],
      done: ['Everything done today. Sleep like a hero.', 'Day complete. Good night.'],
    },
  };
  const slot = hour => hour >= 5 && hour < 9 ? 'early' : hour < 12 && hour >= 9 ? 'morning' : hour >= 12 && hour < 14 ? 'midday'
    : hour >= 14 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 22 ? 'evening' : 'night';
  const state = p => !p.total ? 'free' : p.done >= p.total ? 'done' : p.done > 0 ? 'going' : 'fresh';
  return {
    LINES,
    /** Same line all day for the same situation; a different one tomorrow. */
    line(now, progress) {
      const options = LINES[slot(now.getHours())][state(progress)];
      const dayNo = Math.floor((Schedule.day(now) - new Date(now.getFullYear(), 0, 0)) / 864e5);
      return options[dayNo % options.length];
    },
  };
})();


/* ---------- Board ---------- */
const NOTE_KINDS = {
  note:  { icon: 'note', label: 'Note',        hint: 'Stays on the board for 7 days.',                               placeholder: 'e.g. Plumber comes Thursday at 10' },
  low:   { icon: 'low', label: 'Running low', hint: 'Goes to whoever looks after it, until someone has got it.',     placeholder: 'e.g. Dishwasher tabs' },
  today: { icon: 'today', label: 'Today only',  hint: 'Whoever taps "I\'ll do it" first gets it on their Today list.', placeholder: 'e.g. Take the parcel to the post office' },
};
function boardSeenKey(h) { return `household-app/board-seen/${h.id}/${S.user.uid}`; }
function boardSeenAt(h) { return Number(SafeStorage.get(boardSeenKey(h)) || 0); }
function boardUnseen(h) { return Household.unseenNotes(h, S.user.uid, boardSeenAt(h)); }
/** Open or close the board. Opening remembers what was new, so it keeps its "New" tag while open. */
function openBoard(open) {
  if (open && !S.boardOpen && S.household && S.user) S.boardSeenBefore = boardSeenAt(S.household);
  S.boardOpen = !!open;
}
/** Board items waiting for me: running low for me, up for grabs, or new since I last looked. */
function boardWaiting(h) {
  const me = S.user.uid;
  const seen = S.boardOpen ? (S.boardSeenBefore || 0) : boardSeenAt(h);
  const map = new Map();
  Household.boardNotes(h).forEach(n => {
    const w = Household.noteWaiting(h, n, me);
    const fresh = n.by !== me && n.createdAt > seen;
    if (w || fresh) map.set(n.id, { mine: w === 'mine', grab: w === 'grab', fresh });
  });
  return map;
}

/** The board on Home; opens in place. Gold edge while something waits for me. */
function boardCard(h) {
  const me = S.user.uid;
  const partner = h.members.find(m => m.uid !== me);
  const partnerName = partner ? Household.memberName(partner) : '';
  const items = Household.boardNotes(h);
  const waiting = boardWaiting(h);
  if (S.boardOpen) SafeStorage.set(boardSeenKey(h), String(Date.now()));
  const count = waiting.size;
  const meta = !items.length ? (partnerName ? `Leave a note for ${esc(partnerName)}` : 'Leave a note')
    : count ? `<b>${count} need${count === 1 ? 's' : ''} action</b>` : plural(items.length, 'note');
  const head = `<button class="board-head" data-action="${items.length ? 'toggleBoard' : 'addNote'}" aria-expanded="${!!S.boardOpen}">
      <span class="board-icon" aria-hidden="true">${Icon.board}</span><span class="board-title">Board</span>
      <span class="board-meta">${meta}</span>
      <span class="board-chev" aria-hidden="true">${items.length ? (S.boardOpen ? '–' : '+') : '+'}</span></button>`;
  const cls = `board${count ? ' waiting' : ''}`;
  if (!S.boardOpen || !items.length) return `<div class="${cls}">${head}</div>`;
  const now = new Date();
  const tags = w => !w ? '' : [w.mine ? 'For you' : '', w.grab ? 'Up for grabs' : '', w.fresh ? 'New' : '']
    .filter(Boolean).map(t => `<span class="note-tag">${t}</span>`).join('');
  const row = n => {
    const k = NOTE_KINDS[n.kind];
    const author = n.by === me ? 'You' : esc(Household.memberName(Household.member(h, n.by) || {}));
    let sub = `${author} · ${Schedule.relative(new Date(n.createdAt), now)}`;
    let act = '';
    if (n.kind === 'low') {
      const t = Household.noteTarget(h, n);
      sub = `${t ? (t.uid === me ? 'For you' : 'For ' + esc(Household.memberName(Household.member(h, t.uid) || {}))) + ' · ' + esc(t.via) : 'For whoever gets there first'} · ${sub}`;
      act = `<button class="mini" data-action="gotNote" data-id="${esc(n.id)}">Got it</button>`;
    } else if (n.kind === 'today') {
      act = `<button class="mini" data-action="claimNote" data-id="${esc(n.id)}">I'll do it</button>`;
    }
    const del = n.by === me ? `<button class="note-del" data-action="deleteNote" data-id="${esc(n.id)}" aria-label="Delete note">×</button>` : '';
    const w = waiting.get(n.id);
    return `<div class="note-row${w ? ' waiting' : ''}"><span class="note-kind" role="img" aria-label="${k.label}" title="${k.label}">${Icon[k.icon]}</span>
      <div class="row-text">${w ? `<span class="note-tags">${tags(w)}</span>` : ''}<span class="note-text">${esc(n.text)}</span><span class="row-sub">${sub}</span></div>${act}${del}</div>`;
  };
  return `<div class="${cls} open">${head}<div class="board-items">${items.map(row).join('')}</div>
    <button class="btn secondary board-add" data-action="addNote">Add to the board</button></div>`;
}

/** A board item on someone's Today list: tick it and it's gone. */
function noteTaskRow(h, n, ownerId, everyone) {
  const me = S.user.uid;
  const k = NOTE_KINDS[n.kind];
  const by = n.by === me ? 'your note' : `${esc(Household.memberName(Household.member(h, n.by) || {}))}'s note`;
  const who = everyone ? (ownerId === me ? 'You · ' : esc(Household.memberName(Household.member(h, ownerId) || {})) + ' · ') : '';
  const sub = n.kind === 'low' ? `${who}Running low · ${by}` : `${who}Today only · ${by}`;
  return `<button class="row" data-action="doneNote" data-id="${esc(n.id)}" aria-pressed="false">
    <span class="check" aria-hidden="true">${Icon.check}</span>
    <div class="row-text"><span class="row-title"><span class="title-icon" aria-hidden="true">${Icon[k.icon]}</span>${n.kind === 'low' ? 'Get ' : ''}${esc(n.text)}</span><span class="row-sub">${sub}</span></div></button>`;
}

/** "parts" when only task parts are being shared, otherwise "tasks". */
function reshareNoun(h, rsh) { return (rsh.unitIds || []).every(id => Household.parentOf(h, id)) ? 'part' : 'task'; }

/** Something on Home is waiting for me: a swap, a share-out, a reshuffle, suggestions, new notes, a payment. */
function homeNeedsMe(h) {
  const me = S.user.uid;
  if (Household.incomingSwap(h, me) || Household.swapResults(h, me).length) return true;
  const rs = Household.reshuffle(h);
  if (rs && rs.status === 'pending' && rs.by !== me) return true;
  if (rs && rs.status === 'declined' && rs.by === me && !rs.seen) return true;
  const rsh = Household.activeReshare(h);
  if (rsh && rsh.status === 'rating' && !(rsh.done || {})[me]) return true;
  if (rsh && rsh.status === 'proposed' && !(rsh.accepted || {})[me]) return true;
  if (Household.isOwner(h, me) && Household.suggestions(h).length) return true;
  if (boardWaiting(h).size) return true;
  return !!statusBanner(h);
}

/** Red dots on the bottom tabs: every tab where an action is waiting for me. */
function navDots(h) { return { household: homeNeedsMe(h) }; }

/** Incoming swap requests and results of my own requests (on Plan and Today). */
function swapCards(h) {
  const me = S.user.uid;
  const name = id => esc(Household.memberName(Household.member(h, id) || {}));
  const taskName = id => Household.unitName(h, id);
  const incoming = Household.incomingSwap(h, me);
  const results = Household.swapResults(h, me);
  let html = '';
  if (incoming) {
    html += `<div class="swap-card" role="status">
      <p class="joke">${SwapMessages.pick('request', incoming.id, { name: Household.memberName(Household.member(h, incoming.from) || {}), task: taskName(incoming.respId) })}</p>
      <p class="plain">If you take it, you pick one of your tasks to give ${name(incoming.from)} in return.</p>
      <div class="btns">
        <button class="btn primary" data-action="takeSwap" data-id="${esc(incoming.id)}">Deal, I'll take it</button>
        <button class="btn secondary" data-action="declineSwap" data-id="${esc(incoming.id)}">Nope, it's yours</button>
      </div></div>`;
  }
  const rs = Household.reshuffle(h);
  if (rs && rs.status === 'pending' && rs.by !== me) {
    html += `<div class="swap-card" role="status">
      <p class="joke">${name(rs.by)} would like to reshuffle the whole plan. 🔀</p>
      <p class="plain">You'd both answer again how you feel about each task, and get a fresh split. Your ticks are kept; swaps start over.</p>
      <div class="btns">
        <button class="btn primary" data-action="acceptReshuffle">Let's reshuffle</button>
        <button class="btn secondary" data-action="declineReshuffle">Keep our plan</button>
      </div></div>`;
  } else if (rs && rs.status === 'declined' && rs.by === me && !rs.seen) {
    html += `<div class="result-card" role="status"><p class="joke">They'd rather keep the current plan.</p>
      <p class="plain">Nothing changes. You can still swap single tasks.</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissReshuffle">Dismiss</button></div>`;
  }
  const rsh = Household.activeReshare(h);
  const noun = rsh ? reshareNoun(h, rsh) : '';
  if (rsh && rsh.status === 'rating' && !(rsh.done || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">Time to share out the new ${noun}s ✂️</p>
      <p class="plain">Say how you feel about ${plural((rsh.unitIds || []).length, 'new ' + noun)}. It only takes a moment.</p>
      <button class="btn primary" data-action="nav" data-to="reshare">Rate the new ${noun}s</button></div>`;
  } else if (rsh && rsh.status === 'proposed' && !(rsh.accepted || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">The new ${noun}s have been shared out.</p>
      <p class="plain">Have a look and say yes if it works for you.</p>
      <button class="btn primary" data-action="nav" data-to="reshare">See the changes</button></div>`;
  }
  results.forEach(x => {
    const vars = { name: Household.memberName(Household.member(h, x.to) || {}), task: taskName(x.respId), other: x.gave ? taskName(x.gave) : 'nothing' };
    const plain = x.status === 'done'
      ? `${esc(vars.task)} is now ${name(x.to)}'s.${x.gave ? ` ${esc(vars.other)} is now yours.` : ''}`
      : `${name(x.to)} declined. ${esc(vars.task)} stays yours.`;
    html += `<div class="result-card" role="status">
      <p class="joke">${SwapMessages.pick(x.status === 'done' ? 'done' : 'declined', x.id, vars)}</p>
      <p class="plain">${plain}</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissSwap" data-id="${esc(x.id)}">Dismiss</button></div>`;
  });
  return html;
}


/* ---------- Shared pieces ---------- */
function frequencyOptions(sel) {
  return FREQUENCIES.map(f => `<option value="${esc(f.id)}" ${f.id === sel ? 'selected' : ''}>${f.label}</option>`).join('');
}
function minuteOptions(sel) {
  const opts = MINUTE_OPTIONS.includes(sel) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, sel].sort((a, b) => a - b);
  return opts.map(m => `<option value="${esc(m)}" ${m === sel ? 'selected' : ''}>${formatMinutes(m)}</option>`).join('');
}
/** Has this household's organiser ever had a subscription or a grant (to say "ended" rather than "start")? */
function everSubscribed() {
  return !!S.grant || !Array.isArray(S.stripeSubs) || S.stripeSubs.length > 0;
}
/** Will a yearly checkout start with the free trial? (Unknown counts as no, so we never promise it wrongly.) */
function trialOffer() {
  return Backend.Billing.enabled() && watchers.subLoaded && !Entitlements.hadSubscription(S.stripeSubs);
}
function legalLine() {
  return `<p class="fine legal-line">By continuing you agree to the <a href="legal.html#terms" target="_blank" rel="noopener">Terms</a> and <a href="legal.html#privacy" target="_blank" rel="noopener">Privacy policy</a>.</p>`;
}
/** One task with Happy / Don't mind / Rather not. Nothing marked counts as Don't mind. */
function prefRow(h, me, r) {
  const v = prefValue(h, me, r);
  return `<div class="pref-row" role="group" aria-labelledby="pn-${esc(r.id)}">
    <button class="name-btn" data-action="peek" data-id="${esc(r.id)}"><span class="row-title" id="pn-${esc(r.id)}">${esc(r.name)}</span>
      <span class="row-sub">${r.parentName ? esc(r.parentName) + ' · ' : ''}${esc(Timing.label(r))}</span></button>
    <div class="pref-group">${PREFERENCES.map(p => `<button class="pref-btn pref-${p.id}" data-action="setPref" data-id="${esc(r.id)}" data-key="${esc(p.id)}" aria-pressed="${v === p.id}" aria-label="${p.label}" title="${p.label}">${Icon[p.icon]}</button>`).join('')}</div>
  </div>`;
}
/** The whole household's work in one number. */
function totalCard(h) {
  return `<div class="card hero-card">
    <span class="hero-num">${formatMinutes(Household.weeklyTotal(h))}</span>
    <span class="hero-sub">a week keeps your home running · ${plural(Household.units(h).length, 'task')}</span>
  </div>`;
}
/** The organiser's "who does it today" — the before, so the plan's after means something. */
function baselineCard(h) {
  const partner = esc(Household.memberName(Household.people(h).find(m => m.uid !== h.ownerId) || Household.invitee(h)));
  const b = h.settings.baseline;
  const options = [['me', 'Mostly me'], ['half', 'About half each'], ['them', `Mostly ${partner}`]];
  const after = {
    me: `With this plan, ${partner} takes on about half. That's a real change, so it's worth showing them.`,
    half: 'This plan keeps it even, and makes it visible for both of you.',
    them: `With this plan, you take on about half. ${partner} will like that.`,
  }[b];
  return `<div class="card"><div class="row static col">
    <div class="row-text"><span class="row-title">Right now, who does most of it?</span></div>
    <div class="chips" role="group" aria-label="Who does most of it today">${options.map(([k, l]) =>
      `<button class="chip" data-action="setBaseline" data-key="${esc(k)}" aria-pressed="${b === k}">${l}</button>`).join('')}</div>
    ${after ? `<p class="plain" style="margin:4px 0 0">${after}</p>` : ''}
  </div></div>`;
}
/** Payment reminders for the organiser (shown under "Needs you" on Home). */
function statusBanner(h) {
  const sub = S.subscription;
  if (!Household.isOwner(h, S.user.uid) || !sub || sub.source !== 'stripe') return '';
  if (sub.status === 'past_due') {
    return `<div class="card next-card"><h2>Your payment didn't go through</h2>
      <p>Update your card so your plan keeps running for both of you.</p>
      <button class="btn secondary" data-action="openPortal">Fix payment</button></div>`;
  }
  if (sub.status === 'trialing' && sub.trialEnd && !sub.cancelAtPeriodEnd && sub.trialEnd - Date.now() < 3 * 864e5) {
    const d = new Date(sub.trialEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    const amount = money(sub.interval === 'month' ? APP_CONFIG.billing.display.monthly : APP_CONFIG.billing.display.yearly);
    return `<div class="card next-card"><h2>Your free trial ends on ${d}</h2>
      <p>Then it continues for ${amount} per ${sub.interval || 'year'}. Nothing to do if you'd like to keep it.</p>
      <button class="btn secondary" data-action="openPortal">Manage subscription</button></div>`;
  }
  return '';
}


/* =========================================================
   SHEETS
   ========================================================= */
const Sheets = {
  /** Right after subscribing: the next step is the invite (a tap, so the share sheet can open). */
  /** Tapping "Break into parts" before subscribing: what it is, and the way to get it. */
  partsNeedSubscription() {
    const trial = trialOffer();
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>Break tasks into parts</h2>
      <p>Split big jobs like Clean bathroom into smaller tasks, each with its own timing, and share them out fairly. It comes with your subscription.</p>
      <button class="btn premium" data-action="sheetNav" data-to="subscribe">${trial ? `Start free for ${APP_CONFIG.billing.trialDays} days` : 'See plans'}</button>
      <button class="btn ghost" data-action="closeSheet">Not now</button>`, 'Break tasks into parts');
  },

  unlocked() {
    const h = S.household;
    const name = esc(Household.memberName(Household.invitee(h)));
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>You're all set 🎉</h2>
      <p>Now send the plan to ${name}. They mark anything that doesn't suit them, and you start together.</p>
      <button class="btn primary" data-action="invite">Invite ${name}</button>
      <button class="btn ghost" data-action="closeSheet">Later</button>`, "You're all set");
  },

  /** A task of your own. */
  customTask() {
    const d = S.customDraft || (S.customDraft = { name: '', category: 'organisation', frequency: 'weekly', minutes: 15 });
    Sheet.open(`<h2>Add your own task</h2>
      <div class="field"><label for="ct-name">What needs doing?</label>
        <input id="ct-name" data-input="customName" maxlength="60" placeholder="e.g. Clean the aquarium" value="${esc(d.name)}" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><label for="ct-cat">Area</label>
        <select id="ct-cat" class="select" data-change="customCategory">${LIBRARY.categories.map(c => `<option value="${esc(c.id)}" ${c.id === d.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>How often, and how long?</label>
        <div class="timing-controls">
          <select class="select" data-change="customFrequency" aria-label="How often">${frequencyOptions(d.frequency)}</select>
          <select class="select minutes" data-change="customMinutes" aria-label="How long each time">${minuteOptions(d.minutes)}</select>
        </div></div>
      <button class="btn primary" data-action="saveCustomTask">Add task</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Add your own task');
  },

  /** One task: who has it, what it includes, and everything you can do with it (nothing is ticked here). */
  taskPeek(r) {
    const h = S.household;
    const me = S.user.uid;
    const stage = Household.stage(h);
    const planned = stage !== 'setup' && !!h.plan;
    const split = Household.isSplit(r);
    const isOrg = Household.isOwner(h, me);
    // On Our Tasks (suggesting changes) the sheet is only about the list: no swapping or taking over here.
    const suggesting = !!S.suggestMode;
    const canSwap = planned && !Household.alone(h) && !suggesting;
    const free = new Set(suggesting ? [] : homeless(h).map(u => u.id));
    const ownerName = uid => uid === me ? 'Yours' : Household.peopleIds(h).includes(uid) ? `${Household.memberName(Household.member(h, uid))}'s` : 'Nobody has it yet';
    const action = id => {
      const who = Household.assignee(h, id);
      if (!suggesting && Household.canCover(h, id, me)) return `<button class="mini" data-action="coverTask" data-id="${esc(id)}">I did it</button>`;
      if (!suggesting && Household.coveredByMe(h, id, me)) return `<button class="mini" data-action="coverTask" data-id="${esc(id)}">Undo</button>`;
      if (free.has(id)) return `<button class="mini" data-action="claim" data-id="${esc(id)}">I'll take it</button>`;
      if (who !== me || !canSwap) return '';
      return Household.pendingFor(h, id) ? '<span class="tag">Swap asked</span>' : `<button class="mini" data-action="askSwap" data-id="${esc(id)}">Swap</button>`;
    };
    const facts = [esc(Timing.label(r))];
    if (Timing.of(r).rooms > 1) facts.push(`${formatMinutes(Timing.of(r).each)} for each bathroom`);
    if (r.mentalLoad) facts.push('Mental load');

    let owner = '', body = '';
    if (split) {
      body = `<h3 class="section-title" style="margin:0 0 8px">Broken into</h3>
        <div class="card sheet-list">${Household.parts(r).map(p => {
          const pu = Household.partUnit(r, p);
          const who = Household.assignee(h, p.id);
          return `<div class="row static"><div class="row-text"><span class="row-title">${esc(p.name)}</span>
            <span class="row-sub">${planned ? esc(ownerName(who)) + ' · ' : ''}${esc(Timing.label(pu))}</span></div>${planned ? action(p.id) : ''}</div>`;
        }).join('')}</div>`;
    } else {
      const who = Household.assignee(h, r.id);
      if (planned) owner = `<div class="sheet-owner">${ownerBadges(h, r)}<span>${esc(ownerName(who))}</span></div>`;
      const includes = Library.parts(r.libraryId);
      body = includes.length ? `<h3 class="section-title" style="margin:0 0 8px">Includes</h3>
        <ul class="part-chips">${includes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    }
    const who = Household.assignee(h, r.id);
    const main = split || !planned ? ''
      : !suggesting && Household.canCover(h, r.id, me) ? `<button class="btn primary" data-action="coverTask" data-id="${esc(r.id)}">I did this</button>
         <p class="fine" style="margin:-4px 0 12px">It comes off ${esc(Household.memberName(Household.member(h, who)))}'s list for now.</p>`
      : !suggesting && Household.coveredByMe(h, r.id, me) ? `<p class="fine" style="margin:0 0 12px">You did this today. Thank you!</p>
         <button class="btn secondary" data-action="coverTask" data-id="${esc(r.id)}">Undo</button>`
      : free.has(r.id) ? `<button class="btn primary" data-action="claim" data-id="${esc(r.id)}">I'll take it</button>` : '';
    const canBreak = (split || Library.parts(r.libraryId).length) && stage !== 'setup';
    // Secondary actions: one row of labelled icons instead of a stack of buttons.
    const act = (action, icon, label, opts = {}) => `<button class="icon-action${opts.on ? ' on' : ''}${opts.danger ? ' danger' : ''}" data-action="${action}" data-id="${esc(r.id)}"${opts.disabled ? ' disabled' : ''}>
        <span class="ia-circle" aria-hidden="true">${Icon[icon]}</span><span class="ia-label">${label}</span></button>`;
    const actions = [];
    if (!split && planned && who === me && canSwap) {
      actions.push(Household.pendingFor(h, r.id) ? act('askSwap', 'swap', 'Asked', { on: true, disabled: true }) : act('askSwap', 'swap', 'Swap'));
    }
    if (canBreak) actions.push(act('openBreakdown', 'parts', isOrg ? (split ? 'Parts' : 'Split up') : 'Suggest parts'));
    if (!isOrg && stage !== 'setup') {
      const asked = Household.suggestionFor(h, me, 'remove', r.id);
      actions.push(act('suggestRemoval', 'trash', asked ? 'Suggested' : 'Remove?', { on: !!asked }));
    }
    if (isOrg && !r.predefined) actions.push(act('removeTask', 'trash', 'Remove', { danger: true }));
    Sheet.open(`<h2>${esc(r.name)}</h2>
      ${owner}
      <p class="sheet-facts">${facts.join(' · ')}</p>
      ${body}
      ${main}
      ${actions.length ? `<div class="icon-actions">${actions.join('')}</div>` : ''}
      <button class="btn ghost" data-action="closeSheet">Close</button>`, r.name);
  },

  /** Your name, as it shows in the app for both of you. */
  editName() {
    const me = Household.member(S.household, S.user.uid);
    Sheet.open(`<h2>Your name</h2>
      <div class="card"><div class="field">
        <label for="edit-name">How it shows in the app</label>
        <input id="edit-name" value="${esc(me ? me.name : '')}" placeholder="Your name" autocomplete="given-name" maxlength="40">
      </div></div>
      <button class="btn primary" data-action="saveName">Save</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Your name');
    const input = document.getElementById('edit-name');
    if (input) { input.focus(); input.select(); input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); Actions.saveName(); } }); }
  },

  /** Change the password (accounts that sign in with an email and password). */
  changePassword() {
    Sheet.open(`<h2>Change password</h2>
      <form class="card" data-form="password" autocomplete="on">
        <input type="email" name="username" autocomplete="username" value="${esc(S.user.email || '')}" hidden>
        <div class="field"><label for="pw-current">Current password</label>
          <input id="pw-current" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="pw-new">New password</label>
          <input id="pw-new" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label for="pw-new2">Repeat new password</label>
          <input id="pw-new2" type="password" autocomplete="new-password" minlength="8" required></div>
        <p class="fine" style="text-align:left;margin:0;padding:0 16px 12px">At least 8 characters.</p>
      </form>
      <button class="btn primary" data-action="savePassword">Save new password</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Change password');
  },

  /** The invite link, when the phone's share sheet isn't available (or was closed). */
  invite({ link, text, name }) {
    const canShare = typeof navigator.share === 'function';
    Sheet.open(`<h2>Send ${esc(name)} the plan</h2>
      <p>${esc(text)}</p>
      <div class="link-box"><code>${esc(link)}</code></div>
      ${canShare ? `<button class="btn primary" data-action="shareInvite">Share</button>` : ''}
      <button class="btn ${canShare ? 'secondary' : 'primary'}" data-action="copyInvite">${Icon.copy} Copy message and link</button>
      <p class="fine">The link works once and expires in ${APP_CONFIG.inviteValidDays} days.</p>`, 'Invite');
  },

  /** Asking to start the whole split over. Not recommended, so it's worded honestly. */
  /** After a time change makes the split uneven. */
  timeRebalance() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>The split is a little uneven now</h2>
      <p>With the new time, one of you has more to do each week. A reshuffle makes a fresh, fair split from the same answers. ${others.join(' and ')} will be asked to agree first.</p>
      <button class="btn primary" data-action="requestReshuffle">Ask ${others.join(' and ')} to reshuffle</button>
      <button class="btn ghost" data-action="closeSheet">Not now</button>`, 'Rebalance');
  },
  askReshuffle() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>Reshuffle the whole plan?</h2>
      <p>The app makes a fresh split from the same answers. Your ticks are kept, but any swaps start over, and you both say yes again.</p>
      <p style="margin-top:-8px">Usually a swap is enough. ${others.join(' and ')} will be asked to agree first.</p>
      <button class="btn secondary" data-action="requestReshuffle">Ask ${others.join(' and ')}</button>
      <button class="btn ghost" data-action="closeSheet">Keep my plan</button>`, 'Reshuffle');
  },

  /** Add something to the board. */
  addNote() {
    const d = S.noteDraft || (S.noteDraft = { kind: 'note', text: '' });
    const k = NOTE_KINDS[d.kind];
    Sheet.open(`<h2>Add to the board</h2>
      <div class="chips" role="group" aria-label="Kind" style="margin-bottom:10px">${Object.entries(NOTE_KINDS).map(([id, x]) =>
        `<button class="chip" data-action="noteKind" data-key="${esc(id)}" aria-pressed="${d.kind === id}"><span class="chip-icon" aria-hidden="true">${Icon[x.icon]}</span>${x.label}</button>`).join('')}</div>
      <p style="margin-bottom:12px">${esc(k.hint)}</p>
      <div class="field"><input id="note-text" data-input="noteText" maxlength="${Household.NOTE_MAX_LENGTH}" placeholder="${esc(k.placeholder)}" value="${esc(d.text)}" autocomplete="off" enterkeyhint="done"></div>
      <button class="btn primary" data-action="postNote">Add</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Add to the board');
    const input = document.getElementById('note-text');
    if (input) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
  },

  /** Settings → Send feedback: a short note that lands in the admin panel. */
  feedback() {
    const text = S.feedbackDraft || '';
    Sheet.open(`<h2>Send feedback</h2>
      <p style="margin-bottom:12px">What works, what doesn't, or what confused you. Every note is read.</p>
      <div class="field"><textarea id="feedback-text" data-input="feedbackText" maxlength="1000" rows="5" placeholder="e.g. I couldn't find where to change who does a task">${esc(text)}</textarea></div>
      <p class="fine" style="text-align:left;margin:6px 0 14px">Your name and the screen you were on are sent with it.</p>
      <button class="btn primary" data-action="sendFeedback">Send</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Send feedback');
    const input = document.getElementById('feedback-text');
    if (input) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
  },

  /** Offering one of my tasks to someone else. */
  askSwap(respId) {
    const h = S.household;
    const r = Household.unit(h, respId) || h.responsibilities.find(x => x.id === respId);
    if (!r) return;
    const others = h.members.filter(m => m.uid !== S.user.uid);
    const offer = m => `<button class="btn primary" data-action="sendSwap" data-id="${esc(respId)}" data-to="${esc(m.uid)}">Offer it to ${esc(Household.memberName(m))}</button>`;
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
      <div class="card">${mine.map(r => `<button class="row" data-action="completeSwap" data-id="${esc(swap.id)}" data-key="${esc(r.id)}">
          <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
          <span class="chev">${Icon.chev}</span></button>`).join('') ||
        `<button class="row" data-action="completeSwap" data-id="${esc(swap.id)}" data-key=""><div class="row-text"><span class="row-title">I have nothing to give, just take it</span></div></button>`}</div>
      <button class="btn ghost" data-action="closeSheet">Back</button>`, 'Pick what to give back');
  },

  /** Delete the household. With a subscription still renewing, cancelling comes first (recommended). */
  confirmDelete(subRunning) {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    const sub = subRunning ? `<p style="margin-bottom:12px"><b style="color:var(--ink)">Your subscription keeps running</b> unless you cancel it. Deleting the household doesn't stop it.</p>` : '';
    Sheet.open(`<h2>There's no way back</h2>
      <p style="margin-bottom:12px">Deleting the household removes its tasks, your plan, everything you've ticked off${others.length ? ` and ${others.join(' and ')}'s place in it` : ''}. It's gone for good, for everyone.</p>
      ${sub}
      <p><b style="color:var(--ink)">Do you still want to delete the household?</b></p>
      ${subRunning
        ? `<button class="btn danger" data-action="cancelThen" data-key="deleteHousehold">Cancel subscription, then delete</button>
           <button class="btn secondary" data-action="deleteHousehold">Delete and keep my subscription</button>`
        : `<button class="btn danger" data-action="deleteHousehold">Yes, delete household</button>`}
      <button class="btn ghost" data-action="closeSheet">No, keep it</button>`, 'Delete household');
  },

  /** Leave. The partner just goes; the organiser hands over to the partner. */
  confirmLeave(subRunning) {
    const h = S.household;
    const me = S.user.uid;
    if (!Household.isOwner(h, me)) {
      const ownerName = esc(Household.memberName(Household.owner(h)));
      Sheet.open(`<h2>Leave this household?</h2>
        <p>Your answers and notes are removed. Your ticks stay as household history, without your name. You'd need a new invite from ${ownerName} to come back.</p>
        <button class="btn danger" data-action="leaveHousehold">Leave household</button>
        <button class="btn ghost" data-action="closeSheet">Stay</button>`, 'Leave household');
      return;
    }
    const partner = esc(Household.memberName(Household.member(h, Household.partnerId(h))));
    Sheet.open(`<h2>Leave the household?</h2>
      <p>${partner} becomes the organiser and keeps the plan, tasks and history. Your answers and notes are removed.</p>
      ${subRunning ? `<p><b style="color:var(--ink)">Your subscription is yours</b>, so it doesn't move to ${partner}. If you leave without cancelling, you keep paying for a home you're no longer in.</p>` : ''}
      ${subRunning
        ? `<button class="btn danger" data-action="cancelThen" data-key="leave">Cancel my subscription, then leave</button>
           <button class="btn secondary" data-action="leaveHousehold">Leave and keep my subscription</button>`
        : `<button class="btn danger" data-action="leaveHousehold">Leave household</button>`}
      <button class="btn ghost" data-action="closeSheet">Stay</button>`, 'Leave household');
  },

  /** Delete my account: what happens to the household, and the subscription first. */
  deleteAccount(running) {
    const h = S.household;
    const me = S.user.uid;
    if (running) {
      Sheet.open(`<h2>Cancel your subscription first</h2>
        <p>You have a subscription that renews. Cancel it first so you're not charged again after your account is gone. You'll come straight back here.</p>
        <button class="btn danger" data-action="cancelThen" data-key="deleteAccount">Cancel my subscription</button>
        <button class="btn secondary" data-action="confirmDeleteAccount">I've cancelled, check again</button>
        <button class="btn ghost" data-action="closeSheet">Keep my account</button>`, 'Delete my account');
      return;
    }
    let household = '';
    if (h && Household.isOwner(h, me) && Household.alone(h)) household = 'Your household is deleted with it.';
    else if (h && Household.isOwner(h, me)) household = `You leave the household and ${esc(Household.memberName(Household.member(h, Household.partnerId(h))))} becomes the organiser.`;
    else if (h) household = 'You leave the household; your answers and notes are removed.';
    Sheet.open(`<h2>Delete your account?</h2>
      <p style="margin-bottom:12px">This removes your name, email and sign-in. ${household} Payment records that tax law requires stay with Stripe.</p>
      <p><b style="color:var(--ink)">There's no way back.</b></p>
      <button class="btn danger" data-action="deleteAccount">Delete my account</button>
      <button class="btn ghost" data-action="closeSheet">Keep my account</button>`, 'Delete my account');
  },

  /** Back from Stripe: finish leaving / deleting, or say the subscription is still running. */
  afterCancel(then, stillRunning) {
    if (then === 'deleteAccount') { Sheets.deleteAccount(); return; }
    const leave = then === 'leave';
    const what = leave ? 'Leave the household' : 'Delete the household';
    Sheet.open(stillRunning
      ? `<h2>Your subscription is still running</h2>
         <p>It looks like it wasn't cancelled. You can try again, or go ahead anyway.</p>
         <button class="btn secondary" data-action="cancelThen" data-key="${leave ? 'leave' : 'deleteHousehold'}">Cancel my subscription</button>
         <button class="btn danger" data-action="${leave ? 'leaveHousehold' : 'deleteHousehold'}">${what} anyway</button>
         <button class="btn ghost" data-action="closeSheet">Not now</button>`
      : `<h2>Subscription cancelled</h2>
         <p>You won't be charged again. ${what} now?</p>
         <button class="btn danger" data-action="${leave ? 'leaveHousehold' : 'deleteHousehold'}">${what}</button>
         <button class="btn ghost" data-action="closeSheet">Not now</button>`, what);
  },

  notice(title, body) {
    Sheet.open(`<h2>${esc(title)}</h2><p>${esc(body)}</p>
      <button class="btn primary" data-action="closeSheet">OK</button>`, title);
  },
};
