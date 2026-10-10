# Task 10 attribution: visual craft guides

| guide | sources (repo path @ commit) | license | summary of changes |
|---|---|---|---|
| typeset | Impeccable `skill/reference/typeset.md` @ d631a88 | Apache-2.0 | Removed detector scan and live-mode params; replaced with token/style reads, rendered inspection via host browser/simulator, and a self-run grep of type values. Kept every engine-free rule; added defaults (scale ratios, line-height starting points, 12px label floor, display ≤6rem, tracking floor -0.04em, font-loading specifics), a licence-checked `materials.mjs font` sourcing step, and Common failures aligned with craft bans. |
| colorize | Impeccable `skill/reference/colorize.md` @ d631a88 | Apache-2.0 | Removed live-mode params and engine hand-off; added literal-colour grep, theme-by-use-scene rule, OKLCH neutral-tint range, dark-mode elevation specifics, browser-surface theming, large-text definition, vision-deficiency emulation via the host browser tool, and Common failures. |
| layout | Impeccable `skill/reference/layout.md` @ d631a88 | Apache-2.0 | Removed detector scan and live-mode params; replaced with rendered checks at 375/768/1440px and a self-run spacing grep. Added a default 4px spacing scale, 2× group/inner spacing rule, platform touch-target minimums, no-nested-cards and single-elevation rules, and Common failures. |
| animate | Impeccable `skill/reference/animate.md` @ d631a88 | Apache-2.0 | Removed engine hand-off; added non-negotiables (reduced motion, never block input, interruptible/reversible, 150–300 ms default), stagger caps, exit-duration ratio, transition-vs-keyframe interruption note, reduced-motion CSS example, loop pause rule, licence-checked `materials.mjs animated-icon` step, and Common failures. |
| delight | Impeccable `skill/reference/delight.md` @ d631a88 | Apache-2.0 | Removed engine hand-off; added the same motion non-negotiables, licence-checked `materials.mjs icon/animated-icon` step, no-emoji-icons rule, screen-reader live-region guidance, repetition test, links to onboard/clarify/animate, and Common failures. |

## sync.json

- atelier-design: `typeset`, `colorize`, `layout`, `animate`, `delight`
- No other skills.
