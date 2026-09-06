import { GitHubError, ghGet } from "./github.js";
export const DOCS_URL = "https://github.com/Resetnak/openstars";
const toDay = (timestamp) => timestamp.slice(0, 10);
const normalizeDays = (items) => (items ?? []).map((item) => ({ date: toDay(item.timestamp), count: item.count, uniques: item.uniques }));
export function describeError(err, repo) {
    if (err instanceof GitHubError) {
        switch (err.status) {
            case 401:
                return `${repo}: token is invalid or expired. Create a new fine-grained token, see ${DOCS_URL}#token`;
            case 403:
                return `${repo}: token lacks "Administration: read" on this repository. See ${DOCS_URL}#token`;
            case 404:
                return `${repo}: repository not found or the token has no access to it. For private repositories GitHub answers 404 when the token's "Repository access" list does not include this repository; edit the token and add it. See ${DOCS_URL}#token`;
            default:
                return `${repo}: ${err.message}`;
        }
    }
    return `${repo}: ${err.message}`;
}
export async function collect(token, repo, options) {
    const now = options.now ?? new Date();
    const base = `/repos/${repo}`;
    try {
        const [views, clones, referrers, paths, meta, releases] = await Promise.all([
            ghGet(token, `${base}/traffic/views?per=day`),
            ghGet(token, `${base}/traffic/clones?per=day`),
            ghGet(token, `${base}/traffic/popular/referrers`),
            ghGet(token, `${base}/traffic/popular/paths`),
            ghGet(token, base),
            options.releases ? ghGet(token, `${base}/releases?per_page=100`) : Promise.resolve(null),
        ]);
        const snapshot = {
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
    }
    catch (err) {
        throw new Error(describeError(err, repo));
    }
}
