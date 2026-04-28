import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CLI_PATH = path.resolve("dist/bin.js");

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-native-testsmith-"));
  const pkg = {
    name: "fixture-app",
    version: "1.0.0",
    private: true,
    scripts: {}
  };
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return dir;
}

function runCli(cwd, args) {
  return execFileSync("node", [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8"
  });
}

test("setup --dry-run does not create files", () => {
  const projectDir = makeTempProject();
  runCli(projectDir, ["setup", "--dry-run", "--with-native-mocks", "--skip-install"]);

  assert.equal(fs.existsSync(path.join(projectDir, "jest.config.js")), false);
  assert.equal(fs.existsSync(path.join(projectDir, "jest.setup.ts")), false);
  assert.equal(fs.existsSync(path.join(projectDir, "__mocks__", "fileMock.tsx")), false);
});

test("setup merges existing jest files safely", () => {
  const projectDir = makeTempProject();
  fs.writeFileSync(
    path.join(projectDir, "jest.config.js"),
    "module.exports = { moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }, setupFilesAfterEnv: [] };\n",
    "utf8"
  );
  fs.writeFileSync(path.join(projectDir, "jest.setup.ts"), "export {};\n", "utf8");

  runCli(projectDir, ["setup", "--with-native-mocks", "--skip-install"]);

  const jestConfig = fs.readFileSync(path.join(projectDir, "jest.config.js"), "utf8");
  const jestSetup = fs.readFileSync(path.join(projectDir, "jest.setup.ts"), "utf8");

  assert.match(jestConfig, /react-native-responsive-fontsize/);
  assert.match(jestConfig, /styleMock\.ts/);
  assert.match(jestConfig, /react-native-config/);
  assert.match(jestSetup, /NativeAnimatedHelper/);
  assert.match(jestSetup, /react-native-reanimated/);
  assert.match(jestSetup, /react-native-device-info/);
  assert.equal(fs.existsSync(path.join(projectDir, "__mocks__", "styleMock.ts")), true);
  assert.equal(fs.existsSync(path.join(projectDir, "__mocks__", "react-native-config.ts")), true);
});
