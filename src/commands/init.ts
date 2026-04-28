import { writeDefaultConfig } from "../config.js";
import { logInfo, logSuccess, logWarn } from "../utils.js";
import { runSetup } from "./setup.js";

export function runInit(projectRoot: string, options: { force?: boolean }): void {
  const result = writeDefaultConfig(projectRoot, Boolean(options.force));
  if (!result.written) {
    logWarn(`Config already exists at ${result.path}. Use --force to overwrite.`);
  } else {
    logSuccess(`Created ${result.path}`);
  }
  logInfo("Running project test setup...");
  runSetup(projectRoot, { force: Boolean(options.force) });
  logSuccess("Initialization completed.");
}
