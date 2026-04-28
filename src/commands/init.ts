import { writeDefaultConfig } from "../config.js";
import { logInfo, logSuccess, logWarn } from "../utils.js";

export function runInit(projectRoot: string, options: { force?: boolean }): void {
  const result = writeDefaultConfig(projectRoot, Boolean(options.force));
  if (!result.written) {
    logWarn(`Config already exists at ${result.path}. Use --force to overwrite.`);
    return;
  }
  logSuccess(`Created ${result.path}`);
  logInfo("Local-only mode enabled by default (Ollama runtime).");
}
