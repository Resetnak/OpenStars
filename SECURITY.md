# Security

## What the action can do

- Read traffic data and repository metadata with the token you pass as `token`. The documented setup grants only **Administration: read** and **Metadata: read** on repositories you choose.
- Push to one branch of the repository running the workflow, using the workflow's own `GITHUB_TOKEN` with `contents: write`.

## What it never does

- Contact any host other than `api.github.com` (or your `GITHUB_API_URL`) and the repository's own git remote.
- Send telemetry or usage data anywhere.
- Log the token. Both tokens are masked with `::add-mask::` before anything else runs, and git receives credentials through its config environment rather than the command line, so a failing command cannot echo them.
- Depend on third-party packages at runtime. `dist/` is compiled from `src/` with only the TypeScript compiler; CI fails if the two diverge.

## Pinning

`uses: Resetnak/openstars@v1` follows the latest 1.x release. To pin an exact build use the full commit SHA, as for any action.

## Reporting a vulnerability

Email the address on the maintainer's GitHub profile or open a private security advisory on this repository. Please do not open a public issue for security problems. You will get a reply within a few days.
