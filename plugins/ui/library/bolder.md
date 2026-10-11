<!-- Adapted from Impeccable reference/bolder.md @ d631a88 (Apache-2.0); modified by agentskilldeck -->
# Bolder

Use this guide when an existing section or screen reads flat and the task asks to make it bolder, stronger or more confident inside a visual world that has already shipped.

"Bolder" is an amplification request, almost always scoped to something that exists. The surrounding page, its system and its conventions are the given. Raise one part to the conviction the rest already implies, without rebuilding anything the brief did not name. The reflex answer, more effects, is the opposite of bold; reject it first.

If no visual world exists yet, or a direction decision is still open, "bolder" is a direction request: follow [new-work](new-work.md) instead.

## Scope is sovereign

"Everything else stays" is a literal instruction:

- Touch only the named target. Do not restyle its neighbours or migrate the page to a new idea.
- Add no colours, fonts, radii, shadows or system primitives the surface does not already own.
- If the existing system genuinely cannot express the direction, stop and ask the user. Name the exact addition and the job it would do.

If the target is unclear, ask which section is the target and what must stay untouched.

## Assess: why it reads flat

Render the target and its neighbours with the host's browser or simulator tool at about 375px, 768px and 1440px wide (or the platform's size classes). A section usually reads flat for reasons its neighbours have already solved. List what the rest of the page does that the target does not:

- display type at full strength (the top step of the existing scale, the heaviest weight in use);
- structural devices that carry meaning (a grid break, a full-bleed band, an oversized number or image);
- the signature motif, accent colour or texture;
- density and pacing (where the page tightens or opens up).

A flat section typically opts out of the system's own strongest moves. Read the tokens and components so you know exactly which moves exist.

## Apply the amplification

- **Amplify what the system already owns.** Use its motif and type scale at full strength for this section rather than inventing new ones. The bolder version should look more like the same brand, not less.
- **Make one decisive move, completely.** Pick one: scale (the headline jumps to the top display step), contrast (the section inverts to the system's dark or accent surface), structure (the section breaks the grid or goes full-bleed), or density (it drops to one statement with generous space). Half-measures read as noise.
- **Then quiet everything around it.** Reduce competing weights, badges and accents inside the target so the move is legible. If every element got louder, the section got flatter.
- **Give it its own rhythm.** The target should read as a peak in the scroll: a shift in density or pace from its surroundings, not more of the same.
- **Keep content true.** Existing claims are in scope; keep them unless the user supplies replacements. If the direction needs real evidence (a figure, a quote, a product image) that does not exist, ask for it. Never invent metrics or testimonials.
- **Keep it usable.** Contrast stays at least 4.5:1 for text (3:1 for large text), focus states stay visible, and any added motion follows [animate](animate.md), including the reduced-motion path.

## The skeleton test

Strip the copy out of the planned section and study the bare structure. Does the skeleton still say what this section is and why it matters, through hierarchy and the system's devices alone? If it only works once the words return, the boldness is in the text size, not the design.

A placeholder for an image or artifact names a job: an anchor and a piece of evidence. It is not a cue to drop in a decorative stock photo; fill the job with whatever the subject actually has.

## Verify

Answer each with rendered evidence:

- Everything outside the named target is unchanged (diff the files; compare before and after screenshots of the neighbours).
- No new colour, font or system primitive appeared without being asked for.
- The conventions the section carried, including anything that drives an action, still work the same way.
- The section is unmistakably the same brand, only more sure of itself.
- The move holds at narrow widths: it reflows rather than overflowing or shrinking to nothing.
- The skeleton test passes.

When the target holds its own without pulling the page apart, continue with [polish](polish.md).

## Common failures

- Adding gradients, glows, shadows or animation and calling it bold.
- Introducing a new font, colour or radius the system does not own.
- Restyling neighbouring sections "for consistency".
- Making every element louder, so nothing leads.
- Boldness carried only by a bigger headline, with an unchanged structure.
- Inventing statistics, logos or testimonials to fill the louder layout.
- A decorative stock photo where a real product artifact belongs.
