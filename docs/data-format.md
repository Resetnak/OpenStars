# Data format

All files live in the data branch (default `openstars`) under `data/<owner>/<repo>/`.

## traffic.json

Schema version 1. One file per repository.

| Field | Type | Meaning |
|---|---|---|
| `schema` | `1` | Format version; a future version bumps this and migrates |
| `repo` | string | `owner/name` |
| `generator` | string | `openstars/<version>` of the last run that changed data |
| `first_collected` | date | First run date, UTC |
| `last_collected_at` | ISO timestamp | Last run that changed data |
| `daily[]` | array | One object per day, ascending |
| `referrers{}` | date → array | Top referrers snapshot per run date |
| `paths{}` | date → array | Popular paths snapshot per run date |
| `releases{}` | date → array | Release download totals per run date (only with `releases: true`) |

### daily[]

| Field | Meaning |
|---|---|
| `date` | UTC day |
| `views`, `views_uniques` | From `traffic/views?per=day` |
| `clones`, `clones_uniques` | From `traffic/clones?per=day` |
| `stars`, `forks`, `watchers`, `subscribers`, `open_issues`, `size_kb` | Repository metadata on the run date; `null` for days before OpenStars was installed |

### Merge rules

- GitHub returns the last 14 days including today. Every run overwrites all 14 days, because GitHub revises counts for a few days after the fact. Days the API omits inside the window are stored as `0`.
- Days older than the window are never modified.
- Today is always partial. The report excludes it from 30-day totals; the CSV includes it.
- Referrers and paths are 14-day aggregates without dates in the API, so they are stored as one snapshot per run date. A second run the same day replaces that day's snapshot.
- If a run produces identical data (same day, no new activity) nothing is committed and the timestamps stay unchanged.

## traffic.csv

Header, identical to the RepoMeter export so the file moves between the two without conversion:

```
date,views,unique_visitors,clones,unique_cloners,stars,forks,watchers,subscribers,open_issues
```

One row per entry in `daily[]`, ascending. `null` renders as an empty cell. RFC 4180 quoting, UTF-8, LF line endings.

## badge.svg, sparkline.svg

Regenerated every run. The badge shows views over the last 30 full days. The sparkline plots the same 30 values scaled to their maximum; an all-zero month is a flat line. Both are plain SVG with no external resources.
