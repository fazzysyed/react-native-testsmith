import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DEFAULT_CONFIG } from "./constants.js";
import type { RuntimeConfig } from "./types.js";
import { prettyJson } from "./utils.js";

export function getConfigPath(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_FILE);
}

export function loadConfig(projectRoot: string): RuntimeConfig {
  const cfgPath = getConfigPath(projectRoot);
  if (!fs.existsSync(cfgPath)) return DEFAULT_CONFIG;

  const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as Partial<RuntimeConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...(parsed.ai ?? {})
    }
  };
}

export function writeDefaultConfig(projectRoot: string, overwrite = false): { written: boolean; path: string } {
  const cfgPath = getConfigPath(projectRoot);
  if (!overwrite && fs.existsSync(cfgPath)) return { written: false, path: cfgPath };
  fs.writeFileSync(cfgPath, prettyJson(DEFAULT_CONFIG), "utf8");
  return { written: true, path: cfgPath };
}
