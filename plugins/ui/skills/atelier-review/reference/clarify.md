<!-- Adapted from Impeccable reference/clarify.md @ d631a88 (Apache-2.0); modified by agentatelier -->
# Clarify

Use this guide when interface text is the problem: vague labels, unhelpful errors, empty states with no next step, or confirmations that do not name what will happen.

Rewrite so users know what happened, what matters and what to do next. Preserve factual meaning, product terms and brand voice.

Context you need: the audience and their emotional state at each step. Infer them from the brief, design notes (for example `DESIGN.md`), existing copy and the flow before asking.

## Assess first

Read the whole interaction path in the running app, not strings in isolation. Collect the copy from the components and locale files, then mark:

- ambiguous verbs and nouns ("Process", "Item", "Manage");
- internal jargon, codes or assumed knowledge;
- states with no consequence, recovery or timing;
- the same concept under different words, or inconsistent capitalisation;
- headings, intros and helper text that repeat each other;
- strings that break at narrow widths, 200% zoom or 30–40% translation expansion;
- tone that ignores risk (money, data loss, privacy, access).

Ask before changing a factual claim, legal wording or a term that may be domain-specific.

## Set the message

For each state decide, in order: the one fact the user needs now; the next available action; context that changes the decision; the tone for this moment. Say each idea once. If the heading explains the state, the body adds new information or disappears.

## Apply

### Actions

- Verb + object when the outcome is not obvious: "Save draft", "Send invoice". A label describes the result, not the gesture ("Click here").
- One word per concept across the product. If it is "Delete" in one place, it is not "Remove" in another for the same operation.
- Sentence case for labels and headings unless the project style says otherwise.

| Before | After |
|---|---|
| [Submit] (invoice form) | [Send invoice] |
| "Click here" to get the PDF | [Download report] |
| [Manage] (team page) | [Edit members] |
| [OK] (after an export finishes) | [Open file] |

### Destructive actions and confirmations

- Prefer undo over confirmation when recovery is safe.
- When confirmation is needed, name the object and consequence in the title and repeat the action on the button. Never `Yes` / `No` / `OK`.

| Before | After |
|---|---|
| "Are you sure?" · [OK] [Cancel] | "Delete 'Q3 report'? This removes it for everyone and can't be undone." · [Delete report] [Keep report] |
| "Changes will be lost." · [Yes] [No] | "Leave without saving? Your edits to this page will be lost." · [Leave page] [Keep editing] |

### Forms

- Persistent visible labels. Placeholders show an example format, never the label.
- State format, length and eligibility rules before input, next to the field.
- Mark required and optional fields the same way on every form: mark whichever is the minority, and explain the mark once.
- Validation says what needs attention and how to fix it, without blame.

| Before | After |
|---|---|
| "Invalid input" | "Enter a date as DD/MM/YYYY" |
| "Password error" | "Use at least 12 characters" |
| "You entered the wrong email" | "This email isn't registered. Check the spelling or create an account." |

### Errors and permissions

An actionable error answers: what failed; why, when known and useful; how to recover or what remains possible. Do not lead with internal codes; do not promise a cause or fix the system cannot know. Warmth is fine on serious failures; jokes are not.

| Before | After |
|---|---|
| "Error 500" | "We couldn't save your changes. Your edits are kept here. [Try again]" |
| "Oops! Something went wrong!" (failed payment) | "Payment didn't go through. [Try another card]" (add "Your card wasn't charged" only when the payment processor confirms it) |
| "Forbidden" | "Only workspace admins can change billing. [Ask an admin]" |
| "Too many requests" | "You've sent 5 invites in a minute. Try again in 30 seconds." |

The states themselves (which failure shows what) are in [harden](harden.md).

### Loading, empty and success

- Loading names the real operation ("Importing 240 contacts…") and shows determinate progress when known. Never invent progress.
- Empty states say which kind of empty (first use, cleared by the user, no results, filtered out, no access, failed to load) and give the next action. First-use patterns are in [onboard](onboard.md).

| Before | After |
|---|---|
| "No data" | "No invoices yet. Invoices you send appear here. [Create invoice]" |
| "No results" | "No projects match 'roadmp'. Check the spelling or [clear filters]." |

- Success confirms the outcome, briefly. Mention what happens next only when it changes what the user does: "Invite sent. Sam gets access once they accept."

### Help text and links

- Helper text answers the question the control raises; it does not restate the label.
- Uncommon detail goes behind progressive disclosure.
- Link text makes sense out of context ("View pricing", not "Learn more"). Icon-only controls have accessible names matching their visible tooltip.

## Voice, accessibility and localisation

Voice stays consistent; tone adapts to the moment. Use plain language without flattening terms the audience knows.

- Write complete translatable messages with named placeholders; never concatenate fragments.
- Leave room for expansion instead of abbreviating.
- Alt text carries the image's information; decorative images get `alt=""`.
- Screen-reader names match visible labels; announce state changes with a live region.
- Do not let punctuation, colour or an icon carry the message alone.

When inconsistency spans the product, keep a short glossary of terms in the design notes. Do not vary words for literary effect.

## Verify

Answer each against the running flow; a bare "yes" is not verification:

- A reader without product knowledge can say what happened and what to do at each error, empty state and decision point.
- Every destructive confirmation names the object and the consequence, and its button names the action.
- Terminology and capitalisation match across the flow and the glossary.
- Copy fits at target widths, 200% zoom, the longest translation, long names and plural counts (0, 1, many).
- Accessible names match visible labels; state changes are announced.
- Each string is as short as it can be without losing meaning or recovery.

When the language reads cleanly, continue with [polish](polish.md).

## Common failures

- `OK` / `Yes` / `Submit` on decisions that need a named action.
- Placeholder text used as the only label.
- Raw codes or "Something went wrong" with no recovery.
- Jokes or exclamation marks on payment, privacy or data-loss errors.
- One generic "No data" for every kind of empty.
- Several words for one concept across screens.
- Heading, intro and helper text that say the same thing three times.
- Sentences assembled from fragments that cannot be translated.
