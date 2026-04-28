export type RuntimeConfig = {
  scanDirs: string[];
  outputDir: string;
  testFileStyle: "co-located" | "tests-dir";
  ai: {
    enabled: boolean;
    runtime: "ollama";
    model: string;
    maxRetries: number;
  };
};

export type ComponentMeta = {
  filePath: string;
  componentName: string;
  hasNavigation: boolean;
  hasRedux: boolean;
  hasApiCalls: boolean;
  textLiterals: string[];
  buttonTitles: string[];
};

export type ScanReport = {
  generatedAt: string;
  projectRoot: string;
  components: ComponentMeta[];
};
