import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFile, merge } from "../dist/merge.js";
import { badgeSvg, lastDays, latest, renderReport, sparklineSvg, sum } from "../dist/report.js";

const snap = (date, views, stars = 5, referrers = []) => ({
  repo: "o/r",
  date,
  collected_at: `${date}T03:17:00.000Z`,
  views,
  clones: [],
  referrers,
  paths: [],
  meta: { stars, forks: 0, watchers: stars, subscribers: 0, open_issues: 0, size_kb: 0 },
});

test("lastDays excludes today and zero-fills days that were never collected", () => {
  const file = merge(emptyFile("o/r"), snap("2026-09-06", [{ date: "2026-09-06", count: 99, uniques: 99 }, { date: "2026-09-05", count: 3, uniques: 1 }]), "g");
  const days = lastDays(file, "2026-09-06", 30);
  assert.equal(days.length, 30);
  assert.equal(days.at(-1).date, "2026-09-05");
  assert.equal(days[0].date, "2026-08-07");
  assert.equal(sum(days, "views"), 3, "today's partial 99 views are not counted");
});

test("latest returns the most recent non-null metadata", () => {
  let file = merge(emptyFile("o/r"), snap("2026-09-06", [], 10), "g");
  file = merge(file, snap("2026-09-07", [], 12), "g");
  assert.equal(latest(file, "stars", "2026-09-07"), 12);
  assert.equal(latest(file, "stars", "2026-09-06"), 10);
  assert.equal(latest(emptyFile("o/r"), "stars", "2026-09-06"), null);
});

test("sparkline: all-zero series renders a flat line, values scale to max", () => {
  const flat = sparklineSvg([0, 0, 0]);
  assert.match(flat, /<polyline/);
  assert.match(flat, /max 0/);
  const scaled = sparklineSvg([0, 10]);
  assert.match(scaled, /points="4\.0,76\.0 396\.0,4\.0"/);
  assert.equal(sparklineSvg([]).includes("<polyline"), false);
});

test("badge: contains label and value, escapes XML", () => {
  const svg = badgeSvg("views · 30d", "1,234");
  assert.match(svg, />views · 30d</);
  assert.match(svg, />1,234</);
  assert.match(badgeSvg("a<b", "x&y"), /a&lt;b/);
  assert.match(badgeSvg("a<b", "x&y"), /x&amp;y/);
});

test("report: sections, totals, referrer table with escaped pipes, footer with a single RepoMeter line", () => {
  const file = merge(
    emptyFile("o/r"),
    snap("2026-09-06", [{ date: "2026-09-05", count: 1200, uniques: 800 }], 7, [{ referrer: "a|b.com", count: 4, uniques: 2 }]),
    "g",
  );
  const md = renderReport([{ file, dir: "data/o/r" }], "2026-09-06", "1.0.0");
  assert.match(md, /^# Traffic history/);
  assert.match(md, /last update 2026-09-06 03:17 UTC/);
  assert.match(md, /## o\/r/);
  assert.match(md, /\| Views \| 1,200 \|/);
  assert.match(md, /\| Stars \| 7 \|/);
  assert.match(md, /a\\\|b\.com/);
  assert.match(md, /data\/o\/r\/sparkline\.svg/);
  assert.equal(md.split("repometer.online").length - 1, 1, "exactly one RepoMeter mention");
  assert.match(md, /or keep it here, it's yours/);
});
