<!-- Adapted from Impeccable reference/adapt.md and reference/adapt.native.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Adapt

Use this guide when an existing design must work in a different context: another screen size, input method, device class, orientation, platform (iOS, Android, web), or medium (print, email).

Adaptation is rethinking the experience for the new context, not scaling pixels. Keep the information architecture and the visual world; change structure, navigation, controls and density to fit where and how the interface is used. Spatial rules (grouping, rhythm, spacing scale, touch-target minimums) live in [layout](layout.md); do not restate them here.

Context you need: target platforms and devices, and usage context (one-handed on the go, focused at a desk, glanced at on a wall). Infer them from the brief, design notes (for example `DESIGN.md`), the build targets and analytics before asking.

## Assess first

Read the layout code, breakpoints, navigation components and platform targets. Run the app in the source context and the target context with the host's browser or simulator tool, and write down:

- **Source assumptions:** what it was designed for (desktop web, portrait phone, one platform's idioms, a website) and what that assumed (large screen, mouse, hover, fast connection).
- **Target context:** device class, input (touch, mouse, keyboard, stylus, remote), screen and orientation, connection, posture, platform expectations.
- **What breaks:** content that does not fit; interactions that do not exist there (hover on touch, right-click on phone, edge-swipe on web); patterns that are wrong there (desktop-sized dialogs on phone, phone sheets stretched on a tablet).
- **What works:** keep it.

## Web: plan by context

### Desktop to phone

- Single column; stack side-by-side regions in priority order.
- Navigation: bottom bar for 3–5 top-level destinations in app-like products; a drawer for more; keep the same destinations as desktop.
- Controls in thumb reach (lower half); primary action reachable without stretching.
- Every touch control gives immediate visible feedback on press (`:active` state, highlight or ripple per platform) within about 100 ms.
- Bottom sheets instead of dropdowns and popovers for choices longer than a few items.
- Progressive disclosure for secondary content (tabs, `<details>`), but never hide a core capability. If it matters on desktop, make it work on phone.
- Tables: keep a horizontally scrolling table with a sticky first column when comparison matters; convert rows to cards with `data-label` headers when each row is read alone.
- Inputs: correct `type` and `inputmode` for the mobile keyboard; 16px minimum input text so iOS Safari does not zoom on focus.

### Tablet

- Two panes, not one stretched column or three cramped ones: list + detail, content + side panel.
- Restructure on orientation: portrait may collapse the side panel; landscape shows both.
- Support touch and pointer together; keep touch-size targets while allowing denser layouts than phone.

### Phone to desktop

- Use the width: persistent side navigation, multiple panels, more data up front.
- A large screen is not a powerful device: older laptops, low-power modes and assistive tech still need a light, fast page. Many desktops also have touch.
- Cap reading and form widths (`max-width` in `ch` or a container token); do not stretch to 4K.
- Add what desktop users expect: hover detail, keyboard shortcuts, context menus, multi-select with Shift / Cmd, drag and drop where it helps. Each one is an enhancement; the same task still works without it.

### Print

- `@media print`: hide navigation, controls and decoration; show full URLs after links (`a[href^="http"]::after { content: " (" attr(href) ")" }`) and expand collapsed sections.
- Set page margins with `@page` (about 2cm; wider on the binding edge for bound documents), and add page numbers, the page title and print date where the medium supports them.
- Break pages at logical points (`break-inside: avoid` on cards, figures, table rows); repeat table headers.
- Ensure black-on-white legibility and print-friendly charts (patterns or labels, not colour alone).

### Email

- 600px maximum width, single column, table-based layout with inline CSS; no external stylesheets, scripts or reliable hover.
- Large button-style primary actions with bulletproof (table cell) fallbacks; deep-link into the app for anything interactive.
- Test light and dark client rendering; images may be blocked, so alt text carries the message.

## Web: implement

- **Mobile-first CSS:** base styles for the narrowest context, then `min-width` queries to add structure.
- **Content-driven breakpoints:** start narrow, widen until the design breaks, break there. Default starting points: 640, 768 and 1024px; project tokens override this default. Three usually suffice.
- **Container queries** for components that appear at different widths; viewport queries for page structure.
- **`clamp()`** for fluid spacing and display type between breakpoints (dense product UI keeps fixed sizes; see [typeset](typeset.md)).
- **Detect input, not screen size.** A touch laptop and a keyboard tablet both exist:

```css
@media (pointer: coarse) { .control { min-block-size: 44px; } }
.row-actions { opacity: 1; } /* visible by default: touch, keyboard, unknown input */
@media (hover: hover) and (pointer: fine) {
  .row-actions { opacity: 0; }
  .row:hover .row-actions, .row:focus-within .row-actions { opacity: 1; }
}
```

- **Safe areas:** add `viewport-fit=cover` to the viewport meta, then pad edges with `max(1rem, env(safe-area-inset-bottom))` (and the other insets) on fixed bars and full-bleed regions.
- **Viewport units:** use `dvh` / `svh` instead of `vh` for full-height layouts so mobile browser chrome and the on-screen keyboard do not cut content off.
- **Responsive images:** `srcset` with `w` descriptors plus an accurate `sizes`; `<picture>` only for art direction (different crops). Image performance belongs to [optimize](optimize.md).
- `display: none` hides but still downloads and runs; do not use it to ship a different product per breakpoint.
- One codebase, one information architecture. No user-agent sniffing; use feature detection.

## Native: plan by context

Work inside the platform conventions in [ios](ios.md) and [android](android.md). Read the target platform's guide before planning.

### Phone to tablet and large screens

- Restructure, do not stretch. Switch structure on size classes (iOS) or window size classes (Android: compact < 600dp, medium 600–839dp, expanded 840dp and up; see [android](android.md)).
- Navigation changes shape: iOS tab bar may become a sidebar on iPad; Android navigation bar becomes a rail at medium width and a rail or drawer at expanded width.
- Use the width: split view / list-detail, multi-column grids, popovers where the phone used sheets.
- Multitasking is a size, not an edge case: iPad Split View, Stage Manager and Android multi-window can give a phone-width window on a tablet. Size-class-driven layout handles it.

### Orientation and foldables

- Landscape restructures (side-by-side panes, repositioned controls); never clip or letterbox. Lock orientation only when the task demands it (camera, certain games), never to dodge a layout bug.
- Foldables: respond to posture and hinge (Jetpack WindowManager); keep content off the hinge; test folded, unfolded and tabletop.

### iOS and Android

Translate idioms; never transplant them.

| iOS | Android |
|---|---|
| Tab bar | Navigation bar / rail / drawer |
| Edge-swipe back, back chevron | Predictive back gesture and system back |
| Switch, segmented control, system pickers | Material switch, chips / segmented buttons, Material pickers |
| Action sheet | Bottom sheet / dialog |
| SF Symbols, SF Pro, Dynamic Type | Material Symbols, Roboto or brand face, `sp` scaling |
| Semantic system colours, materials | Material colour roles, tonal elevation |
| System push and sheet transitions | Container transform, shared axis, fade through |

Rebuild navigation and controls in the target's vocabulary. Carry the brand's expressive layer (palette intent, type accent, motion personality) through the target's theming system.

### Web to native

Reconform, do not reflow. Replace web navigation with the platform's model, HTML-shaped controls with platform controls, hover affordances with touch-first ones, and px type with Dynamic Type or `sp`. Then hold the result to the full platform guide.

### Native: implement

- Drive structure from size classes / window size classes, never from device-model checks.
- Respect safe areas and window insets in every configuration: notch, Dynamic Island, hinge, status and navigation bars, on-screen keyboard.

## Verify

Answer each with rendered or device evidence; a bare "yes" is not verification:

- Every core task completes in every target context; nothing that matters on desktop is missing on phone.
- Web widths 320, 375, 768, 1024, 1440 and 2560px, plus the in-between widths where breakpoints switch, render without horizontal overflow or stretched reading measures.
- Portrait and landscape both restructure sensibly; native tablet split-screen and foldable postures work where shipped.
- Touch, mouse and keyboard each complete the flow; no action is reachable only by hover.
- Fixed bars clear safe areas and the on-screen keyboard; focused inputs stay visible.
- Native: each platform uses its own navigation, back behaviour and controls.
- Throttled network on the narrowest target still delivers the primary content.
- The project's target-browser matrix passes (its support list, or by default current Chrome, Safari, Firefox and Edge on the OSes shipped), including at least one WebKit engine when iOS is supported.

**Custom controls** (sliders, drag surfaces, scrollable control strips) can pass every width check and still fail to drag on iOS. Exercise each one in scope:

- **Primary gesture:** tap it, then drag it with the target input; the drag completes, not just starts.
- **Scroll across it:** a swipe along the page's scroll axis across the control scrolls the page without activating it; a drag that starts on the control along its axis moves the control, not the page. Neither failure throws an error, so try both.

**Evidence:** say what produced each result: emulated viewport, synthesized touch through the browser tool, which engine ran it (Chromium is not Safari), simulator, or physical device. Screenshots and resized viewports verify layout, never gestures, real performance, font rendering or keyboard and browser-chrome behaviour. Use simulators for breadth and at least one real phone (and tablet, if shipped) per platform for truth when available. Name what stayed untested; unreachable hardware is a reported gap, not a blocker.

When the adaptation feels native to each context, continue with [polish](polish.md).

## Common failures

- A desktop layout shrunk to phone width, or a phone layout stretched across a tablet.
- Core features hidden on small screens instead of reworked.
- Actions that only appear on hover, unreachable by touch.
- Device-model or user-agent checks instead of size classes, container queries and feature detection.
- One platform's controls and navigation transplanted onto the other.
- Fixed bars under the home indicator, notch or on-screen keyboard; `100vh` cutting content off.
- Orientation locked to avoid fixing a landscape layout.
- Gesture behaviour claimed as verified from a resized desktop browser.
