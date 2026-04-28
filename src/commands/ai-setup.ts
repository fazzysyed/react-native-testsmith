import { loadConfig } from "../config.js";
import { logInfo, logSuccess, logWarn } from "../utils.js";

type AiSetupOptions = {
  endpoint?: string;
};

export async function runAiSetup(projectRoot: string, options: AiSetupOptions): Promise<void> {
  const config = loadConfig(projectRoot);
  const endpoint = options.endpoint ?? process.env.RN_TESTSMITH_API_URL ?? "https://c087-182-180-87-19.ngrok-free.app/generate-tests";
  const apiKey = process.env.RN_TESTSMITH_API_KEY;
  if (!endpoint) {
    logWarn("API endpoint is not configured.");
    logInfo("Set RN_TESTSMITH_API_URL and re-run `react-native-testsmith ai-setup`.");
    return;
  }

  logInfo(`Checking API endpoint: ${endpoint}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: "healthcheck"
  }).catch(() => null);

  if (!res) {
    logWarn("API endpoint is unreachable.");
    logInfo("Check URL/network and try again.");
    return;
  }

  if (!res.ok) {
    logWarn(`API endpoint responded with ${res.status}.`);
    logInfo("Endpoint is reachable, but request contract may differ. This can still be okay for real prompts.");
    return;
  }

  logSuccess("API setup looks good.");
  logInfo(`Model configured in project config: ${config.ai.model}`);
}
