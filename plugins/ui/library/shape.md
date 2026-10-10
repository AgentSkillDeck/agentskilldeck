<!-- Adapted from Impeccable reference/shape.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Shape

Use this guide when the task is to decide what should be made and how it should work before building: it returns a confirmed design brief, never code.

## Before asking anything

Read what already exists so questions cover only real unknowns: the task, the target files and neighbouring screens, design notes (for example `DESIGN.md`), tokens, shared components and real content or data. Run the app and look at the surfaces this work joins. Assert what you can infer and invite correction instead of asking.

When real-world patterns would sharpen the discussion (how other products handle this flow or state), look them up: `node scripts/references.mjs "<query>" --platform web --limit 3` (use `ios` or `android` for native work), and follow [reference-policy](reference-policy.md) for how to use what comes back. Exit 2 is a service error, not an empty result: say so and continue without references.

## Phase 1: discovery interview

Do not write code or choose a visual direction yet.

### Cadence

- Use the host's structured question tool when it has one; otherwise ask in plain text and stop until the user answers.
- Ask two or three related questions per round, then wait. One round is the default; add a second only when the answers expose a material gap.
- Do not dump a questionnaire, repeat settled facts, or turn obvious facts into menus.
- A sparse prompt needs at least one answer round. A precise prompt may need only a compact confirmation.

### Round 1: purpose, people and outcome

Choose the two or three questions that most change the result:

- What is this surface or feature for, and what problem must it solve?
- Who specifically reaches it, in what situation and state of mind?
- What is the primary thing they must understand or do? What does success look like?
- What is uniquely true here that a neighbouring product or a generic template could not claim?

### Round 2: material, behaviour and boundaries

Run only for material unresolved decisions:

- What real content, evidence, data and assets must it carry? What are realistic minimum, typical and maximum ranges (for example 0, 12 and 2,000 rows; a 3-word and a 60-character name)?
- Which states and transitions matter: first run, empty, loading, error, success, permissions, overflow, expert use?
- What fidelity, breadth and interactivity are intended: exploration, a production-ready screen, a full flow, or a broader surface?
- What must remain untouched? What would make the result feel wrong even if it looked polished?
- Which platform, framework, performance, accessibility, localisation or delivery constraints are binding?

Never ask for CSS values or offer canned aesthetic styles. Visual-world and concept choices belong to [new-work](new-work.md).

## Phase 2: resolve the direction

- **New surface, brand expansion or replacement:** follow [new-work](new-work.md) through visual authority and concept choice, reusing this discovery. Return here before it implements anything.
- **Inside an established world:** keep the existing system. Use the concept step only when composition or interaction is still materially open.

## Phase 3: write the brief

Write the smallest useful brief:

1. **Job and audience:** who arrives, their context and need, and the surface type (persuasive, experiential, operational or reading).
2. **Outcome and proof:** the primary task or action, what success means, the real evidence and the product-specific truth.
3. **Selected direction:** visual authority, structural and interaction thesis, sequence, focal moment and what that means for implementation.
4. **Scope and boundaries:** fidelity, breadth, interactivity, the named target, what stays untouched, and explicit anti-goals.
5. **States and ranges:** realistic content and data ranges, and the states that matter.
6. **Interaction and layout:** hierarchy, topology, responsiveness, affordances, feedback and transitions; intent, not CSS.
7. **Constraints and open decisions:** platform, delivery, accessibility, localisation, reusable components, and choices a builder must not invent.
8. **Acceptance checks:** 3–6 observable statements a reviewer can pass or fail ("A first-time user finds Import within 5 seconds at 375px"; "The empty state names the next action"). [critique](critique.md) judges the build against these.

Use three to five bullets when the task is settled; use the full structure only for ambiguous, multi-screen or standalone planning. Do not restate the conversation.

## Confirm and stop

Present the brief for explicit confirmation or one round of corrections, then stop. Shape never writes code or a direction contract.

When no human or answer mechanism is available, mark every assumption plainly ("Assumed: ..."), return the brief and stop.

## Common failures

- Asking before reading the repo, so questions cover facts the code already answers.
- A ten-question questionnaire instead of two or three questions that change the result.
- Asking for colours, fonts or CSS values, or offering a menu of aesthetic styles.
- Writing code, mockups or a direction contract before the brief is confirmed.
- Inventing content, metrics or audience details to fill the brief.
- A brief with no states, ranges or acceptance checks, so nothing can be verified.
- Restating the conversation instead of deciding.
