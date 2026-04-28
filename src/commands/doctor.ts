import fs from "node:fs";
import path from "node:path";
import { logInfo, logWarn, logSuccess } from "../utils.js";

const REQUIRED = [
  "jest.config.js",
  "jest.setup.ts",
  "__mocks__/fileMock.tsx",
  "__mocks__/styleMock.ts"
];

const OPTIONAL_NATIVE = [
  "__mocks__/react-native-config.ts",
  "__mocks__/react-native-device-info.ts",
  "__mocks__/react-native-vector-icons-MaterialIcons.ts"
];

type DoctorOptions = {
  json?: boolean;
};

export function runDoctor(projectRoot: string, options: DoctorOptions = {}): void {
  let ok = true;
  const missing: string[] = [];
  const found: string[] = [];
  const optionalFound: string[] = [];

  for (const rel of REQUIRED) {
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) {
      ok = false;
      missing.push(rel);
      if (!options.json) logWarn(`Missing ${rel}`);
    } else {
      found.push(rel);
      if (!options.json) logInfo(`Found ${rel}`);
    }
  }

  for (const rel of OPTIONAL_NATIVE) {
    const full = path.join(projectRoot, rel);
    if (fs.existsSync(full)) {
      optionalFound.push(rel);
      if (!options.json) logInfo(`Found optional native mock ${rel}`);
    }
  }

  if (options.json) {
    const payload = {
      ok,
      found,
      missing,
      optionalFound
    };
    console.log(JSON.stringify(payload, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (ok) {
    logSuccess("Project test setup looks healthy.");
  } else {
    logWarn("Run `react-native-testsmith setup` to create missing files.");
  }
}
