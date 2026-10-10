<!-- Adapted from Impeccable reference/audit.md and reference/audit.native.md @ d631a88 (Apache-2.0) and uizze ui-design reference/audit.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Audit an implemented interface

Use this guide when the user explicitly asks for an audit or technical quality check of a built interface, web or native.

An audit is read-only: it does not modify the product unless the user also asked for fixes. Review only what can be observed in the code or the rendered result. Do not invent missing requirements or turn personal taste into a defect; design judgment belongs in [critique](critique.md).

## Gather evidence

1. Read the relevant source, tokens and components.
2. Run the interface: web in the host's browser at 375, 768 and 1440 px wide plus any size the user reported; native on the simulator or emulator for each shipped device class, in light and dark appearance and at a large text size (see [ios](ios.md), [android](android.md)).
3. Exercise the task and its states: loading, empty, error, success, disabled, recovery, long content.
4. Run what the project already has: tests, linters, type checks, an accessibility checker if installed. Do not install new tooling for the audit.
5. Record which checks ran and which could not, with the reason.

## Inspect

Check each dimension and score it 0–4 (0 broken, 1 major gaps, 2 partial, 3 good with minor gaps, 4 excellent):

1. **Task and system.** Task clarity and hierarchy; consistency with the product's existing system; repeated shortcuts or decorative content that conflict with the product; hard-coded colours and values instead of tokens; dark theme or dark appearance broken or poorly contrasted.
2. **Accessibility.** Text contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI components, in every theme and state; visible focus, logical tab or reading order, no keyboard traps; labels, roles and states on every control (web: semantic elements, not clickable `div`s; native: VoiceOver/TalkBack labels and traits); headings and landmarks; alt text; form labels, required markers and error messages; text scaling (200% zoom on web; Dynamic Type or `sp` on native) without clipping; reduced motion handled with an alternative that still shows the state change, not a global kill switch.
3. **Layout and responsiveness.** Overflow and horizontal scroll at 375 px (and 320 px); fixed widths; media aspect ratio and cropping; target size ≥ 24×24 CSS px web (≥ 44×44 for primary touch controls), ≥ 44×44 pt iOS, ≥ 48×48 dp Android; touch gestures on sliders, drag surfaces and scroll strips (mouse-only handlers, missing `touch-action`, drag state not cleared on cancel); native: safe-area and keyboard insets, orientation, tablet and split-screen layouts.
   - **Native platform conformance** (iOS and Android; score it with this dimension):
     - system navigation, not custom global nav; no overloaded tab bars;
     - no iOS patterns on Android or Android patterns on iOS;
     - platform controls, not web-shaped buttons, custom toggles or hover-dependent affordances;
     - one icon system: SF Symbols on iOS, Material Symbols on Android, no mixed sets;
     - edge-swipe back (iOS) intact and predictive Back (Android) not hijacked;
     - Android 12+ Dynamic Color has a static fallback scheme;
     - the verdict: does it read as a native app or a ported website?
4. **Interaction and states.** Feedback for every action; the necessary loading, empty, error, success, disabled and recovery states; overlays clipped by overflow containers; destructive actions without confirmation or undo.
5. **Performance visible in the experience.** Layout shift, slow first render or launch, janky scroll or animation (animating layout properties, unbounded blur or shadow, `will-change` left on everywhere), unvirtualised long lists, images without dimensions, lazy loading or caching, full-size images decoded for thumbnails, obviously unused heavy dependencies.

## Report

Lead with the most important finding, and do not hide additional release-blocking defects behind it. Order findings by user impact and tag each:

- **P0 Blocking:** prevents task completion, loses data or locks out a required user group; fix immediately.
- **P1 Major:** significant difficulty, a broken brief requirement, WCAG AA failure or platform-guideline violation; fix before release.
- **P2 Minor:** annoyance with a workaround; fix in the next pass.
- **P3 Polish:** no real user impact. Keep P3s few; noise hides what matters.

Torn between two levels? Ask "would a user contact support about this?" If yes, it is at least P1.

For each finding give: the observed screen or state, the location (file and line where known), the evidence (measurement, screenshot, failing step), the user impact, the standard it breaks if any (WCAG criterion, HIG, Material), and the smallest concrete correction. Mark each as **confirmed** or **suspected (could not verify)**; never report an unverified suspicion as a defect.

Then add:

- a score table (five dimensions, total out of 20; 18–20 excellent, 14–17 good, 10–13 acceptable, 6–9 poor, 0–5 critical);
- systemic patterns ("hard-coded colours in 15+ components", "list-row targets consistently below 44 pt");
- what works well and should be kept;
- the checks that could not run.

If nothing material is visible, say so, stated at the scope actually inspected ("no material issues on the checkout flow at 375, 768 and 1440 px; native builds not run"). For fixes, point to [polish](polish.md), [harden](harden.md), [optimize](optimize.md) or [adapt](adapt.md).

## Common failures

- Reporting taste ("the blue feels cold") as a defect.
- Generic advice ("improve accessibility") with no location or fix.
- Everything marked P0, or no prioritisation.
- Unverified false positives presented as confirmed.
- Passing a check that could not run.
- Editing code during a read-only audit.
