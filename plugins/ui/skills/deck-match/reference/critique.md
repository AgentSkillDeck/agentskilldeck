<!-- Adapted from Impeccable reference/critique.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Critique

Use this guide when asked to review, critique or judge a built interface (a screen, flow or whole surface) against its brief before anyone changes it.

A critique is evidence-backed judgment, not a redesign. It stays read-only unless the user asked for fixes: do not edit project files, and stop any server or simulator you started once you have finished (unless the user asks to keep it).

## Set up

1. **Resolve the target** to concrete files and a way to render them: "the homepage" means the page component plus the running route; "the settings dialog" means its component and the state that opens it. Prefer source paths over dev-server URLs, which drift.
2. **Find the brief.** Read the task, the brief (from [shape](shape.md) when one exists), design notes (for example `DESIGN.md`), tokens and existing conventions. If no brief exists, write a one-line assumed job ("Lets a returning customer reorder in under a minute") and label it assumed. You judge pass/fail against that brief.
3. **Honour settled decisions.** Drop findings that the brief or design notes explicitly accept; say so once.
4. **Classify the surface:** persuasive, experiential, operational or reading. It decides which heuristics apply and which personas to use.

## Two passes, in order

Run the design review first and write its notes down before collecting mechanical evidence, so the numbers do not anchor your judgment. Then reconcile the two.

### Pass A: design review

Render the target with the host's browser or simulator tool at the sizes it ships to (default about 375px, 768px and 1440px wide for web; one phone and one tablet for native). Exercise the primary task end to end. Read the source for states you cannot reach. Judge:

- **Design specificity:** is the composition, interaction and visual language grounded in this product, or could an unrelated product ship it unchanged? Decide this before Pass B.
- **Holistic design:** hierarchy, information architecture, emotional fit, discoverability, composition, typography, colour, accessibility, states, copy and edge cases.
- **Cognitive load:** run the checklist below; record every decision point with more than 4 visible options.
- **Emotional journey:** where the peak and the end of the flow land (people remember those most), emotional valleys (waiting, errors, dead ends), and whether high-stakes moments (payment, deletion, sharing data) reassure.
- **Heuristics:** score all ten (below).

### Pass B: mechanical evidence

- Capture each required state: default, hover/focus, loading, empty, error, success, long content, 200% zoom or large text, dark theme, reduced motion.
- Tab through the primary flow; note focus visibility and order versus visual order.
- Measure contrast for body text, labels, placeholders and focus rings (4.5:1 normal text, 3:1 large text and UI parts).
- Grep the source for literal colours, off-scale spacing and type values, `outline: none`, missing `alt`/labels, and fixed heights on text containers.
- Run the project's tests and linters if they cover the target; record what passed and what was not covered.
- For native targets, follow the verification steps in [ios](ios.md) or [android](android.md). For a full technical pass, run [audit](audit.md).

Reconcile: note where the passes agree, what Pass B caught that Pass A missed, and which mechanical hits are false positives, and why.

## Spot template output

[craft](craft.md) prevents these while building; here you check the finished result for them.

Generated interfaces drift toward the same few moves: a centred gradient hero, a row of three identical feature cards, glassy panels over a purple wash, placeholder metrics, one radius and one shadow on everything, and every section arriving with the same entrance. None is wrong in itself. Flag one when it tells the user nothing about this product or works against its direction. Craft's "Never add" list is absolute: flag every eyebrow or kicker label, nested card, glyph icon, faked subject mask and needless dialog.

Judge what a person can learn and do on this screen, not merely that the build runs without bugs. Hold the render against the brief and any reference the user supplied, and recommend changes that improve the task, never effects added for their own sake.

## Heuristic scores

Score each of Nielsen's ten heuristics 0–4: **0** absent or hostile, **1** rare or mostly broken, **2** partial with major gaps, **3** good with minor gaps, **4** genuinely excellent. Most real interfaces total 20–32 of 40. A 4 needs evidence, not the absence of complaints.

1. **Visibility of system status:** loading indicators, confirmation of save/submit/delete, progress in multi-step flows, current location (active nav, breadcrumbs), inline validation. 0 = user guesses what happened; 4 = every action confirms and progress is always visible.
2. **Match with the real world:** user vocabulary, no unexplained jargon, logical order, recognisable icons and metaphors. 0 = system jargon throughout; 4 = fluent in the user's language.
3. **User control and freedom:** undo, cancel on forms and dialogs, a way back to safety, clearing filters and selections, an exit from long flows. 0 = users get trapped; 4 = undo, cancel, back and escape everywhere.
4. **Consistency and standards:** same words, same results, platform conventions, consistent colour, type, spacing and components. 0 = feels like several products stitched together; 4 = a predictable system.
5. **Error prevention:** confirmation before destructive actions, constrained inputs, smart defaults, clear labels, autosave and draft recovery. 0 = no guardrails; 4 = errors are nearly impossible to make.
6. **Recognition over recall:** visible options, contextual hints, recent items, autocomplete, text labels on icons. 0 = users must memorise paths; 4 = everything is discoverable.
7. **Flexibility and efficiency:** keyboard shortcuts, bulk actions, recents and favourites, accelerators that stay invisible to novices. 0 = one rigid path; 4 = several paths and power features without cluttering the basics.
8. **Aesthetic and minimalist design:** only what the step needs, clear hierarchy, purposeful colour and emphasis, no decorative clutter. 0 = everything competes equally; 4 = every element earns its place.
9. **Error recognition and recovery:** plain-language messages, the specific problem ("Email is missing @", not "Invalid input"), a recovery action, placement next to the source, user input preserved. 0 = codes or silence; 4 = pinpoints the issue, offers the fix, keeps the work.
10. **Help and documentation:** contextual help at decision points, task-focused and scannable, reachable without losing context. 0 = no help anywhere; 4 = the right information at the right moment.

**Not applicable:** on persuasive and experiential surfaces (landing pages, campaigns, portfolios), heuristics 7 and 10, or any heuristic that genuinely cannot apply, may be scored `n/a` with a one-line reason. The maximum becomes 4 × the number scored; never print /40 over a partial set.

**Bands by percentage of the applicable maximum:** 90%+ Excellent (polish only), 70%+ Good (fix weak areas), 50%+ Acceptable (significant work before users are happy), 30%+ Poor (core experience broken), below 30% Critical (redesign). 24/32 = 75% = Good.

## Cognitive load

Three kinds: intrinsic (the task itself; structure it with steps, defaults and progressive disclosure), extraneous (caused by design; remove it) and germane (learning that leads to mastery; support it with consistent patterns and feedback).

Checklist; count the failures:

- **Single focus:** the primary task is free of competing elements.
- **Chunking:** information sits in groups of 4 items or fewer.
- **Grouping:** related items are visibly together.
- **Hierarchy:** the most important thing is obvious at a glance.
- **One thing at a time:** one decision before the next.
- **Minimal choices:** 4 or fewer visible options at each decision point.
- **Working memory:** nothing must be remembered from a previous screen.
- **Progressive disclosure:** complexity appears only when needed.

0–1 failures = low load; 2–3 = moderate (fix soon); 4+ = high (critical).

Working memory holds about 4 items. At each decision point, count the simultaneous options: 4 or fewer is fine, 5–7 needs grouping or disclosure, 8+ is overloaded. Defaults: 1 primary action with 1–2 secondary and the rest in a menu; 5 or fewer top-level nav items; 4 or fewer sibling choices per docs-sidebar level; one reading path in articles with related links gathered at the end; one decision per screen in gallery indexes.

Name violations by pattern: wall of options, memory bridge (step 3 needs step 1's information), hidden navigation (no current location), jargon barrier, visual noise floor (everything the same weight), inconsistent pattern, multi-task demand, context switch (jumping between screens for one decision).

## Personas

Pick 2–3 by surface and walk the primary task as each. Report what broke for them, naming the exact elements; never write generic persona descriptions.

- **Power user (Alex):** skips onboarding, wants shortcuts and bulk actions. Can the core task be done in under 60 seconds? Does Esc close dialogs? Red flags: unskippable tours, no keyboard path, slow unskippable animation, one-at-a-time work where a batch is natural, confirmations on low-risk actions.
- **First-timer (Jordan):** reads literally, hesitates, looks for help. Is the first action clear within 5 seconds? Red flags: icon-only navigation, unexplained jargon, no visible help, an ambiguous next step, no confirmation of success.
- **Accessibility-dependent (Sam):** screen reader, keyboard only, up to 200% zoom. Red flags: click-only interactions, invisible focus, meaning carried by colour alone, unlabelled fields or buttons, time limits without extension, custom widgets that break reading order, state changes the screen reader does not announce.
- **Stress tester (Riley):** pushes the edges (0 and 1,000 items, very long strings, emoji, RTL text, a refresh mid-flow, two tabs). Red flags: silent failure, technical errors or a broken UI after an error, "No results" with no guidance, data lost on refresh or navigation.
- **Distracted mobile user (Casey):** one thumb, interrupted, slow network. Red flags: key actions at the top of the screen, progress lost on app switch, typing where selection would work, heavy assets on every load, targets under 44×44pt / 48×48dp or packed together.

| Surface | Personas |
|---|---|
| Landing / marketing | Jordan, Riley, Casey |
| Dashboard / admin, data-heavy | Alex, Sam |
| Checkout / e-commerce | Casey, Riley, Jordan |
| Onboarding | Jordan, Casey |
| Forms / wizards | Jordan, Sam, Casey |

Add 1–2 project-specific personas only when the brief or design notes describe a real audience; never invent audience details.

## Severity

Tag every finding P0 (blocking), P1 (major), P2 (minor) or P3 (polish) on the scale and tie-breaker defined in [audit](audit.md). Confusion that causes significant difficulty is P1.

## Report

Write the whole report first; questions come last. Sections, in order:

1. **Verdict:** `Pass` or `Fail` against the brief (or the labelled assumed job), with a one-line reason. Fail on any P0, any P1 that breaks an explicit brief requirement, or a brief-required check that you could not run. An unavailable browser, simulator or service is never a pass. Add one line naming the single biggest opportunity.
2. **Method:** what you rendered (sizes, devices, themes), which flows you exercised, what you grepped and which tests ran.
3. **Design specificity:** your Pass A verdict, the habitual patterns found (with whether each earns its place) and missed chances for product character.
4. **Heuristic table:** `# | Heuristic | Score | Key issue`, the total over the applicable maximum, and the band.
5. **Findings, ordered by user impact** (severity first, then how many users and how often). Each finding carries:
   - **[P0–P3] What:** the specific element ("the Save button in the billing drawer", not "some buttons").
   - **Screen / state:** where and when it occurs (route, viewport, theme, data condition).
   - **Evidence:** what you observed and how (screenshot at 375px, tab order, measured 3.1:1 contrast, `src/Card.tsx:42`).
   - **Why it matters:** the effect on users or on the brief.
   - **Smallest fix:** one concrete change, plus the guide that applies it.
6. **What's working:** 2–3 specific strengths and why they work, so fixes keep them.
7. **Cognitive load:** the failure count and overloaded decision points.
8. **Persona red flags:** per persona, what broke.
9. **Minor observations:** short P3 notes.
10. **Could not verify:** every check you could not run (state unreachable, no device, no real data, tests absent), with the reason and what would verify it. Never fold these into the findings as passes.
11. **Questions:** 2–4 targeted questions, each with 2–3 concrete options tied to the findings: which problem area to tackle first, whether a tonal mismatch is intentional, the scope (top 3, all, P0–P1 only), and anything off-limits. With fewer than 3 findings you may skip them; write `Questions skipped: fewer than 3 findings`.

Write directly: what is wrong, why it matters, what to do. If everything is important, nothing is.

## After the user answers

List the actions in the user's priority order, then by impact. Map each finding to one guide: [typeset](typeset.md), [colorize](colorize.md), [layout](layout.md), [animate](animate.md), [clarify](clarify.md), [harden](harden.md), [adapt](adapt.md), [optimize](optimize.md), [distill](distill.md), [quieter](quieter.md), [bolder](bolder.md), [onboard](onboard.md), [delight](delight.md), [audit](audit.md). Skip guides that address no finding, respect the scope and off-limits answers, and end with [polish](polish.md) when any fix is planned. After fixes, re-run this critique on the same target and sizes to compare scores.

## Common failures

- Findings with no screen, state or evidence ("spacing feels off").
- Mechanical grep results reported as the critique, with no judgment of hierarchy or specificity.
- A clean screenshot at one width treated as a pass for every size and state.
- Unverified checks silently dropped or reported as passing.
- Fixes that rebuild the design when a one-line change resolves the finding.
- Every heuristic scored 3–4 by default, or /40 printed over a partial set.
- Editing files during a read-only critique.
- Ending on the report with no questions and no skip line.
