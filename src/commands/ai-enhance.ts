import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../config.js";
import { SCAN_REPORT_FILE } from "../constants.js";
import type { ComponentMeta, ScanReport } from "../types.js";
import { ensureDir, logInfo, logSuccess, logWarn, resolveFromRoot, writeFileSafe } from "../utils.js";
import { hasOllamaModel, isOllamaInstalled, isOllamaReachable, pullOllamaModel, tryStartOllamaServer, waitForOllamaServer } from "../ai/ollama.js";

type AiEnhanceOptions = {
  target?: string;
  model?: string;
  apply?: boolean;
  force?: boolean;
  runJest?: boolean;
};

type OllamaResponse = {
  response?: string;
};

function cleanModelOutput(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:tsx|ts|javascript|jsx)?\n([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function toTestExtension(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === ".js") return ".test.js";
  if (ext === ".jsx") return ".test.jsx";
  if (ext === ".ts") return ".test.ts";
  return ".test.tsx";
}

function canonicalPath(inputPath: string): string {
  try {
    return fs.realpathSync.native(inputPath);
  } catch {
    return path.resolve(inputPath);
  }
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
      return relDir === "."
        ? path.join(rootCanonical, outputDir, scanDirName, fileName)
        : path.join(rootCanonical, outputDir, scanDirName, relDir, fileName);
    }
  }

  const relFromRoot = path.relative(rootCanonical, absSource);
  const relDir = path.dirname(relFromRoot);
  const base = path.basename(absSource, path.extname(absSource));
  const fileName = `${base}${toTestExtension(sourcePath)}`;
  return relDir === "." ? path.join(rootCanonical, outputDir, fileName) : path.join(rootCanonical, outputDir, relDir, fileName);
}

function resolveTestPath(projectRoot: string, componentPath: string, componentName: string): string {
  const config = loadConfig(projectRoot);
  const fileName = `${componentName}${toTestExtension(componentPath)}`;
  if (config.testFileStyle === "co-located") {
    return path.join(path.dirname(componentPath), fileName);
  }
  return toMirroredTestsPath(projectRoot, componentPath, config.scanDirs, config.outputDir);
}

function loadMetadataForTarget(projectRoot: string, absTarget: string): ComponentMeta | null {
  const reportPath = resolveFromRoot(projectRoot, SCAN_REPORT_FILE);
  if (!fs.existsSync(reportPath)) return null;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as ScanReport;
    return report.components.find((c) => path.resolve(c.filePath) === absTarget) ?? null;
  } catch {
    return null;
  }
}

async function generateWithOllama(prompt: string, model: string): Promise<string> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as OllamaResponse;
  if (!json.response) throw new Error("Ollama returned empty response");
  return cleanModelOutput(json.response);
}

function buildPrompt(componentName: string, componentCode: string, existingTest: string | null, meta: ComponentMeta | null): string {
  const hints = meta
    ? `Detected hints:
- hasNavigation: ${meta.hasNavigation}
- hasRedux: ${meta.hasRedux}
- hasApiCalls: ${meta.hasApiCalls}
- textLiterals: ${meta.textLiterals.join(", ") || "none"}
- buttonTitles: ${meta.buttonTitles.join(", ") || "none"}`
    : "Detected hints: unavailable";

  return `You are generating a Jest + @testing-library/react-native test file.
Return ONLY valid TypeScript test code (no markdown, no explanations).

Requirements:
- Use describe('${componentName}', ...)
- Include at least 3 test cases: render, important text/assertion, interaction or async behavior
- Add mocks when relevant (navigation, redux, network)
- Keep tests deterministic and concise
- Prefer getByText/queryByText/fireEvent/waitFor patterns

${hints}

Component source:
${componentCode}

${existingTest ? `Existing test file (improve/extend this style, do not remove useful tests):\n${existingTest}\n` : ""}
Now output the final test file content only.`;
}

function buildRepairPrompt(
  componentName: string,
  componentCode: string,
  failingTestCode: string,
  jestError: string
): string {
  return `You are fixing a failing Jest + @testing-library/react-native test file.
Return ONLY valid TypeScript/JavaScript test code (no markdown, no explanations).

Rules:
- Keep describe('${componentName}', ...)
- Fix the failing assertions/imports/mocks based on error output
- Keep tests deterministic
- Preserve valid existing tests where possible

Component source:
${componentCode}

Current failing test file:
${failingTestCode}

Jest failure output:
${jestError.slice(0, 4000)}

Now output the fixed test file content only.`;
}

function runScopedJest(projectRoot: string, testPath: string): { ok: boolean; output: string } {
  const rel = path.relative(projectRoot, testPath);
  const run = spawnSync("npx", ["jest", rel, "--runInBand"], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  return { ok: run.status === 0, output };
}

export async function runAiEnhance(projectRoot: string, options: AiEnhanceOptions): Promise<void> {
  const config = loadConfig(projectRoot);
  const model = options.model ?? config.ai.model;
  const apply = Boolean(options.apply);
  const runJest = Boolean(options.runJest);
  const force = Boolean(options.force);
  const maxRetries = config.ai.maxRetries;

  if (!options.target) {
    logWarn("Missing --target. Example: react-native-testsmith ai-enhance --target src/screens/LoginScreen.tsx --apply");
    return;
  }

  if (!isOllamaInstalled()) {
    logWarn("Ollama is not installed.");
    logInfo("Install Ollama from https://ollama.com/download and run `react-native-testsmith ai-setup`.");
    return;
  }

  let reachable = await isOllamaReachable();
  if (!reachable) {
    logInfo("Ollama is not running. Attempting to start it...");
    tryStartOllamaServer();
    reachable = await waitForOllamaServer();
  }
  if (!reachable) {
    logWarn("Could not connect to Ollama at http://127.0.0.1:11434.");
    logInfo("Run `react-native-testsmith ai-setup` to bootstrap Ollama and model.");
    return;
  }

  const modelExists = await hasOllamaModel(model);
  if (!modelExists) {
    logInfo(`Model ${model} is not installed locally.`);
    logInfo("First-time model download can take several minutes. Please wait...");
    const pulled = pullOllamaModel(model);
    if (!pulled) {
      logWarn(`Failed to download model: ${model}`);
      return;
    }
  }

  const absTarget = resolveFromRoot(projectRoot, options.target);
  if (!fs.existsSync(absTarget)) {
    logWarn(`Target file not found: ${absTarget}`);
    return;
  }

  const componentName = path.basename(absTarget).replace(/\.(tsx|ts|jsx|js)$/i, "");
  const testPath = resolveTestPath(projectRoot, absTarget, componentName);
  const existingTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, "utf8") : null;
  const componentCode = fs.readFileSync(absTarget, "utf8");
  const meta = loadMetadataForTarget(projectRoot, absTarget);
  const prompt = buildPrompt(componentName, componentCode, existingTest, meta);

  logInfo(`Generating AI-enhanced tests with local Ollama model: ${model}`);
  let generated = await generateWithOllama(prompt, model);

  if (!generated.includes("describe(") || !generated.includes("it(")) {
    logWarn("Model output does not look like a Jest test file. Aborting write.");
    return;
  }

  if (!apply) {
    logSuccess("AI generation completed (preview mode).");
    logInfo("Use --apply to write the generated test file.");
    console.log(`\n${generated.slice(0, 1600)}\n`);
    return;
  }

  ensureDir(testPath);
  const initialContent = `${generated.trim()}\n`;
  const res = writeFileSafe(testPath, initialContent, force);
  if (!res.written) {
    logWarn(`Test file already exists: ${testPath}. Use --force to overwrite.`);
    return;
  }
  logSuccess(`Wrote AI-enhanced test: ${testPath}`);

  if (runJest) {
    let jestResult = runScopedJest(projectRoot, testPath);
    if (jestResult.ok) {
      logSuccess("Jest validation passed for generated test.");
      return;
    }

    logWarn("Jest validation failed for generated test.");
    console.log(jestResult.output.slice(0, 2500));

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      logInfo(`Attempting AI auto-fix (${attempt}/${maxRetries})...`);
      const failingTest = fs.readFileSync(testPath, "utf8");
      const repairPrompt = buildRepairPrompt(componentName, componentCode, failingTest, jestResult.output);
      generated = await generateWithOllama(repairPrompt, model);
      if (!generated.includes("describe(") || !generated.includes("it(")) {
        logWarn("Auto-fix output was invalid test content. Stopping retries.");
        break;
      }
      fs.writeFileSync(testPath, `${generated.trim()}\n`, "utf8");
      jestResult = runScopedJest(projectRoot, testPath);
      if (jestResult.ok) {
        logSuccess("Auto-fix succeeded. Jest now passes.");
        return;
      }
      logWarn("Auto-fix attempt failed.");
      console.log(jestResult.output.slice(0, 2500));
    }

    logWarn("AI auto-fix retries exhausted. Please review generated test manually.");
  }
}
