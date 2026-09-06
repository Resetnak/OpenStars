import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFile, merge, parseFile, windowDates, WINDOW_DAYS } from "../dist/merge.js";

const REPO = "owner/name";

function snapshot({ date, views = [], clones = [], stars = 10, referrers = [], releases }) {
  return {
    repo: REPO,
    date,
    collected_at: `${date}T03:17:00.000Z`,
    views,
    clones,
    referrers,
    paths: [],
    meta: { stars, forks: 1, watchers: stars, subscribers: 2, open_issues: 3, size_kb: 40 },
    ...(releases ? { releases } : {}),
  };
}

test("windowDates: 14 ascending days ending at the given date, across month boundary", () => {
  const dates = windowDates("2026-03-02");
  assert.equal(dates.length, WINDOW_DAYS);
  assert.equal(dates[0], "2026-02-17");
  assert.equal(dates.at(-1), "2026-03-02");
});

test("first merge: window is zero-filled, API days are set, metadata only on run date", () => {
  const file = merge(
    emptyFile(REPO),
    snapshot({ date: "2026-09-06", views: [{ date: "2026-09-05", count: 7, uniques: 3 }], stars: 42 }),
    "openstars/1.0.0",
  );
  assert.equal(file.daily.length, WINDOW_DAYS);
  assert.equal(file.first_collected, "2026-09-06");
  assert.equal(file.generator, "openstars/1.0.0");
  const sep5 = file.daily.find((r) => r.date === "2026-09-05");
  assert.deepEqual([sep5.views, sep5.views_uniques, sep5.clones, sep5.stars], [7, 3, 0, null]);
  const sep6 = file.daily.find((r) => r.date === "2026-09-06");
  assert.equal(sep6.stars, 42);
  assert.equal(file.daily[0].date, "2026-08-24");
  assert.equal(file.daily[0].stars, null, "days before install have null metadata, never 0");
});

test("revision: a later run overwrites numbers inside the window and never touches older days", () => {
  let file = merge(emptyFile(REPO), snapshot({ date: "2026-09-06", views: [{ date: "2026-09-05", count: 7, uniques: 3 }] }), "g");
  file = merge(
    file,
    snapshot({
      date: "2026-09-20",
      views: [
        { date: "2026-09-19", count: 100, uniques: 50 },
        { date: "2026-09-07", count: 9, uniques: 9 }, // inside new window: revised
      ],
    }),
    "g",
  );
  const sep5 = file.daily.find((r) => r.date === "2026-09-05");
  assert.equal(sep5.views, 7, "day outside the new window keeps its value");
  assert.equal(file.daily.find((r) => r.date === "2026-09-07").views, 9);
  assert.equal(file.daily.find((r) => r.date === "2026-09-08").views, 0, "omitted day inside window is zero");
  assert.equal(file.daily.find((r) => r.date === "2026-09-19").views, 100);
  assert.equal(file.daily.at(-1).date, "2026-09-20");
  assert.deepEqual(
    file.daily.map((r) => r.date),
    [...file.daily.map((r) => r.date)].sort(),
    "daily stays sorted",
  );
});

test("idempotent: running twice on the same day yields identical data", () => {
  const snap = snapshot({ date: "2026-09-06", views: [{ date: "2026-09-06", count: 1, uniques: 1 }], referrers: [{ referrer: "news.ycombinator.com", count: 5, uniques: 4 }] });
  const once = merge(emptyFile(REPO), snap, "g");
  const later = { ...snap, collected_at: "2026-09-06T09:00:00.000Z" };
  const twice = merge(once, later, "g");
  assert.equal(twice, once, "identical data returns the same object, timestamps untouched");
  const revised = merge(once, { ...later, views: [{ date: "2026-09-06", count: 2, uniques: 1 }] }, "g");
  assert.equal(revised.last_collected_at, "2026-09-06T09:00:00.000Z");
  assert.deepEqual(Object.keys(twice.referrers), ["2026-09-06"]);
});

test("referrers and releases are stored per run date; releases key stays an object when not collected", () => {
  let file = merge(emptyFile(REPO), snapshot({ date: "2026-09-06", releases: [{ tag: "v1", downloads: 3 }] }), "g");
  file = merge(file, snapshot({ date: "2026-09-07" }), "g");
  assert.deepEqual(file.releases, { "2026-09-06": [{ tag: "v1", downloads: 3 }] });
  assert.deepEqual(Object.keys(file.referrers).sort(), ["2026-09-06", "2026-09-07"]);
});

test("merge refuses a file that belongs to another repository", () => {
  assert.throws(() => merge(emptyFile("other/repo"), snapshot({ date: "2026-09-06" }), "g"), /belongs to other\/repo/);
});

test("parseFile: accepts schema 1, fills missing maps, rejects garbage", () => {
  const file = parseFile(JSON.stringify({ schema: 1, repo: REPO, daily: [] }), REPO);
  assert.deepEqual(file.referrers, {});
  assert.throws(() => parseFile(JSON.stringify({ schema: 2, daily: [] }), REPO), /schema 1/);
  assert.throws(() => parseFile("{}", REPO), /schema 1/);
});
