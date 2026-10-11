<!-- Adapted from Impeccable reference/polish.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Polish

Use this guide when refining or finishing something that already works: tightening spacing, fixing inconsistencies and bringing every part of the path up to the same standard.

## Read the context

- Read the design notes (for example `DESIGN.md`) if present, then tokens, shared components and neighbouring screens. Without formal notes, follow the project's coherent conventions.
- Use the feature yourself first. Confirm the path works, find out the expected quality bar and time available, and note anything deliberately unfinished.
- If a recent critique exists, use its major findings as one input, alongside your own pass.

## Keep the scope

Polish refines; it does not redesign. Keep the visual language, content and behaviour, and do not touch parts that are fine as they are unless the user asks. If the concept itself is wrong, say so and recommend a redesign through [new-work](new-work.md) or a stronger direction through [bolder](bolder.md) rather than slipping one in.

For each inconsistency, find the cause before fixing it: a missing token, a one-off that a shared component should replace, a flow that differs from similar screens, or a plain local defect. Fix it at the narrowest correct level.

## Order of work

1. Broken or blocked tasks, misleading states and inaccessible paths.
2. Missing loading, empty, error, success and disabled states.
3. Hierarchy, responsive and design-system drift.
4. Visual and motion inconsistencies.
5. Code and asset cleanup.

Bring the whole path to one standard rather than perfecting a single corner.

## The pass

- **Alignment and spacing rhythm:** snap to the grid and spacing scale; fix optical alignment of icons and text, not only the numbers. Related items sit close, groups separate clearly. See [layout](layout.md).
- **Type consistency:** same role, same size, weight and line height everywhere. Check wrapping, long translations and zoom. See [typeset](typeset.md).
- **Colour and contrast:** semantic tokens, stable meanings across themes, text and focus contrast checked in every state. See [colorize](colorize.md).
- **Interaction states:** default, hover, focus-visible, active, disabled, loading, error and success on every control; visible focus and a logical tab order.
- **Transitions:** consistent durations and easing, interruptible, no animation added just to show effort. See [animate](animate.md).
- **Copy consistency:** one term per concept, consistent capitalisation and punctuation, buttons that name their action. Ask before changing claims. See [clarify](clarify.md).
- **Edge states:** long, missing, localised, slow, offline and permission-limited content. See [harden](harden.md).
- **Responsive:** check 375, 768 and 1440 px, plus 320 px and any width the user reported failing; fix every width, not only the current screenshot.
- **Performance smells:** layout shift from unsized images, oversized assets, slow interactions, console errors. See [optimize](optimize.md).
- **Icons and images:** one icon family at consistent size and stroke; correct aspect ratios and useful alt text.

## Check against the floor

Confirm the result meets [craft](craft.md), including its "Never add" list. Polish is a good moment to catch an eyebrow label, a nested card or a needless dialog that slipped in.

## Verify

- Render before and after at the same widths and compare them side by side; the change should be visible where intended and nowhere else.
- Walk the path again with mouse, keyboard and touch where it applies.
- Fix material problems in one batch and re-inspect; at most two inspection rounds, then report what is still open.
- Review the diff: remove accidental churn, unused code, duplicated values and temporary files.
- Report what was checked, at which widths and with which tool.

## Common failures

- A redesign presented as polish.
- Restyling an area that worked and was out of scope.
- Fixing the visible screenshot while other widths still break.
- New one-off values instead of existing tokens.
- Removing focus or pressed states while tidying styles.

When the pass is complete, return to the task, or ask [critique](critique.md) for a final check.
