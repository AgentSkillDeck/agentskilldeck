<!-- Adapted from Impeccable reference/animate.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Animate

Use this guide when adding or fixing motion: feedback on actions, state and layout transitions, navigation continuity, or one authored focal moment.

Motion explains state, relationship and hierarchy, or creates one authored moment the surface has earned. Motion without a purpose is animation debt.

Context you need: performance constraints (target devices, low-end hardware, battery or data limits). Infer them from the project before asking.

## Non-negotiables

- **Reduced motion:** every web animation has a `prefers-reduced-motion: reduce` path; native apps honour Reduce Motion / Remove animations.
- **Never block input:** content is visible and controls are usable from the first frame. No entrance animation, splash or page-load choreography gates clicks, typing, scrolling or focus.
- **Interruptible and reversible:** a new interaction mid-animation retargets from the current value; reversing (close while opening, un-hover) runs back from where it is, without a jump or a queued replay.
- **Default timing:** 150–300 ms for UI state changes. Project motion tokens override this default.

## Match the surface

- **Persuasive or experiential surfaces:** motion may carry the voice. Prefer one rehearsed focal sequence to repeated section reveals.
- **Operational or reading surfaces:** motion serves feedback, state and continuity. Keep routine transitions fast. Never make users wait through page-load choreography. See [operate](operate.md).
- **Native apps:** follow the motion guidance in [ios](ios.md) or [android](android.md) and the platform's animation APIs. The web techniques below do not apply.

## Find the job

Read the existing motion code and tokens (durations, easings, motion library), interaction states, target devices and performance budget. Run the app and exercise the flows with the host's browser or simulator tool. Add motion only where it would:

- acknowledge an action;
- make a state change or spatial relationship legible;
- preserve continuity through navigation or layout change;
- direct attention at a meaningful moment;
- express the chosen visual world.

Do not animate a static area because it exists.

## Set the motion plan

Write a short plan before implementing:

- **Focal moment:** the one sequence or interaction that deserves authorship, if any.
- **Continuity:** the state, layout or navigation changes that need explaining.
- **Feedback:** the controls and outcomes that need acknowledging.
- **Budget:** which effects are expensive and how often they run.

The focal moment comes from this product and surface. A generic fade-and-rise, hover lift, parallax layer or scroll reveal is not a plan.

## Choose material by meaning

Transform and opacity are reliable foundations, not the whole palette. Pick properties for what the transition communicates:

- **Continuity and relationship:** shared-element motion, FLIP transforms, View Transitions, deliberate spatial movement.
- **Focus and depth:** bounded blur, filter, backdrop, light or shadow changes.
- **Reveal and composition:** masks, `clip-path`, cropping, controlled occlusion.
- **Material and energy:** colour, gradient position, texture, distortion or shaders when the world and runtime support them.
- **State and feedback:** the smallest change that makes cause and result unmistakable.

Do not stack techniques for spectacle. One strong material idea, carried through the focal sequence and quiet supporting states, is enough.

Stagger siblings only when a list appears as a list: 30–60 ms per item, total stagger capped at about 300 ms. Never treat every scrolled section as a staggered list.

For animated icons (loading, success, toggles), search before drawing: `node scripts/materials.mjs animated-icon "<query>" --limit 3`. Read each result's `License:` line and use only assets whose licence fits the project. Treat `Install:` as a snippet to propose; add files or dependencies only with the task's authority. Exit 2 is a service error, not an empty library: say so and continue with CSS or the project's existing icons.

## Timing and easing

Duration expresses distance and consequence. Project tokens override these defaults.

| Duration | Typical use |
|---|---|
| 100–150 ms | immediate feedback (press, toggle, hover) |
| 150–300 ms | routine state change (default range) |
| 300–500 ms | layout, overlay or view transition |
| 500–800 ms | a deliberately authored focal entrance |

- Exits run faster than entrances (about 60–75% of the entrance duration).
- Use natural deceleration for arrivals, for example `cubic-bezier(0.16, 1, 0.3, 1)`. No bounce or elastic curves by reflex.
- Feedback slower than about 300 ms reads as latency.

## Implement to the runtime

- CSS transitions and keyframes for declarative state and bounded sequences. CSS transitions retarget on interruption; keyframe animations do not, so use transitions for anything a user can reverse.
- Web Animations API or the project's existing motion library for interruption, sequencing and dynamic values.
- View Transitions or shared-element techniques when continuity across states is the point, with an instant fallback where unsupported.
- Scroll-driven motion only when the scroll relationship itself carries meaning, with a static fallback.
- Do not add a dependency for an effect the existing stack expresses cleanly.

Performance and robustness:

- Content is visible in the default state; animate from an already-visible state so a failed script never hides the page.
- Do not animate layout properties (`width`, `height`, `top`, `left`, margins) casually; use FLIP, transforms or grid techniques.
- Keep blur, filter, shadow, canvas and shader work inside isolated, bounded regions.
- Apply `will-change` only during a known animation, then remove it.
- Measure on the target devices and viewports (the browser tool's performance panel, CPU throttling) instead of assuming transforms are fast.

## Accessibility and control

- Respect autoplay and sound preferences. Any non-essential loop stops when offscreen (IntersectionObserver) or when the page is hidden (`visibilitychange`). Loops longer than 5 seconds need a pause control.
- The `prefers-reduced-motion: reduce` path is an intentional alternative: remove or shorten spatial movement (slides, zooms, parallax, scroll-linked motion) and keep opacity, colour and state changes that carry meaning. Reduced motion means fewer and gentler animations, not none; feedback that confirms an action stays legible.

```css
@media (prefers-reduced-motion: reduce) {
  .panel { transition-property: opacity; transition-duration: 150ms; }
}
```

Keep the open and closed states; remove only the movement between them. Do not force `transform: none` globally: it parks transform-hidden panels on screen. If a closed state relies on transform to hide, pair it with `visibility: hidden` and `pointer-events: none` so it stays hidden and unclickable when motion is reduced.

- No flashing more than three times per second.

## Verify

Answer each with rendered evidence; a bare "yes" is not verification:

- The focal motion is specific to this world and surface.
- Every supporting animation explains feedback, state or relationship.
- Clicking, typing and keyboard focus work during every entrance; nothing waits on an animation.
- Interrupting and reversing mid-animation (rapid toggle, hover in and out, close while opening) behaves without jumps or queued replays.
- Repeated use stays fast; durations sit in the stated ranges or match project tokens.
- Desktop, mobile and keyboard paths remain usable.
- With reduced motion emulated in the browser tool (or the OS setting on a simulator), movement is reduced and meaningful feedback remains.
- Expensive effects stay smooth on the target device.
- Removing any animation would lose meaning or authored character, not only decoration.

When motion earns its place, continue with [polish](polish.md).

## Common failures

- The same fade-and-rise entrance on every section.
- Content hidden until a script runs, or controls inert until an intro finishes.
- Keyframe animations on reversible states, so they snap or replay when interrupted.
- Routine feedback at 400 ms or more, which feels like lag.
- Bounce or elastic easing used by default.
- Animating `height`, `top` or margins and causing layout jank.
- Loops that keep running offscreen, or no reduced-motion path at all.
- A reduced-motion path that removes every transition, including state feedback.
