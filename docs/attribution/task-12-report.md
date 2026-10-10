# Task 12 report: critique and direction guides

Status: DONE. Branch `worktree-agent-ad3d50262fb6fe579`. Guides commit `0eeee09` feat(ui): critique, Android, bolder/quieter and shaping guides. This report is committed separately; the worktree guard blocked the shared `.superpowers/` path.

## Implemented

- `plugins/ui/library/{critique,android,bolder,quieter,shape}.md`
- `docs/attribution/task-12.md`: attribution table plus `## sync.json` (critique → atelier-review; android → atelier-design and atelier-review; bolder, quieter, shape → atelier-design).

Following the parallel overrides, I did not edit `sync.json` or `ATTRIBUTION.md` and did not run `npm run sync`/`check`. This is content work, so there is no TDD.

My worktree had no `plugins/ui/library/`; the Task 10 guides live only in sibling worktree agent-a7707e970a9017385. I read them there for structure and vocabulary and created the folder fresh here. On merge, the folder is the union of the two.

## Sizes vs source (bytes, `wc -c`)

| guide | ours | source | limit |
|---|---|---|---|
| critique | 14883 | 45216 | ≤ 15 KB (brief) |
| android | 7744 | 4895 | ≤ 9790 |
| bolder | 4986 | 3457 | ≤ 6914 |
| quieter | 5564 | 4845 | ≤ 9690 |
| shape | 5433 | 3547 | ≤ 7094 |

## Checks

`grep -nE 'uizze|UIZZE|npx impeccable|impeccable context|\{\{' plugins/ui/library/<guide>.md`:
- critique: line 1 only. This is the `<!-- Adapted from Impeccable reference/critique.md @ d631a88 (Apache-2.0) and uizze ui-design reference/craft.md @ 146928e (Apache-2.0); modified by agentatelier -->` comment.
- android, bolder, quieter, shape: no matches.

Relative links (all `[name](name.md)` and all in the allowed wave list):
- critique: adapt, android, animate, audit, bolder, clarify, colorize, delight, distill, harden, ios, layout, onboard, optimize, polish, quieter, shape, typeset
- android: animate, colorize, ios, polish, typeset
- bolder: animate, new-work, polish
- quieter: animate, colorize, distill, layout, operate, polish, typeset
- shape: critique, new-work, reference-policy

No titled or angle-bracket links. Hedge-word grep: one hit, critique's "Never write 'consider exploring'", which is a prohibition.

## Engine content removed or replaced

- **critique:**
  - Two isolated sub-agent assessments, the degraded banners and the Codex gates became two ordered passes in one context. Pass A notes are written down before Pass B, which keeps the anti-anchoring intent.
  - `impeccable detect`, live-server overlay injection and `detect.js` became host browser/simulator renders at stated sizes and states, a tab-through, contrast measurement, a source grep and the project's tests.
  - Snapshot persistence, `critique-storage` slug/write/trend, the META env var and the trend line are gone. They became "re-run this critique on the same target and sizes to compare".
  - The ignore file became the brief and design notes' explicitly accepted decisions.
  - Template-command hand-offs now map to agentatelier guides, with polish last.
  - Config-file Design Context personas now come only from the brief or design notes.
- **android:** removed the `<!-- rule:… -->` IDs and the visitor-mode wording.
- **bolder, quieter:** the ask-instruction placeholder became "ask the user". The engine polish hand-off became a link to polish. The new-work reference in bolder became a link.
- **shape:** the structured question tool became the host's tool, or plain text and stop.

## Kept (critique)

- All 10 heuristics with their check items and 0/4 anchors, plus a shared 0–4 scale.
- The n/a renormalisation rule and the percentage bands.
- All 8 cognitive-load checklist items with scoring, the working-memory rule and its counts, and all 8 named violations.
- The emotional journey.
- All 5 personas with their test questions and red flags, and the selection table.
- P0–P3 severity and the support-ticket tip.
- The targeted-question and skip rules.

Every item from the uizze "Detect habitual design" section is in: icon-title-text cards, decorative charts, nested panels, gradient headlines, glass backgrounds, indiscriminate pill shapes, identical section entrances, not universal bans, "compiles/no overlap is not quality", and compare with the target. So is the "Close the loop" honesty rule: no novelty score, and an unavailable browser is never a pass. All of it is attributed in the provenance line and in the attribution file.

## Additions

- **critique:** an explicit output contract, in order:
  - a Pass/Fail verdict against the brief (Fail on any P0, any P1 that breaks the brief, or a brief-required check that could not be run);
  - a Method line;
  - findings ordered by user impact, each with screen/state, evidence (what was observed and how) and the smallest fix plus the guide that applies it;
  - a separate "Could not verify" list;
  - questions last.

  It is read-only unless fixes were requested, and any server it starts is stopped. It also adds a Set up step (resolve target, find the brief or write a labelled assumed job, classify the surface) and Common failures.
- **android:**
  - window size class breakpoints (600/840dp);
  - predictive-back opt-in and handlers for Compose, Flutter and React Native;
  - `enableEdgeToEdge`, SDK 35 enforcement and the inset APIs;
  - `minimumInteractiveComponentSize`;
  - nonlinear font scaling to 200% with a 2.0 font_scale check;
  - M3 duration tokens;
  - a Remove-animations adb check;
  - an Accessibility (TalkBack) section;
  - Back, inset and rotation verification;
  - Common failures.
- **bolder:** a rendered Assess checklist of the system's strongest moves, four named decisive moves, contrast/focus/reduced-motion guards, a no-invented-evidence rule, rendered Verify checks (neighbour diff, narrow-width reflow) and Common failures.
- **quieter:** source counts of intensity, a distill boundary, the ease-out-quart cubic-bezier, a single-elevation rule, a contrast re-check after desaturation, re-run counts and Common failures.
- **shape:** a read-before-asking step, an optional `node scripts/references.mjs` lookup under reference-policy with exit-2 handling, range examples, and an "Acceptance checks" brief section that critique judges against, plus Common failures.

## Self-review / concerns

- critique and android ship to atelier-review (`tools: false`); neither guide calls `node scripts/…`.
- The android additions (API names, the 600/840dp breakpoints, the M3 duration tokens, SDK 35 edge-to-edge) come from platform knowledge, not from the source. Spot-check them if needed.
- The critique Fail rule for unrun brief-required checks is stricter than the source. It is intentional, in line with the uizze honesty rule.
