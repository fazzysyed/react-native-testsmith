import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { parse } from "@babel/parser";
import babelTraverse from "@babel/traverse";
import { SCAN_REPORT_FILE } from "../constants.js";
import { loadConfig } from "../config.js";
import type { ComponentMeta, ScanReport } from "../types.js";
import { ensureDir, logInfo, logSuccess, resolveFromRoot, writeFileSafe, prettyJson } from "../utils.js";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function parseComponent(filePath: string): ComponentMeta | null {
  const code = fs.readFileSync(filePath, "utf8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"]
  });

  let componentName: string | null = null;
  let hasNavigation = false;
  let hasRedux = false;
  let hasApiCalls = false;
  const textLiterals: string[] = [];
  const buttonTitles: string[] = [];

  const traverse = (babelTraverse as unknown as { default?: Function }).default ?? (babelTraverse as unknown as Function);
  traverse(ast, {
    FunctionDeclaration(pathRef: any) {
      if (pathRef.node.id?.name?.match(/^[A-Z]/)) {
        componentName = pathRef.node.id.name;
      }
    },
    VariableDeclarator(pathRef: any) {
      if (pathRef.node.id.type === "Identifier" && pathRef.node.id.name.match(/^[A-Z]/)) {
        componentName = pathRef.node.id.name;
      }
    },
    Identifier(pathRef: any) {
      const name = pathRef.node.name;
      if (name === "useNavigation") hasNavigation = true;
      if (name === "useSelector" || name === "useDispatch") hasRedux = true;
      if (name === "fetch" || name === "axios") hasApiCalls = true;
    },
    JSXText(pathRef: any) {
      const text = pathRef.node.value.trim();
      if (text && text.length < 80) textLiterals.push(text);
    },
    JSXAttribute(pathRef: any) {
      if (pathRef.node.name.name === "title" && pathRef.node.value?.type === "StringLiteral") {
        buttonTitles.push(pathRef.node.value.value);
      }
    }
  });

  if (!componentName) {
    const baseName = path.basename(filePath, path.extname(filePath));
    componentName = baseName.replace(/[^a-zA-Z0-9_$]/g, "_");
  }

  return {
    filePath,
    componentName,
    hasNavigation,
    hasRedux,
    hasApiCalls,
    textLiterals: unique(textLiterals),
    buttonTitles: unique(buttonTitles)
  };
}

export function runScan(projectRoot: string): void {
  const config = loadConfig(projectRoot);
  const patterns = config.scanDirs.map((d) => `${d.replace(/\/+$/, "")}/**/*.{tsx,jsx,ts,js}`);
  patterns.push("App.{tsx,jsx,ts,js}");
  const files = fg.sync(patterns, { cwd: projectRoot, absolute: true, onlyFiles: true });
  const components: ComponentMeta[] = [];

  for (const filePath of files) {
    try {
      const meta = parseComponent(filePath);
      if (meta) components.push(meta);
    } catch {
      logInfo(`Skipped unparsable file: ${path.relative(projectRoot, filePath)}`);
    }
  }

  const report: ScanReport = {
    generatedAt: new Date().toISOString(),
    projectRoot,
    components
  };

  const reportPath = resolveFromRoot(projectRoot, SCAN_REPORT_FILE);
  ensureDir(reportPath);
  writeFileSafe(reportPath, prettyJson(report), true);
  logSuccess(`Scan complete. ${components.length} components indexed.`);
  logInfo(`Report saved to ${reportPath}`);
}
