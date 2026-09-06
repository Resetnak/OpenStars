const API_URL = process.env.GITHUB_API_URL ?? "https://api.github.com";
const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 60_000;
export class GitHubError extends Error {
    status;
    path;
    constructor(message, status, path) {
        super(message);
        this.status = status;
        this.path = path;
        this.name = "GitHubError";
    }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** GET a GitHub REST endpoint with retries for rate limits, 5xx and network errors. */
export async function ghGet(token, path) {
    for (let attempt = 1;; attempt++) {
        let res;
        try {
            res = await fetch(`${API_URL}${path}`, {
                headers: {
                    authorization: `Bearer ${token}`,
                    accept: "application/vnd.github+json",
                    "x-github-api-version": "2022-11-28",
                    "user-agent": "openstars",
                },
            });
        }
        catch (err) {
            if (attempt >= MAX_ATTEMPTS)
                throw new GitHubError(`network error: ${err.message}`, 0, path);
            await sleep(backoff(attempt));
            continue;
        }
        if (res.ok)
            return (await res.json());
        const rateLimited = res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
        if ((rateLimited || res.status >= 500) && attempt < MAX_ATTEMPTS) {
            const retryAfter = Number(res.headers.get("retry-after")) * 1000 || 0;
            const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
            await sleep(Math.min(MAX_WAIT_MS, Math.max(backoff(attempt), retryAfter, reset || 0)));
            continue;
        }
        let detail = "";
        try {
            detail = (await res.json()).message ?? "";
        }
        catch {
            /* body was not JSON */
        }
        throw new GitHubError(`HTTP ${res.status} for ${path}${detail ? ` (${detail})` : ""}`, res.status, path);
    }
}
function backoff(attempt) {
    return 1000 * 2 ** (attempt - 1);
}
