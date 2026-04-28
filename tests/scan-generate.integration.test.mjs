import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CLI_PATH = path.resolve("dist/bin.js");

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "react-native-testsmith-scan-"));
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

test("scan indexes React Native component metadata", () => {
  const projectDir = makeTempProject();
  const screensDir = path.join(projectDir, "src", "screens");
  fs.mkdirSync(screensDir, { recursive: true });

  const loginScreen = `import React from 'react';
import { View, Text, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

const LoginScreen = () => {
  const navigation = useNavigation();
  const user = useSelector((state) => state.user);

  const load = async () => {
    await fetch('https://example.com/login');
    navigation.navigate('Home');
  };

  return (
    <View>
      <Text>Login</Text>
      <Button title="Submit" onPress={load} />
      <Text>{user?.name}</Text>
    </View>
  );
};

export default LoginScreen;
`;

  fs.writeFileSync(path.join(screensDir, "LoginScreen.tsx"), loginScreen, "utf8");

  runCli(projectDir, ["scan"]);

  const reportPath = path.join(projectDir, ".react-native-testsmith", "scan-report.json");
  assert.equal(fs.existsSync(reportPath), true);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(Array.isArray(report.components), true);
  assert.equal(report.components.length, 1);
  assert.equal(report.components[0].componentName, "LoginScreen");
  assert.equal(report.components[0].hasNavigation, true);
  assert.equal(report.components[0].hasRedux, true);
  assert.equal(report.components[0].hasApiCalls, true);
  assert.ok(report.components[0].textLiterals.includes("Login"));
  assert.ok(report.components[0].buttonTitles.includes("Submit"));
});

test("generate creates test template with smart hints", () => {
  const projectDir = makeTempProject();
  const screensDir = path.join(projectDir, "src", "screens");
  fs.mkdirSync(screensDir, { recursive: true });

  const screenFilePath = path.join(screensDir, "LoginScreen.tsx");
  fs.writeFileSync(
    screenFilePath,
    "export default function LoginScreen() { return null; }\n",
    "utf8"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    projectRoot: projectDir,
    components: [
      {
        filePath: screenFilePath,
        componentName: "LoginScreen",
        hasNavigation: true,
        hasRedux: true,
        hasApiCalls: true,
        textLiterals: ["Login"],
        buttonTitles: ["Submit"]
      }
    ]
  };

  const reportDir = path.join(projectDir, ".react-native-testsmith");
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "scan-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  runCli(projectDir, ["generate"]);

  const outputPath = path.join(projectDir, "__tests__", "screens", "LoginScreen.test.tsx");
  assert.equal(fs.existsSync(outputPath), true);
  const generated = fs.readFileSync(outputPath, "utf8");

  assert.match(generated, /describe\('LoginScreen'/);
  assert.match(generated, /getByText\("Login"\)/);
  assert.match(generated, /getByText\("Submit"\)/);
  assert.match(generated, /@react-navigation\/native/);
  assert.match(generated, /TODO: wrap with Redux provider/);
  assert.match(generated, /TODO: add fetch\/axios mock/);
});
