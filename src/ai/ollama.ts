import { spawn, spawnSync } from "node:child_process";

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

export function isOllamaInstalled(): boolean {
  const res = spawnSync("ollama", ["--version"], { encoding: "utf8" });
  return res.status === 0;
}

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags");
    return res.ok;
  } catch {
    return false;
  }
}

export function tryStartOllamaServer(): void {
  const child = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

export async function listOllamaModels(): Promise<string[]> {
  const res = await fetch("http://127.0.0.1:11434/api/tags");
  if (!res.ok) return [];
  const json = (await res.json()) as OllamaTagsResponse;
  return (json.models ?? []).map((m) => m.name ?? "").filter(Boolean);
}

export async function hasOllamaModel(modelName: string): Promise<boolean> {
  const models = await listOllamaModels();
  return models.includes(modelName);
}

export function pullOllamaModel(modelName: string): boolean {
  const run = spawnSync("ollama", ["pull", modelName], {
    stdio: "inherit",
    encoding: "utf8"
  });
  return run.status === 0;
}

export async function waitForOllamaServer(maxAttempts = 10, waitMs = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await isOllamaReachable()) return true;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return false;
}
