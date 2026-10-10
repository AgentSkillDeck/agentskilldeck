# Contributing

Thanks for helping. agentatelier has no runtime or test dependencies; you need Node 18 or later and nothing else. The npm scripts assume a POSIX shell (macOS, Linux or WSL on Windows).

## Where to edit

- Design guides: edit `plugins/ui/library/*.md`.
- Scripts: edit `plugins/ui/tools/` (tests live in `plugins/ui/tools/test/`).
- Skill workflows: edit `plugins/ui/skills/<skill>/SKILL.md` (keep it under 120 lines with valid frontmatter).

Never edit `plugins/ui/skills/*/reference/` or `plugins/ui/skills/*/scripts/` by hand. They are generated copies of the library and tools (which skill gets which guides is set in `plugins/ui/sync.json`). After changing the library or tools, regenerate them:

```sh
npm run sync
```

## Before you open a pull request

```sh
npm test && npm run check
```

`npm run check` fails if a skill copy is out of sync with the library or tools, if a SKILL.md has bad frontmatter or a broken link, or if an upstream product name or command string appears outside the attribution files. CI runs the same commands.

## Rules for the guide library

- Each topic has one owning guide (see the authority rules in [docs/coverage/library-index.md](docs/coverage/library-index.md)). Other guides state at most a one-line default and link the owner.
- When you change a numeric default, a term or a cross-link, update [docs/coverage/library-index.md](docs/coverage/library-index.md) in the same pull request.
- Adapted files keep their single-line `<!-- Adapted from … -->` provenance comment. If you adapt new material from another project, add its licence to [NOTICE](NOTICE) and a row to [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

## Rules for the reference index

- Never add a URL to `plugins/ui/tools/patterns.json` without opening it and confirming the page documents what the entry claims.
- When you touch `patterns.json`, run the live link check (it needs the network):

```sh
npm run linkcheck
```

## Script rules

- Scripts never install anything, never print environment variables, and send only the user's query terms to the public APIs they already use.
- Keep the shared contract: results limited to 1–5 (default 3), exit `0` for results or no match, `1` for usage errors, `2` when every source failed.
- Add a test with a stubbed fetch for any new source or behaviour.

## Adding a domain plugin

A new domain (for example `backend`) is a new folder under `plugins/` with its own `.claude-plugin/plugin.json`, `sync.json` (`{ "skills": {} }` to start) and `skills/`, plus an entry in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json). The `sync`, `check` and `lint` scripts already loop over every `plugins/<name>` directory that has a `sync.json`, and `test` globs `plugins/*/tools/test/*.test.mjs`, so a new plugin is picked up automatically once those files exist — no changes to `package.json` or the scripts are needed. Pass a path (for example `node scripts/sync-library.mjs plugins/ui`) to restrict a run to one plugin. Open an issue first to agree on scope.

## Licence

By contributing you agree that your contribution is licensed under [Apache-2.0](LICENSE).
