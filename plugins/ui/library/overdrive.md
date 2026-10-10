<!-- Adapted from Impeccable reference/overdrive.md @ d631a88 (Apache-2.0) and uizze ui-design reference/overdrive.md @ 146928e (Apache-2.0); modified by agentatelier -->
# Overdrive: exceptional interaction work

Use this guide only when the user explicitly asks for overdrive, or for ambitious, technically exceptional interaction work on an existing experience. It is opt-in, never the default for ordinary UI work. It is a design workflow using the host's existing tools, not a command to download an engine.

## Choose the result before the technique

Goal: make an existing experience unusually good in a way its users will notice. Context decides what that means. A particle system on a creative portfolio is impressive; on a settings page it is embarrassing. A settings page with instant, reliable saves and clear animated state transitions is the settings-page version of exceptional. Ask: what would make a user of this specific interface say "that's nice"?

Fix hierarchy, readability and usability first ([polish](polish.md), [craft](craft.md)). Technical ambition never masks weak fundamentals.

Before writing any code, propose 2–3 concrete directions in one message. Each option states:

- the visible result (what the user sees and feels, in one or two sentences);
- why it fits this product;
- platform and browser support for the actual targets;
- performance cost;
- implementation complexity.

Put the tradeoffs inside each option so the user chooses between things they can read. Ask for the user's choice. If the user already chose a specific effect and scope, honour it instead of reopening the decision. An unanswered choice is not approval: continue ordinary in-scope polish, or stop at the proposal.

Keep the chosen enhancement focused. One well-executed interaction beats several competing effects. Do not replace an established identity or expand product functionality under the label of polish.

## Match ambition to the surface

- **Marketing or expressive work:** a distinctive composition, a product-led reveal, a scroll-driven sequence or a shared-element transition makes the subject tangible. The offer and primary action stay understandable within the first viewport.
- **Functional UI:** a dialog keeps continuity with its trigger, filters update without losing focus, selection and reordering feel direct (drag with spring physics). Keep predictable controls, loading, rollback and error feedback.
- **Data-heavy work:** animated transitions between data states explain change; virtualisation makes genuinely large collections usable; Canvas or WebGL rendering suits datasets too large for SVG or DOM. Keep labels, keyboard navigation and an accessible representation (table or summary). Never render fake data to suggest a capability.
- **Performance-critical work:** search that filters 50k items without a flicker, a form that never blocks the main thread. Move demonstrably expensive work off the main thread, reduce unnecessary work, load only what is needed. Measure before and after; never claim an unmeasured improvement.
- **Native iOS and Android:** use the project's native animation and navigation mechanisms. Preserve back gestures, safe areas, keyboard behaviour, Dynamic Type or font scale, and Reduce Motion or Remove animations. Web APIs are not a native implementation plan. See [ios](ios.md), [android](android.md).

## Choose the smallest suitable implementation

Prefer the project's existing stack and native platform capabilities. Verify current support for the actual target browsers and devices (MDN, caniuse, platform docs) instead of relying on a compatibility table in this guide.

- **UI continuity:** CSS transitions, `@starting-style` for entry from `display: none`, the Web Animations API, or the project's motion library. Make transitions interruptible and reversible. Spring physics where direct manipulation needs it.
- **Navigation and storytelling:** View Transitions for shared-element morphs, scroll-driven animation (`animation-timeline: scroll()`) for scroll-linked effects, `@property` to animate gradients and custom values. Wrap them in `@supports` or feature checks, keep a functional no-enhancement path, and never hide content while waiting for an optional API.
- **Rendering:** SVG for geometry, diagrams and precise icons. Canvas, WebGL or WebGPU (with a WebGL2 fallback) only for genuinely custom, dense or spatial rendering that DOM and CSS cannot express. A glow does not need a new renderer.
- **Computation:** virtualisation for measured large-list cost; Web Workers or OffscreenCanvas for expensive computation or rendering. WASM or any new dependency needs a concrete benefit and project approval, not a preference for novelty.
- **Device features:** sensors, sound and personal data are separate permission decisions. No autoplay sound (audio starts only after a user gesture and an explicit opt-in), no surprise permission prompts, no unrequested device access.

This changes how existing functionality feels, not what the product promises. Real-time collaboration, offline sync, new backend services, payments and authentication are separate product work. Use optimistic feedback only when the existing operation supports reliable failure recovery.

## Implement a resilient enhancement

- The baseline stays fully usable without the effect, with reduced motion, on touch devices, and when assets or optional capabilities fail. Preserve semantics, focus, keyboard access and content order.
- Use feature detection where required (`@supports`, `'gpu' in navigator`, `canvas.getContext('webgl2')`).
- Lazy-initialise heavy resources (WebGL contexts, WASM modules, large assets) only when near the viewport. Pause off-screen or background-tab rendering.
- Clean up observers, animation loops, listeners and GPU resources when the view unmounts.
- Avoid layout thrashing (batched reads before writes) and unbounded particle or DOM growth.
- Do not add a dependency or external service without authority.
- Target 60 fps on representative mid-range devices; measure frame pacing and input responsiveness rather than trusting the development machine. Reduce complexity when frame rate drops below ~50 fps, input is delayed, layout shifts, or rendering runs continuously on battery. A simpler implementation that stays responsive is the correct outcome.
- Spend the last pass on refinement: the easing curve, stagger offsets, secondary motion. The first version that works is rarely the one to ship.

## Verify the actual experience

Use the host's browser automation, or the simulator or device for native work, and inspect the result in motion, not only its source or a single still frame. Expect several rounds; ambitious effects rarely work first time.

1. Capture the baseline and the enhanced state, then exercise entry, exit, rapid repeated input and interrupted transitions.
2. Check desktop and mobile widths or the relevant native device classes, keyboard and touch use, reduced motion and the fallback path.
3. Inspect against the approved direction: timing, easing, continuity, asset sharpness and typography form one coherent result.
4. Batch the material fixes and repeat the affected checks. Do not call an unpreviewed effect polished.

Answer four final questions:

- **Fit:** does it suit this product and audience?
- **Removal:** is the experience worse without it, or would nobody notice?
- **Fallback:** does everything still work without the enhancement?
- **Smoothness:** is it smooth on the devices actually tested?

If preview or device access is unavailable, keep the implementation bounded and report exactly what was and was not verified. Never fabricate frame-rate results, user reactions, performance gains or a visual pass. Stop when the chosen result works; propose extra scope separately.

When the enhancement holds, continue with [polish](polish.md).

## Common failures

- Building before the user chose a direction.
- A showpiece effect on a functional screen that needed speed and clarity.
- Several competing "wow" moments on one surface.
- Bleeding-edge APIs with no working fallback, or content hidden until they load.
- Jank on mid-range devices, or animation loops left running off-screen.
- Sound or permission prompts without explicit opt-in.
- Performance claims with no measurement.
