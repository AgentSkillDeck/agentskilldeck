<!-- Adapted from Impeccable reference/ios.md and reference/audit.native.md @ d631a88 (Apache-2.0) and uizze ui-design reference/ios.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Native iOS interfaces

Use this guide alongside the task's main guide for any iOS or iPadOS app: SwiftUI, UIKit, React Native, Expo or Flutter on Apple hardware.

Follow the product's existing iOS conventions first, then Apple's Human Interface Guidelines. A native interface should feel predictable before it feels distinctive. Brand expresses through the layers the platform leaves open: tint, type in display moments, motion, content. The test: would a fluent iPhone user trust this app, or pause at controls that feel ported from a website (reinvented navigation bars, custom back gestures, web-shaped buttons, hover-dependent affordances)? Look up the relevant HIG page with `node scripts/references.mjs "<component or pattern>" --platform ios`.

## Structure and navigation

- Navigation stack for hierarchy; tab bar for 2–5 top-level destinations (sections, never actions); sheets for self-contained tasks. No custom global navigation and no mixed metaphors.
- Preserve the left-edge swipe-back gesture; never disable or cover it.
- Lay out inside the safe area: no controls under the notch, Dynamic Island, home indicator or rounded corners. Backgrounds may extend edge to edge.
- Large titles on top-level screens, collapsing to inline on scroll; detail screens use inline titles.
- Modality is deliberate: a sheet for a focused, dismissible sub-task, a full-screen cover for immersion. Give clear Cancel/Done, and keep swipe-to-dismiss unless dismissal would lose data (then confirm).
- Settings-shaped content uses grouped or inset-grouped lists, not bespoke card stacks.
- On iPad, use size classes; never ship a scaled-up phone layout. Support Split View and both orientations unless there is a reason not to.

## Controls

- Prefer native controls, materials, menus, alerts, sheets, pickers and text behaviour: switch, segmented control, stepper, system pickers, action sheets, context menus, swipe actions. Use a custom set only when the product already has a coherent custom system.
- SF Symbols for icons, matched to text weight and scale; do not mix in a web icon set.
- Touch targets ≥ 44×44 pt with spacing between adjacent targets.
- Every control has an accessibility label, trait and state; VoiceOver order follows the visual order and focus is not lost on navigation.

## Type, colour and materials

- Use system text styles (Large Title through Caption) so Dynamic Type works; no hard-coded point sizes. Body is 17 pt; nothing below 11 pt. Layouts must not clip or overlap at the largest accessibility sizes.
- San Francisco carries body, labels and controls; a brand face may appear in display moments.
- Semantic system colours (`label`, `secondaryLabel`, `systemBackground`, `separator`, tint) instead of raw hex, so Dark Mode and Increase Contrast work.
- Design and test Dark Mode as a first-class appearance; contrast ≥ 4.5:1 for text in both.
- One tint colour drives interactive elements; decoration is not its job.
- System materials for blur behind bars and sheets; no hand-rolled glass effects.

## Behaviour and motion

- Account for the keyboard (inputs stay visible above it), long content, Dynamic Type, Reduce Motion, Dark Mode and device insets.
- System transitions: push slides in, sheets rise, dismiss reverses the entrance. Custom transitions must not fight the navigation model.
- With Reduce Motion on, replace parallax and large slides with crossfades.
- Keep scroll and gesture paths off the main thread's heavy work; use recycling lists (`List`, `LazyVStack`, `FlatList`) for long content.

## States

Include the states the task requires: loading, empty, error, success, permission denied, offline, disabled and recovery where applicable. Feedback is immediate (pressed state, haptic where the platform uses one, progress for anything over ~1 s) and never depends on colour alone.

## Verify on the simulator

When a simulator or runnable build is available:

1. Build and run, then capture with `xcrun simctl io booted screenshot <path>`. With several simulators booted, use the UDID from `xcrun simctl list devices booted` instead of `booted`.
2. Capture each shipped device class: at least one small iPhone, one large iPhone, and one iPad if iPad is a target.
3. Repeat in dark appearance (`xcrun simctl ui booted appearance dark`) and at a large Dynamic Type size.
4. Fix observable clipping, overlap, safe-area violations, unreadable text, broken navigation or inaccessible controls. Recheck the affected states after fixes.
5. Screenshots come from the simulator, never a browser. Simulators prove layout; gestures, haptics and performance need hardware. Say which produced the evidence.

If the environment cannot run the UI, say that visual and device verification remains incomplete. Do not require unavailable tooling, and do not claim a pass.

For an explicit ambitious-interaction request, combine this guide with [overdrive](overdrive.md). Use native continuity and responsive feedback, not web-only effects or novelty that interferes with platform navigation. Respect Reduce Motion and keep an equally usable non-animated path.

## Common failures

- A custom tab bar or navigation bar replacing the system one.
- Edge-swipe back disabled or overridden.
- Hard-coded font sizes that ignore Dynamic Type.
- Raw hex colours that break in Dark Mode.
- Web-shaped buttons, custom toggles or hover-only affordances.
- Content under the home indicator or behind the keyboard.
- A phone layout stretched across an iPad.
