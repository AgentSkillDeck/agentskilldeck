# Library index

One row per guide in `plugins/ui/library/`: when to use it, the numeric defaults it states, the recurring terms it uses (with counts), and the guides it links to. Built for Task 12.5 (consistency pass) and kept for contributors: when you change a default or a cross-link, update this file.

## Authority rules

Each topic has one owning guide; other guides state at most a one-line default and link it.

| Topic | Owner |
|---|---|
| Type: scale, line height, measure, fonts | typeset |
| Colour: strategy, neutrals, contrast | colorize |
| Motion: durations, easing, reduced motion | animate |
| Spacing and test widths (375 / 768 / 1440, 320 for smallest phones) | layout |
| Responsive and device adaptation | adapt |
| States, errors, i18n | harden |
| UX copy | clarify |
| Technical checks and the P0–P3 severity scale | audit |
| Design judgement and its report contract | critique |
| Quality floor and absolute bans (eyebrow/kicker ban is absolute) | craft |
| Platform conventions | ios, android |

Shared defaults: contrast 4.5:1 body, 3:1 large text (≥ 24px or ≥ 18.66px bold) and UI components, disabled controls exempt but distinguishable; touch targets 44×44pt iOS, 48×48dp Android, 24 CSS px web minimum and 44px for primary touch controls; motion 150–300 ms for state changes, 300–500 ms for overlays and view transitions; Core Web Vitals good at LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.

## Vocabulary

| Concept | Library term | Synonyms kept only where |
|---|---|---|
| empty / zero / blank-slate state | empty state | none |
| dialog / modal | dialog ("modal" only when describing modality, e.g. "a modal for a task that needs neither interruption nor protected focus") | none |
| toast / snackbar / notification | toast | android uses Material's "snackbar" as the platform term; "notifications" elsewhere means OS notification permission |
| skeleton / placeholder | skeleton | "placeholder" means input placeholder text, or a sized fallback for a missing asset |
| primary action / CTA | primary action | none |
| design notes / DESIGN.md | design notes (e.g. DESIGN.md) | DESIGN.md named alone where a rule is about that file (never overwrite it) |
| brief | the brief | new-work's "development brief" (an existing project document) |

## Guides

| Guide | Use when | Numbers stated | Terms (count) | Links to |
|---|---|---|---|---|
| adapt | when an existing design must work in a different context: another screen size, input method, device class, orientation, platform (iOS, Android, web), or medium (print, email). | press feedback ≤ ~100 ms; input text ≥ 16px; breakpoints 640/768/1024px; email 600px wide; print margin ~2cm; Android window classes < 600 / 600–839 / ≥ 840dp (per android); coarse-pointer controls ≥ 44px; test widths 320/375/768/1024/1440/2560px; bottom bar 3–5 destinations | dialog (2), primary action (2), the brief (1), design notes (1), DESIGN.md (1) | android, ios, layout, optimize, polish, typeset |
| android | when building or reviewing a native Android app: Jetpack Compose, Android Views, React Native, Expo or Flutter shipping to Android hardware. | window classes < 600 / 600–839 / 840–1199 / 1200–1599 / ≥ 1600dp; navigation bar 3–5 destinations; targets 48×48dp, 8dp apart, 24dp icon; font scale to 200% (test 1.3, 2.0); contrast 4.5:1 / 3:1; Material durations 50–200 / 250–400 / 450–600 ms; SDK 35+ on Android 15+; dynamic colour Android 12+ | dialog (5), toast (1), snackbar (3), primary action (2) | animate, colorize, ios, polish, typeset |
| animate | when adding or fixing motion: feedback on actions, state and layout transitions, navigation continuity, or one authored focal moment. | 100–150 ms feedback; 150–300 ms state change (default); 300–500 ms layout/overlay/view transition; 500–800 ms authored entrance; exits 60–75% of entrance; easing cubic-bezier(0.16, 1, 0.3, 1); feedback > ~300 ms reads as latency; stagger 30–60 ms per item, ~300 ms total; loops > 5 s need pause; ≤ 3 flashes/s | – | android, ios, operate, polish |
| audit | when the user explicitly asks for an audit or technical quality check of a built interface, web or native. | widths 375/768/1440px (+320px); contrast 4.5:1 / 3:1; targets 24 CSS px (44 primary touch) / 44pt / 48dp; dimension scores 0–4 × 5, total /20 with bands 18–20, 14–17, 10–13, 6–9, 0–5; severity P0–P3 (library authority) | the brief (1) | adapt, android, critique, harden, ios, optimize, polish |
| bolder | when an existing section or screen reads flat and the task asks to make it bolder, stronger or more confident inside a visual world that has already shipped. | widths 375/768/1440px; contrast 4.5:1 / 3:1 | skeleton (3), the brief (1) | animate, new-work, polish |
| clarify | when interface text is the problem: vague labels, unhelpful errors, empty states with no next step, or confirmations that do not name what will happen. | 30–40% translation expansion; 200% zoom; plural counts 0, 1, many | empty state (3), the brief (1), design notes (2), DESIGN.md (1) | harden, onboard, polish |
| colorize | when an interface needs colour to carry hierarchy, meaning or atmosphere: grey screens where state is hard to read, a palette with no roles, contrast failures, or a missing dark theme. | OKLCH neutral chroma 0.005–0.02; contrast 4.5:1 body/placeholder, 3:1 large text (≥ 24px or ≥ 18.66px bold), 3:1 controls/icons/focus; disabled exempt but distinguishable (library authority) | empty state (1), primary action (2), the brief (2), design notes (1), DESIGN.md (1) | android, craft, ios, new-work, operate, polish |
| craft | when implementing or handing off any interface, after the direction is chosen. It is a floor, not a substitute for a direction. | one-line type defaults per typeset (45–75ch, 1.5–1.6, ≤ 6rem, ≥ −0.04em); contrast 4.5:1 / 3:1 (large ≥ 24px or ≥ 18.66px bold); card radii 12–16px; 2× raster; coloured side borders > 1px refused; targets 44pt / 48dp / 24 CSS px (44 primary touch); widths 375px and 320px; 200% text | modal (1), the brief (2) | audit, critique, typeset |
| critique | when asked to review, critique or judge a built interface (a screen, flow or whole surface) against its brief before anyone changes it. | widths ~375/768/1440px or one phone + one tablet; contrast 4.5:1 / 3:1; heuristics 0–4 × 10, typical 20–32/40, bands 90/70/50/30%; ≤ 4 options per decision (5–7 group, 8+ overloaded); load failures 0–1 / 2–3 / 4+; ≤ 5 top-level nav items; persona checks 60 s, 5 s; targets 44pt / 48dp; severity per audit | dialog (3), modal (1), primary action (1), the brief (11), design notes (3), DESIGN.md (1) | adapt, android, animate, audit, bolder, clarify, colorize, craft, delight, distill, harden, ios, layout, onboard, optimize, polish, quieter, shape, typeset |
| delight | when an interface works but feels anonymous, and the task asks for personality, polish or memorable moments. | 150–300 ms state changes (per animate); up to ~800 ms for rare milestones; 150–200 ms save check; repeat test 5× | modal (2), the brief (1), design notes (2), DESIGN.md (1) | animate, clarify, onboard, operate, polish |
| distill | when an interface feels cluttered, busy or hard to use and the user wants it simpler. | reduction target: 1–2 colours + neutrals, 1 family, 3–4 sizes, 2–3 weights | modal (1), primary action (1), the brief (1) | polish |
| harden | when an interface works with ideal data and must survive real inputs: errors, empty, long, RTL or translated content, offline and slow networks, missing permissions, rate limits and concurrent actions. | 100+ char strings; 1,000,000+; 0 / 1 / 1,000+ items; 50+ select options; 30–40% expansion; request timeout 10–15 s; backoff 1/2/4 s; skeleton for waits > ~300 ms; progress for > ~10 s; debounce 250–300 ms; throttle ~100 ms; 10× rapid submit | empty state (2), dialog (2), skeleton (1), the brief (1) | clarify, layout, onboard, polish, typeset |
| ios | when building or reviewing any iOS or iPadOS app (SwiftUI, UIKit, React Native, Expo or Flutter on Apple hardware), alongside the task's main guide. | tab bar 2–5 destinations; targets 44×44pt; body 17pt, nothing below 11pt; progress for > ~1 s; contrast 4.5:1 | – | overdrive, polish |
| layout | when the structure is the problem: unclear reading order, weak grouping, monotonous spacing, framework-default grids, or breakage across viewports. | test widths 375/768/1440px, 320px for smallest phones (library authority); spacing scale 4px base (4, 8, 12, 16, 24, 32, 48, 64, 96); between-group space ≥ 2× within-group; targets 44pt / 48dp / 24 CSS px (44 primary touch) | empty state (2) | android, craft, ios, new-work, operate, polish |
| new-work | when building a new screen, page, flow or product, or when the user has approved replacing an existing visual language. | 2–3 questions; 2–3 directions; ~150-word contract; first viewport readable in 5 s; measure 65–75ch (45ch narrow); widths 375/768/1440px, 320px; two inspection rounds | primary action (3), the brief (6), design notes (2), DESIGN.md (2) | android, colorize, craft, critique, ios, operate, overdrive, polish, reference-policy, typeset |
| onboard | when designing or fixing first-run experiences: welcome and setup flows, first-use empty states, feature discovery, tours and in-product help. | 1–3 front-loaded concepts; ≤ 5 setup steps (aim 3); tours 3–7 steps; one hint on screen | empty state (6), modal (3), primary action (1), the brief (2), design notes (1), DESIGN.md (1) | clarify, delight, harden, polish |
| operate | when building app screens, admin dashboards, settings, data tables, tools and any authenticated surface where the user is doing a task. | tables 120+ chars, prose 65–75; type ratio 1.2–1.25 (per typeset); contrast 4.5:1 / 3:1; targets 24 CSS px (44 primary touch) / 44pt / 48dp; motion 150–300 ms (per animate); widths 375/768/1440px | empty state (1), dialog (3), modal (3), skeleton (1), primary action (1) | android, animate, colorize, ios, polish, typeset |
| optimize | when an interface is slow or janky: slow first load, layout shift, laggy input, dropped frames during scroll or animation, or heavy bundles and images. | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75; 16.7 ms frame; Lighthouse median of 3; 4× CPU slowdown; image quality 75–85; long tasks > 50 ms; DOM ~1,500 nodes / 32 levels; debounce 250–300 ms; preload 1–3 resources | – | animate, harden, polish, typeset |
| overdrive | only when the user explicitly asks for overdrive, or for ambitious, technically exceptional interaction work on an existing experience. It is opt-in, never the default for ordinary UI work. It is a design workflow using the host's existing tools, not a command to download an engine. | 2–3 directions; 60 fps target, simplify below ~50 fps | dialog (1), primary action (1) | android, craft, ios, polish |
| polish | when the user asks to polish, tidy, tighten or finish an interface that already exists. | widths 375/768/1440px; contrast 4.5:1 / 3:1; +30% localisation; targets 44pt / 48dp / 24 CSS px (44 primary touch) | primary action (1), design notes (1), DESIGN.md (1) | audit, bolder, critique, new-work |
| quieter | when a design is too loud, aggressive or overstimulating and the task asks to calm it down without losing personality or turning generic. | saturation to ~70–85%; weights 900→600, 700→500; motion travel 10–20px; ease-out-quart cubic-bezier(0.25, 1, 0.5, 1); contrast 4.5:1 / 3:1 | primary action (1), the brief (2) | animate, colorize, distill, layout, operate, polish, typeset |
| reference-policy | when running the reference or material scripts or using any outside page as design evidence. | Node 18+; results default 3, max 5; exit codes 0 / 1 / 2 | dialog (2), the brief (1), DESIGN.md (1) | none (ships alone in deck-radar) |
| shape | when the task is to decide what should be made and how it should work before building: it returns the confirmed brief, never code. | 2–3 questions per round, 1 round default; acceptance checks 3–6; settled brief 3–5 bullets | empty state (1), the brief (9), design notes (1), DESIGN.md (1) | critique, new-work, reference-policy |
| typeset | when typography is the problem: weak hierarchy, arbitrary sizes, poor reading comfort, unfit faces, or font loading that shifts or hides text. | body ≥ 16px, labels ≥ 12px; measure 65–75ch (45ch narrow); line height body 1.5–1.6, headings 1.1–1.25, display 1.0–1.1; display ≤ 6rem; tracking ≥ −0.04em (−0.02 to −0.03em); ratio 1.2–1.25 product, 1.333–1.5 display; > ~8 sizes = no system; light-on-dark +0.05–0.1 leading, +0.01em; label tracking +0.04–0.08em; preload 1–2 files; contrast 4.5:1 / 3:1 (library authority for type) | the brief (1), design notes (1), DESIGN.md (1) | android, craft, ios, new-work, operate, polish |
