# Task 10 report: visual craft guides

Status: DONE. Branch `worktree-agent-a7707e970a9017385`. Initial commit `02bf1b1` feat(ui): typography, colour, layout, motion and delight guides.

## Implemented

- `plugins/ui/library/{typeset,colorize,layout,animate,delight}.md`
- `docs/attribution/task-10.md`: attribution table plus `## sync.json` (all five guides go to atelier-design only).

Following the parallel overrides, I did not edit `sync.json` or `ATTRIBUTION.md` and did not run the npm sync/check steps. This is content work, so there is no TDD.

Each guide has:
- one provenance line and a one-sentence opener;
- the sections Match the surface / Assess / Apply / Verify;
- a `## Common failures` list of 7–8 bullets;
- a hand-off to polish.md.

## Engine-dependent content removed or replaced

- **Detector scans:** `{{scripts_path}}/impeccable detect --scope type|layout` is replaced by a grep of distinct values that the agent runs itself, re-run in Verify.
- **Assessments:** the "isolated sub-agent assessments" are now one design pass followed by one mechanical pass.
- **Live mode:** the live-mode param sections and the live.md links are removed.
- **Hand-offs:** `{{command_prefix}}impeccable polish` now points to [polish](polish.md).
- **Vocabulary:** "Visitor mode" is now "Match the surface".
- **DESIGN.md:** now only an example of the project's design notes.
- **Host-native steps added:** run the app, use the host browser or simulator, tab through the page, emulate reduced motion and vision deficiencies, and throttle network and CPU.

## Fix round 1

Changes (line numbers after the fix):

1. **Important:** `plugins/ui/library/animate.md:100`. The reduced-motion example is now `.panel { transition-property: opacity; transition-duration: 150ms; }`, replacing the `transform: none` override. Line 104 adds the note: keep open and closed states and remove only the movement; do not force `transform: none`; if a closed state relies on transform, pair it with `visibility: hidden` and `pointer-events: none`.
2. `plugins/ui/library/delight.md:47`. The `icon|animated-icon` text is split into two separate commands, one for `icon` and one for `animated-icon`.
3. `plugins/ui/library/delight.md:8`. Restored "Ask only when the emotional range or the stakes cannot be inferred."
4. `plugins/ui/library/colorize.md:71`. Added that disabled and inactive controls are exempt under WCAG 1.4.3 and 1.4.11 but must stay distinguishable from enabled ones.
5. `plugins/ui/library/colorize.md:62`. Added how to measure: the host browser tool's accessibility or contrast inspection, or computing the WCAG ratio from computed `color` and `background-color`.
6. Each taste gate now has an observable test:
   - `typeset.md:76`: faces and weights trace to tokens or recorded decisions, and the screen doesn't pass for a starter template once the logo is removed;
   - `colorize.md:87`: the palette no longer fits if a neighbouring product's logo is swapped in, and every hue traces to a token or role;
   - `delight.md:83`: the copy uses the product's own nouns and verbs, and the detail comes from its existing palette, shapes or mechanism.

Re-run checks:

- `grep -nE 'uizze|UIZZE|npx impeccable|impeccable context|\{\{'` on all five guides: no output (exit 1).
- Links: android, animate, clarify, craft, ios, new-work, onboard, operate, polish. All are in the wave list.
- Sizes (bytes, ours / source, limit 2×):

| guide | ours | source | ratio |
|---|---|---|---|
| typeset | 8268 | 5256 | 1.57× |
| colorize | 6598 | 4554 | 1.45× |
| layout | 6157 | 5161 | 1.19× |
| animate | 8606 | 5253 | 1.64× |
| delight | 6427 | 3733 | 1.72× |
