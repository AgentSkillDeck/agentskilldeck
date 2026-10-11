<!-- Adapted from Impeccable reference/craft.md, reference/craft-floor.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Craft

Use this guide when implementing or handing off any interface, new or changed. It is the quality floor every build must meet before anyone reviews it.

The floor holds the mechanics; it never chooses the direction. A pinned brief or the established visual language overrides the defaults here, but your own habits do not. Apply it while building rather than announcing it as a checklist, and treat each item as a check on the rendered result, not an intention.

## Type

Follow [typeset](typeset.md): body at 45–75ch, line height 1.5–1.6, display no larger than 6rem, tracking no tighter than −0.04em. Run the real copy at every width and fix what overflows. Same-role text looks the same everywhere.

## Colour

Follow [colorize](colorize.md) for contrast and roles. Body and placeholder text meet 4.5:1, large text and UI parts 3:1, in every state. Colour has jobs (primary action, selection, state, data); it is not scattered decoration. Secondary text on a coloured surface is tinted from that surface, never plain grey.

## Spacing and layout

Follow [layout](layout.md). Use one spacing scale: related items sit close, distinct groups get clear separation, and a heading has more space above it than below. Read computed values rather than trusting the stylesheet. Shadows, where used, have an offset and a soft blur.

## Interaction

- Every interactive element has hover, focus-visible, active and disabled states, plus loading where it triggers work.
- Focus is always visible and tab order follows reading order.
- Touch targets are at least 24×24 CSS px on web, and 44 px for primary touch controls (iOS 44 pt, Android 48 dp).
- Theme the browser parts you did not draw: focus rings, text selection, caret, scrollbars where styled, link underline offset, and tabular numerals in data.

## States, motion and media

- Design loading (a skeleton, not a spinner over content), empty, error and success states per [harden](harden.md).
- Motion follows [animate](animate.md): one authored moment rather than identical entrances everywhere, content visible by default, and reduced motion respected.
- Images have explicit dimensions or an aspect ratio so they do not shift the layout, responsive sources, and alt text that says what matters (empty alt for decoration).

## Semantics

Use the right element: buttons for actions, links for navigation, headings in order, lists for lists, tables for tabular data. Every input has a visible label. Controls name their action, and errors name the problem and the way to recover, per [clarify](clarify.md).

## Never add

These are absolute; no brief earns them back:

- Eyebrow or kicker labels above headings. The heading carries its own weight.
- Nested cards.
- Unicode glyphs or emoji standing in for real icons. Use one icon library or authored SVG, in one stroke and weight.
- Faked subject masks: a circle, polygon or gradient cutout pretending to follow a photo's edge. Use a real cut-out or none.
- Needless dialogs for tasks that need neither interruption nor protected focus.

## Avoid default-template tells

These are defaults, not bans; the brief's own words can justify one. Reaching for them when the choice is free means you were not deciding: grids of identical icon-heading-text cards as the page structure; a big number with a small label as the hero; section numbers that carry no information; gradient text; decorative glass and blur; thick coloured side borders on cards and alerts; hard offset shadows outside a deliberately brutalist look; monospace as a costume for "technical"; light or dark chosen by category instead of the use scene.

## Implementation hygiene

- Use design tokens instead of magic numbers; add a token only when a value is genuinely reused.
- No inline one-off styles; put styles where the project keeps them.
- Reuse the project's existing components before writing new ones, and keep one vocabulary for the same control across screens.
- Remove debug output, dead code and styles the change made obsolete.

## Verify

- Render at 375, 768 and 1440 px, plus 320 px and any width the user reported failing.
- Inspect real captures, opened and checked, not your memory of the code. Settle entrance motion before capturing.
- Run the project's tests, linters and type checks.
- Fix material problems in one batch and re-inspect; at most two inspection rounds, then report what is still open.

When the floor holds, review the result with [critique](critique.md) or [audit](audit.md).
