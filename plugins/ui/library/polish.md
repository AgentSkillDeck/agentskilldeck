<!-- Adapted from Impeccable reference/polish.md @ d631a88 (Apache-2.0) and uizze ui-design reference/polish.md @ 146928e (Apache-2.0); modified by agentskilldeck -->
# Refine an existing interface

Use this guide when the user asks to polish, tidy, tighten or finish an interface that already exists.

Polish improves the interface that exists; it never conceals a redesign. Preserve the product's visual language, content, behaviour and scope unless the user explicitly asks to change them. If the concept itself is wrong, say so and recommend a redesign ([new-work](new-work.md)) or [bolder](bolder.md) instead of smuggling one in.

## 1. Establish the system

Read the design notes (for example `DESIGN.md`) if present, the tokens, shared components and one or two neighbouring flows. Without a formal system, the coherent conventions in the code are the system. Classify each inconsistency before fixing it, and fix it at the narrowest correct level:

- **Missing token:** the system needs a reusable value; add it once.
- **One-off implementation:** an existing shared component should replace it.
- **Conceptual mismatch:** flow, information architecture or hierarchy differs from comparable areas.
- **Local defect:** the implementation is simply incomplete.

Ask only when a binding system principle cannot be inferred.

## 2. Inspect the real result

Render or run the interface with the host's browser, simulator or emulator. For web, check 375, 768 and 1440 px wide; for native, the shipped device classes. Judge the rendered result, not the source alone. Use the feature yourself and note: whether the path is functionally complete, known constraints or deliberately unfinished work, and the content lengths, roles and input methods users will meet. If a previous critique or audit exists, use its high-priority findings as one input, then do your own pass.

## 3. Triage

Fix the largest observable problems first, in this order:

1. Broken or blocked tasks, data loss, misleading state, inaccessible paths: controls without labels or keyboard access, contrast below 4.5:1 (3:1 for large text and UI components), focus not visible, poor keyboard behaviour.
2. Missing feedback: hover, focus, disabled, loading, empty, error, success, permission.
3. Unclear hierarchy or competing primary actions; flow, responsive and design-system drift.
4. Visual inconsistencies: spacing, typography, colour, radius, icon treatment; clipping, overlap, overflow, distorted images, awkward wrapping; decorative noise that competes with the task.
5. Code and asset cleanup.

Do not perfect one corner while the rest of the path stays below the same bar.

## 4. Fix in one coherent pass

- **Flow:** match neighbouring terminology, disclosure, save behaviour and routing. Arrival, empty and recovery paths connect instead of behaving as isolated screens.
- **Layout and type:** align to the project's grid and spacing scale, optically as well as mathematically; tight within groups, generous between them. Same-role text uses the same style. Test wrapping, 200% zoom, localisation expansion (+30% text length) and font loading.
- **Colour, imagery, icons:** semantic tokens with stable meanings across themes; one icon family, stroke and size per context; images at correct aspect ratio with reserved dimensions (no layout shift) and useful alt text.
- **Interaction:** every control has default, hover, focus, active, disabled, loading, error and success where they apply; logical tab order; touch targets ≥ 44×44 pt iOS, ≥ 48×48 dp Android, ≥ 24×24 CSS px web (≥ 44×44 for primary touch controls). Keep motion coherent and interruptible; never add animation just to make polish visible.
- **Content:** consistent terminology, capitalisation and punctuation. Ask before changing factual claims.
- **Code:** reuse existing tokens and components; remove debug output, dead code and polish-created duplication; promote a value to a token only when it is reused. Avoid speculative cleanup and leave areas that already work alone.

## 5. Verify and finish

Confirm the changed surface once more after the fixes: walk the path with mouse, keyboard and touch where applicable; recheck the sizes from step 2 plus the loading, empty, error, long-content and missing-content states; check the console for errors. Run the project's tests and linters. Finish by reading your diff and removing accidental churn, orphaned code and temporary files. Report what was checked and what was not.

For a technical pre-release check, continue with [audit](audit.md); for design judgement, [critique](critique.md).

## Common failures

- A redesign delivered under the name of polish.
- Fixing only what is in the current screenshot while other viewports still break.
- Adding animation or decoration so the change looks visible.
- New one-off values instead of existing tokens.
- "Cleaning up" working code outside the requested scope.
