# Coverage: audit

Source: uizze `skills/ui-design/reference/audit.md` @ 146928e → `plugins/ui/library/audit.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Review only what can be observed in the implementation or rendered result. | Intro › "Review only what can be observed in the code or the rendered result." |
| Do not invent missing requirements or turn personal taste into a defect. | Intro › sentence 3; Common failures › bullet 1 |
| Inspect: | Inspect (section, five scored dimensions) |
| - task clarity and hierarchy; | Inspect › 1 Task and system |
| - consistency with the product's existing system; | Inspect › 1 Task and system (tokens, drift) |
| - layout, overflow, media treatment, and responsive behavior; | Inspect › 3 Layout and responsiveness |
| - interaction feedback and necessary loading, empty, error, success, disabled, and recovery states; | Inspect › 4 Interaction and states; Gather evidence › step 3 |
| - labels, focus, keyboard access, target size, and contrast; | Inspect › 2 Accessibility; 3 (target sizes 24 px / 44 pt / 48 dp) |
| - obvious performance problems visible in the experience. | Inspect › 5 Performance visible in the experience |
| Return material findings ordered by user impact; lead with the most important without hiding additional release-blocking defects. | Report › paragraph 1 and P0–P3 tags |
| For each, name the observed screen/state, evidence and smallest concrete correction. | Report › "For each finding give: the observed screen or state, the location…, the evidence…, the smallest concrete correction" |
| Distinguish confirmed defects from checks that could not run. | Report › "Mark each as confirmed or suspected"; "the checks that could not run"; Gather evidence › step 5 |
| If nothing material is visible, say so at the scope actually inspected. | Report › "If nothing material is visible, say so, stated at the scope actually inspected" |
| An audit does not modify the product unless the user also asked for fixes. | Intro › "An audit is read-only…"; Common failures › last bullet |
