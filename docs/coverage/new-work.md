# Coverage: new-work

Source: uizze `skills/ui-design/reference/new-work.md` @ 146928e → `plugins/ui/library/new-work.md`.

| uizze source (verbatim) | carried by (our guide) |
|---|---|
| Adapted by Uizze from the licensed Impeccable new-work workflow; see the archive's NOTICE and MODIFICATIONS.md. | Provenance comment (line 1); attribution in docs/attribution |
| Read the brief, representative screens, components, tokens, assets, and existing product/design documentation. | §1 Establish what must remain true › "Read before designing: the brief, 2–3 representative screens…" |
| Separate product facts from visual choices. | §1 › "Write down two lists: product facts … and visual choices" |
| - An addition to an established surface inherits its identity. Solve the new task, hierarchy, content, and states without an identity exercise. | §1 › bullet "Addition to an established surface" |
| - A new surface inside an established product inherits its visual system but may need a different composition. | §1 › bullet "New surface inside an established product" |
| - An approved redesign may replace the visual language, not the product's truth, working behavior, or explicit brand commitments. | §1 › bullet "Approved redesign" |
| - A new product needs a chosen direction, not a default dashboard or landing-page template. | §1 › bullet "New product with no visual authority" |
| Choose the surface's main purpose: persuade, operate, read, or experience. | §1 › "Name the surface's main purpose" |
| A purchase page must communicate a real offer and action; an operational screen must expose tasks and state; reading needs structure and wayfinding; an experiential surface must lead with the work itself. | §1 › bullets Persuade / Operate / Read / Experience |
| These purposes guide the composition, not a prescribed aesthetic. | §1 › "it shapes the composition, not the aesthetic" |
| Ask only what changes the result: audience, job, primary action, real content, constraints, and what must not change. | §2 Decide before building › "Ask only what changes the result, 2–3 questions…" |
| Do not re-ask settled facts or request CSS values from the user. | §2 › "Skip facts the brief or files already settle. Never ask the user for CSS values…" |
| For an open-ended whole surface or new identity, propose two or three substantially different, product-grounded directions. | §2 › "propose 2–3 substantially different directions grounded in the product" |
| Describe the first viewport, information density, type/colour character, and the interaction that matters. | §2 › "For each give: the first viewport … information density, type and colour character, the one interaction that matters" |
| Include a real tradeoff. | §2 › "…and an honest tradeoff" |
| Get the user's choice before committing a new identity; an already supplied direction or explicit delegation of that choice is enough. | §2 › "Get the user's choice before committing a new identity; a direction already supplied, or an explicit 'you choose', is enough" |
| Do not present colour-swapped versions of the same template. | §2 › "Colour-swapped versions of one template count as one direction"; Common failures › bullet 2 |
| Use relevant real-product references when available, and inspect them. | §2 › "Use references to answer a real structural question, and inspect what you find" (`node scripts/references.mjs`) |
| Extract the structural lesson: how a table exposes comparison, how a form recovers from errors, how an onboarding step teaches the next action. | §2 › "Extract the transferable lesson, such as how a table exposes comparison…" |
| A reference is evidence, not a licence to copy a brand. | §2 › "A reference is evidence, not a licence to copy a brand." |
| Write a short design contract in the working plan or an existing development brief: purpose, composition, typography/colour/material roles, responsive changes, required states, and a verifiable finish condition. | §2 › "Write a design contract of about 150 words…" with Thesis / Composition / Roles / Responsive / States / Finish bullets |
| Keep it out of browser-delivered content. | §2 › "Keep the contract out of anything the browser receives: no HTML or framework comments…"; Common failures › last bullet |
| Do not create a documentation system for a small task. | §2 › "Do not create a documentation system for a small task." |
| Start with the first meaningful viewport, using realistic content and actual assets. | §3 Build › bullet "Start with the first meaningful viewport" |
| It must communicate the product's task or offer immediately, with an obvious next action. | §3 › "communicates the task or offer within 5 seconds and shows one obvious next action" |
| Do not replace missing product substance with decorative cards, empty charts, gradients, or invented metrics. | §3 › bullet "Prove, don't claim" |
| If the user provided or approved a visual comp, compare against that actual image at its dimensions. | §3 › bullet "A supplied or approved comp is a spatial target" |
| Measure layout regions, spacing, type scale, asset crops, and control placement. | §3 › comp bullet "Measure layout regions, spacing, type scale, asset crops and control placement" |
| It is a spatial target, not just a mood. | §3 › comp bullet heading "is a spatial target" |
| Keep text and controls semantic and usable. | §3 › comp bullet "Keep text and controls semantic and working" |
| Do not ship a screenshot of the comp as a fake working interface. | §3 › comp bullet "Never ship a screenshot of the comp as the interface" |
| Do not fabricate features or commercial claims found in generated imagery. | §3 › comp bullet "never copy features or commercial claims that appear only in generated imagery"; "Truth binds claims" bullet |
| Carry the selected visual language through navigation, inputs, buttons, content and secondary states. | §3 › bullet "Carry the direction through every atom" |
| Distinction can come from composition, product-specific content, strong typography, imagery or interaction; it need not come from unusual controls. | §3 › "Carry the direction…" bullet, sentence 2 |
| Do not quietly dilute the approved direction into the first familiar template. | §3 › "Carry the direction…" bullet, last sentence |
| Use available project assets and licensed materials. | §3 › bullet "Assets: use project assets and licensed materials" (`node scripts/materials.mjs`) |
| Verify image/font sources and provide a functional fallback; do not fetch or install dependencies without the task's authority. | §3 › Assets bullet "verify every image URL resolves … record each result's licence … functional fallback … Do not fetch or install dependencies without the task's authority" |
| For genuinely new design systems, capture the final reusable decisions in the project's normal design documentation. | §3 › bullet "Design documentation" |
| Preserve existing DESIGN.md unless an update is in scope. | §3 › Design documentation bullet "Never overwrite an existing DESIGN.md unless updating it is in scope" |
| Apply [craft](craft.md), and [operate](operate.md) or [iOS](ios.md) where relevant. | §4 Complete and verify › step 1 (adds android) |
| Implement reachable loading, empty, error, disabled, success and recovery states, not a decorative collection of impossible states. | §4 › step 2 |
| Make responsive choices structural: decide what stacks, collapses, scrolls, or remains fixed. | §4 › step 3 "Make responsive choices structural"; §2 contract › Responsive bullet |
| Use the real copy, long values, and small screens. | §4 › step 3 "Test real copy, the longest realistic values and a 320–390 px width" |
| Implement the actual primary interaction; a convincing screenshot with inert controls is unfinished. | §4 › step 3 last sentence; Common failures › "Inert controls" |
| Render the built result at representative sizes. | §4 › step 4 "Render the build … (web: 390 px and 1440 px, plus the user's reported viewport)" |
| Inspect full context and detail crops, not only a thumbnail. | §4 › step 5 |
| Compare the hierarchy, composition and interaction with the design contract and supplied reference. | §4 › step 5 sentence 2 |
| Wait for fonts/images and capture settled states; broken captures are not design evidence. | §4 › step 4 "Wait for fonts and images, settle or disable entrance motion … Broken captures are not design evidence" |
| Fix material gaps in one batch, then inspect the changed result again. | §4 › step 6 |
| Continue only while resolving named issues within the agreed scope; if a pass makes no progress, report the limitation and the next decision. | §4 › step 6 "Continue only while resolving named issues within scope. If a round makes no progress, report the limitation and the decision…" |
| Do not announce a complete visual pass when rendering, a required state, or the requested target was not checked. | §4 › step 8; Common failures › "Declaring done from one desktop thumbnail" |
