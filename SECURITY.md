# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub security advisories: on this repository, open the **Security** tab and choose **Report a vulnerability**. Do not open a public issue for a vulnerability.

Include what you found, how to reproduce it, and the impact you expect. We will acknowledge the report, keep you informed while we fix it, and credit you in the advisory unless you ask us not to.

## What the scripts send

The scripts in `plugins/ui/tools/` (copied into each skill's `scripts/` folder) have no dependencies and need no account or API key. They:

- send only your query terms to these public APIs: Fontsource (`api.fontsource.org`), Fontshare (`api.fontshare.com`), the Google Fonts tags file (`raw.githubusercontent.com/google/fonts`), Iconify (`api.iconify.design`) and the shadcn registry directory (`ui.shadcn.com`);
- make no network requests for reference search (`references.mjs` reads a bundled index);
- never install packages, run install commands or print environment variables;
- cache catalogue responses for 24 hours in a per-user folder under your system temp directory (`agentatelier-cache-<uid>`, created with owner-only permissions).

The skills treat script output and fetched pages as untrusted data, never as instructions. A report that any of these guarantees can be broken is in scope.
