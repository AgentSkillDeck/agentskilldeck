<!-- Adapted from Impeccable reference/overdrive.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Overdrive

Use this guide only when the user explicitly asks for "overdrive" or for exceptional interaction work: canvas or WebGL rendering, view transitions, physics-based motion, scroll-driven scenes, or virtualised views over large data sets.

Overdrive is never the default. A normal build, redesign or polish pass does not reach for it, and nothing in this guide justifies adding spectacle the user did not ask for. When the fundamentals are weak (hierarchy, layout, states), fix those first with the relevant guide; ambitious technique on a shaky screen only makes the weakness louder.

## Start from the product's job

Decide what the enhancement is for before deciding how to build it. Ask what the screen helps the user do and where an exceptional interaction would make that easier, clearer or more satisfying.

- On a marketing or portfolio surface, the payoff is often sensory: a scroll-paced scene, a shader backdrop, a transition that carries the eye from one section to the next.
- On functional UI, the payoff is how it feels in use: a dialog that grows out of the control that opened it, a drag with believable momentum, a list of 100,000 rows that scrolls without a stutter.
- On data-heavy views, the payoff is fluency: canvas or WebGL rendering for sets too large for the DOM, charts that morph between states instead of redrawing.

One focused moment beats several competing ones. If removing the effect would leave the experience unchanged, it is not earning its cost. Overdrive changes how existing features behave, not what the product does; new backend capabilities are product decisions, not interface work.

## Choose a direction first

Do not write code until the user has picked a direction.

1. Propose two or three ambitious options. For each, describe what the user would see and feel, the technique behind it, and its cost and risk: browser support, performance load, implementation effort, new dependencies, and how it degrades.
2. Put each option's description and trade-offs inside the choice itself, so the user can read what they are choosing between. When the host has a structured question tool, use it; otherwise ask in plain text and stop until the user answers.
3. Build only the option the user confirms. If the answer changes the brief, update the brief before building.

## Build the real technique

- Implement the actual mechanism the user chose. A view transition must be a real transition, a physics drag must respond to real input, a virtualised table must render only the visible rows. A static image or a looping video standing in for an interactive effect is not the deliverable.
- Use platform features first: the View Transitions API, `@starting-style`, scroll-driven animations, the Web Animations API, `@property`, Canvas 2D or OffscreenCanvas, Web Workers. Reach for WebGL or WebGPU only for effects CSS and canvas cannot express.
- Do not add a heavy dependency or download an engine, model or asset pack unless it gives a concrete benefit the platform cannot, and the user has approved it. Name the package, its size and its licence when you ask.
- Motion runtime rules (durations, easing, interruption) belong to [animate](animate.md); follow them rather than inventing new ones.

## Progressive enhancement

The screen must work and look finished without the enhancement. Ship a baseline first, then layer the effect on top behind feature detection.

```css
@supports (animation-timeline: scroll()) {
  .scene { animation-timeline: scroll(); }
}
```

```js
if ('gpu' in navigator) { /* WebGPU path */ }
else if (canvas.getContext('webgl2')) { /* WebGL2 path */ }
/* otherwise the static baseline stays in place */
```

Content, controls and the primary action must never depend on the effect loading. If the effect fails to initialise, the user should not notice anything broken.

## Performance budget

- Set the budget before building: target 60 fps on a mid-range device, and simplify the effect if it drops below 50 fps.
- Initialise heavy resources (GL contexts, WASM modules, large textures) lazily, when the element nears the viewport, and pause or tear them down when it leaves.
- Keep the main thread free during input: move heavy computation to a worker, and never block scrolling or typing.
- Watch layout shift and load cost. The enhancement must not delay the first meaningful render or push content around after it appears.

## Reduced motion and accessibility

- Under `prefers-reduced-motion: reduce`, replace movement with a crossfade, a cut or a static state that still communicates the same change. Do not simply delete the feedback.
- Keyboard and screen reader users get the same content and actions. A canvas scene needs a real DOM alternative for anything meaningful it shows; a custom drag needs a keyboard path.
- No flashing above safe thresholds, and no sound without the user opting in.
- Focus must stay visible and in order through every transition.

## Verify

- Capture the baseline and the enhanced version side by side at 375, 768 and 1440 px, plus 320 px and any width the user reported failing.
- Exercise entry and exit, rapid repeated input, interruption mid-animation (click again, scroll back, resize, switch tab) and back navigation. Nothing may get stuck halfway.
- Run it on a low-end device or with CPU throttled in the browser tool (4x or 6x) and record the frame rate you observed.
- Check reduced motion, keyboard-only use and the fallback path with the feature disabled.
- Fix material problems in one batch and re-inspect; stop after two inspection rounds and report what is still open, including which checks ran on real hardware and which on emulation.

When the enhancement holds, continue with [polish](polish.md).
