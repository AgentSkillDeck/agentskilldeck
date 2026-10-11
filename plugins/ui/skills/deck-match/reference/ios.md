<!-- Adapted from Impeccable reference/ios.md, reference/audit.native.md @ d631a88 (Apache-2.0), itself distilled from ehmo/platform-design-skills (MIT, https://github.com/ehmo/platform-design-skills); modified by agentskilldeck -->
# iOS

Use this guide when building or reviewing any iOS or iPadOS app (SwiftUI, UIKit, React Native, Expo or Flutter shipping to Apple hardware), alongside the guide for the main task.

Apple's Human Interface Guidelines govern structure, navigation and interaction. The brand speaks through what the platform leaves open: tint, type in display moments, imagery, motion and content. A cross-platform app that also ships to Android owes Android its own rules on that hardware; see [android](android.md).

## The iOS test

Would someone who uses an iPhone every day trust this app, or hesitate at controls that feel off? The usual tell is a website in an app wrapper: a home-made navigation bar, a back button that ignores the swipe, web-style buttons, affordances that only appear on hover. Default to system components and depart only for a reason the user would thank you for.

## Respect an established system

If the product already has a deliberate custom design system on iOS (its own controls, type and colour, used consistently), keep it. Do not swap it for stock components. Apply the rules below where the system is silent, and flag any place it breaks a platform guarantee (back gesture, safe areas, Dynamic Type, VoiceOver).

## Navigation and structure

- Navigation stack for hierarchy, with the standard back button and the left-edge swipe back. Never disable or cover that gesture.
- Tab bar for two to five top-level sections. Tabs are places, never actions.
- Sheets for self-contained tasks, with clear Cancel and Done; allow swipe-to-dismiss unless unsaved data needs a confirmation.
- Large titles on top-level screens that collapse on scroll; detail screens use inline titles.
- Grouped or inset lists for settings-style content.

## Text and Dynamic Type

- Use the system text styles (Large Title through Caption 2) so text follows the user's chosen size. Body is 17 pt; nothing goes below 11 pt.
- San Francisco carries body text, labels and controls. A brand face can appear in display moments.
- Test at the largest accessibility sizes. Text wraps or the layout reflows; nothing truncates critical content or overlaps.
- For type hierarchy, see [typeset](typeset.md).

## Icons, colour and appearance

- SF Symbols for interface icons; they align to text and scale with Dynamic Type. Do not mix in a web icon set.
- System colours (label, secondaryLabel, systemBackground, separator, tint) adapt to dark mode and increased contrast; raw hex values break there.
- One tint colour marks interactive elements. Dark mode is designed and tested, not inverted.
- Use system materials for translucency behind bars and sheets.

## Layout and touch

- Lay out inside the safe area. Nothing interactive sits under the notch, Dynamic Island, rounded corners or home indicator.
- Every tappable control is at least 44×44 pt, with space between neighbours.
- Avoid placing gestures at the bottom edge where they compete with the home indicator.

## Feedback and permissions

- Haptics are sparing: confirm a meaningful result (success, failure, a snap into place), never every tap. Use the system feedback generators.
- Ask for a permission at the moment the feature needs it, after explaining why in the app's own words. Handle refusal with a usable path and a way to change the setting later.
- Honour Reduce Motion: crossfade instead of parallax or large slides. See [animate](animate.md).

## Keyboard, iPad and multitasking

- Forms scroll the focused field above the keyboard, use the right keyboard type and return key, and support autofill.
- On iPad, support hardware keyboard shortcuts for common actions, pointer hover states on controls, and Split View and Slide Over without clipping. Use size classes rather than stretching the phone layout.

## VoiceOver

- Every icon-only control has a label; decorative images are hidden from VoiceOver.
- Reading order follows the visual order; related elements are grouped; state changes are announced.

## Verify

- Screenshots come from the Simulator or a device, never a browser. Capture with `xcrun simctl io booted screenshot <path>`; with several simulators running, use the UDID from `xcrun simctl list devices booted` instead of `booted`.
- Cover each device class the app ships to: at least one iPhone, and an iPad when iPad is a target.
- Include dark mode (`xcrun simctl ui booted appearance dark`), the largest accessibility text size, Reduce Motion, and a VoiceOver walk through the primary flow.
- The Simulator gives breadth; gestures, haptics and performance need hardware. Say which produced each piece of evidence.
- Fix material problems in one batch, re-inspect, and stop after two inspection rounds with what is still open.

When the platform rules hold, continue with [polish](polish.md).
