<!-- Adapted from Impeccable reference/distill.md @ d631a88 (Apache-2.0) and uizze ui-design reference/distill.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Simplify an interface

Use this guide when an interface feels cluttered, busy or hard to use and the user wants it simpler.

Remove obstacles between the user and the main task without removing necessary capability. Simplicity means fewer obstacles, not fewer features.

## Find the excess

- Write down the one primary goal and the information required to complete it. If the goal is unclear from the code and brief, ask; do not guess.
- List what competes with it: repeated copy, duplicate actions, decorative noise (borders, shadows, backgrounds that do not show grouping), and containers that do not clarify grouping.
- Count the variation: colours, type sizes, weights, button styles, spacing values, surface treatments. Each one without a job is a cut.
- Sort every element into essential, needed sometimes, or removable.

## Simplify

- **One obvious primary action** and a small number of clearly subordinate actions; everything else tertiary or behind disclosure.
- **Progressive disclosure** for advanced or infrequent controls (an "Advanced" section, a details row, a step), but keep essential information and decision-making facts visible.
- **Reduce variation** as a default target (project tokens override): 1–2 colours plus neutrals, one font family, 3–4 sizes, 2–3 weights, one spacing scale with no arbitrary gaps.
- **Flatten structure:** prefer spacing and alignment over cards; never nest a card inside a card.
- **Fewer steps:** smart defaults for common choices, inline editing instead of modal flows where possible, merge similar buttons and forms.
- **Copy:** prefer plain language over explanatory copy. Say it once (no heading restating the intro), active voice ("Save changes"), no jargon, marketing filler or hedging.
- **Code:** remove the CSS, components and variants the cuts orphaned.

## Preserve clarity

- Do not hide required actions behind mystery interactions (unlabelled icons, hover-only controls, hidden gestures).
- Do not remove labels, focus states, accessibility semantics, error messages or recovery paths.
- Do not flatten genuinely complex information until it becomes harder to understand; match the complexity of the interface to the complexity of the task.
- Keep hierarchy: some things must still stand out.

## Verify

Verify that the simplified result still supports the complete task, including its important states (loading, empty, error, success), at the relevant screen sizes. Render it with the host's browser or simulator and check: fewer steps or decisions to finish the task, every necessary feature still reachable, and an obvious most-important element. Tell the user what you removed or moved and where it now lives. Hand off to [polish](polish.md) for the final pass.

## Common failures

- Deleting a feature users need and calling it simplification.
- Icon-only buttons with no labels or accessible names.
- Hiding the information users need to decide.
- Every element flattened to equal weight.
- Replacing cards with a different decorative container.
