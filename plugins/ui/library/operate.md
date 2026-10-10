<!-- Adapted from Impeccable reference/operate.md and reference/mode-operate.md @ d631a88 (Apache-2.0) and uizze ui-design reference/operate.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Product and dashboard interfaces

Use this guide for app screens, admin dashboards, settings, data tables, tools and any authenticated surface where the user is doing a task.

Product UI should disappear into the task. Familiarity is a feature: a user fluent in this category should trust every control on sight instead of pausing at components that are subtly off. The failure mode is strangeness without purpose: over-decorated buttons, mismatched form controls, gratuitous motion, display fonts on labels, invented affordances for standard tasks.

## Structure

- Make three things obvious on every screen: where the user is (title, selected nav item, breadcrumb), the primary task, and the next action.
- Match information density to the work. Dense tables, compact controls and many labelled fields are correct when users need them; decorative containers are not. Tables can run 120+ characters wide; prose stays at 65–75.
- Use standard navigation, forms, tables, tabs, menus and dialogs: top bar plus side nav, breadcrumbs, tabs, command palette. Do not replace them with novel versions. On native apps use the platform's controls ([ios](ios.md), [android](android.md)).
- Group with spacing and alignment first; add a border, card or background only when spacing cannot show the grouping.
- Keep one component vocabulary across the surface: same button shapes, same form controls, same icon set and stroke. If "Save" looks different in two places, one of them is wrong.
- Prefer inline editing or progressive disclosure to a modal. Use a modal only when the task needs interruption or protected focus.

## Expression

The product's identity enters through four channels only: type, palette, density, and one signature move. It never supplies the layout, navigation model or controls.

- Name the signature move concretely (service health drawn as a transit map, a schedule set in a timetable's column rhythm) and put it where it carries data. A direction that shows up only as a colour scheme has not found its move.
- Never costume the screen as a tool the audience knows: no terminal function-key bars, instrument bezels or ruled-ledger tables standing in for real components. If an engineer could not build it from standard components, it is a picture of the tool.
- The finish bar is the best product in the category: aligned grid, consistent spacing, a real type scale, clear hierarchy. The signature move adds to a screen that is already that clean.

## Type and colour

- One well-tuned sans family usually carries headings, buttons, labels, body and data. No display faces in labels, buttons or data.
- Fixed rem scale, not fluid `clamp()` headings; step ratio 1.125–1.2.
- Tabular numerals (`font-variant-numeric: tabular-nums`) in columns of figures.
- Colour defaults to Restrained, and it still does real jobs: a tinted shell (rail or header), state colours, data series, selection. A grey screen with one accent is the category default without the category's polish.
- Accent marks primary actions, current selection and state only, never decoration. Inactive states never carry full-saturation colour.
- Use a second neutral layer, slightly warmer or cooler than the content surface, for sidebars, toolbars and panels.
- Standardise the state vocabulary as tokens: hover, focus, active, disabled, selected, loading, error, warning, success, info. State colours (red critical, amber degraded) appear only where they carry meaning, never as the only signal.

## States and behaviour

- Cover every state the product can reach: loading, empty, error, success, disabled, selected, expanded and recovery. Every interactive component has default, hover, focus, active, disabled, loading and error.
- Loading: skeletons shaped like the content, not a spinner in the middle of the page.
- Empty: teach the next action ("No invoices yet. Create one or import a CSV"), never just "Nothing here".
- Error: name the problem and the recovery; keep the user's input.
- Keep focus visible, every control labelled, text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components), and targets ≥ 24×24 CSS px on web (≥ 44×44 for primary touch controls), ≥ 44×44 pt on iOS, ≥ 48×48 dp on Android.
- Overlays and menus escape their container. A dropdown inside an `overflow: hidden` or `overflow: auto` ancestor gets clipped: use `<dialog>`, the popover API, `position: fixed` or a portal.
- Motion only for state change, feedback, loading and reveal, at 150–250 ms. No choreographed page-load sequences; the product loads into a task.
- A headline number that changes over time shows its recent history, with the moment of change marked.
- Make responsive changes structural: collapse the sidebar to a drawer or rail, reflow groups, turn wide tables into scrollable or stacked rows, and keep important actions reachable at every width. Do not rely on fluid typography.

## Finish

1. Use the interface with the host's browser or simulator at representative sizes (web: 390, 768 and 1440 px wide), with realistic data, long names and an empty data set.
2. Cover the product name: does it still read as a working product of its category, can the user do the task, and is it at least as clean as the category standard?
3. Fix the few observable issues that obstruct the task or break consistency, in one batch, and recheck them.
4. Do not redesign working areas outside the requested scope.

## Common failures

- Decorative motion, or a page-load animation the user has to watch.
- The same action styled differently on two screens.
- Display or monospace fonts used as costume on labels and data.
- Reinvented standard affordances: custom scrollbars, unusual form controls, non-standard modals.
- A modal as the first answer to every sub-task.
- Spinners in place of content and empty states that say only "No data".
- Dropdowns clipped by a scroll container.
