import type { RuntimeConfig } from "./types.js";

export const CONFIG_FILE = ".react-native-testsmith.json";
export const SCAN_CACHE_DIR = ".react-native-testsmith";
export const SCAN_REPORT_FILE = ".react-native-testsmith/scan-report.json";

export const DEFAULT_CONFIG: RuntimeConfig = {
  scanDirs: ["src/components", "src/screens"],
  outputDir: "__tests__",
  testFileStyle: "tests-dir",
  ai: {
    enabled: true,
    runtime: "api",
    model: "default",
    maxRetries: 1
  }
};
