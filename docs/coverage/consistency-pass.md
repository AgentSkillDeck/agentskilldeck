# Consistency pass (Task 12.5)

_Historical record of the 12.5 harmonisation pass. Ten guides and the four SKILL.md files were later rewritten in our own words, so line numbers for those no longer apply; the shared vocabulary and numbers listed here still hold._

Every change made to `plugins/ui/library/*.md` while harmonising the 24 guides. Line numbers refer to the guide after the pass. Authority rules and the chosen vocabulary are recorded in [library-index.md](library-index.md).

Rule keys: **V** vocabulary (one term per concept) · **N** numeric default per the authority guide · **R** rule conflict resolved for the authority guide · **D** duplicated rule block replaced by a pointer · **S** structure (opener, headings, hand-off line) · **L** links.

| Guide | Line | Before → after | Rule |
|---|---|---|---|
| adapt | 16 | "desktop modals on phone" → "desktop-sized dialogs on phone" | V (dialog) |
| adapt | 55 | "Large button-style CTAs" → "Large button-style primary actions" | V (primary action) |
| adapt | 87 | Android "medium 600–840dp, expanded > 840dp" → "medium 600–839dp, expanded 840dp and up; see [android](android.md)" | N (android owns window classes) + L |
| audit | 38–41 | P0 "prevents task completion." → adds "loses data or locks out a required user group; fix immediately"; P1 adds "a broken brief requirement"; P2 adds "fix in the next pass" (absorbed from critique's severity block) | D (audit owns the severity scale) |
| audit | 44 | (new) "Torn between two levels? Ask 'would a user contact support about this?' If yes, it is at least P1." (moved from critique) | D |
| clarify | 82 | empty kinds "(first use, no results, …)" → "(first use, cleared by the user, no results, …)" to match harden's list | V (empty state taxonomy per harden) |
| craft | 4 | "Use this guide while implementing and before handing off any interface" → "Use this guide when implementing or handing off any interface" | S (opener) |
| craft | 14 | Two sub-bullets restating typeset (measure 45–75 / 65–75ch, line heights, display ≤ 6rem, tracking −0.04em / −0.02–−0.03em) → one line "Measure, line height, display size and tracking meet [typeset](typeset.md) (default: body 45–75ch, line height 1.5–1.6, display ≤ 6rem, tracking no tighter than −0.04em)" | D (typeset owns type) |
| craft | 67 | (new) "When the floor holds, review the result with [critique](critique.md) or [audit](audit.md)." | S (hand-off) |
| critique | 10 | "the settings modal" → "the settings dialog" | V (dialog) |
| critique | 11 | "any shape brief (see [shape](shape.md))" → "the brief (from [shape](shape.md) when one exists)" | V (the brief) |
| critique | 44 | List of habitual defaults dropped "nested panels"; added "Craft's 'Never add' list (eyebrow or kicker labels, nested cards, glyph icons, faked subject masks, needless modals) is absolute: flag every instance." Previously nested panels were called "not universal bans", contradicting craft. | R (craft owns absolute bans) |
| critique | 54 | "cancel on forms and modals" → "cancel on forms and dialogs" | V (dialog) |
| critique | 92 | "Does Esc close modals?" → "Does Esc close dialogs?" | V (dialog) |
| critique | 110 | Severity block (four P-level definitions + tie-breaker) → "Tag every finding P0 (blocking), P1 (major), P2 (minor) or P3 (polish) on the scale and tie-breaker defined in [audit](audit.md). Confusion that causes significant difficulty is P1." | D (audit owns severity) + L |
| delight | 12–15 | Four non-negotiable bullets restating animate (reduced motion, never block input, interruptible, 150–300 ms) → one line pointing to [animate](animate.md) plus the two delight-specific rules (a flourish never delays/covers the next action and is cancelled by a new action; up to ~800 ms only for rare milestones) | D (animate owns motion) |
| harden | 89 | "a skeleton or placeholder shaped like the content" → "a skeleton shaped like the content" | V (skeleton) |
| ios | 4 | "Use this guide alongside the task's main guide for any iOS or iPadOS app: …" → "Use this guide when building or reviewing any iOS or iPadOS app (…), alongside the task's main guide." | S (opener) |
| ios | 60 | (new) "When the platform rules hold, continue with [polish](polish.md)." (matches android) | S (hand-off) |
| layout | 18 | "at about 375px, 768px and 1440px wide" → adds "plus 320px for the smallest phones" | N (layout owns test widths) |
| layout | 52 | "24×24 CSS px minimum on web with 44px preferred" → "24×24 CSS px minimum on web (44px for primary touch controls)" | N (shared touch-target default) |
| layout | 82 | "Section numbers (01 / 02 / 03) or eyebrow labels used as structure when the sequence carries no meaning." → "Section numbers … when the sequence carries no meaning, or any eyebrow label above a heading (banned outright; see [craft](craft.md))." | R (eyebrow ban is absolute) + L |
| new-work | 12 | "no DESIGN.md change unless the user approves a system change" → "no design-notes change unless …" | V (design notes) |
| new-work | 13 | "even when no DESIGN.md exists" → "even when no design notes exist" | V (design notes) |
| new-work | 75 | (new) "When the build verifies, continue with [polish](polish.md)." | S (hand-off) |
| operate | 4 | "Use this guide for app screens, …" → "Use this guide when building app screens, …" | S (opener) |
| operate | 47 | "## Finish" → "## Verify" (coverage map rows updated) | S (heading) |
| operate | 55 | (new) "When the task path holds, continue with [polish](polish.md)." | S (hand-off) |
| operate | 61 | "non-standard modals" → "non-standard dialogs" | V (dialog) |
| optimize | 77 | Animation section's four bullets restating animate's runtime rules → one line "Follow the runtime rules in [animate](animate.md): transform/opacity, bounded blur and shadows, no casual layout-property animation, `will-change` only during a known animation (on everything it wastes memory)." | D (animate owns motion) |
| overdrive | 74 | (new) "When the enhancement holds, continue with [polish](polish.md)." | S (hand-off) |
| polish | 10 | "Read DESIGN.md if present" → "Read the design notes (for example `DESIGN.md`) if present" | V (design notes) |
| polish | 49 | (new) "For a technical pre-release check, continue with [audit](audit.md); for design judgement, [critique](critique.md)." | S (hand-off) |
| quieter | 44 | "keep colour as an accent on roughly 10% of the surface" → "keep colour for accents that have a job. Dosage follows the brief, not a percentage rule (see [colorize](colorize.md))." | R (colorize: no fixed percentage rule) |
| quieter | 46 | Two bullets restating colorize (tint neutrals only for cohesion; no grey text on colour, "use a darker shade or transparency") → one line pointing to [colorize](colorize.md). Also drops "transparency", which contradicted colorize's "prefer explicit colours to translucent overlays". | D + R |
| reference-policy | 4 | "Use this guide before running the reference or material scripts, or before using any outside page …" → "Use this guide when running the reference or material scripts or using any outside page …" | S (opener) |
| reference-policy | 42 | (appended) "Then return to the calling guide." (plain text; the guide stays link-free for deck-radar; kept short so the guide stays within 2× its 2,233-byte source) | S (hand-off) |
| shape | 4 | "it returns a confirmed design brief" → "it returns the confirmed brief" | V (the brief) |
| shape | 71 | (new) "Once the brief is confirmed, build it with [new-work](new-work.md) or the guide the task names." | S (hand-off) |
| typeset | 61 | "uppercase … for short labels only." → "… for short labels only, never as an eyebrow above a heading." | R (eyebrow ban is absolute) |
| typeset | 92 | "A kicker or eyebrow label above each heading in place of a heading that carries its own weight." → "Any kicker or eyebrow label above a heading; [craft](craft.md) bans it outright. Let the heading carry its own weight." | R + L |

## Coverage maps

| Map | Change |
|---|---|
| docs/coverage/operate.md | rows 19–21: "Finish › step N" → "Verify › step N" (heading rename) |

All other mapped lines (audit, craft, distill, ios, new-work, overdrive, polish, reference-policy) still sit where their maps point; craft's Typography row still lists the numbers the shortened bullet states.

## Checked and left unchanged

- **Links:** every `[name](name.md)` already resolved; reference-policy already had no links.
- **Language:** no hedge words, no product names outside line-1 provenance, and every script command uses `node scripts/materials.mjs …` / `node scripts/references.mjs …` with flags the scripts accept (`--platform`, `--limit`, `--category`, `--json`).
- **Synonyms kept on purpose:** android keeps Material's "snackbar" (platform term; it already contrasts it with a toast). "Modal" stays wherever the sentence is about modality (craft, operate, distill, delight, onboard). "Placeholder" stays where it means input placeholder text or a sized asset fallback. DESIGN.md stays named where the rule is about that file (new-work, reference-policy: never overwrite it). new-work's "development brief" names an existing project document.
- **Defaults already consistent:** contrast (4.5:1 / 3:1) in craft, colorize, audit, operate, polish, bolder, quieter, typeset, critique, ios, android; touch targets in craft, audit, operate, polish, critique, ios, android, adapt; motion durations in animate, operate, delight, android (Material tokens are platform defaults); Core Web Vitals only in optimize; test widths 375 / 768 / 1440 (+320) in audit, bolder, critique, new-work, operate, polish, craft, with adapt's wider responsive matrix as its own authority.
- **Headings:** descriptive variants (`Verify on the simulator`, `Verify the actual experience`, numbered workflow steps in new-work and polish, audit/critique `Report`) kept; they name a different kind of verification, not drift.
- **Hand-offs already present:** adapt, android, animate, bolder, clarify, colorize, delight, harden, layout, onboard, optimize, quieter, typeset ("continue with polish"); audit ("For fixes, point to …"); critique ("After the user answers"); distill ("Hand off to polish").
