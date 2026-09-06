# OpenStars

**GitHub deletes your repository traffic after 14 days. OpenStars keeps it, in your own repo.**

One workflow file. Every day the action reads views, clones, referrers, popular paths and star count from the GitHub API and commits them to an `openstars` branch as JSON and CSV. No server, no account, no telemetry. The data is yours, in git, forever.

Live demo: this repository tracks itself, see the [`openstars` branch](../../tree/openstars).

## Why

GitHub's Insights → Traffic page shows the last 14 days and nothing more. Launch on Hacker News, come back three weeks later, and the numbers are gone. Existing fixes are Python scripts to run by hand, or actions that need a second action to commit. OpenStars is the whole thing in one step.

## Quick start

### 1. Token (2 minutes)

The traffic API needs a fine-grained personal access token with **Administration: read** and **Metadata: read** on the repositories you track. The workflow's built-in `GITHUB_TOKEN` cannot read traffic data, there is no way around this. Step-by-step with the exact clicks: [docs/token.md](docs/token.md).

Save it as a repository secret named `OPENSTARS_TOKEN`.

### 2. Workflow

Create `.github/workflows/openstars.yml`:

```yaml
name: OpenStars
on:
  schedule:
    - cron: "17 3 * * *"   # daily; off the full hour, GitHub throttles :00
  workflow_dispatch:
permissions:
  contents: write           # push the data branch
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: Resetnak/openstars@v1
        with:
          token: ${{ secrets.OPENSTARS_TOKEN }}
```

Run it once from the Actions tab (`workflow_dispatch`), then forget about it.

### 3. What you get

```
openstars/                      ← orphan branch, main history stays clean
├── README.md                   ← report: 30-day totals, daily table, top referrers and paths
└── data/<owner>/<repo>/
    ├── traffic.json            ← full history, schema below
    ├── traffic.csv             ← one row per day, spreadsheet-ready
    ├── badge.svg               ← "views · 30d" badge for your README
    └── sparkline.svg           ← 30-day views curve
```

`traffic.csv`:

```
date,views,unique_visitors,clones,unique_cloners,stars,forks,watchers,subscribers,open_issues
2026-09-05,142,97,11,8,1203,44,1203,31,12
```

Badge for your main README:

```md
![views](https://raw.githubusercontent.com/<owner>/<repo>/openstars/data/<owner>/<repo>/badge.svg)
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `token` | required | Fine-grained PAT with Administration: read |
| `github_token` | `${{ github.token }}` | Token that pushes the data branch |
| `repos` | current repo | Repositories to track, `owner/name`, one per line |
| `data_branch` | `openstars` | Orphan branch for the data |
| `data_path` | `data` | Directory inside the branch |
| `report` | `true` | Generate README.md, badge.svg, sparkline.svg |
| `releases` | `false` | Also record release asset download counts (token needs Contents: read) |
| `commit_message` | `openstars: {date}` | `{date}` is the run date |
| `git_user_name` / `git_user_email` | `openstars[bot]` | Committer identity |

Outputs: `views_14d`, `clones_14d`, `stars` (first tracked repo), `data_branch`, `changed`.

## Track several repositories from one workflow

```yaml
      - uses: Resetnak/openstars@v1
        with:
          token: ${{ secrets.OPENSTARS_TOKEN }}
          repos: |
            me/project-one
            me/project-two
            my-org/library
```

The token must have access to every listed repository. All data lands in the branch of the repository running the workflow, under `data/<owner>/<repo>/`. One repository failing does not stop the others; the job summary lists what went wrong.

## Data format

`traffic.json` (schema 1):

```json
{
  "schema": 1,
  "repo": "owner/name",
  "first_collected": "2026-09-06",
  "last_collected_at": "2026-10-06T03:17:41Z",
  "daily": [
    { "date": "2026-10-05", "views": 142, "views_uniques": 97, "clones": 11, "clones_uniques": 8,
      "stars": 1203, "forks": 44, "watchers": 1203, "subscribers": 31, "open_issues": 12, "size_kb": 5120 }
  ],
  "referrers": { "2026-10-05": [ { "referrer": "news.ycombinator.com", "count": 88, "uniques": 70 } ] },
  "paths":     { "2026-10-05": [ { "path": "/owner/name", "title": "…", "count": 120, "uniques": 90 } ] },
  "releases":  { "2026-10-05": [ { "tag": "v1.2.0", "downloads": 3456 } ] }
}
```

Details and the rules for how days are merged: [docs/data-format.md](docs/data-format.md).

## FAQ

**Why a personal token and not `GITHUB_TOKEN`?**
Traffic endpoints require the `Administration: read` repository permission. `GITHUB_TOKEN` cannot be granted it. A fine-grained PAT scoped to just your repositories with only that read permission is the minimum GitHub allows.

**Why an orphan branch?**
Daily commits on `main` would bury your real history and contributor graphs. The data branch has no common ancestor with `main`, so it never shows up in pull requests or `git log`.

**Yesterday's number changed. Is something broken?**
No. GitHub revises traffic counts for a few days after the fact. OpenStars overwrites the whole 14-day window on every run, so the branch always holds GitHub's latest figures. Days older than 14 days are never touched.

**The workflow stopped running.**
GitHub disables scheduled workflows in repositories with no activity for 60 days and emails you about it. Re-enable it from the Actions tab. Data collection resumes from the next run; a gap longer than 14 days cannot be recovered, GitHub no longer has it either.

**How do I delete the data?**
Delete the `openstars` branch. Nothing else exists.

**Does it phone home?**
No. The only hosts contacted are `api.github.com` and `github.com`. There is no telemetry and no third party. See [SECURITY.md](SECURITY.md).

## Comparison

| | OpenStars | [traffic-lite](https://github.com/nsaunders/traffic-lite) | [github-repo-stats](https://github.com/jgehrcke/github-repo-stats) | [Repohistory](https://repohistory.com) |
|---|---|---|---|---|
| Views, clones | ✓ | ✓ | ✓ | ✓ |
| Referrers, paths, stars | ✓ | – | ✓ | ✓ |
| Commits by itself | ✓ | – (needs add-and-commit) | ✓ | n/a |
| Runtime | Node, no dependencies | Node | Python in Docker | hosted service |
| Multi-repo in one workflow | ✓ | – | – | ✓ |
| CSV export | ✓ | – | ✓ | ✓ |
| Needs an account | – | – | – | ✓ |

## Want charts, alerts and no token to manage?

OpenStars is deliberately minimal: it archives, it doesn't analyze. If you want dashboards across repos, Slack/Discord alerts when a release or launch moves the numbers, and a GitHub App instead of a personal token, [RepoMeter](https://repometer.online) is the hosted version by the same author. It reads the same CSV format, so you can start here and move later, or the other way round. OpenStars stays free and standalone either way.

## Contributing

`npm install`, `npm test`. The test suite runs unit tests plus an end-to-end run against a mock GitHub API and a local bare repository, no token needed. `dist/` is committed and CI fails when it does not match `src/`, so run `npm run build` before you push. More in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
