# Beta checklist

Invites go out Friday 16 October 2026. Last changes and the full security check are on Thursday night, 15 October.

## Thursday night, 15 October
- [ ] Publish the latest `firestore.rules` in Firebase (config/beta, viaInvite, homeDone/timesDone, auto-grant, tick writes)
- [ ] Full security check: rules, auth flows, XSS, invite codes, admin access. Close every gap
- [ ] Save ticks per task instead of the whole completions list, so two people ticking at the same moment never overwrite each other (app code and rules)
- [ ] Fine-tune the app for beta
- [ ] Include the partner's task suggestions (v55) in the security check
- [ ] Turn automatic approval on or off, as decided
- [ ] Open the live app on a phone as organiser and as partner: sign up, invite, join, rate, split, tick

## Later
- [ ] Swipe on Us tasks (right: Swap, left: Remove or Remove?), after the beta if the data supports it. Swipe uncovers the action, a tap confirms
- [ ] Restyle the app with the final branding and visuals
- [ ] Admin page: page the user and metrics lists if the beta grows to thousands

## Beta dates
- Day 0: Fri 16 Oct, invites
- Day 7: survey open Fri 23 to Sun 25 Oct
- Day 21: conversation booked Fri 6 to Sun 8 Nov
