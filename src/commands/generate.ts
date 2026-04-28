import fs from "node:fs";
import path from "node:path";
import { SCAN_REPORT_FILE } from "../constants.js";
import { loadConfig } from "../config.js";
import type { ComponentMeta, ScanReport } from "../types.js";
import { ensureDir, logSuccess, logWarn, resolveFromRoot, writeFileSafe } from "../utils.js";

function canonicalPath(inputPath: string): string {
  try {
    return fs.realpathSync.native(inputPath);
  } catch {
    return path.resolve(inputPath);
  }
}

function toImportPath(fromFile: string, targetFile: string): string {
  const rel = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(tsx|ts|jsx|js)$/i, "");
  return withoutExt.startsWith(".") ? withoutExt : `./${withoutExt}`;
}

function toTestExtension(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === ".js") return ".test.js";
  if (ext === ".jsx") return ".test.jsx";
  if (ext === ".ts") return ".test.ts";
  return ".test.tsx";
}

function toMirroredTestsPath(projectRoot: string, sourcePath: string, scanDirs: string[], outputDir: string): string {
  const rootCanonical = canonicalPath(projectRoot);
  const absSource = canonicalPath(sourcePath);
  for (const dir of scanDirs) {
    const absScanDir = canonicalPath(path.resolve(projectRoot, dir));
    if (absSource.startsWith(`${absScanDir}${path.sep}`) || absSource === absScanDir) {
      const scanDirName = path.basename(absScanDir);
      const relInsideScanDir = path.relative(absScanDir, absSource);
      const relDir = path.dirname(relInsideScanDir);
      const base = path.basename(absSource, path.extname(absSource));
      const fileName = `${base}${toTestExtension(sourcePath)}`;
      return relDir === "." ? path.join(rootCanonical, outputDir, scanDirName, fileName) : path.join(rootCanonical, outputDir, scanDirName, relDir, fileName);
    }
  }

  const relFromRoot = path.relative(rootCanonical, absSource);
  const relDir = path.dirname(relFromRoot);
  const base = path.basename(absSource, path.extname(absSource));
  const fileName = `${base}${toTestExtension(sourcePath)}`;
  return relDir === "." ? path.join(rootCanonical, outputDir, fileName) : path.join(rootCanonical, outputDir, relDir, fileName);
}

function testTemplate(meta: ComponentMeta, importPath: string): string {
  const textChecks = [...meta.textLiterals, ...meta.buttonTitles].slice(0, 4);
  const assertions = textChecks.length
    ? textChecks.map((text) => `  expect(getByText(${JSON.stringify(text)})).toBeTruthy();`).join("\n")
    : "  expect(toJSON()).toBeTruthy();";

  const navMock = meta.hasNavigation
    ? "jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));\n\n"
    : "";

  const apiMock = meta.hasApiCalls ? "  // TODO: add fetch/axios mock for API-dependent behavior.\n" : "";
  const reduxNote = meta.hasRedux ? "  // TODO: wrap with Redux provider when asserting state-driven UI.\n" : "";

  return `import React from 'react';
import { render } from '@testing-library/react-native';
import ${meta.componentName} from '${importPath}';

${navMock}describe('${meta.componentName}', () => {
  it('renders expected UI', () => {
${reduxNote}${apiMock}    const { getByText, toJSON } = render(<${meta.componentName} />);
${assertions}
  });
});
`;
}

export function runGenerate(projectRoot: string, options: { force?: boolean }): void {
  const config = loadConfig(projectRoot);
  const reportPath = resolveFromRoot(projectRoot, SCAN_REPORT_FILE);
  if (!fs.existsSync(reportPath)) {
    logWarn("No scan report found. Run `react-native-testsmith scan` first.");
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as ScanReport;
  const overwrite = Boolean(options.force);
  let written = 0;

  for (const component of report.components) {
    const outPath =
      config.testFileStyle === "co-located"
        ? path.join(path.dirname(component.filePath), `${component.componentName}${toTestExtension(component.filePath)}`)
        : toMirroredTestsPath(projectRoot, component.filePath, config.scanDirs, config.outputDir);

    ensureDir(outPath);
    const importPath = toImportPath(outPath, component.filePath);
    const content = testTemplate(component, importPath);
    const res = writeFileSafe(outPath, content, overwrite);
    if (res.written) written += 1;
  }

  logSuccess(`Generated ${written} test file(s).`);
}
