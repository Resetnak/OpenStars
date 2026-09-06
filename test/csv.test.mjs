import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_HEADER, csvCell, toCsv } from "../dist/csv.js";
import { emptyFile, merge } from "../dist/merge.js";

test("header matches the RepoMeter export exactly", () => {
  assert.equal(CSV_HEADER, "date,views,unique_visitors,clones,unique_cloners,stars,forks,watchers,subscribers,open_issues");
});

test("csvCell: RFC 4180 quoting, empty for null", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(12), "12");
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
});

test("toCsv: one row per day, null metadata renders as empty cells, LF line endings", () => {
  const file = merge(
    emptyFile("o/r"),
    {
      repo: "o/r",
      date: "2026-09-06",
      collected_at: "2026-09-06T03:17:00.000Z",
      views: [{ date: "2026-09-06", count: 5, uniques: 2 }],
      clones: [{ date: "2026-09-06", count: 1, uniques: 1 }],
      referrers: [],
      paths: [],
      meta: { stars: 9, forks: 1, watchers: 9, subscribers: 2, open_issues: 0, size_kb: 1 },
    },
    "g",
  );
  const csv = toCsv(file);
  const lines = csv.split("\n");
  assert.equal(lines[0], CSV_HEADER);
  assert.equal(lines.length, 1 + 14 + 1, "header + 14 days + trailing newline");
  assert.equal(lines[1], "2026-08-24,0,0,0,0,,,,,");
  assert.equal(lines[14], "2026-09-06,5,2,1,1,9,1,9,2,0");
  assert.ok(!csv.includes("\r"));
});
