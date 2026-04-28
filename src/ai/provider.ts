export type AiProviderRuntime = "api";

export type GenerateTextInput = {
  prompt: string;
  model: string;
};

export type AiProvider = {
  runtime: AiProviderRuntime;
  generateText: (input: GenerateTextInput) => Promise<string>;
};
