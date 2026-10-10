<!-- Adapted from Impeccable reference/craft-floor.md and reference/craft.md @ d631a88 (Apache-2.0) and uizze ui-design reference/craft.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Craft checks

Use this guide while implementing and before handing off any interface, after the direction is chosen. It is a floor, not a substitute for a direction.

Priority: the project's established system and the user's explicit choices override every default here; your own habits do not. Build to these checks silently; do not narrate the checklist to the user.

## Inspect the built interface

Each item is a check on the rendered result, not an intention. Run them together in one batched inspection, exercising the actual screen, not as separate screenshot trips.

- **Hierarchy:** the primary task or message reads first; supporting information is visibly subordinate. Use scale, weight, alignment and grouping before adding containers.
- **Typography:**
  - Body measure 45–75 characters (65–75ch for long reading); body line height 1.4–1.6; headings 1.1–1.25.
  - A coherent scale with visible steps in size and weight; deliberate weights, not every weight the family offers.
  - Display text at most 6rem; letter-spacing no tighter than −0.04em (−0.02 to −0.03em usually reads better).
  - Balanced heading wraps (`text-wrap: balance`); no clipped ascenders or descenders, no awkward heading wraps, no truncated essential labels. Run the real copy at every breakpoint and fix what overflows.
  - Tabular numerals for figures that are compared.
  - A system font is right for native and product UI. Choose a distinctive face only when the direction benefits and its licence and loading are handled (`node scripts/materials.mjs font "<query>"` reports licences).
- **Spacing:** relationships are visible. Related controls sit together, sections get clear separation, and there is more space above a heading than below it. Use the spacing scale; no arbitrary one-off gaps. Optical alignment agrees with the grid. Read computed values when in doubt.
- **Colour:** semantic roles stay consistent. Text and placeholder contrast ≥ 4.5:1, large text (≥ 24 px, or ≥ 18.66 px bold) and UI components ≥ 3:1. Focus is visible and disabled and error states stay readable. On coloured surfaces tint secondary text from that hue or the foreground, never plain grey. Colour never carries meaning alone; pair it with text, icon or shape.
- **Surfaces and depth:** coherent borders, radii and depth. Declare elevation once, border or shadow, not a 1 px border under a wide soft shadow. Shadows have an offset and soft blur; a zero-offset coloured halo is decoration. Card radii stay around 12–16 px; pills are for small controls.
- **Assets:** correct image aspect ratio and crop; sharp at displayed size (2× for raster on high-density screens); no broken images, accidental seams or duplicated device or status-bar chrome. Icons come from one real library or authored SVG in one stroke and weight (`node scripts/materials.mjs icon "<query>"`).
- **Browser surfaces:** text selection colour, caret colour, focus rings, link underline offset and scrollbar colours are themed from the palette, not left at browser defaults. Theme them; do not reinvent scrollbar behaviour.
- **Controls:** labels name the action ("Save draft", not "Submit"); focus order and keyboard operation work; touch targets ≥ 44×44 pt iOS, ≥ 48×48 dp Android, ≥ 24×24 CSS px web (≥ 44×44 for primary touch controls). Standard controls stay recognisable. Loading and disabled states explain what is happening; errors name the problem and the recovery.
- **States:** hover, focus, active, disabled, loading, error, empty and success wherever they can occur.
- **Layout:** test the requested width, a narrow width (320–390 px or the smallest phone) and the principal desktop or native device class. Long names, empty lists, 200% text or the largest Dynamic Type size, the on-screen keyboard and overflowing menus must not break the task.
- **Motion:** explains continuity, state or feedback. Content stays visible without animation; ease out from an already-visible default. Honour `prefers-reduced-motion`. Never block interaction behind an entrance sequence. Test interruption and reversal. One authored moment, not the same fade-up on every section.
- **Content:** real product language and credible data. Label fixtures and illustrative values as such. Never invent customers, testimonials, capabilities or performance results; claims and configuration come from supplied facts.
- **Coverage:** every requirement in the brief is present and findable within seconds.

## Detect habitual design

Ask what the screen actually communicates and enables. "It compiles" and "nothing overlaps" do not establish visual quality. Compare the rendered hierarchy and detail with the user's target, not just with a list of defects.

**Never add** (no brief earns these back):

- An eyebrow or kicker label above a heading. Delete it and let the heading carry its own weight.
- A card nested inside a card.
- Unicode glyphs or emoji standing in for an icon system.
- A geometric mask (circle, polygon, radial cutout) faking the contour of a photographed subject. Use a real cut-out asset or omit the effect.
- A modal for a task that needs neither interruption nor protected focus.

**Refuse by default.** These are common generated-UI defaults. Keep one only when the chosen direction or real task calls for it and you can say why; otherwise rewrite the element, do not merely soften it:

- Same-size icon + heading + text cards as the page structure.
- The hero-metric template: big number, small label, supporting stats, accent.
- Section numbers (01 / 02 / 03) unless the sequence is information the reader needs.
- Decorative charts, sparklines and progress rings standing in for content.
- Gradient headline text; take emphasis from weight or size.
- Glass and blur backgrounds as decoration.
- A coloured `border-left`/`border-right` thicker than 1 px on cards, list items, callouts or alerts.
- Hard offset shadows (`4px 4px 0`) outside a deliberately neobrutalist system.
- Indiscriminate pill shapes; identical entrance animations on every section.
- Monospace as a "technical" costume rather than for code, data or measurement.
- A system display face (Impact, Arial Black, the platform sans) as the display voice of a branded page. Source and self-host a face with the right character.
- Sketch-style SVG scenes or noise-filter grain imitating illustration. Crisp SVG geometry, diagrams and icons are fine.
- Stripe or grid-overlay backgrounds with no canvas, map or blueprint under them.
- Light or dark theme chosen by category instead of the use scene.

## Close the loop

Batch material corrections, recapture the affected sizes and states, and inspect the new captures. Check actual controls (click, tab, type, resize), not just screenshots. Run the project's relevant tests.

Report the scope of verification accurately. Never turn an unavailable browser, a failed service call, a skipped device or an unresolved finding into a pass. Do not create a novelty score or add effects merely to satisfy this checklist. With every check green, spend the remaining effort on the chosen direction; this floor never picks it.

## Common failures

- Checklist compliance treated as design quality.
- Browser-default selection, caret and focus ring on an otherwise themed page.
- Grey secondary text on a coloured surface.
- Every section entering with the same fade-up.
- Placeholder data shipped unlabelled.
- "Verified" claimed without rendering.
