import { GitHubError, ghGet } from "./github.js";

export const DOCS_URL = "https://github.com/Resetnak/openstars";

export interface DayCount {
  date: string;
  count: number;
  uniques: number;
}
export interface Referrer {
  referrer: string;
  count: number;
  uniques: number;
}
export interface PathHit {
  path: string;
  title: string;
  count: number;
  uniques: number;
}
export interface ReleaseHit {
  tag: string;
  downloads: number;
}
export interface Meta {
  stars: number;
  forks: number;
  watchers: number;
  subscribers: number;
  open_issues: number;
  size_kb: number;
}

/** Everything one run fetched for one repository. */
export interface Snapshot {
  repo: string;
  /** Run date, UTC, YYYY-MM-DD. */
  date: string;
  collected_at: string;
  views: DayCount[];
  clones: DayCount[];
  referrers: Referrer[];
  paths: PathHit[];
  meta: Meta;
  releases?: ReleaseHit[];
}

interface ApiDayCount {
  timestamp: string;
  count: number;
  uniques: number;
}
interface ApiTraffic {
  views?: ApiDayCount[];
  clones?: ApiDayCount[];
}
interface ApiReferrer {
  referrer: string;
  count: number;
  uniques: number;
}
interface ApiPath {
  path: string;
  title: string;
  count: number;
  uniques: number;
}
interface ApiRepo {
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  subscribers_count: number;
  open_issues_count: number;
  size: number;
}
interface ApiRelease {
  tag_name: string;
  draft: boolean;
  assets: { download_count: number }[];
}

const toDay = (timestamp: string): string => timestamp.slice(0, 10);

const normalizeDays = (items: ApiDayCount[] | undefined): DayCount[] =>
  (items ?? []).map((item) => ({ date: toDay(item.timestamp), count: item.count, uniques: item.uniques }));

export function describeError(err: unknown, repo: string): string {
  if (err instanceof GitHubError) {
    switch (err.status) {
      case 401:
        return `${repo}: token is invalid or expired. Create a new fine-grained token, see ${DOCS_URL}#token`;
      case 403:
        if (err.path.includes("/releases")) {
          return `${repo}: token lacks "Contents: read", which "releases: true" needs. Add it to the token or drop the option. (${err.message})`;
        }
        return `${repo}: token lacks "Administration: read" on this repository. See ${DOCS_URL}#token (${err.message})`;
      case 404:
        return `${repo}: repository not found or the token has no access to it. For private repositories GitHub answers 404 when the token's "Repository access" list does not include this repository; edit the token and add it. See ${DOCS_URL}#token`;
      default:
        return `${repo}: ${err.message}`;
    }
  }
  return `${repo}: ${(err as Error).message}`;
}

export async function collect(
  token: string,
  repo: string,
  options: { releases: boolean; now?: Date; onWarning?: (message: string) => void },
): Promise<Snapshot> {
  const now = options.now ?? new Date();
  const base = `/repos/${repo}`;
  try {
    const [views, clones, referrers, paths, meta] = await Promise.all([
      ghGet<ApiTraffic>(token, `${base}/traffic/views?per=day`),
      ghGet<ApiTraffic>(token, `${base}/traffic/clones?per=day`),
      ghGet<ApiReferrer[]>(token, `${base}/traffic/popular/referrers`),
      ghGet<ApiPath[]>(token, `${base}/traffic/popular/paths`),
      ghGet<ApiRepo>(token, base),
    ]);
    // Releases are optional and need an extra permission; never let them sink the traffic data.
    let releases: ApiRelease[] | null = null;
    if (options.releases) {
      try {
        releases = await ghGet<ApiRelease[]>(token, `${base}/releases?per_page=100`);
      } catch (err) {
        options.onWarning?.(describeError(err, repo));
      }
    }

    const snapshot: Snapshot = {
      repo,
      date: toDay(now.toISOString()),
      collected_at: now.toISOString(),
      views: normalizeDays(views.views),
      clones: normalizeDays(clones.clones),
      referrers: referrers.map(({ referrer, count, uniques }) => ({ referrer, count, uniques })),
      paths: paths.map(({ path, title, count, uniques }) => ({ path, title, count, uniques })),
      meta: {
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        watchers: meta.watchers_count,
        subscribers: meta.subscribers_count,
        open_issues: meta.open_issues_count,
        size_kb: meta.size,
      },
    };
    if (releases) {
      snapshot.releases = releases
        .filter((release) => !release.draft)
        .map((release) => ({
          tag: release.tag_name,
          downloads: release.assets.reduce((sum, asset) => sum + asset.download_count, 0),
        }));
    }
    return snapshot;
  } catch (err) {
    throw new Error(describeError(err, repo));
  }
}
