import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_PATH = path.resolve("dist/bin.js");

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-native-testsmith-doctor-"));
  const pkg = {
    name: "fixture-app",
    version: "1.0.0",
    private: true,
    scripts: {}
  };
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return dir;
}

test("doctor --json returns structured output and non-zero on missing files", () => {
  const projectDir = makeTempProject();
  const run = spawnSync("node", [CLI_PATH, "doctor", "--json"], {
    cwd: projectDir,
    encoding: "utf8"
  });

  assert.equal(run.status, 1);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.ok, false);
  assert.ok(Array.isArray(parsed.missing));
  assert.ok(parsed.missing.includes("jest.config.js"));
});
