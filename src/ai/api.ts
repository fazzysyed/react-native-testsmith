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

export function createApiProvider(): AiProvider {
  return {
    runtime: "api",
    async generateText({ prompt, model }) {
      const endpoint = process.env.RN_TESTSMITH_API_URL;
      const apiKey = process.env.RN_TESTSMITH_API_KEY;
      if (!endpoint) {
        throw new Error("RN_TESTSMITH_API_URL is not set.");
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          input: prompt
        })
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
  };
}
