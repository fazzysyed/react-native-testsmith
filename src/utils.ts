import fs from "node:fs";
import path from "node:path";
import kleur from "kleur";

export function resolveFromRoot(projectRoot: string, inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.join(projectRoot, inputPath);
}

export function ensureDir(fileOrDirPath: string): void {
  const target = path.extname(fileOrDirPath) ? path.dirname(fileOrDirPath) : fileOrDirPath;
  fs.mkdirSync(target, { recursive: true });
}

export function writeFileSafe(filePath: string, content: string, overwrite = false): { written: boolean; reason?: string } {
  if (!overwrite && fs.existsSync(filePath)) {
    return { written: false, reason: "exists" };
  }
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  return { written: true };
}

export function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function logInfo(msg: string): void {
  console.log(`${kleur.cyan("info")} ${msg}`);
}

export function logWarn(msg: string): void {
  console.log(`${kleur.yellow("warn")} ${msg}`);
}

export function logSuccess(msg: string): void {
  console.log(`${kleur.green("ok")} ${msg}`);
}

export function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}
