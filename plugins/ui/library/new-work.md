<!-- Adapted from Impeccable reference/new-work.md @ d631a88 (Apache-2.0) and uizze ui-design reference/new-work.md @ 146928e (Apache-2.0); modified by agentatelier -->
# New interface or major redesign

Use this guide when building a new screen, page, flow or product, or when the user has approved replacing an existing visual language.

## 1. Establish what must remain true

Read before designing: the brief, 2–3 representative screens, shared components, tokens, assets, and any PRODUCT.md, DESIGN.md or README design notes. Write down two lists: product facts (audience, job, content, behaviour, constraints, brand commitments) and visual choices (type, colour, density, composition). Only the second list is open.

Classify the work; the class decides how much you invent:

- **Addition to an established surface** (section, component, feature, state): inherit its identity and composition. Solve the new task, hierarchy, content, states and how it joins the surrounding screens. No direction round, no identity exercise, no DESIGN.md change unless the user approves a system change.
- **New surface inside an established product**: keep the visual system fixed; the composition may differ. A coherent identity already in code counts as the system even when no DESIGN.md exists.
- **Incomplete brand**: keep confirmed assets and recognisable traits; extend the rest with the user.
- **Approved redesign**: replace the visual language, never the product's truth, working behaviour, content or explicit brand commitments. The old look is evidence of what the product is, not authority over what it becomes.
- **New product with no visual authority**: choose a direction with the user. A default dashboard or landing-page template is not a direction.

Name the surface's main purpose; it shapes the composition, not the aesthetic:

- **Persuade**: a purchase or sign-up page states a real offer and one action.
- **Operate**: a working screen exposes tasks and state first. Also load [operate](operate.md).
- **Read**: docs and long-form need structure, wayfinding and a 65–75ch measure for long-form; 45ch minimum only in narrow columns and cards.
- **Experience**: a portfolio or showcase leads with the work itself.

## 2. Decide before building

Ask only what changes the result, 2–3 questions in one message: audience, job, primary action, real content and proof, constraints, what must not change, what would make a polished result feel wrong. Skip facts the brief or files already settle. Never ask the user for CSS values or to pick from canned style lanes. A precise request needs only a one-line confirmation of your reading.

For an open-ended whole surface or a new identity, propose 2–3 substantially different directions grounded in the product. For each give: the first viewport (what sits where, at what scale, where the primary action is), information density, type and colour character, the one interaction that matters, and an honest tradeoff. Colour-swapped versions of one template count as one direction. Get the user's choice before committing a new identity; a direction already supplied, or an explicit "you choose", is enough.

Commit colour and type deliberately:

- Pick a colour strategy before colours: Restrained (neutrals, optionally tinted, plus one accent; the usual floor for Operate and Read), Committed (one saturated colour carries large regions of the surface), Full palette (3–4 named roles), or Drenched (the surface is the colour). The strategy follows the brief and the chosen direction, not a percentage rule; see [colorize](colorize.md). Persuade and Experience may take the bolder strategies when the brief allows.
- Decide light or dark from one sentence of physical scene (who uses it, where, under what light), not from the category.
- Operate and Read surfaces are well served by system stacks and workhorse UI faces; select and pair faces per [typeset](typeset.md). Persuade and Experience surfaces only: these faces mean you stopped looking: Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter as display, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans. Use one only with a reason no other face satisfies; "books want a serif" or "tech wants mono" is not a reason. Search alternatives with `node scripts/materials.mjs font "<character you need>" --category <cat>`.
- Self-check against the four looks generated UI defaults to when the brief leaves the aesthetic open: cream ground with high-contrast serif and terracotta accent; near-black with one neon accent and glowing edges; editorial hairlines, italic display serif and tracked mono labels; flat saturated ink with black boxes and hard offset shadows. If someone could guess your aesthetic from the category alone, rework it.

Use references to answer a real structural question, and inspect what you find (see [reference-policy](reference-policy.md)): `node scripts/references.mjs "<pattern or state>" --platform <web|ios|android>`. Extract the transferable lesson, such as how a table exposes comparison, how a form recovers from errors, or how an onboarding step teaches the next action. A reference is evidence, not a licence to copy a brand.

Write a design contract of about 150 words in the working plan or an existing development brief:

- **Thesis:** the one idea this surface owns and the category-default arrangement it refuses.
- **Composition / first viewport:** what is where, at what scale, where the primary action sits.
- **Roles:** typography, colour and material roles, specific enough to recognise with content removed.
- **Responsive:** what stacks, collapses, scrolls or stays fixed per breakpoint.
- **States:** the reachable states you will implement.
- **Finish:** a verifiable exit condition (sizes rendered, states exercised, checks run).

If a line reads like a mood ("clean, modern, friendly"), the direction is not decided yet. Keep the contract out of anything the browser receives: no HTML or framework comments, hidden DOM, `data-*` attributes, serialized props, metadata or files served beside the build. Do not create a documentation system for a small task.

## 3. Build the chosen direction

- **Start with the first meaningful viewport**, using realistic content and actual assets. It communicates the task or offer within 5 seconds and shows one obvious next action. Ask: if someone left after one viewport, what would they describe an hour later? If the answer is a mood, the concept has not committed.
- **Prove, don't claim.** Show the product doing its job. Do not fill missing substance with decorative cards, empty charts, gradients, glass, icon tiles or invented metrics.
- **Truth binds claims, not demonstrations.** In greenfield work, author illustrative content at full fidelity, label it illustrative wherever a visitor could mistake it for real, and list for the user what to replace. Never invent prices, customers, testimonials, benchmarks, capabilities or performance results.
- **A supplied or approved comp is a spatial target.** Compare against the actual image at its own pixel dimensions. Measure layout regions, spacing, type scale, asset crops and control placement. Keep text and controls semantic and working. Never ship a screenshot of the comp as the interface, and never copy features or commercial claims that appear only in generated imagery.
- **Carry the direction through every atom**: navigation, inputs, buttons, links, content and secondary states. Distinction can come from composition, product-specific content, strong typography, imagery or interaction; it need not come from unusual controls. Do not quietly dilute the approved direction into the first familiar template.
- **Pace long pages**: vary density, scale and quiet inside one grammar, keep one spacing rhythm with more space above a heading than below it, and end on a real close.
- **Motion once, as material**: one orchestrated moment rather than scattered hover effects; content visible by default. If the direction names a technique (canvas, view transitions, WebGL), build the technique, not a static imitation; see [overdrive](overdrive.md) for ambitious work.
- **Assets:** use project assets and licensed materials; prefer one decisive photo of the subject over five generic ones, and verify every image URL resolves. Find fonts, icons and component kits with `node scripts/materials.mjs <font|icon|animated-icon|pack> "<query>"` and record each result's licence. Provide a functional fallback (system font stack, alt text, sized placeholder). Do not fetch or install dependencies without the task's authority.
- **Design documentation:** for a genuinely new system, record the final reusable decisions (tokens, type scale, component rules) in the project's normal design docs after the build, describing what was built. Never overwrite an existing DESIGN.md unless updating it is in scope.

## 4. Complete and verify

1. Apply [craft](craft.md), plus [operate](operate.md), [ios](ios.md) or [android](android.md) where relevant.
2. Implement every reachable state: loading, empty, error, disabled, success and recovery. Skip impossible states; do not build a gallery of decorative ones.
3. Make responsive choices structural. Test real copy, the longest realistic values and a 375 px width (320 px for the smallest phones). Implement the actual primary interaction; a convincing screenshot with inert controls is unfinished.
4. Render the build with the host's browser or simulator at representative sizes (web: 375, 768 and 1440 px, plus the user's reported viewport). Wait for fonts and images, settle or disable entrance motion, and capture from the top of the page. Open every capture and confirm it shows what its name claims: no blank regions, no half-loaded state. Broken captures are not design evidence.
5. Inspect full context and detail crops, never only a thumbnail. Compare hierarchy, composition and interaction against the contract and any supplied reference.
6. Fix material gaps in one batch, then inspect the changed result once more. Two inspection rounds is the ceiling; continue only while resolving named issues within scope. If a round makes no progress, report the limitation and the decision the user needs to make.
7. For a whole new surface, get a fresh-eyes review: if the host can start a subagent with no conversation history, give it the request, contract, screenshot paths and [critique](critique.md); otherwise run a separate pass of that guide yourself and say so.
8. Report exactly what was rendered, which states and sizes were checked, and what was not. Never announce a complete visual pass when rendering, a required state or the requested target was not checked.

## Common failures

- Turning a small addition into a new identity or a direction round.
- Offering three colour-swaps of one template as "directions".
- A first viewport of hero headline, subline and two buttons that could belong to any product.
- Placeholder metrics, testimonials or logos presented as real.
- Inert controls behind a polished screenshot.
- Declaring done from one desktop thumbnail, or from captures taken mid-animation.
- The design contract leaking into shipped HTML comments or attributes.
