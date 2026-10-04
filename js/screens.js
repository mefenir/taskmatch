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
      <h1>${invited ? `${from || 'Your partner'} made a plan for your home` : 'Share your home fairly, without the arguments.'}</h1>
      <p class="lead">${invited
        ? "See who would do what, and mark anything that doesn't suit you. It takes about a minute."
        : 'Set up your home in a few minutes, see how much work it really is, and get a fair split for the two of you.'}</p>
      ${invited ? '' : `<ol class="how">
        <li>List what your home needs</li>
        <li>Say what you like doing and what you'd rather not</li>
        <li>Get a fair split, then invite your partner to look at it</li>
      </ol>`}
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
    const first = S.user && S.user.displayName ? ' ' + esc(S.user.displayName.split(' ')[0]) : '';
    return `<main class="screen welcome">
      <div class="topbar"><span class="spacer"></span>
        <button class="link-btn" data-action="signOut" style="margin:0">Sign out</button></div>
      ${houseArt}
      <h1>Hi${first}. Let's set up your home.</h1>
      <p class="lead">It takes a few minutes. At the end you'll see a fair split, and then you invite your partner to look at it.</p>
      <div class="bottom-bar">
        <button class="btn primary" data-action="createHousehold">Set up our home</button>
        <p class="fine">Has your partner already set it up? Open the invite link they sent you.</p>
      </div>
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
      ${topbar({ back: setup ? null : 'inventory', step: setup ? 'members' : null })}
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
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="${esc(setup ? 'home' : 'inventory')}">${setup ? 'Continue' : 'Done'}</button></div>
    </main>`;
  },

  home() {
    const h = S.household;
    const setup = !h.settings.onboarded;
    const petTypes = [['dog', 'Dog'], ['cat', 'Cat'], ['other', 'Other pet']];
    const pets = `<button class="chip" data-action="clearPets" aria-pressed="${h.pets.length === 0}">None</button>` +
      petTypes.map(([t, l]) => `<button class="chip" data-action="togglePet" data-key="${esc(t)}" aria-pressed="${h.pets.some(p => p.type === t)}">${l}</button>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'members' : 'inventory', step: setup ? 'home' : null })}
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
      <div class="bottom-bar"><button class="btn primary" data-action="nav" data-to="${esc(setup ? 'responsibilities' : 'inventory')}">${setup ? 'Show what needs doing' : 'Done'}</button></div>
    </main>`;
  },

  responsibilities() {
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
      return `<section aria-labelledby="cat-${esc(category.id)}">
        <div class="section-head">
          <h2 class="section-title" id="cat-${esc(category.id)}">${esc(category.name)}</h2>
          <button class="link-btn" data-action="toggleCategory" data-cat="${esc(category.id)}">${all ? 'Clear' : 'Select all'}</button>
        </div>
        <div class="card">${rows}</div>
      </section>`;
    }).join('');
    const own = h.responsibilities.filter(r => !r.predefined);
    const ownSection = own.length ? `<div class="section-head"><h2 class="section-title">Your own</h2></div>
      <div class="card">${own.map(r => `<div class="row static"><span class="check" style="color:var(--accent)" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(Timing.label(r))}</span></div>
        <button class="link-btn" data-action="removeTask" data-id="${esc(r.id)}">Remove</button></div>`).join('')}</div>` : '';
    const count = h.responsibilities.length;
    const active = Household.stage(h) === 'active';
    return `<main class="screen">
      ${topbar({ back: setup ? 'home' : 'inventory', step: setup ? 'responsibilities' : null })}
      <h1>What needs doing in your home?</h1>
      <p class="lead" style="margin-bottom:0">${setup ? "Tick everything that applies. You're not deciding who does it yet."
        : active ? "Tick anything new. You'll both say how you feel about new tasks, and they're shared out fairly."
        : 'Tick everything that applies. The plan updates straight away.'}</p>
      ${sections}
      ${ownSection}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${addOwnRow('Add your own task', !Entitlements.canAddCustomTask(S.subscription, Household.customCount(h)))}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${count ? `${plural(count, 'task')} · about ${formatMinutes(Household.weeklyTotal(h))} a week` : 'Nothing selected yet'}</p>
        <button class="btn primary" data-action="nav" data-to="${esc(setup ? 'frequency' : 'inventory')}" ${count ? '' : 'disabled'}>${setup ? 'Continue' : 'Done'}</button>
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
            <span class="row-title" id="t-${esc(r.id)}">${esc(r.name)}</span>
            <div class="timing-controls">
              <select class="select" data-change="frequency" data-id="${esc(r.id)}" aria-label="How often: ${esc(r.name)}">${frequencyOptions(t.frequency)}</select>
              <select class="select minutes" data-change="minutes" data-id="${esc(r.id)}" aria-label="How long each time: ${esc(r.name)}">${minuteOptions(t.minutes)}</select>
            </div>
          </div>`;
        }).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'responsibilities' : 'inventory', step: setup ? 'frequency' : null })}
      <h1>How often, and how long?</h1>
      <p class="lead" style="margin-bottom:0">We've filled in what's typical. Change anything that's different in your home.</p>
      ${stage === 'active' ? `<p class="form-note" style="margin-top:16px">Your plan is running. Changes here affect when tasks come up, not who does them.</p>` : ''}
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">About ${formatMinutes(Household.weeklyTotal(h))} a week in total</p>
        <button class="btn primary" data-action="nav" data-to="${esc(setup ? 'rate' : 'inventory')}">${setup ? 'Continue' : 'Done'}</button>
      </div>
    </main>`;
  },

  /* ---------- Premium: break a task into parts ---------- */
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
      ${topbar({ back: 'inventory' })}
      <h1>Break down ${esc(r.name)}</h1>
      <p class="lead" style="margin-bottom:0">${isOwner
        ? 'Tick the parts you want as separate tasks. Each gets its own time and rhythm, and can go to a different person.'
        : `Pick the parts you'd like as separate tasks. ${ownerName} decides.`}</p>
      <div class="section-head"><h2 class="section-title">Parts</h2><span class="section-meta">${on.length} chosen</span></div>
      <div class="card">${rows}
        <div class="field" style="border-top:1px solid var(--line)"><label for="bd-new">Add your own part</label>
          <div class="field-line"><input id="bd-new" maxlength="60" placeholder="e.g. Descale the kettle" value="${esc(bd.newName || '')}" data-input="breakNew" enterkeyhint="done">
          <button class="mini" data-action="addBreakPart">Add</button></div></div>
      </div>
      <p class="fine" style="text-align:left;margin:0 4px">Together about ${formatMinutes(total)} a week. As one task it was ${formatMinutes(Timing.weeklyMinutes(r))}.</p>
      <div class="bottom-bar">
        ${isOwner
          ? `<button class="btn premium" data-action="saveBreakdown" ${on.length < 2 ? 'disabled' : ''}>${wasSplit ? 'Save the parts' : 'Break it down'}</button>
             ${wasSplit ? `<button class="btn ghost" data-action="mergeBreakdown">Put it back together</button>` : ''}`
          : `<button class="btn premium" data-action="suggestBreakdown" ${on.length < 2 ? 'disabled' : ''}>Suggest this breakdown</button>`}
        ${on.length < 2 ? '<p class="fine">Pick at least two parts.</p>' : ''}
      </div>
    </main>`;
  },

  /* ---------- Premium: rate the new parts, then see how they'd be shared ---------- */
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
        ${topbar({ back: 'plan' })}
        <h1>How do you feel about the new ${noun}s?</h1>
        <p class="lead" style="margin-bottom:12px">${noun === 'part' ? "Only you see your answers. We've started from how you felt about the whole task." : 'Only you see your answers. Then the app shares them out fairly between you.'}</p>
        <div class="legend">${PREFERENCES.map(p => `<span>${p.emoji} ${p.label}</span>`).join('')}</div>
        <div class="card" style="margin-top:12px">${units.map(u => {
          const v = Household.reshareValue(h, me, u);
          return `<div class="pref-row"><div class="row-text"><span class="row-title">${esc(u.name)}</span><span class="row-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${esc(Timing.label(u))}</span></div>
            <div class="pref-group">${PREFERENCES.map(p => `<button class="pref-btn" data-action="setResharePref" data-id="${esc(u.id)}" data-key="${esc(p.id)}" aria-pressed="${v === p.id}" aria-label="${p.label}" title="${p.label}">${p.emoji}</button>`).join('')}</div></div>`;
        }).join('')}</div>
        <div class="bottom-bar"><button class="btn primary" data-action="finishReshare">Done</button></div>
      </main>`;
    }
    if (rsh.status === 'rating') {
      return `<main class="screen">${topbar({ back: 'plan' })}${houseArt}
        <h1>Thanks!</h1><p class="lead">As soon as everyone has rated the new ${noun}s, you'll see how they'd be shared out.</p>
        <div class="bottom-bar"><button class="btn secondary" data-action="nav" data-to="plan">Back to the plan</button></div></main>`;
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
      ${topbar({ back: 'plan' })}
      <h1>Here's how the new ${noun}s would be shared</h1>
      <p class="lead" style="margin-bottom:12px">${moved.length
        ? `The new ${noun}s take quite some time, so a few other tasks change hands too, to keep things even.`
        : `Only the new ${noun}s are shared. Everything else in your plan stays as it is.`}</p>
      <div class="card">${units.map(changeRow).join('')}</div>
      ${moved.length ? `<div class="section-head"><h2 class="section-title">Also changing hands</h2></div>
        <div class="card">${moved.map(changeRow).join('')}</div>` : ''}
      ${rsh.loads && !Entitlements.canSeeTimeTotals(S.subscription) ? `<div class="card" style="margin-top:16px"><div class="row static"><span class="chev" style="color:var(--accent)">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${Split.isEven(rsh.loads) ? 'Evenly split' : 'As even as your answers allow'}</span><span class="row-sub">Shared by effort, not by number of tasks</span></div></div></div>` : ''}
      ${rsh.loads && Entitlements.canSeeTimeTotals(S.subscription) ? `<div class="card" style="margin-top:16px"><div class="balance" style="flex-direction:column;align-items:stretch;gap:6px">${h.members.map(m =>
        `<div style="display:flex;justify-content:space-between"><span>${who(m.uid)}</span><span class="sub">about ${formatMinutes(rsh.loads[m.uid] || 0)} a week</span></div>`).join('')}</div></div>` : ''}
      <div class="bottom-bar">${accepted
        ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
        : `<button class="btn primary" data-action="acceptReshare">Yes, share it like this</button>
           <button class="btn ghost" data-action="declineReshare">${noun === 'part' ? 'Keep things as they are' : "Not now, we'll pick them ourselves"}</button>`}</div>
    </main>`;
  },

  /* ---------- Premium ---------- */
  premium() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    const orgName = esc(Household.memberName(Household.owner(h)));
    const sub = S.subscription;
    const premium = Entitlements.isPremium(sub);
    const benefits = ['time', 'parts', 'board', 'suggest', 'custom'].map(k => PREMIUM_FEATURES[k]);
    const date = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const price = APP_CONFIG.billing.display;
    let action;

    if (premium) {
      let status;
      if (sub.source === 'stripe' && sub.status === 'trialing' && sub.trialEnd) {
        status = `<p class="joke">Free trial until ${date(sub.trialEnd)}</p>
          <p class="plain" style="margin:0">${sub.cancelAtPeriodEnd ? "You've cancelled, so you won't be charged." : `Then ${money(sub.interval === 'month' ? price.monthly : price.yearly)} per ${sub.interval || 'year'}. Cancel any time before ${date(sub.trialEnd)} and you won't be charged.`}</p>`;
      } else if (sub.source === 'stripe') {
        status = `<p class="joke">${isOrg ? 'You have Premium. 🎉' : `You have Premium through ${orgName}. 🎉`}</p>
          <p class="plain" style="margin:0">${sub.periodEnd ? (sub.cancelAtPeriodEnd ? `Ends on ${date(sub.periodEnd)}.` : `${sub.interval === 'month' ? 'Monthly' : 'Yearly'} plan, renews on ${date(sub.periodEnd)}.`) : 'It covers both of you.'}</p>`;
      } else {
        status = `<p class="joke">${isOrg ? 'You have Premium. 🎉' : `You have Premium through ${orgName}. 🎉`}</p>
          <p class="plain" style="margin:0">It covers both of you.</p>`;
      }
      if (isOrg && sub.source === 'stripe' && sub.status === 'past_due') {
        status += `<p class="plain" style="margin:8px 0 0"><b>Your last payment didn't go through.</b> Stripe will try again; update your card to keep Premium.</p>`;
      }
      action = `<div class="result-card">${status}</div>
        <button class="btn primary" data-action="nav" data-to="inventory">Go to our home</button>
        ${isOrg ? (sub.source === 'stripe'
          ? `<button class="btn ghost" data-action="openPortal">Manage or cancel subscription</button>`
          : `<button class="btn ghost text-danger" data-action="confirmCancelPremium">Cancel Premium</button>`) : ''}`;
    } else if (S.checkoutReturn === 'success') {
      action = `<div class="result-card" role="status"><div class="spinner small" aria-hidden="true"></div>
        <p class="joke">Activating Premium…</p><p class="plain" style="margin:0">This usually takes a few seconds.</p></div>`;
    } else if (!isOrg) {
      action = `<div class="card next-card"><p style="margin:0">Premium comes with ${orgName}'s account and covers you both. Ask ${orgName} to have a look at this page.</p></div>`;
    } else if (Backend.Billing.enabled() && (!watchers.subLoaded || !Array.isArray(S.stripeSubs))) {
      action = !watchers.subLoaded
        ? `<div class="result-card" role="status"><div class="spinner small" aria-hidden="true"></div><p class="plain" style="margin:0">Checking your plan…</p></div>`
        : `<div class="result-card" role="status"><p class="joke">We couldn't check your plan</p>
            <p class="plain" style="margin:0">So nothing is charged twice, buying waits until we can. Check your connection and try again.</p></div>
           <button class="btn secondary" data-action="reload">Try again</button>`;
    } else if (Backend.Billing.enabled() && Entitlements.paymentProblem(S.stripeSubs)) {
      action = `<div class="result-card" role="status"><p class="joke">There's a problem with your payment</p>
          <p class="plain" style="margin:0">Your bank declined it or it needs confirming. Fix it in your subscription settings; there's nothing new to buy.</p></div>
        <button class="btn premium" data-action="openPortal">Fix payment</button>`;
    } else if (Backend.Billing.enabled()) {
      const choice = S.planChoice || 'yearly';
      const trial = !Entitlements.hadSubscription(S.stripeSubs);
      const days = APP_CONFIG.billing.trialDays;
      const save = Math.round((1 - price.yearly / (price.monthly * 12)) * 100);
      const trialEnd = Date.now() + days * 864e5;
      const card = (key, name, big, small, sub, tag) => `<button class="plan-card" role="radio" aria-checked="${choice === key}" data-action="choosePlan" data-key="${esc(key)}">
          ${tag ? `<span class="plan-tag">${tag}</span>` : ''}
          <span class="plan-name">${name}</span>
          <span class="plan-price">${big}<small>${small}</small></span>
          <span class="plan-sub">${sub}</span></button>`;
      const cta = choice === 'yearly' ? (trial ? `Start ${days}-day free trial` : 'Subscribe yearly') : 'Subscribe monthly';
      const fine = choice === 'yearly'
        ? (trial
          ? `Free until ${date(trialEnd)}, then ${money(price.yearly)} a year, billed yearly. We'll remind you before the trial ends. Cancel any time before then and you won't be charged.`
          : `${money(price.yearly)} a year, billed yearly. Renews automatically until you cancel.`)
        : `${money(price.monthly)} a month, billed monthly. Renews automatically until you cancel.`;
      action = `${S.checkoutReturn === 'cancel' ? '<p class="form-note" role="status">No worries, nothing was charged.</p>' : ''}
        <div class="plans" role="radiogroup" aria-label="Choose a plan">
          ${card('yearly', 'Yearly', money(price.yearly / 12), '/month', `${money(price.yearly)} billed yearly · save ${save}%`, trial ? `${days} days free` : `Save ${save}%`)}
          ${card('monthly', 'Monthly', money(price.monthly), '/month', 'Billed monthly', '')}
        </div>
        <button class="btn premium" data-action="startCheckout">${cta}</button>
        <p class="fine">${fine} Payment is handled securely by Stripe.</p>
        ${legalLine()}`;
    } else {
      const req = S.premiumRequest;
      const note = req && req.status === 'denied' ? "Premium isn't available for your home just yet. You can ask again any time."
        : sub && sub.plan === 'premium' && !premium ? 'Your Premium has ended. Tap below if you would like it back.' : '';
      action = (note ? `<p class="form-note">${note}</p>` : '') + (req && req.status === 'pending'
        ? `<div class="result-card"><p class="joke">Thanks, you're on the list! 🙌</p>
            <p class="plain" style="margin:0">We'll let you know as soon as Premium is ready for your home.</p></div>`
        : `<button class="btn premium" data-action="requestPremium">I'm interested</button>
           <p class="fine">Premium isn't on sale yet. Tap the button and we'll get in touch.</p>`);
    }

    return `<main class="screen">
      ${topbar({ back: Household.stage(h) === 'setup' ? 'responsibilities' : 'today' })}
      <div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h1 style="margin-top:0">Keep your home fair, without the reminders</h1>
      <p class="lead">One Premium covers both of you.</p>
      <div class="card">${benefits.map(b => `<div class="row static">
          <span class="chev" style="color:var(--premium)">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${b.title}</span><span class="row-sub">${b.body}</span></div></div>`).join('')}</div>
      <div style="margin-top:8px">${action}</div>
      <div style="height:calc(32px + env(safe-area-inset-bottom))"></div>
    </main>`;
  },

  /* ---------- How do you feel about each task (organiser setup, or changing answers) ---------- */
  rate() {
    const h = S.household;
    const me = S.user.uid;
    const setup = !h.settings.onboarded;
    const other = Household.people(h).find(m => m.uid !== me);
    const otherName = other ? esc(Household.memberName(other)) : 'Nobody else';
    const groups = Household.inventory(h);
    const sections = groups.map(({ category, items }) => `<section aria-labelledby="pf-${esc(category.id)}">
        <div class="section-head"><h2 class="section-title" id="pf-${esc(category.id)}">${esc(category.name)}</h2></div>
        <div class="card">${items.map(r => prefRow(h, me, r)).join('')}</div>
      </section>`).join('');
    return `<main class="screen">
      ${topbar({ back: setup ? 'frequency' : 'plan', step: setup ? 'rate' : null })}
      <h1>How do you feel about each task?</h1>
      <p class="lead" style="margin-bottom:12px">Mark what you'd love to do ❤️ and what you'd rather not 🙃. Everything else counts as 🙂 Don't mind. ${otherName} won't see your answers.</p>
      <div class="legend">${PREFERENCES.map(p => `<span>${p.emoji} ${p.label}</span>`).join('')}</div>
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${markedCount(h, me) ? `${plural(markedCount(h, me), 'task')} marked` : 'Nothing marked yet. That\'s fine too.'}</p>
        <button class="btn primary" data-action="${setup ? 'finishSetup' : 'saveAnswers'}">${setup ? 'See our plan' : 'Save my answers'}</button>
      </div>
    </main>`;
  },

  /* ---------- Partner: the plan they were invited to ---------- */
  review() {
    const h = S.household;
    const me = S.user.uid;
    const org = Household.owner(h);
    const orgName = esc(Household.memberName(org));
    const mine = Household.tasksOf(h, me);
    const theirs = Household.tasksOf(h, h.ownerId);
    const marked = markedCount(h, me);
    const list = (title, items) => `<div class="section-head"><h2 class="section-title">${title}</h2><span class="section-meta">${items.length}</span></div>
      <div class="card">${items.length ? items.map(r => prefRow(h, me, r)).join('') : '<div class="note" style="border:0">Nothing here.</div>'}</div>`;
    const locked = !Entitlements.canSuggestChanges(S.subscription);
    return `<main class="screen">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${orgName} made a plan for your home</h1>
      <p class="lead" style="margin-bottom:12px">Mark anything you'd rather not do 🙃, or would love to take ❤️. Everything else counts as 🙂 Don't mind. ${orgName} won't see your answers.</p>
      ${totalCard(h)}
      <div class="legend">${PREFERENCES.map(p => `<span>${p.emoji} ${p.label}</span>`).join('')}</div>
      ${list('Suggested for you', mine)}
      ${list(`Suggested for ${orgName}`, theirs)}
      <button class="btn ghost" data-action="suggestChanges">Suggest a change to the list ${locked ? premiumBadge() : ''}</button>
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${marked ? `${plural(marked, 'task')} marked. The app will rebalance with your answers.` : 'Happy with it as it is?'}</p>
        <button class="btn primary" data-action="submitReview">${marked ? 'Rebalance with my answers' : "Looks good, let's start"}</button>
      </div>
    </main>`;
  },

  /* ---------- The plan: who does what ---------- */
  plan() {
    const h = S.household;
    const me = S.user.uid;
    const stage = Household.stage(h);
    const active = stage === 'active';
    const isOrg = Household.isOwner(h, me);
    const people = Household.people(h);
    const others = people.filter(m => m.uid !== me);
    const partner = others[0] || null;
    const partnerName = partner ? esc(Household.memberName(partner)) : 'your partner';
    const canSwap = !Household.alone(h);
    const loads = Household.loads(h);

    const row = (r, own) => {
      const pending = Household.pendingFor(h, r.id);
      const right = own && canSwap
        ? (pending ? '<span class="tag">Swap asked</span>' : `<button class="mini" data-action="askSwap" data-id="${esc(r.id)}">Swap</button>`)
        : '';
      return `<div class="row static"><button class="name-btn" data-action="peek" data-id="${esc(r.id)}"><span class="row-title">${esc(r.name)}</span>
        <span class="row-sub">${r.parentName ? esc(r.parentName) + ' · ' : ''}${esc(Timing.label(r))}</span></button>${right}</div>`;
    };
    const list = (title, items, own) => `<div class="section-head"><h2 class="section-title">${title}</h2><span class="section-meta">${items.length}</span></div>
      <div class="card">${items.length ? items.map(r => row(r, own)).join('') : '<div class="note" style="border:0">Nothing here.</div>'}</div>`;

    const balance = Entitlements.canSeeTimeTotals(S.subscription)
      ? `<div class="card"><div class="balance" style="flex-direction:column;align-items:stretch;gap:6px">${people.map(m =>
          `<div style="display:flex;justify-content:space-between"><span>${esc(m.uid === me ? 'You' : Household.memberName(m))}</span><span class="sub">about ${formatMinutes(loads[m.uid] || 0)} a week</span></div>`).join('')}</div></div>`
      : `<div class="card"><button class="row" data-action="premiumInfo" data-key="time">
          <span class="chev" style="color:var(--accent)">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${Split.isEven(loads) ? 'Evenly split' : 'As even as your answers allow'}</span>
          <span class="row-sub">Shared by effort, not by number of tasks</span></div>
          ${premiumBadge()}</button></div>`;

    const sharing = new Set(((Household.activeReshare(h) || {}).unitIds) || []);
    const unassigned = active ? Household.unassigned(h).filter(u => !sharing.has(u.id)) : [];
    const accepted = Household.hasAccepted(h, me);
    const waiting = h.memberIds.filter(m => !Household.hasAccepted(h, m)).map(m => esc(Household.memberName(Household.member(h, m))));

    // What this screen asks of me, by stage.
    let head, lead, top = '', bottom = '';
    if (stage === 'draft') {
      const invited = !!(h.settings && h.settings.invitedAt);
      head = 'Your plan is ready';
      lead = `Here's a fair split for you and ${partnerName}. Next, send it to ${partnerName}: they can mark anything that doesn't suit them before it starts.`;
      top = totalCard(h) + baselineCard(h);
      bottom = `<div class="bottom-bar">
        ${invited ? `<p class="count">${partnerName} hasn't joined yet</p>` : ''}
        <button class="btn primary" data-action="invite">${invited ? 'Send the link again' : `Invite ${partnerName} to see the plan`}</button>
      </div>`;
    } else if (stage === 'review') {
      head = 'Your plan';
      lead = `${partnerName} is looking at the plan. You'll see a dot here when there's something to say yes to.`;
    } else if (!active) {
      const by = h.plan && h.plan.rebalancedBy;
      head = "Here's your plan";
      lead = by === me ? 'Rebalanced with your answers. Have a look and say yes if it works for you.'
        : by ? `${esc(Household.memberName(Household.member(h, by)))} marked a few things, so the plan was rebalanced. Have a look and say yes if it works for you.`
        : "If something isn't to your taste, tap Swap. When you're both happy, say yes.";
      bottom = `<div class="bottom-bar">
        ${accepted
          ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
          : `<button class="btn primary" data-action="acceptPlan">Start this plan</button>`}
      </div>`;
    } else {
      head = 'Your plan';
      lead = 'Who does what. Want to hand something over? Tap Swap.';
    }

    const reshuffle = !Household.alone(h) && !(h.reshuffle && h.reshuffle.status === 'pending')
      ? `<button class="btn ghost quiet" data-action="askReshuffle">Reshuffle the whole plan</button>` : '';

    return `<main class="screen has-nav">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${head}</h1>
      <p class="lead" style="margin-bottom:16px">${lead}</p>
      ${swapCards(h)}
      ${top}
      ${stage === 'draft' ? '' : balance}
      ${list('Your tasks', Household.tasksOf(h, me), true)}
      ${others.map(m => list(`${esc(Household.memberName(m))}'s tasks${m.placeholder ? ' (suggested)' : ''}`, Household.tasksOf(h, m.uid), false)).join('')}
      ${unassigned.length ? `<div class="section-head"><h2 class="section-title">Needs a home</h2></div>
        <div class="card">${unassigned.map(r => `<div class="row static"><button class="name-btn" data-action="peek" data-id="${esc(r.id)}"><span class="row-title">${esc(r.name)}</span>
          <span class="row-sub">${esc(Timing.label(r))}</span></button><button class="mini" data-action="claim" data-id="${esc(r.id)}">I'll take it</button></div>`).join('')}</div>` : ''}
      ${isOrg && !active ? `<button class="btn ghost" data-action="nav" data-to="frequency">Change times</button>` : ''}
      ${reshuffle}
      ${bottom}
      ${bottomNav('plan', navDots(h))}
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
    const pool = Household.units(h).filter(r => everyone || Household.assignee(h, r.id) === me);
    const who = r => {
      if (!everyone) return '';
      const a = Household.assignee(h, r.id);
      const m = Household.member(h, a);
      return a === me ? 'You · ' : (m ? esc(Household.memberName(m)) + ' · ' : '');
    };
    const tick = (r, sub) => {
      const c = Household.completion(h, r.id);
      const done = Schedule.doneOn(c, now);
      return `<button class="row ${done ? 'done' : ''}" data-action="toggleDone" data-id="${esc(r.id)}" aria-pressed="${done}">
        <span class="check" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${who(r)}${r.parentName ? esc(r.parentName) + ' · ' : ''}${sub}</span></div>
      </button>`;
    };
    const scheduled = pool.filter(r => Timing.isScheduled(r)).map(r => ({ r, due: Household.dueDate(h, r) }));
    const freqOf = r => Timing.of(r).frequency;

    let body = '';
    const boardTasks = Household.premium && view === 'today'
      ? (everyone ? h.memberIds.flatMap(id => Household.myNoteTasks(h, id).map(n => ({ n, id }))) : Household.myNoteTasks(h, me).map(n => ({ n, id: me })))
          .filter((x, i, all) => all.findIndex(y => y.n.id === x.n.id) === i)
      : [];
    const boardTaskRows = boardTasks.length ? `<div class="section-head" style="margin-top:4px"><h2 class="section-title">From the board</h2></div>
      <div class="card">${boardTasks.map(({ n, id }) => noteTaskRow(h, n, id, everyone)).join('')}</div>` : '';
    if (view === 'today') {
      const open = scheduled.filter(x => x.due <= today && !Schedule.doneOn(Household.completion(h, x.r.id), now));
      const done = pool.filter(r => Timing.isScheduled(r) && Schedule.doneOn(Household.completion(h, r.id), now));
      const whenNeeded = pool.filter(r => !Timing.isScheduled(r));
      open.sort((a, b) => a.due - b.due);
      body = `${boardTaskRows}${open.length || done.length ? `${boardTaskRows ? '<div class="section-head"><h2 class="section-title">Your plan</h2></div>' : ''}<div class="card">
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
      ${statusBanner(h)}
      ${swapCards(h)}
      ${boardCard(h)}
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
      ${bottomNav('today', navDots(h))}
    </main>`;
  },

  /* ---------- Household: the list, the people, changes ---------- */
  inventory() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    const orgName = esc(Household.memberName(Household.owner(h)));
    const groups = Household.inventory(h);
    const total = h.responsibilities.length;
    const suggesting = !isOrg && S.suggestMode && Entitlements.canSuggestChanges(S.subscription);
    const whose = r => {
      const parts = Household.isSplit(r) ? `${plural(Household.parts(r).length, 'part')} · ` : '';
      const a = Household.ownerOf(h, r);
      if (a === 'shared') return 'Shared · ' + parts;
      if (!a || !Household.peopleIds(h).includes(a)) return 'Needs a home · ';
      return (a === me ? 'Yours · ' : `${esc(Household.memberName(Household.member(h, a)))}'s · `) + parts;
    };

    const sections = groups.map(({ category, items }) => `<section aria-labelledby="inv-${esc(category.id)}">
        <div class="section-head">
          <h2 class="section-title" id="inv-${esc(category.id)}">${esc(category.name)}</h2>
          <span class="section-meta">${items.length}</span>
        </div>
        <div class="card">${items.map(r => {
          if (suggesting) {
            const sug = Household.suggestionFor(h, me, 'remove', r.id);
            return `<button class="row" data-action="suggest" data-type="remove" data-id="${esc(r.id)}" aria-pressed="${!!sug}">
                <div class="row-text"><span class="row-title" ${sug ? 'style="text-decoration:line-through;color:var(--muted)"' : ''}>${esc(r.name)}</span></div>
                <span class="${sug ? 'badge' : 'tag'}">${sug ? 'Suggested: remove' : 'Suggest removing'}</span>
              </button>`;
          }
          return `<button class="row" data-action="peek" data-id="${esc(r.id)}">
            <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${whose(r)}${esc(Timing.label(r))}</span></div>
            ${r.mentalLoad ? '<span class="tag">Mental load</span>' : ''}
            <span class="chev">${Icon.chev}</span>
          </button>`;
        }).join('')}</div>
      </section>`).join('');

    // Partner, suggesting: library items the list doesn't have yet.
    const selected = Household.selectedLibraryIds(h);
    const addable = suggesting ? Household.discoveryGroups(h)
      .map(g => ({ ...g, items: g.items.filter(i => !selected.has(i.id)) })).filter(g => g.items.length) : [];
    const addSection = addable.length ? `
      <div class="section-head"><h2 class="section-title">Suggest adding</h2></div>
      ${addable.map(({ category, items }) => `<div class="section-head" style="margin-top:12px"><h3 class="section-meta" style="margin:0">${esc(category.name)}</h3></div>
        <div class="card">${items.map(i => {
          const sug = Household.suggestionFor(h, me, 'add', i.id);
          return `<button class="row" data-action="suggest" data-type="add" data-id="${esc(i.id)}" aria-pressed="${!!sug}">
              <span class="check" aria-hidden="true" ${sug ? '' : 'style="color:var(--muted)"'}>${Icon.plus}</span>
              <div class="row-text"><span class="row-title">${esc(i.name)}</span></div>
              ${sug ? '<span class="badge">Suggested</span>' : ''}
            </button>`;
        }).join('')}</div>`).join('')}` : '';

    // Suggestions: the organiser decides; the partner sees their own pending ones.
    const locked = !Entitlements.canSuggestChanges(S.subscription);
    const suggestions = Household.premium ? Household.suggestions(h) : [];
    const label = x => x.type === 'breakdown' ? `Break down: ${esc(x.name)}` : `${x.type === 'add' ? 'Add' : 'Remove'}: ${esc(x.name)}`;
    let suggestionCard = '';
    if (isOrg && suggestions.length) {
      suggestionCard = `<div class="section-head"><h2 class="section-title">Suggestions</h2><span class="section-meta">${suggestions.length}</span></div>
        <div class="card">${suggestions.map(x => {
          const by = esc(Household.memberName(Household.member(h, x.by) || {}));
          return `<div class="row static col">
            <div class="row-text"><span class="row-title">${label(x)}</span>
              <span class="row-sub">${x.type === 'breakdown' ? `Into ${esc((x.parts || []).map(p => p.name).join(', '))} · ` : ''}Suggested by ${by}</span></div>
            <div class="btn-pair">
              <button class="btn primary" data-action="acceptSuggestion" data-id="${esc(x.id)}">${x.type === 'add' ? 'Add it' : x.type === 'breakdown' ? 'Use these parts' : 'Remove it'}</button>
              <button class="btn secondary" data-action="declineSuggestion" data-id="${esc(x.id)}">Keep as is</button>
            </div></div>`;
        }).join('')}</div>`;
    } else if (!isOrg) {
      const mine = suggestions.filter(x => x.by === me);
      if (mine.length) {
        suggestionCard = `<div class="section-head"><h2 class="section-title">Your suggestions</h2><span class="section-meta">Waiting for ${orgName}</span></div>
          <div class="card">${mine.map(x => `<div class="row static">
            <div class="row-text"><span class="row-title">${label(x)}</span></div>
            ${locked ? '' : `<button class="link-btn" data-action="withdrawSuggestion" data-id="${esc(x.id)}">Withdraw</button>`}</div>`).join('')}</div>`;
      }
    }

    const invite = isOrg && Household.alone(h) ? `<div class="card next-card">
        <h2>${esc(Household.memberName(Household.invitee(h)))} hasn't joined yet</h2>
        <p>Send the link so they can look at the plan and mark anything that doesn't suit them.</p>
        <button class="btn primary" data-action="invite">${h.settings.invitedAt ? 'Send the link again' : 'Invite to see the plan'}</button>
      </div>` : '';

    const actions = suggesting
      ? `<div class="bottom-bar"><p class="count">${plural(suggestions.filter(x => x.by === me).length, 'suggestion')} for ${orgName}</p>
          <button class="btn primary" data-action="doneSuggesting">Done</button></div>`
      : isOrg
        ? `${addOwnRow('Add your own task', !Entitlements.canAddCustomTask(S.subscription, Household.customCount(h)))}
           <div class="btn-pair" style="margin-top:12px">
             <button class="btn secondary" data-action="nav" data-to="responsibilities">Edit tasks</button>
             <button class="btn secondary" data-action="nav" data-to="frequency">Edit times</button>
           </div>`
        : `<button class="btn secondary" data-action="suggestChanges">Suggest a change ${locked ? premiumBadge() : ''}</button>`;

    return `<main class="screen ${suggesting ? '' : 'has-nav'}">
      <div class="topbar"><span class="spacer"></span>
        <button class="icon-btn right" data-action="menu" aria-label="Household options">${Icon.more}</button>
      </div>
      <h1 style="margin-top:0">${suggesting ? 'Suggest changes' : 'Our home'}</h1>
      ${suggesting ? `<p class="lead">Tap a task to suggest removing it, or suggest adding one below. ${orgName} decides.</p>` : `<div class="members">${memberChips(h)}</div>`}
      ${invite}
      ${suggestionCard}
      ${suggesting ? '' : `<div class="card"><div class="stats">
          <div class="stat"><b>${total}</b><span>${total === 1 ? 'Task' : 'Tasks'}</span></div>
          <div class="stat"><b>${formatMinutes(Household.weeklyTotal(h))}</b><span>A week, together</span></div>
        </div></div>`}
      ${sections || `<div class="card"><div class="note" style="border:0">No tasks yet.</div></div>`}
      ${addSection}
      ${suggesting ? '' : `<div class="section-head"><h2 class="section-title">Something missing?</h2></div>`}
      ${actions}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
      ${suggesting ? '' : bottomNav('inventory', navDots(h))}
    </main>`;
  },

};

/* ---------- Board (Premium) ---------- */
const NOTE_KINDS = {
  note:  { emoji: '💬', label: 'Note',        hint: 'Stays on the board for 7 days.',                               placeholder: 'e.g. Plumber comes Thursday at 10' },
  low:   { emoji: '🧴', label: 'Running low', hint: 'Goes to whoever looks after it, until someone has got it.',     placeholder: 'e.g. Dishwasher tabs' },
  today: { emoji: '⚡', label: 'Today only',  hint: 'Whoever taps "I\'ll do it" first gets it on their Today list.', placeholder: 'e.g. Take the parcel to the post office' },
};
function boardSeenKey(h) { return `household-app/board-seen/${h.id}/${S.user.uid}`; }
function boardSeenAt(h) { return Number(SafeStorage.get(boardSeenKey(h)) || 0); }
function boardUnseen(h) { return Household.premium ? Household.unseenNotes(h, S.user.uid, boardSeenAt(h)) : []; }

/** One line at the top of Today; opens in place. On Free, a quiet locked line. */
function boardCard(h) {
  const me = S.user.uid;
  const partner = h.members.find(m => m.uid !== me);
  const partnerName = partner ? Household.memberName(partner) : '';
  if (!Household.premium) {
    return `<button class="board-head locked" data-action="premiumInfo" data-key="board">
      <span class="board-icon" aria-hidden="true">📝</span><span class="board-title">Notes for each other</span>
      <span class="badge">${Icon.sparkSm} Premium</span></button>`;
  }
  const items = Household.boardNotes(h);
  if (S.boardOpen) SafeStorage.set(boardSeenKey(h), String(Date.now()));
  const unseen = S.boardOpen ? [] : boardUnseen(h);
  const newFrom = [...new Set(unseen.map(n => Household.memberName(Household.member(h, n.by) || {})))];
  const meta = !items.length ? (partnerName ? `Leave a note for ${esc(partnerName)}` : 'Leave a note')
    : unseen.length ? `<b>New from ${esc(newFrom.join(' and '))}</b>` : plural(items.length, 'note');
  const head = `<button class="board-head" data-action="${items.length ? 'toggleBoard' : 'addNote'}" aria-expanded="${!!S.boardOpen}">
      <span class="board-icon" aria-hidden="true">📝</span><span class="board-title">Board</span>
      <span class="board-meta">${meta}</span>
      <span class="board-chev" aria-hidden="true">${items.length ? (S.boardOpen ? '–' : '+') : '+'}</span></button>`;
  if (!S.boardOpen || !items.length) return `<div class="board">${head}</div>`;
  const now = new Date();
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
    return `<div class="note-row"><span class="note-kind" aria-label="${k.label}" title="${k.label}">${k.emoji}</span>
      <div class="row-text"><span class="note-text">${esc(n.text)}</span><span class="row-sub">${sub}</span></div>${act}${del}</div>`;
  };
  return `<div class="board open">${head}<div class="board-items">${items.map(row).join('')}</div>
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
    <div class="row-text"><span class="row-title">${k.emoji} ${n.kind === 'low' ? 'Get ' : ''}${esc(n.text)}</span><span class="row-sub">${sub}</span></div></button>`;
}

/** "parts" when only task parts are being shared, otherwise "tasks". */
function reshareNoun(h, rsh) { return (rsh.unitIds || []).every(id => Household.parentOf(h, id)) ? 'part' : 'task'; }

/** Something on the Plan tab is waiting for me to act. */
function planNeedsMe(h) {
  const me = S.user.uid;
  if (Household.incomingSwap(h, me)) return true;
  const rs = Household.reshuffle(h);
  if (rs && rs.status === 'pending' && rs.by !== me) return true;
  const rsh = Household.activeReshare(h);
  if (rsh && rsh.status === 'rating' && !(rsh.done || {})[me]) return true;
  if (rsh && rsh.status === 'proposed' && !(rsh.accepted || {})[me]) return true;
  if (rs && rs.status === 'declined' && rs.by === me && !rs.seen) return true;   // "They'd rather keep the plan" → OK
  if (Household.swapResults(h, me).length) return true;                          // my swap was taken or declined → OK
  const sharing = new Set(((Household.activeReshare(h) || {}).unitIds) || []);
  if (Household.unassigned(h).some(u => !sharing.has(u.id))) return true;                               // "Needs a home" → someone claims it
  return false;
}

/** Something on the Household tab is waiting for me: suggestions the organiser hasn't answered yet. */
function householdNeedsMe(h) {
  return Household.premium && Household.isOwner(h, S.user.uid) && Household.suggestions(h).length > 0;
}

/** Red dots on the bottom tabs: every tab where an action is waiting for me. */
function navDots(h) { return { today: boardUnseen(h).length > 0, plan: planNeedsMe(h), inventory: householdNeedsMe(h) }; }

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
  } else if (rs && rs.status === 'pending' && rs.by === me) {
    html += `<div class="result-card" role="status"><p class="plain" style="margin:0">Reshuffle asked. Waiting for the others to agree.</p></div>`;
  } else if (rs && rs.status === 'declined' && rs.by === me && !rs.seen) {
    html += `<div class="result-card" role="status"><p class="joke">They'd rather keep the current plan.</p>
      <p class="plain">Nothing changes. You can still swap single tasks.</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissReshuffle">OK</button></div>`;
  }
  const rsh = Household.activeReshare(h);
  const noun = rsh ? reshareNoun(h, rsh) : '';
  if (rsh && rsh.status === 'rating' && !(rsh.done || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">Time to share out the new ${noun}s ✂️</p>
      <p class="plain">Say how you feel about ${plural((rsh.unitIds || []).length, 'new ' + noun)}. It only takes a moment.</p>
      <button class="btn primary" data-action="nav" data-to="reshare">Rate the new ${noun}s</button></div>`;
  } else if (rsh && rsh.status === 'rating') {
    html += `<div class="result-card" role="status"><p class="plain" style="margin:0">Thanks! Waiting for the others to rate the new ${noun}s.</p></div>`;
  } else if (rsh && rsh.status === 'proposed' && !(rsh.accepted || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">The new ${noun}s have been shared out.</p>
      <p class="plain">Have a look and say yes if it works for you.</p>
      <button class="btn primary" data-action="nav" data-to="reshare">See the changes</button></div>`;
  } else if (rsh && rsh.status === 'proposed') {
    html += `<div class="result-card" role="status"><p class="plain" style="margin:0">You said yes. Waiting for the others.</p></div>`;
  }
  results.forEach(x => {
    const vars = { name: Household.memberName(Household.member(h, x.to) || {}), task: taskName(x.respId), other: x.gave ? taskName(x.gave) : 'nothing' };
    const plain = x.status === 'done'
      ? `${esc(vars.task)} is now ${name(x.to)}'s.${x.gave ? ` ${esc(vars.other)} is now yours.` : ''}`
      : `${name(x.to)} declined. ${esc(vars.task)} stays yours.`;
    html += `<div class="result-card" role="status">
      <p class="joke">${SwapMessages.pick(x.status === 'done' ? 'done' : 'declined', x.id, vars)}</p>
      <p class="plain">${plain}</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissSwap" data-id="${esc(x.id)}">OK</button></div>`;
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
function legalLine() {
  return `<p class="fine legal-line">By continuing you agree to the <a href="legal.html#terms" target="_blank" rel="noopener">Terms</a> and <a href="legal.html#privacy" target="_blank" rel="noopener">Privacy policy</a>.</p>`;
}
/** One task with ❤️ 🙂 🙃. Nothing marked counts as 🙂. */
function prefRow(h, me, r) {
  const v = prefValue(h, me, r);
  return `<div class="pref-row" role="group" aria-labelledby="pn-${esc(r.id)}">
    <button class="name-btn" data-action="peek" data-id="${esc(r.id)}"><span class="row-title" id="pn-${esc(r.id)}">${esc(r.name)}</span>
      <span class="row-sub">${r.parentName ? esc(r.parentName) + ' · ' : ''}${esc(Timing.label(r))}</span></button>
    <div class="pref-group">${PREFERENCES.map(p => `<button class="pref-btn" data-action="setPref" data-id="${esc(r.id)}" data-key="${esc(p.id)}" aria-pressed="${v === p.id}" aria-label="${p.label}" title="${p.label}">${p.emoji}</button>`).join('')}</div>
  </div>`;
}
/** The whole household's work in one number (free for everyone). */
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
/** Where the plan stands, on Today, until it runs (and trial reminders after). */
function statusBanner(h) {
  const me = S.user.uid;
  const stage = Household.stage(h);
  const partner = Household.people(h).find(m => m.uid !== me);
  const name = partner ? esc(Household.memberName(partner)) : 'your partner';
  if (stage === 'draft') return `<div class="card next-card">
      <h2>This is your draft plan</h2><p>It starts once ${name} has looked at it and you've both said yes.</p>
      <button class="btn primary" data-action="invite">${h.settings.invitedAt ? 'Send the link again' : `Invite ${name}`}</button></div>`;
  if (stage === 'review') return `<div class="result-card" role="status"><p class="plain" style="margin:0">${name} is looking at the plan. It starts once you've both said yes.</p></div>`;
  if (stage === 'plan') return Household.hasAccepted(h, me)
    ? `<div class="result-card" role="status"><p class="plain" style="margin:0">Waiting for ${name} to say yes to the plan.</p></div>`
    : `<div class="card next-card"><h2>The plan is ready</h2><p>Have a look and say yes, then it starts.</p>
        <button class="btn primary" data-action="nav" data-to="plan">See the plan</button></div>`;
  const sub = S.subscription;
  if (Household.isOwner(h, me) && sub && sub.source === 'stripe' && sub.status === 'past_due') {
    return `<div class="card next-card"><h2>Your Premium payment didn't go through</h2>
      <p>Update your card so Premium keeps running for both of you.</p>
      <button class="btn secondary" data-action="openPortal">Fix payment</button></div>`;
  }
  if (Household.isOwner(h, me) && sub && sub.source === 'stripe' && sub.status === 'trialing' && sub.trialEnd && !sub.cancelAtPeriodEnd
      && sub.trialEnd - Date.now() < 3 * 864e5) {
    const d = new Date(sub.trialEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    const amount = money(sub.interval === 'month' ? APP_CONFIG.billing.display.monthly : APP_CONFIG.billing.display.yearly);
    return `<div class="card next-card"><h2>Your free trial ends on ${d}</h2>
      <p>Then Premium continues for ${amount} per ${sub.interval || 'year'}. Nothing to do if you'd like to keep it.</p>
      <button class="btn secondary" data-action="openPortal">Manage subscription</button></div>`;
  }
  return '';
}

function memberChips(h) {
  return Household.people(h).map(m => {
    const n = Household.memberName(m);
    const you = m.uid === S.user.uid ? ' <span class="you">(you)</span>' : m.placeholder ? ' <span class="you">(invited)</span>' : '';
    const gold = Entitlements.isPremium(S.subscription) ? ' premium' : '';
    return `<span class="member${gold}"><span class="avatar" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>${esc(n)}${you}${gold ? ` <span class="gold" aria-label="Premium">${Icon.sparkSm}</span>` : ''}</span>`;
  }).join('');
}

/* =========================================================
   SHEETS
   ========================================================= */
const Sheets = {
  /** The one Premium prompt, for every locked feature. The partner is pointed to the organiser. */
  premium(key) {
    const f = PREMIUM_FEATURES[key] || PREMIUM_FEATURES.parts;
    const h = S.household;
    const isOrg = Household.isOwner(h, S.user.uid);
    const orgName = esc(Household.memberName(Household.owner(h)));
    const trial = Backend.Billing.enabled() && !Entitlements.hadSubscription(S.stripeSubs);
    const cta = isOrg
      ? `<button class="btn premium" data-action="sheetNav" data-to="premium">${trial ? `Try it free for ${APP_CONFIG.billing.trialDays} days` : 'See Premium'}</button>
         <button class="btn ghost" data-action="closeSheet">Not now</button>`
      : `<p style="margin-top:-8px">Premium comes with ${orgName}'s account and covers you both.</p>
         <button class="btn secondary" data-action="closeSheet">Got it</button>
         <button class="btn ghost" data-action="sheetNav" data-to="premium">What's in Premium?</button>`;
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>${esc(f.title)}</h2>
      <p>${esc(f.body)}</p>
      ${cta}`, f.title);
  },

  /** Once, when the plan starts: the best moment to offer the trial (organiser only). */
  premiumOffer() {
    const days = APP_CONFIG.billing.trialDays;
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>Your plan has started 🎉</h2>
      <p>Want to see that it stays fair? Premium shows each person's weekly time, puts every detail in someone's hands and adds a board so nobody has to remind anyone.</p>
      <button class="btn premium" data-action="sheetNav" data-to="premium">Try Premium free for ${days} days</button>
      <button class="btn ghost" data-action="closeSheet">Not now</button>`, 'Premium');
  },

  /** A task of your own. Free has a few; Premium has as many as you need. */
  customTask() {
    const d = S.customDraft || (S.customDraft = { name: '', category: 'organisation', frequency: 'weekly', minutes: 15 });
    const left = Entitlements.customTaskLimit(S.subscription) - Household.customCount(S.household);
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
      ${Number.isFinite(left) ? `<p class="fine">${left === 1 ? 'This is your last one on Free.' : `${left} left on Free.`}</p>` : ''}
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Add your own task');
  },

  /** What a task includes. On Free the parts are a locked preview of Premium. */
  taskPeek(r) {
    const unlocked = Entitlements.canViewDetailedTasks(S.subscription);
    const parts = unlocked && Household.parts(r).length ? Household.parts(r).map(p => p.name) : Library.parts(r.libraryId);
    const assignee = Household.assignee(S.household, r.id);
    const who = assignee ? (assignee === S.user.uid ? 'Yours' : `${Household.memberName(Household.member(S.household, assignee))}'s`) : '';
    const isOrg = Household.isOwner(S.household, S.user.uid);
    const removable = isOrg && !r.predefined && !r.parentId;
    Sheet.open(`<h2>${esc(r.name)}</h2>
      <p style="margin-bottom:12px">${who ? esc(who) + ' · ' : ''}${esc(Timing.label(r))}${r.mentalLoad ? ' · Mental load' : ''}</p>
      ${removable ? `<button class="btn ghost text-danger" data-action="removeTask" data-id="${esc(r.id)}">Remove this task</button>` : ''}
      ${parts.length ? `<h3 class="section-title" style="margin:0 0 8px">${unlocked && Household.parts(r).length ? 'Broken into' : 'Includes'}</h3>
        <ul class="part-chips ${unlocked ? '' : 'locked'}">${parts.map(p => `<li>${unlocked ? '' : Icon.lock}${esc(p)}</li>`).join('')}</ul>` : ''}
      ${!parts.length ? `<button class="btn ghost" data-action="closeSheet">Close</button>` : unlocked
        ? (isOrg
            ? `<button class="btn premium" data-action="openBreakdown" data-id="${esc(r.id)}">${Household.parts(r).length ? 'Edit the parts' : 'Break into parts'}</button>
               <button class="btn ghost" data-action="closeSheet">Close</button>`
            : `<button class="btn premium" data-action="openBreakdown" data-id="${esc(r.id)}">Suggest a breakdown</button>
               <button class="btn ghost" data-action="closeSheet">Close</button>`)
        : `<p style="margin-bottom:16px">${esc(PREMIUM_FEATURES.parts.body)}</p>
           <button class="btn premium" data-action="sheetNav" data-to="premium">See Premium</button>
           <button class="btn ghost" data-action="closeSheet">Not now</button>`}`, r.name);
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
  askReshuffle() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>Reshuffle the whole plan?</h2>
      <p>The app makes a fresh split from the same answers. Your ticks are kept, but any swaps start over, and you both say yes again.</p>
      <p style="margin-top:-8px">Usually a swap is enough. ${others.join(' and ')} will be asked to agree first.</p>
      <button class="btn secondary" data-action="requestReshuffle">Ask ${others.join(' and ')}</button>
      <button class="btn ghost" data-action="closeSheet">Keep my plan</button>`, 'Reshuffle');
  },

  /** Shown once on each device when Premium switches on. */
  premiumWelcome() {
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>Premium is on 🎉</h2>
      <p>It covers both of you. Nothing in your plan has changed: you decide what to break into smaller parts.</p>
      <button class="btn premium" data-action="sheetNav" data-to="premium">See what's new</button>
      <button class="btn ghost" data-action="closeSheet">Later</button>`, 'Premium is on');
  },

  /** Add something to the board. */
  addNote() {
    const d = S.noteDraft || (S.noteDraft = { kind: 'note', text: '' });
    const k = NOTE_KINDS[d.kind];
    Sheet.open(`<h2>Add to the board</h2>
      <div class="chips" role="group" aria-label="Kind" style="margin-bottom:10px">${Object.entries(NOTE_KINDS).map(([id, x]) =>
        `<button class="chip" data-action="noteKind" data-key="${esc(id)}" aria-pressed="${d.kind === id}">${x.emoji} ${x.label}</button>`).join('')}</div>
      <p style="margin-bottom:12px">${esc(k.hint)}</p>
      <div class="field"><input id="note-text" data-input="noteText" maxlength="${Household.NOTE_MAX_LENGTH}" placeholder="${esc(k.placeholder)}" value="${esc(d.text)}" autocomplete="off" enterkeyhint="done"></div>
      <button class="btn primary" data-action="postNote">Add</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Add to the board');
    const input = document.getElementById('note-text');
    if (input) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
  },

  confirmCancelPremium() {
    Sheet.open(`<h2>Cancel Premium?</h2>
      <p>Premium ends straight away for both of you. Tasks you broke into parts go back to being one task each. Your breakdowns are remembered, so they come back if you get Premium again.</p>
      <button class="btn danger" data-action="cancelPremium">Cancel Premium</button>
      <button class="btn ghost" data-action="closeSheet">Keep Premium</button>`, 'Cancel Premium');
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

  menu() {
    const h = S.household;
    const me = S.user.uid;
    const isOrg = Household.isOwner(h, me);
    const premium = Entitlements.isPremium(S.subscription);
    const orgName = Household.memberName(Household.owner(h));
    const plan = premium ? (isOrg ? 'Premium' : `Premium via ${orgName}`) : 'Free';
    const stage = Household.stage(h);
    const item = (to, label) => `<button class="btn secondary" data-action="sheetNav" data-to="${esc(to)}">${label}</button>`;
    Sheet.open(`<h2>Our home</h2>
      <div class="plan-line"><span>Plan</span><span>${esc(plan)} · <button class="link-btn" style="margin:0;padding:0" data-action="sheetNav" data-to="premium">${premium ? 'Details' : 'See Premium'}</button></span></div>
      <div class="plan-line"><span>Signed in as</span><span>${esc(S.user.email || '')}</span></div>
      ${isOrg ? item('members', 'Names') + item('home', 'Your home') : ''}
      ${stage !== 'active' && stage !== 'setup' ? item('rate', 'Change my answers') : ''}
      ${isOrg && Household.alone(h) && h.settings.onboarded ? `<button class="btn secondary" data-action="invite">Invite ${esc(Household.memberName(Household.invitee(h)))}</button>` : ''}
      <button class="btn ghost" data-action="signOut">Sign out</button>
      ${isOrg
        ? `<button class="btn ghost text-danger" data-action="confirmDelete">Delete household</button>`
        : `<button class="btn ghost text-danger" data-action="confirmLeave">Leave household</button>`}
      <p class="fine legal-line"><a href="legal.html" target="_blank" rel="noopener">Imprint, privacy and terms</a></p>`, 'Household options');
  },

  confirmDelete() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>There's no way back</h2>
      <p style="margin-bottom:12px">Deleting the household removes its tasks, your plan, everything you've ticked off${others.length ? ` and ${others.join(' and ')}'s place in it` : ''}. It's gone for good, for everyone.</p>
      <p><b style="color:var(--ink)">Do you still want to delete the household?</b></p>
      <button class="btn danger" data-action="deleteHousehold">Yes, delete household</button>
      <button class="btn secondary" data-action="closeSheet">No, keep it</button>`, 'Delete household');
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
