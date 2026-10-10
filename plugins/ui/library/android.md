<!-- Adapted from Impeccable reference/android.md @ d631a88 (Apache-2.0), itself distilled from ehmo/platform-design-skills (MIT, https://github.com/ehmo/platform-design-skills); modified by agentatelier -->
# Android

Use this guide when building or reviewing a native Android app: Jetpack Compose, Android Views, React Native, Expo or Flutter shipping to Android hardware.

On native, Material Design 3 governs structure, navigation and interaction on every surface type. The brand expresses itself through Material's theming (colour roles, type scale, shape, motion), not by replacing its components. A cross-platform app that also ships to iPhone still owes iOS its guarantees on that hardware (safe areas, Reduce Motion, edge-swipe back); see [ios](ios.md).

## The Android test

Would a fluent Android user trust this app, or trip on off-spec components? The most common tell is an iOS app wearing Android's skin: a bottom-only tab bar copied from iPhone, a back arrow that ignores system Back, Cupertino switches and alert dialogs. Material 3 is the rulebook; follow its components and theme the brand through it.

## Assess first

Read the theme setup (`MaterialTheme`, `colorScheme`, `Typography`, `Shapes`, or the framework's equivalent), the navigation graph and the shared components. Then build, install and run the app on an emulator or device and capture the main screens (see Verify). Note every hard-coded colour, `px`/`dp` text size, custom control and screen that draws under the system bars.

## Layout and structure

- **Navigation matched to window size.** Use window size classes: compact (under 600dp wide) gets a navigation bar with 3–5 destinations; medium (600–839dp) a navigation rail; expanded (840–1199dp) a rail or a permanent drawer; large (1200–1599dp) and extra-large (1600dp and up) a rail or permanent drawer with multi-pane layouts. Never ship the phone bottom bar untouched on a tablet or foldable.
- **System Back always works.** Honour the Back gesture and button, including predictive back (opt in with `android:enableOnBackInvokedCallback="true"`; use `BackHandler`/`PredictiveBackHandler` in Compose, `OnBackPressedCallback` in Views (`OnBackAnimationCallback` for custom progress), `PopScope` in Flutter). React Native's `BackHandler` handles Back but does not drive predictive-back animations. Enable a back handler only while there is something to close (e.g. `BackHandler(enabled = sheetOpen)`); an always-enabled callback disables the system predictive back-to-home animation. Back closes the top sheet, dialog or search first, then moves up the stack. Never trap the user or hijack the gesture.
- **Edge-to-edge with window insets.** Edge-to-edge is enforced when targeting SDK 35+ on Android 15+; call `enableEdgeToEdge()` for older versions and for system-bar styling. Apply status bar, navigation bar, display cutout and IME insets (`WindowInsets.safeDrawing`, `Modifier.imePadding()` in Compose; `react-native-safe-area-context`; `SafeArea` in Flutter). Content and the focused field never hide behind system bars or the keyboard.
- **Top app bar for screen context**; pair it with a FAB only when the screen has a single primary action.

## Touch targets

- **48×48dp minimum** for every touch target, with at least 8dp between targets. The visible icon can be 24dp; the hit area cannot. In Compose, Material components enforce this through `minimumInteractiveComponentSize()`; keep it on custom controls.

## Typography

- **Material type scale:** Display, Headline, Title, Body and Label roles, each in large, medium and small. Map text to roles; never hand-pick sizes per screen. See [typeset](typeset.md) for hierarchy rules.
- **Roboto is the system face.** Theme a brand face in through the type scale, keeping body text, labels and controls legible and consistent.
- **`sp`, never fixed `px` or `dp`, for text**, so type follows the system font-size setting. Android 14+ scales nonlinearly up to 200%; layouts must wrap or scroll, never clip.

## Colour and theming

- **Material colour roles** (primary, onPrimary, surface, surfaceVariant, surfaceContainer levels, secondaryContainer, outline, error). Role tokens resolve light, dark and contrast variants automatically; raw hex breaks there. See [colorize](colorize.md).
- **Dynamic colour (Material You) where it fits:** derive the scheme from the wallpaper on Android 12+ (`dynamicLightColorScheme`/`dynamicDarkColorScheme`), with a static brand scheme as the fallback. Where brand recognition matters more, keep the static scheme and say so.
- **Dark theme is a first-class scheme.** Design and test it; never a quick invert.
- **Tonal elevation.** Show elevation with the standard surface container levels (plus shadow only where Material uses it); no arbitrary drop shadows.
- Text contrast stays at least 4.5:1 (3:1 for large text and UI parts) in both schemes and under dynamic colour.

## Components and motion

- **Material components:** filled, tonal, outlined and text buttons; FAB; switches; chips; snackbars; bottom sheets; Material dialogs; navigation bar, rail and drawer. Never port iOS controls or invent equivalents.
- **One FAB, one primary action.** Never stack FABs or spend one on a secondary task.
- **Snackbars for transient feedback**, with an action (for example Undo) when useful; never a toast for that. Dialogs only for decisions that must interrupt.
- **Material motion patterns:** container transform, shared axis and fade through, with Material easing (emphasised for most transitions) and duration tokens (short 50–200ms, medium 250–400ms, long 450–600ms). Project motion tokens override these defaults. See [animate](animate.md).
- **Honour Remove animations** (animator duration scale 0): replace movement with a crossfade or an instant cut, and never wait on an animation to finish before enabling input.

## Accessibility

- Every icon-only control has a `contentDescription` (or `accessibilityLabel`/`Semantics` label); decorative images have none.
- TalkBack reads screens in a sensible order; group related text with `Modifier.semantics(mergeDescendants = true)` or the framework's equivalent.
- State changes that matter (errors, completed actions) are announced, for example with a live region or a snackbar.

## Verify

- **Screenshots come from the emulator or a connected device, never a browser.** Build and install, then capture with `adb exec-out screencap -p > <path>` (choose a device with `adb -s <serial>` when several are attached). Capture every device class the app ships to: at least one phone and, when tablets or foldables are targets, one large screen.
- **Dark theme and font scale belong in the pass.** `adb shell cmd uimode night yes` flips the theme (`no` restores it). `adb shell settings put system font_scale 1.3`, then `2.0`, catches clipped labels; restore `1.0` afterwards. With several devices attached, add `-s <serial>` to these commands too.
- **Motion off:** set `animator_duration_scale`, `transition_animation_scale` and `window_animation_scale` to 0 with `adb shell settings put global <name> 0` (restore all three to `1` afterwards) and check that every transition still completes and nothing waits on an animation.
- **Back and insets:** press Back from every sheet, dialog and nested screen; open the keyboard on every form; rotate the device or resize the window.
- **TalkBack:** walk the primary flow with TalkBack on; note unlabelled or out-of-order elements.
- Run the project's UI and screenshot tests if they exist.
- **Emulators give breadth; gestures, refresh rate and performance need hardware.** Say which one produced each piece of evidence.

When the platform rules hold, continue with [polish](polish.md).

## Common failures

- An iOS-styled app on Android: Cupertino switches, iOS alerts, a custom back chevron.
- Phone navigation bar stretched across a tablet instead of a rail or drawer.
- Back that exits the app from a sheet, or a screen that swallows Back.
- Content under the status bar, navigation bar or keyboard after enabling edge-to-edge.
- Text sized in `dp`/`px` that ignores font scale, or layouts that clip at 1.3× and 2.0×.
- Raw hex colours that break dark theme and dynamic colour.
- Several FABs, or a FAB for a secondary action.
- Screenshots taken from a browser preview and reported as Android verification.
