import { execFileSync } from "node:child_process";

export interface GitOptions {
  dir: string;
  /** Remote URL without credentials, e.g. https://github.com/owner/repo.git */
  remote: string;
  branch: string;
  /** Token used for push (the workflow's GITHUB_TOKEN). */
  token: string;
  userName: string;
  userEmail: string;
}

/**
 * Credentials travel through git's config environment, never through argv,
 * so a failing command cannot echo them in its error message.
 */
function git(options: GitOptions, args: string[], cwd: string = options.dir): string {
  const basic = Buffer.from(`x-access-token:${options.token}`).toString("base64");
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.extraheader",
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
        GIT_TERMINAL_PROMPT: "0",
      },
    });
  } catch (err) {
    const stderr = String((err as { stderr?: string }).stderr ?? "").trim();
    throw new Error(`git ${args[0]} failed: ${stderr.replace(basic, "***") || (err as Error).message}`);
  }
}

/** Clone the data branch, or start an orphan one when it does not exist yet. Returns true when created. */
export function prepareBranch(options: GitOptions): boolean {
  let created = false;
  try {
    git(options, ["clone", "--quiet", "--depth", "1", "--single-branch", "--branch", options.branch, options.remote, options.dir], process.cwd());
  } catch {
    git(options, ["init", "--quiet", options.dir], process.cwd());
    git(options, ["checkout", "--quiet", "--orphan", options.branch]);
    git(options, ["remote", "add", "origin", options.remote]);
    created = true;
  }
  git(options, ["config", "user.name", options.userName]);
  git(options, ["config", "user.email", options.userEmail]);
  return created;
}

/** Commit everything and push. Returns false when nothing changed. */
export function commitAndPush(options: GitOptions, message: string): boolean {
  git(options, ["add", "--all"]);
  if (git(options, ["status", "--porcelain"]).trim() === "") return false;
  git(options, ["commit", "--quiet", "--message", message]);
  git(options, ["push", "--quiet", "origin", `HEAD:refs/heads/${options.branch}`]);
  return true;
}
