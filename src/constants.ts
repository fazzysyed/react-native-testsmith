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
    runtime: "ollama",
    model: "qwen2.5-coder:7b",
    maxRetries: 1
  }
};
