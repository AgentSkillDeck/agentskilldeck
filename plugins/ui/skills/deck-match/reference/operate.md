<!-- Adapted from Impeccable reference/operate.md, reference/mode-operate.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Operate

Use this guide when building app screens, dashboards, settings, tables, admin panels and tools: anywhere the user arrives to get a job done.

On these surfaces the design serves the task. The test is whether someone who already uses tools like this can trust the screen at once, or has to stop at every slightly unusual control. The usual failure is not plainness but strangeness without purpose.

## Start from the task

- List the user's frequent jobs and rank them by how often they happen. The most frequent job gets the most direct path.
- For each job, name the state the user needs to see: what changed, what needs attention, what is in progress, what failed.
- Lay out the shell first: navigation, the work areas and what each is for, and the data read first. Expression comes after and never hides the task or the state.

## Match density to the work

- Dense is fine when the work is dense. Tables with many rows, panels with many fields and compact lists are legitimate.
- Filters sit next to what they scope and show what is applied. Offer a clear way to reset them.
- Bulk actions appear when items are selected, say how many are affected, and confirm only destructive or irreversible ones.
- Type usually needs one well-tuned sans on a fixed rem scale with small steps; see [typeset](typeset.md). Prose inside a tool still keeps a readable measure.

## Prefer familiar patterns

- Use standard navigation (top bar with side navigation, tabs, breadcrumbs, command palette) and standard controls (buttons, inputs, selects, sortable tables).
- Keep one component vocabulary: if "Save" looks different on two screens, one is wrong.
- Colour is restrained by default and does real jobs: primary action, current selection, state and data series. See [colorize](colorize.md).
- Motion conveys state change and feedback, short and quick; no choreographed page loads. See [animate](animate.md).

## Navigation and wayfinding

- The user can always tell where they are: current item marked in the navigation, a page title that matches it, breadcrumbs for deep hierarchies.
- URLs reflect the view, including filters and tabs, so it can be shared and survives a reload.
- Back returns to the previous view with scroll position and filters kept.

## Data display

- Align text left and numbers right, with tabular numerals and consistent units and precision.
- Sortable columns show their sort direction; long values truncate with the full text available.
- Loading uses a skeleton in place of content, empty states explain what goes here and how to add it, and errors keep what did load. See [harden](harden.md).

## Forms

- Labels are visible and placed consistently. Validate inline after the user leaves a field, and on submit move focus to the first error.
- Error messages say what is wrong and how to fix it, in the product's words; see [clarify](clarify.md).
- Keep unsaved input across failures, and make save behaviour obvious (explicit save or autosave, never ambiguous).

## Keyboard and power users

- Every task completes by keyboard, in a logical tab order, with visible focus.
- Add shortcuts for frequent actions, make them discoverable (tooltips, a shortcut list), and never override browser or assistive-technology keys.
- Allow selecting many rows at once and acting on them without a round trip per item.

## Dialogs

Use a dialog only when the task needs interruption or protected focus, such as confirming a destructive action. Prefer inline editing, a side panel or a separate page. Overlays must escape clipping containers (use `<dialog>`, the popover API or a portal).

## Responsive working screens

Responsive behaviour here is structural: collapse the sidebar, turn wide tables into stacked rows or allow horizontal scroll with a fixed first column, and move secondary panels below. Follow [adapt](adapt.md).

## Verify

- Exercise the main task path end to end with real or realistic data, by mouse and by keyboard.
- Force every reachable state: loading, empty, error, partial data, long values, no permission.
- Check at 375, 768 and 1440 px, plus 320 px and any width the user reported failing.
- Fix material problems in one batch and re-inspect; at most two rounds, then report what is still open.

## Common failures

- Decorative motion or display fonts in labels, buttons and data.
- Reinvented controls for flavour that users must learn again.
- A dialog as the first answer to every edit.
- Spinners in the middle of content and "Nothing here" empty states.
- Dropdowns clipped by an `overflow: hidden` parent.
- Strong accent colour on inactive items, so nothing reads as current.

When the task path holds, continue with [polish](polish.md).
