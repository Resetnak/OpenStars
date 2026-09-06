# Changelog

## 1.0.0 (unreleased)

- Daily collection of views, clones, referrers, popular paths and repository metadata.
- Optional release asset download counts (`releases: true`).
- Orphan data branch with `traffic.json`, `traffic.csv`, `badge.svg`, `sparkline.svg` and a generated report.
- Multi-repository tracking from a single workflow.
- Idempotent merges: GitHub's revisions are applied, unchanged data produces no commit.
- Zero runtime dependencies.
