<!-- Adapted from Impeccable reference/typeset.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Typeset

Use this guide when typography is the problem: weak hierarchy, arbitrary sizes, poor reading comfort, unfit faces, or font loading that shifts or hides text.

Typography carries information, hierarchy and voice. Improve it inside the established visual world. Do not replace the identity unless the user asked for that.

## Match the surface

- **Persuasive or experiential surfaces** (landing, portfolio, editorial, campaign): display type may carry the voice. Use decisive size and weight contrast and fluid scale where the composition benefits.
- **Operational or reading surfaces** (app, dashboard, settings, docs): stability, scanability and measure come first. One well-tuned family and a fixed role scale are often right. See [operate](operate.md).
- **Native apps:** follow [ios](ios.md) or [android](android.md), including Dynamic Type / font scaling and platform text styles.

If new type would create a new identity, route through [new-work](new-work.md) and record the decision in the project's design notes (for example `DESIGN.md`). Otherwise keep the confirmed families and improve how they are used.

## Assess first

Read the token files, global CSS / theme, and two or three representative screens. Run the app and render them with the host's browser or simulator tool. Answer every question with a file, selector or computed value, not an impression:

- **Authority and fit:** Which faces, weights and roles are established? Do they fit the product, or are they unexamined defaults? Is every family necessary?
- **Hierarchy:** Can heading, body, label, metadata and data roles be told apart at a glance? Are adjacent sizes or weights too close to carry different jobs (for example 15px vs 16px, 500 vs 600)?
- **Scale and consistency:** Is there a deliberate role scale or a pile of arbitrary values? Do repeated roles stay identical across screens and states?
- **Reading:** Is body copy within 45–75 characters per line? Are line height, paragraph rhythm, contrast and tracking tuned to the actual face, width, language and surface?
- **Stress:** What happens with long headings, 30–40% localisation expansion, 200% zoom, narrow containers, a missing weight, and fallback fonts?
- **Delivery:** Are only used files and weights loaded? Do fallback metrics, `font-display` and variable-font settings avoid invisible text and layout shift?

Then do a mechanical pass yourself: grep the styles for `font-size`, `font-weight`, `line-height`, `letter-spacing` and `font-family` values (including utility classes and inline styles) and list every distinct value. More than about 8 distinct sizes, or values off the scale, means there is no system. A clean grep is a floor, not proof of good typography. Combine both passes before editing and note what each caught alone.

## Set the system

Before editing, write down:

- the roles the interface needs (for example display, heading, body, label, caption, data, code);
- the intended contrast between those roles;
- the reading measure and density;
- which existing faces and weights are authoritative;
- performance, localisation and accessibility constraints.

Use the fewest roles and families that make the hierarchy unmistakable. Default: one family, or two (display + text) when the second performs a role the first cannot. Combine size, weight, space and colour tone; do not ask size alone to carry hierarchy. A ratio of about 1.2–1.25 suits dense product UI and 1.333–1.5 suits marketing display; project tokens override this default. Name tokens by purpose (`--text-body`, `--text-label`), not by value (`--text-14`).

## Choose or source a face

Only when the brief or task authorises a new face:

1. Describe the character you need in a few words (for example "humanist sans, open apertures, tabular figures").
2. Run `node scripts/materials.mjs font "<query>" --category <serif|sans-serif|display|monospace|handwriting> --limit 3`.
3. Read each result's `License:` line before choosing. Use only faces whose licence permits the project's use (web embedding, app bundling, commercial use). If unclear, open the licence URL; if still unclear, do not use it.
4. Treat the `Install:` line as text to propose. Install or add a dependency only when the task gives that authority; otherwise report the snippet.
5. Exit 0 with "No match…" means refine the query. Exit 2 is a service error: say so and continue with the project's existing fonts. It does not mean no fonts exist.

Self-host or load the face properly. Using the nearest installed system font as a display voice is a failure, not a fallback (see [craft](craft.md)).

## Apply

- Body text on the web is at least 1rem / 16px unless a dense role, platform convention or user setting justifies smaller. Labels and metadata stay at or above 12px.
- Long-form body measure: 65–75ch. Narrow columns and cards may go down to 45ch; nothing reads well beyond 75ch. Set `max-width` in `ch`.
- Tune line height inversely with measure: wider lines need more leading. Starting points: body 1.5–1.6, headings 1.1–1.25, display 1.0–1.1. Adjust to the face, width, language and contrast; there is no universal ratio.
- Display type: at most 6rem. Negative tracking stops at -0.04em; -0.02em to -0.03em usually reads better. Use `text-wrap: balance` on headings and `text-wrap: pretty` on short paragraphs where supported.
- Light text on dark surfaces: compensate on all three axes: slightly more line height (+0.05–0.1), a touch more tracking (+0.01em), and one weight step more when the face looks thin.
- Keep repeated roles identical across screens and states.
- Use OpenType features where content benefits: `font-variant-numeric: tabular-nums` for tables, prices and timers; real monospace for code; `small-caps` or uppercase with +0.04–0.08em tracking for short labels only.
- Load only used files and weights. Use `font-display: swap` (or `optional` for non-critical faces), preload the one or two critical files, and set fallback metrics (`size-adjust`, `ascent-override`) so the swap does not reflow the page.
- Fluid display type (`clamp()`) suits marketing surfaces. Keep dense product and reading surfaces on fixed, predictable sizes.
- Preserve browser zoom, user font settings, Dynamic Type and platform text scaling. Size text in `rem`, never lock it with `px` on `html`.
- Mark paragraphs with spacing or first-line indent, not both.

Do not make type decorative at the expense of comprehension. Do not add a second family without a role only it can perform.

## Verify

Answer each with rendered or source evidence. A bare "yes" is not verification.

- Primary, secondary, body and metadata roles are recognisable without reading the copy.
- Real copy (longest heading, longest label) fits at every breakpoint with no overflow or clipping.
- Long text stays comfortable across relevant widths and languages.
- The typography belongs to this product and its established world.
- Font loading causes no invisible text and no visible reflow (throttle the network in the browser tool and reload).
- 200% zoom, text scaling, focus states, contrast (4.5:1 body, 3:1 large text) and narrow viewports stay usable.
- Re-run the value grep: every remaining off-scale value has a stated reason.

When the hierarchy holds, continue with [polish](polish.md).

## Common failures

- Hierarchy carried by size alone, with adjacent roles one pixel or one weight apart.
- A collection of arbitrary sizes instead of a named role scale.
- Body copy running past 75ch on wide screens, or set below 16px for style.
- Over-tight display tracking (beyond -0.04em) and headings that overflow at mobile widths.
- Monospace used as a "technical" costume instead of for code, data or measurement.
- A system face standing in as the display voice, or a third family with no distinct role.
- Loading every weight of every family, causing invisible text or layout shift.
- A kicker or eyebrow label above each heading in place of a heading that carries its own weight.
