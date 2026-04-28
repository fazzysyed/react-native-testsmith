import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSafe, logInfo, logSuccess, logWarn, prettyJson, readTextIfExists } from "../utils.js";

const JEST_CONFIG = `module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|@testing-library/react-native|react-native-linear-gradient)/)',
  ],
  testRegex: '(/__tests__/.*|(\\\\.|/)(test|spec))\\\\.(ts|tsx)$',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  collectCoverage: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\\\.(png|jpg|jpeg|gif|webp|svg|mp4|mp3|ttf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.tsx',
    '\\\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.ts',
    'react-native-responsive-fontsize': '<rootDir>/__mocks__/react-native-responsive-fontsize.tsx',
    'react-native-size-matters': '<rootDir>/__mocks__/react-native-size-matters.tsx',
  },
  coverageReporters: ['lcov', 'json', 'clover', 'text'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.dt.ts',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!src/**/types.{ts,tsx}',
  ],
};
`;

const JEST_SETUP = `import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});
`;

const REQUIRED_SETUP_LINES = [
  "import 'react-native-gesture-handler/jestSetup';",
  "jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');"
];

const REQUIRED_REANIMATED_BLOCK = `jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});`;

const NATIVE_MODULE_MOCK_LINES = [
  "jest.mock('react-native-config', () => ({ API_URL: 'http://localhost', ENV: 'test' }));",
  "jest.mock('react-native-device-info', () => ({ getVersion: () => '1.0.0', getBuildNumber: () => '1' }));",
  "jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');"
];

const NATIVE_MODULE_MAPPERS: Array<{ key: string; value: string }> = [
  { key: "'^react-native-config$'", value: "'<rootDir>/__mocks__/react-native-config.ts'" },
  { key: "'^react-native-device-info$'", value: "'<rootDir>/__mocks__/react-native-device-info.ts'" },
  {
    key: "'^react-native-vector-icons/MaterialIcons$'",
    value: "'<rootDir>/__mocks__/react-native-vector-icons-MaterialIcons.ts'"
  }
];

function appendMissingLines(content: string, lines: string[]): string {
  let next = content;
  for (const line of lines) {
    if (!next.includes(line)) {
      next = `${next.trimEnd()}\n${line}\n`;
    }
  }
  return next;
}

function mergeJestSetup(existing: string): string {
  let merged = appendMissingLines(existing, REQUIRED_SETUP_LINES);
  if (!merged.includes("react-native-reanimated")) {
    merged = `${merged.trimEnd()}\n\n${REQUIRED_REANIMATED_BLOCK}\n`;
  }
  return merged;
}

function mergeNativeSetupMocks(existing: string): string {
  return appendMissingLines(existing, NATIVE_MODULE_MOCK_LINES);
}

function mergeArrayField(content: string, fieldName: string, values: string[]): string {
  const fieldRegex = new RegExp(`(${fieldName}\\s*:\\s*\\[)([\\s\\S]*?)(\\])`, "m");
  const match = content.match(fieldRegex);
  if (!match) return content;

  const present = values.filter((v) => match[0].includes(v));
  const missing = values.filter((v) => !present.includes(v));
  if (missing.length === 0) return content;

  const insertion = `${match[2].trimEnd()}${match[2].trim().length ? ", " : ""}${missing.join(", ")}`;
  return content.replace(fieldRegex, `${match[1]}${insertion}${match[3]}`);
}

function mergeObjectField(content: string, fieldName: string, entries: Array<{ key: string; value: string }>): string {
  const fieldRegex = new RegExp(`(${fieldName}\\s*:\\s*\\{)([\\s\\S]*?)(\\})`, "m");
  const match = content.match(fieldRegex);
  if (!match) return content;

  const missing = entries.filter((e) => !match[0].includes(e.key));
  if (missing.length === 0) return content;

  const add = missing.map((e) => `${e.key}: ${e.value}`).join(", ");
  const nextBody = `${match[2].trimEnd()}${match[2].trim().length ? ", " : ""}${add}`;
  return content.replace(fieldRegex, `${match[1]}${nextBody}${match[3]}`);
}

function insertTopLevelField(content: string, fieldBlock: string): string {
  const exportRegex = /module\.exports\s*=\s*\{([\s\S]*?)\}\s*;?/m;
  const match = content.match(exportRegex);
  if (!match) return content;
  const existingBody = match[1].trimEnd();
  const separator = existingBody.length > 0 && !existingBody.trim().endsWith(",") ? "," : "";
  const nextBody = `${existingBody}${separator}\n  ${fieldBlock}\n`;
  return content.replace(exportRegex, `module.exports = {${nextBody}};`);
}

function mergeJestConfig(existing: string): string {
  let merged = existing;

  if (!merged.includes("preset: 'react-native'") && !merged.includes('preset: "react-native"')) {
    merged = merged.replace(
      /module\.exports\s*=\s*\{/,
      "module.exports = {\n  preset: 'react-native',"
    );
  }

  merged = mergeArrayField(merged, "setupFilesAfterEnv", ["'<rootDir>/jest.setup.ts'"]);
  if (!/setupFilesAfterEnv\s*:\s*\[/m.test(merged)) {
    merged = insertTopLevelField(merged, "setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],");
  }

  if (!/transform\s*:\s*\{/m.test(merged)) {
    merged = insertTopLevelField(merged, "transform: { '^.+\\\\.[jt]sx?$': 'babel-jest' },");
  }

  merged = mergeArrayField(merged, "transformIgnorePatterns", [
    "'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|@testing-library/react-native|react-native-linear-gradient)/)'"
  ]);
  if (!/transformIgnorePatterns\s*:\s*\[/m.test(merged)) {
    merged = insertTopLevelField(
      merged,
      "transformIgnorePatterns: ['node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|@testing-library/react-native|react-native-linear-gradient)/)'],"
    );
  }

  merged = mergeObjectField(merged, "moduleNameMapper", [
    { key: "'^@/(.*)$'", value: "'<rootDir>/src/$1'" },
    {
      key: "'\\\\.(png|jpg|jpeg|gif|webp|svg|mp4|mp3|ttf|woff|woff2)$'",
      value: "'<rootDir>/__mocks__/fileMock.tsx'"
    },
    { key: "'\\\\.(css|less|scss|sass)$'", value: "'<rootDir>/__mocks__/styleMock.ts'" },
    { key: "'react-native-responsive-fontsize'", value: "'<rootDir>/__mocks__/react-native-responsive-fontsize.tsx'" },
    { key: "'react-native-size-matters'", value: "'<rootDir>/__mocks__/react-native-size-matters.tsx'" }
  ]);
  if (!/moduleNameMapper\s*:\s*\{/m.test(merged)) {
    merged = insertTopLevelField(
      merged,
      "moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '\\\\.(png|jpg|jpeg|gif|webp|svg|mp4|mp3|ttf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.tsx', '\\\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.ts', 'react-native-responsive-fontsize': '<rootDir>/__mocks__/react-native-responsive-fontsize.tsx', 'react-native-size-matters': '<rootDir>/__mocks__/react-native-size-matters.tsx' },"
    );
  }

  return merged;
}

function mergeNativeMappers(existing: string): string {
  return mergeObjectField(existing, "moduleNameMapper", NATIVE_MODULE_MAPPERS);
}

function detectPackageManager(projectRoot: string): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

function installTestingLibrary(projectRoot: string, dryRun: boolean): void {
  const pkgManager = detectPackageManager(projectRoot);
  const packageName = "@testing-library/react-native";
  const pkgPath = path.join(projectRoot, "package.json");
  const pkgRaw = readTextIfExists(pkgPath);
  if (!pkgRaw) {
    logWarn("package.json not found. Skipping dependency install.");
    return;
  }

  const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const alreadyInstalled = Boolean(pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName]);
  if (alreadyInstalled) {
    logSuccess(`${packageName} already present.`);
    return;
  }

  if (dryRun) {
    logSuccess(`[dry-run] Would install ${packageName}`);
    return;
  }

  const cmd =
    pkgManager === "yarn"
      ? { bin: "yarn", args: ["add", "-D", packageName] }
      : pkgManager === "pnpm"
        ? { bin: "pnpm", args: ["add", "-D", packageName] }
        : { bin: "npm", args: ["install", "-D", packageName] };

  logInfo(`Installing ${packageName} using ${pkgManager}...`);
  const install = spawnSync(cmd.bin, cmd.args, {
    cwd: projectRoot,
    stdio: "inherit",
    encoding: "utf8"
  });
  if (install.status === 0) {
    logSuccess(`Installed ${packageName}`);
  } else {
    logWarn(`Failed to install ${packageName}. Please install it manually.`);
  }
}

type SetupOptions = {
  force?: boolean;
  dryRun?: boolean;
  withNativeMocks?: boolean;
  skipInstall?: boolean;
};

function writeOrPreview(
  targetPath: string,
  content: string,
  overwrite: boolean,
  dryRun: boolean
): { written: boolean; skipped?: boolean } {
  if (dryRun) {
    const exists = fs.existsSync(targetPath);
    if (exists && !overwrite) {
      logWarn(`[dry-run] Would skip existing file: ${targetPath}`);
      return { written: false, skipped: true };
    }
    logSuccess(`[dry-run] Would write ${targetPath}`);
    return { written: true };
  }
  const res = writeFileSafe(targetPath, content, overwrite);
  if (!res.written) return { written: false, skipped: true };
  return { written: true };
}

export function runSetup(projectRoot: string, options: SetupOptions): void {
  const overwrite = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);
  const withNativeMocks = Boolean(options.withNativeMocks);
  const skipInstall = Boolean(options.skipInstall);
  if (!skipInstall) installTestingLibrary(projectRoot, dryRun);
  const jestConfigPath = path.join(projectRoot, "jest.config.js");
  const jestSetupPath = path.join(projectRoot, "jest.setup.ts");
  const jestConfigExists = fs.existsSync(jestConfigPath);
  const jestSetupExists = fs.existsSync(jestSetupPath);

  if (jestConfigExists && !overwrite) {
    const existing = fs.readFileSync(jestConfigPath, "utf8");
    let merged = mergeJestConfig(existing);
    if (withNativeMocks) merged = mergeNativeMappers(merged);
    if (merged !== existing) {
      const backupPath = path.join(projectRoot, `jest.config.backup.${Date.now()}.js`);
      if (dryRun) {
        logSuccess(`[dry-run] Would merge jest.config.js (backup: ${backupPath})`);
      } else {
        fs.copyFileSync(jestConfigPath, backupPath);
        fs.writeFileSync(jestConfigPath, merged, "utf8");
        logSuccess(`Merged missing config into jest.config.js (backup: ${backupPath})`);
      }
    } else {
      logSuccess("jest.config.js already contains required entries.");
    }
  }

  if (jestConfigExists && overwrite) {
    const backupPath = path.join(
      projectRoot,
      `jest.config.backup.${Date.now()}.js`
    );
    if (dryRun) {
      logSuccess(`[dry-run] Would backup existing Jest config to ${backupPath}`);
    } else {
      fs.copyFileSync(jestConfigPath, backupPath);
      logSuccess(`Backed up existing Jest config to ${backupPath}`);
    }
  }

  const files = [
    { path: jestConfigPath, content: JEST_CONFIG, skip: jestConfigExists && !overwrite },
    { path: jestSetupPath, content: JEST_SETUP, skip: false },
    { path: path.join(projectRoot, "__mocks__/fileMock.tsx"), content: "export default 'test-file-stub';\n" },
    { path: path.join(projectRoot, "__mocks__/styleMock.ts"), content: "export default {};\n" },
    {
      path: path.join(projectRoot, "__mocks__/react-native-responsive-fontsize.tsx"),
      content: "export const RFValue = (v: number) => v;\nexport const RFPercentage = (v: number) => v;\n"
    },
    {
      path: path.join(projectRoot, "__mocks__/react-native-size-matters.tsx"),
      content: "export const scale = (v: number) => v;\nexport const verticalScale = (v: number) => v;\nexport const moderateScale = (v: number) => v;\n"
    },
    {
      path: path.join(projectRoot, "__mocks__/react-native-config.ts"),
      content: "export default { API_URL: 'http://localhost', ENV: 'test' };\n",
      skip: !withNativeMocks
    },
    {
      path: path.join(projectRoot, "__mocks__/react-native-device-info.ts"),
      content: "export default { getVersion: () => '1.0.0', getBuildNumber: () => '1' };\n",
      skip: !withNativeMocks
    },
    {
      path: path.join(projectRoot, "__mocks__/react-native-vector-icons-MaterialIcons.ts"),
      content: "export default 'Icon';\n",
      skip: !withNativeMocks
    }
  ];

  for (const item of files) {
    if (item.path === jestSetupPath && jestSetupExists && !overwrite) {
      const existing = fs.readFileSync(jestSetupPath, "utf8");
      let merged = mergeJestSetup(existing);
      if (withNativeMocks) merged = mergeNativeSetupMocks(merged);
      if (merged !== existing) {
        const backupPath = path.join(projectRoot, `jest.setup.backup.${Date.now()}.ts`);
        if (dryRun) {
          logSuccess(`[dry-run] Would merge jest.setup.ts (backup: ${backupPath})`);
        } else {
          fs.copyFileSync(jestSetupPath, backupPath);
          fs.writeFileSync(jestSetupPath, merged, "utf8");
          logSuccess(`Merged missing mocks into jest.setup.ts (backup: ${backupPath})`);
        }
      } else {
        logSuccess("jest.setup.ts already contains required mocks.");
      }
      continue;
    }
    if (item.skip) continue;
    const res = writeOrPreview(item.path, item.content, overwrite, dryRun);
    if (!res.written) {
      logWarn(`Skipped existing file: ${item.path}`);
    } else {
      if (!dryRun) logSuccess(`Wrote ${item.path}`);
    }
  }

  const pkgPath = path.join(projectRoot, "package.json");
  const pkgRaw = readTextIfExists(pkgPath);
  if (!pkgRaw) {
    logWarn("package.json not found. Could not add scripts.");
    return;
  }
  const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
  scripts.test = scripts.test ?? "jest";
  scripts["test:watch"] = scripts["test:watch"] ?? "jest --watch";
  pkg.scripts = scripts;
  if (dryRun) {
    logSuccess("[dry-run] Would update package.json scripts");
  } else {
    writeFileSafe(pkgPath, prettyJson(pkg), true);
    logSuccess("Updated package.json scripts");
  }
}
