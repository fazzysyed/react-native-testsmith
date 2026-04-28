import fs from "node:fs";
import path from "node:path";
import { SCAN_REPORT_FILE } from "../constants.js";
import { loadConfig } from "../config.js";
import type { ComponentMeta, ScanReport } from "../types.js";
import { ensureDir, logInfo, logSuccess, logWarn, resolveFromRoot, writeFileSafe } from "../utils.js";
import { runScan } from "./scan.js";
import { runAiSetup } from "./ai-setup.js";
import { createApiProvider } from "../ai/api.js";

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

function extractCodeFromApiResponse(raw: string): string {
  const fenced = raw.match(/```(?:tsx|ts|jsx|js)?\n([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

function buildPrompt(meta: ComponentMeta, sourceCode: string, importPath: string): string {
  return `You are generating Jest + React Native Testing Library test code for a single file.
Return ONLY test code. No explanation.

Target component/file name: ${meta.componentName}
Import path to use in test: ${importPath}
Detected hints:
- hasNavigation: ${meta.hasNavigation}
- hasRedux: ${meta.hasRedux}
- hasApiCalls: ${meta.hasApiCalls}
- textLiterals: ${meta.textLiterals.join(", ") || "none"}
- buttonTitles: ${meta.buttonTitles.join(", ") || "none"}

Source:
${sourceCode}`;
}

export async function runGenerate(projectRoot: string, options: { force?: boolean }): Promise<void> {
  const config = loadConfig(projectRoot);
  runScan(projectRoot);
  await runAiSetup(projectRoot, {});
  const reportPath = resolveFromRoot(projectRoot, SCAN_REPORT_FILE);
  if (!fs.existsSync(reportPath)) {
    logWarn("No scan report found. Run `react-native-testsmith scan` first.");
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as ScanReport;
  const overwrite = Boolean(options.force);
  let written = 0;
  let responded = 0;
  const provider = createApiProvider();

  for (let idx = 0; idx < report.components.length; idx += 1) {
    const component = report.components[idx];
    const relSource = path.relative(projectRoot, component.filePath);
    logInfo(`[${idx + 1}/${report.components.length}] Processing ${relSource}`);
    const outPath =
      config.testFileStyle === "co-located"
        ? path.join(path.dirname(component.filePath), `${component.componentName}${toTestExtension(component.filePath)}`)
        : toMirroredTestsPath(projectRoot, component.filePath, config.scanDirs, config.outputDir);

    ensureDir(outPath);
    const importPath = toImportPath(outPath, component.filePath);
    const sourceCode = fs.readFileSync(component.filePath, "utf8");
    const prompt = buildPrompt(component, sourceCode, importPath);
    let content = "";
    try {
      const apiRaw = await provider.generateText({ prompt, model: config.ai.model });
      responded += 1;
      content = `${extractCodeFromApiResponse(apiRaw)}\n`;
    } catch (error) {
      logWarn(`API failed for ${relSource}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const res = writeFileSafe(outPath, content, overwrite);
    if (res.written) written += 1;
  }

  logSuccess(`AI responded for ${responded}/${report.components.length} file(s).`);
  logSuccess(`Generated ${written} test file(s).`);
}
