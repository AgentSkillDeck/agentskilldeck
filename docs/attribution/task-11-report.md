# Task 11 report: robustness and flow guides

Status: DONE
Branch: `worktree-agent-af409d049a6658015`. Guides commit `2f22e22` (feat(ui): hardening, UX copy, onboarding, adaptation and performance guides). This report is committed on top of it, as the final commit on the branch. The worktree guard blocked writing to `.superpowers/sdd/.../task-11-report.md`, so the report lives here.

## Files
- plugins/ui/library/{harden,clarify,onboard,adapt,optimize}.md (new; `plugins/ui/library/` did not exist on this branch, so I created it)
- docs/attribution/task-11.md (attribution rows + `## sync.json` section, per the parallel-execution overrides)

## Sizes (bytes, wc -c): source vs ours (limit is 2x)
| guide | source | ours | limit |
|---|---|---|---|
| harden | 9467 | 11198 | 18934 |
| clarify | 4607 | 6608 | 9214 |
| onboard | 7757 | 7912 | 15514 |
| adapt | 11318 (adapt.md) + 3927 (adapt.native.md) | 10801 | 22636 (main source) |
| optimize | 7631 | 7689 | 15262 |

## Grep check
`grep -nE 'uizze|UIZZE|npx impeccable|impeccable context|\{\{' plugins/ui/library/<guide>.md` printed nothing for any of the five guides. The provenance line does not match the pattern either.
Links: harden → clarify, layout, onboard, polish, typeset; clarify → harden, onboard, polish; onboard → clarify, delight, harden, polish; adapt → android, ios, layout, optimize, polish, typeset; optimize → animate, harden, polish, typeset. Every target is a guide in this wave.
`grep 'measure before claiming an improvement' optimize.md` returned 1 match. Hedge-word grep (consider/might/perhaps) returned 0 matches.

## Engine content removed or replaced
- Every `{{command_prefix}}impeccable polish` hand-off is now `continue with [polish](polish.md)`.
- adapt.md's routing to adapt.native.md is gone. The two files are merged into one guide with Web and Native sections.
- "Additional context needed" blocks are now a "Context you need" line that tells the agent to infer from the brief and code before asking, matching the sibling guides.
- Named third-party products are gone: tour libraries (Intro.js, Shepherd, Joyride), Tippy/Popper, and monitoring vendors. In their place: use the project's existing components, and add a library only with the task's authority.
- "Test with real users" (onboard) and "test on real devices" now mean: run with a fresh account in the host's browser or simulator tool, never report metrics you did not observe, and say which tool produced each piece of evidence.

## Additions (beyond source)
- harden: an Assess section that lists every reachable state and forces each one in the running app, plus a self-run grep for fixed widths, physical properties, string concatenation, hand-rolled plurals, swallowed catches and untimed fetches. Also added:
  - an HTTP status-to-state table (adds 409, and 429 with Retry-After);
  - a 10–15 s request timeout and abort-on-unmount;
  - automatic retry for idempotent requests only, with 1/2/4 s backoff;
  - an offline "queue or block" rule, optimistic rollback, and the OS-permission denied path;
  - stale-response cancellation, RTL icon-mirroring rules, and a 300 ms skeleton threshold;
  - the evidence-provenance rule, and Verify items with concrete inputs.
- clarify: before/after tables for confirmations, form validation, errors, permissions, rate limits and empty states. Also sentence case, one word per concept, and out-of-context link text.
- onboard: a steps-to-first-value count, 3–5 setup steps and 3–7 tour steps as defaults, permission prompts shown in context, and removable sample data. Dismissal state is stored on the server and versioned. Also focus and accessibility rules for overlays, and a licence-checked `node scripts/materials.mjs icon` step.
- adapt:
  - phone tables (sticky column or cards) and a 16px input rule;
  - CSS for `hover: none` / `pointer: coarse`, `dvh`/`svh`, and the safe-area `max()` pattern;
  - print link expansion and email bulletproof CTAs;
  - Android window size-class breakpoints (600/840dp) and a foldable hinge rule;
  - an explicit list of widths to check in Verify.
- optimize: "measure before claiming an improvement" is the core rule. Measurement is tool-agnostic: browser performance panel, Lighthouse, network panel, React Profiler, Instruments, Android Studio Profiler, bundle stats, field data. Also added:
  - baseline recording and a median-of-3-runs rule;
  - a metric / target / cause table;
  - LCP `fetchpriority`, yielding on long tasks, and a warning against memo by reflex;
  - native profiling on release builds;
  - a before/after table in Verify.
- All five end with `## Common failures` (8 bullets each).

## Consistency with siblings
Each guide matches the sibling structure: a one-line "Use this guide when…" opener, Assess first / Apply / Verify sections ("Answer each with … evidence; a bare 'yes' is not verification"), a "continue with [polish](polish.md)" hand-off, and Common failures. Shared defaults and wording match the siblings: 30–40% localisation expansion, 200% zoom, 150–300 ms timing, the touch-target minimums in layout, and "project tokens override this default". I linked to typeset, layout and animate instead of repeating their content.

## Deviations
- Per the controller overrides, I did not edit sync.json or ATTRIBUTION.md and did not run `npm run sync/check`. The sync mapping is in docs/attribution/task-11.md.
- One "before" example in clarify originally contained an emoji. I removed it.
- The report is at docs/attribution/task-11-report.md because the worktree guard blocked the shared path.

## Concerns
None. The linked siblings (polish, ios, android, etc.) aren't on this branch yet, so the links resolve only after the wave is merged.
