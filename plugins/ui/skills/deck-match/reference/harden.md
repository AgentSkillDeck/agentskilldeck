<!-- Adapted from Impeccable reference/harden.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Harden

Use this guide when an interface works with ideal data and must survive real inputs: errors, empty, long, RTL or translated content, offline and slow networks, missing permissions, rate limits and concurrent actions.

A screen that only works with perfect data is not finished. Hardening keeps the established design and makes every state it can reach deliberate. Wording for the states you add belongs to [clarify](clarify.md); first-use empty states belong to [onboard](onboard.md).

## Assess first

Read the components, data-fetching code, API client, form handling and i18n setup for the target flow. List every state each screen can reach, then run the app and force each one with the host's browser or simulator tool. Record what actually renders, not what the code intends.

**Content extremes**

- Text: empty, one character, 100+ characters with no spaces (names, titles, URLs, emails), and a 3-line paragraph where one line was designed.
- Script: accents, emoji (including ZWJ sequences), CJK, Arabic or Hebrew.
- Numbers: 0, negative, 1,000,000+, many decimals, every currency the product supports.
- Volume: 0 items, 1 item, 1,000+ items, 50+ options in a select.
- Media: missing image, wrong aspect ratio, slow or failed image load.

**Failure and access**

- Network: offline, slow (throttle to "Slow 3G" or similar in the browser tool), timeout, connection dropped mid-request.
- HTTP: 400 / 422 validation, 401 expired session, 403 forbidden, 404 gone, 409 conflict, 429 rate limit, 500 / 503.
- Permission: cannot view, can view but not edit, read-only plan, feature not in plan.
- Concurrency: double submit, two tabs editing the same record, navigating away mid-save, a stale list after another user's change.
- Input interruption: a second pointer mid-drag, scroll gesture across a custom control, release outside it, window blur mid-drag.

**Locale**

- Translations 30–40% longer than English (German, Finnish); some short strings double.
- RTL layout direction, date / time / number / currency formats, plural rules.

Then do a mechanical pass yourself: grep for fixed `width` / `height` on text containers, `white-space: nowrap` without truncation, physical properties (`margin-left`, `padding-right`, `left:`, `text-align: left`), string concatenation in user-facing text, hand-rolled plurals (`s'}`), `toFixed` / manual date formatting, `catch` blocks that swallow errors, and `fetch` calls with no timeout or abort. A clean grep does not prove the states render well; combine it with the rendered pass before editing.

## Apply

### Text and overflow

- Let containers grow with content. No fixed widths or heights on text; size buttons with padding, not `width`.
- Choose one behaviour per text slot and make it explicit: wrap (default), truncate with ellipsis and full text in a tooltip or detail view, or clamp to N lines with a way to read the rest.
- Break long unbroken strings: `overflow-wrap: anywhere` for user content (URLs, emails, IDs). `hyphens: auto` needs a correct `lang` attribute.
- Flex and grid children that hold text need `min-width: 0` (and `min-height: 0` for scroll regions), or they overflow their track.
- Never truncate the only copy of critical information (amounts, error messages, legal text).
- Text sizing and zoom rules live in [typeset](typeset.md); spatial breakage in [layout](layout.md).

```css
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.clamp-3  { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.user-text { overflow-wrap: anywhere; }
```

### Internationalisation and RTL

- Budget 30–40% expansion for translated strings; never abbreviate English to make room.
- Use logical properties: `margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-inline-end`, `text-align: start`. Set `dir` on `<html>` (or the root view) from the locale.
- Mirror directional icons (back, forward, chevrons, progress) in RTL; do not mirror logos, media controls' play glyph, clocks or checkmarks.
- Format with the platform: `Intl.DateTimeFormat`, `Intl.NumberFormat` (currency, compact, percent), `Intl.RelativeTimeFormat`, `Intl.PluralRules` or the project's i18n library. Never build dates or plurals by hand.
- Write whole translatable messages with named placeholders (`t('invite.sent', { name })`), never concatenated fragments; translators must be able to reorder.
- Serve UTF-8 everywhere and check that fonts cover the scripts you support; missing glyphs fall back to mismatched faces.

```js
new Intl.NumberFormat(locale, { style: 'currency', currency }).format(1234.56);
t('items', { count }); // not `${count} item${count !== 1 ? 's' : ''}`
```

### Errors

- Map each failure to a state the user can act on:

| Failure | Show |
|---|---|
| 400 / 422 | Field-level errors next to each field; keep every entered value |
| 401 | Re-authenticate, then return to the same place with input preserved |
| 403 | What is blocked and who can grant access; hide or disable the action elsewhere |
| 404 | Not-found state with a path back (list, search, home) |
| 409 | The conflict, both versions where possible, and a choice |
| 429 | That the limit was hit and when to retry; disable the action until then (use `Retry-After` when sent) |
| 5xx / timeout | That it failed, that it is not the user's fault, a retry, and a support route if retry fails |

- Isolate failures: one failed widget shows its own error state; the rest of the screen keeps working. Use error boundaries (or the framework's equivalent) per region.
- Never lose user input on error. Persist drafts for long forms.
- Put a timeout on every request (default 10–15 s for interactive calls; project config overrides) and an abort on unmount or navigation.
- Retry automatically only idempotent requests, with backoff (for example 1 s, 2 s, 4 s, then stop). Never auto-retry payments or other non-idempotent writes.
- Log the technical detail for developers; show the user a message written per [clarify](clarify.md), never a raw code or stack trace as the main text.

### Empty, loading and large data

- Distinguish empty states: first use, user cleared everything, no search results, filtered to nothing, no permission, failed to load. Each needs its own message and next action. Patterns are in [onboard](onboard.md).
- Loading: show a skeleton shaped like the content for waits over about 300 ms; show nothing for faster loads to avoid flashes. Reserve space so content does not shift on arrival.
- Long operations (over about 10 s): show determinate progress when the system knows it, allow cancel, and let the user leave and come back.
- Large datasets: paginate or virtualise beyond a few hundred rows; search and filter before 50+ options in a select.

### Offline and slow networks

- Detect offline (`navigator.onLine` plus failed requests; native reachability APIs on device) and say so in one persistent, non-blocking indicator.
- Decide per action: queue and sync later, or block with an explanation. Never let an action appear to succeed and silently drop.
- Keep already-loaded content readable offline. Mark stale data with its last-updated time.
- Optimistic updates must roll back visibly when the server rejects them.

### Permissions and plans

- Explain why something is unavailable and how to get it (request access, contact admin, upgrade). Do not show a bare disabled control with no reason.
- Read-only mode reads as read-only: no edit affordances that fail on click.
- For OS permissions (camera, location, notifications), ask in context at the moment of need, and design the denied state with a route to settings.

### Concurrency and input

- Disable the submit control and show progress while a request is in flight; dedupe on the server with an idempotency key where the stack supports it.
- Ignore stale responses: cancel or discard a request when a newer one for the same view starts (search-as-you-type, fast tab switching).
- Debounce search input (about 250–300 ms) and throttle scroll or resize handlers (about 100 ms) or use `requestAnimationFrame`.
- Custom drag controls: track one pointer id, use pointer capture, and on `pointercancel`, `lostpointercapture`, `pointerup` outside the control and window `blur` clear the dragging state and release capture. The next interaction must work without a reload.
- Clean up listeners, timers, subscriptions and in-flight requests on unmount.

### Validation and constraints

- Validate on the client for speed and on the server always. Client checks are UX, not security.
- State constraints before input (hint text tied with `aria-describedby`), mirror them in `maxlength`, `pattern`, `type` and `inputmode`, and validate on blur or submit, not on every keystroke.
- Do not block submission on soft warnings.
- On the server, validate and sanitise every input and use parameterised queries and output encoding against injection (SQL, HTML/XSS, command). Rate-limit write endpoints.

### Browser support and degradation

- Use feature detection (`@supports`, `'IntersectionObserver' in window`, `CSS.supports()`), never browser or user-agent sniffing.
- Provide fallbacks for unsupported CSS and JS: a working static layout under `@supports not (…)`, a polyfill only where the project already ships them.
- Progressive enhancement: the core task (read content, submit a form, follow a link) works without optional JavaScript where the stack allows (server-rendered HTML, real `<form>` and `<a>` elements). Images carry alt text.
- Test in the project's target browsers (its `browserslist`, support matrix or brief), including at least one WebKit engine when Safari or iOS is supported.

### Accessibility under stress

- Announce async results (saved, failed, N results) with a polite live region; announce blocking errors assertively.
- Move focus to the first invalid field or the error summary on failed submit; return focus to the trigger when a dialog closes.
- Tab order follows the visual order; long pages and repeated navigation get a skip link to the main content.
- Every state stays keyboard-operable and survives Windows High Contrast / forced colours: do not carry state with colour or background images alone.

## Verify

Answer each with rendered or test evidence; a bare "yes" is not verification:

- A 100+ character unbroken name, emoji and an Arabic string render in every text slot without overflow or clipping.
- A pseudo-locale or the longest real translation fits; RTL mirrors layout and directional icons only.
- With the network offline and throttled, every action either queues visibly or explains why it cannot run.
- Forced 401, 403, 404, 409, 429 and 500 responses each show their designed state (mock them in the browser tool, the project's API mocks or a test).
- Submitting 10 times rapidly creates one record.
- 0, 1 and 1,000+ items render; the list stays responsive.
- Mid-drag interruptions (second pointer, scroll across, release outside, window switch) leave the control usable on the next attempt.
- Keyboard only (no pointer) completes every state, including error recovery and dialogs.
- A screen reader (VoiceOver, NVDA or TalkBack) announces async results and errors without moving the user.
- With the core feature detection forced false (or in the oldest target browser), the fallback still completes the core task.
- Automated accessibility checks (axe or similar) and visual-regression tests pass if the project has them.
- The project's tests pass; add a regression test for each confirmed failure when its runner can drive the state.

Say what produced each piece of evidence (emulated viewport, synthesized input, which browser engine, simulator, physical device) and name what stayed untested. Unreachable hardware is a reported gap, not a blocker.

When every reachable state is deliberate, continue with [polish](polish.md).

## Common failures

- "Something went wrong" for every failure, with no retry and no lost-input protection.
- One failed request blanks the whole screen.
- Fixed-width buttons and labels that clip German or overflow on long names.
- `margin-left` and hard-coded arrows that break in RTL.
- Hand-built plurals, dates and currency that are wrong outside English.
- Double-submit creating duplicate orders because the button stayed enabled.
- Optimistic UI that never rolls back, so failed saves look successful.
- A disabled control with no explanation of the missing permission or plan.
