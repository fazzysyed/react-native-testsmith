import type { AiProvider } from "./provider.js";

type OllamaResponse = {
  response?: string;
};

export function createOllamaProvider(): AiProvider {
  return {
    runtime: "ollama",
    async generateText({ prompt, model }) {
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
      return json.response;
    }
  };
}
