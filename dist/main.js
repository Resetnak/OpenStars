import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fail, getBoolInput, getInput, info, setOutput, setSecret, warning, writeSummary } from "./actions.js";
import { collect } from "./collect.js";
import { toCsv } from "./csv.js";
import { commitAndPush, prepareBranch } from "./git.js";
import { emptyFile, merge, parseFile, windowDates } from "./merge.js";
import { badgeSvg, formatInt, lastDays, latest, renderReport, REPOMETER_URL, sparklineSvg, sum } from "./report.js";
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
async function run() {
    const token = getInput("token", true);
    setSecret(token);
    const githubToken = getInput("github_token", true);
    setSecret(githubToken);
    const ownRepo = process.env.GITHUB_REPOSITORY;
    if (!ownRepo)
        throw new Error("GITHUB_REPOSITORY is not set; OpenStars must run inside GitHub Actions.");
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    const repos = (getInput("repos") || ownRepo).split(/[\s,]+/).filter(Boolean);
    for (const repo of repos) {
        if (!REPO_PATTERN.test(repo))
            throw new Error(`"${repo}" is not a valid owner/name repository.`);
    }
    const branch = getInput("data_branch") || "openstars";
    const dataPath = (getInput("data_path") || "data").replace(/^\/+|\/+$/g, "");
    const report = getBoolInput("report", true);
    const releases = getBoolInput("releases", false);
    const commitTemplate = getInput("commit_message") || "openstars: {date}";
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // 1. Collect. One repo failing must not stop the others.
    const snapshots = [];
    const failures = [];
    for (const repo of repos) {
        try {
            const snapshot = await collect(token, repo, { releases, now });
            snapshots.push(snapshot);
            info(`${repo}: ${snapshot.views.length} days of views, ${snapshot.referrers.length} referrers, ${formatInt(snapshot.meta.stars)} stars`);
        }
        catch (err) {
            const message = err.message;
            failures.push(message);
            warning(message);
        }
    }
    if (snapshots.length === 0) {
        fail(`No repository could be collected.\n${failures.join("\n")}`);
        return;
    }
    // 2. Merge into the data branch and push. A rejected push (concurrent run) gets one fresh retry.
    const generator = `openstars/${VERSION}`;
    let created = false;
    let changed = false;
    let files = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
        const dir = mkdtempSync(join(tmpdir(), "openstars-"));
        rmSync(dir, { recursive: true, force: true }); // git clone wants to create it
        const gitOptions = {
            dir,
            remote: `${serverUrl}/${ownRepo}.git`,
            branch,
            token: githubToken,
            userName: getInput("git_user_name") || "openstars[bot]",
            userEmail: getInput("git_user_email") || "openstars[bot]@users.noreply.github.com",
        };
        created = prepareBranch(gitOptions);
        files = snapshots.map((snapshot) => writeRepoData(dir, dataPath, snapshot, generator, today, report));
        if (report) {
            writeFileSync(join(dir, "README.md"), renderReport(files, today, VERSION));
        }
        try {
            changed = commitAndPush(gitOptions, commitTemplate.replace("{date}", today));
            break;
        }
        catch (err) {
            const message = err.message;
            if (attempt === 2 || !/rejected|fetch first|non-fast-forward/i.test(message)) {
                throw new Error(/403|denied/i.test(message)
                    ? `${message}\nThe job needs "permissions: contents: write" so the workflow token can push the data branch.`
                    : message);
            }
            warning(`Push rejected (concurrent run?), retrying once: ${message}`);
        }
    }
    // 3. Outputs and summary.
    const first = files[0].file;
    const window = new Set(windowDates(today));
    const inWindow = first.daily.filter((row) => window.has(row.date));
    setOutput("views_14d", sum(inWindow, "views"));
    setOutput("clones_14d", sum(inWindow, "clones"));
    setOutput("stars", latest(first, "stars", today) ?? "");
    setOutput("data_branch", branch);
    setOutput("changed", changed);
    info(changed ? `Pushed ${branch} (${files.length} repositor${files.length === 1 ? "y" : "ies"}).` : `No changes for ${branch}.`);
    writeSummary(created ? firstRunSummary(ownRepo, branch, files) : runSummary(files, today));
    if (failures.length > 0) {
        writeSummary(`\n> ${failures.length} repositor${failures.length === 1 ? "y" : "ies"} failed:\n${failures.map((f) => `> - ${f}`).join("\n")}`);
    }
}
function writeRepoData(dir, dataPath, snapshot, generator, today, report) {
    const relDir = `${dataPath}/${snapshot.repo}`;
    const absDir = join(dir, relDir);
    mkdirSync(absDir, { recursive: true });
    const jsonPath = join(absDir, "traffic.json");
    const existing = existsSync(jsonPath) ? parseFile(readFileSync(jsonPath, "utf8"), snapshot.repo) : emptyFile(snapshot.repo);
    const merged = merge(existing, snapshot, generator);
    writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + "\n");
    writeFileSync(join(absDir, "traffic.csv"), toCsv(merged));
    if (report) {
        const days30 = lastDays(merged, today, 30);
        writeFileSync(join(absDir, "sparkline.svg"), sparklineSvg(days30.map((row) => row.views)));
        writeFileSync(join(absDir, "badge.svg"), badgeSvg("views · 30d", formatInt(sum(days30, "views"))));
    }
    return { file: merged, dir: relDir };
}
function firstRunSummary(ownRepo, branch, files) {
    const lines = [
        "## OpenStars: first run complete",
        "",
        `Created branch \`${branch}\` with data for ${files.map((f) => `\`${f.file.repo}\``).join(", ")}. From now on every run appends a day; GitHub's 14-day window no longer matters.`,
        "",
        "Add a badge to your README:",
        "",
        "```md",
        ...files.map((f) => `![views](https://raw.githubusercontent.com/${ownRepo}/${branch}/${f.dir}/badge.svg)`),
        "```",
        "",
        `Tip: [RepoMeter](${REPOMETER_URL}) can import this CSV if you ever want charts.`,
    ];
    return lines.join("\n");
}
function runSummary(files, today) {
    const lines = [];
    for (const { file } of files) {
        lines.push(`### ${file.repo}`, "", "| Date | Views | Unique | Clones | Stars |", "|---|---:|---:|---:|---:|");
        for (const row of lastDays(file, today, 7).reverse()) {
            lines.push(`| ${row.date} | ${formatInt(row.views)} | ${formatInt(row.views_uniques)} | ${formatInt(row.clones)} | ${formatInt(row.stars)} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
run().catch((err) => fail(err.message));
