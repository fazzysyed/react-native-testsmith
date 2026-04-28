import type { AiProvider } from "./provider.js";

type ApiTextResponse = {
  response?: string;
  text?: string;
  output?: string;
  data?: {
    response?: string;
    text?: string;
    output?: string;
  };
};

function extractApiText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const p = payload as ApiTextResponse;
  return p.response ?? p.text ?? p.output ?? p.data?.response ?? p.data?.text ?? p.data?.output ?? "";
}

async function callApi(endpoint: string, bodyText: string, apiKey?: string): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: bodyText
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    const text = extractApiText(json);
    if (!text) throw new Error("API response did not include a text payload.");
    return text;
  }

  return res.text();
}

function chunkText(input: string, chunkSize: number): string[] {
  if (input.length <= chunkSize) return [input];
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }
  return chunks;
}

export function createApiProvider(): AiProvider {
  return {
    runtime: "api",
    async generateText({ prompt, model }) {
      const endpoint = process.env.RN_TESTSMITH_API_URL ?? "https://aashir321-faraz-ai-model.hf.space/generate-tests";
      const apiKey = process.env.RN_TESTSMITH_API_KEY;
      if (!endpoint) {
        throw new Error("RN_TESTSMITH_API_URL is not set.");
      }

      const chunkSize = Number(process.env.RN_TESTSMITH_API_CHUNK_SIZE ?? "12000");
      const chunks = chunkText(prompt, chunkSize);

      if (chunks.length === 1) {
        return callApi(endpoint, chunks[0], apiKey);
      }

      const analyses: string[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkPrompt = `Model: ${model}
You are receiving chunk ${i + 1}/${chunks.length} from a large React Native component/test request.
Return concise notes for this chunk covering:
- rendered UI and text labels
- state/hooks/effects
- handlers/user interactions
- async/api calls and mocks
- navigation/redux usage

Chunk:
${chunks[i]}`;
        analyses.push(await callApi(endpoint, chunkPrompt, apiKey));
      }

      const synthesisPrompt = `Model: ${model}
You are given chunk analyses from a large React Native input.
Produce final output in this format:
### Component Summary
...
### Key Test Scenarios
- ...
### Full Test File
\`\`\`tsx
...full test file...
\`\`\`

Chunk analyses:
${analyses.map((a, idx) => `--- Chunk ${idx + 1} ---\n${a}`).join("\n\n")}`;

      return callApi(endpoint, synthesisPrompt, apiKey);
    }
  };
}
