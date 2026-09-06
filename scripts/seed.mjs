#!/usr/bin/env node
// Seed or extend data/<owner>/<repo>/traffic.json from a CSV in the OpenStars
// (= RepoMeter export) format. Run inside a checkout of the data branch:
//
//   git switch openstars
//   node scripts/seed.mjs owner/name repometer-export.csv [data]
//
// Existing days win over the CSV; the CSV only fills gaps. Commit the result.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toCsv } from "../dist/csv.js";
import { emptyFile, parseFile } from "../dist/merge.js";

const [repo, csvPath, dataPath = "data"] = process.argv.slice(2);
if (!repo || !csvPath) {
  console.error("usage: node scripts/seed.mjs owner/name file.csv [data]");
  process.exit(1);
}

const [header, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
const expected = "date,views,unique_visitors,clones,unique_cloners,stars,forks,watchers,subscribers,open_issues";
if (header !== expected) throw new Error(`Unexpected header:\n${header}\nexpected:\n${expected}`);

const num = (s) => (s === "" || s === undefined ? null : Number(s));
const rows = lines.filter(Boolean).map((line) => {
  // ponytail: no quoted cells in this format, plain split is enough
  const [date, views, vu, clones, cu, stars, forks, watchers, subscribers, open_issues] = line.split(",");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Bad date: ${line}`);
  return {
    date,
    views: num(views) ?? 0,
    views_uniques: num(vu) ?? 0,
    clones: num(clones) ?? 0,
    clones_uniques: num(cu) ?? 0,
    stars: num(stars),
    forks: num(forks),
    watchers: num(watchers),
    subscribers: num(subscribers),
    open_issues: num(open_issues),
    size_kb: null,
  };
});

const dir = join(dataPath, repo);
const jsonPath = join(dir, "traffic.json");
const file = existsSync(jsonPath) ? parseFile(readFileSync(jsonPath, "utf8"), repo) : emptyFile(repo);

const byDate = new Map(rows.map((r) => [r.date, r]));
for (const row of file.daily) byDate.set(row.date, row); // existing wins
file.daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
file.first_collected = file.daily[0]?.date ?? file.first_collected;
if (!file.generator.includes("seed")) file.generator += "+seed";

mkdirSync(dir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(file, null, 2) + "\n");
writeFileSync(join(dir, "traffic.csv"), toCsv(file));
console.log(`${repo}: ${rows.length} rows from CSV, ${file.daily.length} days total (${file.first_collected} → ${file.daily.at(-1)?.date})`);
