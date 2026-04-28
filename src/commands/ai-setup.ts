import { loadConfig } from "../config.js";
import { logInfo, logSuccess, logWarn } from "../utils.js";
import {
  hasOllamaModel,
  isOllamaInstalled,
  isOllamaReachable,
  listOllamaModels,
  pullOllamaModel,
  tryStartOllamaServer,
  waitForOllamaServer
} from "../ai/ollama.js";

type AiSetupOptions = {
  model?: string;
  skipPull?: boolean;
};

export async function runAiSetup(projectRoot: string, options: AiSetupOptions): Promise<void> {
  const config = loadConfig(projectRoot);
  if (config.ai.runtime === "api") {
    logInfo("AI runtime is set to API mode.");
    logInfo("Set RN_TESTSMITH_API_URL (required) and RN_TESTSMITH_API_KEY (optional).");
    return;
  }
  const model = options.model ?? config.ai.model;

  if (!isOllamaInstalled()) {
    logWarn("Ollama is not installed.");
    logInfo("Install Ollama first: https://ollama.com/download");
    return;
  }

  let reachable = await isOllamaReachable();
  if (!reachable) {
    logInfo("Ollama service is not running. Starting it now...");
    tryStartOllamaServer();
    reachable = await waitForOllamaServer();
  }

  if (!reachable) {
    logWarn("Could not connect to Ollama at http://127.0.0.1:11434.");
    logInfo("Please run `ollama serve` and re-run `react-native-testsmith ai-setup`.");
    return;
  }

  logSuccess("Ollama service is ready.");

  if (options.skipPull) {
    const models = await listOllamaModels();
    logInfo(`Installed models: ${models.length ? models.join(", ") : "none"}`);
    return;
  }

  const modelExists = await hasOllamaModel(model);
  if (modelExists) {
    logSuccess(`Model already installed: ${model}`);
    return;
  }

  logInfo(`Model not found: ${model}`);
  logInfo("First-time model download can take several minutes. Please wait...");
  const pulled = pullOllamaModel(model);
  if (!pulled) {
    logWarn(`Failed to pull model: ${model}`);
    return;
  }
  logSuccess(`Model downloaded successfully: ${model}`);
}
