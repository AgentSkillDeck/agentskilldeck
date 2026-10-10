# Coverage: polish

Source: uizze `skills/ui-design/reference/polish.md` @ 146928e → `plugins/ui/library/polish.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Polish improves the interface that exists; it does not conceal a redesign. | Intro › "Polish improves the interface that exists; it never conceals a redesign."; Common failures › bullet 1 |
| Preserve the product's visual language, content, behavior, and scope unless the user explicitly asks to change them. | Intro › sentence 2 |
| Render or run the interface when possible. | §2 Inspect the real result › "Render or run the interface with the host's browser, simulator or emulator." |
| Check representative desktop and mobile sizes for web work, or the relevant device class for native work. | §2 › "For web, check 375, 768 and 1440 px wide; for native, the shipped device classes." |
| Judge the rendered result rather than the source code alone. | §2 › "Judge the rendered result, not the source alone." |
| Prioritize the largest observable problems: | §3 Triage › "Fix the largest observable problems first, in this order" |
| - unclear hierarchy or competing primary actions; | §3 › item 3 |
| - inconsistent spacing, typography, color, radius, or icon treatment; | §3 › item 4; §4 › Layout and type, Colour/imagery/icons bullets |
| - clipping, overlap, overflow, distorted images, or awkward wrapping; | §3 › item 4; §4 › Layout and type (wrapping, zoom), Colour/imagery (aspect ratio) |
| - missing hover, focus, disabled, loading, empty, error, or success feedback; | §3 › item 2; §4 › Interaction bullet |
| - inaccessible controls, weak contrast, or poor keyboard behavior; | §3 › item 1 (labels, keyboard, contrast 4.5:1 / 3:1, visible focus) |
| - decorative noise that competes with the task. | §3 › item 4 "decorative noise that competes with the task" |
| Fix related issues in one coherent pass. | §4 heading "Fix in one coherent pass" |
| Reuse existing tokens and components, avoid speculative cleanup, and leave areas that already work alone. | §4 › Code bullet; §1 classification (missing token / one-off); Common failures › bullets 4–5 |
| Confirm the changed surface once more after the fixes. | §5 Verify and finish › "Confirm the changed surface once more after the fixes" |
