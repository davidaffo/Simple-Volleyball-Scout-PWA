import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const packagePath = resolve(root, "package.json");
const versionJsonPath = resolve(root, "version.json");
const appVersionJsPath = resolve(root, "js/app-version.js");

function runGit(cmd, fallback = "") {
  try {
    return String(execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })).trim();
  } catch (_) {
    return fallback;
  }
}

function writeIfChanged(filePath, content) {
  const prev = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (prev === content) return false;
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return true;
}

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const baseVersion = pkg.version || "0.0.0";
const commitCount = Number(runGit("git rev-list --count HEAD", "0")) || 0;
const commitHash = runGit("git rev-parse --short HEAD", "dev");
const version = `${baseVersion}+${commitCount}.${commitHash}`;
const cacheVersion = `v${commitCount}-${commitHash}`;
const buildDate = new Date().toISOString();

const meta = {
  appName: "Simple Volleyball Scout PWA",
  baseVersion,
  version,
  commitCount,
  commitHash,
  cacheVersion,
  buildDate
};

const versionJson = JSON.stringify(meta, null, 2) + "\n";
const appVersionJs = `(function attachAppVersion(root) {
  root.__APP_VERSION__ = ${JSON.stringify(meta, null, 2)};
})(typeof self !== "undefined" ? self : window);
`;

const changedJson = writeIfChanged(versionJsonPath, versionJson);
const changedJs = writeIfChanged(appVersionJsPath, appVersionJs);

const changed = [];
if (changedJson) changed.push("version.json");
if (changedJs) changed.push("js/app-version.js");
const suffix = changed.length ? ` updated: ${changed.join(", ")}` : " no changes";
console.log(`[version-sync] ${version}${suffix}`);
