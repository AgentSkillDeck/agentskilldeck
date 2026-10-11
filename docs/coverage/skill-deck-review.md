# Coverage: deck-review SKILL.md

Source: uizze `skills/anti-ui-slop/SKILL.md` @ 146928e (70 lines, 45 non-blank) → `plugins/ui/skills/deck-review/SKILL.md`. Every source line appears below; multi-sentence lines are split by sentence. Lines 36–70 repeat ui-design's body; they are carried in review form (critique, audit, finish gate; read-only unless fixes are requested).

| uizze source (verbatim) | carried by (our SKILL.md) |
|---|---|
| `name: anti-ui-slop` | frontmatter `name: deck-review` |
| description: "Stop coding agents from shipping generic UI." | frontmatter description "…and catch generic template UI" |
| description: "Use UIZZE's 800,000+ real web and iOS screens to build product-specific interfaces, define a design contract, cover required states, and run a hard finish gate." | description "gate … against its brief before it ships"; Work from the product › 3 (design contract), 5 (required states); Choose the guide › finish-gate row; Finish › verdict. Building moved to deck-design; branding dropped |
| description: "Use when designing, implementing, redesigning, critiquing, or pre-ship reviewing a web or iOS interface in Codex, Claude Code, Cursor, Copilot, or another coding agent." | description "Critique, audit or gate a built web, iOS or Android interface"; "pre-merge design checks"; designing/implementing triggers belong to deck-design; host list dropped |
| description: "Trigger with "anti-ui-slop", "stop UI slop", "ground this UI in real screens", or "run the UI finish gate"." | description triggers "stop UI slop", "run the UI finish gate", "does this look generic"; "ground this UI in real screens" belongs to deck-radar ("find UI references") |
| `license: Apache-2.0; see LICENSE and NOTICE for attribution` | frontmatter `license: Apache-2.0`; LICENSE and NOTICE synced into the folder |
| `allowed-tools: Read, Glob, Grep, WebFetch` | intro "Read-only by default. Read, search and render; do not edit files unless the user asked for fixes"; sync.json ships the scripts (tools: true, since Task 13.5) for lookups its guides need; edits still only when fixes are requested |
| `metadata: version / author / compatibility / tags` | dropped (vendor metadata); compatibility claim "works in any agent that can read project files" reflected by Materials › bullet 3 "Missing scripts, network or browser never block the review: fall back to code reading and say so" |
| > **Stop AI coding agents from shipping generic UI.** | dropped (banner); purpose kept in the description |
| `# Stop Making UI Slop` | `# Deck review` |
| Build product-specific UI with 800,000+ real web and iOS screens via [UIZZE]. | dropped (marketing) |
| `![Stop Making UI Slop with UIZZE](…banner.png)` | dropped (banner) |
| `## Overview` | intro |
| Use the product brief, existing UI, components, and local design system to make intentional interfaces. | intro sentence 1 ("Judge a built interface against the product's brief"); Work from the product › 2 |
| Uizze supplies focused design guidance and, when useful, a small number of relevant visual references. | intro sentence 2 (guides in `reference/`); Materials › `references.mjs` / `materials.mjs` commands |
| `## Prerequisites` | Work from the product › 1 |
| - A screen or component to build, redesign, or review — a file path or a short description. | Work from the product › 1 (adds route or screenshot; ask if missing) |
| - The product's existing components, design tokens, and visual language, so the build extends them instead of inventing a new system. | Work from the product › 2 and 4 (judge against the established system) |
| - Optional access to the paid Uizze MCP for focused references and hosted materials. | dropped (paid access) |
| `## Authentication` | dropped heading; no account is needed |
| - The free skill and public catalogue work without an account, token, MCP connection, dependency, script, or executable. | Materials › scripts need no account or credentials (reference-policy); "Missing scripts, network or browser never block the review: fall back to code reading" |
| - The optional full UIZZE MCP may use the host's normal connection and authentication flow. Never claim it is connected without an actual host result. | paid MCP dropped; "never claim a tool is connected or ran without an actual result" in Materials › bullet 5 |
| `## Work from the product` | `## Work from the product` |
| Read the brief, existing UI, components, tokens, assets, and any PRODUCT.md or DESIGN.md before designing. | Work from the product › 2 |
| The user's request and project constraints outrank this skill. | Work from the product › 4, sentence 1 |
| Preserve an established visual system for extensions and polish; replace it only for an approved redesign. | Work from the product › 4, sentence 2 (as a review criterion) |
| A new project does not require those files. | Work from the product › 2, last sentence |
| Identify the audience, primary task, important states, and intended result. | Work from the product › 5 |
| Ask only about missing choices that would materially change the work. | Work from the product › 6 ("would change the verdict") |
| A precise request is enough to proceed; do not turn a small fix into a discovery workshop. | Work from the product › 6, sentence 2 |
| `## Select the workflow` | `## Choose the guide` |
| Load the playbook for the requested action, plus the platform and craft guidance needed to execute it: | Choose the guide › table plus ios/android rows and the fixes paragraph |
| - New interface or major redesign: [new-work] | fixes paragraph (approved redesign) |
| - Product or dashboard work: [operate] | fixes paragraph |
| - Refinement and polish: [polish] | fixes paragraph |
| - Simplification: [distill] | fixes paragraph |
| - Explicit audit: [audit], read-only unless fixes were requested | table row "Audit…"; intro read-only rule |
| - Native iOS: [iOS], alongside the action's playbook | table row "Native iOS or iPadOS, alongside the above" (Android added) |
| - Explicit `/overdrive`, “Uizze Overdrive”, or a request for exceptional interaction work: [Overdrive] | fixes paragraph "overdrive only when explicitly asked" |
| For implementation, use [craft] after the direction is settled. | fixes paragraph "Use craft once the direction is settled"; craft is also the finish-gate floor |
| Load only relevant files; multiple complementary playbooks are allowed. | fixes paragraph last sentence; table rows combine ("alongside the above") |
| Overdrive is opt-in, not the default for ordinary UI work. It requires a chosen direction before implementation. | fixes paragraph "overdrive is opt-in and needs a chosen direction first" |
| “Use Uizze Overdrive on this screen” works through this router; a native slash command depends on the host. | dropped for review (building with overdrive routes through deck-design, whose SKILL.md carries this line) |
| These are self-contained Markdown playbooks, not an installer, background service, or executable engine. | intro sentence 2 |
| `## Optional Uizze evidence` | `## Materials and references` |
| Read [the reference policy] before using `find_ui_references` or `find_ui_materials`. | table row reference-policy; Materials › sentence 1 "Read reference-policy before running either script" (paid tool names replaced with the two scripts) |
| Inspect relevant visual evidence when it can inform the layout, state, interaction, or assets. | Materials › bullet 3 "Look things up only when the evidence could change a finding"; bullet 4 (open the link in the browser tool) |
| Use the host's available tools, not invented calls or connections. | Materials › bullet 3 "Use the host's real tools, never invented calls or connections" |
| Paid retrieval is optional; missing access does not block local design work. | Materials › bullet 3 "Missing scripts, network or browser never block the review" (paid framing dropped) |
| Distinguish an exact reference, a related example, no match, and a service error. | Materials › bullet 5, sentence 1; exit-code bullets 1–2 |
| Briefly disclose a limitation that affected the result. | Materials › bullet 5 "Briefly disclose any limitation that affected the result"; Finish › Method and Could not verify |
| Never claim an image was inspected or a state was found without evidence. | Materials › bullet 5, sentence 2 |
| `## Finish` | `## Finish` |
| Build the requested scope and exercise its important states. | Finish › 2 (exercise every required state); building only when fixes requested |
| Render and inspect the real result at representative desktop/mobile sizes or native device classes, including the user's reported failing size. | Finish › 1 |
| Compare it with the chosen direction or supplied reference, not just with the absence of runtime errors. | Finish › 3 |
| Fix material problems in a batch, then render and inspect again. | Finish › fixes paragraph, sentence 1 |
| Stop once the requested result is verified; do not keep inventing work. | Finish › 4 ("do not keep inventing findings"); fixes paragraph two-round stop |
| If a bounded pass cannot resolve an issue, report it instead of claiming a pass. | Finish › fixes paragraph, sentence 2 |
| When rendering is unavailable, distinguish code checks from visual verification. | Finish › fixes paragraph, sentence 3; report item 5 (Could not verify) |
| Keep the handoff concise: what changed, what was actually tested, and any remaining limitation. | Finish › fixes paragraph, last sentence; report items 1–5 |
| A skill does not authorize publishing, purchases, new dependencies, account changes, or destructive actions. | Limits › bullet 1 |
