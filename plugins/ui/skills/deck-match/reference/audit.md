<!-- Adapted from Impeccable reference/audit.md, reference/audit.native.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Audit

Use this guide when the user asks for an explicit technical quality check of an interface that is already built: accessibility, performance, responsive behaviour, states, theming and platform conformance.

An audit measures and reports. It is read-only unless the user asked for fixes; do not edit files while auditing. Design judgement (is this generic, does it fit the brief) belongs to [critique](critique.md). This guide owns the severity scale that critique and the other guides use.

## Scope and environment

- Name the target: the screens, flows or components in scope, and what is out of scope.
- Record the environment: URL or build, browser or simulator and version, device or viewport, light or dark appearance, and any feature flags or test accounts used.
- Run the interface. Read the source for what the render cannot show, but base findings on what actually happens.
- For native apps, audit from the built app on a simulator, emulator or device, and read [ios](ios.md) or [android](android.md) first; both when the app ships to both.

## Checks by area

### Accessibility

- Contrast: body text at least 4.5:1, large text and UI parts at least 3:1, in every theme.
- Keyboard: every action reachable and operable, no traps, Esc closes dialogs and menus.
- Focus: visible indicator on every focusable element; order follows reading order; focus moves into a dialog and returns to its trigger.
- Labels and names: every input has a label; icon-only controls have an accessible name; screen readers announce role, name and state correctly.
- Semantics: real buttons and links, one logical heading outline, landmarks present, images with useful alt text or marked decorative.
- Reduced motion: movement replaced by an alternative that still shows the change; nothing flashes above safe thresholds.
- Touch targets: 24×24 CSS px minimum on web, 44 px for primary touch controls (44 pt on iOS, 48 dp on Android).

### Performance

- Layout shift during load and after interaction (images without dimensions, late fonts, injected banners).
- Load: time to first meaningful render, oversized images, unused code, render-blocking resources.
- Input lag: typing, scrolling and dragging stay responsive; no long tasks on the main thread during input. See [optimize](optimize.md) for remedies.

### Responsive

Render at 375, 768 and 1440 px, plus 320 px and any width the user reported failing. Look for horizontal scroll, clipped or overlapping content, unreachable controls, and layouts that break at 200% text zoom. Exercise custom gestures under touch, not just the layout at a narrow viewport.

### States

Force loading, empty, error, partial, long-content, offline and permission states and record what renders. The checklist and remedies live in [harden](harden.md).

### Theming and dark mode

Check hard-coded colours that bypass tokens, contrast in the dark theme, values that do not update when the theme switches, and images or icons that disappear on a dark surface.

### Native specifics

Check system back and edge-swipe gestures, safe areas and system-bar insets, text scaling (Dynamic Type or `sp`), platform controls and icons, VoiceOver or TalkBack order and labels, and tablet or multi-window layouts. The platform rules are in [ios](ios.md) and [android](android.md).

## Severity scale

Tag every finding with one level:

- **P0 blocking**: prevents task completion, loses data or locks out a required user group.
- **P1 major**: significant difficulty, a clear accessibility failure or a platform-guideline violation. Fix before release.
- **P2 minor**: an annoyance with a workaround. Fix in the next pass.
- **P3 polish**: no real impact on use. Fix when time allows.

Tie-breaker: would a user contact support about this? If yes, at least P1.

Not everything is P0. A long list of P3s hides the findings that matter; group them.

## Report

Lead with a short summary: scope, environment, counts by severity and the three to five findings that matter most. Then list each finding:

- **Finding**: what is wrong, in one sentence.
- **Evidence and location**: screenshot, measured value, reproduction steps, and the file, component or screen.
- **Severity**: P0–P3 on the scale above.
- **Fix**: a specific change, and the guide that covers it when one does.

Add patterns that recur across screens as one systemic finding rather than many copies, and note what is working well so it is kept.

## What was not checked

List every check that could not run and why (no device, no screen reader, no test account, service unavailable). Never write "pass" for an area you did not verify; say "not checked" instead. State which evidence came from emulation and which from real hardware.

## Hand-off

If the user asked only for the audit, return the report and go back to the task. If fixes were requested, fix material problems in one batch using the guides named in the findings (for example [harden](harden.md), [optimize](optimize.md), [adapt](adapt.md)), re-inspect, stop after two inspection rounds and report what is still open.
