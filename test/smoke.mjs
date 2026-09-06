// End-to-end smoke test: mock GitHub API + local bare repo as remote. Runs the action three times
// (create branch, update, no-op) and checks the pushed branch. No network, no secrets.
import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
const spawnAsync = (cmd, args, opts) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, opts);
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = mkdtempSync(join(tmpdir(), "openstars-smoke-"));
const remoteDir = join(root, "o", "r.git");
execFileSync("git", ["init", "--quiet", "--bare", remoteDir]);

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10) + "T00:00:00Z";
let stars = 100;
const routes = {
  "/repos/o/r/traffic/views?per=day": () => ({ views: [{ timestamp: day(1), count: 12, uniques: 8 }, { timestamp: day(0), count: 3, uniques: 3 }] }),
  "/repos/o/r/traffic/clones?per=day": () => ({ clones: [{ timestamp: day(1), count: 2, uniques: 2 }] }),
  "/repos/o/r/traffic/popular/referrers": () => [{ referrer: "news.ycombinator.com", count: 9, uniques: 7 }],
  "/repos/o/r/traffic/popular/paths": () => [{ path: "/o/r", title: "o/r: test", count: 10, uniques: 8 }],
  "/repos/o/r": () => ({ stargazers_count: stars, forks_count: 4, watchers_count: stars, subscribers_count: 3, open_issues_count: 1, size: 77 }),
  "/repos/o/r/releases?per_page=100": () => [{ tag_name: "v1.0.0", draft: false, assets: [{ download_count: 5 }, { download_count: 6 }] }],
};
const server = createServer((req, res) => {
  const handler = routes[req.url];
  assert.equal(req.headers.authorization, "Bearer pat-secret", "token header");
  if (!handler) { res.writeHead(404); res.end("{}"); return; }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(handler()));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

async function runAction(label) {
  const out = join(root, `${label}.out`); writeFileSync(out, "");
  const summary = join(root, `${label}.md`); writeFileSync(summary, "");
  const res = await spawnAsync("node", [new URL("../dist/main.js", import.meta.url).pathname], {
    env: {
      ...process.env,
      GITHUB_API_URL: `http://127.0.0.1:${port}`,
      GITHUB_REPOSITORY: "o/r",
      GITHUB_SERVER_URL: `file://${root}`,
      GITHUB_OUTPUT: out,
      GITHUB_STEP_SUMMARY: summary,
      INPUT_TOKEN: "pat-secret",
      INPUT_GITHUB_TOKEN: "gh-secret",
      INPUT_RELEASES: "true",
    },
  });
  console.log(`--- ${label} (exit ${res.status}) ---\n${res.stdout}${res.stderr}`);
  assert.equal(res.status, 0, `${label} exit code`);
  assert.ok(!res.stdout.includes("pat-secret") || res.stdout.includes("::add-mask::pat-secret"), "token appears only in add-mask");
  return { out: readFileSync(out, "utf8"), summary: readFileSync(summary, "utf8") };
}

const first = await runAction("first");
assert.match(first.summary, /first run complete/);
assert.match(first.summary, /raw\.githubusercontent\.com\/o\/r\/openstars\/data\/o\/r\/badge\.svg/);
assert.match(first.out, /changed=true/);
assert.match(first.out, /stars=100/);
assert.match(first.out, /views_14d=15/);

stars = 101;
const second = await runAction("second");
assert.match(second.summary, /### o\/r/);
assert.doesNotMatch(second.summary, /repometer/i, "no RepoMeter mention after the first run");
assert.match(second.out, /stars=101/);

const third = await runAction("third");
assert.match(third.out, /changed=false/, "same day, same data: no commit");

const checkout = join(root, "checkout");
execFileSync("git", ["clone", "--quiet", "--branch", "openstars", remoteDir, checkout]);
const log = execFileSync("git", ["log", "--oneline"], { cwd: checkout, encoding: "utf8" }).trim().split("\n");
assert.equal(log.length, 2, "two commits (third run had no changes)");
for (const f of ["README.md", "data/o/r/traffic.json", "data/o/r/traffic.csv", "data/o/r/badge.svg", "data/o/r/sparkline.svg"]) {
  assert.ok(existsSync(join(checkout, f)), f);
}
const data = JSON.parse(readFileSync(join(checkout, "data/o/r/traffic.json"), "utf8"));
assert.equal(data.daily.length, 14);
assert.equal(data.daily.at(-1).stars, 101);
assert.equal(data.daily.at(-2).views, 12);
assert.deepEqual(Object.values(data.releases)[0], [{ tag: "v1.0.0", downloads: 11 }]);
const readme = readFileSync(join(checkout, "README.md"), "utf8");
assert.equal(readme.split("repometer.online").length - 1, 1);
console.log(readme.split("\n").slice(0, 16).join("\n"));
console.log("\nSMOKE OK, workspace:", root);
server.close();
