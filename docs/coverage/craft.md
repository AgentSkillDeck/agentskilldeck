# Coverage: craft

Source: uizze `skills/ui-design/reference/craft.md` @ 146928e → `plugins/ui/library/craft.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Adapted from Impeccable's craft floor. | Provenance comment (line 1); attribution in docs/attribution |
| Apply after choosing the direction, not as a substitute for one. | Intro › "after the direction is chosen. It is a floor, not a substitute for a direction." |
| The project's established system and explicit user choices take priority over general aesthetic preferences. | Intro › "Priority: the project's established system and the user's explicit choices override every default here" |
| Check these together while exercising the actual screen: | Inspect › "Run them together in one batched inspection, exercising the actual screen" |
| - **Hierarchy:** the primary task or message reads first; supporting information is visibly subordinate. Use scale, weight, alignment and grouping before adding more containers. | Inspect › Hierarchy |
| - **Typography:** readable line lengths and line height; coherent scale; deliberate weights; no clipped ascenders, awkward heading wraps or truncated essential labels. Use tabular numerals for comparisons. A system font is appropriate for native/product UI; choose a distinctive face only when the direction benefits and licensing/loading are handled. | Inspect › Typography (45–75 chars, line height 1.4–1.6, display ≤ 6rem, tracking ≥ −0.04em, balance, tabular numerals, system font, licence via materials.mjs) |
| - **Spacing:** relationships are visible. Related controls sit together, separate sections have breathing room, and optical alignment agrees with the grid. Avoid arbitrary one-off gaps. | Inspect › Spacing |
| - **Colour:** semantic roles stay consistent. Verify text contrast (normally 4.5:1; large text 3:1), focus visibility and readable disabled/error states. Colour alone must not communicate meaning. | Inspect › Colour (4.5:1, 3:1 large text and UI components, tinted secondary text) |
| - **Surfaces and assets:** coherent borders, radii and depth; correct image aspect ratio/crop; sharp assets at displayed size. No broken images, accidental seams or duplicate device/status chrome. | Inspect › Surfaces and depth; Assets |
| - **Controls:** labels describe actions; focus order and keyboard operation work; touch targets are usable. Standard controls remain recognisable. Loading and disabled states explain what is happening, and errors offer recovery. | Inspect › Controls (44 pt / 48 dp / 24 px targets); States |
| - **Layout:** test the requested width, a narrow/mobile width and the principal desktop/native device class. Long names, empty lists, large text, keyboard insets and overflowing menus must not break the task. | Inspect › Layout (320–390 px, 200% text) |
| - **Motion:** explain continuity, state or feedback. Keep content visible without animation, honour reduced motion, avoid blocking interaction behind entrance sequences, and test interruption/reversal. | Inspect › Motion |
| - **Content:** real product language and credible data. Label fixtures as illustrative. Do not invent customers, testimonials, capabilities or performance results. | Inspect › Content; Common failures › "Placeholder data shipped unlabelled" |
| Repeated icon-title-text cards, decorative charts, nested panels, gradient headlines, glass backgrounds, indiscriminate pill shapes and identical section entrances are common defaults. | Detect habitual design › "Refuse by default" list (cards, decorative charts, gradient text, glass, pills, identical entrances); nested panels moved to "Never add" (nested cards) per the craft-floor absolute bans |
| They are not universal bans. | Detect habitual design › "Refuse by default. These are common generated-UI defaults." |
| Keep a treatment when it serves the chosen direction or real task; replace it when it adds no information or conflicts with the product. | Detect habitual design › "Keep one only when the chosen direction or real task calls for it … otherwise rewrite the element" |
| Ask what the screen actually communicates and enables. | Detect habitual design › sentence 1 |
| “It compiles” and “nothing overlaps” do not establish visual quality. | Detect habitual design › sentence 2; Common failures › bullet 1 |
| Compare the rendered hierarchy and detail with the user's target, not just with a list of defects. | Detect habitual design › sentence 3 |
| Batch material corrections, recapture the affected sizes/states, and inspect the new captures. | Close the loop › sentence 1 |
| Check actual controls as well as screenshots. | Close the loop › "Check actual controls (click, tab, type, resize), not just screenshots." |
| Run the project's relevant tests. | Close the loop › "Run the project's relevant tests." |
| Report the scope of verification accurately. | Close the loop › paragraph 2, sentence 1 |
| Do not turn an unavailable browser, failed service call, skipped device or unresolved finding into a pass. | Close the loop › paragraph 2, sentence 2; Common failures › last bullet |
| Do not create a novelty score or add effects merely to satisfy a checklist. | Close the loop › "Do not create a novelty score or add effects merely to satisfy this checklist." |
