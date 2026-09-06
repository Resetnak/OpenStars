/** Identical to the RepoMeter export header, so files move between the two without conversion. */
export const CSV_HEADER = "date,views,unique_visitors,clones,unique_cloners,stars,forks,watchers,subscribers,open_issues";
/** RFC 4180: quote when needed, double inner quotes, empty for null. */
export function csvCell(value) {
    if (value === null)
        return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function toCsv(file) {
    const lines = file.daily.map((row) => [
        row.date,
        row.views,
        row.views_uniques,
        row.clones,
        row.clones_uniques,
        row.stars,
        row.forks,
        row.watchers,
        row.subscribers,
        row.open_issues,
    ]
        .map(csvCell)
        .join(","));
    return [CSV_HEADER, ...lines].join("\n") + "\n";
}
