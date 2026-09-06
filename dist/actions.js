// Minimal replacement for @actions/core so the action has zero runtime dependencies.
// Workflow commands: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
import { appendFileSync } from "node:fs";
export function getInput(name, required = false) {
    const value = (process.env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
    if (required && !value)
        throw new Error(`Input "${name}" is required.`);
    return value;
}
export function getBoolInput(name, fallback) {
    const value = getInput(name).toLowerCase();
    if (value === "")
        return fallback;
    return value === "true";
}
export function setSecret(value) {
    if (value)
        process.stdout.write(`::add-mask::${value}\n`);
}
export function setOutput(name, value) {
    const file = process.env.GITHUB_OUTPUT;
    if (file)
        appendFileSync(file, `${name}=${value}\n`);
}
export function writeSummary(markdown) {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file)
        appendFileSync(file, `${markdown}\n`);
}
export function info(message) {
    process.stdout.write(`${message}\n`);
}
export function warning(message) {
    process.stdout.write(`::warning::${message.replace(/\n/g, "%0A")}\n`);
}
export function fail(message) {
    process.stdout.write(`::error::${message.replace(/\n/g, "%0A")}\n`);
    process.exitCode = 1;
}
