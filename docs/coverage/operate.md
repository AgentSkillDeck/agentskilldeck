# Coverage: operate

Source: uizze `skills/ui-design/reference/operate.md` @ 146928e → `plugins/ui/library/operate.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Product UI should disappear into the task. | Intro › "Product UI should disappear into the task." |
| Familiarity is a feature when users need to move quickly and trust the controls. | Intro › "Familiarity is a feature: a user fluent in this category should trust every control on sight…" |
| - Make the current location, primary task, and next action obvious. | Structure › bullet 1 (title, selected nav item, breadcrumb) |
| - Match information density to the work. Dense tables and compact controls are appropriate when users need them; decorative containers are not. | Structure › bullet 2 (adds 120+ char tables, 65–75 prose) |
| - Prefer standard navigation, forms, tables, tabs, menus, and dialogs over novel replacements. | Structure › bullet 3; Expression › "Never costume the screen…"; Common failures › "Reinvented standard affordances" |
| - Use spacing and alignment for grouping before adding borders, cards, or backgrounds. | Structure › bullet 4 |
| - Keep one component vocabulary across the surface. | Structure › bullet 5 ("If 'Save' looks different in two places…"); Common failures › bullet 2 |
| - Cover the states the product can reach: loading, empty, error, success, disabled, selected, expanded, and recovery where relevant. | States and behaviour › bullet 1 (plus per-component state set, skeleton, empty, error bullets) |
| - Keep focus visible, controls labelled, contrast readable, and targets usable. | States and behaviour › bullet "Keep focus visible, every control labelled, text contrast ≥ 4.5:1 … targets ≥ 24×24 CSS px / 44 pt / 48 dp" |
| - Prevent overlays and menus from being clipped by scroll or overflow containers. | States and behaviour › bullet "Overlays and menus escape their container" (`<dialog>`, popover, fixed, portal); Common failures › last bullet |
| - Use quick motion only for state changes and feedback. Do not choreograph routine page loads. | States and behaviour › bullet "Motion only for state change … 150–250 ms. No choreographed page-load sequences"; Common failures › bullet 1 |
| - Make responsive changes structural: collapse navigation, reflow groups, and preserve access to important actions. | States and behaviour › last bullet "Make responsive changes structural…" |
| Use the interface at representative sizes. | Finish › step 1 (390, 768, 1440 px, realistic and empty data) |
| Fix the few observable issues that obstruct the task or break consistency. | Finish › step 3 |
| Do not redesign working areas outside the requested scope. | Finish › step 4 |
