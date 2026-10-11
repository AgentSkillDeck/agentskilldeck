# Coverage: deck-design SKILL.md

Source: uizze `skills/ui-design/SKILL.md` @ 146928e (46 lines, 30 non-blank including frontmatter delimiters) → `plugins/ui/skills/deck-design/SKILL.md`. Every source line appears below; multi-sentence lines are split by sentence.

| uizze source (verbatim) | carried by (our SKILL.md) |
|---|---|
| `name: ui-design` | frontmatter `name: deck-design` |
| description: "Design, build, or improve web and mobile interfaces using real product examples from UIZZE’s 800,000+ web and iOS screens." | frontmatter description, sentence 1 (branding and screen count dropped; evidence comes from the bundled index and materials scripts) |
| description: "Use for UI design, UX design, frontend or web design, mobile app UI, responsive layouts, design systems, redesigns, visual polish, interface critique, and requests like “make this UI better.”" | frontmatter description, sentence 2 (keeps every trigger; adds iOS/Android, choosing fonts or icons, "pick a font for our landing page", bolder/quieter/simplify phrases; ends "Not for judging an existing UI without changing it; use deck-review"). "interface critique" moved to the deck-review description so the two skills trigger distinctly; deck-design still routes to [critique] |
| `license: Apache-2.0` | frontmatter `license: Apache-2.0` |
| `metadata: uizze-version / design-stack-version` | dropped (vendor version metadata) |
| `# Uizze UI Design` | `# Deck design` (branding dropped) |
| `## Work from the product` | `## Work from the product` |
| Read the brief, existing UI, components, tokens, assets, and any PRODUCT.md or DESIGN.md before designing. | Work from the product › 1 (adds neighbouring screens) |
| The user's request and project constraints outrank this skill. | Work from the product › 2 ("and every guide") |
| Preserve an established visual system for extensions and polish; replace it only for an approved redesign. | Work from the product › 3 |
| A new project does not require those files. | Work from the product › 1, last sentence |
| Identify the audience, primary task, important states, and intended result. | Work from the product › 4 (names the states) |
| Ask only about missing choices that would materially change the work. | Work from the product › 5 |
| A precise request is enough to proceed; do not turn a small fix into a discovery workshop. | Work from the product › 5, sentence 2 |
| `## Select the workflow` | `## Choose the guide` |
| Load the playbook for the requested action, plus the platform and craft guidance needed to execute it: | Choose the guide › opening sentence |
| - New interface or major redesign: [new-work] | table row "New screen, page, flow or product, or an approved redesign" |
| - Product or dashboard work: [operate] | table row "App screens, dashboards, settings, tables, admin and tools" |
| - Refinement and polish: [polish] | table row "Refine, tidy or finish something that exists" |
| - Simplification: [distill] | table row "Cluttered or busy; the user wants it simpler" |
| - Explicit audit: [audit], read-only unless fixes were requested | table row "Explicit audit or technical quality check; read-only unless fixes were requested" |
| - Native iOS: [iOS], alongside the action's playbook | table row "Native iOS or iPadOS, alongside the action's guide" (Android row added) |
| - Explicit `/overdrive`, “Uizze Overdrive”, or a request for exceptional interaction work: [Overdrive] | table row "Explicit "overdrive" or exceptional interaction work" |
| For implementation, use [craft] after the direction is settled. | table row "Implementing or handing off, once the direction is settled" |
| Load only relevant files; multiple complementary playbooks are allowed. | Choose the guide › opening, sentence 2 (with an example combination) |
| Overdrive is opt-in, not the default for ordinary UI work. | paragraph under table, sentence 1 |
| It requires a chosen direction before implementation. | paragraph under table, sentence 1 ("needs a chosen direction before any implementation") |
| “Use Uizze Overdrive on this screen” works through this router; a native slash command depends on the host. | paragraph under table, sentence 2 (branding dropped) |
| These are self-contained Markdown playbooks, not an installer, background service, or executable engine. | intro, sentence 2 |
| `## Optional Uizze evidence` | `## Materials and references` |
| Read [the reference policy] before using `find_ui_references` or `find_ui_materials`. | Materials and references › sentence 1 (paid tool names replaced with `node scripts/references.mjs` / `node scripts/materials.mjs`; run-from-skill-folder rule added) |
| Inspect relevant visual evidence when it can inform the layout, state, interaction, or assets. | bullet 3 "Look things up only when the evidence could change a layout, state, interaction or asset decision"; bullet 4 (open the link in the browser tool) |
| Use the host's available tools, not invented calls or connections. | bullet 3, sentence 2 |
| Paid retrieval is optional; missing access does not block local design work. | bullet 3, sentence 3 ("Missing scripts, network or browser never block local design work"; paid framing dropped) |
| Distinguish an exact reference, a related example, no match, and a service error. | bullet 5, sentence 1; exit-code bullets 1–2 map each outcome |
| Briefly disclose a limitation that affected the result. | bullet 5, sentence 2 |
| Never claim an image was inspected or a state was found without evidence. | bullet 5, sentence 3 |
| `## Finish` | `## Finish` |
| Build the requested scope and exercise its important states. | Finish › 1 |
| Render and inspect the real result at representative desktop/mobile sizes or native device classes, including the user's reported failing size. | Finish › 2 (375/768/1440 px per layout) |
| Compare it with the chosen direction or supplied reference, not just with the absence of runtime errors. | Finish › 3 |
| Fix material problems in a batch, then render and inspect again. | Finish › 4, sentence 1 |
| Stop once the requested result is verified; do not keep inventing work. | Finish › 4, sentence 2 (adds a two-round ceiling) |
| If a bounded pass cannot resolve an issue, report it instead of claiming a pass. | Finish › 5, sentence 1 |
| When rendering is unavailable, distinguish code checks from visual verification. | Finish › 5, sentence 2 |
| Keep the handoff concise: what changed, what was actually tested, and any remaining limitation. | Finish › hand-off paragraph |
| A skill does not authorize publishing, purchases, new dependencies, account changes, or destructive actions. | Limits › bullet 1 (adds deploying, permission changes and examples of destructive actions) |
