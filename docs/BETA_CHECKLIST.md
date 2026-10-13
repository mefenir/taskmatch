# Beta checklist

Invites go out Friday 16 October 2026. Last changes and the full security check are on Thursday night, 15 October.

## Thursday night, 15 October
- [ ] Publish the latest `firestore.rules` in Firebase (config/beta, viaInvite, homeDone/timesDone, auto-grant, tick writes)
- [ ] Full security check: rules, auth flows, XSS, invite codes, admin access. Close every gap
- [ ] Save ticks per task instead of the whole completions list, so two people ticking at the same moment never overwrite each other (app code and rules)
- [ ] Fine-tune the app for beta
- [ ] Rules now also allow: admins deleting statistics (metrics) and config/stats for Reset statistics
- [ ] Include the partner's task suggestions (v55) in the security check
- [ ] Turn automatic approval on or off, as decided
- [ ] Open the live app on a phone as organiser and as partner: sign up, invite, join, rate, split, tick
- [ ] Have legal.html checked by a lawyer before charging anyone (the page no longer says it's a template)

## First after beta: Away (agreed 13 Oct)
- [ ] **Where:** third choice in "Add to this day": Note · Task · **Away**. Away is purple, in the same tone as the green (button when selected and on the calendar).
- [ ] **Fields:** Who (Me · partner · Both of us), When, time, and a word about it, which is **required** (e.g. "Work travel"), because it's what the calendar shows.
- [ ] **Period:** picked inside the calendar with taps. The first tap is the start (the day you came from), the second is the end, the days between are tinted, tapping the start again = one day, a third tap starts over. Shown in the When field as "DD Month YYYY – DD Month YYYY".
- [ ] **Month view:** away days are a soft purple band; the dots for notes and tasks stay on top.
- [ ] **Either partner can add it**, for themselves, the other or both. The other partner gets a "needs you" card.
- [ ] **One away:** daily tasks move to the partner at home **automatically**. They show in the partner's own task list (never on the board) like Today only, with a small "for Ian" label: tick → gone, back the next day until the period ends. Weekly and anytime tasks stay with the traveller and wait (the partner can still take one). Pets and children always move.
- [ ] **Both away:** everything pauses; repeating tasks start again from the day you're back, so nothing is overdue.
- [ ] **Back home:** one calm line, e.g. "Marta covered the dishes and the cat while you were away." No numbers. The shown split leaves out away days.

## Future updates (decide with the beta feedback)
Go through what testers send (Settings → Send feedback, the day-7 survey, the day-21 conversations) and add it here before choosing what's next.
- [ ] Weekly time limits: each person can say how much time they have; when the home needs more than that, offer lighter rhythms (e.g. weekly → every two weeks) and short time-saving tips; the split respects a person's limit and shows it openly. Ask in the day-7 survey: "Was there more on your list than you have time for?"
- [ ] Extra living rooms: add time to General tidying and Clean floors (e.g. +30% each), if testers ask for it

## Later
- [ ] Swipe on Us tasks (right: Swap, left: Remove or Remove?), after the beta if the data supports it. Swipe uncovers the action, a tap confirms
- [ ] Restyle the app with the final branding and visuals
- [ ] Admin page: page the user and metrics lists if the beta grows to thousands

## Beta dates
- Day 0: Fri 16 Oct, invites
- Day 7: survey open Fri 23 to Sun 25 Oct
- Day 21: conversation booked Fri 6 to Sun 8 Nov
