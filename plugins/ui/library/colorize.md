<!-- Adapted from Impeccable reference/colorize.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Colorize

Use this guide when an interface needs colour to carry hierarchy, meaning or atmosphere: grey screens where state is hard to read, a palette with no roles, contrast failures, or a missing dark theme.

Preserve confirmed brand and semantic conventions. Do not replace a visual world under the label of "adding colour".

Context you need: the existing brand colours. Find them in tokens, theme files, logo assets or the brief before asking.

## Match the surface

- **Persuasive or experiential surfaces:** colour may carry the voice and own large regions when the chosen world calls for it.
- **Operational or reading surfaces:** colour mainly encodes action, selection, status, wayfinding and reading hierarchy. An accent keeps its force by being rare. See [operate](operate.md).
- **Native apps:** use the platform's semantic system colours where they exist; see [ios](ios.md) or [android](android.md).

## Audit before choosing

Read the design notes (for example `DESIGN.md`), token and theme files, assets, and representative states. Run the app and render them, in every theme, with the host's browser or simulator tool. Identify:

- which colours are confirmed brand commitments;
- current surface, text, action and semantic roles;
- places where greyscale hides hierarchy or state;
- contrast failures and colour-only communication;
- light/dark and data-visualisation requirements;
- whether the task asks for more colour or for a new identity.

Grep the styles for hex, `rgb(`, `hsl(` and `oklch(` literals outside the token files; each one is a role that escaped the system. If a new identity is required, use [new-work](new-work.md). Ask only when a binding brand decision cannot be inferred.

## Choose a strategy

Before editing, name the emotional temperature, the dominant colour relationship, the contrast range and the dosage (how much of the screen carries colour). The strategy may be restrained or immersive; it follows the brief and the chosen world, not a fixed percentage rule.

Pick light or dark from the use scene (who, where, under what ambient light), not from the product category.

Build roles, not a bag of swatches:

- canvas and elevated surfaces;
- primary and secondary text;
- action, focus and selection;
- borders and separators;
- success, warning, error and information;
- data categories or scales when needed.

Use the project's existing colour space. For a new web palette, prefer OKLCH: lightness and chroma adjust predictably. Choose hue from product meaning and visual direction, never from a default category association ("finance = blue", "health = green").

## Apply at system scale

- Let the strongest colour own a deliberate region or role instead of scattering small accents.
- Keep the primary action easy to find. Do not spend its colour on decoration.
- Tint neutrals only when the brand hue creates real cohesion (chroma around 0.005–0.02 in OKLCH). Plain neutral grey is valid when it serves the world.
- On coloured surfaces, derive secondary text from the surface or foreground hue. Never use a washed-out generic grey.
- Keep semantic meanings consistent; follow platform and domain conventions (for example red is not "loss" in every market) instead of assuming fixed hues.
- In data, separate categories by lightness, chroma, shape, label or pattern so colour is never the only code.
- Dark mode: design surface elevation explicitly (raised surfaces get lighter, not shadowed), lower accent chroma slightly, and re-check every pair. Never invert the light theme mechanically.
- With a token system, define primitives (`--blue-600`) and semantic tokens (`--color-action`). Theme changes remap semantic tokens; components use only semantic tokens.
- Theme the browser surfaces too: `::selection`, `caret-color`, `accent-color`, focus rings and scrollbars take palette values (see [craft](craft.md)).

Decoration with no relationship to hierarchy, state, content or the visual world is not a colour strategy.

## Contrast and perception

Measure computed foreground/background pairs. Do not rely on eyesight. Use the host browser tool's accessibility or contrast inspection, or read the computed `color` and `background-color` and compute the WCAG ratio.

| Content | WCAG AA minimum |
|---|---|
| body and placeholder text | 4.5:1 |
| large text (≥24px, or ≥18.66px bold) | 3:1 |
| controls, icons, focus indicators | 3:1 |

- Check hover, active, focus, selected, disabled, overlays, text on images, and both themes.
- Disabled and inactive controls are exempt from these minimums (WCAG 1.4.3 and 1.4.11), but must stay clearly distinguishable from enabled ones.
- Simulate common vision deficiencies (protanopia, deuteranopia, tritanopia) with the browser tool's rendering emulation where available.
- Anything colour conveys must also be conveyed by text, shape, icon or position.
- For OKLCH ramps, vary lightness and reduce chroma near white and black. Do not keep high chroma at extreme lightness to make the maths uniform.
- Prefer explicit colours to chains of translucent overlays; stacked alpha makes contrast depend on what sits underneath.

## Verify

Answer each with rendered or source evidence:

- Every colour has a stable role or a stated atmospheric purpose in this world.
- Attention lands on the intended action, content or state (squint at the render).
- The palette holds in quiet, dense, interactive, error and empty states.
- Light and dark themes are each composed, not inverted.
- Contrast ratios and non-colour cues pass in every relevant state; list the measured lowest pair.
- No raw colour literals remain outside the token files without a reason.
- The result is recognisably this product, not a generic "colourful" treatment: swap in a neighbouring product's logo and the palette would no longer fit, and every hue traces to a brand token or a stated role.

When the palette earns its place, continue with [polish](polish.md).

## Common failures

- Small accents sprinkled everywhere so no colour leads and the primary action gets lost.
- Generic grey secondary text on a coloured surface.
- Status shown by colour alone (a red dot, a green row) with no text or icon.
- A dark theme made by inverting the light one, with flat surfaces and over-saturated accents.
- Hue picked by category cliché instead of product meaning.
- Gradient text for emphasis, or zero-offset coloured glows standing in for depth.
- Colour literals hard-coded in components, bypassing the semantic tokens.
