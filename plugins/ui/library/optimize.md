<!-- Adapted from Impeccable reference/optimize.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Optimize

Use this guide when an interface is slow or janky: slow first load, layout shift, laggy input, dropped frames during scroll or animation, or heavy bundles and images.

Performance is a feature. Find the actual bottleneck for this interface, fix the biggest one first, and measure before claiming an improvement. Do not optimise what is not slow.

## Measure first

Record a baseline before changing anything, on a representative device and network, not only a fast desktop. Use whatever the project and host provide; no single tool is required:

- **Browser performance panel** (the host's browser tool or DevTools): long tasks, layout and paint cost, frame rate, main-thread activity during the slow interaction.
- **Lighthouse** or a comparable lab audit: LCP, CLS, Total Blocking Time and the opportunity list. Run it 3 times and use the median; single runs vary.
- **Network panel:** request count, payload sizes, the critical-path waterfall, cache headers. Throttle to a slow mobile profile and 4× CPU slowdown to approximate mid-range phones.
- **React Profiler** (or the framework's devtools): which components re-render, how often and how long.
- **Instruments** (iOS / macOS) or **Android Studio Profiler** for native apps: Time Profiler, hitches, memory, energy.
- **Bundle analysis:** the bundler's stats or analyser output to find the largest modules.
- **Field data** if the project has real-user monitoring: it outranks lab numbers.

Write the baseline down: metric, value, tool, device and network profile, page or interaction. If you cannot measure, say so and name what the change is expected to affect; do not report an improvement you did not measure.

## Find the bottleneck

Answer from the measurements:

- **What is slow:** initial load, a specific interaction, scrolling, an animation, memory growth over time?
- **What causes it:** oversized images, render-blocking resources, a large bundle, expensive JavaScript, layout thrashing, excessive re-renders, a slow API, third-party scripts?
- **Who is affected:** everyone, mobile only, slow networks, large accounts with many records?

Targets (good thresholds at the 75th percentile; project budgets override these defaults):

| Metric | Target | Usual causes when it fails |
|---|---|---|
| LCP | < 2.5 s | Large or late hero image, render-blocking CSS / fonts, slow server response, client-only rendering |
| INP | < 200 ms | Long tasks on the main thread, heavy event handlers, large re-renders |
| CLS | < 0.1 | Media without dimensions, injected banners, late fonts, content inserted above the viewport |
| Frame budget | 16.7 ms (60 fps) | Layout-property animation, unbounded paint, scroll handlers doing work |

## Apply

Fix the largest measured cost first. Each change gets its own before/after measurement.

### Images and media

- Serve the size actually displayed: `srcset` with `w` descriptors and an accurate `sizes`. A 3000px image in a 300px slot is the most common waste.
- Use AVIF or WebP with a fallback; quality around 75–85 is usually indistinguishable.
- Set `width` and `height` (or `aspect-ratio`) on every image, video and embed.
- `loading="lazy"` below the fold only. The LCP image gets `fetchpriority="high"` and is never lazy-loaded.
- Replace autoplaying background video with a poster on slow connections or reduced data (`prefers-reduced-data` where supported, `navigator.connection.saveData`).

### JavaScript

- Split by route and load heavy, rarely used components on demand (`import()`, `React.lazy`, the framework's equivalent).
- Remove unused dependencies and replace heavy ones used for one function. Check the bundle analysis before and after.
- Defer or `async` non-critical scripts; load third-party scripts after interaction or idle, and remove ones nobody uses.
- Break long tasks over 50 ms: yield to the main thread (`scheduler.yield()` where available, otherwise `setTimeout` chunks), or move pure computation into a web worker.
- Keep event handlers short: update the visible state first, defer analytics and secondary work.

### CSS and fonts

- Inline critical CSS for the first view only when measurement shows render-blocking CSS delays LCP; remove unused CSS.
- `contain: content` or `content-visibility: auto` (with `contain-intrinsic-size`) for independent off-screen regions and long pages.
- Font loading, subsetting and fallback metrics are covered in [typeset](typeset.md); apply them when fonts show up in the waterfall or as layout shift.

### Rendering and runtime

- Batch DOM reads before writes; never read layout (`offsetHeight`, `getBoundingClientRect`) inside a loop that writes styles.
- Virtualise lists beyond a few hundred rows; paginate API responses.
- Prevent unnecessary re-renders where the profiler shows them: stable props, memoised expensive children, state kept close to where it is used. Do not wrap everything in `memo` by reflex; memoisation has a cost.
- Debounce input-driven work (about 250–300 ms for search) and throttle scroll and resize handlers or use `requestAnimationFrame`, `IntersectionObserver` and `ResizeObserver` instead of polling.
- Clean up listeners, timers, observers and subscriptions on unmount; check memory over a long session if it grows.

### Animation

- Animate `transform` and `opacity` for movement. Blur, filters, masks and shadows are allowed when they carry meaning, but keep them in small, isolated regions.
- Do not animate layout properties (`width`, `height`, `top`, `left`, margins) casually; use FLIP or transforms.
- Apply `will-change` only during a known animation, then remove it; on everything it wastes memory.
- Motion design rules are in [animate](animate.md).

### Network and data

- Cache static assets with long-lived immutable headers and hashed filenames; cache API responses where data allows.
- Preload only the 1–3 resources the first view truly needs; prefetch the likely next route on hover or idle.
- Request only the fields and rows the view displays; compress responses (brotli or gzip).
- Show optimistic UI for fast-feeling actions, with rollback (see [harden](harden.md)).

### Native

- Profile with Instruments or Android Studio Profiler on a real device, in a release build; debug builds mislead.
- Keep work off the main thread; lazy-load heavy screens; size images to their view; reuse cells and list items.

## Verify

Answer each with numbers; a bare "faster" is not verification:

- Before/after table for each change: metric, baseline, result, tool, device and network profile. Medians of 3 or more runs for lab metrics.
- The targets above are met, or the gap and its remaining cause are stated.
- The slowest supported device and network profile were included.
- Functionality, accessibility and visual output are unchanged; the project's tests pass.
- Bundle size did not grow elsewhere as a side effect.
- The change is felt: the slow interaction now responds within its budget in the running app.

When the measured numbers move, continue with [polish](polish.md).

## Common failures

- Claiming an improvement without a before/after measurement.
- Micro-optimising (memoising small components) while a 2 MB image or a blocking third-party script dominates.
- Lazy-loading the LCP image or above-the-fold content.
- Testing only on a fast desktop over fibre.
- `will-change` on many elements, or animating layout properties.
- Images and embeds without dimensions, causing layout shift.
- Cutting accessibility (alt text, focus styles, reduced-motion paths) to shave bytes.
- One noisy Lighthouse run reported as the result.
