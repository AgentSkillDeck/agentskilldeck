<!-- Adapted from Impeccable reference/new-work.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# New work

Use this guide when building a new screen, page, flow or product, or carrying out a redesign the user has approved.

## Settle what is already fixed

Separate product facts from open visual choices before designing anything. Content, function, constraints, real assets and stated brand commitments are facts; you keep them. Read the design notes (for example `DESIGN.md`), tokens, shared components and a few representative screens, then place the work in one of five cases:

- **Addition to an established surface:** a section, state or component inside a screen that already has a look. It inherits that look. Resolve only its content, hierarchy, states and how it joins its neighbours.
- **New surface in an established product:** the visual system stays fixed; only the structure of this surface is open.
- **Incomplete brand:** keep the confirmed assets and recognisable traits, then extend the system with the user.
- **Approved redesign:** keep the product truth and replace the old visual language. The old look tells you what the product is, not what it must become.
- **Brand-new product:** no visual authority exists yet; build one with the user.

Never turn a local addition into an identity exercise. A coherent identity in code still counts when the design notes are missing.

## Name what the surface is for

- **Persuade:** someone must believe something and act. Identify the real proof, content and assets that earn it.
- **Operate:** the user is doing a job. Also load [operate](operate.md).
- **Read:** someone needs to understand long material. Give prose a sensible measure, per [typeset](typeset.md), and clear wayfinding.
- **Experience:** exploration is the point. Decide what leads and which interaction or transition matters.

## Decide before building

- Ask two or three questions whose answers change the result: who must act or what task they do, what success looks like, what must not change. A precise request needs only a short confirmation. Never ask for CSS values.
- For open-ended identity work, offer two or three genuinely different directions. Give each its first viewport, density, type and colour character, key interaction and an honest tradeoff. Variations on one idea are not a choice.
- Pick a colour strategy before picking colours, per [colorize](colorize.md): restrained, committed, full palette or drenched.
- Choose light or dark from the physical scene: write one sentence on who uses it, where and under what light, and let that decide.
- Choose fonts per [typeset](typeset.md). Operate and read surfaces are well served by system stacks and sturdy UI faces. On persuade and experience surfaces, Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter as display, DM Sans, DM Serif, Outfit, Plus Jakarta Sans and Instrument Sans are overused defaults; using one needs a reason no other face meets, and "books want a serif" is not one.
- Check the direction against the looks generated interfaces fall into: cream ground with a contrasty serif and terracotta accent; near-black with one neon accent and glows; hairline editorial rules with italic serif and tracked mono labels; flat saturated ink with hard offset shadows. Each is fine when the brief asks for it. If someone could guess your look from the category alone, keep working.

## Write the design contract

Before code, write about 150 words in the brief: thesis, composition and first viewport, roles (colour, type, components), responsive behaviour, states, and the finish condition. If a line reads like a mood rather than a decision, the direction is not settled. Keep the contract out of anything the browser receives: no comments, hidden markup, data attributes, metadata or bundled files.

## Build

- Build the first viewport first, with real content. It should show what the product does at a glance.
- Show the product working (the interface in use, the mechanism in action) instead of decorative filler such as gradients, glass or generic icon tiles.
- Never invent prices, customers, testimonials or metrics. Illustrative demo data is fine when labelled; claims are not.
- An approved comp is a spatial target: match its regions, scale and words, and add nothing it does not show.
- Carry the direction through every element. Navigation, buttons, inputs and links belong to the same language; one stock component breaks it.
- Pace long pages: vary density, scale and quiet within one spacing rhythm, and end on a real close.
- Give the page one deliberate motion moment rather than effects on every section, per [animate](animate.md).
- Find fonts, icons and kits with `node scripts/materials.mjs <font|icon|animated-icon|pack> "<query>"`. Check each `License:` line; adding one is a dependency decision for the user.
- Look up how design systems handle a pattern with `node scripts/references.mjs "<job, object, state or interaction>"`.

## Complete and verify

- Apply the quality floor in [craft](craft.md).
- Implement every reachable state: loading (skeleton), empty, error, success, disabled, long content. See [harden](harden.md).
- Check responsive behaviour at 375, 768 and 1440 px, plus 320 px and any width the user reported failing.
- Render and inspect real captures. Settle entrance motion first, capture from the top of the document, and open every file to confirm it shows what its name claims. Never judge from one full-page thumbnail.
- Fix material problems in one batch and re-inspect; stop after two rounds and report what is still open.
- Get a fresh-eyes review with [critique](critique.md), ideally from a context that did not build it.
- Report exactly what was checked, at which widths and with which tool, and what stayed untested.

## Common failures

- Turning a small addition into a new visual identity.
- A standard hero with a vague headline where the product should be shown working.
- Invented logos, testimonials or numbers.
- A committed direction that fades into stock components below the first viewport.
- Declaring it finished from memory without rendering it.

When the build verifies, continue with [polish](polish.md).
