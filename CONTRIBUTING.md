# Contributing

Thanks for helping. OpenStars is intentionally small; the best contribution is often a bug report with the failing `traffic.json`.

## Setup

```sh
npm install
npm test        # build, unit tests, end-to-end smoke test (no token needed)
```

Node 20 or newer. No runtime dependencies; please keep it that way. If a feature needs a package, open an issue first.

## Layout

| File | Role |
|---|---|
| `src/main.ts` | Orchestration: inputs, collect, merge, write, push, outputs, summary |
| `src/github.ts` | `fetch` wrapper with retries and rate-limit handling |
| `src/collect.ts` | The six API calls and their normalisation |
| `src/merge.ts` | Pure merge logic; every rule here has a test |
| `src/csv.ts`, `src/report.ts` | Pure renderers for CSV, README, SVG |
| `src/git.ts` | Clone or create the data branch, commit, push |
| `src/actions.ts` | Tiny stand-in for `@actions/core` |
| `test/*.test.mjs` | Unit tests against `dist/` |
| `test/smoke.mjs` | Runs the built action three times against a mock API and a local bare repo |

## Before you push

- `npm run build` and commit `dist/`. CI rejects a pull request whose `dist/` does not match `src/`.
- Add or update a test for any change in `merge.ts`, `csv.ts` or `report.ts`.
- Keep the README's tone: plain statements, no marketing.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and the version in `package.json`, rebuild, commit.
2. `git tag v1.x.y && git push origin v1.x.y`.
3. The release workflow creates the GitHub Release and moves the `v1` tag.
