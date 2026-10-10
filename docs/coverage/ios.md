# Coverage: ios

Source: uizze `skills/ui-design/reference/ios.md` @ 146928e → `plugins/ui/library/ios.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Follow the product's existing iOS conventions first, then Apple platform conventions. | Intro › "Follow the product's existing iOS conventions first, then Apple's Human Interface Guidelines." |
| A native interface should feel predictable before it feels distinctive. | Intro › sentence 2 (plus slop test) |
| - Use a navigation stack for hierarchy, a tab bar for a small set of top-level destinations, and sheets for self-contained tasks. | Structure and navigation › bullet 1 (tab bar 2–5 sections); modality bullet |
| - Preserve the edge-swipe back gesture and safe-area behavior. | Structure and navigation › bullets 2–3; Common failures › bullets 2, 6 |
| - Prefer native controls, materials, menus, alerts, sheets, pickers, and text behavior unless the product already has a coherent custom system. | Controls › bullet 1; Type, colour and materials › system materials bullet |
| - Keep touch targets comfortable, text scalable, labels accessible, and focus order sensible. | Controls › "Touch targets ≥ 44×44 pt"; accessibility label / VoiceOver order bullet; Type › Dynamic Type bullet |
| - Account for the keyboard, long content, dynamic type, reduced motion, dark mode, and device insets. | Behaviour and motion › bullet 1; Type › Dynamic Type and Dark Mode bullets |
| Include the states the task requires: loading, empty, error, success, permission denied, offline, disabled, and recovery where applicable. | States › sentence 1 |
| Feedback should be immediate and should not depend on color alone. | States › sentence 2 (pressed state, haptics, progress over ~1 s) |
| When a simulator or runnable build is available, inspect the relevant device classes and fix observable clipping, overlap, unsafe-area violations, unreadable text, broken navigation, or inaccessible controls. | Verify on the simulator › steps 1–4 (`xcrun simctl` capture, device classes, dark, large type) |
| Recheck the affected state after fixes. | Verify on the simulator › step 4 "Recheck the affected states after fixes." |
| If the environment cannot run the UI, disclose that visual/device verification remains incomplete instead of requiring unavailable tooling. | Verify on the simulator › final paragraph |
| For an explicit Uizze Overdrive request, combine this guidance with [Overdrive](overdrive.md). | Last paragraph › "For an explicit ambitious-interaction request, combine this guide with [overdrive](overdrive.md)." (product name removed) |
| Use native continuity and responsive feedback, not web-only effects or novelty that interferes with platform navigation. | Last paragraph › sentence 2; Behaviour and motion › system transitions bullet |
| Respect Reduce Motion and preserve an equally usable non-animated path. | Last paragraph › sentence 3; Behaviour and motion › Reduce Motion crossfade bullet |
