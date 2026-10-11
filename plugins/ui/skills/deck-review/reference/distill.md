<!-- Adapted from Impeccable reference/distill.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Distill

Use this guide when an interface is cluttered and the user wants it simpler: too many actions, repeated information, competing emphasis or decoration that gets in the way.

Simplifying is not removing features. It removes what stands between the user and their goal. Lowering intensity without removing anything belongs to [quieter](quieter.md).

## Find the core

- Render the screen and name its one primary action. If two actions compete for that role, decide which serves the main job, or ask.
- Name the few subordinate actions that genuinely support it. Everything else is a candidate to demote, merge or remove.
- List the sources of clutter: competing buttons, information said twice, too many colours, sizes or weights, borders and backgrounds that do no work, everything shown at once.
- If the purpose or the users' priorities cannot be inferred from the code and brief, ask instead of guessing.

## Remove or demote

- Remove what does not serve the task: duplicated explanations, headers that restate the intro, decorative containers, marketing filler.
- Demote secondary actions to a quieter style, an overflow menu or a later step. Keep one clear primary action.
- Cut copy hard: shorter sentences, active voice, plain words, said once. See [clarify](clarify.md).

## Merge duplicates

- Merge controls that do the same thing in different places into one, in the place users look for it.
- Combine information that appears in several panels into one source.
- Reduce component variants to the few the screen actually needs.

## Disclose progressively

- Move advanced or rarely used options behind a clear entry point: an "Advanced" section, an expandable row, a settings page.
- Use smart defaults so common cases need no decision.
- Prefer inline disclosure to a dialog; never hide something the user needs for the next decision.

## Reduce visual noise

- Fewer colours: neutrals plus one or two with jobs. See [colorize](colorize.md).
- Fewer type sizes and weights, with clear steps between them. See [typeset](typeset.md).
- Drop borders, shadows and backgrounds that do not mark hierarchy or function; use spacing and alignment to group instead. Flatten nesting, and never nest cards.
- Keep hierarchy: the primary action and key content must still stand out. Even, flat sameness is not simplicity.

## Never remove

- Accessibility semantics: labels, accessible names, headings, landmarks, focus states.
- Error messages, validation and warnings.
- Recovery paths: undo, cancel, back, retry, and confirmation for destructive actions.
- Information users need to make a decision, or functionality the task depends on.
- Complexity the domain truly has; match the screen to the real task.

## Verify

- Complete the main task end to end on the simplified screen, by mouse and by keyboard.
- Compare before and after: list what was removed, merged or moved, and confirm each still-needed item is reachable.
- Force error, empty and loading states to confirm they survived. See [harden](harden.md).
- Check at 375, 768 and 1440 px, plus 320 px and any width the user reported failing.
- Fix material problems in one batch and re-inspect; at most two rounds, then report what is still open.
- Tell the user what was removed or hidden and where it now lives.

## Common failures

- Hiding a needed option so deep nobody finds it.
- Dropping error text or labels along with the clutter.
- Making every element the same weight, so nothing leads.
- Replacing visible controls with unlabelled icons.
- Moving clutter into a dialog instead of removing it.

When the simplified screen still completes the task, continue with [polish](polish.md).
