# Coverage: overdrive

Source: uizze `skills/ui-design/reference/overdrive.md` @ 146928e → `plugins/ui/library/overdrive.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Adapted from Impeccable's Overdrive, pinned and credited in NOTICE and MODIFICATIONS.md. | Provenance comment (line 1); attribution in docs/attribution |
| Use only for an explicit Overdrive or ambitious interaction request. | Intro › "Use this guide only when the user explicitly asks for overdrive, or for ambitious … interaction work" |
| This is a design workflow using the host's existing tools, not a command to download an engine. | Intro › last sentence |
| Make an existing experience unusually good in a way its users will notice. | Choose the result › "Goal: make an existing experience unusually good…" |
| Context decides what that means. | Choose the result › "Context decides what that means." |
| A cinematic reveal may suit a portfolio; a settings screen benefits more from clear, immediate state transitions and reliable feedback. | Choose the result › portfolio vs settings-page sentences |
| Fix hierarchy, readability and usability before adding technical ambition. | Choose the result › "Fix hierarchy, readability and usability first" |
| Before implementing, propose two or three concrete directions. | Choose the result › "Before writing any code, propose 2–3 concrete directions" |
| Each option must describe the visible result, why it fits this product, platform/browser support, performance cost, and implementation complexity. | Choose the result › five-item option list |
| Ask for the user's choice. | Choose the result › "Ask for the user's choice." |
| If the user already chose a specific effect and scope, honour that instead of reopening the decision. | Choose the result › same sentence |
| An unanswered choice is not approval: continue ordinary in-scope polish or stop at the proposal. | Choose the result › same sentence; Common failures › bullet 1 |
| Keep the chosen enhancement focused. | Choose the result › "Keep the chosen enhancement focused." |
| One well-executed interaction is usually stronger than several competing effects. | Choose the result › "One well-executed interaction beats several competing effects."; Common failures › bullet 3 |
| Do not replace an established identity or expand product functionality under the label of polish. | Choose the result › same sentence |
| - **Marketing or expressive work:** a distinctive composition, product-led reveal, or shared-element transition can make the subject tangible. The offer and primary action must remain immediately understandable. | Match ambition › Marketing or expressive work |
| - **Functional UI:** make a dialog maintain continuity with its trigger, filters update without losing focus, or selection/reordering feel direct. Preserve predictable controls, loading, rollback and error feedback. | Match ambition › Functional UI |
| - **Data-heavy work:** fluid transitions can explain changes; virtualisation can make genuinely large collections usable. Keep labels, keyboard navigation and an accessible representation. Do not render fake data to suggest a capability. | Match ambition › Data-heavy work |
| - **Performance-critical work:** move demonstrably expensive computation off the main thread, reduce unnecessary work, or load only what is needed. Measure before claiming an improvement. | Match ambition › Performance-critical work; Common failures › last bullet |
| - **Native iOS:** use the project's native animation/navigation mechanisms. Preserve back gestures, safe areas, keyboard behavior, Dynamic Type and Reduce Motion. Web APIs are not a native implementation plan. | Match ambition › Native iOS and Android |
| Prefer the project's existing stack and native platform capabilities. | Smallest suitable implementation › sentence 1 |
| Verify current support for the actual target browsers/devices instead of relying on this document for a compatibility matrix. | Smallest suitable implementation › sentence 2 (MDN, caniuse, platform docs) |
| - CSS transitions, the Web Animations API or an existing motion library can handle most UI continuity. Make transitions interruptible and reversible. | Smallest suitable implementation › UI continuity |
| - Shared-element/View Transitions or scroll-driven animation can suit navigation and storytelling when supported. Keep a functional no-enhancement path; never hide content while waiting for optional APIs. | Smallest suitable implementation › Navigation and storytelling; Common failures › bullet 4 |
| - SVG suits geometry, diagrams and precise icons. Canvas/WebGL may suit genuinely custom, dense or spatial rendering that ordinary DOM/CSS cannot express well. Avoid a new renderer for a simple glow. | Smallest suitable implementation › Rendering |
| - Virtualisation suits measured large-list cost; Web Workers suit expensive computation. WASM or a new dependency needs a concrete benefit and project approval, not a preference for novelty. | Smallest suitable implementation › Computation |
| - Device sensors, sound and personal data are separate permission decisions. No autoplay sound, surprise permission prompts or unrequested device access. | Smallest suitable implementation › Device features; Common failures › bullet 6 |
| This changes how existing functionality feels, not what the product promises. | Smallest suitable implementation › final paragraph, sentence 1 |
| Real-time collaboration, offline sync, new backend services, payments and authentication are separate product work. | Smallest suitable implementation › final paragraph, sentence 2 |
| Optimistic feedback is appropriate only when the existing operation supports reliable failure recovery. | Smallest suitable implementation › final paragraph, sentence 3 |
| The baseline must remain usable without the effect, with reduced motion, on touch devices, and when assets or optional capabilities fail. | Implement a resilient enhancement › bullet 1 |
| Preserve semantics, focus, keyboard access and content order. | Implement › bullet 1, sentence 2 |
| Use feature detection where required. | Implement › bullet 2 |
| Lazy-initialise heavy resources, pause off-screen or background rendering, and clean up observers, animation loops, listeners and GPU resources when the view unmounts. | Implement › bullets 3–4; Common failures › bullet 5 |
| Avoid layout thrashing and unbounded particle/DOM growth. | Implement › bullet 5 |
| Do not add a dependency or external service without authority. | Implement › bullet 6 |
| Target smooth motion on representative devices; measure frame pacing and responsiveness rather than guessing from the development machine. | Implement › bullet 7 (60 fps target, mid-range devices) |
| Reduce complexity when the enhancement causes jank, battery-heavy continuous rendering, delayed input or layout shifts. | Implement › bullet 7 ("Below ~50 fps … reduce complexity") |
| A simpler implementation that stays responsive is the correct outcome. | Implement › bullet 7, last sentence |
| Use browser automation or the native simulator/device when available. | Verify › paragraph 1 |
| Inspect the result in motion, not only its source or a single still frame: | Verify › paragraph 1 |
| 1. Capture the baseline and enhanced state, then exercise entry, exit, rapid repeated input and interrupted transitions. | Verify › step 1 |
| 2. Check desktop/mobile or the relevant native device classes, keyboard/touch use, reduced motion and the fallback path. | Verify › step 2 |
| 3. Inspect the approved direction: timing, easing, continuity, asset sharpness and typography should form one coherent result. | Verify › step 3 |
| 4. Batch the material fixes and repeat the affected checks. Do not call an unpreviewed effect polished. | Verify › step 4 |
| Use four final questions: Does it fit the product? | Verify › Fit |
| Is the experience worse when removed? | Verify › Removal |
| Does it still work without the enhancement? | Verify › Fallback |
| Is it smooth on the devices actually tested? | Verify › Smoothness |
| If preview or device access is unavailable, keep the implementation bounded and report exactly what was and was not verified. | Verify › final paragraph, sentence 1 |
| Do not fabricate frame-rate results, user reactions, performance gains or a visual pass. | Verify › final paragraph, sentence 2 |
| Stop when the chosen result works; propose extra scope separately. | Verify › final paragraph, sentence 3 |
