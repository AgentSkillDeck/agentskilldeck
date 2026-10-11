<!-- Adapted from Impeccable reference/onboard.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Onboard

Use this guide when designing or fixing first-run experiences: welcome and setup flows, first-use empty states, feature discovery, tours and in-product help.

Onboarding gets people to first value as fast as possible. Its job is not to teach the product; it is to reach the moment that proves the product is worth their time, then teach the rest in context.

Context you need: the first-value moment (the action that proves the product works for this user) and the users' experience level. Infer both from the brief, design notes (for example `DESIGN.md`), the product's core flow and any analytics events in the code before asking.

## Assess first

Read the signup, setup and first-run code, the empty states and any existing tour or tooltip logic. Run the app as a brand-new user (fresh account, cleared storage) with the host's browser or simulator tool, and record:

- **Steps to first value:** count screens, fields and decisions between landing and the first real result. Name each one.
- **Blockers:** anything that gates the product (mandatory tour, email verification before any use, long profile forms, paywall before value).
- **Drop-off points:** where analytics events, support tickets or the brief say people stop. If no data exists, say so; do not invent rates.
- **Users:** experience level (new to the category, switching from a competitor, power user), motivation (exploring, required by work) and time available.
- **Returning users:** what a second session, a second device and an invited teammate see.

Define success before designing: the one action that marks onboarding done (first project created, first invite sent, first import finished) and how the product will know it happened.

## Principles

- **Value first.** Front-load the 1–3 concepts needed for the first result. Everything else waits for contextual discovery.
- **Do, don't read.** Teach inside the real product with real controls, not in a separate tutorial mode.
- **Never block the product.** Every step is skippable or deferrable unless legally or technically required; "Skip" is visible, not hidden.
- **Ask for the minimum.** Collect only what the first result needs; ask for the rest when it becomes useful, and say why each field is asked.
- **Respect intelligence.** Do not explain standard patterns. One sentence beats a paragraph.
- **Never repeat.** Track completion and dismissals; never show the same onboarding twice.

## Apply

### Welcome and setup

- State what the product does for this user in one line, and how long setup takes when it is more than about a minute ("3 steps, about 2 minutes").
- Show progress for multi-step setup ("Step 2 of 3"). Default: at most 5 setup steps; aim for 3. More means the flow needs cutting.
- Use smart defaults and prefill from what you already know (name from SSO, timezone and locale from the device).
- Offer sign-in methods the audience uses (SSO for work tools); put social login above email when it is the common path.
- Ask permission (notifications, location, contacts) at the moment it delivers value, with a one-line reason, not on first launch. Design the denied path.

### First success

- Lead the user to a real result: a template, sample data or a prefilled first item that works immediately.
- Mark sample data clearly and make it removable in one action.
- Acknowledge completion proportionally (see [delight](delight.md)); then show the single next step.

### Empty states as onboarding

A first-use empty state answers, in this order:

1. What will appear here: "Your projects will appear here."
2. Why it matters, in one line, only if not obvious.
3. How to start: one primary action, optionally a template or import.
4. Optional help: a short guide or video link with its length ("2-min video").

```
No projects yet
Projects keep your team's files and tasks in one place.
[Create project]  [Start from a template]
```

Treat other empties differently: user cleared everything (light touch, easy recreate), no results (suggest a different query, clear filters), no permission (why and how to get access), failed to load (what happened, retry). Wording rules are in [clarify](clarify.md); the failure states are in [harden](harden.md). Use an illustration or icon only when it fits the visual world; search with `node scripts/materials.mjs icon "<query>" --limit 3` and check each result's `License:` line before use.

### Contextual hints and feature discovery

- Show a hint the first time the user reaches the feature, pointing at the real element, with one sentence of benefit.
- Every hint is dismissable, with a dismissal that sticks. At most one hint on screen at a time.
- Announce new features once, with a way to try them immediately; never in a blocking modal on launch.
- Unlock complexity gradually: show advanced options after the basic path has been used, or behind "More options".
- Mark new or unused features with a small badge or dot that clears once the feature is opened.
- Show keyboard shortcuts at the point of use (`⌘K` on the search field), and keep a full reference in help.
- Provide one persistent help entry point (a `?` button or help menu) that reaches searchable help, the shortcut reference and replayable tours.

### Tours

Use a tour only for complex workflows, a significant redesign, or domain-heavy tools. If you need one:

- 3–7 steps, focused on a workflow ("Create your first report"), not a feature inventory ("This is the sidebar").
- Interactive: the user performs each step on real controls with sample data so actions work.
- The rest of the UI stays usable; "Skip tour" is visible on every step; Escape closes it.
- Replayable from the help menu.

For a high-stakes or unfamiliar task, an interactive practice sandbox with sample data and a clear objective ("Build a chart of sales by region") beats a tour. Check that each step was actually done before moving on, and end with a clear graduation moment that hands over to the real workspace.

### Implementation

- Store onboarding progress and dismissals per user on the server when the product has accounts, so they follow the user across devices; use local storage only for anonymous or device-specific hints.
- Version the onboarding state so a redesigned flow can show once to existing users without replaying old steps.
- Tooltips and tour overlays: manage focus (move to the step, return to the trigger), trap focus only in modal steps, close on Escape, and announce step changes to screen readers.
- Use the project's existing popover or overlay components. Add a tour library only with the task's authority.
- Fire analytics events at each step, skip and completion if the project has analytics; do not add tracking it lacks.

## Verify

Answer each with rendered evidence from a fresh account; a bare "yes" is not verification:

- Count the steps from landing to first value again; the number is lower than before, or each remaining step has a stated reason.
- Every step can be skipped or deferred, and skipping still leads to a usable product.
- The first-use empty state names what will appear and offers one clear action.
- Dismissed hints stay dismissed after reload and on a second session.
- A returning user and an invited teammate do not see first-run onboarding again.
- Keyboard, screen-reader and 200% zoom paths complete the flow; non-modal tour steps do not trap focus.
- Long names and translated strings fit every onboarding surface.

Measure real outcomes only if the project has the data (completion rate, skip rate, time to first value, next-step action); do not report numbers you did not observe.

When new users reach first value fast, continue with [polish](polish.md).

## Common failures

- A mandatory multi-screen tour before the product is usable.
- Setup forms asking for data the first result does not need.
- A blank screen or "No data" where a first-use empty state should orient.
- A separate tutorial mode disconnected from the real product.
- Hints that reappear after dismissal or on every device.
- Permission prompts on first launch with no reason given.
- "Skip" hidden, greyed or placed where nobody looks.
- Returning users dropped back into first-run onboarding.
