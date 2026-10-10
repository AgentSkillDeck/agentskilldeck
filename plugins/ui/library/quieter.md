<!-- Adapted from Impeccable reference/quieter.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Quieter

Use this guide when a design is too loud, aggressive or overstimulating and the task asks to calm it down without losing personality or turning generic.

Quiet design is harder than bold design: subtlety needs precision. "Quieter" means refined and easier on the eyes, not boring. Quiet without intent collapses to generic.

## Match the surface

- **Persuasive or experiential surfaces:** a more restrained palette, more whitespace, more typographic air. Drama is reduced, not eliminated; the point of view stays intact.
- **Operational or reading surfaces:** less visual noise. Fewer background accents, flatter cards, less colour, less motion. The tool disappears further into the task. See [operate](operate.md).

Removing whole elements, sections or features belongs to [distill](distill.md); this guide lowers intensity.

## Assess the intensity

Render the target with the host's browser or simulator tool at the sizes it ships to. Name the sources of intensity, with evidence:

- **Colour saturation:** overly bright or saturated colours, too many hues.
- **Contrast extremes:** high-contrast juxtapositions everywhere, not only where they matter.
- **Visual weight:** many bold, heavy elements competing.
- **Motion excess:** too much movement or dramatic effects.
- **Complexity:** too many decorations, patterns, gradients, glows or layered shadows.
- **Scale:** everything large and loud, with no hierarchy.

Then count them in the source: distinct colour literals and tokens in use, `box-shadow`/`filter`/`backdrop-filter` declarations, gradients, font weights above 600, and animations or transitions. The counts tell you where the noise lives.

Understand the context before cutting: what the surface is for, who uses it (some contexts need energy), what already works, and the core message to preserve. If these are unclear from the code and brief, ask; do not guess.

## Plan the refinement

Decide before editing:

- **Colour:** desaturate or shift to more restrained tones?
- **Hierarchy:** which few elements stay bold, and which recede?
- **Simplification:** what decoration can go entirely?
- **Restraint as quality:** how will precision (spacing, alignment, type) signal care once the noise is gone?

## Refine

### Colour

- Reduce saturation from full to about 70–85%. Project tokens override this default.
- Use fewer colours more deliberately; let neutrals do most of the work and keep colour as an accent on roughly 10% of the surface.
- Keep high contrast only where it matters most (primary action, key figures, critical states).
- Use warm or cool tinted greys instead of pure grey; they add depth without loudness. See [colorize](colorize.md).
- Never put grey text on a coloured background; use a darker shade of that colour or transparency instead.

### Visual weight

- Step weights down (900 → 600, 700 → 500) and reduce sizes where the scale is inflated. See [typeset](typeset.md).
- Build hierarchy through weight, size and space instead of colour and boldness.
- Increase breathing room and reduce density.
- Thin borders and lines, lower their opacity, or remove them.

### Simplification

- Remove gradients, shadows, patterns and textures that serve no purpose.
- Pull extreme border radii back to the system's scale; simplify custom shapes.
- Flatten unnecessary layering; declare elevation once, with a border or a shadow, not both.
- Reduce or remove blur, glow and multiple stacked shadows.

### Motion

- Shorten travel to 10–20px instead of 40px or more, with gentler easing such as ease-out-quart (`cubic-bezier(0.25, 1, 0.5, 1)`). Never bounce or elastic.
- Keep functional motion (state, continuity, feedback); remove flourishes.
- Replace dramatic micro-interactions with gentle feedback, and remove any animation that serves no clear purpose. See [animate](animate.md).

### Composition

- Reduce scale jumps; smaller contrasts between sizes feel calmer.
- Bring rogue elements back onto the grid.
- Replace extreme spacing swings with a consistent rhythm. See [layout](layout.md).

### Never

- Make everything the same size and weight; hierarchy still matters.
- Remove all colour; quiet is not greyscale.
- Remove all personality; keep character through refinement.
- Sacrifice affordances; buttons, links and inputs must still look interactive.
- Make everything small and light; keep a few anchors.

## Verify

Answer each with rendered evidence:

- **Still functional:** the primary task is as fast and clear as before.
- **Still distinctive:** a squint test still shows the primary element, and the result could not be mistaken for a default template.
- **Still accessible:** desaturated and lightened text still meets 4.5:1 (3:1 for large text and UI parts); focus rings and error states stay visible.
- **Better reading:** body text is easier to read for long stretches.
- **Restrained, not absent:** the point of view survives the cuts.
- Re-run the source counts: each remaining shadow, gradient and animation has a stated job.

When the result feels right, continue with [polish](polish.md).

## Common failures

- Flattening everything to one weight and size, so hierarchy disappears.
- Draining all colour to grey and calling it calm.
- Lightening text until it fails contrast.
- Removing hover, focus or pressed states along with the decoration.
- Swapping the brand's character for a generic minimal template.
- Leaving loud motion in place while only the palette changes.
