<!-- Adapted from Impeccable reference/layout.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Layout

Use this guide when the structure is the problem: unclear reading order, weak grouping, monotonous spacing, framework-default grids, or breakage across viewports.

Layout turns product priority into reading order, grouping, rhythm and usable space. Diagnose the structural problem before moving boxes.

## Match the surface

- **Persuasive or experiential surfaces:** composition may be asymmetric, fluid or deliberately disruptive when the chosen world earns it.
- **Operational or reading surfaces:** predictable structure, stable density and navigable linearity are features. See [operate](operate.md).
- **Native apps:** follow [ios](ios.md) or [android](android.md) for navigation, safe areas, size classes and touch targets.

Keep the established visual world. This guide changes structure inside it; replacing the identity belongs to [new-work](new-work.md).

## Assess first

Run the app and render representative states at about 375px, 768px and 1440px wide (or the platform's size classes) with the host's browser or simulator tool. Answer each question with rendered or source evidence:

- **Reading order:** Squint at (or blur) the screenshot. Can you still name the primary element, the secondary element and the major groups, in order?
- **Grouping:** Are related items close and distinct groups clearly separated, or are borders and cards compensating for weak proximity?
- **Rhythm:** Do tight and generous intervals form a deliberate cadence, or is one spacing value repeated until everything weighs the same?
- **Structure:** Does the topology fit the content and task? Are repeated cards, columns or sections genuinely equivalent, or a framework default?
- **Density:** Does the information per region fit use frequency, decision complexity and surface type?
- **Adaptation:** At narrow, intermediate, wide, 200% zoom and localised states, what reorders, collapses, wraps, scrolls or stays fixed? Do DOM order and focus order still match visual order? Tab through to check.
- **Extremes:** Do long content, empty states, overlays, sticky elements, safe areas and small touch targets expose structural failures?

Then do a mechanical pass yourself: grep for spacing values (`margin`, `padding`, `gap`, `top/left`, utility classes, inline styles) and list the distinct values; look for off-scale numbers, `overflow: hidden` hiding real content, stacked `z-index` values, and fixed widths or heights on text containers. Keep this out of the first assessment, then combine both before editing. A clean grep cannot prove hierarchy or rhythm.

## Set the spatial thesis

Before editing, name:

- the primary reading or task path;
- what belongs together and what must separate;
- which element leads and which supports;
- the intended density and spacing rhythm;
- how the structure changes across containers, viewports, input modes and content extremes.

Choose the simplest structural model that expresses those relationships: flow for prose, flex for one-axis groups, grid for two-axis alignment. Name reusable spacing and container roles by purpose (`--space-section`, `--space-stack`), not by value.

## Apply

- Group by meaning. Use proximity before adding containers, borders or backgrounds.
- Build rhythm from contrast between tight and generous intervals: space between groups at least 2× the space inside them, and more space above a heading than below it.
- Use a documented spacing scale, not one-off values. Default: a 4px base (4, 8, 12, 16, 24, 32, 48, 64, 96); it gives the middle steps an 8-only scale misses. Project tokens override this default.
- Let hierarchy follow product priority, not framework defaults.
- Keep distinct content distinct without making every group an isolated card. Never nest cards.
- Make responsive behaviour structural: reorder, collapse, reflow or reveal based on what stays important, not only shrink.
- Use container queries for components that appear in contexts of different widths.
- Use `gap` for sibling rhythm instead of child margins when it states the relationship more directly.
- Touch targets: at least 44×44pt (iOS) / 48×48dp (Android) / 24×24 CSS px minimum on web with 44px preferred, even when the visible mark is smaller.
- Use depth (shadow, layering) only when it clarifies state or hierarchy, and declare elevation once: border or shadow, not both.
- Make optical corrections (icon nudges, hanging punctuation, visual centring) only after inspecting the render.

Variation is not a goal. Repetition supports recognition; break it only when content or priority changes.

## Verify

Answer each with rendered or source evidence; a bare "yes" is not verification:

- The squint test shows the primary, secondary and major groups in order at every checked width.
- The reading and task path stays clear at every supported size.
- Related content groups naturally; unrelated content does not blur together.
- Tight and generous spacing form a deliberate rhythm.
- Density matches use frequency and content complexity.
- Long text, empty states, localisation, 200% zoom and dynamic content do not break the structure; nothing overflows horizontally.
- Keyboard, touch and screen-reader order match the visual order.
- Re-run the spacing grep: every remaining off-scale value has a stated reason.

When the structure holds, continue with [polish](polish.md).

## Common failures

- Same-size cards of icon + heading + text as the page structure, or cards nested inside cards.
- One spacing value everywhere, so nothing groups and nothing separates.
- Borders and backgrounds used to fake grouping that proximity should provide.
- Responsive design that only shrinks the desktop layout instead of restructuring it.
- Visual order rearranged with CSS while DOM and focus order stay in the old sequence.
- Fixed heights on text containers that clip long or translated copy.
- Touch targets sized to the visible icon (16–20px) instead of the minimum hit area.
- Section numbers (01 / 02 / 03) or eyebrow labels used as structure when the sequence carries no meaning.
