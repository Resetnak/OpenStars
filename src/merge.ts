// Pure merge logic: no IO, fully unit-tested.
import type { PathHit, Referrer, ReleaseHit, Snapshot } from "./collect.js";

/** GitHub's traffic API returns at most this many days, including today. */
export const WINDOW_DAYS = 14;

export interface DailyRow {
  date: string;
  views: number;
  views_uniques: number;
  clones: number;
  clones_uniques: number;
  /** Metadata fields are null for days before OpenStars was installed. */
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  subscribers: number | null;
  open_issues: number | null;
  size_kb: number | null;
}

export interface TrafficFile {
  schema: 1;
  repo: string;
  generator: string;
  first_collected: string | null;
  last_collected_at: string | null;
  daily: DailyRow[];
  referrers: Record<string, Referrer[]>;
  paths: Record<string, PathHit[]>;
  releases: Record<string, ReleaseHit[]>;
}

export function emptyFile(repo: string): TrafficFile {
  return {
    schema: 1,
    repo,
    generator: "openstars",
    first_collected: null,
    last_collected_at: null,
    daily: [],
    referrers: {},
    paths: {},
    releases: {},
  };
}

export function blankRow(date: string): DailyRow {
  return {
    date,
    views: 0,
    views_uniques: 0,
    clones: 0,
    clones_uniques: 0,
    stars: null,
    forks: null,
    watchers: null,
    subscribers: null,
    open_issues: null,
    size_kb: null,
  };
}

/** Dates (YYYY-MM-DD, ascending) of the `days`-day window ending at `endDate` inclusive. */
export function windowDates(endDate: string, days = WINDOW_DAYS): string[] {
  const end = Date.UTC(
    Number(endDate.slice(0, 4)),
    Number(endDate.slice(5, 7)) - 1,
    Number(endDate.slice(8, 10)),
  );
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Upsert a snapshot into the file. Rules:
 * - every day inside the 14-day window is overwritten by the API (GitHub revises numbers);
 *   days the API omitted are zero inside the window;
 * - days outside the window are never touched;
 * - metadata (stars, forks, ...) is recorded on the run date only;
 * - referrers/paths/releases are stored as one snapshot per run date, replacing an earlier run that day.
 */
export function merge(file: TrafficFile, snapshot: Snapshot, generator: string): TrafficFile {
  if (file.repo !== snapshot.repo) {
    throw new Error(`traffic.json belongs to ${file.repo}, snapshot is for ${snapshot.repo}`);
  }
  const rows = new Map(file.daily.map((row) => [row.date, { ...row }]));
  const row = (date: string): DailyRow => {
    let existing = rows.get(date);
    if (!existing) {
      existing = blankRow(date);
      rows.set(date, existing);
    }
    return existing;
  };

  for (const date of windowDates(snapshot.date)) {
    Object.assign(row(date), { views: 0, views_uniques: 0, clones: 0, clones_uniques: 0 });
  }
  for (const day of snapshot.views) {
    Object.assign(row(day.date), { views: day.count, views_uniques: day.uniques });
  }
  for (const day of snapshot.clones) {
    Object.assign(row(day.date), { clones: day.count, clones_uniques: day.uniques });
  }
  Object.assign(row(snapshot.date), snapshot.meta);

  const merged: TrafficFile = {
    ...file,
    generator,
    first_collected: file.first_collected ?? snapshot.date,
    last_collected_at: snapshot.collected_at,
    daily: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)),
    referrers: { ...file.referrers, [snapshot.date]: snapshot.referrers },
    paths: { ...file.paths, [snapshot.date]: snapshot.paths },
    releases: snapshot.releases ? { ...file.releases, [snapshot.date]: snapshot.releases } : { ...file.releases },
  };
  // Idempotency: identical data on a second run the same day must not produce a commit,
  // so keep the old timestamps when nothing but the timestamps would change.
  return sameData(file, merged) ? file : merged;
}

const dataOnly = ({ daily, referrers, paths, releases, first_collected }: TrafficFile): string =>
  JSON.stringify({ daily, referrers, paths, releases, first_collected });

export const sameData = (a: TrafficFile, b: TrafficFile): boolean => dataOnly(a) === dataOnly(b);

/** Accept whatever is on disk, reject anything that is not a schema-1 traffic file. */
export function parseFile(json: string, repo: string): TrafficFile {
  const parsed = JSON.parse(json) as Partial<TrafficFile>;
  if (parsed.schema !== 1 || !Array.isArray(parsed.daily)) {
    throw new Error(`data/${repo}/traffic.json is not an OpenStars schema 1 file`);
  }
  return {
    ...emptyFile(repo),
    ...parsed,
    repo: parsed.repo ?? repo,
    referrers: parsed.referrers ?? {},
    paths: parsed.paths ?? {},
    releases: parsed.releases ?? {},
  };
}
