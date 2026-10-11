<!-- Adapted from Impeccable reference/delight.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Delight

Use this guide when an interface works but feels anonymous, and the task asks for personality, polish or memorable moments.

Delight is product character shown through a useful interaction, a humane response or an unexpectedly considered detail. It is not a layer of generic whimsy, and it belongs only at moments that earn it.

Context you need: the brand's emotional range (how playful, how serious). Infer it from the brief, design notes, existing copy and visuals. Ask only when the emotional range or the stakes cannot be inferred.

## Non-negotiables

Delight motion follows the non-negotiables in [animate](animate.md): a reduced-motion path that keeps the meaning (a check, a colour change, a message), input never blocked, every moment interruptible, 150–300 ms for state changes. In delight terms:

- A celebration, entrance or flourish never delays, covers or disables the next action; the user can click, type or navigate during it, and a new action cancels it cleanly.
- Reserve longer sequences (up to about 800 ms) for rare milestones. Project motion tokens override this default.

## Match the surface

- **Persuasive or experiential surfaces:** personality may run through voice, composition, motion and discovery, as long as the content stays the focus.
- **Operational or reading surfaces:** concentrate delight at meaningful moments (first use, completion, recovery, mastery). Reliability carries everything else. See [operate](operate.md).

## Find the opportunity

Read the target screens, the design notes (for example `DESIGN.md`), existing copy and voice, how often each flow is used, and its emotional context. Run the flows in the app. Look for:

- effort worth acknowledging;
- waiting that could inform;
- an empty or first-use state that could orient (see [onboard](onboard.md));
- an error or recovery moment that needs empathy (see [clarify](clarify.md));
- an interaction whose physical or verbal response could express the brand;
- a useful capability people would enjoy discovering.

Do not manufacture a celebration for an ordinary click.

## Define one delight idea

Write one sentence: what the user should feel, and why that feeling belongs to this product. Then pick the smallest means that delivers it:

- a distinctive response to a meaningful action;
- product-specific language that clarifies while carrying voice;
- an interaction or transition with a recognisable material behaviour;
- an illustration, sound, haptic or environmental detail grounded in the product world;
- a discovery reward that reveals real utility.

Derive the treatment from how the product works and its visual world, not from a stock catalogue of confetti and mascots.

When the idea needs an icon or animated icon, search before drawing: `node scripts/materials.mjs icon "<query>" --limit 3` for static icons, or `node scripts/materials.mjs animated-icon "<query>" --limit 3` for animated ones. Check each result's `License:` line and use only assets whose licence fits the project. Treat `Install:` as a snippet to propose; add files or dependencies only with the task's authority. Exit 2 is a service error, not an empty library: say so and continue with existing assets or CSS/SVG geometry. Never use emoji or Unicode glyphs in place of an icon system.

## Build for the emotional moment

- **Success:** match the response to effort and consequence. A first project or a completed purchase can expand; a routine save should simply feel certain (a 150–200 ms check, no modal).
- **Waiting:** show truthful progress, useful context or real product activity. Never fake work or delay completion to stage a flourish.
- **Empty and first use:** make the next action clear before adding personality.
- **Error and recovery:** lead with the problem and the fix. Warmth can reduce stress; jokes must never trivialise loss, money, privacy, health or blocked work.
- **Repeated interaction:** the response still satisfies on the hundredth use. Vary it only if it stays coherent and predictable enough to trust.
- **Discovery:** reward curiosity without hiding required functionality.

Copy uses the product's own language. Generic whimsy ("Oops!", "Woohoo!") is worse than neutral clarity.

## Protect the experience

Delight must not:

- delay, block or obscure the primary task;
- override platform conventions or accessibility;
- add factual claims, metrics or testimonials nobody supplied;
- play sound without consent or ignore mute settings;
- become mandatory, unskippable or tiring on repeat;
- add a dependency or asset weight out of proportion to the moment.

For authored motion, follow [animate](animate.md). Support screen readers (announce outcomes with a live region, hide decorative elements with `aria-hidden`), keyboard use, touch, localisation and cultural context. Non-essential loops stop when hidden or offscreen. Scale celebration intensity to frequency and consequence: the more often it happens, the quieter it is.

## Verify

Answer each with rendered evidence:

- The moment is specific enough that a neighbouring product could not reuse it unchanged.
- It improves comprehension, confidence, motivation or recovery.
- The interface stays fast and obvious with the flourish removed.
- You can act immediately during the moment; it can be skipped or interrupted.
- Repeating the flow five times in a row does not turn charm into friction.
- Muted, keyboard, touch, screen-reader, reduced-motion and localised paths work.
- The result fits this product's world, not a generic "delight" treatment: the copy uses the product's own nouns and verbs, and the visual or motion detail comes from its existing palette, shapes or mechanism.

When the personality feels earned, continue with [polish](polish.md).

## Common failures

- Confetti or a celebration modal for routine actions.
- A flourish that blocks the next click or delays a completed result.
- Fake progress or artificial waits to show off a loading animation.
- Jokey error copy on payment, data-loss or privacy failures.
- Stock whimsy (mascots, "Oops!", emoji icons) that any product could ship.
- Sound that plays without consent, or loops that never stop.
- Delight motion with no reduced-motion path.
