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

/** The gradient window of the opening screens. The loop plays only here; with reduced motion, the still image. */
function openingHero() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = dark ? 'dark' : 'light';
  return `<div class="hero" aria-hidden="true">${still ? '' : `<video class="loop" autoplay muted loop playsinline preload="auto"
    poster="assets/gradient-${name}.jpg" src="assets/gradient-${name}-loop.mp4" tabindex="-1" disablepictureinpicture disableremoteplayback></video>`}</div>`;
}
/** The logo: two rings that overlap, and the name. */
function brandMark() {
  return `<div class="brand"><svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="17" cy="9" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>Weholm</span></div>`;
}

const Screens = {
  loading() {
    return `<main class="screen loading-screen" aria-busy="true"><div class="loading-bg" aria-hidden="true"></div><div class="loading-body"><span class="rings-loader" role="img" aria-label="Loading"></span><p>Getting your household ready</p></div></main>`;
  },

  setup() {
    console.warn('Not connected to Firebase yet: add your project\'s web config to js/config.js.');
    return `<main class="screen">
      ${houseArt}
      <h1>Almost there</h1>
      <p class="lead">The app isn't ready yet. Please try again later.</p>
    </main>`;
  },

  error() {
    return `<main class="screen">
      ${houseArt}
      <h1>Something went wrong</h1>
      <p class="lead">${esc(S.fatal || "We couldn't load your household.")}</p>
      ${S.fatalCode ? `<p class="fine" style="text-align:left">Code for support: ${esc(S.fatalCode)}</p>` : ''}
      <div class="bottom-bar"><button class="btn primary" data-action="reload">Try again</button>
      <button class="btn ghost" data-action="signOut">Sign out</button></div>
    </main>`;
  },

  /* ---------- Signed out: the opening screens (gradient window with the loop, glass panel) ---------- */
  welcome() {
    const invited = !!S.pendingInvite;
    const from = S.inviteFrom ? esc(S.inviteFrom) : 'Your partner';
    const err = S.auth.error ? `<p class="form-error" role="alert">${esc(S.auth.error)}</p>` : '';
    const busy = S.auth.busy ? 'disabled' : '';
    return `<main class="screen welcome opening">
      ${openingHero()}
      <div class="opening-body">
        ${brandMark()}
        <h1 class="opening-title"><span>Make room</span><span>for <span class="us-word">us.</span></span></h1>
        <div class="glass">
          <p class="lead">${invited ? `${from} invited you to share your home.` : 'Share the home fairly. Get your time together back.'}</p>
          ${err}
          <form data-form="email" novalidate>
            <div class="field"><label for="f-email">Email</label>
              <input id="f-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(S.auth.values.email || '')}" data-auth-field="email"></div>
            <button class="btn primary" type="submit" ${busy}>Continue</button>
          </form>
          <button class="btn google" data-action="google" ${busy}>${Icon.google} Continue with Google</button>
          ${invited ? '' : '<button class="link-btn" data-action="inviteHelp">Got an invite? Join your partner</button>'}
        </div>
        ${legalLine()}
      </div>
    </main>`;
  },

  auth() {
    const mode = S.auth.mode;
    const titles = { signup: 'Nice to meet you.', signin: 'Welcome back.', reset: 'Reset your password' };
    const busy = S.auth.busy ? 'disabled' : '';
    const v = S.auth.values;
    const err = S.auth.error ? `<p class="form-error" role="alert">${esc(S.auth.error)}</p>` : '';
    const note = S.auth.note ? `<p class="form-note" role="status">${esc(S.auth.note)}</p>` : '';
    const field = (name, label, type, auto, extra = '', after = '') => {
      const input = `<input id="f-${esc(name)}" name="${name}" type="${type}" autocomplete="${auto}" value="${esc(v[name] || '')}" data-auth-field="${name}" ${extra}>`;
      return `<div class="field">
        <label for="f-${name}">${label}</label>
        ${type === 'password' ? Password.wrap(input) : input}${after}
      </div>`;
    };
    const fields = mode === 'reset'
      ? field('email', 'Email', 'email', 'email', 'required inputmode="email"')
      : (mode === 'signup' ? field('name', 'Your name', 'text', 'given-name', 'maxlength="40"') : '') +
        field('email', 'Email', 'email', 'email', 'required inputmode="email"') +
        field('password', 'Password', 'password', mode === 'signup' ? 'new-password' : 'current-password',
          mode === 'signup' ? `required minlength="${APP_CONFIG.passwordRules.minLength}" aria-describedby="f-pw-rules"` : 'required',
          mode === 'signup' ? Password.checklist(v.password).replace('<ul ', '<ul id="f-pw-rules" ') : '');
    const submit = { signup: 'Create account', signin: 'Sign in', reset: 'Send reset link' }[mode];
    // New or returning: one switch instead of two separate screens.
    const seg = mode === 'reset' ? '' : `<div class="seg" role="group" aria-label="New or returning">
        <button type="button" data-action="authMode" data-mode="signup" aria-pressed="${mode === 'signup'}">New here</button>
        <button type="button" data-action="authMode" data-mode="signin" aria-pressed="${mode === 'signin'}">I have an account</button></div>`;
    const link = mode === 'signin' ? '<button class="link-btn" data-action="authMode" data-mode="reset">Forgot password?</button>'
      : mode === 'reset' ? '<button class="link-btn" data-action="authMode" data-mode="signin">Back to sign in</button>' : '';
    return `<main class="screen opening auth-screen">
      ${openingHero()}
      <div class="back-row"><button class="icon-btn" data-action="nav" data-to="welcome" aria-label="Back">${Icon.back}</button></div>
      <div class="opening-body">
        ${brandMark()}
        <h1 class="opening-title">${titles[mode]}</h1>
        <div class="glass">
          ${seg}
          ${S.pendingInvite ? '<p class="lead">After this, you join your household.</p>' : ''}
          ${err}${note}
          <form data-form="auth" novalidate>
            ${fields}
            <button class="btn primary" type="submit" ${busy}>${S.auth.busy ? 'Please wait…' : submit}</button>
          </form>
          ${link}
        </div>
        ${legalLine()}
      </div>
    </main>`;
  },

  /* ---------- Signed in, no household ---------- */
  start() {
    const first = S.user && S.user.displayName ? ' ' + esc(S.user.displayName.split(' ')[0]) : '';
    return `<main class="screen opening start-screen">
      ${openingHero()}
      <div class="back-row"><button class="link-btn" data-action="signOut">Sign out</button></div>
      <div class="opening-body">
        ${brandMark()}
        <h1 class="opening-title"><span>Hi${first}.</span><span>Let's set up</span><span>your home.</span></h1>
        <div class="glass">
          <p class="lead">A few minutes, then a fair plan for you both.</p>
          <button class="btn primary" data-action="createHousehold">Set up our home</button>
        </div>
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
      <p class="lead">Check your internet connection. We'll keep trying and open your home as soon as we can.</p>
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
    const ready = Household.hasRooms(h);
    return `<main class="screen">
      ${topbar({ back: setup ? 'members' : 'settings', step: setup ? 'home' : null })}
      <h1>Your home</h1>
      <p class="lead">Count what your home has, so we only suggest what applies to you.</p>
      <div class="card">
        ${stepperRow('bedroom', 'Bedrooms', '', roomCount(h, 'bedroom'))}
        ${stepperRow('bathroom', 'Bathrooms', '', roomCount(h, 'bathroom'))}
        ${stepperRow('kitchen', 'Kitchens', '', roomCount(h, 'kitchen'))}
        ${stepperRow('living', 'Living rooms', '', roomCount(h, 'living'))}
        ${stepperRow('office', 'Home offices', '', roomCount(h, 'office'))}
      </div>
      <div class="card">
        ${stepperRow('children', 'Children', '', h.children.length)}
        ${stepperRow('dog', 'Dogs', '', Household.petCount(h, 'dog'))}
        ${stepperRow('cat', 'Cats', '', Household.petCount(h, 'cat'))}
        ${stepperRow('otherpet', 'Other pets', '', Household.petCount(h, 'other'))}
        ${stepperRow('garden', 'Gardens', '', roomCount(h, 'garden'))}
        ${stepperRow('vehicle', 'Vehicles', '', roomCount(h, 'vehicle'))}
      </div>
      <div class="bottom-bar">
        ${ready ? '' : '<p class="count">Add at least one room to continue</p>'}
        <button class="btn primary" data-action="nav" data-to="${esc(setup ? 'responsibilities' : 'settings')}" ${ready ? '' : 'disabled'}>${setup ? 'Show what needs doing' : 'Done'}</button></div>
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
      const rows = items.map(item => {
        const on = selected.has(item.id);
        // A big task that can be split: a quiet link once it's ticked; its parts show underneath once split.
        const r = on && Library.parts(item.id).length > 1 ? h.responsibilities.find(x => x.libraryId === item.id) : null;
        const parts = r ? Household.parts(r) : [];
        const split = r ? `<button class="row-link" data-action="splitOpen" data-id="${esc(r.id)}" aria-label="${parts.length ? `Edit the parts of ${esc(item.name)}` : `Split ${esc(item.name)} into parts`}">${parts.length ? 'Edit' : 'Split'}<span aria-hidden="true"> ›</span></button>` : '';
        return `<div class="row-wrap"><button class="row" data-action="toggleResp" data-id="${esc(item.id)}" aria-pressed="${on}">
          <span class="check" aria-hidden="true">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${esc(item.name)}</span>${parts.length ? `<span class="row-sub">${esc(parts.map(p => p.name).join(' · '))}</span>` : ''}</div>
        </button>${split}</div>`;
      }).join('');
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
      <p class="lead" style="margin-bottom:0">${setup ? 'Tick everything that applies. Big ones can be split.'
        : active ? "Tick anything new. You'll both say how you feel about new tasks, then the app shares them fairly."
        : 'Tick everything that applies. The plan updates straight away.'}</p>
      ${sections}
      ${ownSection}
      <div class="section-head"><h2 class="section-title">Something missing?</h2></div>
      ${addOwnRow('Add a task')}
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
          // A split task: each part has its own rhythm and time.
          if (Household.isSplit(r)) return Household.parts(r).map(p => {
            const pt = Timing.of(Household.partUnit(r, p));
            return `<div class="timing-row">
            <span class="row-title" id="t-${esc(p.id)}">${esc(p.name)}<span class="row-sub" style="display:block">Part of ${esc(r.name)}${roomWord(r) ? ` · time for each ${roomWord(r)}` : ''}</span></span>
            <div class="timing-controls">
              <select class="select" data-change="frequency" data-id="${esc(r.id)}" data-part="${esc(p.id)}" aria-label="How often: ${esc(p.name)}">${frequencyOptions(pt.frequency)}</select>
              <select class="select minutes" data-change="minutes" data-id="${esc(r.id)}" data-part="${esc(p.id)}" aria-label="How long each time: ${esc(p.name)}">${minuteOptions(pt.each)}</select>
            </div>
          </div>`;
          }).join('');
          const t = Timing.of(r);
          return `<div class="timing-row">
            <span class="row-title" id="t-${esc(r.id)}">${esc(r.name)}${roomWord(r) ? `<span class="row-sub" style="display:block">Time for each ${roomWord(r)}${t.rooms > 1 ? ` · ${formatMinutes(t.minutes)} in total` : ''}</span>` : ''}</span>
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
      ${stage === 'active' ? `<p class="form-note" style="margin-top:16px">Your plan is running. Times you change here only change when tasks are due, not who does them.</p>` : ''}
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
      <h1>Split ${esc(r.name)} into parts</h1>
      <p class="lead" style="margin-bottom:0">${isOwner
        ? 'Tick the parts you want as separate tasks. Each one gets its own time and can go to a different person.'
        : `Pick the parts you'd like as separate tasks. ${ownerName} decides.`}</p>
      <div class="section-head"><h2 class="section-title">Parts</h2><span class="section-meta">${on.length} chosen</span></div>
      <div class="card">${rows}
        <div class="field" style="border-top:1px solid var(--line)"><label for="bd-new">Add your own part</label>
          <div class="field-line"><input id="bd-new" maxlength="60" placeholder="e.g. ${esc(Library.partExample(r))}" value="${esc(bd.newName || '')}" data-input="breakNew" enterkeyhint="done" autocomplete="off">
          <button class="mini add-part" data-action="addBreakPart" ${(bd.newName || '').trim() ? '' : 'disabled'}>Add</button></div></div>
      </div>
      <p class="fine" style="text-align:left;margin:0 4px 6px">Each part becomes its own task. The app shares them fairly between you.</p>
      <p class="fine" style="text-align:left;margin:0 4px">Together about ${formatMinutes(total)} a week. As one task it was ${formatMinutes(Timing.weeklyMinutes(r))}.</p>
      <div class="bottom-bar">
        ${isOwner
          ? `<button class="btn primary" data-action="saveBreakdown" ${on.length < 2 ? 'disabled' : ''}>${wasSplit ? 'Save the parts' : 'Split into parts'}</button>
             ${wasSplit ? `<button class="btn ghost" data-action="mergeBreakdown">Make it one task again</button>` : ''}`
          : `<button class="btn primary" data-action="suggestBreakdown" ${on.length < 2 ? 'disabled' : ''}>Suggest these parts</button>`}
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
        <h1>Thanks!</h1><p class="lead">When you have both answered, you'll see who gets the new ${noun}s.</p>
        <div class="bottom-bar"><button class="btn secondary" data-action="nav" data-to="household">Back to Us</button></div></main>`;
    }
    const accepted = (rsh.accepted || {})[me];
    const waiting = h.members.filter(m => !(rsh.accepted || {})[m.uid]).map(m => esc(Household.memberName(m)));
    const moved = (rsh.moved || []).map(id => Household.unit(h, id)).filter(Boolean);
    const changeRow = u => {
      const now = Household.assignee(h, u.id), next = (rsh.proposal || {})[u.id];
      return `<div class="row static"><div class="row-text"><span class="row-title">${esc(u.name)}</span>
        <span class="row-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${esc(Timing.label(u))}${now !== next && h.memberIds.includes(now) ? ` · before: ${now === me ? 'you' : who(now)}` : ''}</span></div>
        <span class="tag" style="${next === me ? 'background:var(--accent-soft);color:var(--ink)' : ''}">${who(next)}</span></div>`;
    };
    return `<main class="screen">
      ${topbar({ back: 'household' })}
      <h1>Here's how the new ${noun}s would be shared</h1>
      <p class="lead" style="margin-bottom:12px">${moved.length
        ? `The new ${noun}s take a lot of time, so a few other tasks also move, to keep things fair.`
        : `Only the new ${noun}s are shared. Everything else in your plan stays as it is.`}</p>
      <div class="card">${units.map(changeRow).join('')}</div>
      ${moved.length ? `<div class="section-head"><h2 class="section-title">Also moving</h2></div>
        <div class="card">${moved.map(changeRow).join('')}</div>` : ''}
      ${rsh.loads ? `<div class="card" style="margin-top:16px"><div class="balance" style="flex-direction:column;align-items:stretch;gap:6px">${h.members.map(m =>
        `<div style="display:flex;justify-content:space-between"><span>${who(m.uid)}</span><span class="sub">about ${formatMinutes(rsh.loads[m.uid] || 0)} a week</span></div>`).join('')}</div></div>` : ''}
      <div class="bottom-bar">${accepted
        ? `<p class="count">Waiting for ${waiting.join(' and ')} to say yes</p>`
        : `<button class="btn primary" data-action="acceptReshare">Yes, looks good</button>
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
          <p class="plain" style="margin:0">${sub.cancelAtPeriodEnd ? "You've cancelled, so you won't be charged." : `Then ${money(sub.interval === 'month' ? price.monthly : price.yearly)} a ${sub.interval || 'year'}. Cancel any time before ${date(sub.trialEnd)} and you won't be charged.`}</p>`;
      } else if (sub.source === 'stripe' && sub.periodEnd) {
        status = `<p class="joke">${sub.interval === 'month' ? 'Monthly' : 'Yearly'} plan</p>
          <p class="plain" style="margin:0">${sub.cancelAtPeriodEnd ? `Ends on ${date(sub.periodEnd)}.` : `Renews on ${date(sub.periodEnd)}.`}</p>`;
      } else {
        status = `<p class="joke">Your home is unlocked 🎉</p><p class="plain" style="margin:0">It covers both of you.</p>`;
      }
      if (isOrg && sub.source === 'stripe' && sub.status === 'past_due') {
        status += `<p class="plain" style="margin:8px 0 0"><b>Your last payment didn't go through.</b> We'll try again. Please update your card so your plan keeps running.</p>`;
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
          ? `<div class="result-card" role="status"><div class="spinner small" aria-hidden="true"></div><p class="plain" style="margin:0">Checking your subscription…</p></div>`
          : `<div class="result-card" role="status"><p class="joke">We couldn't check your subscription</p>
              <p class="plain" style="margin:0">To make sure you're not charged twice, please check your internet connection and try again.</p></div>
             <button class="btn secondary" data-action="reload">Try again</button>`;
      } else if (billing && Entitlements.paymentProblem(S.stripeSubs)) {
        action = `<div class="result-card" role="status"><p class="joke">There's a problem with your payment</p>
            <p class="plain" style="margin:0">Your bank said no, or the payment needs your OK. Fix it in your subscription settings. You don't need to buy again.</p></div>
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
          <div class="plans" role="radiogroup" aria-label="Choose how to pay">
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
      <p class="lead">Only you see your answers. The app uses both your answers to make a fair plan.</p>
      ${totalCard(h)}
      ${sections}
      <div class="bottom-bar">
        <p class="count" aria-live="polite">${marked ? `${plural(marked, 'task')} marked` : "Nothing marked yet. That's fine too."}</p>
        <button class="btn primary" data-action="submitReview">See our plan</button>
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
      lead = `Here's a first draft. When ${partnerName} joins, they add their answers and the app makes the plan from both.`;
      top = totalCard(h);
      bottom = `<div class="bottom-bar">${hasAccess()
        ? `${invited ? `<p class="count">${partnerName} hasn't joined yet</p>` : ''}
           <button class="btn primary" data-action="invite">${invited ? 'Send the link again' : `Invite ${partnerName} to see the plan`}</button>`
        : (!Backend.Billing.enabled() && S.premiumRequest && S.premiumRequest.status === 'pending')
          ? `<p class="count">We'll unlock your home once it's approved</p>
             <button class="btn premium" disabled>Waiting for approval</button>`
          : `<p class="count">${trialOffer() ? `${APP_CONFIG.billing.trialDays} days free, then ${money(APP_CONFIG.billing.display.yearly)}/year` : 'One subscription covers you both'}</p>
           <button class="btn premium" data-action="nav" data-to="subscribe">${trialOffer() ? 'Start free and invite ' + partnerName : 'Unlock and invite ' + partnerName}</button>`}
      </div>`;
    } else if (stage === 'review') {
      head = 'Your plan';
      lead = `${partnerName} is adding their answers. When they're done, your plan shows here.`;
    } else {
      const by = h.plan && h.plan.rebalancedBy;
      head = "Here's your plan";
      lead = by === me ? 'We updated the plan with your answers. Have a look and tap Start this plan if it works for you.'
        : by ? `${esc(Household.memberName(Household.member(h, by)))} changed some answers, so we updated the plan. Have a look and tap Start this plan if it works for you.`
        : "Made from both your answers. If you don't like something, tap it to swap. When you both agree, tap Start this plan.";
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
    const needs = needsCarousel(calendarCards(h) + statusBanner(h) + swapCards(h) + suggestionsCard(h, true) + newTasksCard(h) + (isOrg ? timeHintsCard(h) : '') + feedbackCard(h));
    const names = Household.people(h).map(m => esc(Household.memberName(m).split(' ')[0])).join(' & ');
    return `<main class="screen has-nav">
      <div class="topbar">${Feedback.link('household')}<span class="spacer"></span>${settingsButton()}</div>
      <div class="greeting"><p class="hello">${names}</p>
        <h1 class="mood">Our home</h1>
      </div>
      ${needs ? `<div class="section-head"><h2 class="section-title">Needs you</h2></div>${needs}` : ''}
      ${weekCard(h)}
      ${boardCard(h)}
      ${personLists(h)}
      <button class="plain-row add" data-action="addCustomTask"><span class="plus" aria-hidden="true">${Icon.plus}</span><span class="pr-title">Add a task</span></button>
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
    // Someone away: their tasks I look after carry a small "for Ian".
    const forWho = r => (lists.forOther.has(r.id) ? `<span class="tag away-tag">${esc(Household.memberName(Household.member(h, Household.assignee(h, r.id)) || {}).split(' ')[0])}'s task</span> ` : '');
    const tick = (r, sub, done) => `<button class="row ${done ? 'done' : ''}" data-action="toggleDone" data-id="${esc(r.id)}" aria-pressed="${done}">
        <span class="check" aria-hidden="true">${Icon.check}</span>
        <div class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${forWho(r)}${r.parentName ? esc(r.parentName) + ' · ' : ''}${sub}</span></div>
      </button>${feelStrip(r.id)}`;
    const doneToday = r => Schedule.doneOn(Household.completion(h, r.id), now);
    // Done for me by the other person today: off my list, with a line saying so.
    const awayNow = Household.awayNow(h, me, now.getTime());
    const back = awayNow ? null : Household.coveredWhileAway(h, me, now);
    const covered = awayNow ? [] : Household.coveredForMe(h, me, now);
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
      return { r, done, sub: done ? 'Done today' : c && c.last ? `Last done ${esc((rel => /^(Today|Tomorrow|Yesterday)$/.test(rel) ? rel.toLowerCase() : rel)(Schedule.relative(c.last, now)))}` : 'Whenever it\'s needed' };
    }).sort(byOpen).map(x => tick(x.r, x.sub, x.done));
    const mine = Household.myNoteTasks(h, me);
    const board = mine.filter(n => n.kind !== 'cal');
    const planned = mine.filter(n => n.kind === 'cal').sort((a, b) => (a.day + (a.time || '99')).localeCompare(b.day + (b.time || '99')));
    const nothing = !awayNow && !today.length && !week.length && !anytime.length && !board.length && !planned.length && !covered.length;
    const awayCard = awayNow ? awayTodayCard(h, awayNow, now) : '';
    const partnerId = Household.peopleIds(h).find(x => x !== me);
    const partnerAway = !awayNow && partnerId ? Household.awayNow(h, partnerId, now.getTime()) : null;
    const awayLine = partnerAway ? `<p class="away-line">${esc(partnerFirst(h))} is away until ${esc(calDayLabel(partnerAway.until || partnerAway.day, now))}.</p>` : '';
    const backLine = back ? `<div class="card helped"><div class="row static"><span class="helped-mark" aria-hidden="true">💛</span><div class="row-text"><span class="row-title">${esc(AwayLines.back(partnerFirst(h), now))}</span></div></div></div>` : '';
    const bothAway = awayNow && (awayNow.for === 'any' || Household.awayOn(h, Household.dayKey(now.getTime())).size > 1);
    const title = awayNow ? AwayLines.away(awayNow.text, bothAway, partnerFirst(h), now)
      : partnerAway ? AwayLines.home(partnerFirst(h), now) : Mood.line(now, progress);
    const helped = !back && covered.length ? `<div class="card helped">${covered.map(x =>
      `<div class="row static"><span class="helped-mark" aria-hidden="true">💛</span><div class="row-text"><span class="row-title">${esc(HelpLines.line(Household.memberName(Household.member(h, x.by)).split(' ')[0], x.unit.name, x.unit.id + Schedule.key(now)))}</span></div></div>`).join('')}</div>` : '';

    return `<main class="screen has-nav me">
      <div class="topbar">${Feedback.link('today')}<span class="spacer"></span>${settingsButton()}</div>
      <div class="greeting"><p class="hello">Hello, ${first}</p>
        <h1 class="mood">${esc(title)}</h1>
      </div>
      ${awayCard}
      ${progress.count ? progressBar(progress.pct, 'Your day', progress.left ? `${progress.doneCount} of ${progress.count} done` : 'All done') : ''}
      ${awayLine}${backLine}${helped}
      ${planned.length ? `<div class="section-head"><h2 class="section-title">From the calendar</h2></div>
        <div class="card">${planned.map(n => noteTaskRow(h, n, me, false)).join('')}</div>` : ''}
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
      usable && stage !== 'active' ? row(go('rate'), 'Your answers', marked ? `${plural(marked, 'task')} marked` : 'Nothing marked') : '',
      (isOrg || on) && stage !== 'setup' ? row(go('subscribe'), 'Your subscription', subStatus) : info('Your subscription', subStatus),
    ]);

    const people = Household.people(h).map(m => esc(Household.memberName(m))).join(' & ');
    const invited = !!(h.settings && h.settings.invitedAt);
    const alone = Household.alone(h);
    const roomsOf = type => roomCount(h, type);
    const homeBits = [plural(roomsOf('bedroom'), 'bedroom'), plural(roomsOf('bathroom'), 'bathroom')];
    if (h.children.length) homeBits.push(plural(h.children.length, 'child', 'children'));
    [['dog', 'dog'], ['cat', 'cat'], ['other', 'pet']].forEach(([t, w]) => { const n = Household.petCount(h, t); if (n) homeBits.push(plural(n, w)); });
    if (roomsOf('garden')) homeBits.push(plural(roomsOf('garden'), 'garden'));
    if (roomsOf('vehicle')) homeBits.push(plural(roomsOf('vehicle'), 'vehicle'));
    const ours = group('Our home', [
      isOrg && usable ? row(go('members'), 'People', alone ? `${esc(people)} · ${invited ? 'invite sent' : 'not joined yet'}` : esc(people)) : info('People', esc(people)),
      isOrg && alone && h.settings.onboarded ? row('data-action="invite"', `Invite ${esc(partnerName)}`, hasAccess() ? (invited ? 'Send the link again' : 'Send the invite link') : 'Starts with your subscription') : '',
      isOrg && usable ? row(go('home'), 'Your home', esc(homeBits.join(' · '))) : '',
      isOrg && usable ? row(go('responsibilities'), 'Tasks', plural(h.responsibilities.length, 'task')) : '',
      isOrg && usable ? row(go('frequency'), 'Times', `about ${formatMinutes(Household.weeklyTotal(h))} a week`) : '',
      !isOrg && on ? row('data-action="suggestChanges"', 'Our tasks', `Suggest changes · ${esc(orgName)} decides`) : '',
      on && !alone && stage !== 'setup' && h.plan ? row(go('swap'), 'Swap', `Offer one of your tasks to ${esc(partnerName)}`) : '',
    ]);

    const contact = APP_CONFIG.legal && APP_CONFIG.legal.email;
    const help = group('Help & legal', [
      `<button class="row" data-action="openFeedback"><div class="row-text"><span class="row-title">Send feedback</span><span class="row-sub">What works, what doesn't, what confused you</span></div><span class="chev">${Icon.chev}</span></button>`,
      `<a class="row" href="legal.html" target="_blank" rel="noopener"><div class="row-text"><span class="row-title">Legal notice, privacy and terms</span></div><span class="chev">${Icon.chev}</span></a>`,
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
          <span class="row-sub">${isOrg ? `${esc(partnerName)} will manage the household` : "You'd need a new invite to come back"}</span></div></button>` : ''}
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
      <h1 style="margin-top:0">Our tasks</h1>
      <p class="lead">Suggest tasks to add, remove or split into parts.</p>
      ${suggestionsCard(h)}
      ${taskMap(h)}
      <div class="section-head"><h2 class="section-title">Suggest a new task</h2></div>
      <div class="card"><div class="field" style="margin:0;padding:14px 16px">
        <label for="sg-add">What else needs doing?</label>
        <input id="sg-add" maxlength="60" placeholder="e.g. Water the plants" autocomplete="off" enterkeyhint="done">
        <button class="btn secondary" style="margin-top:12px" data-action="suggestAdd">Suggest it</button>
      </div></div>
      ${reshuffleBlock(h)}
      <div style="height:96px"></div>
      <div class="bottom-bar"><p class="count">${plural(count, 'suggestion')} for ${orgName}</p>
        <button class="btn primary" data-action="doneSuggesting">Done</button></div>
    </main>`;
  },

  /* ---------- Swap: your tasks, offer any of them to your partner ---------- */
  /* ---------- The month: a dot on every day with something planned; tap a day to see it ---------- */
  calendar() {
    const h = S.household;
    if (Household.stage(h) !== 'active') return Screens.household();
    const now = new Date();
    const today = Household.dayKey(now.getTime());
    const month = Household.calMonthOf(S.calMonth);
    const [y, m] = month.split('-').map(Number);
    const [lo, hi] = calMonthRange();
    const sel = S.calDay && S.calDay.slice(0, 7) === month ? S.calDay : (today.slice(0, 7) === month ? today : `${month}-01`);
    const items = Household.calAll(h);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;                         // Monday first
    const key = d => `${month}-${String(d).padStart(2, '0')}`;
    const count = day => items.filter(n => !n.away && Household.calOn(n, day)).length;
    const away = day => items.some(n => n.away && Household.calOn(n, day));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank" aria-hidden="true"></span>');
    for (let d = 1; d <= days; d++) {
      const k = key(d); const c = count(k);
      const a = away(k) ? ` away${d === 1 || !away(key(d - 1)) ? ' away-start' : ''}${d === days || !away(key(d + 1)) ? ' away-end' : ''}` : '';
      const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (a ? ', someone is away' : '') + (c ? `, ${plural(c, 'thing')} planned` : '');
      cells.push(`<button class="cal-cell${k === today ? ' today' : ''}${k === sel ? ' picked' : ''}${k < today ? ' past' : ''}${a}" data-action="calPickDay" data-key="${k}" aria-label="${esc(label)}" aria-pressed="${k === sel}">
        <span class="cal-num">${d}</span><span class="cal-dot${c ? ' on' : ''}" aria-hidden="true"></span></button>`);
    }
    const dayItems = items.filter(n => Household.calOn(n, sel));
    const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const selLabel = calDayLabel(sel, now);
    return `<main class="screen has-nav">
      ${topbar({ back: 'household', lead: Feedback.link('calendar') })}
      <div class="cal-month-head">
        <button class="icon-btn" data-action="calMonthGo" data-delta="-1" aria-label="Previous month" ${month <= lo ? 'disabled' : ''}>${Icon.back}</button>
        <h1 class="cal-month-title" aria-live="polite">${esc(title)}</h1>
        <button class="icon-btn flip" data-action="calMonthGo" data-delta="1" aria-label="Next month" ${month >= hi ? 'disabled' : ''}>${Icon.back}</button>
      </div>
      <div class="card cal-grid-card">
        <div class="cal-weekdays" aria-hidden="true">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="cal-grid" role="group" aria-label="${esc(title)}">${cells.join('')}</div>
      </div>
      <div class="section-head"><h2 class="section-title">${esc(selLabel === 'Today' || selLabel === 'Tomorrow' ? selLabel : new Date(sel + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</h2></div>
      <div class="card cal-list cal-day-list">${dayItems.length ? dayItems.map(n => calRow(h, n, now)).join('') : '<p class="cal-empty" style="padding:14px">Nothing planned.</p>'}</div>
      ${sel >= today ? `<button class="plain-row add" data-action="addCal" data-key="${esc(sel)}"><span class="plus" aria-hidden="true">${Icon.plus}</span><span class="pr-title">Add to this day</span></button>` : ''}
      <div style="height:calc(24px + env(safe-area-inset-bottom))"></div>
      ${bottomNav('household', navDots(h))}
    </main>`;
  },

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
        ? `<div class="row static"><div class="row-text"><span class="row-title">${name}</span><span class="row-sub">${esc(Timing.label(u))}</span></div><span class="tag">Offered</span></div>`
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
      const sub = `${plural(items.length, 'task')}${people.includes(me) && Household.stage(h) !== 'setup' ? ` · ${mine} yours` : ''}${free ? ` · ${free} with nobody` : ''}`;
      const rows = expanded ? items.map(r => {
        const parts = Household.parts(r).length;
        return `<button class="row task-row" data-action="openTask" data-id="${esc(r.id)}">
          <div class="row-text"><span class="row-title">${esc(r.name)}</span>
            <span class="row-sub">${esc(Timing.label(r))}${parts ? ` · ${plural(parts, 'part')}` : ''}${r.mentalLoad ? ' · Planning' : ''}${Household.suggestionFor(h, me, 'remove', r.id) ? ' · Removal suggested' : ''}</span></div>
          ${ownerBadges(h, r)}</button>`;
      }).join('') : '';
      return `<button class="row cat-head" data-action="toggleCat" data-key="${esc(category.id)}" aria-expanded="${expanded}">
          <div class="row-text"><span class="row-title">${esc(category.name)}</span><span class="row-sub">${sub}</span></div>
          <span class="chev" aria-hidden="true">${Icon.chev}</span></button>${rows}`;
    }).join('')}</div>`;
}
/** Us: everyone's tasks, split by person. Each part opens from its heading; inside, a plain list of the tasks. */
function personLists(h) {
  const me = S.user.uid;
  const now = new Date();
  const open = S.openParts || {};
  const ids = Household.peopleIds(h).sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
  // The whole list, not this week's: each line says how often and how long, never whether it's done.
  const row = u => `<button class="plain-row task-row" data-action="openTask" data-id="${esc(u.parentId || u.id)}">
      <span class="pr-title">${esc(u.name)}</span><span class="pr-sub">${u.parentName ? esc(u.parentName) + ' · ' : ''}${esc(Timing.label(u))}</span></button>`;
  // Daily first, then weekly, anytime and the rarer ones.
  const rank = u => Household.slot(u) === 'today' ? 0 : Household.dueThisWeek(h, u, now) ? 1 : Household.slot(u) === 'anytime' ? 2 : 3;
  const ordered = list => list.map((u, i) => ({ u, i, k: rank(u) })).sort((x, y) => x.k - y.k || x.i - y.i).map(x => x.u);
  const loads = Household.loads(h);
  const part = (key, cls, title, units, minutes) => {
    const expanded = !!open[key];
    return `<section class="person-part ${cls}">
      <h2 class="part-head"><button class="part-toggle" data-action="togglePart" data-key="${esc(key)}" aria-expanded="${expanded}" aria-controls="part-${esc(key)}">
        <span class="part-name"><span class="part-title">${title}</span>${minutes != null ? `<span class="part-time">about ${formatMinutes(minutes)} a week</span>` : ''}</span><span class="part-meta">${units.length}</span><span class="chev" aria-hidden="true">${Icon.chev}</span></button></h2>
      <div class="plain-list" id="part-${esc(key)}"${expanded ? '' : ' hidden'}>${units.length ? units.map(row).join('') : '<p class="part-empty">Nothing here yet.</p>'}</div>
    </section>`;
  };
  return ids.map(uid => {
    const units = ordered(Household.units(h).filter(u => Household.assignee(h, u.id) === uid));
    const name = uid === me ? 'Your part' : `${esc(Household.memberName(Household.member(h, uid)).split(' ')[0])}'s part`;
    return part(uid, uid === me ? 'is-me' : 'is-partner', name, units, loads[uid] || 0);
  }).join('') + (homeless(h).length ? part('free', 'is-free', 'Nobody has these yet', homeless(h)) : '');
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
  return `<div class="swap-card" role="status"><p class="joke">${plural(waiting.length, 'new task')} to share</p>
    <p class="plain">${esc(waiting.map(u => u.name).join(', '))}. You both say how you feel about ${waiting.length === 1 ? 'it' : 'them'}, then the app shares ${waiting.length === 1 ? 'it' : 'them'} fairly.</p>
    <button class="btn primary" data-action="shareNow">Share ${waiting.length === 1 ? 'it' : 'them'} now</button></div>`;
}
/** Beta: once, on this person's day 4. */
function feedbackCard(h) {
  if (!Feedback.cardDue(h)) return '';
  return `<div class="swap-card" role="status"><p class="joke">How's it going so far?</p>
    <p class="plain">Tell us what works and what doesn't.</p>
    <div class="btns"><button class="btn primary" data-action="feedbackCard" data-key="tell">Tell us</button>
    <button class="btn secondary" data-action="feedbackCard" data-key="later">Not now</button></div></div>`;
}
/** When nothing needs me: a calm line, the same all day, a different one tomorrow. */
const ALL_CLEAR = Object.freeze([
  'All clear. Nothing needs you right now.',
  'Nothing for now. Enjoy the quiet.',
  'All quiet at home.',
  'Hey, nothing for now!',
  'All clear. Enjoy your day.',
  'Nothing waiting for you. Well done.',
  'Nothing to do here. Nice.',
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
  if (h.reshuffle && h.reshuffle.status === 'pending') return `<p class="fine" style="margin-top:24px">You asked for a new plan. Waiting for ${pName}.</p>`;
  return `<div style="margin-top:24px"><button class="btn secondary" data-action="askReshuffle">Make a new plan</button>
    <p class="fine">${pName} needs to agree first. Often a swap is enough.</p></div>`;
}
/** Suggestions: the organiser decides; the partner sees their own, waiting. */
function suggestionsCard(h, oneEach) {
  const me = S.user.uid;
  const isOrg = Household.isOwner(h, me);
  const orgName = esc(Household.memberName(Household.owner(h)));
  const all = Household.suggestions(h);
  const label = x => x.type === 'breakdown' ? `Split into parts: ${esc(x.name)}` : `${x.type === 'add' ? 'Add' : 'Remove'}: ${esc(x.name)}`;
  if (isOrg && all.length) {
    const wrap = rows => oneEach ? rows.map(r => `<div class="card">${r}</div>`).join('') : `<div class="card">${rows.join('')}</div>`;
    return wrap(all.map(x => {
      const by = esc(Household.memberName(Household.member(h, x.by) || {}));
      return `<div class="row static col">
        <div class="row-text"><span class="row-title">${label(x)}</span>
          <span class="row-sub">${x.type === 'breakdown' ? `Into ${esc((x.parts || []).map(p => p.name).join(', '))} · ` : ''}${x.type === 'add' && x.frequency ? `${esc(Timing.label({ frequency: x.frequency, minutes: x.minutes || 15 }))} · ` : ''}Suggested by ${by}</span></div>
        <div class="btn-pair">
          <button class="btn primary" data-action="acceptSuggestion" data-id="${esc(x.id)}">${x.type === 'add' ? 'Add it' : x.type === 'breakdown' ? 'Use these parts' : 'Remove it'}</button>
          <button class="btn secondary" data-action="declineSuggestion" data-id="${esc(x.id)}">Keep it</button>
        </div></div>`;
    }));
  }
  const mine = isOrg ? [] : all.filter(x => x.by === me);
  if (!mine.length) return '';
  return `<div class="card"><div class="row static"><div class="row-text"><span class="row-title">Your suggestions</span><span class="row-sub">Waiting for ${orgName}</span></div></div>
    ${mine.map(x => `<div class="row static"><div class="row-text"><span class="row-title">${label(x)}</span></div>
      <button class="link-btn" data-action="withdrawSuggestion" data-id="${esc(x.id)}">Take back</button></div>`).join('')}</div>`;
}
/* ---------- The line under "Hello, Ian": by time of day and how my day is going. Never about the partner. ---------- */
/** Warm one-liners for when the other person did one of your tasks. Picked by task and day, so they don't jump around. */
const HelpLines = (() => {
  const LINES = [
    (n, t) => `${n} did ${t} today. One less thing for you.`,
    (n, t) => `${t} is done. ${n} took care of it.`,
    (n, t) => `${n} did ${t} for you today.`,
    (n, t) => `Good news: ${n} already did ${t}.`,
    (n, t) => `${t}? Done, thanks to ${n}.`,
    (n, t) => `${n} helped you with ${t} today.`,
    (n, t) => `${n} was quicker and did ${t}. Lucky you!`,
    (n, t) => `${t} is off your list. ${n} did it.`,
  ];
  const hash = str => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { line: (name, task, key) => LINES[hash(key) % LINES.length](name, task), LINES };
})();
/** Titles on Me while someone is away. The reason picks the tone; sad and health words always win,
 *  and anything unknown gets neutral lines (never "enjoy"). One line per day, the same all day. */
const AwayLines = (() => {
  const GENTLE = /\b(funeral|hospital|surgery|operation|doctor|clinic|sick|ill|illness|health|treatment|recovery|family|mum|mom|mother|dad|father|parents?|grandma|grandpa|grandmother|grandfather|granny)\b/i;
  const WORK = /\b(work|business|conference|meeting|client|office|training|course|fair|seminar|workshop|job|project)\b/i;
  const HOLIDAY = /\b(holidays?|vacation|trip|travel|beach|festival|wedding|weekend|friends|ski|skiing|camping|concert|getaway|honeymoon)\b/i;
  const tone = reason => (GENTLE.test(reason) ? 'gentle' : WORK.test(reason) ? 'work' : HOLIDAY.test(reason) ? 'holiday' : 'neutral');
  const ONE = {   // you're away; {name} is at home
    gentle: ["Take your time. {name} has it.", "Look after yourself. All is well.", "No worries here. {name}'s got it.", "Be where you're needed."],
    work: ["Go get it. {name} is holding the fort.", "You at work, {name} at home.", "Busy days? Home is in {name}'s hands.", "Do your thing. {name}'s got home."],
    holiday: ["Have fun! {name}'s got the home.", "Enjoy it. {name}'s on home duty.", "Postcards optional. {name}'s on it.", "Make it count. {name}'s at home."],
    neutral: ["Home is in good hands. Thanks, {name}.", "{name} is holding the fort.", "Nothing needs you today.", "Your list can wait. {name}'s on it."],
  };
  const BOTH = {
    gentle: ["Take your time. Home can wait.", "Be with each other. Home can wait.", "Nothing to think about here.", "Look after each other."],
    work: ["Out of office: both of you.", "Busy days. The house is resting.", "Both on the road. Home's on pause.", "The chores will wait."],
    holiday: ["The house is on holiday too.", "The dishes can wait. Enjoy.", "Two away, zero chores.", "Somewhere nicer than the kitchen?", "Gone together. Enjoy every bit."],
    neutral: ["Off duty, both of you.", "Home's on pause. You're not.", "The house will keep.", "No chores today. Just you two."],
  };
  const HOME = ['Holding the fort today.', 'Running the home solo. Nice work.', "Home team of one. You've got this.", '{name} is lucky to have you.', 'Keeping it all going. Thank you.'];
  const BACK = ['Welcome back! {name} kept things going.', 'Good to have you home. {name} had it.', '{name} had it covered. Welcome home.',
    'Welcome home. All went well, thanks to {name}.', "You're back! {name} looked after things."];
  const pick = (list, now, name) => {
    const dayNo = Math.floor((Schedule.day(now) - new Date(now.getFullYear(), 0, 0)) / 864e5);
    return list[dayNo % list.length].replace(/\{name\}/g, name);
  };
  return {
    tone,
    ALL: [...Object.values(ONE).flat(), ...Object.values(BOTH).flat(), ...HOME],
    BACK,
    away: (reason, both, name, now = new Date()) => pick((both ? BOTH : ONE)[tone(reason)], now, name),
    home: (name, now = new Date()) => pick(HOME, now, name),
    back: (name, now = new Date()) => pick(BACK, now, name),
  };
})();

const Mood = (() => {
  const LINES = {
    early: {
      free: ['Nothing on today. Coffee first, then whatever you like.', 'A free day. Even the house is happy.'],
      fresh: ['A new day. Start with one small thing.', 'Up early. A good time for a quick task.'],
      going: ['Up early and already busy. Impressive.', 'Getting things done before most people are awake.'],
      done: ['All done before breakfast? Amazing.', 'Everything ticked. The rest of the day is yours.'],
    },
    morning: {
      free: ['Nothing due today. Enjoy the quiet.', 'No chores on the list. Plan something nice.'],
      fresh: ['Good morning. Start with the easiest one.', 'One tick and the day already feels lighter.'],
      going: ['Nice progress. Keep going.', 'Good work before lunch.'],
      done: ['Done before noon? Well done!', 'All done. The rest of the day is for you.'],
    },
    midday: {
      free: ['Lunch, then nothing. Perfect.', 'A free day. Enjoy it.'],
      fresh: ['Lots of time left. A quick task after lunch?', 'No rush. One at a time.'],
      going: ['Good progress. The afternoon already looks easier.', 'Nice progress. You earned a snack.'],
      done: ['Everything done by lunchtime. Wow!', 'All clear. Enjoy the rest of the day.'],
    },
    afternoon: {
      free: ['Nothing on the list. Relax when you like.', 'A free afternoon. Enjoy it.'],
      fresh: ['Ten minutes now means a calmer evening.', 'Still plenty of day left. Start small.'],
      going: ['Almost there. Just a little more.', 'A little more and you\'re done.'],
      done: ['All done. The evening is yours.', 'Ticked it all. Time for something fun.'],
    },
    evening: {
      free: ['Nothing to do tonight. Enjoy it.', 'Quiet evening, clear list.'],
      fresh: ['Still time. Or leave it for tomorrow.', 'Just one before you relax?'],
      going: ['Almost there. The sofa is waiting.', 'Almost done. You can do it.'],
      done: ['All done. Time to relax. 🛋️', 'Everything done. A well-earned evening.'],
    },
    night: {
      free: ['Nothing due. Sleep well.', 'All quiet. See you tomorrow.'],
      fresh: ['It\'s late. Tomorrow is a good day for tasks.', 'Rest now. The list will still be there.'],
      going: ['Good effort today. The rest can wait.', 'Time to rest. You did plenty.'],
      done: ['Everything done today. Sleep well.', 'Day complete. Good night.'],
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
  note:  { icon: 'note', label: 'Note',        hint: 'Stays up for 7 days.',   placeholder: 'e.g. Plumber comes Thursday at 10' },
  today: { icon: 'today', label: 'Today only',  hint: 'A quick job for today.', placeholder: 'e.g. Take the parcel to the post office' },
};
function boardSeenKey(h) { return `household-app/board-seen/${h.id}/${S.user.uid}`; }
function boardSeenAt(h) { return Number(SafeStorage.get(boardSeenKey(h)) || 0); }
function boardUnseen(h) { return Household.unseenNotes(h, S.user.uid, boardSeenAt(h)); }
/** Open or close the board. Opening remembers what was new, so it keeps its "New" tag while open. */
function openBoard(open) {
  if (open && !S.boardOpen && S.household && S.user) S.boardSeenBefore = boardSeenAt(S.household);
  S.boardOpen = !!open;
}
/** Board items waiting for me: free to take, or new since I last looked. */
function boardWaiting(h) {
  const me = S.user.uid;
  const seen = S.boardOpen ? (S.boardSeenBefore || 0) : boardSeenAt(h);
  const map = new Map();
  Household.boardNotes(h).forEach(n => {
    const w = Household.noteWaiting(h, n, me);
    const fresh = n.by !== me && n.createdAt > seen;
    if (w || fresh) map.set(n.id, { grab: w === 'grab', fresh });
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
    : count ? `<b>${count} for you</b>` : plural(items.length, 'note');
  const head = `<button class="board-head" data-action="${items.length ? 'toggleBoard' : 'addNote'}" aria-expanded="${!!S.boardOpen}">
      <span class="board-icon" aria-hidden="true">${Icon.board}</span><span class="board-title">Board</span>
      <span class="board-meta">${meta}</span>
      <span class="add-icon" aria-hidden="true">${items.length && S.boardOpen ? Icon.minus : Icon.plus}</span></button>`;
  const cls = `board${count ? ' waiting' : ''}`;
  if (!S.boardOpen || !items.length) return `<div class="${cls}">${head}</div>`;
  const now = new Date();
  const tags = w => !w ? '' : [w.grab ? 'Free to take' : '', w.fresh ? 'New' : '']
    .filter(Boolean).map(t => `<span class="note-tag">${t}</span>`).join('');
  const row = n => {
    const k = NOTE_KINDS[n.kind];
    const author = n.by === me ? 'You' : esc(Household.memberName(Household.member(h, n.by) || {}));
    let sub = `${author} · ${Schedule.relative(new Date(n.createdAt), now)}`;
    let act = '';
    if (n.kind === 'today') {
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

/* ---------- Calendar ---------- */
/** Months you can browse: from the month you joined to two years ahead. */
function calMonthRange() {
  const h = S.household;
  const me = Household.member(h, S.user.uid) || {};
  const joined = Date.parse(me.joinedAt || '') || Date.now();
  const lo = Household.dayKey(Math.min(joined, Date.now())).slice(0, 7);
  const t = new Date(); const hiD = new Date(t.getFullYear() + 2, t.getMonth(), 1);
  return [lo, `${hiD.getFullYear()}-${String(hiD.getMonth() + 1).padStart(2, '0')}`];
}
/** "Today", "Tomorrow" or "Thu 22 Oct" for a day key. */
function calDayLabel(day, now = new Date()) {
  const today = Household.dayKey(now.getTime());
  const tomorrow = Household.dayKey(now.getTime() + 864e5);
  if (day === today) return 'Today';
  if (day === tomorrow) return 'Tomorrow';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}
/** Today while I'm away: where I am, who has the daily tasks, and "I'm back". */
function awayTodayCard(h, n, now) {
  const both = n.for === 'any' || Household.awayOn(h, Household.dayKey(now.getTime())).size > 1;
  const until = n.until && n.until > Household.dayKey(now.getTime()) ? `until ${calDayLabel(n.until, now)}` : 'today';
  return `<div class="card away-card"><div class="row static col">
    <div class="row-text"><span class="row-title">You're away ${esc(until)}</span>
    <span class="row-sub">${esc(n.text)} · ${both ? 'The home takes a break.' : `${esc(partnerFirst(h))} has the daily tasks.`}</span></div>
    <div class="btns" style="margin-top:2px"><button class="btn primary" data-action="endAway" data-id="${esc(n.id)}">I'm back</button></div>
  </div></div>`;
}
/** "20 October 2026 – 24 October 2026", or one day. */
function awayRange(day, until) {
  const f = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
  return until && until > day ? `${f(day)} – ${f(until)}` : f(day);
}
/** The month inside the calendar sheet. Note and task: one tap picks the day. Away: first tap the start, second the end. */
function datePicker(d, today) {
  const month = d.pickMonth || d.day.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const end = (d.away && d.until) || d.day;
  const cells = [];
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push('<span class="cal-cell blank" aria-hidden="true"></span>');
  for (let n = 1; n <= days; n++) {
    const k = `${month}-${String(n).padStart(2, '0')}`;
    const cls = (k === d.day ? ' start' : '') + (k === end ? ' end' : '') + (k > d.day && k < end ? ' in' : '');
    cells.push(`<button class="cal-cell${cls}" data-action="pickDay" data-key="${k}" ${k < today ? 'disabled' : ''} aria-pressed="${k >= d.day && k <= end}"><span class="cal-num">${n}</span></button>`);
  }
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `<div class="range-picker${d.away ? ' away' : ''}">
    <div class="cal-month-head">
      <button class="icon-btn" data-action="pickMonth" data-delta="-1" aria-label="Previous month" ${month <= today.slice(0, 7) ? 'disabled' : ''}>${Icon.back}</button>
      <span class="cal-month-title">${esc(title)}</span>
      <button class="icon-btn flip" data-action="pickMonth" data-delta="1" aria-label="Next month">${Icon.back}</button></div>
    <div class="cal-weekdays" aria-hidden="true">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid" role="group" aria-label="${esc(title)}">${cells.join('')}</div>
    <p class="fine" style="margin:6px 0 0">${d.away && !d.until ? 'Tap the last day.' : 'Tap a day to change it.'}</p></div>`;
}
/** "Overdue", the day and time ("Tomorrow · 10:00"), or a span ("Mon 19 – Fri 23 Oct", "Until Fri 23 Oct"). */
function calWhen(n, now = new Date()) {
  const today = Household.dayKey(now.getTime());
  if (n.task && n.doneAt) return 'Done';
  if (n.task && n.day < today) return 'Overdue';
  const time = n.time ? ` · ${n.time}` : '';
  if (n.until) return (n.day < today && n.until >= today ? `Until ${calDayLabel(n.until, now)}` : `${calDayLabel(n.day, now)} – ${calDayLabel(n.until, now)}`) + time;
  return calDayLabel(n.day, now) + time;
}
/** The small name chip: who does a task ("Anyone", "You", "Sam"), or who a note is about (nothing when it's both of you). */
function calWhoWord(h, n) {
  const me = S.user.uid;
  const o = n.task ? (n.doneAt ? n.doneBy : Household.calOwner(n)) : Household.calAbout(n);
  if (!o) return n.task ? 'Anyone' : n.away ? 'Both' : '';
  return o === me ? 'You' : esc(Household.memberName(Household.member(h, o) || {}).split(' ')[0]);
}
/** One line: what · who · when. Tapping opens it. */
function calRow(h, n, now = new Date()) {
  const today = Household.dayKey(now.getTime());
  const who = calWhoWord(h, n);
  const cls = n.away ? ' away' : n.task && n.doneAt ? ' done' : n.task && n.day < today ? ' overdue' : '';
  return `<button class="cal-row${cls}" data-action="openCal" data-id="${esc(n.id)}">
      <span class="cal-text">${esc(n.text)}</span>${who ? `<span class="cal-who">${who}</span>` : ''}
      <span class="cal-when">${esc(calWhen(n, now))}</span></button>`;
}

/** Us: the week ahead, one line per item. Overdue tasks first, then the next 7 days; the month view for the rest. */
function weekCard(h) {
  const now = new Date();
  const today = Household.dayKey(now.getTime());
  const end = Household.dayKey(now.getTime() + 6 * 864e5);
  const all = Household.calItems(h);
  const overdue = all.filter(n => n.task && n.day < today);
  const week = all.filter(n => !(n.task && n.day < today) && n.day <= end && (n.until || n.day) >= today);
  const later = all.filter(n => n.day > end);
  const rows = [...overdue, ...week];
  return `<section class="cal-card" aria-label="This week">
    <div class="cal-head"><span class="board-icon" aria-hidden="true">${Icon.calendar}</span><h2 class="cal-title">This week</h2>
      <button class="cal-icon-btn" data-action="nav" data-to="calendar" aria-label="Month view">${Icon.month}</button>
      <button class="cal-icon-btn" data-action="addCal" aria-label="Add to the calendar"><span class="add-icon" aria-hidden="true">${Icon.plus}</span></button></div>
    ${rows.length ? `<div class="cal-list">${rows.map(n => calRow(h, n, now)).join('')}</div>` : '<p class="cal-empty">Nothing planned this week.</p>'}
    ${later.length ? `<button class="cal-later" data-action="nav" data-to="calendar">${plural(later.length, 'more thing')} later</button>` : ''}
  </section>`;
}

/** Needs you: what the calendar brings today. */
function calendarCards(h) {
  const me = S.user.uid;
  const now = new Date();
  return Household.calDue(h, me).map(n => {
    const when = calWhen(n, now);
    const free = n.task && !Household.calOwner(n);
    const o = Household.calOwner(n);
    const about = Household.calAbout(n);
    if (n.away) {
      const both = n.for === 'any';
      const by = esc(partnerFirst(h));
      return `<div class="card cal-due away-card"><div class="row static col">
        <div class="row-text"><span class="cal-due-when">${esc(awayRange(n.day, n.until))}</span><span class="row-title one-line">${esc(n.text)}</span>
        <span class="row-sub">${both ? "You're both away. The home takes a break." : `${by} is away. The daily tasks come to you.`}</span></div>
        <div class="btns" style="margin-top:2px"><button class="btn secondary" data-action="calSeen" data-id="${esc(n.id)}">Got it</button></div>
      </div></div>`;
    }
    const whoLine = !n.task ? (about ? (about === me ? 'For you' : `For ${esc(Household.memberName(Household.member(h, about) || {}))}`) : '')
      : free ? 'Free to take. The first to tap gets it on their list.'
      : o === me ? "It's on your list on Me." : `${esc(Household.memberName(Household.member(h, o) || {}))} is doing it.`;
    return `<div class="card cal-due${n.task && n.day < Household.dayKey() ? ' overdue' : ''}"><div class="row static col">
        <div class="row-text"><span class="cal-due-when">${esc(when)}</span><span class="row-title">${esc(n.text)}</span>${whoLine ? `<span class="row-sub">${whoLine}</span>` : ''}</div>
        <div class="btns" style="margin-top:10px">${free
          ? `<button class="btn primary" data-action="claimCal" data-id="${esc(n.id)}">I'll do it</button>`
          : `<button class="btn secondary" data-action="calSeen" data-id="${esc(n.id)}">Got it</button>`}</div>
      </div></div>`;
  }).join('');
}

/** A board item on someone's Today list: tick it and it's gone. */
function noteTaskRow(h, n, ownerId, everyone) {
  const me = S.user.uid;
  const k = NOTE_KINDS[n.kind];
  const by = n.by === me ? 'your note' : `${esc(Household.memberName(Household.member(h, n.by) || {}))}'s note`;
  const who = everyone ? (ownerId === me ? 'You · ' : esc(Household.memberName(Household.member(h, ownerId) || {})) + ' · ') : '';
  const sub = n.kind === 'cal' ? `${who}${calWhen(n)}${n.day < Household.dayKey() ? '' : ''} · ${n.by === me ? 'you added it' : esc(Household.memberName(Household.member(h, n.by) || {})) + ' added it'}`
    : `${who}Today only · ${by}`;
  return `<button class="row" data-action="doneNote" data-id="${esc(n.id)}" aria-pressed="false">
    <span class="check" aria-hidden="true">${Icon.check}</span>
    <div class="row-text"><span class="row-title"><span class="title-icon" aria-hidden="true">${Icon[k ? k.icon : 'calendar']}</span>${esc(n.text)}</span><span class="row-sub">${sub}</span></div></button>`;
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
  if (Household.calDue(h, me).length) return true;
  if (Feedback.cardDue(h)) return true;
  if (newTasksCard(h)) return true;
  if (Household.isOwner(h, me) && Household.timeHints(h).length) return true;
  return !!statusBanner(h);
}

/** "Needs you" as one card at a time: each request is a slide, swiped sideways, with dots underneath.
 *  The builders return cards side by side; each top-level card becomes one slide. */
function needsCarousel(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  const slides = [...t.content.children].map(el => el.outerHTML);
  if (!slides.length) return '';
  const i = Math.min(S.needsIndex || 0, slides.length - 1);
  const many = slides.length > 1;
  return `<div class="needs${many ? '' : ' single'}"${many ? ' role="region" aria-roledescription="carousel" aria-label="Needs you"' : ''}>
      <div class="needs-track" tabindex="-1">${slides.map((x, k) => `<div class="needs-slide"${many ? ` role="group" aria-roledescription="slide" aria-label="${k + 1} of ${slides.length}"` : ''}>${x}</div>`).join('')}</div>
      ${many ? `<div class="needs-dots${slides.length > 5 ? ' windowed' : ''}"><div class="needs-dots-strip">${slides.map((_, k) => `<button class="needs-dot" data-action="needsGo" data-key="${k}" aria-label="Request ${k + 1} of ${slides.length}"${k === i ? ' aria-current="true"' : ''}></button>`).join('')}</div></div>` : ''}
    </div>`;
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
      <p class="joke">${name(rs.by)} would like a new plan. 🔀</p>
      <p class="plain">You both answer again, and the app makes a new plan. Done tasks stay done. Swaps are reset.</p>
      <div class="btns">
        <button class="btn primary" data-action="acceptReshuffle">Make a new plan</button>
        <button class="btn secondary" data-action="declineReshuffle">Keep our plan</button>
      </div></div>`;
  } else if (rs && rs.status === 'declined' && rs.by === me && !rs.seen) {
    html += `<div class="result-card" role="status"><p class="joke">They'd rather keep the current plan.</p>
      <p class="plain">Nothing changes. You can still swap single tasks.</p>
      <button class="btn secondary" style="min-height:44px" data-action="dismissReshuffle">OK</button></div>`;
  }
  const rsh = Household.activeReshare(h);
  const noun = rsh ? reshareNoun(h, rsh) : '';
  if (rsh && rsh.status === 'rating' && !(rsh.done || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">New ${noun}s to share</p>
      <p class="plain">Say how you feel about ${plural((rsh.unitIds || []).length, 'new ' + noun)}. It only takes a moment.</p>
      <button class="btn primary" data-action="nav" data-to="reshare">Answer for the new ${noun}s</button></div>`;
  } else if (rsh && rsh.status === 'proposed' && !(rsh.accepted || {})[me]) {
    html += `<div class="swap-card" role="status"><p class="joke">Here's who gets the new ${noun}s.</p>
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
      <button class="btn secondary" style="min-height:44px" data-action="dismissSwap" data-id="${esc(x.id)}">OK</button></div>`;
  });
  return html;
}


/* ---------- Shared pieces ---------- */
/** "kitchen", "bathroom", "vehicle" for a task timed per room; '' otherwise. */
function roomWord(r) { const lib = Library.get(r && r.libraryId); return lib && lib.perRoom ? (ROOM_WORD[lib.perRoom] || '') : ''; }
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
      <p>Then it continues for ${amount} a ${sub.interval || 'year'}. To keep it, you don't need to do anything.</p>
      <button class="btn secondary" data-action="openPortal">Manage subscription</button></div>`;
  }
  return '';
}


/* =========================================================
   SHEETS
   ========================================================= */
const Sheets = {
  /** Opening screen: partners join through the link they were sent. */
  inviteHelp() {
    Sheet.open(`<h2>Joining your partner?</h2>
      <p>Open the link your partner sent you. It brings you straight into your shared home.</p>
      <button class="btn primary" data-action="closeSheet">Got it</button>`, 'Joining your partner');
  },
  /** Right after subscribing: the next step is the invite (a tap, so the share sheet can open). */
  /** Setup: split a big task into parts, from the first list. Times come in the next step. */
  splitTask() {
    const sp = S.split;
    const r = sp && S.household.responsibilities.find(x => x.id === sp.respId);
    if (!r) return;
    const on = sp.parts.filter(p => p.on).length;
    Sheet.open(`<h2>Split ${esc(r.name)} into parts?</h2>
      <p class="sheet-line">Each part can go to a different person.</p>
      <div class="card">${sp.parts.map((p, i) => `<button class="row" data-action="splitToggle" data-key="${i}" aria-pressed="${p.on}">
          <span class="check" aria-hidden="true">${Icon.check}</span>
          <div class="row-text"><span class="row-title">${esc(p.name)}</span>${p.custom ? '<span class="row-sub">Your own</span>' : ''}</div></button>`).join('')}
        <div class="split-add"><label for="split-new" class="sr-only">Add a part</label>
          <input id="split-new" data-input="splitName" maxlength="60" placeholder="Add a part" value="${esc(sp.newName)}" autocomplete="off" enterkeyhint="done">
          <button class="mini" data-action="splitAddPart">Add</button></div></div>
      <button class="btn primary" data-action="splitSave" ${on < 2 ? 'disabled' : ''}>${on < 2 ? 'Pick at least two parts' : `Split into ${on} parts`}</button>
      <button class="btn ghost" data-action="${sp.was ? 'splitKeep' : 'closeSheet'}">${sp.was ? 'Put it back as one task' : 'Keep as one task'}</button>`, `Split ${r.name}`);
  },

  /** Tapping "Break into parts" before subscribing: what it is, and the way to get it. */
  partsNeedSubscription() {
    const trial = trialOffer();
    Sheet.open(`<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>
      <h2>Split tasks into parts</h2>
      <p>Split big tasks, like "Clean bathroom", into smaller parts. Each part has its own time, and the app shares them fairly. It comes with your subscription.</p>
      <button class="btn premium" data-action="sheetNav" data-to="subscribe">${trial ? `Start free for ${APP_CONFIG.billing.trialDays} days` : 'See prices'}</button>
      <button class="btn ghost" data-action="closeSheet">Not now</button>`, 'Split tasks into parts');
  },

  /** A task of your own. */
  customTask() {
    const d = S.customDraft || (S.customDraft = { name: '', category: 'organisation', frequency: 'weekly', minutes: 15 });
    const h = S.household;
    const suggesting = !Household.isOwner(h, S.user.uid);
    const org = esc(Household.memberName(Household.owner(h)).split(' ')[0]);
    const title = suggesting ? 'Suggest a task' : 'Add a task';
    Sheet.open(`<h2>${title}</h2>
      ${suggesting ? `<p>${org} decides. If ${org} agrees, you both say how you feel about it, then the app shares it fairly.</p>` : ''}
      <div class="field"><label for="ct-name">What needs doing?</label>
        <input id="ct-name" data-input="customName" maxlength="60" placeholder="e.g. Clean the aquarium" value="${esc(d.name)}" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><label for="ct-cat">Area</label>
        <select id="ct-cat" class="select" data-change="customCategory">${LIBRARY.categories.map(c => `<option value="${esc(c.id)}" ${c.id === d.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>How often, and how long?</label>
        <div class="timing-controls">
          <select class="select" data-change="customFrequency" aria-label="How often">${frequencyOptions(d.frequency)}</select>
          <select class="select minutes" data-change="customMinutes" aria-label="How long each time">${minuteOptions(d.minutes)}</select>
        </div></div>
      <button class="btn primary" data-action="saveCustomTask">${suggesting ? 'Send suggestion' : 'Add task'}</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, title);
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
      if (!suggesting && Household.canCover(h, id, me)) return `<button class="mini" data-action="coverTask" data-id="${esc(id)}">I did this</button>`;
      if (!suggesting && Household.coveredByMe(h, id, me)) return `<button class="mini" data-action="coverTask" data-id="${esc(id)}">Undo</button>`;
      if (free.has(id)) return `<button class="mini" data-action="claim" data-id="${esc(id)}">I'll take it</button>`;
      if (who !== me || !canSwap) return '';
      return Household.pendingFor(h, id) ? '<span class="tag">Offered</span>' : `<button class="mini" data-action="askSwap" data-id="${esc(id)}">Swap</button>`;
    };
    const facts = [esc(Timing.label(r))];
    if (Timing.of(r).rooms > 1 && roomWord(r)) facts.push(`${formatMinutes(Timing.of(r).each)} for each ${roomWord(r)}`);
    if (r.mentalLoad) facts.push('Planning');

    let owner = '', body = '';
    if (split) {
      body = `<h3 class="section-title" style="margin:0 0 8px">Parts</h3>
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
    const canBreak = (split || Library.parts(r.libraryId).length) && stage !== 'setup';
    // Every action is the same outlined tile, in one row across the sheet: no stack of long buttons.
    const act = (action, label, opts = {}) => `<button class="icon-action${opts.on ? ' on' : ''}${opts.danger ? ' danger' : ''}" data-action="${action}" data-id="${esc(r.id)}"${opts.on ? ' aria-pressed="true"' : ''}${opts.disabled ? ' disabled' : ''}>${label}</button>`;
    const actions = [];
    if (!split && planned && !suggesting && Household.canCover(h, r.id, me)) actions.push(act('coverTask', 'I did this'));
    else if (!split && planned && !suggesting && Household.coveredByMe(h, r.id, me)) actions.push(act('coverTask', 'Undo', { on: true }));
    else if (!split && planned && free.has(r.id)) actions.push(act('claim', 'I\'ll take it'));
    if (!split && planned && who === me && canSwap) {
      actions.push(Household.pendingFor(h, r.id) ? act('askSwap', 'Offered', { on: true, disabled: true }) : act('askSwap', 'Swap'));
    }
    if (canBreak) actions.push(act('openBreakdown', isOrg ? (split ? 'Parts' : 'Split task') : 'Split task?'));
    if (!isOrg && stage !== 'setup') {
      const asked = Household.suggestionFor(h, me, 'remove', r.id);
      actions.push(act('suggestRemoval', asked ? 'Suggested' : 'Remove?', { on: !!asked }));
    }
    if (isOrg && !r.predefined) actions.push(act('removeTask', 'Remove', { danger: true }));
    Sheet.open(`<h2>${esc(r.name)}</h2>
      ${owner}
      <p class="sheet-facts">${facts.join(' · ')}</p>
      ${body}
      ${actions.length ? `<div class="icon-actions" style="--n:${actions.length}">${actions.join('')}</div>` : ''}
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
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); Actions.saveName(); } });
  },

  /** Change the password (accounts that sign in with an email and password). */
  changePassword() {
    Sheet.open(`<h2>Change password</h2>
      <form class="card" data-form="password" autocomplete="on">
        <input type="email" name="username" autocomplete="username" value="${esc(S.user.email || '')}" hidden>
        <div class="field"><label for="pw-current">Current password</label>
          ${Password.wrap('<input id="pw-current" type="password" autocomplete="current-password" required>')}</div>
        <div class="field"><label for="pw-new">New password</label>
          ${Password.wrap(`<input id="pw-new" type="password" autocomplete="new-password" minlength="${APP_CONFIG.passwordRules.minLength}" required aria-describedby="pw-rules">`)}
          ${Password.checklist().replace('<ul ', '<ul id="pw-rules" ')}</div>
        <div class="field"><label for="pw-new2">Repeat new password</label>
          ${Password.wrap(`<input id="pw-new2" type="password" autocomplete="new-password" minlength="${APP_CONFIG.passwordRules.minLength}" required>`)}</div>
      </form>
      <button class="btn primary" data-action="savePassword">Save new password</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Change password');
  },

  /** Invite the partner: WhatsApp first, then the phone's share sheet, then the link to copy. */
  invite({ link, text, name, fresh }) {
    const canShare = typeof navigator.share === 'function';
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`;
    Sheet.open(`${fresh ? `<div class="premium-mark" aria-hidden="true">${Icon.spark}</div>` : ''}
      <h2>${fresh ? "You're in. " : ''}Invite ${esc(name)}</h2>
      <p>Send ${esc(name)} the link. They say how they feel about each task, and the app makes a fair plan from both your answers.</p>
      <a class="btn primary" href="${esc(wa)}" target="_blank" rel="noopener" data-invite-sent="whatsapp">${Icon.note} Send on WhatsApp</a>
      ${canShare ? `<button class="btn secondary" data-action="shareInvite">Share another way</button>` : ''}
      <button class="btn secondary" data-action="copyInvite">${Icon.copy} Copy the link</button>
      <p class="fine">The link works once and expires in ${APP_CONFIG.inviteValidDays} days.</p>
      <button class="btn ghost" data-action="closeSheet">Later</button>`, `Invite ${name}`);
  },

  /** Asking to start the whole split over. Not recommended, so it's worded honestly. */
  /** After a time change makes the split uneven. */
  timeRebalance() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>The plan is a little uneven now</h2>
      <p>With the new time, one of you has more to do each week. A new plan would make it fair again, using the same answers. ${others.join(' and ')} needs to agree first.</p>
      <button class="btn primary" data-action="requestReshuffle">Ask ${others.join(' and ')} for a new plan</button>
      <button class="btn ghost" data-action="closeSheet">Not now</button>`, 'New plan');
  },
  askReshuffle() {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    Sheet.open(`<h2>Make a new plan?</h2>
      <p>The app makes a new plan from the same answers. Done tasks stay done, swaps are reset, and you both agree again.</p>
      <p style="margin-top:-8px">Often a swap is enough. ${others.join(' and ')} needs to agree first.</p>
      <button class="btn secondary" data-action="requestReshuffle">Ask ${others.join(' and ')}</button>
      <button class="btn ghost" data-action="closeSheet">Keep my plan</button>`, 'New plan');
  },

  /** Add a note or a task for a date (and an optional time; a note can run over several days). */
  addCal() {
    const h = S.household;
    const me = S.user.uid;
    const today = Household.dayKey();
    const d = S.calDraft || (S.calDraft = { task: false, text: '', day: today, until: '', time: '', for: 'any' });
    const partner = Household.people(h).find(m => m.uid !== me);
    const pName = partner ? esc(Household.memberName(partner).split(' ')[0]) : '';
    const forOpts = d.away ? [[me, 'Me'], ['any', 'Both of us']]
      : [['any', d.task ? 'Anyone' : 'Both of us'], [me, 'Me'], ...(partner ? [[partner.uid, pName]] : [])];
    const kind = d.away ? 'away' : d.task ? 'task' : 'note';
    const label = d.away ? "What's the reason?" : d.task ? 'What needs doing?' : 'What is happening?';
    const example = d.away ? 'e.g. Work travel' : d.task ? 'e.g. Take the car to the garage' : "e.g. Doctor's appointment, business trip";
    const title = d.edit ? { note: 'Edit the note', task: 'Edit the task', away: 'Edit the absence' }[kind] : 'Add to the calendar';
    Sheet.open(`<h2>${title}</h2>
      ${d.edit ? '' : `<div class="chips" role="group" aria-label="Kind" style="margin-bottom:12px">${[['note', 'Note'], ['task', 'Task'], ...(Household.AWAY_ON ? [['away', 'Away']] : [])].map(([k, l]) =>
        `<button class="chip${k === 'away' ? ' away' : ''}" data-action="calKind" data-key="${k}" aria-pressed="${kind === k}">${l}</button>`).join('')}</div>`}
      <div class="field"><label for="cal-text">${label}</label>
        <input id="cal-text" data-input="calText" maxlength="${d.away ? Household.AWAY_MAX_LENGTH : Household.NOTE_MAX_LENGTH}" placeholder="${esc(example)}" value="${esc(d.text)}" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><label for="cal-when">When?</label>
        <button id="cal-when" class="range-field${d.away ? ' away' : ''}" data-action="pickOpen" aria-expanded="${!!d.pickOpen}">${esc(awayRange(d.day, d.away ? d.until : ''))}</button>
        ${d.pickOpen ? datePicker(d, today) : ''}</div>
      <div class="field"><label for="cal-time">Time</label>
        <div class="timing-controls"><span class="time-wrap minutes"><input id="cal-time" class="select${d.time ? '' : ' empty'}" type="time" value="${esc(d.time)}" data-change="calTime" aria-label="Time (optional)"><span class="time-ph" aria-hidden="true">--:--</span></span></div>
        <span class="field-hint">The time is optional.</span></div>
      <div class="field"><label>${d.away ? 'Who is away?' : d.task ? 'Who does it?' : 'Who is it for?'}</label>
        <div class="chips" role="group" aria-label="${d.task ? 'Who does it' : 'Who is it for'}">${forOpts.map(([k, l]) =>
          `<button class="chip" data-action="calFor" data-key="${esc(k)}" aria-pressed="${d.for === k}">${l}</button>`).join('')}</div></div>
      <button class="btn primary" data-action="postCal">${d.edit ? 'Save' : 'Add'}</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, title);
  },

  /** One calendar item: what, when, who, and what you can do with it. */
  calItem(n) {
    const h = S.household;
    const me = S.user.uid;
    const o = Household.calOwner(n);
    const by = n.by === me ? 'you' : esc(Household.memberName(Household.member(h, n.by) || {}));
    const today = Household.dayKey();
    const about = Household.calAbout(n);
    const name = uid => (uid === me ? 'you' : esc(Household.memberName(Household.member(h, uid) || {})));
    if (n.away) {
      const running = Household.calOn(n, today) && (n.for === 'any' || n.for === me);
      const who = n.for === 'any' ? 'Both of you' : n.for === me ? 'You' : name(n.for).replace(/^./, c => c.toUpperCase());
      Sheet.open(`<h2>${esc(n.text)}</h2>
        <p class="sheet-facts">${esc(awayRange(n.day, n.until))}${n.time ? ` · ${esc(n.time)}` : ''} · ${who} away · Added by ${by}</p>
        ${running ? `<button class="btn primary" data-action="endAway" data-id="${esc(n.id)}">I'm back</button>` : ''}
        ${Household.calCanEdit(h, me, n) ? `<button class="btn secondary" data-action="editCal" data-id="${esc(n.id)}">Edit</button>` : ''}
        ${Household.calCanRemove(h, me, n) ? `<button class="btn secondary" data-action="deleteCal" data-id="${esc(n.id)}">Remove</button>` : ''}
        <button class="btn ghost" data-action="closeSheet">Close</button>`, n.text);
      return;
    }
    const facts = [esc(calWhen(n)),
      n.task ? (n.doneAt ? `Done by ${name(n.doneBy)}` : o ? `For ${name(o)}` : 'For anyone') : about ? `For ${name(about)}` : 'For both of you',
      `Added by ${by}`];
    const actions = [];
    if (n.task && n.doneAt) { /* done: nothing to do but remove */ }
    else if (n.task && !o && n.day <= today) actions.push(`<button class="btn primary" data-action="claimCal" data-id="${esc(n.id)}">I'll do it</button>`);
    else if (n.task && o === me && n.day <= today) actions.push(`<button class="btn primary" data-action="doneNote" data-id="${esc(n.id)}">Done</button>`);
    Sheet.open(`<h2>${esc(n.text)}</h2>
      <p class="sheet-facts">${facts.join(' · ')}</p>
      ${actions.join('')}
      ${Household.calCanEdit(h, me, n) ? `<button class="btn secondary" data-action="editCal" data-id="${esc(n.id)}">Edit</button>` : ''}
      ${Household.calCanRemove(h, me, n) ? `<button class="btn secondary" data-action="deleteCal" data-id="${esc(n.id)}">Remove</button>` : ''}
      <button class="btn ghost" data-action="closeSheet">Close</button>`, n.text);
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
  },

  /** Settings → Send feedback: a short note that lands in the admin panel. */
  feedback() {
    const text = S.feedbackDraft || '';
    const types = [['broken', 'Broken'], ['confusing', 'Confusing'], ['idea', 'Idea']];
    Sheet.open(`<div class="sheet-intro"><h2>Send feedback</h2>
      <p>Tell us what works and what doesn't.</p></div>
      <div class="chips even" role="group" aria-label="What kind?">${types.map(([k, l]) =>
        `<button class="chip" data-action="feedbackType" data-key="${k}" aria-pressed="${S.feedbackType === k}">${l}</button>`).join('')}</div>
      <div class="field"><textarea id="feedback-text" data-input="feedbackText" maxlength="1000" rows="5" aria-label="Your feedback" placeholder="e.g. I couldn't find where to swap a task">${esc(text)}</textarea>
        <p class="field-note">Your name and this screen are sent with it.</p></div>
      <button class="btn primary" data-action="sendFeedback">Send</button>
      <button class="btn ghost" data-action="closeSheet">Cancel</button>`, 'Send feedback');
  },

  /** Offering one of my tasks to someone else. */
  askSwap(respId) {
    const h = S.household;
    const r = Household.unit(h, respId) || h.responsibilities.find(x => x.id === respId);
    if (!r) return;
    const others = h.members.filter(m => m.uid !== S.user.uid);
    const offer = m => `<button class="btn primary" data-action="sendSwap" data-id="${esc(respId)}" data-to="${esc(m.uid)}">Offer it to ${esc(Household.memberName(m))}</button>`;
    Sheet.open(`<h2>Hand over ${esc(r.name)}?</h2>
      <p>If ${others.length === 1 ? esc(Household.memberName(others[0])) : 'they'} take${others.length === 1 ? 's' : ''} it, they choose one of their tasks to give you in return.</p>
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
        `<button class="row" data-action="completeSwap" data-id="${esc(swap.id)}" data-key=""><div class="row-text"><span class="row-title">Give nothing back</span></div></button>`}</div>
      <button class="btn ghost" data-action="closeSheet">Back</button>`, 'Pick what to give back');
  },

  /** Delete the household. With a subscription still renewing, cancelling comes first (recommended). */
  confirmDelete(subRunning) {
    const others = S.household.members.filter(m => m.uid !== S.user.uid).map(m => esc(Household.memberName(m)));
    const sub = subRunning ? `<p style="margin-bottom:12px"><b style="color:var(--ink)">Your subscription keeps running</b> unless you cancel it. Deleting the household doesn't stop it.</p>` : '';
    Sheet.open(`<h2>This can't be undone</h2>
      <p style="margin-bottom:12px">Deleting the household removes its tasks, your plan, everything you've ticked off${others.length ? ` and ${others.join(' and ')}'s place in it` : ''}. It's deleted for everyone, forever.</p>
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
        <p>Your answers and notes are removed. Tasks you did stay in the history, without your name. You'd need a new invite from ${ownerName} to come back.</p>
        <button class="btn danger" data-action="leaveHousehold">Leave household</button>
        <button class="btn ghost" data-action="closeSheet">Stay</button>`, 'Leave household');
      return;
    }
    const partner = esc(Household.memberName(Household.member(h, Household.partnerId(h))));
    Sheet.open(`<h2>Leave the household?</h2>
      <p>${partner} will manage the household and keep the plan, tasks and history. Your answers and notes are removed.</p>
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
    else if (h && Household.isOwner(h, me)) household = `You leave the household and ${esc(Household.memberName(Household.member(h, Household.partnerId(h))))} will manage the household.`;
    else if (h) household = 'You leave the household; your answers and notes are removed.';
    Sheet.open(`<h2>Delete your account?</h2>
      <p style="margin-bottom:12px">This removes your name, email and sign-in. ${household} Payment records that tax law requires stay with Stripe.</p>
      <p><b style="color:var(--ink)">This can't be undone.</b></p>
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
