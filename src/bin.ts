#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runSetup } from "./commands/setup.js";
import { runScan } from "./commands/scan.js";
import { runGenerate } from "./commands/generate.js";
import { runDoctor } from "./commands/doctor.js";
import { runAiEnhance } from "./commands/ai-enhance.js";
import { runAiSetup } from "./commands/ai-setup.js";

const program = new Command();
const projectRoot = process.cwd();

program
  .name("react-native-testsmith")
  .description("Local-first React Native test setup and generation CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Create default react-native-testsmith config")
  .option("-f, --force", "overwrite existing config")
  .action((options) => runInit(projectRoot, options));

program
  .command("setup")
  .description("Create Jest + React Native setup files")
  .option("-f, --force", "overwrite existing setup files")
  .option("--dry-run", "preview file changes without writing")
  .option("--with-native-mocks", "also add common native module mocks")
  .option("--skip-install", "skip dependency installation step")
  .action((options) => runSetup(projectRoot, options));

program
  .command("scan")
  .description("Scan components and generate metadata report")
  .action(() => runScan(projectRoot));

program
  .command("generate")
  .description("Generate test templates from scan report")
  .option("-f, --force", "overwrite existing test files")
  .action((options) => runGenerate(projectRoot, options));

program
  .command("ai-setup")
  .description("Install/check local AI runtime requirements (Ollama + model)")
  .option("-m, --model <name>", "Ollama model name override")
  .option("--skip-pull", "skip model download and only run checks")
  .action(async (options) => runAiSetup(projectRoot, options));

program
  .command("ai-enhance")
  .description("Generate or improve tests with local Ollama model")
  .requiredOption("-t, --target <path>", "target component path")
  .option("-m, --model <name>", "Ollama model name override")
  .option("--apply", "write generated test file")
  .option("-f, --force", "overwrite existing generated test file")
  .option("--run-jest", "run scoped jest for generated file")
  .action(async (options) => runAiEnhance(projectRoot, options));

program
  .command("doctor")
  .description("Validate test setup health")
  .option("--json", "print machine-readable doctor report")
  .action((options) => runDoctor(projectRoot, options));

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
