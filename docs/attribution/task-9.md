# Attribution rows — Task 9

uizze = `uizze-reference` clone, `skills/ui-design/` @ 146928e. Impeccable = `impeccable-reference`, `skill/reference/` @ d631a88.

| guide | sources (repo path @ commit) | license | summary of changes |
|---|---|---|---|
| new-work | uizze `reference/new-work.md` @ 146928e; Impeccable `reference/new-work.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept and made concrete (2–3 questions, 5-second first viewport, 390/1440 px renders, two-round inspection ceiling). Added engine-free rules from Impeccable: work classification (redesign / established / incomplete brand / none), colour strategies, physical-scene light/dark choice, overused-font list, four generated-UI default looks, ~150-word contract blocks, contract never shipped to the browser, claims vs illustrative content, capture validity, fresh-context review via host subagent. Removed concept-seed, decision page, build-phase gates, comp-diff, detectors and shipped agents; references and materials go through our scripts. |
| operate | uizze `reference/operate.md` @ 146928e; Impeccable `reference/operate.md`, `reference/mode-operate.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Added product slop test, the four expression channels and signature move, no tool costumes, one-family type with 1.125–1.2 fixed rem scale, Restrained colour with state vocabulary, per-component state set, skeleton/empty/error rules, overlay escape techniques, 150–250 ms motion, numeric target and contrast thresholds, structural responsive rules. Comp-generation steps removed. |
| polish | uizze `reference/polish.md` @ 146928e; Impeccable `reference/polish.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Added drift classification, five-level triage order, per-area fix checklist (zoom, +30% localisation, layout shift, targets), diff clean-up. Critique-snapshot storage commands, detector and engine-context steps removed; replaced with host browser/simulator and project tests. |
| distill | uizze `reference/distill.md` @ 146928e; Impeccable `reference/distill.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Added complexity-source inventory, default variation targets (1–2 colours, one family, 3–4 sizes, 2–3 weights), flow and copy simplification, report of what moved. Template markers and command hand-off replaced with a link to polish. |
| audit | uizze `reference/audit.md` @ 146928e; Impeccable `reference/audit.md`, `reference/audit.native.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Merged web and native audits into one five-dimension, 0–4 scored check with numeric thresholds, P0–P3 severities, finding fields, systemic patterns, positive findings, confirmed vs suspected. Detector step replaced with running existing project checks; command recommendations replaced with links to our guides. |
| craft | uizze `reference/craft.md` @ 146928e; Impeccable `reference/craft-floor.md`, `reference/craft.md` @ d631a88 | Apache-2.0 | Every uizze check kept and made numeric (measure, line height, display size, tracking, contrast, targets, radii). Merged craft-floor verify list (depth, browser surfaces, coverage) and its bans: absolute "never add" list (eyebrows, nested cards, glyph icons, geometric masks, reflex modals) plus a "refuse by default" list consistent with uizze's "not universal bans". Hook references removed. |
| ios | uizze `reference/ios.md` @ 146928e; Impeccable `reference/ios.md`, `reference/audit.native.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Added HIG specifics (2–5 tabs, large titles, modality, grouped lists, iPad size classes, 44 pt, 17/11 pt type, semantic colours, single tint, SF Symbols, system materials), simulator capture steps with `xcrun simctl`, dark and Dynamic Type passes, hardware honesty, HIG lookup via `node scripts/references.mjs`. Product-branded overdrive wording removed. |
| overdrive | uizze `reference/overdrive.md` @ 146928e; Impeccable `reference/overdrive.md` @ d631a88 | Apache-2.0 | Every uizze instruction kept. Added surface-specific examples, technique toolkit (`@starting-style`, `@property`, scroll timelines, WebGPU→WebGL2 fallback, OffscreenCanvas), feature-detection snippets, 60 fps / ~50 fps thresholds, refinement pass. Banner output, compatibility claims and command references removed; Android added to native bullet. |
| reference-policy | uizze `references/uizze-reference-policy.md` @ 146928e | Apache-2.0 | Every rule kept. Paid tool names, Packs and confirmation parameters replaced with `node scripts/references.mjs` and `node scripts/materials.mjs`, exit-code mapping (0 match/no-match, 1 usage, 2 service error), browser inspection of returned links, licence recording, dependency approval. Untrusted-data rules kept and extended to registry files. Branding and paid-access framing removed. |

## sync.json

| guide | skills |
|---|---|
| new-work | atelier-design |
| operate | atelier-design |
| polish | atelier-design, atelier-review |
| distill | atelier-design |
| audit | atelier-design, atelier-review |
| craft | atelier-design, atelier-review, atelier-match |
| ios | atelier-design, atelier-review |
| overdrive | atelier-design |
| reference-policy | atelier-design, atelier-review, atelier-radar |
