// Pure rendering: README.md for the data branch, badge.svg, sparkline.svg. No dependencies.
import type { DailyRow, TrafficFile } from "./merge.js";
import { windowDates } from "./merge.js";

export const REPOMETER_URL = "https://repometer.online";

const escapeXml = (text: string): string =>
  text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

const escapeMd = (text: string): string => text.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export const formatInt = (n: number | null): string => (n === null ? "–" : n.toLocaleString("en-US"));

/** Full days before `today` (today is partial and excluded), oldest first, zero-filled. */
export function lastDays(file: TrafficFile, today: string, days: number): DailyRow[] {
  const byDate = new Map(file.daily.map((row) => [row.date, row]));
  return windowDates(today, days + 1)
    .slice(0, days)
    .map((date) => byDate.get(date) ?? { ...blank(date) });
}

const blank = (date: string): DailyRow => ({
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
});

export const sum = (rows: DailyRow[], key: "views" | "views_uniques" | "clones" | "clones_uniques"): number =>
  rows.reduce((total, row) => total + row[key], 0);

/** Latest non-null metadata value on or before `today`. */
export function latest(file: TrafficFile, key: "stars" | "forks" | "open_issues", today: string): number | null {
  for (let i = file.daily.length - 1; i >= 0; i--) {
    const row = file.daily[i]!;
    if (row.date <= today && row[key] !== null) return row[key];
  }
  return null;
}

export function sparklineSvg(values: number[], width = 400, height = 80): string {
  const pad = 4;
  const max = Math.max(0, ...values);
  const count = Math.max(values.length, 2);
  const points = values.map((value, i) => {
    const x = pad + (i * (width - 2 * pad)) / (count - 1);
    const y = max === 0 ? height - pad : height - pad - (value / max) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.length ? `<polyline fill="none" stroke="#f5c400" stroke-width="2" points="${points.join(" ")}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="views, last ${values.length} days, max ${max}">` +
    `<title>views, last ${values.length} days (max ${max})</title>` +
    `<rect width="${width}" height="${height}" fill="#0d1117" rx="6"/>${line}</svg>`
  );
}

export function badgeSvg(label: string, value: string): string {
  const charWidth = 6.5;
  const labelWidth = Math.round(label.length * charWidth + 12);
  const valueWidth = Math.round(value.length * charWidth + 12);
  const width = labelWidth + valueWidth;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(`${label}: ${value}`)}">` +
    `<title>${escapeXml(`${label}: ${value}`)}</title>` +
    `<rect width="${labelWidth}" height="20" fill="#555"/>` +
    `<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="#f5c400"/>` +
    `<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">` +
    `<text x="${labelWidth / 2}" y="14" fill="#fff">${escapeXml(label)}</text>` +
    `<text x="${labelWidth + valueWidth / 2}" y="14" fill="#222">${escapeXml(value)}</text>` +
    `</g></svg>`
  );
}

export interface RepoReportInput {
  file: TrafficFile;
  /** Path of the repo's data directory relative to the branch root, e.g. data/owner/name. */
  dir: string;
}

export function renderRepoSection(input: RepoReportInput, today: string): string {
  const { file, dir } = input;
  const days30 = lastDays(file, today, 30);
  const stars = latest(file, "stars", today);
  const starsBefore = lastDays(file, today, 31)[0]?.stars ?? null;
  const starsDelta = stars !== null && starsBefore !== null ? stars - starsBefore : null;
  const referrerDates = Object.keys(file.referrers).sort();
  const lastReferrerDate = referrerDates[referrerDates.length - 1];
  const referrers = lastReferrerDate ? (file.referrers[lastReferrerDate] ?? []) : [];
  const pathDates = Object.keys(file.paths).sort();
  const lastPathDate = pathDates[pathDates.length - 1];
  const paths = lastPathDate ? (file.paths[lastPathDate] ?? []) : [];

  const lines: string[] = [];
  lines.push(`## ${file.repo}`);
  lines.push("");
  lines.push(`![views, last 30 days](${dir}/sparkline.svg)`);
  lines.push("");
  lines.push("| Last 30 days | |");
  lines.push("|---|---:|");
  lines.push(`| Views | ${formatInt(sum(days30, "views"))} |`);
  lines.push(`| Unique visitors | ${formatInt(sum(days30, "views_uniques"))} |`);
  lines.push(`| Clones | ${formatInt(sum(days30, "clones"))} |`);
  lines.push(`| Unique cloners | ${formatInt(sum(days30, "clones_uniques"))} |`);
  lines.push(
    `| Stars | ${formatInt(stars)}${starsDelta === null ? "" : ` (${starsDelta >= 0 ? "+" : ""}${formatInt(starsDelta)})`} |`,
  );
  lines.push("");
  lines.push("Today is partial and excluded from the totals. GitHub revises the last 14 days; the CSV is always the latest truth.");
  lines.push("");
  lines.push("### Daily");
  lines.push("");
  lines.push("| Date | Views | Unique | Clones | Unique | Stars |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const row of [...days30].reverse()) {
    lines.push(
      `| ${row.date} | ${formatInt(row.views)} | ${formatInt(row.views_uniques)} | ${formatInt(row.clones)} | ${formatInt(row.clones_uniques)} | ${formatInt(row.stars)} |`,
    );
  }
  lines.push("");
  lines.push(`### Top referrers${lastReferrerDate ? ` (14 days to ${lastReferrerDate})` : ""}`);
  lines.push("");
  if (referrers.length === 0) lines.push("_No referrer data yet._");
  else {
    lines.push("| Referrer | Views | Unique |");
    lines.push("|---|---:|---:|");
    for (const ref of referrers.slice(0, 10)) {
      lines.push(`| ${escapeMd(ref.referrer)} | ${formatInt(ref.count)} | ${formatInt(ref.uniques)} |`);
    }
  }
  lines.push("");
  lines.push(`### Top paths${lastPathDate ? ` (14 days to ${lastPathDate})` : ""}`);
  lines.push("");
  if (paths.length === 0) lines.push("_No path data yet._");
  else {
    lines.push("| Path | Views | Unique |");
    lines.push("|---|---:|---:|");
    for (const hit of paths.slice(0, 10)) {
      lines.push(`| ${escapeMd(hit.path)} | ${formatInt(hit.count)} | ${formatInt(hit.uniques)} |`);
    }
  }
  lines.push("");
  lines.push(`Raw data: [\`${dir}/traffic.json\`](${dir}/traffic.json) · [\`${dir}/traffic.csv\`](${dir}/traffic.csv)`);
  lines.push("");
  return lines.join("\n");
}

export function renderReport(inputs: RepoReportInput[], today: string, version: string): string {
  const first = inputs.map((input) => input.file.first_collected).filter(Boolean).sort()[0] ?? today;
  const updated = inputs.map((input) => input.file.last_collected_at ?? "").sort().at(-1) || `${today}T00:00`;
  const header = [
    "# Traffic history",
    "",
    `Collected since ${first}, last update ${updated.replace("T", " ").slice(0, 16)} UTC. Generated by OpenStars ${version}; this branch is rewritten on every run, do not edit by hand.`,
    "",
  ];
  const footer = [
    "---",
    "",
    "Generated by [OpenStars](https://github.com/Resetnak/openstars).",
    `Charts and alerts for this data: [RepoMeter](${REPOMETER_URL}) · or keep it here, it's yours.`,
    "",
  ];
  return [...header, ...inputs.map((input) => renderRepoSection(input, today)), ...footer].join("\n");
}
